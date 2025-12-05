import {google, calendar_v3} from 'googleapis';
import {getOAuth2ClientForUser} from './client.js';
import {NormalizedEvent} from '../types/google.js';

const RETRYABLE_ERROR_CODES = [429, 500, 503, 504];

function mapEvent(event: calendar_v3.Schema$Event): NormalizedEvent {
  return {
    id: event.id || '',
    summary: event.summary || '(No title)',
    description: event.description || '',
    startTime: event.start?.dateTime || event.start?.date || '',
    endTime: event.end?.dateTime || event.end?.date || '',
    creator: event.creator?.email || '',
    attendees: (event.attendees || [])
      .map(a => a.email)
      .filter((e): e is string => !!e),
    location: event.location || '',
    hangoutLink: event.hangoutLink || '',
    htmlLink: event.htmlLink || '',
  };
}

/**
 * Fetch upcoming Calendar events for a user in normalized format.
 * Uses your token-refreshing getOAuth2ClientForUser().
 * Includes error handling and retry logic for transient failures.
 */
export async function fetchNormalizedEvents(
  userId: string,
  options: {maxResults?: number; timeMin?: string} = {},
  retryCount = 0,
): Promise<NormalizedEvent[]> {
  if (!userId || typeof userId !== 'string' || userId.length !== 24) {
    throw new Error(
      `Invalid userId provided to fetchNormalizedEvents: ${userId}. Expected 24-character MongoDB ObjectId.`,
    );
  }

  const startTime = Date.now();
  console.log(
    `[Calendar API] [${new Date().toISOString()}] Fetching events for user ${userId}...`,
  );

  // This handles DB lookup + refresh logic
  const authClient = await getOAuth2ClientForUser(userId);

  const calendar = google.calendar({version: 'v3', auth: authClient});

  const nowIso = new Date().toISOString();

  // Retry logic for transient failures
  let lastError: any = null;
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      if (attempt > 0) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(
          `[Calendar API] Retry attempt ${attempt + 1}/${retryCount + 1}, waiting ${waitTime / 1000}s...`,
        );
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: options.timeMin || nowIso,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: options.maxResults ?? 20,
      });

      // Validate response
      if (!res.data) {
        throw new Error('Invalid response from Calendar API: missing data');
      }

      const items = res.data.items || [];
      const duration = Date.now() - startTime;
      console.log(
        `[Calendar API] [${new Date().toISOString()}] Successfully fetched ${items.length} events for user ${userId} (${duration}ms)`,
      );

      return items.map(mapEvent);
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
        `[Calendar API] [${new Date().toISOString()}] Error fetching events for user ${userId} (attempt ${attempt + 1}):`,
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
  const errorMessage =
    lastError?.message ||
    lastError?.response?.data?.error?.message ||
    'Unknown error occurred while fetching events from Google Calendar';
  throw new Error(
    `Failed to fetch events from Google Calendar: ${errorMessage}`,
  );
}
