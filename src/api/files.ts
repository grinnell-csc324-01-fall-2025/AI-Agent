import type { Request, Response } from 'express';
import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { isConnected } from '../db/connection.js';
import { listRecentFiles } from '../google/drive.js';

export const router = Router();

// GET /api/files
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as Request & {userId: string}).userId;
  const startTime = Date.now();
  
  try {
    // Validate database connection
    if (!isConnected()) {
      console.error('[Files API] Database not connected');
      res.status(503).json({
        error: 'Database connection unavailable. Please try again later.',
      });
      return;
    }

    console.log(`[Files API] [${new Date().toISOString()}] Fetching files for userId: ${userId}`);
    console.log(`[Files API] Request details:`, {
      userId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    const files = await listRecentFiles(userId);
    const duration = Date.now() - startTime;
    
    console.log(`[Files API] [${new Date().toISOString()}] Successfully fetched ${files.length} files for userId: ${userId} (${duration}ms)`);
    
    res.json({
      files,
      count: files.length,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    const duration = Date.now() - startTime;
    const errorDetails = {
      userId,
      errorType: e?.constructor?.name || typeof e,
      message: e?.message || String(e),
      stack: e?.stack,
      code: e?.code,
      status: e?.response?.status,
      responseData: e?.response?.data,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };
    
    console.error(`[Files API] [${new Date().toISOString()}] Error fetching files:`, errorDetails);
    console.error('[Files API] Full error object:', e);
    
    // Determine appropriate status code
    let statusCode = 500;
    if (e?.code === 401 || e?.message?.includes('re-authenticate')) {
      statusCode = 401;
    } else if (e?.code === 403 || e?.message?.includes('permission')) {
      statusCode = 403;
    } else if (e?.code === 429 || e?.message?.includes('rate limit')) {
      statusCode = 429;
    } else if (e?.code === 503 || e?.message?.includes('unavailable')) {
      statusCode = 503;
    }
    
    // Provide user-friendly error message
    const userMessage = e?.message || 'Failed to fetch files. Please try again or re-authenticate.';
    res.status(statusCode).json({
      error: userMessage,
      details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
      timestamp: new Date().toISOString(),
    });
  }
});
