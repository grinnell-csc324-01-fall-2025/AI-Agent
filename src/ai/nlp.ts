export type TaskItem = {
  title: string;
  due?: string; // ISO
  link?: string; // file or submission link
  source?: 'teams' | 'mail' | 'sharepoint';
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function extractTasksFromText(_text: string): Promise<TaskItem[]> {
  // TODO: Call an LLM or use rules to extract tasks, return a normalized structure.
  return [];
}
