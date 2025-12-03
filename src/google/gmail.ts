import { gmail_v1, google } from 'googleapis';
import { getOAuth2ClientForUser } from './client.js';

const MAX_RETRIES = 3;
const RETRYABLE_ERROR_CODES = [429, 500, 503, 504];

export async function listMessages(userId: string, retryCount = 0): Promise<gmail_v1.Schema$Message[]> {
  if (!userId || typeof userId !== 'string' || userId.length !== 24) {
    throw new Error(`Invalid userId provided to listMessages: ${userId}. Expected 24-character MongoDB ObjectId.`);
  }
  
  const startTime = Date.now();
  console.log(`[Gmail API] [${new Date().toISOString()}] Fetching messages for userId: ${userId}, retryCount: ${retryCount}`);
  
  let auth;
  try {
    auth = await getOAuth2ClientForUser(userId);
  } catch (authError: any) {
    const errorDetails = {
      userId,
      errorType: authError?.constructor?.name,
      message: authError?.message,
      code: authError?.code,
      stack: authError?.stack,
    };
    console.error(`[Gmail API] [${new Date().toISOString()}] Failed to get OAuth client for user ${userId}:`, errorDetails);
    throw authError;
  }
  
  // Verify credentials are set
  if (!auth.credentials?.access_token) {
    console.error(`[Gmail API] [${new Date().toISOString()}] No access token available after getting OAuth client for user ${userId}`);
    throw new Error('No access token available. Please re-authenticate.');
  }
  
  console.log(`[Gmail API] [${new Date().toISOString()}] Making request with access token for user ${userId}`);
  
  const gmail = google.gmail({version: 'v1', auth});
  
  // Retry logic for transient failures
  let lastError: any = null;
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      if (attempt > 0) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`[Gmail API] Retry attempt ${attempt + 1}/${retryCount + 1}, waiting ${waitTime / 1000}s...`);
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
      console.log(`[Gmail API] [${new Date().toISOString()}] Found ${messages.length} message IDs for user ${userId}, fetching details...`);

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
              setTimeout(() => reject(new Error('Message fetch timeout')), 10000); // 10s timeout per message
            }),
          ]);
          return m.data;
        } catch (msgError: any) {
          console.warn(`[Gmail API] Failed to fetch message ${msg.id} for user ${userId}:`, {
            errorType: msgError?.constructor?.name,
            message: msgError?.message,
            code: msgError?.code,
          });
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
      const validMessages = successfulMessages.filter((msg: any) => {
        if (!msg || typeof msg !== 'object') {
          console.warn('[Gmail API] Invalid message object found:', msg);
          return false;
        }
        if (!msg.id) {
          console.warn('[Gmail API] Message missing ID:', msg);
          return false;
        }
        return true;
      });
      
      const duration = Date.now() - startTime;
      console.log(`[Gmail API] [${new Date().toISOString()}] Successfully fetched ${validMessages.length} messages for user ${userId} (${duration}ms)`);
      return validMessages;
    } catch (error: any) {
      lastError = error;
      const errorDetails = {
        userId,
        attempt: attempt + 1,
        retryCount: retryCount + 1,
        status: error?.response?.status,
        message: error?.message,
        code: error?.code,
        errors: error?.response?.data?.error,
        responseData: error?.response?.data,
      };
      
      console.error(`[Gmail API] [${new Date().toISOString()}] Error fetching messages for user ${userId} (attempt ${attempt + 1}):`, errorDetails);
      
      // Don't retry on certain errors
      if (error?.code === 400 || error?.code === 401 || error?.code === 403) {
        break; // Exit retry loop for non-retryable errors
      }
      
      // Retry on transient errors if we haven't exceeded max retries
      if (RETRYABLE_ERROR_CODES.includes(error?.code) && attempt < retryCount) {
        continue; // Continue to next retry attempt
      }
      
      // If this is the last attempt or non-retryable error, break
      break;
    }
  }
  
  // Handle final error after all retries
  const error = lastError;
  if (!error) {
    throw new Error('Unknown error occurred while fetching messages from Gmail');
  }
  
  const errorDetails = {
    userId,
    status: error?.response?.status,
    message: error?.message,
    code: error?.code,
    errors: error?.response?.data?.error,
  };
  
  console.error(`[Gmail API] [${new Date().toISOString()}] Failed to fetch messages after ${retryCount + 1} attempts for user ${userId}:`, errorDetails);
  
  // Provide helpful error messages for common issues
  if (error?.code === 403) {
    if (error?.message?.includes('unregistered callers') || error?.response?.data?.error?.message?.includes('API not enabled')) {
      throw new Error('Gmail API is not enabled. Please enable it in Google Cloud Console: https://console.cloud.google.com/apis/library/gmail.googleapis.com');
    } else if (error?.message?.includes('insufficient permissions') || error?.response?.data?.error?.message?.includes('permission')) {
      throw new Error('Insufficient permissions to access Gmail. Please ensure the app has the required Gmail scopes and re-authenticate.');
    } else {
      throw new Error(`Access denied to Gmail API (403). ${error?.message || error?.response?.data?.error?.message || 'Please check your permissions and API settings.'}`);
    }
  } else if (error?.code === 401) {
    // If we get a 401, try refreshing token once more
    if (retryCount < MAX_RETRIES) {
      console.log(`[Gmail API] Got 401 for user ${userId}, attempting token refresh and retry...`);
      try {
        return listMessages(userId, retryCount + 1);
      } catch (refreshError: any) {
        console.error(`[Gmail API] Failed to retry after 401 for user ${userId}:`, {
          errorType: refreshError?.constructor?.name,
          message: refreshError?.message,
        });
        throw new Error('Authentication failed. Please re-authenticate to access Gmail.');
      }
    }
    throw new Error('Authentication failed. Please re-authenticate to access Gmail.');
  } else if (error?.code === 429) {
    throw new Error('Rate limit exceeded for Gmail API. Please try again later.');
  } else if (error?.code === 500 || error?.code === 503 || error?.code === 504) {
    throw new Error('Gmail API is temporarily unavailable. Please try again later.');
  }
  
  // For other errors, provide a detailed message
  const errorMessage = error?.message || error?.response?.data?.error?.message || 'Unknown error occurred while fetching messages from Gmail';
  throw new Error(`Failed to fetch messages from Gmail: ${errorMessage}`);
}
