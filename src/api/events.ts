import { Router, Request, Response } from 'express';
import { fetchNormalizedEvents } from '../google/calendar.js';
import { requireAuth } from '../auth/middleware.js'; 

const router = Router();

// GET /api/events
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    // Assuming you store user ID on req.user from your auth middleware
    const userId = (req as any).user.id as string;

    const events = await fetchNormalizedEvents(userId, {
      maxResults: 20,
    });

    res.json({ events });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

export default router;