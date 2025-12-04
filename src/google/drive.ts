import {google} from 'googleapis';
import {getOAuth2ClientForUser} from './client.js';

const MAX_RETRIES = 3;
const RETRYABLE_ERROR_CODES = [429, 500, 503, 504];

export async function listRecentFiles(
  userId: string,
  retryCount = 0,
): Promise<any[]> {
  if (!userId || typeof userId !== 'string' || userId.length !== 24) {
    throw new Error(
      `Invalid userId provided to listRecentFiles: ${userId}. Expected 24-character MongoDB ObjectId.`,
    );
  }

  const startTime = Date.now();
  console.log(
    `[Drive API] [${new Date().toISOString()}] Fetching recent files for userId: ${userId}, retryCount: ${retryCount}`,
  );

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
    console.error(
      `[Drive API] [${new Date().toISOString()}] Failed to get OAuth client for user ${userId}:`,
      errorDetails,
    );
    throw authError;
  }

  // Verify credentials are set
  if (!auth.credentials?.access_token) {
    console.error(
      `[Drive API] [${new Date().toISOString()}] No access token available after getting OAuth client for user ${userId}`,
    );
    throw new Error('No access token available. Please re-authenticate.');
  }

  console.log(
    `[Drive API] [${new Date().toISOString()}] Making request with access token for user ${userId}`,
  );

  const drive = google.drive({version: 'v3', auth});

  // Retry logic for transient failures
  let lastError: any = null;
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      if (attempt > 0) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(
          `[Drive API] Retry attempt ${attempt + 1}/${retryCount + 1}, waiting ${waitTime / 1000}s...`,
        );
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      const res = await drive.files.list({
        pageSize: 10,
        fields:
          'nextPageToken, files(id, name, webViewLink, mimeType, modifiedTime)',
        orderBy: 'modifiedTime desc',
        q: 'trashed=false', // Exclude trashed files
      });

      // Validate response
      if (!res.data) {
        throw new Error('Invalid response from Google Drive API: missing data');
      }

      const files = res.data.files || [];

      // Validate file structure
      const validFiles = files.filter((file: any) => {
        if (!file || typeof file !== 'object') {
          console.warn('[Drive API] Invalid file object found:', file);
          return false;
        }
        return true;
      });

      const duration = Date.now() - startTime;
      console.log(
        `[Drive API] [${new Date().toISOString()}] Successfully fetched ${validFiles.length} files for user ${userId} (${duration}ms)`,
      );

      return validFiles;
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

      console.error(
        `[Drive API] [${new Date().toISOString()}] Error fetching files for user ${userId} (attempt ${attempt + 1}):`,
        errorDetails,
      );

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
    throw new Error(
      'Unknown error occurred while fetching files from Google Drive',
    );
  }

  const errorDetails = {
    userId,
    status: error?.response?.status,
    message: error?.message,
    code: error?.code,
    errors: error?.response?.data?.error,
  };

  console.error(
    `[Drive API] [${new Date().toISOString()}] Failed to fetch files after ${retryCount + 1} attempts for user ${userId}:`,
    errorDetails,
  );

  // Provide helpful error messages for common issues
  if (error?.code === 403) {
    if (
      error?.message?.includes('unregistered callers') ||
      error?.response?.data?.error?.message?.includes('API not enabled')
    ) {
      throw new Error(
        'Google Drive API is not enabled. Please enable it in Google Cloud Console: https://console.cloud.google.com/apis/library/drive.googleapis.com',
      );
    } else if (
      error?.message?.includes('insufficient permissions') ||
      error?.response?.data?.error?.message?.includes('permission')
    ) {
      throw new Error(
        'Insufficient permissions to access Google Drive. Please ensure the app has the required Drive scopes and re-authenticate.',
      );
    } else {
      throw new Error(
        `Access denied to Google Drive API (403). ${error?.message || error?.response?.data?.error?.message || 'Please check your permissions and API settings.'}`,
      );
    }
  } else if (error?.code === 401) {
    // If we get a 401, try refreshing token once more
    if (retryCount < MAX_RETRIES) {
      console.log(
        `[Drive API] Got 401 for user ${userId}, attempting token refresh and retry...`,
      );
      try {
        return listRecentFiles(userId, retryCount + 1);
      } catch (refreshError: any) {
        console.error(
          `[Drive API] Failed to retry after 401 for user ${userId}:`,
          {
            errorType: refreshError?.constructor?.name,
            message: refreshError?.message,
          },
        );
        throw new Error(
          'Authentication failed. Please re-authenticate to access Google Drive.',
        );
      }
    }
    throw new Error(
      'Authentication failed. Please re-authenticate to access Google Drive.',
    );
  } else if (error?.code === 429) {
    throw new Error(
      'Rate limit exceeded for Google Drive API. Please try again later.',
    );
  } else if (
    error?.code === 500 ||
    error?.code === 503 ||
    error?.code === 504
  ) {
    throw new Error(
      'Google Drive API is temporarily unavailable. Please try again later.',
    );
  }

  // For other errors, provide a detailed message
  const errorMessage =
    error?.message ||
    error?.response?.data?.error?.message ||
    'Unknown error occurred while fetching files from Google Drive';
  throw new Error(`Failed to fetch files from Google Drive: ${errorMessage}`);
}

// Normalized shape for use by sync + DB + AI layers
export interface NormalizedDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
  // You can extend this later (size, owners, etc.) if needed
}

/**
 * Wrapper used by higher-level layers (sync, AI, etc.)
 * Reuses listRecentFiles and returns a clean, normalized array.
 */
export async function fetchNormalizedDriveFiles(
  userId: string,
): Promise<NormalizedDriveFile[]> {
  const rawFiles = await listRecentFiles(userId);

  return rawFiles.map((file: any) => ({
    id: file.id ?? '',
    name: file.name ?? '',
    mimeType: file.mimeType ?? '',
    modifiedTime: file.modifiedTime ?? '',
    webViewLink: file.webViewLink,
  }));
}
