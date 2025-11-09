
import { Router } from "express";
import { extractTasksFromText } from "../ai/nlp.js";
export const router = Router();

// POST /api/tasks { text: string }
router.post("/", async (req, res) => {
  const text = req.body?.text || "";
  const items = await extractTasksFromText(text);
  res.json({ items });
});
