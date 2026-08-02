import { createHash } from 'node:crypto';
import { isProxy } from 'node:util/types';

import { isAuthoritativeMembershipFactReaderV1 } from '@/modules/access-control/application/authoritative-membership-reader';
import { MEMBERSHIP_MAX_REVISION } from '@/modules/access-control/domain/membership-lifecycle';
import {
  type AuthoritativeMembershipFactReaderV1,
  type AuthoritativeMembershipFactRejectionCodeV1,
  type AuthoritativeMembershipFactV1,
} from '@/modules/access-control/ports/authoritative-membership-reader';
import { isAuthoritativeFormalSessionIdentityFactReaderV1 } from '@/modules/auth/application/authoritative-formal-session-identity-reader';
import type {
  AuthoritativeFormalSessionIdentityFactReaderV1,
  AuthoritativeFormalSessionIdentityFactV1,
} from '@/modules/auth/ports/authoritative-formal-session-identity-reader';
import { isInstitutionRoleV1 } from '@/modules/institution-contracts/v1/institution-navigation';
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
import {
  isInstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceOwnerSubjectV1,
} from '@/modules/security/server/institution-guard-reference';

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
const MEMBERSHIP_EVIDENCE_TTL_MS = 60_000;
const AUTH_ACCOUNT_OWNER_DOMAIN = 'zmtg.auth-account.v1';
const MEMBERSHIP_OWNER_DOMAIN = 'access-control.membership.v1';
const REQUEST_BOUND_FACT_KEYS = Object.freeze([
  'kind',
  'accountId',
  'tenantId',
  'institutionId',
  'role',
  'membershipDisplayName',
  'membershipId',
  'membershipRevision',
  'membershipLifecycleStatus',
  'bindingId',
  'bindingRevision',
  'bindingRevisionAt',
  'bindingExpiresAt',
  'observedAt',
] as const);
const REQUEST_BOUND_REJECTION_KEYS = Object.freeze(['kind', 'code'] as const);
const IDENTITY_FACT_KEYS = Object.freeze([
  'kind',
  'accountId',
  'username',
  'displayName',
  'status',
  'observedAt',
] as const);
const REQUEST_BOUND_RESOLVE_KEYS = Object.freeze([
  'provenance',
  'requestedScope',
] as const);
const REQUESTED_SCOPE_KEYS = Object.freeze(['tenantId', 'institutionId'] as const);
const REQUEST_BOUND_FACTORY_KEYS = Object.freeze([
  'accountId',
  'identityFactReader',
  'factReader',
  'referenceCodec',
] as const);
const REQUEST_BOUND_FACTORY_WITH_NOW_KEYS = Object.freeze([
  ...REQUEST_BOUND_FACTORY_KEYS,
  'now',
] as const);
const FACT_READER_KEYS = Object.freeze([
  'resolve',
  'resolveSingleForAccount',
] as const);
const IDENTITY_READER_KEYS = Object.freeze(['resolve'] as const);
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

type AuthoritativeInstitutionMembershipFactV1 = AuthoritativeMembershipFactV1;
type AuthoritativeInstitutionMembershipFactReaderV1 =
  AuthoritativeMembershipFactReaderV1;
type InstitutionMembershipFactRejectionCodeV1 =
  AuthoritativeMembershipFactRejectionCodeV1;

type ParsedRequestBoundFactV1 = AuthoritativeMembershipFactV1 &
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

type ParsedIdentityResolutionV1 =
  | Readonly<{
      kind: 'fact';
      fact: AuthoritativeFormalSessionIdentityFactV1;
    }>
  | Readonly<{
      kind: 'rejected';
      code: 'membership_denied' | 'membership_invalid' | 'membership_unavailable';
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
  const bindingRevisionAtEpochMs = parseCanonicalUtcEpochMs(
    snapshot.bindingRevisionAt,
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
    typeof snapshot.membershipDisplayName !== 'string' ||
    !isInstitutionScopeIdV1(snapshot.membershipId) ||
    !isPositiveSafeInteger(snapshot.membershipRevision) ||
    snapshot.membershipRevision > MEMBERSHIP_MAX_REVISION ||
    snapshot.membershipLifecycleStatus !== 'active' ||
    !isInstitutionScopeIdV1(snapshot.bindingId) ||
    !isPositiveSafeInteger(snapshot.bindingRevision) ||
    bindingRevisionAtEpochMs === null ||
    observedAtEpochMs === null ||
    (bindingRevisionAtEpochMs !== null &&
      observedAtEpochMs !== null &&
      bindingRevisionAtEpochMs > observedAtEpochMs) ||
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
      membershipDisplayName: snapshot.membershipDisplayName,
      membershipId: snapshot.membershipId,
      membershipRevision: snapshot.membershipRevision,
      membershipLifecycleStatus: 'active',
      bindingId: snapshot.bindingId,
      bindingRevision: snapshot.bindingRevision,
      bindingRevisionAt: snapshot.bindingRevisionAt as string,
      bindingExpiresAt: snapshot.bindingExpiresAt as string | null,
      observedAt: snapshot.observedAt as string,
      observedAtEpochMs,
      bindingExpiresAtEpochMs,
    }),
  });
}

