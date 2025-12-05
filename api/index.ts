import { connect } from '../src/db/connection.js';
import { app } from '../src/server.js';

// Initialize database connection for serverless environment
// Don't block on connection - let it connect lazily when needed
// This prevents timeouts during cold starts
connect().catch(err => {
  console.error('[Vercel Handler] Initial database connection failed:', err);
  console.error(
    '[Vercel Handler] Application will attempt to reconnect on first database access',
  );
  console.error(
    '[Vercel Handler] Database-dependent features may be unavailable until connection succeeds',
  );
  // Note: Subsequent requests will attempt to reconnect via getClientAsync(),
  // but success is not guaranteed if the underlying issue persists
});

export default async (req: any, res: any) => {
  // Use the main app - it will handle database connection lazily
  return app(req, res);
};
