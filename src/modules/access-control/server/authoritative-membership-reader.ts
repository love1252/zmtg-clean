import { and, eq } from 'drizzle-orm';
import { isProxy } from 'node:util/types';

import {
  isLegacyMembershipCalibrationCommandId,
  isMembershipProvenanceReasonCode,
  isRuntimeMembershipCommandId,
  MEMBERSHIP_MAX_REVISION,
} from '@/modules/access-control/domain/membership-lifecycle';
import {
  type AuthoritativeMembershipFactQueryV1,
  type AuthoritativeMembershipFactReaderV1,
  type AuthoritativeMembershipFactRejectionCodeV1,
  type AuthoritativeMembershipFactResolutionV1,
  type AuthoritativeSingleMembershipFactQueryV1,
} from '@/modules/access-control/ports/authoritative-membership-reader';
import { isInstitutionRoleV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import type { TenantDatabase } from '@/server/db/client';
import {
  authAccountInstitutionBindings,
  tenantMembers,
} from '@/server/db/schema';

export type CurrentInstitutionMembershipFactRow = Readonly<{
  accountId: string;
  membershipId: string;
  membershipTenantId: string;
  membershipUserId: string;
  membershipRole: string;
  membershipDisplayName: string;
  membershipRevision: number | null;
  membershipLifecycleStatus: string | null;
  membershipProvenanceSource: string | null;
  membershipProvenanceActorId: string | null;
  membershipProvenanceReasonCode: string | null;
  membershipProvenanceCommandId: string | null;
  membershipProvenanceOccurredAt: Date | null;
  membershipProvenanceRecordedAt: Date | null;
  membershipRevokedAt: Date | null;
  membershipDeletedAt: Date | null;
  bindingId: string | null;
  bindingAccountId: string | null;
  bindingTenantId: string | null;
  bindingInstitutionId: string | null;
  bindingStatus: string | null;
  bindingSource: string | null;
  bindingAssignedAt: Date | null;
  bindingExpiresAt: Date | null;
  bindingRevokedAt: Date | null;
  bindingVersion: number | null;
}>;

export type InstitutionMembershipFactRepositoryV1 = Readonly<{
  findCurrentInstitutionMembershipFacts(input: Readonly<{
    accountId: string;
    tenantId: string;
    institutionId: string;
  }>): Promise<readonly CurrentInstitutionMembershipFactRow[]>;
  findSingleInstitutionMembershipFacts?(input: Readonly<{
    accountId: string;
  }>): Promise<readonly CurrentInstitutionMembershipFactRow[]>;
}>;

const QUERY_KEYS = Object.freeze(['accountId', 'tenantId', 'institutionId'] as const);
const SINGLE_QUERY_KEYS = Object.freeze(['accountId'] as const);
const FACTORY_KEYS = Object.freeze(['repository'] as const);
const FACTORY_WITH_NOW_KEYS = Object.freeze(['repository', 'now'] as const);
const REPOSITORY_KEYS = Object.freeze([
  'findCurrentInstitutionMembershipFacts',
] as const);
const REPOSITORY_WITH_SINGLE_KEYS = Object.freeze([
  'findCurrentInstitutionMembershipFacts',
  'findSingleInstitutionMembershipFacts',
] as const);
const ROW_KEYS = Object.freeze([
  'accountId',
  'membershipId',
  'membershipTenantId',
  'membershipUserId',
  'membershipRole',
  'membershipDisplayName',
  'membershipRevision',
  'membershipLifecycleStatus',
  'membershipProvenanceSource',
  'membershipProvenanceActorId',
  'membershipProvenanceReasonCode',
  'membershipProvenanceCommandId',
  'membershipProvenanceOccurredAt',
  'membershipProvenanceRecordedAt',
  'membershipRevokedAt',
  'membershipDeletedAt',
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
] as const satisfies readonly (keyof CurrentInstitutionMembershipFactRow)[]);
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

function rejection(
  code: AuthoritativeMembershipFactRejectionCodeV1,
): AuthoritativeMembershipFactResolutionV1 {
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

function isCanonicalId(value: unknown, maxLength = 96): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
  );
}

