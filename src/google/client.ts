import { google } from "googleapis";
import { config } from "../config.js";

export const oauth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
);

export function getAuthUrl(state?: string) {
    return oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: config.google.scopes,
        state: state
    });
}

export async function getTokens(code: string) {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    return tokens;
}
