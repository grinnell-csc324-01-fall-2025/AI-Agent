import {ObjectId, OptionalUnlessRequiredId} from 'mongodb';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {BaseRepository} from '../BaseRepository.js';
import {DatabaseConnection} from '../../connection.js';
import {dbConfig} from '../../config.js';

// Define a simple interface for testing
interface TestItem {
  _id?: ObjectId;
  name: string;
  value: number;
}

// Concrete implementation of BaseRepository for testing
class TestRepository extends BaseRepository<TestItem> {
  constructor() {
    super('test_items');
  }
}

describe('BaseRepository', () => {
  let mongoServer: MongoMemoryServer;
  let repository: TestRepository;
  let originalUri: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    originalUri = dbConfig.uri;
    dbConfig.uri = mongoServer.getUri();
    repository = new TestRepository();
  });

  afterAll(async () => {
    await DatabaseConnection.getInstance().disconnect();
    dbConfig.uri = originalUri;
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear collection before each test
    const db = await DatabaseConnection.getInstance().connect();
    await db.collection('test_items').deleteMany({});
  });

  describe('create', () => {
    it('should create a new document and return it with ID', async () => {
      const item: OptionalUnlessRequiredId<TestItem> = {
        name: 'Test Item',
        value: 123,
      };

      const result = await repository.create(item);

      expect(result._id).toBeDefined();
      expect(result.name).toBe(item.name);
      expect(result.value).toBe(item.value);
    });
  });

  describe('findById', () => {
    it('should find a document by ID', async () => {
      const item = await repository.create({name: 'Find Me', value: 456});
      const found = await repository.findById(item._id);

      expect(found).toBeDefined();
      expect(found?._id).toEqual(item._id);
      expect(found?.name).toBe('Find Me');
    });

    it('should return null if document not found', async () => {
      const found = await repository.findById(new ObjectId());
      expect(found).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a document and return true', async () => {
      const item = await repository.create({name: 'Update Me', value: 789});
      const success = await repository.update(item._id, {
        $set: {name: 'Updated'},
      });

      expect(success).toBe(true);

      const updated = await repository.findById(item._id);
      expect(updated?.name).toBe('Updated');
    });

    it('should return false if document not found', async () => {
      const success = await repository.update(new ObjectId(), {
        $set: {name: 'Ghost'},
      });
      expect(success).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete a document and return true', async () => {
      const item = await repository.create({name: 'Delete Me', value: 0});
      const success = await repository.delete(item._id);

      expect(success).toBe(true);

      const found = await repository.findById(item._id);
      expect(found).toBeNull();
    });

    it('should return false if document not found', async () => {
      const success = await repository.delete(new ObjectId());
      expect(success).toBe(false);
    });
  });
});
