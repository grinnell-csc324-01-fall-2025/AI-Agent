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

console.log('[DB Config] Environment check:', {
  isServerless,
  VERCEL: !!process.env.VERCEL,
  VERCEL_ENV: process.env.VERCEL_ENV,
  AWS_LAMBDA: !!process.env.AWS_LAMBDA_FUNCTION_NAME,
  NODE_ENV: process.env.NODE_ENV,
});

// Base options that apply to all connections
const baseOptions = {
  maxPoolSize: parseInt(
    process.env.MONGODB_MAX_POOL_SIZE || (isServerless ? '1' : '10'),
    10,
  ),
  minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '0', 10),
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
};

export const dbConfig = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  dbName: process.env.MONGODB_DB_NAME || 'ai-agent-db',
  get options() {
    // Dynamically determine if current URI is Atlas
    const currentIsMongoAtlas = this.uri.startsWith('mongodb+srv://');
    const options = {
      ...baseOptions,
      // TLS/SSL configuration for MongoDB Atlas
      // For mongodb+srv:// connections, TLS is required
      ...(currentIsMongoAtlas && {
        tls: true,
        tlsAllowInvalidCertificates: false,
      }),
    };
    console.log('[DB Config] Connection options:', {
      uri: this.uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
      maxPoolSize: options.maxPoolSize,
      minPoolSize: options.minPoolSize,
      connectTimeoutMS: options.connectTimeoutMS,
      isAtlas: currentIsMongoAtlas,
    });
    return options;
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
