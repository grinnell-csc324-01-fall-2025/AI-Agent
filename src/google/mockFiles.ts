import {drive_v3} from 'googleapis';

/**
 * Mock file data for demo purposes.
 * These files display when Google Drive API is unavailable.
 */

// Generate dates relative to now
const now = new Date();
const hoursAgo = (hours: number) =>
  new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

/**
 * 10 realistic mock files for demo purposes
 * Names reflect diverse, inclusive team
 */
export const mockFiles: drive_v3.Schema$File[] = [
  {
    id: 'mock_file_001',
    name: 'Q4 Product Roadmap',
    mimeType: 'application/vnd.google-apps.document',
    modifiedTime: hoursAgo(2),
    webViewLink: '#',
    iconLink: 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.google-apps.document',
    owners: [{displayName: 'Priya Sharma', emailAddress: 'priya@company.com'}],
  },
  {
    id: 'mock_file_002',
    name: 'Budget Analysis 2024',
    mimeType: 'application/vnd.google-apps.spreadsheet',
    modifiedTime: hoursAgo(5),
    webViewLink: '#',
    iconLink: 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.google-apps.spreadsheet',
    owners: [{displayName: 'Marcus Johnson', emailAddress: 'marcus@company.com'}],
  },
  {
    id: 'mock_file_003',
    name: 'Team Presentation - Final',
    mimeType: 'application/vnd.google-apps.presentation',
    modifiedTime: hoursAgo(8),
    webViewLink: '#',
    iconLink: 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.google-apps.presentation',
    owners: [{displayName: 'Jordan Rivera', emailAddress: 'jordan@company.com'}],
  },
  {
    id: 'mock_file_004',
    name: 'Meeting Notes - Dec 4',
    mimeType: 'application/vnd.google-apps.document',
    modifiedTime: daysAgo(1),
    webViewLink: '#',
    iconLink: 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.google-apps.document',
    owners: [{displayName: 'Amara Okonkwo', emailAddress: 'amara@company.com'}],
  },
  {
    id: 'mock_file_005',
    name: 'Design Assets',
    mimeType: 'application/vnd.google-apps.folder',
    modifiedTime: daysAgo(1),
    webViewLink: '#',
    iconLink: 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.google-apps.folder',
    owners: [{displayName: 'Wei Chen', emailAddress: 'wei@company.com'}],
  },
  {
    id: 'mock_file_006',
    name: 'Contract_Template.pdf',
    mimeType: 'application/pdf',
    modifiedTime: daysAgo(2),
    webViewLink: '#',
    iconLink: 'https://drive-thirdparty.googleusercontent.com/16/type/application/pdf',
    owners: [{displayName: 'Fatima Al-Hassan', emailAddress: 'fatima@company.com'}],
  },
  {
    id: 'mock_file_007',
    name: 'User Research Findings',
    mimeType: 'application/vnd.google-apps.document',
    modifiedTime: daysAgo(3),
    webViewLink: '#',
    iconLink: 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.google-apps.document',
    owners: [{displayName: 'Elena Rodriguez', emailAddress: 'elena@company.com'}],
  },
  {
    id: 'mock_file_008',
    name: 'Sprint Planning Board',
    mimeType: 'application/vnd.google-apps.spreadsheet',
    modifiedTime: daysAgo(3),
    webViewLink: '#',
    iconLink: 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.google-apps.spreadsheet',
    owners: [{displayName: 'Kenji Tanaka', emailAddress: 'kenji@company.com'}],
  },
  {
    id: 'mock_file_009',
    name: 'Brand Guidelines 2024',
    mimeType: 'application/pdf',
    modifiedTime: daysAgo(5),
    webViewLink: '#',
    iconLink: 'https://drive-thirdparty.googleusercontent.com/16/type/application/pdf',
    owners: [{displayName: 'Jordan Rivera', emailAddress: 'jordan@company.com'}],
  },
  {
    id: 'mock_file_010',
    name: 'logo-final.png',
    mimeType: 'image/png',
    modifiedTime: daysAgo(7),
    webViewLink: '#',
    iconLink: 'https://drive-thirdparty.googleusercontent.com/16/type/image/png',
    owners: [{displayName: 'Wei Chen', emailAddress: 'wei@company.com'}],
  },
];

/**
 * Returns mock files formatted like Drive API response
 */
export function getMockFiles(): drive_v3.Schema$File[] {
  return mockFiles;
}

/**
 * Returns a specific mock file by ID
 */
export function getMockFileById(id: string): drive_v3.Schema$File | undefined {
  return mockFiles.find(file => file.id === id);
}