function isPositiveRevision(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    Number(value) > 0 &&
    Number(value) <= MEMBERSHIP_MAX_REVISION
  );
}

function isNonProxyFunction(value: unknown): value is (...args: never[]) => unknown {
  try {
    return typeof value === 'function' && !isProxy(value);
  } catch {
    return false;
  }
}

function parseQuery(value: unknown): AuthoritativeMembershipFactQueryV1 | null {
  const snapshot = snapshotExactPlainRecord(value, QUERY_KEYS);
  if (
    !snapshot ||
    !isCanonicalId(snapshot.accountId) ||
    !isCanonicalId(snapshot.tenantId, 64) ||
    !isCanonicalId(snapshot.institutionId, 64)
  ) {
    return null;
  }
  return Object.freeze({
    accountId: snapshot.accountId,
    tenantId: snapshot.tenantId,
    institutionId: snapshot.institutionId,
  });
}

function parseSingleQuery(
  value: unknown,
): AuthoritativeSingleMembershipFactQueryV1 | null {
  const snapshot = snapshotExactPlainRecord(value, SINGLE_QUERY_KEYS);
  if (!snapshot || !isCanonicalId(snapshot.accountId)) return null;
  return Object.freeze({ accountId: snapshot.accountId });
}

function isCompleteMembershipEnvelope(
  row: Readonly<Record<string, unknown>>,
  nowEpochMs: number,
): boolean {
  if (
    !isPositiveRevision(row.membershipRevision) ||
    (row.membershipLifecycleStatus !== 'active' &&
      row.membershipLifecycleStatus !== 'revoked' &&
      row.membershipLifecycleStatus !== 'deleted') ||
    (row.membershipProvenanceSource !== 'formal_onboarding' &&
      row.membershipProvenanceSource !== 'access_control_command' &&
      row.membershipProvenanceSource !== 'legacy_calibration') ||
    !isMembershipProvenanceReasonCode(row.membershipProvenanceReasonCode)
  ) {
    return false;
  }
  const recordedAt = dateEpochMs(row.membershipProvenanceRecordedAt);
  if (recordedAt === null || recordedAt > nowEpochMs) return false;

  if (row.membershipProvenanceSource === 'legacy_calibration') {
    if (
      row.membershipRevision !== 1 ||
      row.membershipLifecycleStatus !== 'active' ||
      row.membershipProvenanceActorId !== null ||
      row.membershipProvenanceReasonCode !== 'legacy_unknown' ||
      !isLegacyMembershipCalibrationCommandId(
        row.membershipProvenanceCommandId,
      ) ||
      row.membershipProvenanceOccurredAt !== null
    ) {
      return false;
    }
  } else {
    const occurredAt = dateEpochMs(row.membershipProvenanceOccurredAt);
    if (
      !isCanonicalId(row.membershipProvenanceActorId) ||
      !isRuntimeMembershipCommandId(row.membershipProvenanceCommandId) ||
      occurredAt === null ||
      occurredAt > nowEpochMs ||
      recordedAt < occurredAt ||
      (row.membershipProvenanceSource === 'formal_onboarding' &&
        (row.membershipRevision !== 1 || row.membershipLifecycleStatus !== 'active'))
    ) {
      return false;
    }
  }

  const revokedAt =
    row.membershipRevokedAt === null ? null : dateEpochMs(row.membershipRevokedAt);
  const deletedAt =
    row.membershipDeletedAt === null ? null : dateEpochMs(row.membershipDeletedAt);
  if (row.membershipLifecycleStatus === 'active') {
    return row.membershipRevokedAt === null && row.membershipDeletedAt === null;
  }
  if (row.membershipLifecycleStatus === 'revoked') {
    return (
      Number(row.membershipRevision) >= 2 &&
      revokedAt !== null &&
      deletedAt === null &&
      revokedAt === dateEpochMs(row.membershipProvenanceOccurredAt)
    );
  }
  return (
    Number(row.membershipRevision) >= 2 &&
    deletedAt !== null &&
    deletedAt === dateEpochMs(row.membershipProvenanceOccurredAt) &&
    (revokedAt === null || revokedAt <= deletedAt)
  );
}

