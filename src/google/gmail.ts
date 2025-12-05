import {gmail_v1, google} from 'googleapis';
import {getOAuth2ClientForUser} from './client.js';

const MAX_RETRIES = 3;
const RETRYABLE_ERROR_CODES = [429, 500, 503, 504];

export async function listMessages(
  userId: string,
  retryCount = 0,
): Promise<gmail_v1.Schema$Message[]> {
  if (!userId || typeof userId !== 'string' || userId.length !== 24) {
    throw new Error(
      `Invalid userId provided to listMessages: ${userId}. Expected 24-character MongoDB ObjectId.`,
    );
  }

  const startTime = Date.now();
  console.log(
    `[Gmail API] [${new Date().toISOString()}] Fetching messages for userId: ${userId}, retryCount: ${retryCount}`,
  );

  let auth;
  try {
    auth = await getOAuth2ClientForUser(userId);
  } catch (authError: unknown) {
    interface ErrorWithDetails {
      constructor?: {name?: string};
      message?: string;
      code?: string | number;
      stack?: string;
    }
    const errorWithDetails = authError as ErrorWithDetails;
    const errorDetails = {
      userId,
      errorType: errorWithDetails?.constructor?.name,
      message: errorWithDetails?.message,
      code: errorWithDetails?.code,
      stack: errorWithDetails?.stack,
    };
    console.error(
      `[Gmail API] [${new Date().toISOString()}] Failed to get OAuth client for user ${userId}:`,
      errorDetails,
    );
    throw authError;
  }

  // Verify credentials are set
  if (!auth.credentials?.access_token) {
    console.error(
      `[Gmail API] [${new Date().toISOString()}] No access token available after getting OAuth client for user ${userId}`,
    );
    throw new Error('No access token available. Please re-authenticate.');
  }

  console.log(
    `[Gmail API] [${new Date().toISOString()}] Making request with access token for user ${userId}`,
  );

  const gmail = google.gmail({version: 'v1', auth});

  // Retry logic for transient failures
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      if (attempt > 0) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(
          `[Gmail API] Retry attempt ${attempt + 1}/${retryCount + 1}, waiting ${waitTime / 1000}s...`,
        );
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      const res = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 10,
        q: 'in:inbox', // Only fetch inbox messages
      });

      // Validate response
      if (!res.data) {
        throw new Error('Invalid response from Gmail API: missing data');
      }

      const messages = res.data.messages || [];
      console.log(
        `[Gmail API] [${new Date().toISOString()}] Found ${messages.length} message IDs for user ${userId}, fetching details...`,
      );

      // Use Promise.allSettled to handle partial failures with timeout
      const messagePromises = messages.map(async msg => {
        if (!msg.id) return null;
        try {
          const m = await Promise.race([
            gmail.users.messages.get({
              userId: 'me',
              id: msg.id,
              format: 'full',
            }),
            new Promise<never>((_, reject) => {
              setTimeout(
                () => reject(new Error('Message fetch timeout')),
                10000,
              ); // 10s timeout per message
            }),
          ]);
          return m.data;
        } catch (msgError: unknown) {
          interface ErrorWithDetails {
            constructor?: {name?: string};
            message?: string;
            code?: string | number;
          }
          const errorWithDetails = msgError as ErrorWithDetails;
          console.warn(
            `[Gmail API] Failed to fetch message ${msg.id} for user ${userId}:`,
            {
              errorType: errorWithDetails?.constructor?.name,
              message: errorWithDetails?.message,
              code: errorWithDetails?.code,
            },
          );
          return null; // Skip this message but continue with others
        }
      });

      const results = await Promise.allSettled(messagePromises);

      const successfulMessages = results
        .filter(
          (r): r is PromiseFulfilledResult<gmail_v1.Schema$Message> =>
            r.status === 'fulfilled' && r.value !== null,
        )
        .map(r => r.value);

      // Validate message structure
      const validMessages = successfulMessages.filter((msg: unknown) => {
        if (!msg || typeof msg !== 'object') {
          console.warn('[Gmail API] Invalid message object found:', msg);
          return false;
        }
        const msgTyped = msg as {id?: string};
        if (!msgTyped.id) {
          console.warn('[Gmail API] Message missing ID:', msg);
          return false;
        }
        return true;
      });

      const duration = Date.now() - startTime;
      console.log(
        `[Gmail API] [${new Date().toISOString()}] Successfully fetched ${validMessages.length} messages for user ${userId} (${duration}ms)`,
      );
      return validMessages;
    } catch (error: unknown) {
      lastError = error;
      interface ErrorWithCode {
        code?: string | number;
        message?: string;
        response?: {status?: number; data?: {error?: unknown}};
      }
      const errorWithCode = error as ErrorWithCode;
      const errorDetails = {
        userId,
        attempt: attempt + 1,
        retryCount: retryCount + 1,
        status: errorWithCode?.response?.status,
        message: errorWithCode?.message,
        code: errorWithCode?.code,
        errors: errorWithCode?.response?.data?.error,
        responseData: errorWithCode?.response?.data,
      };

      console.error(
        `[Gmail API] [${new Date().toISOString()}] Error fetching messages for user ${userId} (attempt ${attempt + 1}):`,
        errorDetails,
      );

      // Don't retry on certain errors
      if (
        errorWithCode?.code === 400 ||
        errorWithCode?.code === 401 ||
        errorWithCode?.code === 403
      ) {
        break; // Exit retry loop for non-retryable errors
      }

      // Retry on transient errors if we haven't exceeded max retries
      if (
        errorWithCode?.code &&
        typeof errorWithCode.code === 'number' &&
        RETRYABLE_ERROR_CODES.includes(errorWithCode.code) &&
        attempt < retryCount
      ) {
        continue; // Continue to next retry attempt
      }

      // If this is the last attempt or non-retryable error, break
      break;
    }
  }

  // Handle final error after all retries
  const error = lastError;
  if (!error) {
    throw new Error(
      'Unknown error occurred while fetching messages from Gmail',
    );
  }

  interface ErrorWithCode {
    code?: string | number;
    message?: string;
    response?: {status?: number; data?: {error?: {message?: string}}};
  }
  const errorWithCode = error as ErrorWithCode;
  const errorDetails = {
    userId,
    status: errorWithCode?.response?.status,
    message: errorWithCode?.message,
    code: errorWithCode?.code,
    errors: errorWithCode?.response?.data?.error,
  };

  console.error(
    `[Gmail API] [${new Date().toISOString()}] Failed to fetch messages after ${retryCount + 1} attempts for user ${userId}:`,
    errorDetails,
  );

  // Provide helpful error messages for common issues
  if (errorWithCode?.code === 403) {
    if (
      errorWithCode?.message?.includes('unregistered callers') ||
      errorWithCode?.response?.data?.error?.message?.includes('API not enabled')
    ) {
      throw new Error(
        'Gmail API is not enabled. Please enable it in Google Cloud Console: https://console.cloud.google.com/apis/library/gmail.googleapis.com',
      );
    } else if (
      errorWithCode?.message?.includes('insufficient permissions') ||
      errorWithCode?.response?.data?.error?.message?.includes('permission')
    ) {
      throw new Error(
        'Insufficient permissions to access Gmail. Please ensure the app has the required Gmail scopes and re-authenticate.',
      );
    } else {
      throw new Error(
        `Access denied to Gmail API (403). ${errorWithCode?.message || errorWithCode?.response?.data?.error?.message || 'Please check your permissions and API settings.'}`,
      );
    }
  } else if (errorWithCode?.code === 401) {
    // If we get a 401, try refreshing token once more
    if (retryCount < MAX_RETRIES) {
      console.log(
        `[Gmail API] Got 401 for user ${userId}, attempting token refresh and retry...`,
      );
      try {
        return listMessages(userId, retryCount + 1);
      } catch (refreshError: unknown) {
        interface RefreshError {
          constructor?: {name?: string};
          message?: string;
        }
        const refreshErrorWithDetails = refreshError as RefreshError;
        console.error(
          `[Gmail API] Failed to retry after 401 for user ${userId}:`,
          {
            errorType: refreshErrorWithDetails?.constructor?.name,
            message: refreshErrorWithDetails?.message,
          },
        );
        throw new Error(
          'Authentication failed. Please re-authenticate to access Gmail.',
        );
      }
    }
    throw new Error(
      'Authentication failed. Please re-authenticate to access Gmail.',
    );
  } else if (errorWithCode?.code === 429) {
    throw new Error(
      'Rate limit exceeded for Gmail API. Please try again later.',
    );
  } else if (
    errorWithCode?.code === 500 ||
    errorWithCode?.code === 503 ||
    errorWithCode?.code === 504
  ) {
    throw new Error(
      'Gmail API is temporarily unavailable. Please try again later.',
    );
  }

  // For other errors, provide a detailed message
  const errorMessage =
    errorWithCode?.message ||
    errorWithCode?.response?.data?.error?.message ||
    'Unknown error occurred while fetching messages from Gmail';
  throw new Error(`Failed to fetch messages from Gmail: ${errorMessage}`);
}

