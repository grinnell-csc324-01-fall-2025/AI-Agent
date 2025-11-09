
import { Router } from "express";
export const router = Router();

// GET /api/files
router.get("/", async (_req, res) => {
  res.json({ files: [] }); // TODO: Connect Microsoft Graph
});