function parseIdentityResolution(
  value: unknown,
  accountId: string,
): ParsedIdentityResolutionV1 | null {
  const rejection = snapshotExactPlainRecord(value, REQUEST_BOUND_REJECTION_KEYS);
  if (rejection?.kind === 'rejected') {
    if (rejection.code === 'identity_denied') {
      return Object.freeze({ kind: 'rejected', code: 'membership_denied' });
    }
    if (rejection.code === 'identity_unavailable') {
      return Object.freeze({ kind: 'rejected', code: 'membership_unavailable' });
    }
    if (rejection.code === 'identity_invalid') {
      return Object.freeze({ kind: 'rejected', code: 'membership_invalid' });
    }
    return null;
  }
  const fact = snapshotExactPlainRecord(value, IDENTITY_FACT_KEYS);
  if (
    !fact ||
    fact.kind !== 'current_identity_fact' ||
    fact.accountId !== accountId ||
    !isInstitutionScopeIdV1(fact.accountId) ||
    typeof fact.username !== 'string' ||
    fact.username.length === 0 ||
    typeof fact.displayName !== 'string' ||
    fact.status !== 'active' ||
    parseCanonicalUtcEpochMs(fact.observedAt) === null
  ) {
    return null;
  }
  return Object.freeze({
    kind: 'fact',
    fact: Object.freeze({
      kind: 'current_identity_fact',
      accountId: fact.accountId,
      username: fact.username,
      displayName: fact.displayName,
      status: 'active',
      observedAt: fact.observedAt as string,
    }),
  });
}

function sameIdentityFact(
  first: AuthoritativeFormalSessionIdentityFactV1,
  second: AuthoritativeFormalSessionIdentityFactV1,
): boolean {
  return (
    first.accountId === second.accountId &&
    first.username === second.username &&
    first.displayName === second.displayName &&
    first.status === second.status
  );
}

