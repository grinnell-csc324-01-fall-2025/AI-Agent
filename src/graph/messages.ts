
import { Client } from "@microsoft/microsoft-graph-client";

export async function listMyMessages(client: Client) {
  return client.api("/me/messages?$top=10").get();
}
