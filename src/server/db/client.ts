import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/server/db/schema';

export function createDatabaseUrlErrorMessage() {
  return 'DATABASE_URL is required to use tenant persistence';
}

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(createDatabaseUrlErrorMessage());
  }
  return url;
}

export function createPostgresClient(databaseUrl = getDatabaseUrl()) {
  return postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });
}

export function createDatabase(client = createPostgresClient()) {
  return drizzle(client, { schema });
}

export type TenantDatabase = ReturnType<typeof createDatabase>;

let cachedClient: ReturnType<typeof createPostgresClient> | null = null;
let cachedDatabase: TenantDatabase | null = null;

export function getDatabase() {
  if (!cachedClient) {
    cachedClient = createPostgresClient();
  }
  if (!cachedDatabase) {
    cachedDatabase = createDatabase(cachedClient);
  }
  return cachedDatabase;
}
