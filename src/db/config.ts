import dotenv from 'dotenv';

dotenv.config();

/**
 * MongoDB connection configuration.
 * Loads settings from environment variables with sensible defaults.
 */
// Increase timeouts for serverless environments (Vercel, AWS Lambda, etc.)
const isServerless =
  typeof process !== 'undefined' &&
  (process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.VERCEL_URL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME);

// Determine if we're using MongoDB Atlas (mongodb+srv://)
const isMongoAtlas = (process.env.MONGODB_URI || '').startsWith(
  'mongodb+srv://',
);

export const dbConfig = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  dbName: process.env.MONGODB_DB_NAME || 'ai-agent-db',
  options: {
    maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10', 10),
    minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '2', 10),
    connectTimeoutMS: parseInt(
      process.env.MONGODB_CONNECT_TIMEOUT_MS ||
        (isServerless ? '30000' : '10000'),
      10,
    ),
    serverSelectionTimeoutMS: parseInt(
      process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS ||
        (isServerless ? '30000' : '5000'),
      10,
    ),
    socketTimeoutMS: parseInt(
      process.env.MONGODB_SOCKET_TIMEOUT_MS || '45000',
      10,
    ),
    retryWrites: true,
    // TLS/SSL configuration for MongoDB Atlas
    // For mongodb+srv:// connections, TLS is required
    ...(isMongoAtlas && {
      tls: true,
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false,
      // Use system CA certificates
      tlsCAFile: undefined,
      // For serverless environments, use TLS 1.2+ (default)
      tlsInsecure: false,
    }),
  },
};

/**
 * Validates database configuration.
 * Ensures URI and database name are set with correct format.
 * @throws Error if configuration is invalid
 */
export function validateDbConfig(): void {
  if (!dbConfig.uri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  if (!dbConfig.dbName) {
    throw new Error('MONGODB_DB_NAME environment variable is required');
  }

  const uriRegex = /^mongodb(\+srv)?:\/\/.+/;
  if (!uriRegex.test(dbConfig.uri)) {
    throw new Error(
      'Invalid MongoDB URI format. Expected mongodb:// or mongodb+srv://',
    );
  }
}
