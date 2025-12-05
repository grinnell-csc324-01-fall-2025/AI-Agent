import {Router} from 'express';
import {config} from '../config.js';
import {GoogleTokens} from '../db/models/User.js';
import {UserRepository} from '../db/repositories/UserRepository.js';
import {getAuthUrl, getTokens} from '../google/client.js';

export const authRouter = Router();

import * as crypto from 'crypto';

// Helper to create a signed state value (HMAC)
// This allows us to verify state without needing MongoDB
function createSignedState(state: string, timestamp: number): string {
  const secret = config.session.secret;
  const data = `${state}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
  // Format: state:timestamp:signature
  return Buffer.from(`${data}:${hmac}`).toString('base64url');
}

// Helper to verify and extract state from signed value
function verifySignedState(
  signedState: string,
): {state: string; timestamp: number} | null {
  try {
    const decoded = Buffer.from(signedState, 'base64url').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return null;

    const [state, timestampStr, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) return null;

    // Verify signature
    const secret = config.session.secret;
    const data = `${state}:${timestamp}`;
    const expectedHmac = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    if (
      signature.length !== expectedHmac.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHmac))
    ) {
      return null;
    }

    return {state, timestamp};
  } catch {
    return null;
  }
}

// Starts interactive auth and redirects to Google sign-in
authRouter.get('/signin', async (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  const timestamp = Date.now();

  // Create signed state that we'll use to verify the callback
  // This works without MongoDB - we verify using HMAC signature
  const signedState = createSignedState(state, timestamp);

  console.log('Starting OAuth flow:', {
    sessionId: req.sessionID,
    state: state,
    timestamp: timestamp,
    cookie: req.headers.cookie,
  });

  // Set state in a cookie (works without MongoDB)
  // This is the primary method - session is a backup
  const isSecure =
    process.env.NODE_ENV === 'production' ||
    !!process.env.VERCEL ||
    !!process.env.VERCEL_ENV;

  res.cookie('oauth_state', signedState, {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: '/',
  });

  // Also try to save to session as backup (non-blocking)
  if (req.session) {
    req.session.oauthState = signedState; // Store signed state in session too
    req.session.oauthStateTimestamp = timestamp;
    // Don't await - let it save in background
    req.session.save(err => {
      if (err) {
        console.warn('Session save failed (using URL state as primary):', err);
      } else {
        console.log('Session saved successfully as backup');
      }
    });
  }

  // Pass signed state to Google - it will be returned in the callback URL
  // This is the primary verification method (no cookie dependency)
  const url = getAuthUrl(signedState);
  console.log('Redirecting to Google OAuth (using URL-based signed state)');
  return res.redirect(url);
});

// Handles the auth redirect and exchanges the code for an access token
authRouter.get('/callback', async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string; // This is now the signed state from Google

  if (!code) {
    return res.status(400).json({ok: false, error: 'Missing auth code'});
  }

  if (!state) {
    return res.status(400).json({ok: false, error: 'Missing state parameter'});
  }

  let stateValid = false;
  let stateTimestamp: number | undefined;
  let verificationMethod = 'none';

  // PRIMARY METHOD: Verify the signed state directly from the URL parameter
  // Google returns the exact state we sent, which is now the signed state
  // This works without cookies - we verify using HMAC signature
  const urlVerified = verifySignedState(state);
  if (urlVerified) {
    stateValid = true;
    stateTimestamp = urlVerified.timestamp;
    verificationMethod = 'url-signed-state';
    console.log('State verified via URL signed state (primary method):', {
      statePrefix: state.substring(0, 16) + '...',
      timestamp: stateTimestamp,
      age: Date.now() - stateTimestamp + 'ms',
    });
  }

  // FALLBACK 1: Try cookie-based state verification
  if (!stateValid) {
    const signedStateCookie = req.cookies?.oauth_state;
    if (signedStateCookie) {
      // Compare cookie with URL state (both should be signed states now)
      if (signedStateCookie === state) {
        const cookieVerified = verifySignedState(signedStateCookie);
        if (cookieVerified) {
          stateValid = true;
          stateTimestamp = cookieVerified.timestamp;
          verificationMethod = 'cookie-match';
          console.log('State verified via cookie match (fallback 1):', {
            statePrefix: state.substring(0, 16) + '...',
            timestamp: stateTimestamp,
          });
        }
      } else {
        console.warn('Cookie state does not match URL state:', {
          urlStatePrefix: state.substring(0, 16) + '...',
          cookieStatePrefix: signedStateCookie.substring(0, 16) + '...',
        });
      }
    }
  }

  // FALLBACK 2: Try session-based state verification
  if (!stateValid && req.session) {
    const sessionState = req.session.oauthState;
    const sessionTimestamp = req.session.oauthStateTimestamp;

    if (sessionState && sessionState === state) {
      stateValid = true;
      stateTimestamp = sessionTimestamp;
      verificationMethod = 'session-match';
      console.log('State verified via session match (fallback 2):', {
        statePrefix: state.substring(0, 16) + '...',
        timestamp: stateTimestamp,
      });
    }
  }

  // Clear state from both cookie and session
  res.clearCookie('oauth_state', {path: '/'});
  if (req.session) {
    delete req.session.oauthState;
    delete req.session.oauthStateTimestamp;
  }

  if (!stateValid) {
    console.error('State verification failed - all methods exhausted:', {
      receivedStatePrefix: state.substring(0, 16) + '...',
      receivedStateLength: state.length,
      urlVerificationResult: urlVerified ? 'valid' : 'invalid/null',
      hasCookie: !!req.cookies?.oauth_state,
      hasSession: !!req.session,
      sessionHasState: !!req.session?.oauthState,
      cookieKeys: Object.keys(req.cookies || {}),
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
      verificationMethod,
    });
    return res.status(400).json({ok: false, error: 'State parameter expired'});
  }

  console.log('OAuth state verification successful:', {
    method: verificationMethod,
    age: Date.now() - stateTimestamp + 'ms',
  });

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
    // Google OAuth tokens may have expires_in (seconds) or expiry_date (milliseconds timestamp)
    interface TokenWithExpiresIn {
      expires_in?: number;
      expiry_date?: number;
    }
    const tokenWithExpiry = tokens as TokenWithExpiresIn;
    let expiryDate: number;
    if (tokenWithExpiry.expiry_date) {
      expiryDate = tokenWithExpiry.expiry_date;
    } else if (tokenWithExpiry.expires_in) {
      // expires_in is in seconds, convert to milliseconds timestamp
      expiryDate = Date.now() + tokenWithExpiry.expires_in * 1000;
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

    // Manually save session to ensure userId persists before redirecting
    // Use a promise-based approach with longer timeout for cold starts
    // CRITICAL: userId MUST be saved to session, or user will be logged out on next request
    const saveStartTime = Date.now();
    try {
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          const duration = Date.now() - saveStartTime;
          console.error('Session save timeout during callback:', {
            duration,
            sessionId: req.sessionID,
            userId: user._id.toString(),
          });
          reject(new Error(`Session save timeout after ${duration}ms`));
        }, 10000); // Increased to 10 seconds for cold starts

        console.log('Attempting to save session during callback:', {
          sessionId: req.sessionID,
          userId: user._id.toString(),
        });

        req.session.save(err => {
          clearTimeout(timeoutId);
          const duration = Date.now() - saveStartTime;
          if (err) {
            console.error('Session save error during callback:', {
              error: err,
              duration,
              sessionId: req.sessionID,
              userId: user._id.toString(),
              errorMessage: err instanceof Error ? err.message : String(err),
            });
            reject(err);
          } else {
            console.log('Session saved successfully during callback:', {
              duration,
              sessionId: req.sessionID,
              userId: user._id.toString(),
            });
            resolve();
          }
        });
      });
      return res.redirect('/tabs/personal/index.html');
    } catch (saveError) {
      const duration = Date.now() - saveStartTime;
      console.error('Failed to save session during callback:', {
        error: saveError,
        duration,
        sessionId: req.sessionID,
        userId: user._id.toString(),
      });
      // userId was not saved - user will be logged out on next request
      // Return error so user can retry instead of creating broken auth state
      return res.status(500).json({
        ok: false,
        error:
          'Authentication succeeded but failed to create session. Please sign in again.',
      });
    }
  } catch (e) {
    console.error('OAuth callback error:', e);
    return res.status(500).json({ok: false, error: 'Authentication failed'});
  }
});

// Sign out endpoint
authRouter.get('/signout', (req, res) => {
  // Clear all auth-related cookies
  res.clearCookie('connect.sid', {path: '/'});
  res.clearCookie('oauth_state', {path: '/'});

  if (req.session) {
    req.session.destroy(err => {
      if (err) {
        console.error('Error destroying session:', err);
        // Even if session destroy fails, redirect to app (user will see sign-in button)
      }
      // Redirect to the app homepage, not signin (which would start OAuth flow)
      res.redirect('/tabs/personal/index.html');
    });
  } else {
    res.redirect('/tabs/personal/index.html');
  }
});
