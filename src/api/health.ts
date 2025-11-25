import type {Request, Response} from 'express';
import {Router} from 'express';
import {healthCheck} from '../db/connection.js';

export const router = Router();

/**
 * Database health check endpoint.
 * Returns 200 OK if database is connected, 503 Service Unavailable otherwise.
 */
router.get('/db', async (_req: Request, res: Response) => {
  try {
    const healthy = await healthCheck();

    if (healthy) {
      res.status(200).json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});
