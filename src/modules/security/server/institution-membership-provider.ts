import { createHash } from 'node:crypto';
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
import {
  INSTITUTION_GUARD_ACCEPTED_KEY_VERSIONS_V1,
  isGuardReferenceCandidateV1,
  parseRequestProvenanceEvidenceCandidateV1,
  type FormalRequestProvenanceEvidenceV1,
  type FreshActiveMembershipEvidenceV1,
  type FreshActiveMembershipProviderV1,
  type FreshActiveMembershipResolutionV1,
  type InstitutionGuardReferencePrefixV1,
  type MembershipRejectionCodeV1,
  type SafeGuardReferenceV1,
} from '@/modules/security/server/institution-guard-evidence';
import type {
  InstitutionGuardReferenceCodecV1,
  InstitutionGuardReferenceOwnerSubjectV1,
} from '@/modules/security/server/institution-guard-reference';

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

const MEMBERSHIP_EVIDENCE_TTL_MS = 60_000;
const AUTH_ACCOUNT_OWNER_DOMAIN = 'zmtg.auth-account.v1';
const MEMBERSHIP_OWNER_DOMAIN = 'security.institution-membership';
const REQUEST_BOUND_FACT_KEYS = Object.freeze([
  'kind',
  'accountId',
  'tenantId',
  'institutionId',
  'role',
  'membershipId',
  'membershipRevisionAt',
  'bindingId',
  'bindingRevision',
  'bindingExpiresAt',
  'observedAt',
] as const);
const REQUEST_BOUND_REJECTION_KEYS = Object.freeze(['kind', 'code'] as const);
const REQUEST_BOUND_RESOLVE_KEYS = Object.freeze([
  'provenance',
  'requestedScope',
] as const);
const REQUESTED_SCOPE_KEYS = Object.freeze(['tenantId', 'institutionId'] as const);
const REQUEST_BOUND_FACTORY_KEYS = Object.freeze([
  'accountId',
  'factReader',
  'referenceCodec',
] as const);
const REQUEST_BOUND_FACTORY_WITH_NOW_KEYS = Object.freeze([
  ...REQUEST_BOUND_FACTORY_KEYS,
  'now',
] as const);
const FACT_READER_KEYS = Object.freeze(['resolve'] as const);
const REFERENCE_CODEC_KEYS = Object.freeze(['issue', 'verify'] as const);
const CANONICAL_UTC_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const FULL_REFERENCE_PROFILE =
  /^([a-z]+)_v1_k([1-9][0-9]{0,2})_([A-Za-z0-9_-]{43})$/u;
const OWNER_SUBJECT_PROTOCOL = 'zmtg.institution-membership-owner-subject.v1';

type ParsedRequestBoundResolveInputV1 = Readonly<{
  provenance: NonNullable<
    ReturnType<typeof parseRequestProvenanceEvidenceCandidateV1>
  >;
  tenantId: string;
  institutionId: string;
}>;

type ParsedRequestBoundFactV1 = AuthoritativeInstitutionMembershipFactV1 &
  Readonly<{
    observedAtEpochMs: number;
    bindingExpiresAtEpochMs: number | null;
  }>;

type ParsedFactResolutionV1 =
  | Readonly<{ kind: 'fact'; fact: ParsedRequestBoundFactV1 }>
  | Readonly<{
      kind: 'rejected';
      code: InstitutionMembershipFactRejectionCodeV1;
    }>;

type ReferenceIssueResultV1<Prefix extends InstitutionGuardReferencePrefixV1> =
  | Readonly<{ kind: 'issued'; reference: SafeGuardReferenceV1<Prefix> }>
  | Readonly<{ kind: 'invalid' }>
  | Readonly<{ kind: 'unavailable' }>;

