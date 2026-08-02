import { and, eq } from 'drizzle-orm';
import { isProxy } from 'node:util/types';

import type {
  AuthoritativeInstitutionScopeFactQueryV1,
  AuthoritativeInstitutionScopeFactReaderV1,
  AuthoritativeInstitutionScopeFactRejectionCodeV1,
  AuthoritativeInstitutionScopeFactResolutionV1,
} from '@/modules/tenancy/ports/authoritative-institution-scope-reader';
import type { TenantDatabase } from '@/server/db/client';
import { institutionScopes } from '@/server/db/schema';

export type CurrentInstitutionScopeFactRowV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  status: string;
  revision: number;
}>;

export type InstitutionScopeFactRepositoryV1 = Readonly<{
  findCurrentInstitutionScopeFacts: (
    input: AuthoritativeInstitutionScopeFactQueryV1,
  ) => Promise<readonly CurrentInstitutionScopeFactRowV1[]>;
}>;

const QUERY_KEYS = Object.freeze(['tenantId', 'institutionId'] as const);
const ROW_KEYS = Object.freeze([
  'tenantId',
  'institutionId',
  'status',
  'revision',
] as const);
const FACTORY_KEYS = Object.freeze(['repository'] as const);
const FACTORY_WITH_NOW_KEYS = Object.freeze(['repository', 'now'] as const);
const REPOSITORY_KEYS = Object.freeze(['findCurrentInstitutionScopeFacts'] as const);

function reject(
  code: AuthoritativeInstitutionScopeFactRejectionCodeV1,
): AuthoritativeInstitutionScopeFactResolutionV1 {
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

function isCanonicalId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 64 &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
  );
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
): AuthoritativeInstitutionScopeFactQueryV1 | null {
  const snapshot = snapshotExactPlainRecord(value, QUERY_KEYS);
  if (
    !snapshot ||
    !isCanonicalId(snapshot.tenantId) ||
    !isCanonicalId(snapshot.institutionId)
  ) {
    return null;
  }
  return Object.freeze({
    tenantId: snapshot.tenantId,
    institutionId: snapshot.institutionId,
  });
}

export function createAuthoritativeInstitutionScopeFactRepositoryV1(
  database: TenantDatabase,
): InstitutionScopeFactRepositoryV1 {
  return Object.freeze({
    async findCurrentInstitutionScopeFacts(input) {
      return database
        .select({
          tenantId: institutionScopes.tenantId,
          institutionId: institutionScopes.institutionId,
          status: institutionScopes.status,
          revision: institutionScopes.revision,
        })
        .from(institutionScopes)
        .where(
          and(
            eq(institutionScopes.tenantId, input.tenantId),
            eq(institutionScopes.institutionId, input.institutionId),
          ),
        )
        .limit(2) as Promise<readonly CurrentInstitutionScopeFactRowV1[]>;
    },
  });
}

export function createAuthoritativeInstitutionScopeFactReaderV1(
  input: Readonly<{
    repository: InstitutionScopeFactRepositoryV1;
    now?: () => Date;
  }>,
): AuthoritativeInstitutionScopeFactReaderV1 {
  const factory =
    snapshotExactPlainRecord(input, FACTORY_WITH_NOW_KEYS) ??
    snapshotExactPlainRecord(input, FACTORY_KEYS);
  const repository = factory
    ? snapshotExactPlainRecord(factory.repository, REPOSITORY_KEYS)
    : null;
  const read =
    repository && isNonProxyFunction(repository.findCurrentInstitutionScopeFacts)
      ? (repository.findCurrentInstitutionScopeFacts as InstitutionScopeFactRepositoryV1['findCurrentInstitutionScopeFacts'])
      : null;
  const nowValue = factory?.now;
  const now =
    nowValue === undefined
      ? () => new Date()
      : isNonProxyFunction(nowValue)
        ? (nowValue as () => Date)
        : null;

  return Object.freeze({
    async resolve(queryValue: AuthoritativeInstitutionScopeFactQueryV1) {
      const query = parseQuery(queryValue);
      if (!query) return reject('scope_invalid');
      if (!read || !now) return reject('scope_unavailable');
      let rowsValue: unknown;
      try {
        rowsValue = await read(query);
      } catch {
        return reject('scope_unavailable');
      }
      const rows = snapshotExactRows(rowsValue);
      if (!rows) return reject('scope_invalid');
      if (rows.length === 0) return reject('scope_denied');
      if (rows.length !== 1) return reject('scope_invalid');
      const row = snapshotExactPlainRecord(rows[0], ROW_KEYS);
      if (
        !row ||
        !isCanonicalId(row.tenantId) ||
        !isCanonicalId(row.institutionId) ||
        (row.status !== 'active' && row.status !== 'suspended') ||
        !Number.isSafeInteger(row.revision) ||
        Number(row.revision) <= 0 ||
        row.tenantId !== query.tenantId ||
        row.institutionId !== query.institutionId
      ) {
        return reject('scope_invalid');
      }
      if (row.status !== 'active') return reject('scope_denied');
      let nowValueResult: Date;
      try {
        nowValueResult = now();
      } catch {
        return reject('scope_unavailable');
      }
      const nowEpochMs = dateEpochMs(nowValueResult);
      if (nowEpochMs === null) return reject('scope_invalid');
      return Object.freeze({
        kind: 'current_scope_fact',
        tenantId: query.tenantId,
        institutionId: query.institutionId,
        status: 'active',
        revision: row.revision as number,
        observedAt: new Date(nowEpochMs).toISOString(),
      });
    },
  });
}
