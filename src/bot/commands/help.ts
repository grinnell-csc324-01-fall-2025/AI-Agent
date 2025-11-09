
import { TurnContext } from "botbuilder";
export async function handleHelp(ctx: TurnContext) {
  await ctx.sendActivity([
    "Available commands:",
    "`help` - show this help",
    "`summarize` - summarize the given text",
    "`create task` - extract task items from the given text"
  ].join("\n"));
}
