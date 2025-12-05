import type {Request, Response} from 'express';
import {Router} from 'express';
import {optionalAuth} from '../auth/middleware.js';
import {isConnected} from '../db/connection.js';
import {listMessages} from '../google/gmail.js';
import {getMockEmails} from '../google/mockEmails.js';

export const router = Router();

// GET /api/messages
// Query params:
//   - mock=true: Force mock data for demos
// Note: Uses optionalAuth - returns mock data when not authenticated
router.get(
  '/',
  optionalAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as Request & {userId?: string}).userId;
    const startTime = Date.now();
    const useMock = req.query.mock === 'true';

    // If not authenticated, return mock data
    if (!userId) {
      const mockMessages = getMockEmails();
      console.log(
        `[Messages API] [${new Date().toISOString()}] Not authenticated, returning ${mockMessages.length} mock messages`,
      );
      res.json({
        messages: mockMessages,
        count: mockMessages.length,
        timestamp: new Date().toISOString(),
        mock: true,
        reason: 'not_authenticated',
      });
      return;
    }

    // If mock data is explicitly requested, return it immediately
    if (useMock) {
      const mockMessages = getMockEmails();
      console.log(
        `[Messages API] [${new Date().toISOString()}] Returning ${mockMessages.length} mock messages (demo mode)`,
      );
      res.json({
        messages: mockMessages,
        count: mockMessages.length,
        timestamp: new Date().toISOString(),
        mock: true,
      });
      return;
    }

    try {
      // Validate database connection
      if (!isConnected()) {
        console.error('[Messages API] Database not connected');
        // Fall back to mock data
        const mockMessages = getMockEmails();
        console.log(
          `[Messages API] [${new Date().toISOString()}] Database unavailable, returning ${mockMessages.length} mock messages`,
        );
        res.json({
          messages: mockMessages,
          count: mockMessages.length,
          timestamp: new Date().toISOString(),
          mock: true,
          reason: 'database_unavailable',
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

      // Fall back to mock data on any error
      const mockMessages = getMockEmails();
      console.log(
        `[Messages API] [${new Date().toISOString()}] Gmail API failed, returning ${mockMessages.length} mock messages as fallback`,
      );

      res.json({
        messages: mockMessages,
        count: mockMessages.length,
        timestamp: new Date().toISOString(),
        mock: true,
        reason: 'gmail_api_error',
        originalError: e?.message || 'Unknown error',
      });
    }
  },
);
