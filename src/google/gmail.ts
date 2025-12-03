import { gmail_v1, google } from 'googleapis';
import type { GoogleTokens } from '../db/models/User.js';
import { getOAuth2ClientForUser } from './client.js';

export async function listMessages(userId: string, retryCount = 0): Promise<gmail_v1.Schema$Message[]> {
  if (!userId || typeof userId !== 'string') {
    throw new Error(`Invalid userId provided to listMessages: ${userId}`);
  }
  
  console.log(`[Gmail API] Fetching messages for userId: ${userId}, retryCount: ${retryCount}`);
  
  let auth;
  try {
    auth = await getOAuth2ClientForUser(userId);
  } catch (authError: any) {
    console.error(`[Gmail API] Failed to get OAuth client for user ${userId}:`, {
      errorType: authError?.constructor?.name,
      message: authError?.message,
      stack: authError?.stack,
    });
    throw authError;
  }
  
  // Verify credentials are set
  if (!auth.credentials?.access_token) {
    console.error(`[Gmail API] No access token available after getting OAuth client for user ${userId}`);
    throw new Error('No access token available. Please re-authenticate.');
  }
  
  console.log(`[Gmail API] Making request with access token for user ${userId}`);
  
  const gmail = google.gmail({version: 'v1', auth});
  try {
    const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10,
    });

    const messages = res.data.messages || [];
    console.log(`[Gmail API] Found ${messages.length} message IDs for user ${userId}, fetching details...`);

    // Use Promise.allSettled to handle partial failures
    const results = await Promise.allSettled(
      messages.map(async msg => {
        if (!msg.id) return null;
        try {
          const m = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full', // Get full details in one go if possible, though list() doesn't support it, get() does.
          });
          return m.data;
        } catch (msgError: any) {
          console.warn(`[Gmail API] Failed to fetch message ${msg.id} for user ${userId}:`, {
            errorType: msgError?.constructor?.name,
            message: msgError?.message,
            code: msgError?.code,
          });
          return null; // Skip this message but continue with others
        }
      }),
    );

    const successfulMessages = results
      .filter(
        (r): r is PromiseFulfilledResult<gmail_v1.Schema$Message> =>
          r.status === 'fulfilled' && r.value !== null,
      )
      .map(r => r.value);
    
    console.log(`[Gmail API] Successfully fetched ${successfulMessages.length} messages for user ${userId}`);
    return successfulMessages;
  } catch (error: any) {
    const errorDetails = {
      userId,
      retryCount,
      status: error?.response?.status,
      message: error?.message,
      code: error?.code,
      errors: error?.response?.data?.error,
      responseData: error?.response?.data,
    };
    
    console.error(`[Gmail API] Error fetching messages for user ${userId}:`, errorDetails);
    
    // If we get a 401 and haven't retried yet, refresh token and retry
    if (error?.code === 401 && retryCount === 0) {
      console.log(`[Gmail API] Got 401 for user ${userId}, attempting token refresh and retry...`);
      try {
        // Force token refresh by getting a new client (which will handle refresh)
        // This should already be handled by getOAuth2ClientForUser, but we'll retry once
        console.log(`[Gmail API] Retrying with fresh OAuth client for user ${userId}`);
        return listMessages(userId, 1);
      } catch (refreshError: any) {
        console.error(`[Gmail API] Failed to retry after 401 for user ${userId}:`, {
          errorType: refreshError?.constructor?.name,
          message: refreshError?.message,
          stack: refreshError?.stack,
        });
        throw new Error(`Failed to refresh token and retry: ${refreshError?.message || 'Unknown error'}. Please re-authenticate.`);
      }
    }
    
    // Provide helpful error messages for common issues
    if (error?.code === 403) {
      if (error?.message?.includes('unregistered callers')) {
        throw new Error('Gmail API is not enabled. Please enable it in Google Cloud Console: https://console.cloud.google.com/apis/library/gmail.googleapis.com');
      } else if (error?.message?.includes('insufficient permissions')) {
        throw new Error('Insufficient permissions to access Gmail. Please ensure the app has the required Gmail scopes.');
      } else {
        throw new Error(`Access denied to Gmail API (403). ${error?.message || 'Please check your permissions and API settings.'}`);
      }
    } else if (error?.code === 401) {
      throw new Error('Authentication failed. Please re-authenticate to access Gmail.');
    } else if (error?.code === 429) {
      throw new Error('Rate limit exceeded for Gmail API. Please try again later.');
    } else if (error?.code === 500 || error?.code === 503) {
      throw new Error('Gmail API is temporarily unavailable. Please try again later.');
    }
    
    // For other errors, provide a detailed message
    const errorMessage = error?.message || 'Unknown error occurred while fetching messages from Gmail';
    throw new Error(`Failed to fetch messages from Gmail: ${errorMessage}`);
  }
}
