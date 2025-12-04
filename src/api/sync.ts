import {Router, Request, Response} from 'express';
import {syncWorkspace} from '../google/sync.js';
import {requireAuth} from '../auth/middleware.js'; 

const router = Router();

/**
 * POST /api/sync
 * Triggers a manual sync of Gmail, Drive, Calendar for the current user.
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;

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