function isAbsentBinding(row: Readonly<Record<string, unknown>>): boolean {
  return BINDING_ALL_KEYS.every((key) => row[key] === null);
}

function hasCompleteBinding(row: Readonly<Record<string, unknown>>): boolean {
  return BINDING_REQUIRED_KEYS.every((key) => row[key] !== null);
}

function resolveCurrentRow(input: Readonly<{
  rowValue: unknown;
  query: AuthoritativeMembershipFactQueryV1;
  nowEpochMs: number;
  observedAt: string;
}>): AuthoritativeMembershipFactResolutionV1 {
  const row = snapshotExactPlainRecord(input.rowValue, ROW_KEYS);
  if (!row) return rejection('membership_invalid');
  if (
    !isCanonicalId(row.membershipId, 64) ||
    !isCanonicalId(row.accountId) ||
    !isCanonicalId(row.membershipTenantId, 64) ||
    !isCanonicalId(row.membershipUserId) ||
    !isInstitutionRoleV1(row.membershipRole) ||
    typeof row.membershipDisplayName !== 'string' ||
    !isCompleteMembershipEnvelope(row, input.nowEpochMs)
  ) {
    return rejection('membership_invalid');
  }
  if (
    row.accountId !== input.query.accountId ||
    row.membershipUserId !== input.query.accountId ||
    row.membershipTenantId !== input.query.tenantId
  ) {
    return rejection('membership_invalid');
  }
  if (row.membershipLifecycleStatus !== 'active') {
    return rejection('membership_denied');
  }
  if (isAbsentBinding(row)) return rejection('membership_denied');
  if (!hasCompleteBinding(row)) return rejection('membership_invalid');
  if (
    !isCanonicalId(row.bindingId) ||
    !isCanonicalId(row.bindingAccountId) ||
    !isCanonicalId(row.bindingTenantId, 64) ||
    !isCanonicalId(row.bindingInstitutionId, 64) ||
    !isPositiveRevision(row.bindingVersion)
  ) {
    return rejection('membership_invalid');
  }
  if (row.bindingStatus === 'revoked') return rejection('membership_denied');
  if (
    row.bindingStatus !== 'active' ||
    row.bindingAccountId !== input.query.accountId ||
    row.bindingTenantId !== row.membershipTenantId
  ) {
    return rejection('membership_invalid');
  }
  if (
    row.bindingSource !== 'manual_admin' &&
    row.bindingSource !== 'system' &&
    row.bindingSource !== 'migration_placeholder'
  ) {
    return rejection('membership_invalid');
  }
  if (
    row.bindingInstitutionId !== input.query.institutionId ||
    row.bindingSource === 'migration_placeholder'
  ) {
    return rejection('membership_denied');
  }
  const assignedAt = dateEpochMs(row.bindingAssignedAt);
  const expiresAt =
    row.bindingExpiresAt === null ? null : dateEpochMs(row.bindingExpiresAt);
  const revokedAt =
    row.bindingRevokedAt === null ? null : dateEpochMs(row.bindingRevokedAt);
  if (
    assignedAt === null ||
    (row.bindingExpiresAt !== null && expiresAt === null) ||
    (row.bindingRevokedAt !== null && revokedAt === null)
  ) {
    return rejection('membership_invalid');
  }
  if (
    assignedAt > input.nowEpochMs ||
    (expiresAt !== null && expiresAt <= input.nowEpochMs) ||
    revokedAt !== null
  ) {
    return rejection('membership_denied');
  }
  return Object.freeze({
    kind: 'current_membership_fact',
    accountId: input.query.accountId,
    tenantId: row.membershipTenantId,
    institutionId: row.bindingInstitutionId,
    role: row.membershipRole,
    membershipDisplayName: row.membershipDisplayName,
    membershipId: row.membershipId,
    membershipRevision: row.membershipRevision as number,
    membershipLifecycleStatus: 'active',
    bindingId: row.bindingId,
    bindingRevision: row.bindingVersion,
    bindingRevisionAt: new Date(assignedAt).toISOString(),
    bindingExpiresAt:
      expiresAt === null ? null : new Date(expiresAt).toISOString(),
    observedAt: input.observedAt,
  });
}

