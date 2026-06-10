import { Client, Databases, Storage, Users } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID || '')
  .setKey(process.env.APPWRITE_API_KEY || '');

export const databases = new Databases(client);
export const storage = new Storage(client);
export const users = new Users(client);

export const DB_ID = process.env.APPWRITE_DB_ID || 'nestor_db';
export const COLLECTIONS = {
  APPOINTMENTS: process.env.APPWRITE_COLLECTION_APPOINTMENTS || 'appointments',
  TICKETS: process.env.APPWRITE_COLLECTION_TICKETS || 'tickets',
};
export const BUCKETS = {
  DOCUMENTS: process.env.APPWRITE_BUCKET_DOCUMENTS || 'documents',
};
