import { isProxy } from 'node:util/types';

import {
  isAuthAccountStatus,
} from '@/modules/auth/domain/auth-account';
import { isAuthRole } from '@/modules/auth/domain/session';
import type {
  AuthAccountInstitutionMembershipFactRepository,
  CurrentInstitutionMembershipFactRow,
} from '@/modules/auth/server/auth-account-repository';
import {
  isInstitutionRoleV1,
  type InstitutionRoleV1,
} from '@/modules/institution-contracts/v1/institution-navigation';
import { isInstitutionScopeIdV1 } from '@/modules/security/domain/institution-access';
import type { MembershipRejectionCodeV1 } from '@/modules/security/server/institution-guard-evidence';

export type InstitutionMembershipFactRepositoryV1 =
  AuthAccountInstitutionMembershipFactRepository;

export type InstitutionMembershipFactQueryV1 = Readonly<{
  accountId: string;
  tenantId: string;
  institutionId: string;
}>;

/**
 * Current authoritative database facts only. This value is not owner-sealed evidence and grants
 * no institution, section, object, action, or capability access. A later owner composition root
 * must independently issue safe references before constructing guard evidence.
 */
export type AuthoritativeInstitutionMembershipFactV1 = Readonly<{
  kind: 'current_membership_fact';
  accountId: string;
  tenantId: string;
  institutionId: string;
  role: InstitutionRoleV1;
  membershipId: string;
  membershipRevisionAt: string;
  bindingId: string;
  bindingRevision: number;
  bindingExpiresAt: string | null;
  observedAt: string;
}>;

type InstitutionMembershipFactRejectionCodeV1 = Extract<
  MembershipRejectionCodeV1,
  'membership_denied' | 'membership_invalid' | 'membership_unavailable'
>;

export type AuthoritativeInstitutionMembershipFactResolutionV1 =
  | AuthoritativeInstitutionMembershipFactV1
  | Readonly<{
      kind: 'rejected';
      code: InstitutionMembershipFactRejectionCodeV1;
    }>;

export type AuthoritativeInstitutionMembershipFactReaderV1 = Readonly<{
  resolve: (
    input: InstitutionMembershipFactQueryV1,
  ) => Promise<AuthoritativeInstitutionMembershipFactResolutionV1>;
}>;

const QUERY_KEYS = Object.freeze([
  'accountId',
  'tenantId',
  'institutionId',
] as const);

const ROW_KEYS = Object.freeze([
  'accountId',
  'accountStatus',
  'accountPasswordResetRequired',
  'accountLockedUntil',
  'membershipId',
  'membershipTenantId',
  'membershipUserId',
  'membershipRole',
  'membershipUpdatedAt',
  'bindingId',
  'bindingAccountId',
  'bindingTenantId',
  'bindingInstitutionId',
  'bindingStatus',
  'bindingSource',
  'bindingAssignedAt',
  'bindingExpiresAt',
  'bindingRevokedAt',
  'bindingVersion',
] as const);

const BINDING_REQUIRED_KEYS = Object.freeze([
  'bindingId',
  'bindingAccountId',
  'bindingTenantId',
  'bindingInstitutionId',
  'bindingStatus',
  'bindingSource',
  'bindingAssignedAt',
  'bindingVersion',
] as const satisfies readonly (keyof CurrentInstitutionMembershipFactRow)[]);

const BINDING_ALL_KEYS = Object.freeze([
  ...BINDING_REQUIRED_KEYS,
  'bindingExpiresAt',
  'bindingRevokedAt',
] as const satisfies readonly (keyof CurrentInstitutionMembershipFactRow)[]);

