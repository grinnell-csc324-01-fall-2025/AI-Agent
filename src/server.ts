import MongoStore from 'connect-mongo';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import path from 'path';
import {router as apiRouter} from './api/router.js';
import {authRouter} from './auth/authRouter.js';
import {config} from './config.js';
import {connect as connectToDatabase, getClientAsync} from './db/connection.js';
import {UserRepository} from './db/repositories/UserRepository.js';

const app = express();

// Trust proxy is required for secure cookies to work behind Vercel's load balancer
app.set('trust proxy', 1);

// Session middleware (must be before other middleware that uses sessions)
// Determine if we're in a secure environment (HTTPS)
const isSecure =
  process.env.NODE_ENV === 'production' ||
  !!process.env.VERCEL ||
  !!process.env.VERCEL_ENV ||
  (typeof process !== 'undefined' && process.env.HTTPS === 'true');

app.use(
  session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    name: 'connect.sid', // Explicit session cookie name
    store: MongoStore.create({
      clientPromise: getClientAsync(),
      dbName: 'ai-agent-db', // Ensure this matches your DB name
      ttl: 24 * 60 * 60, // 1 day
      autoRemove: 'native',
      stringify: false, // Store as BSON for better performance
    }),
    cookie: {
      secure: isSecure, // Use secure cookies in production/HTTPS environments
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: isSecure ? ('none' as const) : ('lax' as const), // Allow cross-site cookies in secure environments (for OAuth)
      // Don't set domain - let browser handle it (Vercel uses multiple domains)
      // path: '/' is default, which is correct
    },
  }),
);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(origin =>
  origin.trim(),
) || ['http://localhost:3978'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // 24 hours
  }),
);
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] ${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    hasSession: !!req.session,
    userId: req.session?.userId || 'none',
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`,
    );
  });

  next();
});

// Serve static assets for the personal tab
app.use(
  '/tabs/personal',
  express.static(path.join(process.cwd(), 'tabs/personal')),
);

// Auth + REST API
app.use('/auth', authRouter);
app.use('/api', apiRouter);

app.get(
  '/',
  (_req: import('express').Request, res: import('express').Response) =>
    res.redirect('/tabs/personal/index.html'),
);

// 404 handler for unknown routes
app.use((req, res) => {
  const isApiRequest =
    req.path.startsWith('/api/') ||
    req.get('Accept')?.includes('application/json');

  if (isApiRequest) {
    res.status(404).json({
      error: 'Not Found',
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(404).send('Not Found');
  }
});

// Global error handler middleware (must be last)
app.use(
  (
    err: unknown,
    req: import('express').Request,
    res: import('express').Response,
    _next: import('express').NextFunction,
  ) => {
    const isApiRequest =
      req.path.startsWith('/api/') ||
      req.get('Accept')?.includes('application/json');

    // Type guard for error-like objects
    const isErrorLike = (
      e: unknown,
    ): e is {
      message?: string;
      code?: unknown;
      status?: number;
      statusCode?: number;
      stack?: string;
    } => {
      return typeof e === 'object' && e !== null;
    };

    const errorObj = isErrorLike(err) ? err : null;
    const errorMessage =
      errorObj?.message ||
      (err instanceof Error ? err.message : 'Internal Server Error');
    const errorCode = errorObj?.code;
    const errorStatus = errorObj?.status || errorObj?.statusCode || 500;
    const errorStack =
      errorObj?.stack || (err instanceof Error ? err.stack : undefined);
    const errorType = err instanceof Error ? err.constructor.name : typeof err;

    const errorDetails = {
      errorType,
      message: errorMessage,
      code: errorCode,
      status: errorStatus,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
    };

    console.error(
      `[Server] [${new Date().toISOString()}] Unhandled error:`,
      errorDetails,
    );
    console.error('[Server] Full error:', err);

    if (isApiRequest) {
      res.status(errorStatus).json({
        error: errorMessage,
        details:
          process.env.NODE_ENV === 'development' ? errorDetails : undefined,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(errorStatus).send(errorMessage);
    }
  },
);

// Handle unhandled promise rejections
process.on(
  'unhandledRejection',
  (reason: unknown, promise: Promise<unknown>) => {
    const errorDetails = {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: promise.toString(),
      timestamp: new Date().toISOString(),
    };

    console.error('[Server] Unhandled Promise Rejection:', errorDetails);
    console.error('[Server] Full rejection:', reason);

    // Don't exit the process in production, but log the error
    if (process.env.NODE_ENV === 'production') {
      // In production, you might want to send this to an error tracking service
      // For now, we'll just log it
    }
  },
);

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  const errorDetails = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    timestamp: new Date().toISOString(),
  };

  console.error('[Server] Uncaught Exception:', errorDetails);
  console.error('[Server] Full error:', error);

  // Exit the process after logging (let process manager restart it)
  // eslint-disable-next-line n/no-process-exit
  process.exit(1);
});

const port = process.env.PORT || 3978;

async function startServer() {
  try {
    console.log('Initializing database connection...');
    await connectToDatabase();

    // Initialize database indexes
    console.log('Initializing database indexes...');
    const userRepo = UserRepository.getInstance();
    await userRepo.initializeIndexes();
    console.log('Database indexes initialized');

    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
      console.log(`Health check: http://localhost:${port}/api/health/db`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    throw error;
  }
}

export {app, startServer};
