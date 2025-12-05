import {google, calendar_v3} from 'googleapis';
import {getOAuth2ClientForUser} from './client.js';
import {NormalizedEvent} from '../types/google.js';

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
 */
export async function fetchNormalizedEvents(
  userId: string,
  options: {maxResults?: number; timeMin?: string} = {},
): Promise<NormalizedEvent[]> {
  // This handles DB lookup + refresh logic
  const authClient = await getOAuth2ClientForUser(userId);

  const calendar = google.calendar({version: 'v3', auth: authClient});

  const nowIso = new Date().toISOString();

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: options.timeMin || nowIso,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: options.maxResults ?? 20,
  });

  const items = res.data.items || [];
  return items.map(mapEvent);
}