function reject(
  code: InstitutionMembershipFactRejectionCodeV1,
): AuthoritativeInstitutionMembershipFactResolutionV1 {
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

function isAbsentBinding(
  row: Readonly<Record<string, unknown>>,
): boolean {
  return BINDING_ALL_KEYS.every((key) => row[key] === null);
}

function hasCompleteBinding(
  row: Readonly<Record<string, unknown>>,
): boolean {
  return BINDING_REQUIRED_KEYS.every((key) => row[key] !== null);
}

function parseQuery(value: unknown): InstitutionMembershipFactQueryV1 | null {
  const snapshot = snapshotExactPlainRecord(value, QUERY_KEYS);
  if (
    !snapshot ||
    !isInstitutionScopeIdV1(snapshot.accountId) ||
    !isInstitutionScopeIdV1(snapshot.tenantId) ||
    !isInstitutionScopeIdV1(snapshot.institutionId)
  ) {
    return null;
  }
  return Object.freeze({
    accountId: snapshot.accountId,
    tenantId: snapshot.tenantId,
    institutionId: snapshot.institutionId,
  });
}

function resolveCurrentRow(input: {
  rowValue: unknown;
  query: InstitutionMembershipFactQueryV1;
  nowEpochMs: number;
  observedAt: string;
}): AuthoritativeInstitutionMembershipFactResolutionV1 {
  const row = snapshotExactPlainRecord(input.rowValue, ROW_KEYS);
  if (!row) return reject('membership_invalid');

  if (
    !isInstitutionScopeIdV1(row.accountId) ||
    !isAuthAccountStatus(row.accountStatus) ||
    typeof row.accountPasswordResetRequired !== 'boolean' ||
    !isInstitutionScopeIdV1(row.membershipId) ||
    !isInstitutionScopeIdV1(row.membershipTenantId) ||
    !isInstitutionScopeIdV1(row.membershipUserId) ||
    !isAuthRole(row.membershipRole)
  ) {
    return reject('membership_invalid');
  }

  const membershipUpdatedAt = dateEpochMs(row.membershipUpdatedAt);
  const accountLockedUntil =
    row.accountLockedUntil === null ? null : dateEpochMs(row.accountLockedUntil);
  if (
    membershipUpdatedAt === null ||
    membershipUpdatedAt > input.nowEpochMs ||
    (row.accountLockedUntil !== null && accountLockedUntil === null)
  ) {
    return reject('membership_invalid');
  }

  if (
    row.accountId !== input.query.accountId ||
    row.membershipUserId !== row.accountId ||
    row.membershipTenantId !== input.query.tenantId
  ) {
    return reject('membership_invalid');
  }

  if (
    row.accountStatus !== 'active' ||
    row.accountPasswordResetRequired ||
    (accountLockedUntil !== null && accountLockedUntil > input.nowEpochMs)
  ) {
    return reject('membership_denied');
  }

  if (!isInstitutionRoleV1(row.membershipRole)) {
    return reject('membership_denied');
  }

  if (isAbsentBinding(row)) return reject('membership_denied');
  if (!hasCompleteBinding(row)) return reject('membership_invalid');

  if (
    !isInstitutionScopeIdV1(row.bindingId) ||
    !isInstitutionScopeIdV1(row.bindingAccountId) ||
    !isInstitutionScopeIdV1(row.bindingTenantId) ||
    !isInstitutionScopeIdV1(row.bindingInstitutionId) ||
    !Number.isInteger(row.bindingVersion) ||
    (row.bindingVersion as number) <= 0
  ) {
    return reject('membership_invalid');
  }

  if (row.bindingStatus === 'revoked') {
    return reject('membership_denied');
  }
  if (
    row.bindingStatus !== 'active' ||
    row.bindingAccountId !== row.accountId ||
    row.bindingTenantId !== row.membershipTenantId
  ) {
    return reject('membership_invalid');
  }

  if (
    row.bindingSource !== 'manual_admin' &&
    row.bindingSource !== 'system' &&
    row.bindingSource !== 'migration_placeholder'
  ) {
    return reject('membership_invalid');
  }
  if (
    row.bindingInstitutionId !== input.query.institutionId ||
    row.bindingSource === 'migration_placeholder'
  ) {
    return reject('membership_denied');
  }

  const bindingAssignedAt = dateEpochMs(row.bindingAssignedAt);
  const bindingExpiresAt =
    row.bindingExpiresAt === null ? null : dateEpochMs(row.bindingExpiresAt);
  const bindingRevokedAt =
    row.bindingRevokedAt === null ? null : dateEpochMs(row.bindingRevokedAt);
  if (
    bindingAssignedAt === null ||
    (row.bindingExpiresAt !== null && bindingExpiresAt === null) ||
    (row.bindingRevokedAt !== null && bindingRevokedAt === null)
  ) {
    return reject('membership_invalid');
  }
  if (
    bindingAssignedAt > input.nowEpochMs ||
    (bindingExpiresAt !== null && bindingExpiresAt <= input.nowEpochMs) ||
    bindingRevokedAt !== null
  ) {
    return reject('membership_denied');
  }

  return Object.freeze({
    kind: 'current_membership_fact',
    accountId: row.accountId,
    tenantId: row.membershipTenantId,
    institutionId: row.bindingInstitutionId,
    role: row.membershipRole,
    membershipId: row.membershipId,
    membershipRevisionAt: new Date(membershipUpdatedAt).toISOString(),
    bindingId: row.bindingId,
    bindingRevision: row.bindingVersion as number,
    bindingExpiresAt:
      bindingExpiresAt === null ? null : new Date(bindingExpiresAt).toISOString(),
    observedAt: input.observedAt,
  });
}

export function createAuthoritativeInstitutionMembershipFactReaderV1(input: {
  repository: InstitutionMembershipFactRepositoryV1;
  now?: () => Date;
}): AuthoritativeInstitutionMembershipFactReaderV1 {
  const now = input.now ?? (() => new Date());

  return Object.freeze({
    async resolve(queryValue) {
      const query = parseQuery(queryValue);
      if (!query) return reject('membership_invalid');

      let rowsValue: unknown;
      try {
        rowsValue = await input.repository.findCurrentInstitutionMembershipFacts({
          accountId: query.accountId,
          tenantId: query.tenantId,
        });
      } catch {
        return reject('membership_unavailable');
      }

      const rows = snapshotExactRows(rowsValue);
      if (!rows) return reject('membership_invalid');
      if (rows.length === 0) return reject('membership_denied');
      if (rows.length !== 1) return reject('membership_invalid');

      let nowValue: Date;
      try {
        nowValue = now();
      } catch {
        return reject('membership_unavailable');
      }
      const nowEpochMs = dateEpochMs(nowValue);
      if (nowEpochMs === null) return reject('membership_invalid');

      return resolveCurrentRow({
        rowValue: rows[0],
        query,
        nowEpochMs,
        observedAt: new Date(nowEpochMs).toISOString(),
      });
    },
  });
}
