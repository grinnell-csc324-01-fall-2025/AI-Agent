
import { Client } from "@microsoft/microsoft-graph-client";

export async function listRecentFiles(client: Client) {
  return client.api("/me/drive/recent").get();
}
