import {Db, MongoClient} from 'mongodb';
import {dbConfig, validateDbConfig} from './config.js';

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

  private constructor() {}

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
    validateDbConfig();

    const maxRetries = 3;
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount < maxRetries) {
      try {
        console.log(
          `Attempting to connect to MongoDB (attempt ${retryCount + 1}/${maxRetries})`,
        );

        this.client = new MongoClient(dbConfig.uri, dbConfig.options);
        await this.client.connect();
        this.db = this.client.db(dbConfig.dbName);
        await this.db.admin().ping();

        console.log('Successfully connected to MongoDB');
        console.log(`Database: ${dbConfig.dbName}`);

        this.setupEventListeners();
        return this.db;
      } catch (error) {
        lastError = error as Error;
        retryCount++;

        console.error(
          `MongoDB connection attempt ${retryCount} failed:`,
          error,
        );

        if (retryCount < maxRetries) {
          const waitTime = Math.pow(2, retryCount) * 1000;
          console.log(`Retrying in ${waitTime / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    throw new Error(
      `Failed to connect to MongoDB after ${maxRetries} attempts: ${lastError?.message}`,
    );
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
      throw new Error(
        'Database not connected. Call connect() first or use getDbAsync()',
      );
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
        return false;
      }
      await this.db.admin().ping();
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
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
