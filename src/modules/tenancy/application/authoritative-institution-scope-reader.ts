import { isProxy } from 'node:util/types';

import type { AuthoritativeInstitutionScopeFactReaderV1 } from '@/modules/tenancy/ports/authoritative-institution-scope-reader';
import {
  createAuthoritativeInstitutionScopeFactReaderV1,
  createAuthoritativeInstitutionScopeFactRepositoryV1,
} from '@/modules/tenancy/server/authoritative-institution-scope-reader';
import { getDatabase, type TenantDatabase } from '@/server/db/client';

const authoritativeInstitutionScopeFactReaderHandlesV1 = new WeakSet<object>();

export function isAuthoritativeInstitutionScopeFactReaderV1(
  value: unknown,
): value is AuthoritativeInstitutionScopeFactReaderV1 {
  try {
    return (
      typeof value === 'object' &&
      value !== null &&
      !isProxy(value) &&
      authoritativeInstitutionScopeFactReaderHandlesV1.has(value)
    );
  } catch {
    return false;
  }
}

function createOwnerDatabaseOnce(): () => TenantDatabase {
  let state: 'pending' | 'resolved' | 'failed' = 'pending';
  let database: TenantDatabase | null = null;
  const unavailable = new Error('tenancy_scope_database_unavailable');

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

export function createTenancyAuthoritativeInstitutionScopeFactReaderV1(): AuthoritativeInstitutionScopeFactReaderV1 {
  const databaseOnce = createOwnerDatabaseOnce();
  const reader = createAuthoritativeInstitutionScopeFactReaderV1({
    repository: Object.freeze({
      findCurrentInstitutionScopeFacts(query) {
        return createAuthoritativeInstitutionScopeFactRepositoryV1(
          databaseOnce(),
        ).findCurrentInstitutionScopeFacts(query);
      },
    }),
  });
  authoritativeInstitutionScopeFactReaderHandlesV1.add(reader);
  return reader;
}
