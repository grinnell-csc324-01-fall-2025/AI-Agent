import {drive_v3, google} from 'googleapis';
import {getOAuth2ClientForUser} from './client.js';

const MAX_RETRIES = 3;
const RETRYABLE_ERROR_CODES = [429, 500, 503, 504];

export async function listRecentFiles(
  userId: string,
  retryCount = 0,
): Promise<drive_v3.Schema$File[]> {
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
  } catch (authError: unknown) {
    interface ErrorWithDetails {
      message?: string;
      constructor?: {name?: string};
      stack?: string;
    }
    const errorWithDetails = authError as ErrorWithDetails;
    const errorDetails = {
      userId,
      errorType: errorWithDetails?.constructor?.name,
      message: errorWithDetails?.message,
      code: (authError as {code?: string | number})?.code,
      stack: errorWithDetails?.stack,
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
  let lastError: unknown = null;
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
      const validFiles = files.filter((file: unknown) => {
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
        `[Drive API] [${new Date().toISOString()}] Error fetching files for user ${userId} (attempt ${attempt + 1}):`,
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
      'Unknown error occurred while fetching files from Google Drive',
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
    `[Drive API] [${new Date().toISOString()}] Failed to fetch files after ${retryCount + 1} attempts for user ${userId}:`,
    errorDetails,
  );

  // Provide helpful error messages for common issues
  if (errorWithCode?.code === 403) {
    if (
      errorWithCode?.message?.includes('unregistered callers') ||
      errorWithCode?.response?.data?.error?.message?.includes('API not enabled')
    ) {
      throw new Error(
        'Google Drive API is not enabled. Please enable it in Google Cloud Console: https://console.cloud.google.com/apis/library/drive.googleapis.com',
      );
    } else if (
      errorWithCode?.message?.includes('insufficient permissions') ||
      errorWithCode?.response?.data?.error?.message?.includes('permission')
    ) {
      throw new Error(
        'Insufficient permissions to access Google Drive. Please ensure the app has the required Drive scopes and re-authenticate.',
      );
    } else {
      throw new Error(
        `Access denied to Google Drive API (403). ${errorWithCode?.message || errorWithCode?.response?.data?.error?.message || 'Please check your permissions and API settings.'}`,
      );
    }
  } else if (errorWithCode?.code === 401) {
    // If we get a 401, try refreshing token once more
    if (retryCount < MAX_RETRIES) {
      console.log(
        `[Drive API] Got 401 for user ${userId}, attempting token refresh and retry...`,
      );
      try {
        return listRecentFiles(userId, retryCount + 1);
      } catch (refreshError: unknown) {
        interface RefreshError {
          constructor?: {name?: string};
          message?: string;
        }
        const refreshErrorWithMessage = refreshError as RefreshError;
        console.error(
          `[Drive API] Failed to retry after 401 for user ${userId}:`,
          {
            errorType: refreshErrorWithMessage?.constructor?.name,
            message: refreshErrorWithMessage?.message,
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
  } else if (errorWithCode?.code === 429) {
    throw new Error(
      'Rate limit exceeded for Google Drive API. Please try again later.',
    );
  } else if (
    errorWithCode?.code === 500 ||
    errorWithCode?.code === 503 ||
    errorWithCode?.code === 504
  ) {
    throw new Error(
      'Google Drive API is temporarily unavailable. Please try again later.',
    );
  }

  // For other errors, provide a detailed message
  const errorMessage =
    errorWithCode?.message ||
    errorWithCode?.response?.data?.error?.message ||
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

  return rawFiles.map((file: drive_v3.Schema$File) => ({
    id: file.id ?? '',
    name: file.name ?? '',
    mimeType: file.mimeType ?? '',
    modifiedTime: file.modifiedTime ?? '',
    webViewLink: file.webViewLink ?? undefined,
  }));
}
