
import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";

export function graphClient(token: string) {
  return Client.init({
    authProvider: (done) => done(null, token)
  });
}
