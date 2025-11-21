import { Router } from "express";
import { getAuthUrl, getTokens } from "../google/client.js";

export const authRouter = Router();

import crypto from 'crypto';

// Store state tokens temporarily (use Redis or database in production)
const pendingStates = new Map<string, { timestamp: number }>();

// Starts interactive auth and redirects to Google sign-in
authRouter.get("/signin", (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  pendingStates.set(state, { timestamp: Date.now() });

  // Clean up old states (older than 10 minutes)
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [key, value] of pendingStates.entries()) {
    if (value.timestamp < tenMinutesAgo) {
      pendingStates.delete(key);
    }
  }

  const url = getAuthUrl(state);
  res.redirect(url);
});

// Handles the auth redirect and exchanges the code for an access token
authRouter.get("/callback", async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string;

  if (!state || !pendingStates.has(state)) {
    return res.status(400).json({ ok: false, error: "Invalid state parameter" });
  }
  pendingStates.delete(state);

  if (!code) {
    return res.status(400).json({ ok: false, error: "Missing auth code" });
  }

  try {
    const tokens = await getTokens(code);
    // TODO: In production, store tokens in session/database associated with user
    res.redirect('/tabs/personal/index.html');
  } catch (e) {
    console.error('OAuth callback error:', e);
    res.status(500).json({ ok: false, error: "Authentication failed" });
  }
});
