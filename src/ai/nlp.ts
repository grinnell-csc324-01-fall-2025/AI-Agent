import {createOpenAI} from '@ai-sdk/openai';
import {generateObject} from 'ai';
import {z} from 'zod';
import {config} from '../config.js';

export type TaskItem = {
  title: string;
  due?: string; // ISO
  link?: string; // file or submission link
  source?: 'teams' | 'mail' | 'sharepoint';
};

const openai = createOpenAI({
  apiKey: config.aiGatewayApiKey,
});

const taskSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string().describe('The title or description of the task'),
      due: z
        .string()
        .optional()
        .describe('The due date of the task in ISO format (YYYY-MM-DD)'),
      link: z
        .string()
        .optional()
        .describe('A link to the file or submission associated with the task'),
      source: z
        .enum(['teams', 'mail', 'sharepoint'])
        .optional()
        .describe('The source of the task'),
    }),
  ),
});

export async function extractTasksFromText(text: string): Promise<TaskItem[]> {
  try {
    const {object} = await generateObject({
      model: openai('gpt-4o'),
      schema: taskSchema,
      prompt: `Extract actionable tasks from the following text. If there are no tasks, return an empty array.
      
      Text:
      ${text}`,
    });

    return object.tasks;
  } catch (error) {
    console.error('Error extracting tasks with AI:', error);
    return [];
  }
}
