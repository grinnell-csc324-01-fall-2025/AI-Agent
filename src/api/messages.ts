import type {Request, Response} from 'express';
import {Router} from 'express';
import {requireAuth} from '../auth/middleware.js';
import {isConnected} from '../db/connection.js';
import {listMessages} from '../google/gmail.js';

export const router = Router();

// GET /api/messages
router.get(
  '/',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as Request & {userId: string}).userId;
    const startTime = Date.now();

    try {
      // Validate database connection
      if (!isConnected()) {
        console.error('[Messages API] Database not connected');
        res.status(503).json({
          error: 'Database connection unavailable. Please try again later.',
        });
        return;
      }

      console.log(
        `[Messages API] [${new Date().toISOString()}] Fetching messages for userId: ${userId}`,
      );
      console.log('[Messages API] Request details:', {
        userId,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      const messages = await listMessages(userId);
      const duration = Date.now() - startTime;

      console.log(
        `[Messages API] [${new Date().toISOString()}] Successfully fetched ${messages.length} messages for userId: ${userId} (${duration}ms)`,
      );

      res.json({
        messages,
        count: messages.length,
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

      console.error(
        `[Messages API] [${new Date().toISOString()}] Error fetching messages:`,
        errorDetails,
      );
      console.error('[Messages API] Full error object:', e);

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
      const userMessage =
        e?.message ||
        'Failed to fetch messages. Please try again or re-authenticate.';
      res.status(statusCode).json({
        error: userMessage,
        details:
          process.env.NODE_ENV === 'development' ? errorDetails : undefined,
        timestamp: new Date().toISOString(),
      });
    }
  },
);
