import {fetchNormalizedEvents} from './calendar.js';
import {fetchNormalizedEmails} from './gmail.js';
import {fetchNormalizedDriveFiles} from './drive.js';

export interface SyncResult {
  emailsSynced: number;
  filesSynced: number;
  eventsSynced: number;
}

/**
 * Syncs the user's Google Workspace data (Gmail, Drive, Calendar)
 * by fetching normalized data from Google.
 *
 * NOTE: This version does NOT yet persist to the database.
 * The DB person should later inject a repository here to save emails/files/events.
 */
export async function syncWorkspace(userId: string): Promise<SyncResult> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('syncWorkspace: userId must be a non-empty string');
  }

  // Fetch from Google using your normalized wrappers
  const [emails, files, events] = await Promise.all([
    fetchNormalizedEmails(userId),
    fetchNormalizedDriveFiles(userId),
    fetchNormalizedEvents(userId, {maxResults: 50}),
  ]);

  // TODO (DB teammate): persist these to MongoDB via a WorkspaceRepository or similar.
  // For now, we just log counts and return them.
  console.log('[syncWorkspace] Synced data for user:', userId, {
    emails: emails.length,
    files: files.length,
    events: events.length,
  });

  return {
    emailsSynced: emails.length,
    filesSynced: files.length,
    eventsSynced: events.length,
  };
}