import {Router} from 'express';
import {config} from '../config.js';
import {GoogleTokens} from '../db/models/User.js';
import {UserRepository} from '../db/repositories/UserRepository.js';
import {getAuthUrl, getTokens} from '../google/client.js';

export const authRouter = Router();

import * as crypto from 'crypto';

// Starts interactive auth and redirects to Google sign-in
authRouter.get('/signin', (req, res) => {
  // Store state in session instead of in-memory Map
  // This works in serverless environments where different instances handle different requests
  if (!req.session) {
    return res
      .status(500)
      .json({ok: false, error: 'Session middleware not configured'});
  }

  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;
  req.session.oauthStateTimestamp = Date.now();

  console.log('Starting OAuth flow:', {
    sessionId: req.sessionID,
    state: state,
    timestamp: req.session.oauthStateTimestamp,
  });

  const url = getAuthUrl(state);
  return res.redirect(url);
});

// Handles the auth redirect and exchanges the code for an access token
authRouter.get('/callback', async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string;

  if (!req.session) {
    return res
      .status(500)
      .json({ok: false, error: 'Session middleware not configured'});
  }

  // Validate state from session instead of in-memory Map
  const sessionState = req.session.oauthState;
  const stateTimestamp = req.session.oauthStateTimestamp;

  // Check if state matches
  if (!state || !sessionState || state !== sessionState) {
    console.error('State mismatch:', {
      received: state,
      expected: sessionState,
      hasSessionState: !!sessionState,
      sessionId: req.sessionID,
      sessionData: JSON.stringify(req.session),
    });
    return res.status(400).json({ok: false, error: 'Invalid state parameter'});
  }

  // Check if state is expired (older than 10 minutes)
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  if (!stateTimestamp || stateTimestamp < tenMinutesAgo) {
    console.error('State expired:', {
      timestamp: stateTimestamp,
      tenMinutesAgo,
      age: stateTimestamp ? Date.now() - stateTimestamp : 'unknown',
    });
    // Clear invalid state
    delete req.session.oauthState;
    delete req.session.oauthStateTimestamp;
    return res.status(400).json({ok: false, error: 'State parameter expired'});
  }

  // Clear state from session after validation
  delete req.session.oauthState;
  delete req.session.oauthStateTimestamp;

  if (!code) {
    return res.status(400).json({ok: false, error: 'Missing auth code'});
  }

  try {
    // Exchange code for tokens
    const tokens = await getTokens(code);

    // Debug: Log token structure (without sensitive data)
    console.log('Token keys:', Object.keys(tokens));
    console.log('Has access_token:', !!tokens.access_token);
    console.log('Has refresh_token:', !!tokens.refresh_token);
    console.log('Has id_token:', !!tokens.id_token);

    // Ensure we have an access token
    if (!tokens.access_token) {
      console.error(
        'Token response structure:',
        JSON.stringify(tokens, null, 2),
      );
      throw new Error('No access token received from Google');
    }

    let profile:
      | {email: string; id: string; name: string; picture?: string}
      | undefined;

    // Try to get user info from ID token first (if available)
    // ID token contains user info and doesn't require an API call
    if (tokens.id_token) {
      console.log('Found ID token, attempting to decode user info from it...');
      try {
        // ID token is a JWT - decode it to get user info
        // Format: header.payload.signature
        const idTokenParts = (tokens.id_token as string).split('.');
        if (idTokenParts.length === 3) {
          // Decode the payload (base64url)
          const payload = JSON.parse(
            Buffer.from(idTokenParts[1], 'base64url').toString('utf-8'),
          );

          console.log('Decoded ID token payload:', {
            email: payload.email,
            sub: payload.sub,
            name: payload.name,
            picture: payload.picture,
          });

          // Use the ID token payload for user info
          if (payload.email && payload.sub && payload.name) {
            profile = {
              email: payload.email,
              id: payload.sub,
              name: payload.name,
              picture: payload.picture,
            };
            console.log('Successfully extracted user info from ID token');
          } else {
            throw new Error('ID token missing required fields');
          }
        } else {
          throw new Error('Invalid ID token format');
        }
      } catch (idTokenError) {
        console.error(
          'Error decoding ID token, falling back to API call:',
          idTokenError,
        );
        // Fall through to API call method below
        profile = undefined;
      }
    }

    // If we don't have profile from ID token, fetch it via API
    if (!profile) {
      console.log(
        'Fetching user info via API (ID token not available or failed)...',
      );

      // Create a completely fresh OAuth2 client with the tokens
      // This ensures we have a clean client instance
      const {google} = await import('googleapis');

      const userInfoClient = new google.auth.OAuth2(
        config.google.clientId,
        config.google.clientSecret,
        config.google.redirectUri,
      );

      // Set credentials with the tokens we just received
      // The tokens object from getToken() should have the correct structure
      userInfoClient.setCredentials(tokens);

      // Verify the credentials were set correctly
      const setCreds = userInfoClient.credentials;
      console.log('Fresh OAuth client credentials:', {
        hasAccessToken: !!setCreds?.access_token,
        accessTokenLength: setCreds?.access_token?.length,
        tokenType: setCreds?.token_type,
        hasExpiry: !!setCreds?.expiry_date,
      });

      // Use googleapis library's oauth2.userinfo.get() method
      console.log(
        'Fetching user info using googleapis oauth2.userinfo.get()...',
      );
      const oauth2 = google.oauth2({version: 'v2', auth: userInfoClient});

      const profileResponse = await oauth2.userinfo.get();
      profile = profileResponse.data as {
        email: string;
        id: string;
        name: string;
        picture?: string;
      };

      console.log('Successfully fetched user profile via API:', {
        email: profile.email,
        id: profile.id,
        name: profile.name,
      });

      if (!profile.email || !profile.id || !profile.name) {
        throw new Error('Missing required user profile information');
      }
    }

    // Validate profile (from either ID token or API)
    if (!profile.email || !profile.id || !profile.name) {
      throw new Error('Missing required user profile information');
    }

    // Prepare tokens with proper typing
    // Calculate expiry_date from expires_in if provided, otherwise use expiry_date or default to 1 hour
    let expiryDate: number;
    if (tokens.expiry_date) {
      expiryDate = tokens.expiry_date;
    } else if ((tokens as any).expires_in) {
      // expires_in is in seconds, convert to milliseconds timestamp
      expiryDate = Date.now() + (tokens as any).expires_in * 1000;
    } else {
      // Default to 1 hour if neither is provided
      expiryDate = Date.now() + 3600 * 1000;
    }

    const googleTokens: GoogleTokens = {
      access_token: tokens.access_token || '',
      refresh_token: tokens.refresh_token || '',
      scope: tokens.scope || config.google.scopes.join(' '),
      token_type: tokens.token_type || 'Bearer',
      expiry_date: expiryDate,
    };

    // Save user to database
    const userRepo = UserRepository.getInstance();
    const user = await userRepo.createOrUpdateUser({
      email: profile.email,
      googleId: profile.id,
      name: profile.name,
      picture: profile.picture || undefined,
      tokens: googleTokens,
    });

    // Create session
    if (!req.session) {
      throw new Error('Session middleware not configured');
    }
    req.session.userId = user._id.toString();

    return res.redirect('/tabs/personal/index.html');
  } catch (e) {
    console.error('OAuth callback error:', e);
    return res.status(500).json({ok: false, error: 'Authentication failed'});
  }
});

// Sign out endpoint
authRouter.get('/signout', (req, res) => {
  if (req.session) {
    req.session.destroy(err => {
      if (err) {
        console.error('Error destroying session:', err);
        res.status(500).json({ok: false, error: 'Failed to sign out'});
        return;
      }
      res.clearCookie('connect.sid');
      res.redirect('/auth/signin');
    });
  } else {
    res.redirect('/auth/signin');
  }
});
