import {Auth, google} from 'googleapis';
import {config} from '../config.js';
import {GoogleTokens} from '../db/models/User.js';
import {UserRepository} from '../db/repositories/UserRepository.js';

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
    throw new Error(
      `Invalid userId provided: ${userId}. User ID must be a non-empty string.`,
    );
  }

  console.log(`[OAuth Client] Getting OAuth2 client for userId: ${userId}`);

  const userRepo = UserRepository.getInstance();
  let user;
  try {
    user = await userRepo.findById(userId);
  } catch (dbError: unknown) {
    interface ErrorWithMessage {
      message?: string;
      constructor?: {name?: string};
      stack?: string;
    }
    const errorWithMessage = dbError as ErrorWithMessage;
    console.error(
      `[OAuth Client] Database error while fetching user ${userId}:`,
      {
        errorType: errorWithMessage?.constructor?.name,
        message: errorWithMessage?.message,
        stack: errorWithMessage?.stack,
      },
    );
    throw new Error(
      `Failed to fetch user from database: ${errorWithMessage?.message || 'Unknown database error'}`,
    );
  }

  if (!user) {
    console.error(`[OAuth Client] User not found in database: ${userId}`);
    throw new Error(`User not found: ${userId}. Please sign in again.`);
  }

  let tokens = user.tokens;

  // Validate tokens exist
  if (!tokens) {
    console.error(`[OAuth Client] No tokens found for user ${userId}`);
    throw new Error(
      `No OAuth tokens found for user ${userId}. Please re-authenticate.`,
    );
  }

  // Check if token is expired or expiring soon (refresh 5 minutes before expiry)
  const now = Date.now();
  const refreshBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds
  const isExpired = tokens.expiry_date && tokens.expiry_date < now;
  const isExpiringSoon =
    tokens.expiry_date && tokens.expiry_date - now < refreshBuffer;

  // Refresh if expired or expiring soon
  if (isExpired || isExpiringSoon) {
    if (!tokens.refresh_token) {
      console.error(
        `[OAuth Client] Token expired but no refresh token available for user ${userId}`,
      );
      throw new Error(
        `Access token expired and no refresh token available for user ${userId}. Please re-authenticate.`,
      );
    }

    const reason = isExpired ? 'expired' : 'expiring soon';
    console.log(
      `[OAuth Client] Token ${reason}, refreshing for user ${userId}...`,
      {
        expiryDate: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : 'unknown',
        now: new Date(now).toISOString(),
        expiredBy: tokens.expiry_date
          ? Math.round((now - tokens.expiry_date) / 1000) + 's'
          : 'unknown',
        expiresIn: tokens.expiry_date
          ? Math.round((tokens.expiry_date - now) / 1000) + 's'
          : 'unknown',
        hasRefreshToken: !!tokens.refresh_token,
      },
    );

    // Retry logic with exponential backoff
    const maxRetries = 3;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const tempClient = new google.auth.OAuth2(
          config.google.clientId,
          config.google.clientSecret,
          config.google.redirectUri,
        );
        tempClient.setCredentials({
          refresh_token: tokens.refresh_token,
        });

        console.log(
          `[OAuth Client] Token refresh attempt ${attempt}/${maxRetries} for user ${userId}`,
        );
        const {credentials} = await tempClient.refreshAccessToken();

        // Ensure all required token fields are present and not null
        if (!credentials.access_token) {
          console.error(
            `[OAuth Client] Token refresh response missing access_token for user ${userId}`,
          );
          throw new Error(
            'Invalid token response from Google: missing access_token',
          );
        }

        if (!credentials.refresh_token && !tokens.refresh_token) {
          console.error(
            `[OAuth Client] Token refresh response missing refresh_token for user ${userId}`,
          );
          throw new Error(
            'Invalid token response from Google: missing refresh_token',
          );
        }

        // Calculate expiry_date from expires_in if provided
        // Google OAuth credentials may have expires_in (seconds) or expiry_date (milliseconds timestamp)
        interface CredentialsWithExpiresIn {
          expires_in?: number;
          expiry_date?: number;
        }
        const credentialsWithExpiry = credentials as CredentialsWithExpiresIn;
        let newExpiryDate: number;
        if (credentialsWithExpiry.expiry_date) {
          newExpiryDate = credentialsWithExpiry.expiry_date;
        } else if (credentialsWithExpiry.expires_in) {
          newExpiryDate = Date.now() + credentialsWithExpiry.expires_in * 1000;
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

        console.log(
          `[OAuth Client] Token refreshed successfully for user ${userId} (attempt ${attempt})`,
          {
            newExpiryDate: new Date(newExpiryDate).toISOString(),
            expiresIn:
              Math.round((newExpiryDate - Date.now()) / 1000 / 60) + ' minutes',
          },
        );

        // Update tokens in database
        try {
          await userRepo.updateTokens(userId, newTokens);
          tokens = newTokens;
          break; // Success, exit retry loop
        } catch (updateError: unknown) {
          interface ErrorWithDetails {
            constructor?: {name?: string};
            message?: string;
            stack?: string;
          }
          const errorWithDetails = updateError as ErrorWithDetails;
          console.error(
            `[OAuth Client] Failed to update tokens in database for user ${userId}:`,
            {
              errorType: errorWithDetails?.constructor?.name,
              message: errorWithDetails?.message,
              stack: errorWithDetails?.stack,
            },
          );
          throw new Error(
            `Failed to save refreshed tokens to database: ${errorWithDetails?.message || 'Unknown error'}`,
          );
        }
      } catch (error: unknown) {
        lastError = error;
        interface ErrorWithDetails {
          constructor?: {name?: string};
          message?: string;
          code?: string | number;
          response?: {data?: unknown};
        }
        const errorWithDetails = error as ErrorWithDetails;
        const errorDetails = {
          userId,
          attempt,
          maxRetries,
          errorType: errorWithDetails?.constructor?.name,
          message: errorWithDetails?.message,
          code: errorWithDetails?.code,
          response: errorWithDetails?.response?.data,
        };

        console.error(
          `[OAuth Client] Token refresh attempt ${attempt} failed for user ${userId}:`,
          errorDetails,
        );

        // Don't retry on certain errors
        if (
          errorWithDetails?.code === 400 ||
          errorWithDetails?.message?.includes('invalid_grant')
        ) {
          throw new Error(
            'Refresh token is invalid or revoked. Please re-authenticate.',
          );
        } else if (errorWithDetails?.code === 401) {
          throw new Error(
            'Authentication failed during token refresh. Please re-authenticate.',
          );
        }

        // If this is not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
          console.log(
            `[OAuth Client] Retrying token refresh in ${waitTime / 1000}s...`,
          );
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // If we exhausted all retries, throw the last error
    if (lastError) {
      interface ErrorWithDetails {
        constructor?: {name?: string};
        message?: string;
        code?: string | number;
        response?: {data?: unknown};
        stack?: string;
      }
      const errorWithDetails = lastError as ErrorWithDetails;
      const errorDetails = {
        userId,
        errorType: errorWithDetails?.constructor?.name,
        message: errorWithDetails?.message,
        code: errorWithDetails?.code,
        response: errorWithDetails?.response?.data,
        stack: errorWithDetails?.stack,
      };

      console.error(
        `[OAuth Client] Failed to refresh access token after ${maxRetries} attempts for user ${userId}:`,
        errorDetails,
      );
      throw new Error(
        `Token refresh failed after ${maxRetries} attempts: ${errorWithDetails?.message || 'Unknown error'}. Please re-authenticate.`,
      );
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
    isExpired: credentials.expiry_date
      ? credentials.expiry_date < Date.now()
      : 'unknown',
    scopes: credentials.scope,
  });

  // Validate token format before setting
  if (
    !credentials.access_token ||
    typeof credentials.access_token !== 'string'
  ) {
    console.error(
      `[OAuth Client] Invalid access token format for user ${userId}:`,
      {
        hasAccessToken: !!credentials.access_token,
        tokenType: typeof credentials.access_token,
      },
    );
    throw new Error(
      `No valid access token found for user ${userId}. Token may be expired and refresh failed. Please re-authenticate.`,
    );
  }

  try {
    client.setCredentials(credentials);
  } catch (setError: unknown) {
    interface ErrorWithDetails {
      constructor?: {name?: string};
      message?: string;
      stack?: string;
    }
    const errorWithDetails = setError as ErrorWithDetails;
    console.error(
      `[OAuth Client] Failed to set credentials on OAuth client for user ${userId}:`,
      {
        errorType: errorWithDetails?.constructor?.name,
        message: errorWithDetails?.message,
        stack: errorWithDetails?.stack,
      },
    );
    throw new Error(
      `Failed to configure OAuth client: ${errorWithDetails?.message || 'Unknown error'}`,
    );
  }

  // Verify credentials are set correctly
  const setCreds = client.credentials;
  if (!setCreds?.access_token) {
    console.error(
      `[OAuth Client] Failed to verify credentials after setting for user ${userId}. Original tokens:`,
      {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        tokenType: tokens.token_type,
      },
    );
    throw new Error(
      `Failed to set access token on OAuth client for user ${userId}. Please re-authenticate.`,
    );
  }

  console.log('Credentials verified on client:', {
    hasAccessToken: !!setCreds.access_token,
    accessTokenLength: setCreds.access_token?.length,
    tokenType: setCreds.token_type,
    expiryDate: setCreds.expiry_date,
  });

  return client;
}
