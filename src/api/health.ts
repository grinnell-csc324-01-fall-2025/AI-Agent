import type { Request, Response } from 'express';
import { Router } from 'express';
import { config } from '../config.js';
import { getDb, healthCheck, isConnected } from '../db/connection.js';
import { UserRepository } from '../db/repositories/UserRepository.js';

export const router = Router();

/**
 * Database health check endpoint.
 * Returns 200 OK if database is connected, 503 Service Unavailable otherwise.
 */
router.get('/db', async (_req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const healthy = await healthCheck();
    const duration = Date.now() - startTime;

    if (healthy) {
      const db = getDb();
      const dbName = db.databaseName;
      const adminDb = db.admin();
      
      let serverInfo = {};
      try {
        const serverStatus = await adminDb.serverStatus();
        serverInfo = {
          version: serverStatus.version,
          uptime: serverStatus.uptime,
          connections: serverStatus.connections,
        };
      } catch (e) {
        // Ignore server status errors
      }

      res.status(200).json({
        status: 'healthy',
        database: 'connected',
        dbName,
        duration: `${duration}ms`,
        serverInfo,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        database: 'disconnected',
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Authentication health check endpoint.
 * Returns authentication configuration status.
 */
router.get('/auth', async (req: Request, res: Response) => {
  try {
    const hasSession = !!req.session;
    const hasUserId = !!(req.session && req.session.userId);
    const isDbConnected = isConnected();
    
    let userInfo = null;
    if (hasUserId && isDbConnected && req.session?.userId) {
      try {
        const userRepo = UserRepository.getInstance();
        const user = await userRepo.findById(req.session.userId);
        if (user) {
          userInfo = {
            email: user.email,
            name: user.name,
            hasTokens: !!user.tokens,
            tokenExpiry: user.tokens?.expiry_date ? new Date(user.tokens.expiry_date).toISOString() : null,
            tokenExpired: user.tokens?.expiry_date ? user.tokens.expiry_date < Date.now() : null,
          };
        }
      } catch (e) {
        // Ignore user lookup errors
      }
    }

    const authConfig = {
      hasGoogleClientId: !!config.google.clientId,
      hasGoogleClientSecret: !!config.google.clientSecret,
      hasRedirectUri: !!config.google.redirectUri,
      scopes: config.google.scopes,
      sessionSecret: config.session.secret ? '***configured***' : 'missing',
    };

    res.status(200).json({
      status: 'ok',
      session: {
        exists: hasSession,
        hasUserId,
        userId: hasUserId ? req.session!.userId : null,
      },
      user: userInfo,
      database: {
        connected: isDbConnected,
      },
      config: authConfig,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Google API health check endpoint.
 * Verifies Google API configuration and connectivity.
 */
router.get('/google', async (req: Request, res: Response) => {
  try {
    const configStatus = {
      clientId: config.google.clientId ? 'configured' : 'missing',
      clientSecret: config.google.clientSecret ? 'configured' : 'missing',
      redirectUri: config.google.redirectUri ? 'configured' : 'missing',
      scopes: config.google.scopes,
      scopeCount: config.google.scopes.length,
    };

    // Check if user is authenticated and has valid tokens
    let tokenStatus = null;
    if (req.session && req.session.userId && isConnected()) {
      try {
        const userRepo = UserRepository.getInstance();
        const user = await userRepo.findById(req.session.userId);
        if (user && user.tokens) {
          const now = Date.now();
          const expiryDate = user.tokens.expiry_date || 0;
          const isExpired = expiryDate < now;
          const expiresIn = expiryDate > now ? Math.round((expiryDate - now) / 1000) : 0;

          tokenStatus = {
            hasAccessToken: !!user.tokens.access_token,
            hasRefreshToken: !!user.tokens.refresh_token,
            tokenType: user.tokens.token_type,
            isExpired,
            expiresIn: expiresIn > 0 ? `${expiresIn}s` : 'expired',
            expiryDate: new Date(expiryDate).toISOString(),
            scopes: user.tokens.scope,
          };
        }
      } catch (e) {
        tokenStatus = {
          error: e instanceof Error ? e.message : 'Unknown error',
        };
      }
    }

    res.status(200).json({
      status: 'ok',
      config: configStatus,
      tokens: tokenStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});
