import type { Request, Response } from 'express';
import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { listRecentFiles } from '../google/drive.js';

export const router = Router();

// GET /api/files
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & {userId: string}).userId;
  
  try {
    console.log(`[Files API] Fetching files for userId: ${userId}`);
    const files = await listRecentFiles(userId);
    console.log(`[Files API] Successfully fetched ${files.length} files for userId: ${userId}`);
    res.json({files});
  } catch (e: any) {
    const errorDetails = {
      userId,
      errorType: e?.constructor?.name || typeof e,
      message: e?.message || String(e),
      stack: e?.stack,
      code: e?.code,
      status: e?.response?.status,
      responseData: e?.response?.data,
    };
    
    console.error('[Files API] Error fetching files:', errorDetails);
    console.error('[Files API] Full error object:', e);
    
    // Provide user-friendly error message
    const userMessage = e?.message || 'Failed to fetch files. Please try again or re-authenticate.';
    res.status(500).json({
      error: userMessage,
      details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
    });
  }
});
