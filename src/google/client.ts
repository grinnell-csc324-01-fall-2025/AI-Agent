import { Auth, google } from 'googleapis';
import { config } from '../config.js';
import { GoogleTokens } from '../db/models/User.js';
import { UserRepository } from '../db/repositories/UserRepository.js';

export const oauth2Client = new google.auth.OAuth2(
  config.google.clientId,
  config.google.clientSecret,
  config.google.redirectUri,
);

export function getAuthUrl(state?: string) {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'openid', // Required for ID token
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      ...config.google.scopes,
    ],
    state: state,
    prompt: 'consent', // Force consent to get refresh token
  });
}

export async function getTokens(code: string) {
  const {tokens} = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  return tokens;
}

/**
 * Creates an OAuth2 client for a specific user.
 * Loads tokens from database, refreshes if expired, and returns configured client.
 * @param userId The user's MongoDB ID
 * @returns Configured OAuth2 client for the user
 * @throws Error if user not found or tokens invalid
 */
export async function getOAuth2ClientForUser(
  userId: string,
): Promise<Auth.OAuth2Client> {
  if (!userId || typeof userId !== 'string') {
    throw new Error(`Invalid userId provided: ${userId}. User ID must be a non-empty string.`);
  }

  console.log(`[OAuth Client] Getting OAuth2 client for userId: ${userId}`);
  
  const userRepo = UserRepository.getInstance();
  let user;
  try {
    user = await userRepo.findById(userId);
  } catch (dbError: any) {
    console.error(`[OAuth Client] Database error while fetching user ${userId}:`, {
      errorType: dbError?.constructor?.name,
      message: dbError?.message,
      stack: dbError?.stack,
    });
    throw new Error(`Failed to fetch user from database: ${dbError?.message || 'Unknown database error'}`);
  }

  if (!user) {
    console.error(`[OAuth Client] User not found in database: ${userId}`);
    throw new Error(`User not found: ${userId}. Please sign in again.`);
  }

  let tokens = user.tokens;
  
  // Validate tokens exist
  if (!tokens) {
    console.error(`[OAuth Client] No tokens found for user ${userId}`);
    throw new Error(`No OAuth tokens found for user ${userId}. Please re-authenticate.`);
  }

  // Check if token is expired (not just expiring soon)
  const now = Date.now();
  const isExpired = tokens.expiry_date && tokens.expiry_date < now;

  // Always refresh if expired, even if just expired
  if (isExpired) {
    if (!tokens.refresh_token) {
      console.error(`[OAuth Client] Token expired but no refresh token available for user ${userId}`);
      throw new Error(`Access token expired and no refresh token available for user ${userId}. Please re-authenticate.`);
    }
    
    console.log(`[OAuth Client] Token expired, refreshing for user ${userId}...`, {
      expiryDate: tokens.expiry_date,
      now: now,
      expiredBy: now - (tokens.expiry_date || 0),
      hasRefreshToken: !!tokens.refresh_token,
    });
    
    try {
      const tempClient = new google.auth.OAuth2(
        config.google.clientId,
        config.google.clientSecret,
        config.google.redirectUri,
      );
      tempClient.setCredentials({
        refresh_token: tokens.refresh_token,
      });

      const {credentials} = await tempClient.refreshAccessToken();
      
      // Ensure all required token fields are present and not null
      if (!credentials.access_token) {
        console.error(`[OAuth Client] Token refresh response missing access_token for user ${userId}`);
        throw new Error('Invalid token response from Google: missing access_token');
      }
      
      if (!credentials.refresh_token && !tokens.refresh_token) {
        console.error(`[OAuth Client] Token refresh response missing refresh_token for user ${userId}`);
        throw new Error('Invalid token response from Google: missing refresh_token');
      }

      // Calculate expiry_date from expires_in if provided
      let newExpiryDate: number;
      if (credentials.expiry_date) {
        newExpiryDate = credentials.expiry_date;
      } else if ((credentials as any).expires_in) {
        newExpiryDate = Date.now() + ((credentials as any).expires_in * 1000);
      } else {
        newExpiryDate = Date.now() + 3600 * 1000; // Default 1 hour
      }
      
      const newTokens: GoogleTokens = {
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || tokens.refresh_token,
        scope: credentials.scope || tokens.scope,
        token_type: credentials.token_type || tokens.token_type,
        expiry_date: newExpiryDate,
      };
      
      console.log(`[OAuth Client] Token refreshed successfully for user ${userId}`, {
        newExpiryDate: newExpiryDate,
        expiresIn: Math.round((newExpiryDate - Date.now()) / 1000 / 60) + ' minutes',
      });

      // Update tokens in database
      try {
        await userRepo.updateTokens(userId, newTokens);
        tokens = newTokens;
      } catch (updateError: any) {
        console.error(`[OAuth Client] Failed to update tokens in database for user ${userId}:`, {
          errorType: updateError?.constructor?.name,
          message: updateError?.message,
          stack: updateError?.stack,
        });
        throw new Error(`Failed to save refreshed tokens to database: ${updateError?.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      const errorDetails = {
        userId,
        errorType: error?.constructor?.name,
        message: error?.message,
        code: error?.code,
        response: error?.response?.data,
        stack: error?.stack,
      };
      
      console.error(`[OAuth Client] Failed to refresh access token for user ${userId}:`, errorDetails);
      
      // Provide specific error messages based on error type
      if (error?.code === 400 || error?.message?.includes('invalid_grant')) {
        throw new Error('Refresh token is invalid or revoked. Please re-authenticate.');
      } else if (error?.code === 401) {
        throw new Error('Authentication failed during token refresh. Please re-authenticate.');
      } else {
        throw new Error(`Token refresh failed: ${error?.message || 'Unknown error'}. Please re-authenticate.`);
      }
    }
  }

  // Create new OAuth2 client instance for this user
  const client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri,
  );
  
  // Convert our GoogleTokens format to the format expected by OAuth2Client
  // OAuth2Client expects: { access_token, refresh_token, scope, token_type, expiry_date }
  const credentials = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope,
    token_type: tokens.token_type,
    expiry_date: tokens.expiry_date,
  };
  
  console.log('Setting credentials on OAuth client for user:', userId, {
    hasAccessToken: !!credentials.access_token,
    accessTokenLength: credentials.access_token?.length,
    hasRefreshToken: !!credentials.refresh_token,
    tokenType: credentials.token_type,
    expiryDate: credentials.expiry_date,
    isExpired: credentials.expiry_date ? credentials.expiry_date < Date.now() : 'unknown',
    scopes: credentials.scope,
  });
  
  // Validate token format before setting
  if (!credentials.access_token || typeof credentials.access_token !== 'string') {
    console.error(`[OAuth Client] Invalid access token format for user ${userId}:`, {
      hasAccessToken: !!credentials.access_token,
      tokenType: typeof credentials.access_token,
    });
    throw new Error(`No valid access token found for user ${userId}. Token may be expired and refresh failed. Please re-authenticate.`);
  }
  
  try {
    client.setCredentials(credentials);
  } catch (setError: any) {
    console.error(`[OAuth Client] Failed to set credentials on OAuth client for user ${userId}:`, {
      errorType: setError?.constructor?.name,
      message: setError?.message,
      stack: setError?.stack,
    });
    throw new Error(`Failed to configure OAuth client: ${setError?.message || 'Unknown error'}`);
  }
  
  // Verify credentials are set correctly
  const setCreds = client.credentials;
  if (!setCreds?.access_token) {
    console.error(`[OAuth Client] Failed to verify credentials after setting for user ${userId}. Original tokens:`, {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      tokenType: tokens.token_type,
    });
    throw new Error(`Failed to set access token on OAuth client for user ${userId}. Please re-authenticate.`);
  }
  
  console.log('Credentials verified on client:', {
    hasAccessToken: !!setCreds.access_token,
    accessTokenLength: setCreds.access_token?.length,
    tokenType: setCreds.token_type,
    expiryDate: setCreds.expiry_date,
  });

  return client;
}
