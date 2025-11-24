import { Router } from 'express';
import { healthCheck } from '../db/connection.js';

export const router = Router();

router.get('/db', async (req, res) => {
    try {
        const healthy = await healthCheck();

        if (healthy) {
            res.status(200).json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
            });
        } else {
            res.status(503).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
            });
        }
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
