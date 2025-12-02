import {
  Collection,
  Db,
  Filter,
  ObjectId,
  OptionalUnlessRequiredId,
  UpdateFilter,
  WithId,
} from 'mongodb';
import {DatabaseConnection} from '../connection.js';

/**
 * Abstract base repository class providing common CRUD operations.
 * @template T The model interface extending a basic object structure.
 */
export abstract class BaseRepository<T extends {_id?: ObjectId}> {
  protected collectionName: string;

  /**
   * Creates an instance of BaseRepository.
   * @param collectionName The name of the MongoDB collection.
   */
  protected constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  /**
   * Gets the MongoDB collection.
   * @returns The MongoDB collection instance.
   */
  protected async getCollection(): Promise<Collection<T>> {
    const db: Db = await DatabaseConnection.getInstance().connect();
    return db.collection<T>(this.collectionName);
  }

  /**
   * Creates a new document.
   * @param doc The document to create.
   * @returns The created document with its ID.
   */
  async create(doc: OptionalUnlessRequiredId<T>): Promise<WithId<T>> {
    const collection = await this.getCollection();
    const result = await collection.insertOne(doc);
    return {
      ...doc,
      _id: result.insertedId,
    } as WithId<T>;
  }

  /**
   * Finds a document by its ID.
   * @param id The document ID.
   * @returns The found document or null if not found.
   */
  async findById(id: string | ObjectId): Promise<WithId<T> | null> {
    const collection = await this.getCollection();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return collection.findOne({_id: objectId} as Filter<T>);
  }

  /**
   * Updates a document by its ID.
   * @param id The document ID.
   * @param update The update operations.
   * @returns True if the document was updated, false otherwise.
   */
  async update(
    id: string | ObjectId,
    update: UpdateFilter<T>,
  ): Promise<boolean> {
    const collection = await this.getCollection();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await collection.updateOne(
      {_id: objectId} as Filter<T>,
      update,
    );
    return result.modifiedCount > 0;
  }

  /**
   * Deletes a document by its ID.
   * @param id The document ID.
   * @returns True if the document was deleted, false otherwise.
   */
  async delete(id: string | ObjectId): Promise<boolean> {
    const collection = await this.getCollection();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await collection.deleteOne({_id: objectId} as Filter<T>);
    return result.deletedCount > 0;
  }
}
