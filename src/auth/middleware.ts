import type {Request, Response, NextFunction} from 'express';

/**
 * Express middleware to require authentication.
 * Checks if user has a valid session with userId.
 * For API requests, returns 401 JSON error.
 * For page requests, redirects to sign-in.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.session || !req.session.userId) {
    // Check if this is an API request
    const isApiRequest =
      req.path.startsWith('/api/') ||
      req.get('Accept')?.includes('application/json');

    if (isApiRequest) {
      res.status(401).json({error: 'Unauthorized'});
      return;
    }

    // For page requests, redirect to sign-in
    res.redirect('/auth/signin');
    return;
  }

  // Attach userId to request for downstream use
  (req as Request & {userId: string}).userId = req.session.userId;
  next();
}

