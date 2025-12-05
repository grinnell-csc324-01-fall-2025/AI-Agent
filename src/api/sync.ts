import {Router, Request, Response} from 'express';
import {syncWorkspace} from '../google/sync.js';
import {requireAuth} from '../auth/middleware.js';
import {isConnected} from '../db/connection.js';

const router = Router();

/**
 * POST /api/sync
 * Triggers a manual sync of Gmail, Drive, Calendar for the current user.
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & {userId: string}).userId;

    // Validate database connection
    if (!isConnected()) {
      console.error('[Sync API] Database not connected');
      res.status(503).json({
        ok: false,
        error: 'Database connection unavailable. Please try again later.',
      });
      return;
    }

    const result = await syncWorkspace(userId);

    res.json({
      ok: true,
      synced: result,
    });
  } catch (err: any) {
    console.error('Error syncing workspace:', err);
    res.status(500).json({
      ok: false,
      error: err?.message || 'Failed to sync workspace',
    });
  }
});

export default router;