import type {Request, Response, NextFunction} from 'express';
import {isConnected} from '../db/connection.js';
import {UserRepository} from '../db/repositories/UserRepository.js';

/**
 * Express middleware to require authentication.
 * Checks if user has a valid session with userId.
 * For API requests, returns 401 JSON error.
 * For page requests, redirects to sign-in.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Check if session exists
    if (!req.session) {
      console.warn('[Auth Middleware] No session found');
      const isApiRequest =
        req.path.startsWith('/api/') ||
        req.get('Accept')?.includes('application/json');

      if (isApiRequest) {
        res.status(401).json({error: 'Unauthorized: No session found'});
        return;
      }

      res.redirect('/auth/signin');
      return;
    }

    // Check if userId exists in session
    if (!req.session.userId) {
      console.warn('[Auth Middleware] No userId in session');
      const isApiRequest =
        req.path.startsWith('/api/') ||
        req.get('Accept')?.includes('application/json');

      if (isApiRequest) {
        res.status(401).json({error: 'Unauthorized: Please sign in'});
        return;
      }

      res.redirect('/auth/signin');
      return;
    }

    // Validate userId format (should be a valid MongoDB ObjectId string)
    const userId = req.session.userId;
    if (typeof userId !== 'string' || userId.length !== 24) {
      console.error('[Auth Middleware] Invalid userId format:', userId);
      req.session.destroy(() => {});
      const isApiRequest =
        req.path.startsWith('/api/') ||
        req.get('Accept')?.includes('application/json');

      if (isApiRequest) {
        res.status(401).json({error: 'Unauthorized: Invalid session'});
        return;
      }

      res.redirect('/auth/signin');
      return;
    }

    // Optionally verify user exists in database (only if database is connected)
    if (isConnected()) {
      try {
        const userRepo = UserRepository.getInstance();
        const user = await userRepo.findById(userId);

        if (!user) {
          console.warn(
            `[Auth Middleware] User not found in database: ${userId}`,
          );
          req.session.destroy(() => {});
          const isApiRequest =
            req.path.startsWith('/api/') ||
            req.get('Accept')?.includes('application/json');

          if (isApiRequest) {
            res.status(401).json({error: 'Unauthorized: User not found'});
            return;
          }

          res.redirect('/auth/signin');
          return;
        }
      } catch (dbError) {
        // If database lookup fails, log but don't block (might be transient)
        console.error(
          '[Auth Middleware] Error verifying user in database:',
          dbError,
        );
        // Continue with the request - the API endpoints will handle database errors
      }
    }

    // Attach userId to request for downstream use
    (req as Request & {userId: string}).userId = userId;
    next();
  } catch (error) {
    console.error('[Auth Middleware] Unexpected error:', error);
    const isApiRequest =
      req.path.startsWith('/api/') ||
      req.get('Accept')?.includes('application/json');

    if (isApiRequest) {
      res
        .status(500)
        .json({error: 'Internal server error during authentication'});
      return;
    }

    res.redirect('/auth/signin');
  }
}
