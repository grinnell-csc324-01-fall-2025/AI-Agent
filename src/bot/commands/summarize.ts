
import { TurnContext } from "botbuilder";
import { summarizeText } from "../../ai/summarizer.js";
export async function handleSummarize(ctx: TurnContext) {
  const text = ctx.activity.text?.replace(/^summarize/i, "").trim() || "No content";
  const out = await summarizeText(text);
  await ctx.sendActivity(out);
}
