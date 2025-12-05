import {Router} from 'express';
import {
  chat,
  streamChat,
  extractTasks,
  generateDailySummary,
  summarizeEmail,
  Message,
} from '../ai/agent.js';
import {getOAuth2ClientForUser} from '../google/client.js';
import {google} from 'googleapis';
import {getMockEmails} from '../google/mockEmails.js';
import {getMockFiles} from '../google/mockFiles.js';

export const chatRouter = Router();

// Helper to get mock email context
function getMockEmailContext(): string {
  const mockEmails = getMockEmails();
  return mockEmails
    .slice(0, 5)
    .map(email => {
      const subject = email.payload?.headers?.find(h => h.name === 'Subject')?.value || 'No subject';
      const from = email.payload?.headers?.find(h => h.name === 'From')?.value || 'Unknown';
      return `- ${subject} (from: ${from})`;
    })
    .join('\n');
}

// Helper to get mock file context
function getMockFileContext(): string {
  const mockFiles = getMockFiles();
  return mockFiles
    .slice(0, 5)
    .map(f => `- ${f.name}`)
    .join('\n');
}

// Middleware to check authentication
const requireAuth = (
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction,
): void => {
  if (!req.session?.userId) {
    res.status(401).json({error: 'Not authenticated'});
    return;
  }
  next();
};

/**
 * POST /api/chat
 * Chat with the AI agent
 */
chatRouter.post('/', async (req, res) => {
  try {
    const {messages, includeContext} = req.body as {
      messages: Message[];
      includeContext?: boolean;
    };

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({error: 'Messages array required'});
    }

    let context: {emails?: string; files?: string} | undefined;

    // Optionally include user's email/file context
    if (includeContext) {
      // Try to get real data if authenticated
      if (req.session?.userId) {
        try {
          const client = await getOAuth2ClientForUser(req.session.userId);
          const gmail = google.gmail({version: 'v1', auth: client});
          const drive = google.drive({version: 'v3', auth: client});

          // Get recent emails
          const emailRes = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 5,
          });

          if (emailRes.data.messages) {
            const emailDetails = await Promise.all(
              emailRes.data.messages.slice(0, 3).map(async msg => {
                const detail = await gmail.users.messages.get({
                  userId: 'me',
                  id: msg.id!,
                  format: 'metadata',
                  metadataHeaders: ['Subject', 'From'],
                });
                const subject =
                  detail.data.payload?.headers?.find(h => h.name === 'Subject')
                    ?.value || 'No subject';
                const from =
                  detail.data.payload?.headers?.find(h => h.name === 'From')
                    ?.value || 'Unknown';
                return `- ${subject} (from: ${from})`;
              }),
            );
            context = {emails: emailDetails.join('\n')};
          }

          // Get recent files
          const fileRes = await drive.files.list({
            pageSize: 5,
            orderBy: 'modifiedTime desc',
            fields: 'files(name)',
          });

          if (fileRes.data.files) {
            context = {
              ...context,
              files: fileRes.data.files.map(f => `- ${f.name}`).join('\n'),
            };
          }
        } catch (contextError) {
          console.warn(
            'Failed to load real context, using mock data:',
            contextError,
          );
          // Fall back to mock data
          context = {
            emails: getMockEmailContext(),
            files: getMockFileContext(),
          };
        }
      } else {
        // Not authenticated - use mock data for demo
        context = {
          emails: getMockEmailContext(),
          files: getMockFileContext(),
        };
      }
    }

    const response = await chat(messages, context);
    return res.json({response});
  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({error: 'Failed to process chat'});
  }
});

/**
 * POST /api/chat/stream
 * Stream chat response
 */
chatRouter.post('/stream', requireAuth, async (req, res): Promise<void> => {
  try {
    const {messages} = req.body as {messages: Message[]};

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({error: 'Messages array required'});
      return;
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const result = streamChat(messages);
    const stream = (await result).textStream;

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({text: chunk})}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Stream error:', error);
    res.write(`data: ${JSON.stringify({error: 'Stream failed'})}\n\n`);
    res.end();
  }
});

// Mock tasks for demo mode
const mockTasks = [
  {
    title: 'Finalize Q4 budget proposals',
    due: 'Friday',
    priority: 'high',
    source: 'Email: Q4 Planning Meeting - Action Items',
  },
  {
    title: 'Schedule stakeholder one-on-ones',
    due: 'Next week',
    priority: 'medium',
    source: 'Email: Q4 Planning Meeting - Action Items',
  },
  {
    title: 'Update revised milestones in shared tracker',
    due: 'This week',
    priority: 'high',
    source: 'Email: Project Deadline Extension Request',
  },
  {
    title: 'Review homepage redesign mockups in Figma',
    due: 'Today',
    priority: 'medium',
    source: 'Email: Design Review: Homepage Redesign v2',
  },
  {
    title: 'Confirm offsite attendance and dietary preferences',
    due: 'Monday EOD',
    priority: 'low',
    source: 'Email: Reminder: Team Offsite Next Week',
  },
];

/**
 * GET /api/chat/tasks
 * Extract tasks from recent emails
 */
