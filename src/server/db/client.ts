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

type DatabaseGlobalCache = {
  database: TenantDatabase | null;
  databaseUrl: string | null;
  postgresClient: ReturnType<typeof createPostgresClient> | null;
};

const databaseGlobalCacheKey = '__zmtgDatabaseCache';

function getDatabaseGlobalCache() {
  const globalWithDatabaseCache = globalThis as typeof globalThis & {
    __zmtgDatabaseCache?: DatabaseGlobalCache;
  };

  globalWithDatabaseCache[databaseGlobalCacheKey] ??= {
    database: null,
    databaseUrl: null,
    postgresClient: null,
  };

  return globalWithDatabaseCache[databaseGlobalCacheKey];
}

export function getDatabase() {
  const databaseUrl = getDatabaseUrl();
  const cache = getDatabaseGlobalCache();

  if (!cache.postgresClient || cache.databaseUrl !== databaseUrl) {
    cache.postgresClient = createPostgresClient(databaseUrl);
    cache.database = null;
    cache.databaseUrl = databaseUrl;
  }

  if (!cache.database) {
    cache.database = createDatabase(cache.postgresClient);
  }

  return cache.database;
}
