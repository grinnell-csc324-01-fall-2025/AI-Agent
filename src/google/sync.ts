import {fetchNormalizedEvents} from './calendar.js';
import {fetchNormalizedEmails} from './gmail.js';
import {fetchNormalizedDriveFiles} from './drive.js';
import {WorkspaceRepository} from ; // need change for the db

export interface SyncResult {
  emailsSynced: number;
  filesSynced: number;
  eventsSynced: number;
}


export async function syncWorkspace(userId: string): Promise<SyncResult> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('syncWorkspace: userId must be a non-empty string');
  }

  const workspaceRepo = WorkspaceRepository.getInstance();

  // Fetch from Google 
  const [emails, files, events] = await Promise.all([
    fetchNormalizedEmails(userId),
    fetchNormalizedDriveFiles(userId),
    fetchNormalizedEvents(userId, {maxResults: 50}),
  ]);

  // Garika might want to change this
  await Promise.all([
    workspaceRepo.upsertEmails(userId, emails),
    workspaceRepo.upsertFiles(userId, files),
    workspaceRepo.upsertEvents(userId, events),
  ]);

  return {
    emailsSynced: emails.length,
    filesSynced: files.length,
    eventsSynced: events.length,
  };
}