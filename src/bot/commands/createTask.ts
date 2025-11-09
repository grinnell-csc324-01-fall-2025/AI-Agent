
import { TurnContext } from "botbuilder";
import { extractTasksFromText } from "../../ai/nlp.js";
export async function handleCreateTask(ctx: TurnContext) {
  const text = ctx.activity.text?.replace(/^create task/i, "").trim() || "";
  const items = await extractTasksFromText(text);
  await ctx.sendActivity("Tasks:\n" + JSON.stringify(items, null, 2));
}
