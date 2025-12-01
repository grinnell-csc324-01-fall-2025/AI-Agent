import {ObjectId} from 'mongodb';

/**
 * Interface representing Google OAuth tokens.
 */
export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

/**
 * Interface representing a User in the database.
 */
export interface User {
  _id?: ObjectId;
  email: string;
  googleId: string;
  name: string;
  picture?: string;
  tokens: GoogleTokens;
  createdAt: Date;
  updatedAt: Date;
}
