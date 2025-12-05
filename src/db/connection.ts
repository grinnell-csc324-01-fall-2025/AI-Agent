import { Db, MongoClient } from 'mongodb';
import { dbConfig, validateDbConfig } from './config.js';

/**
 * Singleton class managing MongoDB database connections.
 * Provides connection pooling, automatic retry logic, and lifecycle management.
 */
export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private isConnecting = false;
  private connectionPromise: Promise<Db> | null = null;

  private constructor() { }

  /**
   * Gets the singleton instance of DatabaseConnection.
   * @returns The singleton DatabaseConnection instance
   */
  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  /**
   * Establishes connection to MongoDB with automatic retry on concurrent calls.
   * Returns existing connection if already connected or connection in progress.
   * @returns Promise resolving to the MongoDB database instance
   * @throws Error if connection fails after all retry attempts
   */
  public async connect(): Promise<Db> {
    if (this.db) {
      return this.db;
    }

    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    this.isConnecting = true;
    this.connectionPromise = this.establishConnection();

    try {
      this.db = await this.connectionPromise;
      return this.db;
    } finally {
      this.isConnecting = false;
      this.connectionPromise = null;
    }
  }

  /**
   * Establishes MongoDB connection with exponential backoff retry logic.
   * Retries up to 3 times with delays of 2s, 4s, and 8s.
   * @returns Promise resolving to the connected database instance
   * @throws Error if all connection attempts fail
   */
  private async establishConnection(): Promise<Db> {
    try {
      validateDbConfig();
    } catch (configError) {
      const errorMessage =
        configError instanceof Error
          ? configError.message
          : 'Invalid database configuration';
      console.error(
        '[Database Connection] Configuration validation failed:',
        errorMessage,
      );
      throw new Error(`Database configuration error: ${errorMessage}`);
    }

    const maxRetries = 3;
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount < maxRetries) {
      try {
        const attemptNumber = retryCount + 1;
        console.log(
          `[Database Connection] [${new Date().toISOString()}] Attempting to connect to MongoDB (attempt ${attemptNumber}/${maxRetries})`,
        );
        console.log(
          `[Database Connection] URI: ${dbConfig.uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`,
        ); // Mask credentials
        console.log(`[Database Connection] Database name: ${dbConfig.dbName}`);

        if (!this.client) {
          this.client = new MongoClient(dbConfig.uri, dbConfig.options);
          this.setupEventListeners();
        }

        // Set connection timeout
        const connectTimeout = dbConfig.options.connectTimeoutMS || 10000;
        const connectPromise = this.client.connect();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () =>
              reject(new Error(`Connection timeout after ${connectTimeout}ms`)),
            connectTimeout,
          );
        });

        await Promise.race([connectPromise, timeoutPromise]);

        this.db = this.client.db(dbConfig.dbName);

        // Verify connection with ping
        const pingStart = Date.now();
        await this.db.admin().ping();
        const pingDuration = Date.now() - pingStart;

        console.log(
          `[Database Connection] [${new Date().toISOString()}] Successfully connected to MongoDB`,
        );
        console.log(`[Database Connection] Database: ${dbConfig.dbName}`);
        console.log(`[Database Connection] Ping duration: ${pingDuration}ms`);

        // this.setupEventListeners(); // Moved to client creation
        return this.db;
      } catch (error) {
        lastError = error as Error;
        retryCount++;

        const errorDetails = {
          attempt: retryCount,
          errorType:
            error instanceof Error ? error.constructor.name : typeof error,
          message: error instanceof Error ? error.message : String(error),
          code: (error as any)?.code,
          name: (error as any)?.name,
        };

        console.error(
          `[Database Connection] [${new Date().toISOString()}] MongoDB connection attempt ${retryCount} failed:`,
          errorDetails,
        );

        if (retryCount < maxRetries) {
          const waitTime = Math.pow(2, retryCount) * 1000;
          console.log(
            `[Database Connection] Retrying in ${waitTime / 1000}s...`,
          );
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          // Clean up failed connection attempt
          if (this.client) {
            try {
              await this.client.close();
            } catch (closeError) {
              console.error(
                '[Database Connection] Error closing failed connection:',
                closeError,
              );
            }
            this.client = null;
          }
        }
      }
    }

    const finalError = new Error(
      `Failed to connect to MongoDB after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
    );
    if (lastError) {
      finalError.stack = lastError.stack;
    }
    console.error('[Database Connection] All connection attempts failed:', {
      maxRetries,
      lastError: lastError?.message,
      uri: dbConfig.uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
    });
    throw finalError;
  }

  /**
   * Sets up event listeners for MongoDB client lifecycle events.
   * Monitors errors, timeouts, disconnections, and reconnections.
   */
  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on('error', error => {
      console.error('MongoDB client error:', error);
    });

    this.client.on('timeout', () => {
      console.error('MongoDB connection timeout');
    });

    this.client.on('close', () => {
      console.log('MongoDB connection closed');
      this.db = null;
    });

    this.client.on('reconnect', () => {
      console.log('Reconnected to MongoDB');
    });
  }

  /**
   * Synchronously retrieves the database instance.
   * @returns The connected MongoDB database instance
   * @throws Error if database is not connected
   */
  public getDb(): Db {
    if (!this.db) {
      const error = new Error(
        'Database not connected. Call connect() first or use getDbAsync()',
      );
      console.error(
        '[Database Connection] Attempted to get database when not connected',
      );
      throw error;
    }

    // Verify connection is still alive
    if (!this.client) {
      const error = new Error(
        'Database client is null. Connection may have been lost.',
      );
      console.error('[Database Connection] Database client is null');
      this.db = null;
      throw error;
    }

    return this.db;
  }

  /**
   * Asynchronously retrieves the database instance, connecting if necessary.
   * @returns Promise resolving to the MongoDB database instance
   */
  public async getDbAsync(): Promise<Db> {
    if (this.db) {
      return this.db;
    }
    return this.connect();
  }

  /**
   * Checks if database is currently connected.
   * @returns true if connected, false otherwise
   */
  public isConnected(): boolean {
    return this.db !== null && this.client !== null;
  }

  /**
   * Asynchronously retrieves the MongoDB client instance, connecting if necessary.
   * Useful for libraries that need the client directly (like connect-mongo).
   * @returns Promise resolving to the MongoDB client instance
   */
  public async getClientAsync(): Promise<MongoClient> {
    if (this.client && this.db) {
      return this.client;
    }
    await this.connect();
    if (!this.client) {
      throw new Error('Failed to initialize MongoDB client');
    }
    return this.client;
  }

  /**
   * Gracefully disconnects from MongoDB.
   * Closes the client connection and clears internal state.
   */
  public async disconnect(): Promise<void> {
    if (this.client) {
      console.log('Disconnecting from MongoDB...');
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log('Disconnected from MongoDB');
    }
  }

  /**
   * Performs health check by pinging the database.
   * @returns Promise resolving to true if healthy, false otherwise
   */
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.db) {
        console.warn(
          '[Database Connection] Health check failed: database instance is null',
        );
        return false;
      }

      if (!this.client) {
        console.warn(
          '[Database Connection] Health check failed: client is null',
        );
        return false;
      }

      const pingStart = Date.now();
      await this.db.admin().ping();
      const pingDuration = Date.now() - pingStart;

      if (pingDuration > 1000) {
        console.warn(
          `[Database Connection] Health check ping took ${pingDuration}ms (slow)`,
        );
      }

      return true;
    } catch (error) {
      const errorDetails = {
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
      };
      console.error('[Database Connection] Health check failed:', errorDetails);

      // Mark connection as lost
      if (
        error instanceof Error &&
        (error.message.includes('connection') ||
          error.message.includes('timeout') ||
          (error as any)?.code === 'ECONNREFUSED')
      ) {
        console.warn(
          '[Database Connection] Connection appears to be lost, clearing state',
        );
        this.db = null;
        if (this.client) {
          try {
            await this.client.close();
          } catch (closeError) {
            // Ignore close errors
          }
          this.client = null;
        }
      }

      return false;
    }
  }
}

const dbConnection = DatabaseConnection.getInstance();

/**
 * Connects to the MongoDB database.
 * @returns Promise resolving to the connected database instance
 */
export const connect = (): Promise<Db> => dbConnection.connect();

/**
 * Synchronously retrieves the database instance.
 * @returns The connected database instance
 * @throws Error if not connected
 */
export const getDb = (): Db => dbConnection.getDb();

/**
 * Asynchronously retrieves the database instance, connecting if needed.
 * @returns Promise resolving to the database instance
 */
export const getDbAsync = (): Promise<Db> => dbConnection.getDbAsync();

/**
 * Checks if database is currently connected.
 * @returns true if connected, false otherwise
 */
export const isConnected = (): boolean => dbConnection.isConnected();

/**
 * Asynchronously retrieves the MongoDB client instance.
 * @returns Promise resolving to the MongoDB client instance
 */
export const getClientAsync = (): Promise<MongoClient> =>
  dbConnection.getClientAsync();

/**
 * Gracefully disconnects from MongoDB.
 * @returns Promise that resolves when disconnection is complete
 */
export const disconnect = (): Promise<void> => dbConnection.disconnect();

/**
 * Performs database health check.
 * @returns Promise resolving to true if healthy, false otherwise
 */
export const healthCheck = (): Promise<boolean> => dbConnection.healthCheck();

/**
 * Gracefully shuts down database connection on process termination signals.
 * @param signal - The termination signal received (SIGINT or SIGTERM)
 * @throws Error after cleanup to terminate the process
 */
async function gracefulShutdown(signal: string): Promise<never> {
  console.log(`Received ${signal}, shutting down gracefully...`);
  await disconnect();
  // In a real application, we'd notify the parent process
  // For now, throw to terminate
  throw new Error(`Process terminated by ${signal}`);
}

process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
