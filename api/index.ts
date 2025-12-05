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
  try {
    await ensureConnection();
    // Also ensure MongoStore has the client ready
    await getClientAsync();
  } catch (err) {
    console.error('[Vercel Handler] Database connection not ready:', err);
    // Still try to handle request - some routes might work without DB
  }
  return app(req, res);
};