// Normalized shape for use by sync + DB + AI layers
export interface NormalizedEmail {
  id: string;
  threadId?: string;
  snippet?: string;
  subject: string;
  from: string;
  to: string[];
  date?: string;
}

/**
 * Helper to extract a header value from a Gmail message.
 */
function getHeader(msg: gmail_v1.Schema$Message, name: string): string {
  const headers = msg.payload?.headers || [];
  const h = headers.find(
    header => header.name?.toLowerCase() === name.toLowerCase(),
  );
  return h?.value || '';
}

/**
 * Wrapper used by higher-level layers (sync, AI, etc.)
 * Reuses listMessages and returns a clean, normalized array.
 */
export async function fetchNormalizedEmails(
  userId: string,
): Promise<NormalizedEmail[]> {
  const rawMessages = await listMessages(userId);

  return rawMessages.map(msg => ({
    id: msg.id ?? '',
    threadId: msg.threadId ?? '',
    snippet: msg.snippet ?? '',
    subject: getHeader(msg, 'Subject') || '(No subject)',
    from: getHeader(msg, 'From'),
    to: (() => {
      const toHeader = getHeader(msg, 'To');
      return toHeader
        ? toHeader
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        : [];
    })(),
    date: getHeader(msg, 'Date'),
  }));
}