chatRouter.get('/tasks', async (req, res) => {
  // If not authenticated, return mock tasks for demo
  if (!req.session?.userId) {
    console.log('[Tasks API] Not authenticated, returning mock tasks');
    return res.json({tasks: mockTasks, mock: true});
  }

  try {
    const client = await getOAuth2ClientForUser(req.session.userId);
    const gmail = google.gmail({version: 'v1', auth: client});

    // Get recent emails
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10,
      q: 'is:unread OR newer_than:3d',
    });

    if (!listRes.data.messages?.length) {
      return res.json({tasks: [], message: 'No recent emails to analyze'});
    }

    // Get email details
    const allTasks: Array<{
      title: string;
      due?: string;
      priority: string;
      source: string;
    }> = [];

    for (const msg of listRes.data.messages.slice(0, 5)) {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'full',
      });

      const subject =
        detail.data.payload?.headers?.find(h => h.name === 'Subject')?.value ||
        'Unknown';
      const snippet = detail.data.snippet || '';

      const emailContent = `Subject: ${subject}\n\n${snippet}`;
      const tasks = await extractTasks(emailContent);

      allTasks.push(
        ...tasks.map(t => ({
          ...t,
          source: `Email: ${subject.slice(0, 50)}`,
        })),
      );
    }

    // Sort by priority
    const priorityOrder = {high: 0, medium: 1, low: 2};
    allTasks.sort(
      (a, b) =>
        (priorityOrder[a.priority as keyof typeof priorityOrder] || 2) -
        (priorityOrder[b.priority as keyof typeof priorityOrder] || 2),
    );

    return res.json({tasks: allTasks});
  } catch (error) {
    console.error('Task extraction error:', error);
    // Fall back to mock tasks on error
    console.log('[Tasks API] Gmail API failed, returning mock tasks');
    return res.json({tasks: mockTasks, mock: true});
  }
});

// Mock summary for demo mode
const mockSummary = {
  greeting: 'Good morning! Here\'s your daily briefing.',
  taskCount: 5,
  tasks: mockTasks,
  emailHighlights: [
    'Action items from Q4 Planning meeting need attention',
    'Project deadline extended by 2 weeks - update milestones',
    'New homepage design mockups ready for review in Figma',
    'Team offsite scheduled for next Thursday/Friday',
  ],
  suggestions: [
    'Prioritize Q4 budget proposals - due Friday',
    'Block time to review the homepage redesign',
    'Confirm offsite attendance by Monday EOD',
  ],
  mock: true,
};

/**
 * GET /api/chat/summary
 * Get daily summary/briefing
 */
chatRouter.get('/summary', async (req, res) => {
  // If not authenticated, return mock summary for demo
  if (!req.session?.userId) {
    console.log('[Summary API] Not authenticated, returning mock summary');
    return res.json(mockSummary);
  }

  try {
    const client = await getOAuth2ClientForUser(req.session.userId);
    const gmail = google.gmail({version: 'v1', auth: client});
    const drive = google.drive({version: 'v3', auth: client});

    // Get recent emails
    const emailRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10,
    });

    const emails: Array<{subject: string; from: string; snippet: string}> = [];

    if (emailRes.data.messages) {
      for (const msg of emailRes.data.messages.slice(0, 10)) {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From'],
        });

        emails.push({
          subject:
            detail.data.payload?.headers?.find(h => h.name === 'Subject')
              ?.value || 'No subject',
          from:
            detail.data.payload?.headers?.find(h => h.name === 'From')?.value ||
            'Unknown',
          snippet: detail.data.snippet || '',
        });
      }
    }

    // Get recent files
    const fileRes = await drive.files.list({
      pageSize: 5,
      orderBy: 'modifiedTime desc',
      fields: 'files(name, modifiedTime)',
    });

    const files =
      fileRes.data.files?.map(f => ({
        name: f.name || 'Unknown',
        modifiedTime: f.modifiedTime || '',
      })) || [];

    const summary = await generateDailySummary(emails, files);
    return res.json(summary);
  } catch (error) {
    console.error('Summary error:', error);
    // Fall back to mock summary on error
    console.log('[Summary API] Gmail API failed, returning mock summary');
    return res.json(mockSummary);
  }
});

/**
 * POST /api/chat/summarize-email
 * Summarize a specific email
 */
chatRouter.post('/summarize-email', requireAuth, async (req, res) => {
  try {
    const {emailId} = req.body as {emailId: string};

    if (!emailId) {
      return res.status(400).json({error: 'Email ID required'});
    }

    const client = await getOAuth2ClientForUser(req.session!.userId!);
    const gmail = google.gmail({version: 'v1', auth: client});

    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: emailId,
      format: 'full',
    });

    const subject =
      detail.data.payload?.headers?.find(h => h.name === 'Subject')?.value ||
      '';
    const from =
      detail.data.payload?.headers?.find(h => h.name === 'From')?.value || '';

    // Get email body
    let body = detail.data.snippet || '';
    if (detail.data.payload?.body?.data) {
      body = Buffer.from(detail.data.payload.body.data, 'base64').toString(
        'utf-8',
      );
    }

    const emailContent = `From: ${from}\nSubject: ${subject}\n\n${body}`;
    const summary = await summarizeEmail(emailContent);

    return res.json({summary});
  } catch (error) {
    console.error('Email summarize error:', error);
    return res.status(500).json({error: 'Failed to summarize email'});
  }
});

