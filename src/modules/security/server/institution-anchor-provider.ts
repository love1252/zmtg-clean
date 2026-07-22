import { isProxy } from 'node:util/types';

import { isInstitutionScopeIdV1 } from '@/modules/security/domain/institution-access';
import type {
  CurrentInstitutionAnchorFactRowV1,
  InstitutionAnchorFactRepositoryV1 as RepositoryV1,
} from '@/modules/security/server/institution-anchor-repository';

export type InstitutionAnchorFactRepositoryV1 = RepositoryV1;

export type InstitutionAnchorFactQueryV1 = Readonly<{
  tenantId: string;
  institutionId: string;
}>;

/**
 * Current authoritative database fact only. This raw owner fact is not sealed guard evidence,
 * does not contain a safe reference, and grants no section, object, action, or capability access.
 */
export type AuthoritativeInstitutionAnchorFactV1 = Readonly<{
  kind: 'current_anchor_fact';
  tenantId: string;
  institutionId: string;
  revision: number;
  observedAt: string;
}>;

export type AuthoritativeInstitutionAnchorFactResolutionV1 =
  | AuthoritativeInstitutionAnchorFactV1
  | Readonly<{
      kind: 'denied';
      code: 'institution_anchor_denied';
    }>
  | Readonly<{
      kind: 'unavailable';
      code: 'institution_anchor_unavailable';
    }>;

export type AuthoritativeInstitutionAnchorFactReaderV1 = Readonly<{
  resolve: (
    input: InstitutionAnchorFactQueryV1,
  ) => Promise<AuthoritativeInstitutionAnchorFactResolutionV1>;
}>;

const QUERY_KEYS = Object.freeze(['tenantId', 'institutionId'] as const);
const ROW_KEYS = Object.freeze([
  'tenantId',
  'institutionId',
  'status',
  'revision',
] as const satisfies readonly (keyof CurrentInstitutionAnchorFactRowV1)[]);

const denied = Object.freeze({
  kind: 'denied',
  code: 'institution_anchor_denied',
} as const);
const unavailable = Object.freeze({
  kind: 'unavailable',
  code: 'institution_anchor_unavailable',
} as const);

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
      expectedKeys.some(
        (key) => !Object.prototype.hasOwnProperty.call(descriptors, key),
      )
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
      expectedKeys.some(
        (key) => !Object.prototype.hasOwnProperty.call(descriptors, key),
      )
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

function parseQuery(value: unknown): InstitutionAnchorFactQueryV1 | null {
  const snapshot = snapshotExactPlainRecord(value, QUERY_KEYS);
  if (
    !snapshot ||
    !isInstitutionScopeIdV1(snapshot.tenantId) ||
    !isInstitutionScopeIdV1(snapshot.institutionId)
  ) {
    return null;
  }
  return Object.freeze({
    tenantId: snapshot.tenantId,
    institutionId: snapshot.institutionId,
  });
}

function resolveCurrentRow(input: {
  rowValue: unknown;
  query: InstitutionAnchorFactQueryV1;
  observedAt: string;
}): AuthoritativeInstitutionAnchorFactResolutionV1 {
  const row = snapshotExactPlainRecord(input.rowValue, ROW_KEYS);
  if (!row) return unavailable;

  if (
    !isInstitutionScopeIdV1(row.tenantId) ||
    !isInstitutionScopeIdV1(row.institutionId) ||
    row.tenantId !== input.query.tenantId ||
    row.institutionId !== input.query.institutionId
  ) {
    return unavailable;
  }

  if (row.status === 'suspended') return denied;
  if (row.status !== 'active') return unavailable;
  if (!Number.isSafeInteger(row.revision) || (row.revision as number) <= 0) {
    return unavailable;
  }

  return Object.freeze({
    kind: 'current_anchor_fact',
    tenantId: row.tenantId,
    institutionId: row.institutionId,
    revision: row.revision as number,
    observedAt: input.observedAt,
  });
}

export function createAuthoritativeInstitutionAnchorFactReaderV1(input: {
  repository: InstitutionAnchorFactRepositoryV1;
  now?: () => Date;
}): AuthoritativeInstitutionAnchorFactReaderV1 {
  const now = input.now ?? (() => new Date());

  return Object.freeze({
    async resolve(queryValue) {
      const query = parseQuery(queryValue);
      if (!query) return unavailable;

      let rowsValue: unknown;
      try {
        rowsValue = await input.repository.findCurrentInstitutionAnchorFacts(query);
      } catch {
        return unavailable;
      }

      const rows = snapshotExactRows(rowsValue);
      if (!rows) return unavailable;
      if (rows.length === 0) return denied;
      if (rows.length !== 1) return unavailable;

      let nowValue: Date;
      try {
        nowValue = now();
      } catch {
        return unavailable;
      }
      const nowEpochMs = dateEpochMs(nowValue);
      if (nowEpochMs === null) return unavailable;

      return resolveCurrentRow({
        rowValue: rows[0],
        query,
        observedAt: new Date(nowEpochMs).toISOString(),
      });
    },
  });
}
