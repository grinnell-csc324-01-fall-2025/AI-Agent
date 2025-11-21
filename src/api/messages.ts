import { Router } from "express";
import { listMessages } from "../google/gmail.js";

export const router = Router();

// GET /api/messages
router.get("/", async (_req, res) => {
  try {
    const messages = await listMessages();
    res.json({ messages });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