export function createAuthoritativeInstitutionMembershipFactRepositoryV1(
  database: TenantDatabase,
): InstitutionMembershipFactRepositoryV1 {
  const selection = Object.freeze({
    accountId: tenantMembers.userId,
    membershipId: tenantMembers.id,
    membershipTenantId: tenantMembers.tenantId,
    membershipUserId: tenantMembers.userId,
    membershipRole: tenantMembers.role,
    membershipDisplayName: tenantMembers.displayName,
    membershipRevision: tenantMembers.revision,
    membershipLifecycleStatus: tenantMembers.lifecycleStatus,
    membershipProvenanceSource: tenantMembers.currentProvenanceSource,
    membershipProvenanceActorId: tenantMembers.currentProvenanceActorId,
    membershipProvenanceReasonCode: tenantMembers.currentProvenanceReasonCode,
    membershipProvenanceCommandId: tenantMembers.currentProvenanceCommandId,
    membershipProvenanceOccurredAt: tenantMembers.currentProvenanceOccurredAt,
    membershipProvenanceRecordedAt: tenantMembers.currentProvenanceRecordedAt,
    membershipRevokedAt: tenantMembers.revokedAt,
    membershipDeletedAt: tenantMembers.deletedAt,
    bindingId: authAccountInstitutionBindings.id,
    bindingAccountId: authAccountInstitutionBindings.accountId,
    bindingTenantId: authAccountInstitutionBindings.tenantId,
    bindingInstitutionId: authAccountInstitutionBindings.institutionId,
    bindingStatus: authAccountInstitutionBindings.status,
    bindingSource: authAccountInstitutionBindings.source,
    bindingAssignedAt: authAccountInstitutionBindings.assignedAt,
    bindingExpiresAt: authAccountInstitutionBindings.expiresAt,
    bindingRevokedAt: authAccountInstitutionBindings.revokedAt,
    bindingVersion: authAccountInstitutionBindings.version,
  });
  return Object.freeze({
    async findCurrentInstitutionMembershipFacts(input) {
      return database
        .select(selection)
        .from(tenantMembers)
        .leftJoin(
          authAccountInstitutionBindings,
          and(
            eq(authAccountInstitutionBindings.accountId, input.accountId),
            eq(authAccountInstitutionBindings.tenantId, tenantMembers.tenantId),
            eq(
              authAccountInstitutionBindings.institutionId,
              input.institutionId,
            ),
            eq(authAccountInstitutionBindings.status, 'active'),
          ),
        )
        .where(
          and(
            eq(tenantMembers.userId, input.accountId),
            eq(tenantMembers.tenantId, input.tenantId),
          ),
        )
        .limit(2) as Promise<readonly CurrentInstitutionMembershipFactRow[]>;
    },
    async findSingleInstitutionMembershipFacts(input) {
      return database
        .select(selection)
        .from(tenantMembers)
        .leftJoin(
          authAccountInstitutionBindings,
          and(
            eq(authAccountInstitutionBindings.accountId, input.accountId),
            eq(authAccountInstitutionBindings.tenantId, tenantMembers.tenantId),
            eq(authAccountInstitutionBindings.status, 'active'),
          ),
        )
        .where(eq(tenantMembers.userId, input.accountId))
        .limit(2) as Promise<readonly CurrentInstitutionMembershipFactRow[]>;
    },
  });
}

