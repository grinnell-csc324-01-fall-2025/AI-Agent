
import { Client } from "@microsoft/microsoft-graph-client";

export async function createEvent(client: Client, subject: string, startISO: string, endISO: string, attendees: string[] = []) {
  return client.api("/me/events").post({
    subject,
    start: { dateTime: startISO, timeZone: "UTC" },
    end: { dateTime: endISO, timeZone: "UTC" },
    attendees: attendees.map(a => ({ emailAddress: { address: a }, type: "required" }))
  });
}
