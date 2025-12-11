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
  isUnread = false,
  isStarred = false,
): gmail_v1.Schema$Message {
  const dateStr = date.toUTCString();
  const labels = ['INBOX'];
  if (isUnread) labels.push('UNREAD');
  if (isStarred) labels.push('STARRED');

  const message: gmail_v1.Schema$Message = {
    id,
    threadId,
    labelIds: labels,
    snippet,
    internalDate: String(date.getTime()),
    payload: {
      headers: [
        {name: 'Subject', value: subject},
        {name: 'From', value: from},
        {name: 'To', value: to},
        {name: 'Date', value: dateStr},
      ],
    } as any,
  };

  return message;
}

// Generate dates relative to now
const now = new Date();
const hoursAgo = (hours: number) =>
  new Date(now.getTime() - hours * 60 * 60 * 1000);
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

/**
 * 21 realistic mock emails for demo purposes
 * Names reflect diverse backgrounds and inclusive representation
 */
export const mockEmails: gmail_v1.Schema$Message[] = [
  createMockMessage(
    'mock_001',
    'thread_001',
    'Q4 Planning Meeting - Action Items',
    'Priya Sharma <priya.sharma@company.com>',
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
    'Marcus Johnson <marcus.j@client.org>',
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
    'Fatima Al-Hassan <fatima@vendor.io>',
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
    'Jordan Rivera <jordan.r@design.co>',
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
    'Kenji Tanaka <kenji.t@company.com>',
    'all-staff@company.com',
    'Friendly reminder that our team offsite is scheduled for next Thursday and Friday at the Riverside Conference Center. Please confirm your attendance and dietary preferences by EOD Monday...',
    daysAgo(1),
    false,
    false,
  ),
  createMockMessage(
    'mock_007',
    'thread_007',
    'Re: API Integration Questions',
    'Amara Okonkwo <amara@techpartner.com>',
    'me@company.com',
    "Good question! For the webhook authentication, you'll need to include the API key in the Authorization header. Here's an example: Authorization: Bearer YOUR_API_KEY_HERE. Let me know if you need more details.",
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
    'Elena Rodriguez left a comment on "2024 Strategy": "I think we should reconsider the timeline for Phase 2. The current estimate seems optimistic given our resource constraints..."',
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
    'Wei Chen <wei.chen@github.com>',
    'me@company.com',
    'Merged #847: Fix authentication bug in login flow. This pull request fixes the issue where users were occasionally logged out during session refresh. Changes include updated token handling...',
    daysAgo(4),
    false,
    false,
  ),
  createMockMessage(
    'mock_011',
    'thread_011',
    'Your package is out for delivery',
    'Loop Logistics <tracking@looplogistics.com>',
    'me@company.com',
    'Good news! Your order #LL-572819 is out for delivery today. Carrier: Loop Logistics. Scheduled window: 2:00 PM - 4:00 PM. If you will not be home, you can authorize doorstep delivery via the tracking page...',
    daysAgo(1),
    true,
    false,
  ),
  createMockMessage(
    'mock_012',
    'thread_012',
    'Summer Internship Offer - Grinnell College CS',
    'Camila Duarte <cduarte@northbridge.ai>',
    'camiladuarte@grinnell.edu',
    'Congratulations! We are excited to extend you a summer internship offer with Northbridge AI. As a senior at Grinnell, you will join our applied research pod working on LLM evaluation tools. The offer letter and next steps are attached...',
    daysAgo(2),
    true,
    true,
  ),
  createMockMessage(
    'mock_013',
    'thread_013',
    'Tiffany Lock bracelet – student exclusive',
    'Tiffany & Co. <news@tiffany.com>',
    'senior.student@grinnell.edu',
    'A little sparkle for commencement season: enjoy a limited-time student appreciation on the Tiffany Lock bracelet collection. Complimentary engraving and same-week delivery available near campus...',
    hoursAgo(6),
    true,
    false,
  ),
  createMockMessage(
    'mock_014',
    'thread_014',
    'Sephora Holiday Haul — 20% ends Sunday',
    'Sephora Beauty Insider <beauty@sephora.com>',
    'senior.student@grinnell.edu',
    'Finals-week self-care: take 20% off your cart with code FINALS20. Sets from Fenty, The Ordinary, and Laneige are going fast. Free shipping to Grinnell campus lockers...',
    hoursAgo(10),
    false,
    true,
  ),
  createMockMessage(
    'mock_015',
    'thread_015',
    'Amazon Prime Student: finals-week essentials',
    'Amazon <prime-student@amazon.com>',
    'senior.student@grinnell.edu',
    'Prep for capstone demos: overnight delivery on noise-cancelling headphones, portable monitors, and caffeine-free focus snacks. Your Prime Student credit expires in 5 days—apply it before checkout...',
    daysAgo(1),
    true,
    false,
  ),
  createMockMessage(
    'mock_016',
    'thread_016',
    'Christmas Eve at Nana Rosa’s',
    'Rosa Martinez <rosa.martinez@familymail.com>',
    'alex.chicago@family.com',
    'Mi amor, we are setting the table for Christmas Eve. Can you fly in from Chicago on the 23rd? Your cousins are bringing pasteles and coquito. Let me know your arrival time so we can pick you up at O’Hare...',
    daysAgo(5),
    true,
    true,
  ),
  createMockMessage(
    'mock_017',
    'thread_017',
    'NYC Christmas Morning brunch invite',
    'Aunt Denise <denise@familymail.com>',
    'jordan.ny@family.com',
    'We’re hosting Christmas brunch in Brooklyn this year—cinnamon rolls, bagels, and a walk across the Brooklyn Bridge if it’s not too cold. If you can make it from New York, arrive by 10 AM and bring your favorite board game...',
    daysAgo(6),
    false,
    false,
  ),
  createMockMessage(
    'mock_018',
    'thread_018',
    'Codespace expiring soon — save your work',
    'GitHub Codespaces <no-reply@github.com>',
    'me@company.com',
    'Reminder: Your dev environment for repo ai-agent will stop in 2 hours due to inactivity. Please push your latest changes or start a new session to keep working. You can extend the timeout from your Codespaces settings...',
    hoursAgo(2),
    true,
    false,
  ),
  createMockMessage(
    'mock_019',
    'thread_019',
    'Your Spotify Student membership renews soon',
    'Spotify <no-reply@spotify.com>',
    'senior.student@grinnell.edu',
    'Heads up: your Spotify Student membership will renew tomorrow for $5.99 plus tax using your saved payment method ending in 1428. If you need to pause or update billing, visit your account page before midnight to avoid the charge...',
    hoursAgo(7),
    true,
    false,
  ),
  createMockMessage(
    'mock_020',
    'thread_020',
    'LinkedIn: New message from recruiter',
    'LinkedIn Notifications <messages-noreply@linkedin.com>',
    'senior.student@grinnell.edu',
    'Hi there! I came across your profile and capstone on distributed systems at Grinnell. We are hiring software engineering interns for Summer 2025. Are you open to a quick chat this week? — Maya, Talent at North Loop Labs...',
    hoursAgo(4),
    true,
    true,
  ),
  createMockMessage(
    'mock_021',
    'thread_021',
    'Your favorite streamer just went live',
    'Twitch <no-reply@twitch.tv>',
    'senior.student@grinnell.edu',
    'Heads up! KaiNova is live now with a new AI speedrun challenge. Join to vote on prompts, drop emotes, and catch the first 10 minutes for exclusive sub-only VOD access...',
    hoursAgo(1),
    true,
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
