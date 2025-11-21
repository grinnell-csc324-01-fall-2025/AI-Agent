import {Router} from 'express';
import {listRecentFiles} from '../google/drive.js';

export const router = Router();

// GET /api/files
router.get('/', async (_req, res) => {
  try {
    const files = await listRecentFiles();
    res.json({files});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