function parseCanonicalUtcEpochMs(value: unknown): number | null {
  if (typeof value !== 'string' || !CANONICAL_UTC_INSTANT.test(value)) return null;
  const epochMs = Date.parse(value);
  if (!Number.isFinite(epochMs) || new Date(epochMs).toISOString() !== value) {
    return null;
  }
  return epochMs;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isNonProxyFunction(value: unknown): value is (...args: never[]) => unknown {
  try {
    return typeof value === 'function' && !isProxy(value);
  } catch {
    return false;
  }
}

function readOwnDataKind(value: unknown): unknown {
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
    const descriptor = Object.getOwnPropertyDescriptor(value, 'kind');
    return descriptor && 'value' in descriptor ? descriptor.value : null;
  } catch {
    return null;
  }
}

function parseRequestBoundResolveInput(
  value: unknown,
): ParsedRequestBoundResolveInputV1 | null {
  const snapshot = snapshotExactPlainRecord(value, REQUEST_BOUND_RESOLVE_KEYS);
  if (!snapshot) return null;
  const requestedScope = snapshotExactPlainRecord(
    snapshot.requestedScope,
    REQUESTED_SCOPE_KEYS,
  );
  const provenance = parseRequestProvenanceEvidenceCandidateV1(
    snapshot.provenance,
  );
  if (
    !requestedScope ||
    !provenance ||
    !isInstitutionScopeIdV1(requestedScope.tenantId) ||
    !isInstitutionScopeIdV1(requestedScope.institutionId) ||
    provenance.tenantId !== requestedScope.tenantId ||
    provenance.institutionId !== requestedScope.institutionId
  ) {
    return null;
  }
  return Object.freeze({
    provenance,
    tenantId: requestedScope.tenantId,
    institutionId: requestedScope.institutionId,
  });
}

function parseRequestBoundFactResolution(
  value: unknown,
  expected: Readonly<{
    accountId: string;
    tenantId: string;
    institutionId: string;
  }>,
): ParsedFactResolutionV1 | null {
  const kind = readOwnDataKind(value);
  if (kind === 'rejected') {
    const snapshot = snapshotExactPlainRecord(value, REQUEST_BOUND_REJECTION_KEYS);
    if (
      !snapshot ||
      (snapshot.code !== 'membership_denied' &&
        snapshot.code !== 'membership_invalid' &&
        snapshot.code !== 'membership_unavailable')
    ) {
      return null;
    }
    return Object.freeze({ kind: 'rejected', code: snapshot.code });
  }
  if (kind !== 'current_membership_fact') return null;

  const snapshot = snapshotExactPlainRecord(value, REQUEST_BOUND_FACT_KEYS);
  if (!snapshot) return null;
  const observedAtEpochMs = parseCanonicalUtcEpochMs(snapshot.observedAt);
  const membershipRevisionAtEpochMs = parseCanonicalUtcEpochMs(
    snapshot.membershipRevisionAt,
  );
  const bindingExpiresAtEpochMs =
    snapshot.bindingExpiresAt === null
      ? null
      : parseCanonicalUtcEpochMs(snapshot.bindingExpiresAt);
  if (
    snapshot.accountId !== expected.accountId ||
    snapshot.tenantId !== expected.tenantId ||
    snapshot.institutionId !== expected.institutionId ||
    !isInstitutionScopeIdV1(snapshot.accountId) ||
    !isInstitutionScopeIdV1(snapshot.tenantId) ||
    !isInstitutionScopeIdV1(snapshot.institutionId) ||
    !isInstitutionRoleV1(snapshot.role) ||
    !isInstitutionScopeIdV1(snapshot.membershipId) ||
    membershipRevisionAtEpochMs === null ||
    !isInstitutionScopeIdV1(snapshot.bindingId) ||
    !isPositiveSafeInteger(snapshot.bindingRevision) ||
    observedAtEpochMs === null ||
    (membershipRevisionAtEpochMs !== null &&
      observedAtEpochMs !== null &&
      membershipRevisionAtEpochMs > observedAtEpochMs) ||
    (snapshot.bindingExpiresAt !== null && bindingExpiresAtEpochMs === null)
  ) {
    return null;
  }

  return Object.freeze({
    kind: 'fact',
    fact: Object.freeze({
      kind: 'current_membership_fact',
      accountId: snapshot.accountId,
      tenantId: snapshot.tenantId,
      institutionId: snapshot.institutionId,
      role: snapshot.role,
      membershipId: snapshot.membershipId,
      membershipRevisionAt: snapshot.membershipRevisionAt as string,
      bindingId: snapshot.bindingId,
      bindingRevision: snapshot.bindingRevision,
      bindingExpiresAt: snapshot.bindingExpiresAt as string | null,
      observedAt: snapshot.observedAt as string,
      observedAtEpochMs,
      bindingExpiresAtEpochMs,
    }),
  });
}

