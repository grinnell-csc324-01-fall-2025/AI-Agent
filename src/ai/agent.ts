/**
 * Responds to simple user prompts, such as asking for the current time in CST.
 * @param prompt The user's prompt string.
 * @returns A string response from the agent.
 */
export function respondToPrompt(prompt: string): string {
  const lowerPrompt = prompt.trim().toLowerCase();

  // Check for time-related queries
  if (
    lowerPrompt.includes('what is the time') ||
    lowerPrompt.includes('current time') ||
    lowerPrompt.includes('time right now')
  ) {
    // Get current UTC time and convert to CST (Central Standard Time, UTC-6)
    const now = new Date();
    try {
      const centralTime = now.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return `The current time in Central Time (America/Chicago) is ${centralTime}.`;
    } catch {
      // Fallback: manually subtract 6 hours for CST
      const cst = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      return `The current time in Central Standard Time (CST, UTC-6) is ${cst.toISOString().replace('T', ' ').substring(0, 19)}.`;
    }
  }

  // Default fallback
  return "Sorry, I don't understand your prompt.";
}
import {createGroq} from '@ai-sdk/groq';
import {generateText, streamText} from 'ai';

// Initialize Groq with free Llama model
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// Use Llama 3.3 70B - free and powerful
const model = groq('llama-3.3-70b-versatile');

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface TaskItem {
  title: string;
  due?: string;
  priority: 'high' | 'medium' | 'low';
  source: string;
}

export interface DailySummary {
  greeting: string;
  taskCount: number;
  tasks: TaskItem[];
  emailHighlights: string[];
  suggestions: string[];
}

const SYSTEM_PROMPT = `You are an AI assistant that helps users manage their Google Workspace (Gmail, Drive). You are friendly, concise, and proactive.

Your capabilities:
- Summarize emails and extract key information
- Identify tasks and deadlines from messages
- Help find files and documents
- Provide daily briefings
- Answer questions about the user's data

Always be helpful and direct. If you don't have enough information, ask clarifying questions.
When extracting tasks, look for:
- Due dates and deadlines
- Action items and requests
- Meeting times and events
- Follow-up items

Format dates clearly and prioritize urgent items.`;

/**
 * Chat with the AI agent
 */
export async function chat(
  messages: Message[],
  context?: {emails?: string; files?: string},
): Promise<string> {
  const systemMessage = context
    ? `${SYSTEM_PROMPT}\n\nContext from user's workspace:\n${context.emails ? `Recent Emails:\n${context.emails}\n` : ''}${context.files ? `Recent Files:\n${context.files}` : ''}`
    : SYSTEM_PROMPT;

  try {
    const {text} = await generateText({
      model,
      system: systemMessage,
      messages: messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    return text;
  } catch (error) {
    console.error('AI chat error:', error);
    throw new Error('Failed to generate response');
  }
}

/**
 * Stream chat response for real-time UI updates
 */
export function streamChat(
  messages: Message[],
  context?: {emails?: string; files?: string},
) {
  const systemMessage = context
    ? `${SYSTEM_PROMPT}\n\nContext from user's workspace:\n${context.emails ? `Recent Emails:\n${context.emails}\n` : ''}${context.files ? `Recent Files:\n${context.files}` : ''}`
    : SYSTEM_PROMPT;

  return streamText({
    model,
    system: systemMessage,
    messages: messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });
}

/**
 * Extract tasks from email content
 */
export async function extractTasks(emailContent: string): Promise<TaskItem[]> {
  try {
    const {text} = await generateText({
      model,
      system: `You extract actionable tasks from emails. Return a JSON array of tasks.
Each task should have: title (string), due (ISO date string or null), priority (high/medium/low), source (string).
Only return the JSON array, no other text. If no tasks found, return [].`,
      prompt: `Extract tasks from this email:\n\n${emailContent}`,
    });

    // Parse the JSON response
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Task extraction error:', error);
    return [];
  }
}

/**
 * Generate a daily summary/briefing
 */
export async function generateDailySummary(
  emails: Array<{subject: string; from: string; snippet: string}>,
  files: Array<{name: string; modifiedTime: string}>,
): Promise<DailySummary> {
  const emailList = emails
    .slice(0, 10)
    .map(e => `- "${e.subject}" from ${e.from}: ${e.snippet}`)
    .join('\n');

  const fileList = files
    .slice(0, 5)
    .map(f => `- ${f.name} (modified: ${f.modifiedTime})`)
    .join('\n');

  try {
    const {text} = await generateText({
      model,
      system: `Generate a helpful daily briefing for the user. Return JSON with this structure:
{
  "greeting": "A friendly personalized greeting",
  "taskCount": number of tasks found,
  "tasks": [{"title": string, "due": string|null, "priority": "high"|"medium"|"low", "source": string}],
  "emailHighlights": ["key point 1", "key point 2"],
  "suggestions": ["helpful suggestion 1", "helpful suggestion 2"]
}
Only return the JSON, no other text.`,
      prompt: `Create a daily briefing from this data:

Recent Emails:
${emailList || 'No recent emails'}

Recent Files:
${fileList || 'No recent files'}`,
    });

    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Daily summary error:', error);
    return {
      greeting: "Good day! Here's your workspace overview.",
      taskCount: 0,
      tasks: [],
      emailHighlights: ['Unable to analyze emails at this time'],
      suggestions: ['Check your inbox for new messages'],
    };
  }
}

/**
 * Summarize an email thread
 */
export async function summarizeEmail(emailContent: string): Promise<string> {
  try {
    const {text} = await generateText({
      model,
      system:
        'Summarize emails concisely. Focus on: main topic, action items, key dates, and who needs to respond. Be brief but complete.',
      prompt: `Summarize this email:\n\n${emailContent}`,
    });

    return text;
  } catch (error) {
    console.error('Email summary error:', error);
    return 'Unable to summarize this email.';
  }
}

/**
 * Search/find files by natural language query
 */
export async function interpretSearchQuery(query: string): Promise<{
  keywords: string[];
  fileType?: string;
  dateRange?: {after?: string; before?: string};
}> {
  try {
    const {text} = await generateText({
      model,
      system: `Convert natural language file search queries to structured search parameters.
Return JSON: {"keywords": ["word1", "word2"], "fileType": "document"|"spreadsheet"|"presentation"|null, "dateRange": {"after": "YYYY-MM-DD"|null, "before": "YYYY-MM-DD"|null}}
Only return JSON.`,
      prompt: `Parse this search query: "${query}"`,
    });

    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Search interpretation error:', error);
    return {keywords: query.split(' ')};
  }
}
