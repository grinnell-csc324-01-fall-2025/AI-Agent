
import { Router } from "express";
export const router = Router();

// GET /api/messages
router.get("/", async (_req, res) => {
  res.json({ messages: [] }); // TODO: Connect Microsoft Graph
});