function readTrustedNowEpochMs(now: (() => Date) | null): number | null {
  if (!now) return null;
  try {
    return dateEpochMs(now());
  } catch {
    return null;
  }
}

function ownerSubject(value: string | number): InstitutionGuardReferenceOwnerSubjectV1 {
  return String(value) as InstitutionGuardReferenceOwnerSubjectV1;
}

function digestOwnerSubject(
  label: 'mrv' | 'brv',
  fields: readonly string[],
): InstitutionGuardReferenceOwnerSubjectV1 | null {
  try {
    const encodedFields = [OWNER_SUBJECT_PROTOCOL, label, ...fields].map((field) =>
      Buffer.from(field, 'utf8'),
    );
    const byteLength = encodedFields.reduce(
      (total, field) => total + 4 + field.byteLength,
      0,
    );
    const message = Buffer.allocUnsafe(byteLength);
    let offset = 0;
    for (const field of encodedFields) {
      message.writeUInt32BE(field.byteLength, offset);
      offset += 4;
      field.copy(message, offset);
      offset += field.byteLength;
    }
    const digest = createHash('sha256').update(message).digest('base64url');
    return ownerSubject(`${label}-v1-${digest}`);
  } catch {
    return null;
  }
}

function isFullAcceptedReferenceProfile(
  value: unknown,
  expectedPrefix: InstitutionGuardReferencePrefixV1,
): value is string {
  if (typeof value !== 'string') return false;
  const match = FULL_REFERENCE_PROFILE.exec(value);
  if (!match || match[1] !== expectedPrefix) return false;
  const keyVersion = Number(match[2]);
  const tag = match[3];
  if (
    !INSTITUTION_GUARD_ACCEPTED_KEY_VERSIONS_V1.some(
      (accepted) => accepted === keyVersion,
    ) ||
    !tag
  ) {
    return false;
  }
  try {
    const decoded = Buffer.from(tag, 'base64url');
    return decoded.byteLength === 32 && decoded.toString('base64url') === tag;
  } catch {
    return false;
  }
}

function issueOwnedReference<Prefix extends InstitutionGuardReferencePrefixV1>(
  issue: InstitutionGuardReferenceCodecV1['issue'],
  input: Readonly<{
    prefix: Prefix;
    ownerDomain: string;
    tenantId: string | null;
    institutionId: string | null;
    ownerSubject: InstitutionGuardReferenceOwnerSubjectV1;
  }>,
): ReferenceIssueResultV1<Prefix> {
  let value: unknown;
  try {
    value = issue(input);
  } catch {
    return Object.freeze({ kind: 'unavailable' });
  }
  const kind = readOwnDataKind(value);
  if (kind === 'unavailable') {
    const snapshot = snapshotExactPlainRecord(value, ['kind', 'code']);
    return snapshot?.code === 'guard_reference_unavailable'
      ? Object.freeze({ kind: 'unavailable' })
      : Object.freeze({ kind: 'invalid' });
  }
  if (kind !== 'issued') return Object.freeze({ kind: 'invalid' });
  const snapshot = snapshotExactPlainRecord(value, ['kind', 'reference']);
  if (
    !snapshot ||
    !isGuardReferenceCandidateV1(snapshot.reference, input.prefix) ||
    !isFullAcceptedReferenceProfile(snapshot.reference, input.prefix)
  ) {
    return Object.freeze({ kind: 'invalid' });
  }
  return Object.freeze({
    kind: 'issued',
    reference: snapshot.reference as unknown as SafeGuardReferenceV1<Prefix>,
  });
}

