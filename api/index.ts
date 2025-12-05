import { connect, getClientAsync } from '../src/db/connection.js';
import { app } from '../src/server.js';

// Initialize database connection for serverless environment
// Start connection in background but don't block
let connectionReady = false;
let connectionPromise: Promise<void> | null = null;

function ensureConnection(): Promise<void> {
  if (connectionReady) {
    return Promise.resolve();
  }
  if (connectionPromise) {
    return connectionPromise;
  }
  connectionPromise = connect()
    .then(() => {
      connectionReady = true;
      console.log('[Vercel Handler] Database connection ready');
    })
    .catch(err => {
      console.error('[Vercel Handler] Initial database connection failed:', err);
      connectionReady = false;
      connectionPromise = null; // Allow retry
      throw err;
    });
  return connectionPromise;
}

// Start connection attempt in background
ensureConnection().catch(() => {
  // Connection failed, will retry on first request
});

export default async (req: any, res: any) => {
  // Ensure database connection is ready before handling request
  // This is critical for session middleware to work
  const connectionStartTime = Date.now();
  try {
    console.log('[Vercel Handler] Ensuring database connection before request...');
    await ensureConnection();
    // Also ensure MongoStore has the client ready
    const client = await getClientAsync();
    const connectionDuration = Date.now() - connectionStartTime;
    console.log('[Vercel Handler] Database connection ready:', {
      duration: connectionDuration,
      path: req.url,
    });
    if (connectionDuration > 5000) {
      console.warn(
        '[Vercel Handler] Database connection took longer than 5 seconds',
      );
    }
  } catch (err) {
    const connectionDuration = Date.now() - connectionStartTime;
    console.error('[Vercel Handler] Database connection not ready:', {
      error: err,
      duration: connectionDuration,
      path: req.url,
    });
    // Still try to handle request - some routes might work without DB
    // But session-dependent routes will fail gracefully
  }
  return app(req, res);
};
