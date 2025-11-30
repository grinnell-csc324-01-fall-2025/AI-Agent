import cors from 'cors';
import express from 'express';
import path from 'path';
import {fileURLToPath} from 'url';
import {router as apiRouter} from './api/router.js';
import {authRouter} from './auth/authRouter.js';
import {connect as connectToDatabase} from './db/connection.js';
import './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3978',
    ],
    credentials: true,
  }),
);
app.use(express.json());

// Serve static assets for the personal tab
app.use(
  '/tabs/personal',
  express.static(path.join(__dirname, '../tabs/personal')),
);

// Auth + REST API
app.use('/auth', authRouter);
app.use('/api', apiRouter);

app.get(
  '/',
  (_req: import('express').Request, res: import('express').Response) =>
    res.send('AI Teams Agent is running (Google Suite Agent)'),
);

const port = process.env.PORT || 3978;

async function startServer() {
  try {
    console.log('Initializing database connection...');
    await connectToDatabase();

    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
      console.log(`Health check: http://localhost:${port}/api/health/db`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    throw error;
  }
}

void startServer();
