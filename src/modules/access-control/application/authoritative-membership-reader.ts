import { isProxy } from 'node:util/types';

import type { AuthoritativeMembershipFactReaderV1 } from '@/modules/access-control/ports/authoritative-membership-reader';
import {
  createAuthoritativeInstitutionMembershipFactReaderV1,
  createAuthoritativeInstitutionMembershipFactRepositoryV1,
} from '@/modules/access-control/server/authoritative-membership-reader';
import { getDatabase, type TenantDatabase } from '@/server/db/client';

const authoritativeMembershipFactReaderHandlesV1 = new WeakSet<object>();

export function isAuthoritativeMembershipFactReaderV1(
  value: unknown,
): value is AuthoritativeMembershipFactReaderV1 {
  try {
    return (
      typeof value === 'object' &&
      value !== null &&
      !isProxy(value) &&
      authoritativeMembershipFactReaderHandlesV1.has(value)
    );
  } catch {
    return false;
  }
}

function createOwnerDatabaseOnce(): () => TenantDatabase {
  let state: 'pending' | 'resolved' | 'failed' = 'pending';
  let database: TenantDatabase | null = null;
  const unavailable = new Error('access_control_membership_database_unavailable');

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
 * Access Control 对外唯一组合入口。Repository、Adapter、数据库来源与 genuine Reader
 * 均由 Access Control Owner 持有；调用方不能注入 Repository、数据库或可信时钟。
 */
export function createAccessControlAuthoritativeMembershipFactReaderV1(): AuthoritativeMembershipFactReaderV1 {
  const databaseOnce = createOwnerDatabaseOnce();
  const reader = createAuthoritativeInstitutionMembershipFactReaderV1({
    repository: Object.freeze({
      findCurrentInstitutionMembershipFacts(query) {
        return createAuthoritativeInstitutionMembershipFactRepositoryV1(
          databaseOnce(),
        ).findCurrentInstitutionMembershipFacts(query);
      },
      findSingleInstitutionMembershipFacts(query) {
        const repository = createAuthoritativeInstitutionMembershipFactRepositoryV1(
          databaseOnce(),
        );
        return repository.findSingleInstitutionMembershipFacts!(query);
      },
    }),
  });
  authoritativeMembershipFactReaderHandlesV1.add(reader);
  return reader;
}
