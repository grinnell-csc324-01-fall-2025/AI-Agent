
import dotenv from "dotenv";
dotenv.config();

export const config = {
  appId: process.env.MICROSOFT_APP_ID || "",
  appPassword: process.env.MICROSOFT_APP_PASSWORD || "",
  tenantId: process.env.MICROSOFT_TENANT_ID || "",
  baseUrl: process.env.BASE_URL || "https://localhost:3978",
  oauth: {
    authority: process.env.OAUTH_AUTHORITY || "",
    clientId: process.env.OAUTH_CLIENT_ID || "",
    clientSecret: process.env.OAUTH_CLIENT_SECRET || "",
    redirectUri: process.env.OAUTH_REDIRECT_URI || "",
    scopes: (process.env.OAUTH_SCOPES || "").split(",")
  }
};
