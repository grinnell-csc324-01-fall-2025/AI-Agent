import { connect } from '../src/db/connection.js';
import { app } from '../src/server.js';

// Initialize database connection for serverless environment
// Don't block on connection - let it connect lazily when needed
// This prevents timeouts during cold starts
connect().catch(err => {
  console.error('[Vercel Handler] Database connection failed (non-blocking):', err);
  // Don't create fallback - let requests handle connection errors gracefully
  // The connection will retry on subsequent requests
});

export default async (req: any, res: any) => {
  // Use the main app - it will handle database connection lazily
  return app(req, res);
};
