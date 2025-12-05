import type {Request, Response} from 'express';
import {Router} from 'express';
import {optionalAuth} from '../auth/middleware.js';
import {isConnected} from '../db/connection.js';
import {listRecentFiles} from '../google/drive.js';
import {getMockFiles} from '../google/mockFiles.js';

export const router = Router();

// GET /api/files
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
      const mockFiles = getMockFiles();
      console.log(
        `[Files API] [${new Date().toISOString()}] Not authenticated, returning ${mockFiles.length} mock files`,
      );
      res.json({
        files: mockFiles,
        count: mockFiles.length,
        timestamp: new Date().toISOString(),
        mock: true,
        reason: 'not_authenticated',
      });
      return;
    }

    // If mock data is explicitly requested, return it immediately
    if (useMock) {
      const mockFiles = getMockFiles();
      console.log(
        `[Files API] [${new Date().toISOString()}] Returning ${mockFiles.length} mock files (demo mode)`,
      );
      res.json({
        files: mockFiles,
        count: mockFiles.length,
        timestamp: new Date().toISOString(),
        mock: true,
      });
      return;
    }

    try {
      // Validate database connection
      if (!isConnected()) {
        console.error('[Files API] Database not connected');
        // Fall back to mock data
        const mockFiles = getMockFiles();
        console.log(
          `[Files API] [${new Date().toISOString()}] Database unavailable, returning ${mockFiles.length} mock files`,
        );
        res.json({
          files: mockFiles,
          count: mockFiles.length,
          timestamp: new Date().toISOString(),
          mock: true,
          reason: 'database_unavailable',
        });
        return;
      }

      console.log(
        `[Files API] [${new Date().toISOString()}] Fetching files for userId: ${userId}`,
      );
      console.log('[Files API] Request details:', {
        userId,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      const files = await listRecentFiles(userId);
      const duration = Date.now() - startTime;

      console.log(
        `[Files API] [${new Date().toISOString()}] Successfully fetched ${files.length} files for userId: ${userId} (${duration}ms)`,
      );

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

      console.error(
        `[Files API] [${new Date().toISOString()}] Error fetching files:`,
        errorDetails,
      );
      console.error('[Files API] Full error object:', e);

      // Fall back to mock data on any error
      const mockFiles = getMockFiles();
      console.log(
        `[Files API] [${new Date().toISOString()}] Drive API failed, returning ${mockFiles.length} mock files as fallback`,
      );

      res.json({
        files: mockFiles,
        count: mockFiles.length,
        timestamp: new Date().toISOString(),
        mock: true,
        reason: 'drive_api_error',
        originalError: e?.message || 'Unknown error',
      });
    }
  },
);