function membershipReject(
  code: MembershipRejectionCodeV1,
): FreshActiveMembershipResolutionV1 {
  return Object.freeze({ kind: 'rejected', code });
}

/**
 * Composes request-bound membership evidence. The factory belongs inside the auth composition
 * root: it captures the canonical non-PII account ID once, while public resolve accepts only
 * sealed provenance plus the requested institution scope.
 */
export function createRequestBoundFreshActiveMembershipProviderV1(input: Readonly<{
  accountId: string;
  factReader: AuthoritativeInstitutionMembershipFactReaderV1;
  referenceCodec: InstitutionGuardReferenceCodecV1;
  now?: () => Date;
}>): FreshActiveMembershipProviderV1 {
  const factorySnapshot =
    snapshotExactPlainRecord(input, REQUEST_BOUND_FACTORY_WITH_NOW_KEYS) ??
    snapshotExactPlainRecord(input, REQUEST_BOUND_FACTORY_KEYS);
  const factReaderSnapshot = factorySnapshot
    ? snapshotExactPlainRecord(factorySnapshot.factReader, FACT_READER_KEYS)
    : null;
  const codecSnapshot = factorySnapshot
    ? snapshotExactPlainRecord(factorySnapshot.referenceCodec, REFERENCE_CODEC_KEYS)
    : null;
  const accountId =
    factorySnapshot && isInstitutionScopeIdV1(factorySnapshot.accountId)
      ? factorySnapshot.accountId
      : null;
  const resolveFact =
    factReaderSnapshot && isNonProxyFunction(factReaderSnapshot.resolve)
      ? (factReaderSnapshot.resolve as AuthoritativeInstitutionMembershipFactReaderV1['resolve'])
      : null;
  const issue =
    codecSnapshot && isNonProxyFunction(codecSnapshot.issue)
      ? (codecSnapshot.issue as InstitutionGuardReferenceCodecV1['issue'])
      : null;
  const verify =
    codecSnapshot && isNonProxyFunction(codecSnapshot.verify)
      ? (codecSnapshot.verify as InstitutionGuardReferenceCodecV1['verify'])
      : null;
  const nowValue = factorySnapshot?.now;
  const now =
    nowValue === undefined
      ? () => new Date()
      : isNonProxyFunction(nowValue)
        ? (nowValue as () => Date)
        : null;

  return Object.freeze({
    async resolve(
      value: Parameters<FreshActiveMembershipProviderV1['resolve']>[0],
    ) {
      const request = parseRequestBoundResolveInput(value);
      if (!request) return membershipReject('membership_invalid');
      if (!accountId || !resolveFact || !issue || !verify || !now) {
        return membershipReject('membership_unavailable');
      }

      let rawFact: unknown;
      try {
        rawFact = await resolveFact({
          accountId,
          tenantId: request.tenantId,
          institutionId: request.institutionId,
        });
      } catch {
        return membershipReject('membership_unavailable');
      }
      const parsed = parseRequestBoundFactResolution(rawFact, {
        accountId,
        tenantId: request.tenantId,
        institutionId: request.institutionId,
      });
      if (!parsed) return membershipReject('membership_invalid');
      if (parsed.kind === 'rejected') return membershipReject(parsed.code);

      const preIssueNowEpochMs = readTrustedNowEpochMs(now);
      if (preIssueNowEpochMs === null) {
        return membershipReject('membership_unavailable');
      }
      const fact = parsed.fact;
      if (fact.observedAtEpochMs > preIssueNowEpochMs) {
        return membershipReject('membership_invalid');
      }
      const evidenceExpiresAt = Math.min(
        fact.observedAtEpochMs + MEMBERSHIP_EVIDENCE_TTL_MS,
        fact.bindingExpiresAtEpochMs ?? Number.POSITIVE_INFINITY,
      );
      if (!Number.isFinite(evidenceExpiresAt)) {
        return membershipReject('membership_invalid');
      }
      if (evidenceExpiresAt <= preIssueNowEpochMs) {
        return membershipReject('membership_stale');
      }

      const membershipRevisionSubject = digestOwnerSubject('mrv', [
        fact.membershipId,
        fact.membershipRevisionAt,
        fact.role,
      ]);
      const bindingRevisionSubject = digestOwnerSubject('brv', [
        fact.bindingId,
        String(fact.bindingRevision),
        fact.bindingExpiresAt === null
          ? 'binding-expires-at:null'
          : `binding-expires-at:value:${fact.bindingExpiresAt}`,
      ]);
      if (!membershipRevisionSubject || !bindingRevisionSubject) {
        return membershipReject('membership_unavailable');
      }

      const userReference = issueOwnedReference(issue, {
        prefix: 'usr',
        ownerDomain: AUTH_ACCOUNT_OWNER_DOMAIN,
        tenantId: null,
        institutionId: null,
        ownerSubject: ownerSubject(accountId),
      });
      const membershipReference = issueOwnedReference(issue, {
        prefix: 'mbr',
        ownerDomain: MEMBERSHIP_OWNER_DOMAIN,
        tenantId: fact.tenantId,
        institutionId: null,
        ownerSubject: ownerSubject(fact.membershipId),
      });
      const membershipRevision = issueOwnedReference(issue, {
        prefix: 'mrv',
        ownerDomain: MEMBERSHIP_OWNER_DOMAIN,
        tenantId: fact.tenantId,
        institutionId: null,
        ownerSubject: membershipRevisionSubject,
      });
      const bindingReference = issueOwnedReference(issue, {
        prefix: 'bnd',
        ownerDomain: MEMBERSHIP_OWNER_DOMAIN,
        tenantId: fact.tenantId,
        institutionId: fact.institutionId,
        ownerSubject: ownerSubject(fact.bindingId),
      });
      const bindingRevision = issueOwnedReference(issue, {
        prefix: 'brv',
        ownerDomain: MEMBERSHIP_OWNER_DOMAIN,
        tenantId: fact.tenantId,
        institutionId: fact.institutionId,
        ownerSubject: bindingRevisionSubject,
      });
      const references = [
        userReference,
        membershipReference,
        membershipRevision,
        bindingReference,
        bindingRevision,
      ] as const;
      if (references.some((reference) => reference.kind === 'unavailable')) {
        return membershipReject('membership_unavailable');
      }
      if (references.some((reference) => reference.kind !== 'issued')) {
        return membershipReject('membership_invalid');
      }
      if (
        userReference.kind !== 'issued' ||
        String(userReference.reference) !== String(request.provenance.userReference)
      ) {
        return membershipReject('membership_invalid');
      }

      const postIssueNowEpochMs = readTrustedNowEpochMs(now);
      if (
        postIssueNowEpochMs === null ||
        postIssueNowEpochMs < preIssueNowEpochMs
      ) {
        return membershipReject('membership_unavailable');
      }
      if (postIssueNowEpochMs >= evidenceExpiresAt) {
        return membershipReject('membership_stale');
      }
      if (
        membershipReference.kind !== 'issued' ||
        membershipRevision.kind !== 'issued' ||
        bindingReference.kind !== 'issued' ||
        bindingRevision.kind !== 'issued'
      ) {
        return membershipReject('membership_invalid');
      }

      return Object.freeze({
        kind: 'fresh_active',
        userReference: userReference.reference,
        role: fact.role,
        tenantId: fact.tenantId,
        institutionId: fact.institutionId,
        membershipReference: membershipReference.reference,
        membershipRevision: membershipRevision.reference,
        bindingReference: bindingReference.reference,
        bindingRevision: bindingRevision.reference,
        observedAt: fact.observedAt,
        freshUntil: new Date(evidenceExpiresAt).toISOString(),
      }) as unknown as FreshActiveMembershipEvidenceV1;
    },
  }) as unknown as FreshActiveMembershipProviderV1;
}
