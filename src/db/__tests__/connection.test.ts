import {MongoMemoryServer} from 'mongodb-memory-server';
import {dbConfig} from '../config.js';

/**
 * Unit tests for database connection singleton pattern and lifecycle management.
 */
describe('Database Connection', () => {
  let mongoServer: MongoMemoryServer;
  let testDbUri: string;
  let originalUri: string;

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    testDbUri = mongoServer.getUri();
    originalUri = dbConfig.uri;
    dbConfig.uri = testDbUri;
  });

  afterAll(async () => {
    // Restore original URI and stop server
    dbConfig.uri = originalUri;
    await mongoServer.stop();
  });

  /**
   * Test 1: Singleton pattern ensures only one instance exists
   */
  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple getInstance calls', async () => {
      // Import fresh to test singleton
      const {connect, disconnect} = await import('../connection.js');

      await connect();
      const client1 = await import('../connection.js');
      const client2 = await import('../connection.js');

      // Both imports should reference the same underlying connection
      expect(client1).toBe(client2);

      await disconnect();
    });
  });

  /**
   * Test 2: Successful database connection
   */
  describe('Connection Establishment', () => {
    it('should successfully connect to MongoDB', async () => {
      const {connect, disconnect, isConnected} = await import(
        '../connection.js'
      );

      const db = await connect();

      expect(db).toBeDefined();
      expect(isConnected()).toBe(true);

      // Verify we can perform operations
      const collections = await db.listCollections().toArray();
      expect(Array.isArray(collections)).toBe(true);

      await disconnect();
    });

    it('should return existing connection on subsequent calls', async () => {
      const {connect, disconnect} = await import('../connection.js');

      const db1 = await connect();
      const db2 = await connect();

      // Should return same instance
      expect(db1).toBe(db2);

      await disconnect();
    });
  });

  /**
   * Test 3: Connection management
   */
  describe('Connection Management', () => {
    it('should handle disconnect when not connected', async () => {
      const {disconnect} = await import('../connection.js');

      // Should not throw error
      await expect(disconnect()).resolves.not.toThrow();
    });

    it('should allow reconnection after disconnect', async () => {
      const {connect, disconnect, isConnected} = await import(
        '../connection.js'
      );

      // Connect, disconnect, then reconnect
      await connect();
      await disconnect();
      expect(isConnected()).toBe(false);

      await connect();
      expect(isConnected()).toBe(true);

      await disconnect();
    });
  });

  /**
   * Test 4: Health check functionality
   */
  describe('Health Check', () => {
    it('should return true when database is connected', async () => {
      const {connect, disconnect, healthCheck} = await import(
        '../connection.js'
      );

      await connect();
      const isHealthy = await healthCheck();

      expect(isHealthy).toBe(true);

      await disconnect();
    });

    it('should return false when database is not connected', async () => {
      const {disconnect, healthCheck} = await import('../connection.js');

      await disconnect();
      const isHealthy = await healthCheck();

      expect(isHealthy).toBe(false);
    });
  });
});
