import {Db, MongoClient} from 'mongodb';
import {dbConfig, validateDbConfig} from './config.js';

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private isConnecting = false;
  private connectionPromise: Promise<Db> | null = null;

  private constructor() {}

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

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

  public getDb(): Db {
    if (!this.db) {
      throw new Error(
        'Database not connected. Call connect() first or use getDbAsync()',
      );
    }
    return this.db;
  }

  public async getDbAsync(): Promise<Db> {
    if (this.db) {
      return this.db;
    }
    return this.connect();
  }

  public isConnected(): boolean {
    return this.db !== null && this.client !== null;
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      console.log('Disconnecting from MongoDB...');
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log('Disconnected from MongoDB');
    }
  }

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

export const connect = (): Promise<Db> => dbConnection.connect();
export const getDb = (): Db => dbConnection.getDb();
export const getDbAsync = (): Promise<Db> => dbConnection.getDbAsync();
export const isConnected = (): boolean => dbConnection.isConnected();
export const disconnect = (): Promise<void> => dbConnection.disconnect();
export const healthCheck = (): Promise<boolean> => dbConnection.healthCheck();

/**
 * Gracefully shutdown the database connection
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
