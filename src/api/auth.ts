import {Router} from 'express';
import type {Request, Response} from 'express';
import {UserRepository} from '../db/repositories/UserRepository.js';

export const router = Router();

/**
 * GET /api/auth/status
 * Returns the current authentication status and user information if authenticated.
 */
router.get('/status', async (req: Request, res: Response) => {
  if (!req.session || !req.session.userId) {
    return res.json({authenticated: false});
  }

  try {
    const userRepo = UserRepository.getInstance();
    const user = await userRepo.findById(req.session.userId);

    if (!user) {
      // Session has userId but user doesn't exist - invalid session
      req.session.destroy(() => {});
      return res.json({authenticated: false});
    }

    return res.json({
      authenticated: true,
      user: {
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    return res.json({authenticated: false});
  }
});
