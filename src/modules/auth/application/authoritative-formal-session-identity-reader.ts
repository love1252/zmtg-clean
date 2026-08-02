import { isProxy } from 'node:util/types';

import type { AuthoritativeFormalSessionIdentityFactReaderV1 } from '@/modules/auth/ports/authoritative-formal-session-identity-reader';
import {
  createAuthoritativeFormalSessionIdentityFactReaderV1,
  createAuthoritativeFormalSessionIdentityFactRepositoryV1,
} from '@/modules/auth/server/authoritative-formal-session-identity-reader';
import { getDatabase, type TenantDatabase } from '@/server/db/client';

const authoritativeFormalSessionIdentityFactReaderHandlesV1 =
  new WeakSet<object>();

export function isAuthoritativeFormalSessionIdentityFactReaderV1(
  value: unknown,
): value is AuthoritativeFormalSessionIdentityFactReaderV1 {
  try {
    return (
      typeof value === 'object' &&
      value !== null &&
      !isProxy(value) &&
      authoritativeFormalSessionIdentityFactReaderHandlesV1.has(value)
    );
  } catch {
    return false;
  }
}

function createOwnerDatabaseOnce(): () => TenantDatabase {
  let state: 'pending' | 'resolved' | 'failed' = 'pending';
  let database: TenantDatabase | null = null;
  const unavailable = new Error('identity_database_unavailable');

  return () => {
    if (state === 'resolved') return database as TenantDatabase;
    if (state === 'failed') throw unavailable;
    state = 'failed';
    try {
      const candidate: unknown = getDatabase();
      if (
        candidate === null ||
        (typeof candidate !== 'object' && typeof candidate !== 'function') ||
        isProxy(candidate)
      ) {
        throw unavailable;
      }
      database = candidate as TenantDatabase;
      state = 'resolved';
      return database;
    } catch {
      throw unavailable;
    }
  };
}

/**
 * Identity 对外唯一 active-account 读取入口。数据库、Repository 与可信时钟均由
 * Identity Owner 持有；调用方不能注入账号事实或时钟后获得 genuine handle。
 */
export function createIdentityAuthoritativeFormalSessionIdentityFactReaderV1(): AuthoritativeFormalSessionIdentityFactReaderV1 {
  const databaseOnce = createOwnerDatabaseOnce();
  const reader = createAuthoritativeFormalSessionIdentityFactReaderV1({
    repository: Object.freeze({
      findCurrentFormalSessionIdentityFacts(query) {
        return createAuthoritativeFormalSessionIdentityFactRepositoryV1(
          databaseOnce(),
        ).findCurrentFormalSessionIdentityFacts(query);
      },
    }),
  });
  authoritativeFormalSessionIdentityFactReaderHandlesV1.add(reader);
  return reader;
}
