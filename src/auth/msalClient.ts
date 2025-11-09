
import { ConfidentialClientApplication } from "@azure/msal-node";
import { config } from "../config.js";

export const msalClient = new ConfidentialClientApplication({
  auth: {
    clientId: config.oauth.clientId,
    authority: config.oauth.authority,
    clientSecret: config.oauth.clientSecret
  },
  system: { loggerOptions: { logLevel: 1 } }
});
