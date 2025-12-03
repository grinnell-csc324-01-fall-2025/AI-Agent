import {connect} from '../src/db/connection.js';
import {app} from '../src/server.js';

import express from 'express';

// Initialize database connection for serverless environment
// This runs once per cold start
let exportedApp = app;

connect().catch(err => {
  console.error('Database connection failed:', err);
  // Create a fallback app that always returns 500 if DB fails
  const fallbackApp = express();
  fallbackApp.use((_req, res) => {
    res.status(500).json({
      error: 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  });
  exportedApp = fallbackApp;
});

export default async (req: any, res: any) => {
  // Ensure we use the correct app instance (either main app or fallback)
  return exportedApp(req, res);
};
