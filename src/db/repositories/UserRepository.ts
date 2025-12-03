import {BaseRepository} from './BaseRepository.js';
import {GoogleTokens, User} from '../models/User.js';
import {WithId, ObjectId} from 'mongodb';

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
   * Validates ObjectId format.
   * @param id The ID to validate.
   * @throws Error if ID is invalid.
   */
  private validateObjectId(id: string | ObjectId): void {
    if (typeof id === 'string') {
      if (id.length !== 24) {
        throw new Error(
          `Invalid ObjectId format: ${id} (expected 24 characters)`,
        );
      }
      if (!ObjectId.isValid(id)) {
        throw new Error(`Invalid ObjectId: ${id}`);
      }
    }
  }

  /**
   * Initializes indexes for the users collection.
   */
  async initializeIndexes(): Promise<void> {
    try {
      const collection = await this.getCollection();
      await collection.createIndex({email: 1}, {unique: true});
      await collection.createIndex({googleId: 1}, {unique: true});
      console.log('[UserRepository] Indexes initialized successfully');
    } catch (error) {
      console.error('[UserRepository] Failed to initialize indexes:', error);
      throw new Error(
        `Failed to initialize indexes: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Finds a user by their email address.
   * @param email The email address to search for.
   * @returns The user document or null if not found.
   * @throws Error if email is invalid or database query fails.
   */
  async findByEmail(email: string): Promise<WithId<User> | null> {
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      throw new Error(`Invalid email address: ${email}`);
    }

    try {
      const collection = await this.getCollection();
      const user = await collection.findOne({email});
      return user;
    } catch (error) {
      console.error(
        `[UserRepository] Error finding user by email ${email}:`,
        error,
      );
      throw new Error(
        `Failed to find user by email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Creates a new user or updates an existing one based on email.
   * @param user The user data to save.
   * @returns The saved user document.
   * @throws Error if user data is invalid or database operation fails.
   */
  async createOrUpdateUser(
    user: Omit<User, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<WithId<User>> {
    // Validate required fields
    if (
      !user.email ||
      typeof user.email !== 'string' ||
      !user.email.includes('@')
    ) {
      throw new Error(`Invalid email address: ${user.email}`);
    }
    if (!user.googleId || typeof user.googleId !== 'string') {
      throw new Error(`Invalid googleId: ${user.googleId}`);
    }
    if (!user.name || typeof user.name !== 'string') {
      throw new Error(`Invalid name: ${user.name}`);
    }
    if (!user.tokens || typeof user.tokens !== 'object') {
      throw new Error('Invalid tokens: tokens object is required');
    }
    if (
      !user.tokens.access_token ||
      typeof user.tokens.access_token !== 'string'
    ) {
      throw new Error('Invalid tokens: access_token is required');
    }

    try {
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
        throw new Error(
          'Failed to create or update user: database returned null',
        );
      }

      console.log(
        `[UserRepository] User ${result.email} created or updated successfully`,
      );
      return result;
    } catch (error) {
      console.error(
        `[UserRepository] Error creating or updating user ${user.email}:`,
        error,
      );
      if (error instanceof Error && error.message.includes('E11000')) {
        throw new Error(
          `User with email ${user.email} already exists (duplicate key error)`,
        );
      }
      throw new Error(
        `Failed to create or update user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Updates the Google tokens for a specific user.
   * @param userId The user's ID.
   * @param tokens The new tokens.
   * @returns True if updated, false otherwise.
   * @throws Error if userId is invalid or tokens are invalid.
   */
  async updateTokens(userId: string, tokens: GoogleTokens): Promise<boolean> {
    this.validateObjectId(userId);

    // Validate tokens
    if (!tokens || typeof tokens !== 'object') {
      throw new Error('Invalid tokens: tokens object is required');
    }
    if (!tokens.access_token || typeof tokens.access_token !== 'string') {
      throw new Error('Invalid tokens: access_token is required');
    }
    if (!tokens.refresh_token || typeof tokens.refresh_token !== 'string') {
      throw new Error('Invalid tokens: refresh_token is required');
    }
    if (!tokens.expiry_date || typeof tokens.expiry_date !== 'number') {
      throw new Error('Invalid tokens: expiry_date is required');
    }

    try {
      const updated = await this.update(userId, {
        $set: {
          tokens,
          updatedAt: new Date(),
        },
      });

      if (updated) {
        console.log(
          `[UserRepository] Tokens updated successfully for user ${userId}`,
        );
      } else {
        console.warn(
          `[UserRepository] No user found with id ${userId} to update tokens`,
        );
      }

      return updated;
    } catch (error) {
      console.error(
        `[UserRepository] Error updating tokens for user ${userId}:`,
        error,
      );
      throw new Error(
        `Failed to update tokens: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Retrieves the Google tokens for a specific user.
   * @param userId The user's ID.
   * @returns The tokens or null if user not found.
   * @throws Error if userId is invalid or database query fails.
   */
  async getTokens(userId: string): Promise<GoogleTokens | null> {
    this.validateObjectId(userId);

    try {
      const user = await this.findById(userId);
      if (!user) {
        console.warn(`[UserRepository] User not found: ${userId}`);
        return null;
      }
      return user.tokens || null;
    } catch (error) {
      console.error(
        `[UserRepository] Error getting tokens for user ${userId}:`,
        error,
      );
      throw new Error(
        `Failed to get tokens: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Override findById to add validation and better error handling.
   * @param id The document ID.
   * @returns The found document or null if not found.
   * @throws Error if ID is invalid or database query fails.
   */
  async findById(id: string | ObjectId): Promise<WithId<User> | null> {
    if (typeof id === 'string') {
      this.validateObjectId(id);
    }

    try {
      return await super.findById(id);
    } catch (error) {
      console.error(`[UserRepository] Error finding user by id ${id}:`, error);
      throw new Error(
        `Failed to find user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
