import {MongoMemoryServer} from 'mongodb-memory-server';
import {UserRepository} from '../UserRepository.js';
import {DatabaseConnection} from '../../connection.js';
import {dbConfig} from '../../config.js';
import {User} from '../../models/User.js';

describe('UserRepository', () => {
  let mongoServer: MongoMemoryServer;
  let repository: UserRepository;
  let originalUri: string;

  const mockUser: Omit<User, '_id' | 'createdAt' | 'updatedAt'> = {
    email: 'test@example.com',
    googleId: '123456789',
    name: 'Test User',
    picture: 'https://example.com/pic.jpg',
    tokens: {
      access_token: 'access_token',
      refresh_token: 'refresh_token',
      scope: 'scope',
      token_type: 'Bearer',
      expiry_date: 1234567890,
    },
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    originalUri = dbConfig.uri;
    dbConfig.uri = mongoServer.getUri();
    repository = UserRepository.getInstance();
    await repository.initializeIndexes();
  });

  afterAll(async () => {
    await DatabaseConnection.getInstance().disconnect();
    dbConfig.uri = originalUri;
    await mongoServer.stop();
  });

  beforeEach(async () => {
    const db = await DatabaseConnection.getInstance().connect();
    await db.collection('users').deleteMany({});
  });

  describe('createOrUpdateUser', () => {
    it('should create a new user if not exists', async () => {
      const user = await repository.createOrUpdateUser(mockUser);

      expect(user._id).toBeDefined();
      expect(user.email).toBe(mockUser.email);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    it('should update existing user if exists', async () => {
      const created = await repository.createOrUpdateUser(mockUser);
      const originalUpdatedAt = created.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updatedUser = {
        ...mockUser,
        name: 'Updated Name',
      };

      const updated = await repository.createOrUpdateUser(updatedUser);

      expect(updated._id).toEqual(created._id);
      expect(updated.name).toBe('Updated Name');
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
      // CreatedAt should not change
      expect(updated.createdAt).toEqual(created.createdAt);
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      await repository.createOrUpdateUser(mockUser);
      const found = await repository.findByEmail(mockUser.email);

      expect(found).toBeDefined();
      expect(found?.email).toBe(mockUser.email);
    });

    it('should return null if email not found', async () => {
      const found = await repository.findByEmail('nonexistent@example.com');
      expect(found).toBeNull();
    });
  });

  describe('updateTokens', () => {
    it('should update user tokens', async () => {
      const user = await repository.createOrUpdateUser(mockUser);
      const newTokens = {
        ...mockUser.tokens,
        access_token: 'new_access_token',
      };

      const success = await repository.updateTokens(
        user._id.toString(),
        newTokens,
      );
      expect(success).toBe(true);

      const updated = await repository.findById(user._id);
      expect(updated?.tokens.access_token).toBe('new_access_token');
    });
  });

  describe('getTokens', () => {
    it('should retrieve user tokens', async () => {
      const user = await repository.createOrUpdateUser(mockUser);
      const tokens = await repository.getTokens(user._id.toString());

      expect(tokens).toEqual(mockUser.tokens);
    });

    it('should return null if user not found', async () => {
      const tokens = await repository.getTokens('000000000000000000000000');
      expect(tokens).toBeNull();
    });
  });
});