function sameMembershipAuthorizationFact(
  first: ParsedRequestBoundFactV1,
  second: ParsedRequestBoundFactV1,
): boolean {
  return (
    first.accountId === second.accountId &&
    first.tenantId === second.tenantId &&
    first.institutionId === second.institutionId &&
    first.role === second.role &&
    first.membershipDisplayName === second.membershipDisplayName &&
    first.membershipId === second.membershipId &&
    first.membershipRevision === second.membershipRevision &&
    first.membershipLifecycleStatus === second.membershipLifecycleStatus &&
    first.bindingId === second.bindingId &&
    first.bindingRevision === second.bindingRevision &&
    first.bindingRevisionAt === second.bindingRevisionAt &&
    first.bindingExpiresAt === second.bindingExpiresAt
  );
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
  verify: InstitutionGuardReferenceCodecV1['verify'],
  input: Readonly<{
    prefix: Prefix;
    ownerDomain: string;
    tenantId: string | null;
    institutionId: string | null;
    ownerSubject: InstitutionGuardReferenceOwnerSubjectV1;
  }>,
): ReferenceIssueResultV1<Prefix> {
  const canonicalInput = Object.freeze({
    prefix: input.prefix,
    ownerDomain: input.ownerDomain,
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    ownerSubject: input.ownerSubject,
  });
  let value: unknown;
  try {
    value = issue(canonicalInput);
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
  const reference = snapshot.reference;
  let verification: unknown;
  try {
    verification = verify(Object.freeze({
      ...canonicalInput,
      reference,
    }));
  } catch {
    return Object.freeze({ kind: 'unavailable' });
  }
  const verificationKind = readOwnDataKind(verification);
  if (verificationKind === 'unavailable') {
    const unavailableSnapshot = snapshotExactPlainRecord(verification, [
      'kind',
      'code',
    ]);
    return unavailableSnapshot?.code === 'guard_reference_unavailable'
      ? Object.freeze({ kind: 'unavailable' })
      : Object.freeze({ kind: 'invalid' });
  }
  if (verificationKind !== 'verified') {
    return Object.freeze({ kind: 'invalid' });
  }
  const verifiedSnapshot = snapshotExactPlainRecord(verification, [
    'kind',
    'reference',
  ]);
  if (
    !verifiedSnapshot ||
    verifiedSnapshot.reference !== reference ||
    !isGuardReferenceCandidateV1(verifiedSnapshot.reference, input.prefix) ||
    !isFullAcceptedReferenceProfile(verifiedSnapshot.reference, input.prefix)
  ) {
    return Object.freeze({ kind: 'invalid' });
  }
  return Object.freeze({
    kind: 'issued',
    reference: verifiedSnapshot.reference as unknown as SafeGuardReferenceV1<Prefix>,
  });
}

function membershipReject(
  code: MembershipRejectionCodeV1,
): FreshActiveMembershipResolutionV1 {
  return Object.freeze({ kind: 'rejected', code });
}

const freshActiveMembershipProviderHandlesV1 = new WeakSet<object>();

export function isFreshActiveMembershipProviderV1(
  value: unknown,
): value is FreshActiveMembershipProviderV1 {
  try {
    return (
      typeof value === 'object' &&
      value !== null &&
      !isProxy(value) &&
      freshActiveMembershipProviderHandlesV1.has(value)
    );
  } catch {
    return false;
  }
}

/**
 * Composes request-bound membership evidence. The factory belongs inside the auth composition
 * root: it captures the canonical non-PII account ID once, while public resolve accepts only
 * sealed provenance plus the requested institution scope.
 */
export function createRequestBoundFreshActiveMembershipProviderV1(input: Readonly<{
  accountId: string;
  identityFactReader: AuthoritativeFormalSessionIdentityFactReaderV1;
  factReader: AuthoritativeInstitutionMembershipFactReaderV1;
  referenceCodec: InstitutionGuardReferenceCodecV1;
  now?: () => Date;
}>): FreshActiveMembershipProviderV1 {
  const factorySnapshot =
    snapshotExactPlainRecord(input, REQUEST_BOUND_FACTORY_WITH_NOW_KEYS) ??
    snapshotExactPlainRecord(input, REQUEST_BOUND_FACTORY_KEYS);
  const factReaderIsGenuine =
    factorySnapshot !== null &&
    isAuthoritativeMembershipFactReaderV1(factorySnapshot.factReader);
  const identityFactReaderIsGenuine =
    factorySnapshot !== null &&
    isAuthoritativeFormalSessionIdentityFactReaderV1(
      factorySnapshot.identityFactReader,
    );
  const referenceCodecIsGenuine =
    factorySnapshot !== null &&
    isInstitutionGuardReferenceCodecV1(factorySnapshot.referenceCodec);
  const factReaderSnapshot = factReaderIsGenuine
    ? snapshotExactPlainRecord(factorySnapshot?.factReader, FACT_READER_KEYS)
    : null;
  const identityFactReaderSnapshot = identityFactReaderIsGenuine
    ? snapshotExactPlainRecord(
        factorySnapshot?.identityFactReader,
        IDENTITY_READER_KEYS,
      )
    : null;
  const codecSnapshot = referenceCodecIsGenuine
    ? snapshotExactPlainRecord(factorySnapshot?.referenceCodec, REFERENCE_CODEC_KEYS)
    : null;
  const accountId =
    factorySnapshot && isInstitutionScopeIdV1(factorySnapshot.accountId)
      ? factorySnapshot.accountId
      : null;
  const resolveFact =
    factReaderSnapshot && isNonProxyFunction(factReaderSnapshot.resolve)
      ? (factReaderSnapshot.resolve as AuthoritativeInstitutionMembershipFactReaderV1['resolve'])
      : null;
  const resolveIdentity =
    identityFactReaderSnapshot &&
    isNonProxyFunction(identityFactReaderSnapshot.resolve)
      ? (identityFactReaderSnapshot.resolve as AuthoritativeFormalSessionIdentityFactReaderV1['resolve'])
      : null;
  const issue =
    codecSnapshot && isNonProxyFunction(codecSnapshot.issue)
      ? (codecSnapshot.issue as InstitutionGuardReferenceCodecV1['issue'])
      : null;
  const verify =
    codecSnapshot && isNonProxyFunction(codecSnapshot.verify)
      ? (codecSnapshot.verify as InstitutionGuardReferenceCodecV1['verify'])
      : null;
  const nowValue =
    identityFactReaderIsGenuine && factReaderIsGenuine && referenceCodecIsGenuine
    ? factorySnapshot?.now
    : null;
  const now =
    !identityFactReaderIsGenuine || !factReaderIsGenuine || !referenceCodecIsGenuine
      ? null
      : nowValue === undefined
      ? () => new Date()
      : isNonProxyFunction(nowValue)
        ? (nowValue as () => Date)
        : null;

  const provider = Object.freeze({
    async resolve(
      value: Parameters<FreshActiveMembershipProviderV1['resolve']>[0],
    ) {
      const request = parseRequestBoundResolveInput(value);
      if (!request) return membershipReject('membership_invalid');
      if (
        !accountId ||
        !resolveIdentity ||
        !resolveFact ||
        !issue ||
        !verify ||
        !now
      ) {
        return membershipReject('membership_unavailable');
      }

      let firstIdentityValue: unknown;
      try {
        firstIdentityValue = await resolveIdentity({ accountId });
      } catch {
        return membershipReject('membership_unavailable');
      }
      const firstIdentity = parseIdentityResolution(
        firstIdentityValue,
        accountId,
      );
      if (!firstIdentity) return membershipReject('membership_invalid');
      if (firstIdentity.kind === 'rejected') {
        return membershipReject(firstIdentity.code);
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
        String(fact.membershipRevision),
        fact.membershipLifecycleStatus,
        fact.role,
      ]);
      const bindingRevisionSubject = digestOwnerSubject('brv', [
        fact.bindingId,
        String(fact.bindingRevision),
        fact.bindingRevisionAt,
        fact.bindingExpiresAt === null
          ? 'binding-expires-at:null'
          : `binding-expires-at:value:${fact.bindingExpiresAt}`,
      ]);
      if (!membershipRevisionSubject || !bindingRevisionSubject) {
        return membershipReject('membership_unavailable');
      }

      const userReference = issueOwnedReference(issue, verify, {
        prefix: 'usr',
        ownerDomain: AUTH_ACCOUNT_OWNER_DOMAIN,
        tenantId: null,
        institutionId: null,
        ownerSubject: ownerSubject(accountId),
      });
      const membershipReference = issueOwnedReference(issue, verify, {
        prefix: 'mbr',
        ownerDomain: MEMBERSHIP_OWNER_DOMAIN,
        tenantId: fact.tenantId,
        institutionId: null,
        ownerSubject: ownerSubject(fact.membershipId),
      });
      const membershipRevision = issueOwnedReference(issue, verify, {
        prefix: 'mrv',
        ownerDomain: MEMBERSHIP_OWNER_DOMAIN,
        tenantId: fact.tenantId,
        institutionId: null,
        ownerSubject: membershipRevisionSubject,
      });
      const bindingReference = issueOwnedReference(issue, verify, {
        prefix: 'bnd',
        ownerDomain: MEMBERSHIP_OWNER_DOMAIN,
        tenantId: fact.tenantId,
        institutionId: fact.institutionId,
        ownerSubject: ownerSubject(fact.bindingId),
      });
      const bindingRevision = issueOwnedReference(issue, verify, {
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

      let secondRawFact: unknown;
      try {
        secondRawFact = await resolveFact({
          accountId,
          tenantId: request.tenantId,
          institutionId: request.institutionId,
        });
      } catch {
        return membershipReject('membership_unavailable');
      }
      const secondParsed = parseRequestBoundFactResolution(secondRawFact, {
        accountId,
        tenantId: request.tenantId,
        institutionId: request.institutionId,
      });
      if (!secondParsed) return membershipReject('membership_invalid');
      if (secondParsed.kind === 'rejected') {
        return membershipReject(secondParsed.code);
      }
      if (!sameMembershipAuthorizationFact(fact, secondParsed.fact)) {
        return membershipReject('membership_stale');
      }

      let secondIdentityValue: unknown;
      try {
        secondIdentityValue = await resolveIdentity({ accountId });
      } catch {
        return membershipReject('membership_unavailable');
      }
      const secondIdentity = parseIdentityResolution(
        secondIdentityValue,
        accountId,
      );
      if (!secondIdentity) return membershipReject('membership_invalid');
      if (secondIdentity.kind === 'rejected') {
        return membershipReject(secondIdentity.code);
      }
      if (!sameIdentityFact(firstIdentity.fact, secondIdentity.fact)) {
        return membershipReject('membership_stale');
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
  freshActiveMembershipProviderHandlesV1.add(provider);
  return provider;
}
