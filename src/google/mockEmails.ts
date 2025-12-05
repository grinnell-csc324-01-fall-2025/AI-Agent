import {gmail_v1} from 'googleapis';

/**
 * Mock email data for demo purposes.
 * These emails display when Gmail API is unavailable.
 * Inspired by JMail's clean email interface design.
 */

// Helper to create a Gmail-like message structure
function createMockMessage(
  id: string,
  threadId: string,
  subject: string,
  from: string,
  to: string,
  snippet: string,
  date: Date,
  isUnread: boolean = false,
  isStarred: boolean = false,
): gmail_v1.Schema$Message {
  const dateStr = date.toUTCString();
  const labels = ['INBOX'];
  if (isUnread) labels.push('UNREAD');
  if (isStarred) labels.push('STARRED');

  return {
    id,
    threadId,
    labelIds: labels,
    snippet,
    payload: {
      headers: [
        {name: 'Subject', value: subject},
        {name: 'From', value: from},
        {name: 'To', value: to},
        {name: 'Date', value: dateStr},
      ],
      mimeType: 'text/plain',
      body: {
        data: Buffer.from(snippet).toString('base64'),
      },
    },
    internalDate: date.getTime().toString(),
  };
}

// Generate dates relative to now
const now = new Date();
const hoursAgo = (hours: number) =>
  new Date(now.getTime() - hours * 60 * 60 * 1000);
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

/**
 * 10 realistic mock emails for demo purposes
 */
export const mockEmails: gmail_v1.Schema$Message[] = [
  createMockMessage(
    'mock_001',
    'thread_001',
    'Q4 Planning Meeting - Action Items',
    'Sarah Chen <sarah.chen@company.com>',
    'team@company.com',
    "Hi team, Following up on yesterday's Q4 planning session. Here are the key action items we discussed: 1) Finalize budget proposals by Friday, 2) Schedule one-on-ones with stakeholders...",
    hoursAgo(1),
    true, // unread
    true, // starred
  ),
  createMockMessage(
    'mock_002',
    'thread_002',
    'Re: Project Deadline Extension Request',
    'Michael Torres <m.torres@client.org>',
    'me@company.com',
    "Thanks for the update. We've reviewed the timeline and can accommodate the two-week extension. Please ensure the revised milestones are documented in the shared tracker...",
    hoursAgo(3),
    true, // unread
    false,
  ),
  createMockMessage(
    'mock_003',
    'thread_003',
    'Your weekly digest is ready',
    'Analytics Team <analytics@company.com>',
    'me@company.com',
    'Your weekly performance report is now available. Key highlights: Website traffic increased 23% week-over-week, conversion rate improved to 4.2%, top performing content...',
    hoursAgo(5),
    false,
    false,
  ),
  createMockMessage(
    'mock_004',
    'thread_004',
    'Invoice #INV-2024-0892 - Payment Confirmation',
    'Billing <billing@vendor.io>',
    'accounts@company.com',
    'This email confirms your payment of $2,450.00 for Invoice #INV-2024-0892 has been received and processed. Thank you for your business. Transaction ID: TXN-8847291...',
    hoursAgo(8),
    false,
    false,
  ),
  createMockMessage(
    'mock_005',
    'thread_005',
    'Design Review: Homepage Redesign v2',
    'Alex Kim <alex.kim@design.co>',
    'me@company.com, design-team@company.com',
    "Hey everyone, I've uploaded the revised homepage mockups to Figma. The main changes include: updated hero section with video background, simplified navigation, new color palette...",
    hoursAgo(12),
    true, // unread
    true, // starred
  ),
  createMockMessage(
    'mock_006',
    'thread_006',
    'Reminder: Team Offsite Next Week',
    'HR Department <hr@company.com>',
    'all-staff@company.com',
    "Friendly reminder that our team offsite is scheduled for next Thursday and Friday at the Riverside Conference Center. Please confirm your attendance and dietary preferences by EOD Monday...",
    daysAgo(1),
    false,
    false,
  ),
  createMockMessage(
    'mock_007',
    'thread_007',
    'Re: API Integration Questions',
    'David Park <david@techpartner.com>',
    'me@company.com',
    "Good question! For the webhook authentication, you'll need to include the API key in the Authorization header. Here's an example: Authorization: Bearer sk_live_... Let me know if you need more details.",
    daysAgo(1),
    false,
    true, // starred
  ),
  createMockMessage(
    'mock_008',
    'thread_008',
    'New Comment on Document: "2024 Strategy"',
    'Google Docs <comments-noreply@google.com>',
    'me@company.com',
    'Jennifer Walsh left a comment on "2024 Strategy": "I think we should reconsider the timeline for Phase 2. The current estimate seems optimistic given our resource constraints..."',
    daysAgo(2),
    false,
    false,
  ),
  createMockMessage(
    'mock_009',
    'thread_009',
    'Your flight itinerary - Confirmation #ABC123',
    'United Airlines <noreply@united.com>',
    'me@company.com',
    'Your upcoming trip is confirmed! Flight UA 1234 departing San Francisco (SFO) on Dec 15 at 8:30 AM, arriving New York (JFK) at 5:15 PM. Check-in opens 24 hours before departure...',
    daysAgo(3),
    false,
    true, // starred
  ),
  createMockMessage(
    'mock_010',
    'thread_010',
    'GitHub: [company/repo] Pull request merged',
    'GitHub <notifications@github.com>',
    'me@company.com',
    'Merged #847: Fix authentication bug in login flow. This pull request fixes the issue where users were occasionally logged out during session refresh. Changes include updated token handling...',
    daysAgo(4),
    false,
    false,
  ),
];

/**
 * Returns mock emails formatted like Gmail API response
 */
export function getMockEmails(): gmail_v1.Schema$Message[] {
  return mockEmails;
}

/**
 * Returns a specific mock email by ID
 */
export function getMockEmailById(
  id: string,
): gmail_v1.Schema$Message | undefined {
  return mockEmails.find(email => email.id === id);
}

