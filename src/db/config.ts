import dotenv from 'dotenv';

dotenv.config();

export const dbConfig = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  dbName: process.env.MONGODB_DB_NAME || 'ai-agent-db',
  options: {
    maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10', 10),
    minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '2', 10),
    connectTimeoutMS: parseInt(
      process.env.MONGODB_CONNECT_TIMEOUT_MS || '10000',
      10,
    ),
    serverSelectionTimeoutMS: parseInt(
      process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || '5000',
      10,
    ),
    socketTimeoutMS: parseInt(
      process.env.MONGODB_SOCKET_TIMEOUT_MS || '45000',
      10,
    ),
    retryWrites: true,
  },
};

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
