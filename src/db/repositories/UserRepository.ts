import {BaseRepository} from './BaseRepository.js';
import {GoogleTokens, User} from '../models/User.js';
import {WithId} from 'mongodb';

/**
 * Repository for managing User documents.
 */
export class UserRepository extends BaseRepository<User> {
  private static instance: UserRepository;

  private constructor() {
    super('users');
  }

  /**
   * Gets the singleton instance of UserRepository.
   * @returns The UserRepository instance.
   */
  public static getInstance(): UserRepository {
    if (!UserRepository.instance) {
      UserRepository.instance = new UserRepository();
    }
    return UserRepository.instance;
  }

  /**
   * Initializes indexes for the users collection.
   */
  async initializeIndexes(): Promise<void> {
    const collection = await this.getCollection();
    await collection.createIndex({email: 1}, {unique: true});
    await collection.createIndex({googleId: 1}, {unique: true});
  }

  /**
   * Finds a user by their email address.
   * @param email The email address to search for.
   * @returns The user document or null if not found.
   */
  async findByEmail(email: string): Promise<WithId<User> | null> {
    const collection = await this.getCollection();
    return collection.findOne({email});
  }

  /**
   * Creates a new user or updates an existing one based on email.
   * @param user The user data to save.
   * @returns The saved user document.
   */
  async createOrUpdateUser(
    user: Omit<User, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<WithId<User>> {
    const collection = await this.getCollection();
    const now = new Date();

    const result = await collection.findOneAndUpdate(
      {email: user.email},
      {
        $set: {
          ...user,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      },
    );

    if (!result) {
      throw new Error('Failed to create or update user');
    }

    return result;
  }

  /**
   * Updates the Google tokens for a specific user.
   * @param userId The user's ID.
   * @param tokens The new tokens.
   * @returns True if updated, false otherwise.
   */
  async updateTokens(userId: string, tokens: GoogleTokens): Promise<boolean> {
    return this.update(userId, {
      $set: {
        tokens,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Retrieves the Google tokens for a specific user.
   * @param userId The user's ID.
   * @returns The tokens or null if user not found.
   */
  async getTokens(userId: string): Promise<GoogleTokens | null> {
    const user = await this.findById(userId);
    return user ? user.tokens : null;
  }
}