export function createAuthoritativeInstitutionMembershipFactReaderV1(
  input: Readonly<{
    repository: InstitutionMembershipFactRepositoryV1;
    now?: () => Date;
  }>,
): AuthoritativeMembershipFactReaderV1 {
  const factory =
    snapshotExactPlainRecord(input, FACTORY_WITH_NOW_KEYS) ??
    snapshotExactPlainRecord(input, FACTORY_KEYS);
  const repository = factory
    ? snapshotExactPlainRecord(factory.repository, REPOSITORY_WITH_SINGLE_KEYS) ??
      snapshotExactPlainRecord(factory.repository, REPOSITORY_KEYS)
    : null;
  const read =
    repository && isNonProxyFunction(repository.findCurrentInstitutionMembershipFacts)
      ? (repository.findCurrentInstitutionMembershipFacts as InstitutionMembershipFactRepositoryV1['findCurrentInstitutionMembershipFacts'])
      : null;
  const readSingle =
    repository && isNonProxyFunction(repository.findSingleInstitutionMembershipFacts)
      ? (repository.findSingleInstitutionMembershipFacts as NonNullable<InstitutionMembershipFactRepositoryV1['findSingleInstitutionMembershipFacts']>)
      : null;
  const nowValue = factory?.now;
  const now =
    nowValue === undefined
      ? () => new Date()
      : isNonProxyFunction(nowValue)
        ? (nowValue as () => Date)
        : null;

  return Object.freeze({
    async resolve(queryValue: AuthoritativeMembershipFactQueryV1) {
      const query = parseQuery(queryValue);
      if (!query) return rejection('membership_invalid');
      if (!read || !now) return rejection('membership_unavailable');
      let rowsValue: unknown;
      try {
        rowsValue = await read({
          accountId: query.accountId,
          tenantId: query.tenantId,
          institutionId: query.institutionId,
        });
      } catch {
        return rejection('membership_unavailable');
      }
      const rows = snapshotExactRows(rowsValue);
      if (!rows) return rejection('membership_invalid');
      if (rows.length === 0) return rejection('membership_denied');
      if (rows.length !== 1) return rejection('membership_invalid');
      let nowDate: Date;
      try {
        nowDate = now();
      } catch {
        return rejection('membership_unavailable');
      }
      const nowEpochMs = dateEpochMs(nowDate);
      if (nowEpochMs === null) return rejection('membership_invalid');
      return resolveCurrentRow({
        rowValue: rows[0],
        query,
        nowEpochMs,
        observedAt: new Date(nowEpochMs).toISOString(),
      });
    },
    async resolveSingleForAccount(
      queryValue: AuthoritativeSingleMembershipFactQueryV1,
    ) {
      const query = parseSingleQuery(queryValue);
      if (!query) return rejection('membership_invalid');
      if (!readSingle || !now) return rejection('membership_unavailable');
      let rowsValue: unknown;
      try {
        rowsValue = await readSingle({ accountId: query.accountId });
      } catch {
        return rejection('membership_unavailable');
      }
      const rows = snapshotExactRows(rowsValue);
      if (!rows) return rejection('membership_invalid');
      if (rows.length === 0) return rejection('membership_denied');
      if (rows.length !== 1) return rejection('membership_invalid');
      const row = snapshotExactPlainRecord(rows[0], ROW_KEYS);
      if (!row) return rejection('membership_invalid');
      if (
        !isCanonicalId(row.membershipTenantId, 64) ||
        !isCanonicalId(row.bindingInstitutionId, 64)
      ) {
        return isAbsentBinding(row)
          ? rejection('membership_denied')
          : rejection('membership_invalid');
      }
      let nowDate: Date;
      try {
        nowDate = now();
      } catch {
        return rejection('membership_unavailable');
      }
      const nowEpochMs = dateEpochMs(nowDate);
      if (nowEpochMs === null) return rejection('membership_invalid');
      return resolveCurrentRow({
        rowValue: rows[0],
        query: Object.freeze({
          accountId: query.accountId,
          tenantId: row.membershipTenantId,
          institutionId: row.bindingInstitutionId,
        }),
        nowEpochMs,
        observedAt: new Date(nowEpochMs).toISOString(),
      });
    },
  }) as AuthoritativeMembershipFactReaderV1;
}
