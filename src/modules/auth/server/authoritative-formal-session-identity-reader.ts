import { eq } from 'drizzle-orm';
import { isProxy } from 'node:util/types';

import { isAuthAccountStatus } from '@/modules/auth/domain/auth-account';
import type {
  AuthoritativeFormalSessionIdentityFactQueryV1,
  AuthoritativeFormalSessionIdentityFactReaderV1,
  AuthoritativeFormalSessionIdentityFactRejectionCodeV1,
  AuthoritativeFormalSessionIdentityFactResolutionV1,
} from '@/modules/auth/ports/authoritative-formal-session-identity-reader';
import { isInstitutionScopeIdV1 } from '@/modules/security/domain/institution-access';
import type { TenantDatabase } from '@/server/db/client';
import { authUsers } from '@/server/db/schema';

export type CurrentFormalSessionIdentityFactRowV1 = Readonly<{
  accountId: string;
  username: string;
  displayName: string;
  status: string;
  passwordResetRequired: boolean;
  lockedUntil: Date | null;
}>;

export type FormalSessionIdentityFactRepositoryV1 = Readonly<{
  findCurrentFormalSessionIdentityFacts: (
    input: AuthoritativeFormalSessionIdentityFactQueryV1,
  ) => Promise<readonly CurrentFormalSessionIdentityFactRowV1[]>;
}>;

const QUERY_KEYS = Object.freeze(['accountId'] as const);
const ROW_KEYS = Object.freeze([
  'accountId',
  'username',
  'displayName',
  'status',
  'passwordResetRequired',
  'lockedUntil',
] as const satisfies readonly (keyof CurrentFormalSessionIdentityFactRowV1)[]);
const FACTORY_KEYS = Object.freeze(['repository'] as const);
const FACTORY_WITH_NOW_KEYS = Object.freeze(['repository', 'now'] as const);
const REPOSITORY_KEYS = Object.freeze([
  'findCurrentFormalSessionIdentityFacts',
] as const);

function reject(
  code: AuthoritativeFormalSessionIdentityFactRejectionCodeV1,
): AuthoritativeFormalSessionIdentityFactResolutionV1 {
  return Object.freeze({ kind: 'rejected', code });
}

function snapshotExactPlainRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.length !== expectedKeys.length ||
      ownKeys.some((key) => typeof key !== 'string') ||
      expectedKeys.some((key) => !Object.hasOwn(descriptors, key))
    ) {
      return null;
    }
    const snapshot: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        return null;
      }
      Object.defineProperty(snapshot, key, {
        value: descriptor.value,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function snapshotExactRows(value: unknown): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Array.prototype ||
      value.length > 2
    ) {
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const expectedKeys = [
      ...Array.from({ length: value.length }, (_, index) => String(index)),
      'length',
    ];
    if (
      Reflect.ownKeys(descriptors).length !== expectedKeys.length ||
      expectedKeys.some((key) => !Object.hasOwn(descriptors, key))
    ) {
      return null;
    }
    const rows: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        return null;
      }
      rows.push(descriptor.value);
    }
    return Object.freeze(rows);
  } catch {
    return null;
  }
}

function isNonProxyFunction(value: unknown): value is (...args: never[]) => unknown {
  try {
    return typeof value === 'function' && !isProxy(value);
  } catch {
    return false;
  }
}

function dateEpochMs(value: unknown): number | null {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Date.prototype
    ) {
      return null;
    }
    const epochMs = Date.prototype.getTime.call(value);
    return Number.isFinite(epochMs) ? epochMs : null;
  } catch {
    return null;
  }
}

function parseQuery(
  value: unknown,
): AuthoritativeFormalSessionIdentityFactQueryV1 | null {
  const snapshot = snapshotExactPlainRecord(value, QUERY_KEYS);
  if (!snapshot || !isInstitutionScopeIdV1(snapshot.accountId)) return null;
  return Object.freeze({ accountId: snapshot.accountId });
}

export function createAuthoritativeFormalSessionIdentityFactRepositoryV1(
  database: TenantDatabase,
): FormalSessionIdentityFactRepositoryV1 {
  return Object.freeze({
    async findCurrentFormalSessionIdentityFacts(input) {
      return database
        .select({
          accountId: authUsers.id,
          username: authUsers.username,
          displayName: authUsers.displayName,
          status: authUsers.status,
          passwordResetRequired: authUsers.passwordResetRequired,
          lockedUntil: authUsers.lockedUntil,
        })
        .from(authUsers)
        .where(eq(authUsers.id, input.accountId))
        .limit(2) as Promise<CurrentFormalSessionIdentityFactRowV1[]>;
    },
  });
}

export function createAuthoritativeFormalSessionIdentityFactReaderV1(input: Readonly<{
  repository: FormalSessionIdentityFactRepositoryV1;
  now?: () => Date;
}>): AuthoritativeFormalSessionIdentityFactReaderV1 {
  const factory =
    snapshotExactPlainRecord(input, FACTORY_WITH_NOW_KEYS) ??
    snapshotExactPlainRecord(input, FACTORY_KEYS);
  const repository = factory
    ? snapshotExactPlainRecord(factory.repository, REPOSITORY_KEYS)
    : null;
  const read =
    repository &&
    isNonProxyFunction(repository.findCurrentFormalSessionIdentityFacts)
      ? (repository.findCurrentFormalSessionIdentityFacts as FormalSessionIdentityFactRepositoryV1['findCurrentFormalSessionIdentityFacts'])
      : null;
  const nowValue = factory?.now;
  const now =
    nowValue === undefined
      ? () => new Date()
      : isNonProxyFunction(nowValue)
        ? (nowValue as () => Date)
        : null;

  return Object.freeze({
    async resolve(queryValue: AuthoritativeFormalSessionIdentityFactQueryV1) {
      const query = parseQuery(queryValue);
      if (!query) return reject('identity_invalid');
      if (!read || !now) return reject('identity_unavailable');

      let rowsValue: unknown;
      let nowEpochMs: number | null;
      try {
        rowsValue = await read(query);
        nowEpochMs = dateEpochMs(now());
      } catch {
        return reject('identity_unavailable');
      }
      if (nowEpochMs === null) return reject('identity_invalid');
      const rows = snapshotExactRows(rowsValue);
      if (!rows) return reject('identity_invalid');
      if (rows.length === 0) return reject('identity_denied');
      if (rows.length !== 1) return reject('identity_invalid');
      const row = snapshotExactPlainRecord(rows[0], ROW_KEYS);
      const lockedUntil =
        row?.lockedUntil === null ? null : dateEpochMs(row?.lockedUntil);
      if (
        !row ||
        row.accountId !== query.accountId ||
        !isInstitutionScopeIdV1(row.accountId) ||
        typeof row.username !== 'string' ||
        row.username.length === 0 ||
        typeof row.displayName !== 'string' ||
        !isAuthAccountStatus(row.status) ||
        typeof row.passwordResetRequired !== 'boolean' ||
        (row.lockedUntil !== null && lockedUntil === null)
      ) {
        return reject('identity_invalid');
      }
      if (
        row.status !== 'active' ||
        row.passwordResetRequired ||
        (lockedUntil !== null && lockedUntil > nowEpochMs)
      ) {
        return reject('identity_denied');
      }
      return Object.freeze({
        kind: 'current_identity_fact',
        accountId: row.accountId,
        username: row.username,
        displayName: row.displayName,
        status: 'active',
        observedAt: new Date(nowEpochMs).toISOString(),
      });
    },
  });
}
