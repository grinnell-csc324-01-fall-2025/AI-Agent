
import { BotFrameworkAdapter, TurnContext } from "botbuilder";
import { config } from "../config.js";
import { TeamsBot } from "./bot.js";

export const botAdapter = new BotFrameworkAdapter({
  appId: config.appId,
  appPassword: config.appPassword
});

export const botListener = new TeamsBot();

botAdapter.onTurnError = async (context: TurnContext, error: any) => {
  console.error("Bot Error:", error);
  await context.sendActivity("Sorry, the bot encountered an error.");
};
