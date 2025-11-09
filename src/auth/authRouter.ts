
import { Router } from "express";
import { msalClient } from "./msalClient.js";
import { config } from "../config.js";

export const authRouter = Router();

// Starts interactive auth and redirects to Microsoft sign-in
authRouter.get("/signin", (req, res) => {
  const authUrlParams = {
    scopes: config.oauth.scopes,
    redirectUri: config.oauth.redirectUri
  };
  msalClient.getAuthCodeUrl(authUrlParams).then(url => res.redirect(url));
});

// Handles the auth redirect and exchanges the code for an access token
authRouter.get("/callback", async (req, res) => {
  const code = req.query.code as string;
  try {
    const token = await msalClient.acquireTokenByCode({
      code,
      scopes: config.oauth.scopes,
      redirectUri: config.oauth.redirectUri
    });
    res.json({ ok: true, token: token?.accessToken ? "received" : "none" });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});
