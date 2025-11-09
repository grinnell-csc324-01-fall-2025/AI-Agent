
import { TeamsActivityHandler } from "botbuilder";
import { handleHelp, handleSummarize, handleCreateTask } from "./commands/index.js";

export class TeamsBot extends TeamsActivityHandler {
  constructor() {
    super();
    this.onMessage(async (ctx, next) => {
      const text = (ctx.activity.text || "").trim().toLowerCase();
      if (text.startsWith("help")) return handleHelp(ctx);
      if (text.startsWith("summarize")) return handleSummarize(ctx);
      if (text.startsWith("create task")) return handleCreateTask(ctx);
      await ctx.sendActivity("Try commands: `help`, `summarize`, `create task`");
      await next();
    });
  }
}
