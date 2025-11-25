import {google} from 'googleapis';
import {oauth2Client} from './client.js';

export async function listRecentFiles() {
  const drive = google.drive({version: 'v3', auth: oauth2Client});
  const res = await drive.files.list({
    pageSize: 10,
    fields: 'nextPageToken, files(id, name, webViewLink)',
    orderBy: 'modifiedTime desc',
  });
  return res.data.files;
}
