import {Router, Request, Response} from 'express';
import {fetchNormalizedEvents} from '../google/calendar.js';
import {requireAuth} from '../auth/middleware.js';
import {isConnected} from '../db/connection.js';

const router = Router();

// GET /api/events
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    // Extract userId from request as set by requireAuth middleware
    const userId = (req as Request & {userId: string}).userId;

    // Validate database connection
    if (!isConnected()) {
      console.error('[Events API] Database not connected');
      res.status(503).json({
        error: 'Database connection unavailable. Please try again later.',
      });
      return;
    }

    const events = await fetchNormalizedEvents(userId, {
      maxResults: 20,
    });

    res.json({events});
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({error: 'Failed to fetch events'});
  }
});

export default router;