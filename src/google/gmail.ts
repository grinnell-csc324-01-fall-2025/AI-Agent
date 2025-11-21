import { google } from "googleapis";
import { oauth2Client } from "./client.js";

export async function listMessages() {
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const res = await gmail.users.messages.list({
        userId: "me",
        maxResults: 10
    });

    const messages = res.data.messages || [];

    // Use Promise.allSettled to handle partial failures
    const results = await Promise.allSettled(
        messages.map(async (msg) => {
            if (!msg.id) return null;
            const m = await gmail.users.messages.get({
                userId: "me",
                id: msg.id,
                format: "full" // Get full details in one go if possible, though list() doesn't support it, get() does.
            });
            return m.data;
        })
    );

    return results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);
}
