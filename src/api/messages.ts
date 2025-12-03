import type { Request, Response } from 'express';
import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { listMessages } from '../google/gmail.js';

export const router = Router();

// GET /api/messages
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & {userId: string}).userId;
  
  try {
    console.log(`[Messages API] Fetching messages for userId: ${userId}`);
    const messages = await listMessages(userId);
    console.log(`[Messages API] Successfully fetched ${messages.length} messages for userId: ${userId}`);
    res.json({messages});
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
    
    console.error('[Messages API] Error fetching messages:', errorDetails);
    console.error('[Messages API] Full error object:', e);
    
    // Provide user-friendly error message
    const userMessage = e?.message || 'Failed to fetch messages. Please try again or re-authenticate.';
    res.status(500).json({
      error: userMessage,
      details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
    });
  }
});
