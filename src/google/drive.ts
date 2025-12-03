import { google } from 'googleapis';
import type { GoogleTokens } from '../db/models/User.js';
import { getOAuth2ClientForUser } from './client.js';

export async function listRecentFiles(userId: string, retryCount = 0): Promise<any[]> {
  if (!userId || typeof userId !== 'string') {
    throw new Error(`Invalid userId provided to listRecentFiles: ${userId}`);
  }
  
  console.log(`[Drive API] Fetching recent files for userId: ${userId}, retryCount: ${retryCount}`);
  
  let auth;
  try {
    auth = await getOAuth2ClientForUser(userId);
  } catch (authError: any) {
    console.error(`[Drive API] Failed to get OAuth client for user ${userId}:`, {
      errorType: authError?.constructor?.name,
      message: authError?.message,
      stack: authError?.stack,
    });
    throw authError;
  }
  
  // Verify credentials are set
  if (!auth.credentials?.access_token) {
    console.error(`[Drive API] No access token available after getting OAuth client for user ${userId}`);
    throw new Error('No access token available. Please re-authenticate.');
  }
  
  console.log(`[Drive API] Making request with access token for user ${userId}`);
  
  const drive = google.drive({version: 'v3', auth});
  try {
    const res = await drive.files.list({
      pageSize: 10,
      fields: 'nextPageToken, files(id, name, webViewLink)',
      orderBy: 'modifiedTime desc',
    });
    
    const files = res.data.files || [];
    console.log(`[Drive API] Successfully fetched ${files.length} files for user ${userId}`);
    return files;
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
    
    console.error(`[Drive API] Error fetching files for user ${userId}:`, errorDetails);
    
    // If we get a 401 and haven't retried yet, refresh token and retry
    if (error?.code === 401 && retryCount === 0) {
      console.log(`[Drive API] Got 401 for user ${userId}, attempting token refresh and retry...`);
      try {
        // Force token refresh by getting a new client (which will handle refresh)
        // This should already be handled by getOAuth2ClientForUser, but we'll retry once
        console.log(`[Drive API] Retrying with fresh OAuth client for user ${userId}`);
        return listRecentFiles(userId, 1);
      } catch (refreshError: any) {
        console.error(`[Drive API] Failed to retry after 401 for user ${userId}:`, {
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
        throw new Error('Google Drive API is not enabled. Please enable it in Google Cloud Console: https://console.cloud.google.com/apis/library/drive.googleapis.com');
      } else if (error?.message?.includes('insufficient permissions')) {
        throw new Error('Insufficient permissions to access Google Drive. Please ensure the app has the required Drive scopes.');
      } else {
        throw new Error(`Access denied to Google Drive API (403). ${error?.message || 'Please check your permissions and API settings.'}`);
      }
    } else if (error?.code === 401) {
      throw new Error('Authentication failed. Please re-authenticate to access Google Drive.');
    } else if (error?.code === 429) {
      throw new Error('Rate limit exceeded for Google Drive API. Please try again later.');
    } else if (error?.code === 500 || error?.code === 503) {
      throw new Error('Google Drive API is temporarily unavailable. Please try again later.');
    }
    
    // For other errors, provide a detailed message
    const errorMessage = error?.message || 'Unknown error occurred while fetching files from Google Drive';
    throw new Error(`Failed to fetch files from Google Drive: ${errorMessage}`);
  }
}
