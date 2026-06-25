import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbClientMocks = vi.hoisted(() => {
  let clientSequence = 0;
  let databaseSequence = 0;

  return {
    drizzle: vi.fn((client: unknown) => ({
      client,
      databaseId: `database-${++databaseSequence}`,
    })),
    postgres: vi.fn(() => ({
      clientId: `client-${++clientSequence}`,
    })),
    resetSequences() {
      clientSequence = 0;
      databaseSequence = 0;
    },
  };
});

vi.mock('postgres', () => ({
  default: dbClientMocks.postgres,
}));

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: dbClientMocks.drizzle,
}));

const originalDatabaseUrl = process.env.DATABASE_URL;

describe('数据库客户端缓存', () => {
  beforeEach(() => {
    vi.resetModules();
    dbClientMocks.postgres.mockClear();
    dbClientMocks.drizzle.mockClear();
    dbClientMocks.resetSequences();
    process.env.DATABASE_URL = 'postgres://local-test-redacted';
  });

  afterEach(() => {
    vi.resetModules();
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it('在模块重载后仍复用进程级 postgres client 和 drizzle database', async () => {
    const firstModule = await import('@/server/db/client');
    const firstDatabase = firstModule.getDatabase();

    expect(firstModule.getDatabase()).toBe(firstDatabase);
    expect(dbClientMocks.postgres).toHaveBeenCalledTimes(1);
    expect(dbClientMocks.drizzle).toHaveBeenCalledTimes(1);

    vi.resetModules();
    const reloadedModule = await import('@/server/db/client');

    expect(reloadedModule.getDatabase()).toBe(firstDatabase);
    expect(dbClientMocks.postgres).toHaveBeenCalledTimes(1);
    expect(dbClientMocks.drizzle).toHaveBeenCalledTimes(1);
  });
});
