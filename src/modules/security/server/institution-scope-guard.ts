import { isProxy } from 'node:util/types';

import {
  ALL_INSTITUTION_ACCESS_ROLES_V1,
  authorizeInstitutionScopeV1,
  isInstitutionAccessContextSourceV1,
  isInstitutionScopeIdV1,
  type InstitutionAccessContextSourceV1,
} from '@/modules/security/domain/institution-access';
import { isInstitutionRoleV1, type InstitutionRoleV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import { resolveInstitutionAccessContextV1 } from '@/modules/security/server/institution-access-context';
import {
  INSTITUTION_GUARD_ACCEPTED_KEY_VERSIONS_V1,
  MEMBERSHIP_REJECTION_CODES_V1,
  PROVENANCE_REJECTION_CODES_V1,
  type ActiveInstitutionAnchorEvidenceV1,
  type ActiveInstitutionAnchorProviderV1,
  type AnchorRevisionReferenceV1,
  type BindingRevisionReferenceV1,
  type FormalRequestProvenanceEvidenceV1,
  type FormalProvenanceResolverV1,
  type FreshActiveMembershipEvidenceV1,
  type FreshActiveMembershipProviderV1,
  type MembershipRevisionReferenceV1,
  type RequestReferenceV1,
  type UserReferenceV1,
} from '@/modules/security/server/institution-guard-evidence';

const MAX_PROVENANCE_TTL_MS = 5 * 60 * 1_000;
const MAX_CURRENT_FACT_TTL_MS = 60 * 1_000;
const CANONICAL_UTC_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const FACTORY_INPUT_KEYS = Object.freeze([
  'provenanceResolver',
  'membershipProvider',
  'anchorProvider',
  'now',
] as const);
const PROVENANCE_RESOLVER_KEYS = Object.freeze([
  'resolveCurrentRequest',
] as const);
const MEMBERSHIP_PROVIDER_KEYS = Object.freeze(['resolve'] as const);
const ANCHOR_PROVIDER_KEYS = Object.freeze(['resolve'] as const);
const PROVENANCE_KEYS = Object.freeze([
  'source',
  'userReference',
  'tenantId',
  'institutionId',
  'requestReference',
  'proofReference',
  'issuedAt',
  'verifiedAt',
  'validUntil',
] as const);
const MEMBERSHIP_KEYS = Object.freeze([
  'kind',
  'userReference',
  'role',
  'tenantId',
  'institutionId',
  'membershipReference',
  'membershipRevision',
  'bindingReference',
  'bindingRevision',
  'observedAt',
  'freshUntil',
] as const);
const ANCHOR_KEYS = Object.freeze([
  'kind',
  'tenantId',
  'institutionId',
  'anchorReference',
  'anchorRevision',
  'observedAt',
  'freshUntil',
] as const);

declare class InstitutionScopeAllowSealV1 {
  private readonly guardSeal;
}

declare class InstitutionScopeGuardSealV1 {
  private readonly guardSeal;
}

export const INSTITUTION_SCOPE_GUARD_FAILURE_CODES_V1 = Object.freeze([
  'invalid_context_shape',
  'provenance_missing',
  'provenance_invalid',
  'provenance_source_denied',
  'provenance_expired',
  'provenance_unavailable',
  'membership_denied',
  'membership_invalid',
  'membership_unavailable',
  'membership_stale',
  'institution_anchor_denied',
  'institution_anchor_unavailable',
] as const);

export type InstitutionScopeGuardFailureCodeV1 =
  (typeof INSTITUTION_SCOPE_GUARD_FAILURE_CODES_V1)[number];

export type InstitutionScopeAllowV1 = InstitutionScopeAllowSealV1 &
  Readonly<{
    kind: 'institution_scope_allow';
    requestReference: RequestReferenceV1;
    userReference: UserReferenceV1;
    role: InstitutionRoleV1;
    source: InstitutionAccessContextSourceV1;
    tenantId: string;
    institutionId: string;
    membershipRevision: MembershipRevisionReferenceV1;
    bindingRevision: BindingRevisionReferenceV1;
    anchorRevision: AnchorRevisionReferenceV1;
    provenanceValidUntil: string;
    membershipFreshUntil: string;
    anchorFreshUntil: string;
    decidedAt: string;
    validUntil: string;
  }>;

export type InstitutionScopeGuardResolutionV1 =
  | InstitutionScopeAllowV1
  | Readonly<{
      kind: 'rejected';
      code: InstitutionScopeGuardFailureCodeV1;
    }>;

export type InstitutionScopeGuardV1 = InstitutionScopeGuardSealV1 &
  Readonly<{
    authorizeCurrentRequest: () => Promise<InstitutionScopeGuardResolutionV1>;
  }>;

const authenticGuards = new WeakSet<object>();
const authenticAllows = new WeakSet<object>();

type CanonicalInstantV1 = Readonly<{ raw: string; epochMs: number }>;

type ProvenanceSnapshotV1 = Readonly<{
  source: InstitutionAccessContextSourceV1;
  userReference: UserReferenceV1;
  tenantId: string;
  institutionId: string;
  requestReference: RequestReferenceV1;
  issuedAt: CanonicalInstantV1;
  verifiedAt: CanonicalInstantV1;
  validUntil: CanonicalInstantV1;
}>;

type MembershipSnapshotV1 = Readonly<{
  userReference: UserReferenceV1;
  role: InstitutionRoleV1;
  tenantId: string;
  institutionId: string;
  membershipRevision: MembershipRevisionReferenceV1;
  bindingRevision: BindingRevisionReferenceV1;
  observedAt: CanonicalInstantV1;
  freshUntil: CanonicalInstantV1;
}>;

type AnchorSnapshotV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  anchorRevision: AnchorRevisionReferenceV1;
  observedAt: CanonicalInstantV1;
  freshUntil: CanonicalInstantV1;
}>;

const failures = Object.freeze(
  Object.fromEntries(
    INSTITUTION_SCOPE_GUARD_FAILURE_CODES_V1.map((code) => [
      code,
      Object.freeze({ kind: 'rejected', code }),
    ]),
  ) as Record<
    InstitutionScopeGuardFailureCodeV1,
    Readonly<{ kind: 'rejected'; code: InstitutionScopeGuardFailureCodeV1 }>
  >,
);

function reject(
  code: InstitutionScopeGuardFailureCodeV1,
): InstitutionScopeGuardResolutionV1 {
  return failures[code];
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

function parseCanonicalInstant(value: unknown): CanonicalInstantV1 | null {
  if (typeof value !== 'string' || !CANONICAL_UTC_INSTANT.test(value)) {
    return null;
  }
  const epochMs = Date.parse(value);
  if (!Number.isFinite(epochMs) || new Date(epochMs).toISOString() !== value) {
    return null;
  }
  return Object.freeze({ raw: value, epochMs });
}

function isSafeReferenceShape(
  value: unknown,
  expectedPrefix: string,
): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(usr|mbr|bnd|anc|prf|req|cor|objd|mrv|brv|arv|prv|srv|crv)_v1_k([1-9][0-9]{0,2})_([A-Za-z0-9_-]{43})$/u.exec(
    value,
  );
  if (!match || match[1] !== expectedPrefix) return false;
  const keyVersion = Number(match[2]);
  const encodedTag = match[3];
  if (
    !encodedTag ||
    !INSTITUTION_GUARD_ACCEPTED_KEY_VERSIONS_V1.some(
      (accepted) => accepted === keyVersion,
    )
  ) {
    return false;
  }
  try {
    const decoded = Buffer.from(encodedTag, 'base64url');
    return (
      decoded.byteLength === 32 && decoded.toString('base64url') === encodedTag
    );
  } catch {
    return false;
  }
}

function parseProvenance(value: unknown): ProvenanceSnapshotV1 | null {
  const snapshot = snapshotExactPlainRecord(value, PROVENANCE_KEYS);
  if (!snapshot) return null;
  const issuedAt = parseCanonicalInstant(snapshot.issuedAt);
  const verifiedAt = parseCanonicalInstant(snapshot.verifiedAt);
  const validUntil = parseCanonicalInstant(snapshot.validUntil);
  if (
    !isInstitutionAccessContextSourceV1(snapshot.source) ||
    !isSafeReferenceShape(snapshot.userReference, 'usr') ||
    !isInstitutionScopeIdV1(snapshot.tenantId) ||
    !isInstitutionScopeIdV1(snapshot.institutionId) ||
    !isSafeReferenceShape(snapshot.requestReference, 'req') ||
    !isSafeReferenceShape(snapshot.proofReference, 'prf') ||
    !issuedAt ||
    !verifiedAt ||
    !validUntil ||
    issuedAt.epochMs > verifiedAt.epochMs ||
    verifiedAt.epochMs >= validUntil.epochMs ||
    validUntil.epochMs - issuedAt.epochMs > MAX_PROVENANCE_TTL_MS
  ) {
    return null;
  }
  return Object.freeze({
    source: snapshot.source,
    userReference: snapshot.userReference as UserReferenceV1,
    tenantId: snapshot.tenantId,
    institutionId: snapshot.institutionId,
    requestReference: snapshot.requestReference as RequestReferenceV1,
    issuedAt,
    verifiedAt,
    validUntil,
  });
}

function parseMembership(value: unknown): MembershipSnapshotV1 | null {
  const snapshot = snapshotExactPlainRecord(value, MEMBERSHIP_KEYS);
  if (!snapshot) return null;
  const observedAt = parseCanonicalInstant(snapshot.observedAt);
  const freshUntil = parseCanonicalInstant(snapshot.freshUntil);
  if (
    snapshot.kind !== 'fresh_active' ||
    !isSafeReferenceShape(snapshot.userReference, 'usr') ||
    !isInstitutionRoleV1(snapshot.role) ||
    !isInstitutionScopeIdV1(snapshot.tenantId) ||
    !isInstitutionScopeIdV1(snapshot.institutionId) ||
    !isSafeReferenceShape(snapshot.membershipReference, 'mbr') ||
    !isSafeReferenceShape(snapshot.membershipRevision, 'mrv') ||
    !isSafeReferenceShape(snapshot.bindingReference, 'bnd') ||
    !isSafeReferenceShape(snapshot.bindingRevision, 'brv') ||
    !observedAt ||
    !freshUntil ||
    observedAt.epochMs >= freshUntil.epochMs ||
    freshUntil.epochMs - observedAt.epochMs > MAX_CURRENT_FACT_TTL_MS
  ) {
    return null;
  }
  return Object.freeze({
    userReference: snapshot.userReference as UserReferenceV1,
    role: snapshot.role,
    tenantId: snapshot.tenantId,
    institutionId: snapshot.institutionId,
    membershipRevision:
      snapshot.membershipRevision as MembershipRevisionReferenceV1,
    bindingRevision: snapshot.bindingRevision as BindingRevisionReferenceV1,
    observedAt,
    freshUntil,
  });
}

function parseAnchor(value: unknown): AnchorSnapshotV1 | null {
  const snapshot = snapshotExactPlainRecord(value, ANCHOR_KEYS);
  if (!snapshot) return null;
  const observedAt = parseCanonicalInstant(snapshot.observedAt);
  const freshUntil = parseCanonicalInstant(snapshot.freshUntil);
  if (
    snapshot.kind !== 'active' ||
    !isInstitutionScopeIdV1(snapshot.tenantId) ||
    !isInstitutionScopeIdV1(snapshot.institutionId) ||
    !isSafeReferenceShape(snapshot.anchorReference, 'anc') ||
    !isSafeReferenceShape(snapshot.anchorRevision, 'arv') ||
    !observedAt ||
    !freshUntil ||
    observedAt.epochMs >= freshUntil.epochMs ||
    freshUntil.epochMs - observedAt.epochMs > MAX_CURRENT_FACT_TTL_MS
  ) {
    return null;
  }
  return Object.freeze({
    tenantId: snapshot.tenantId,
    institutionId: snapshot.institutionId,
    anchorRevision: snapshot.anchorRevision as AnchorRevisionReferenceV1,
    observedAt,
    freshUntil,
  });
}

function trustedNow(now: (() => Date) | null): CanonicalInstantV1 | null {
  if (!now) return null;
  try {
    const value = now();
    if (
      value === null ||
      typeof value !== 'object' ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Date.prototype
    ) {
      return null;
    }
    const epochMs = Date.prototype.getTime.call(value);
    if (!Number.isFinite(epochMs)) return null;
    return Object.freeze({ raw: new Date(epochMs).toISOString(), epochMs });
  } catch {
    return null;
  }
}

function decideInstitutionScope(
  provenance: ProvenanceSnapshotV1,
  membership: MembershipSnapshotV1,
  anchor: AnchorSnapshotV1,
  decisionTime: CanonicalInstantV1,
): InstitutionScopeGuardResolutionV1 {
  const contextResolution = resolveInstitutionAccessContextV1({
    userId: provenance.userReference,
    role: membership.role,
    scope: 'tenant',
    tenantId: provenance.tenantId,
    institutionId: provenance.institutionId,
    source: provenance.source,
  });
  if (!contextResolution.ok) return reject('invalid_context_shape');
  const scopeDecision = authorizeInstitutionScopeV1({
    context: contextResolution.context,
    targetTenantId: provenance.tenantId,
    targetInstitutionId: provenance.institutionId,
    allowedRoles: ALL_INSTITUTION_ACCESS_ROLES_V1,
  });
  if (!scopeDecision.allowed) return reject('invalid_context_shape');

  const validUntilEpochMs = Math.min(
    provenance.validUntil.epochMs,
    membership.freshUntil.epochMs,
    anchor.freshUntil.epochMs,
  );
  const allow = Object.freeze({
    kind: 'institution_scope_allow',
    requestReference: provenance.requestReference,
    userReference: provenance.userReference,
    role: membership.role,
    source: provenance.source,
    tenantId: provenance.tenantId,
    institutionId: provenance.institutionId,
    membershipRevision: membership.membershipRevision,
    bindingRevision: membership.bindingRevision,
    anchorRevision: anchor.anchorRevision,
    provenanceValidUntil: provenance.validUntil.raw,
    membershipFreshUntil: membership.freshUntil.raw,
    anchorFreshUntil: anchor.freshUntil.raw,
    decidedAt: decisionTime.raw,
    validUntil: new Date(validUntilEpochMs).toISOString(),
  });
  authenticAllows.add(allow);
  return allow as unknown as InstitutionScopeAllowV1;
}

type ScopeGuardDependenciesV1 = Readonly<{
  resolveCurrentRequest: FormalProvenanceResolverV1['resolveCurrentRequest'] | null;
  resolveMembership: FreshActiveMembershipProviderV1['resolve'] | null;
  resolveAnchor: ActiveInstitutionAnchorProviderV1['resolve'] | null;
  now: (() => Date) | null;
}>;

function snapshotMethod(
  value: unknown,
  expectedKeys: readonly string[],
  methodName: string,
): ((...args: never[]) => unknown) | null {
  const snapshot = snapshotExactPlainRecord(value, expectedKeys);
  const method = snapshot?.[methodName];
  return typeof method === 'function' && !isProxy(method)
    ? (method as (...args: never[]) => unknown)
    : null;
}

function snapshotDependencies(value: unknown): ScopeGuardDependenciesV1 {
  const input = snapshotExactPlainRecord(value, FACTORY_INPUT_KEYS);
  const resolveCurrentRequest = input
    ? snapshotMethod(
        input.provenanceResolver,
        PROVENANCE_RESOLVER_KEYS,
        'resolveCurrentRequest',
      )
    : null;
  const resolveMembership = input
    ? snapshotMethod(
        input.membershipProvider,
        MEMBERSHIP_PROVIDER_KEYS,
        'resolve',
      )
    : null;
  const resolveAnchor = input
    ? snapshotMethod(input.anchorProvider, ANCHOR_PROVIDER_KEYS, 'resolve')
    : null;
  const now =
    input && typeof input.now === 'function' && !isProxy(input.now)
      ? (input.now as () => Date)
      : null;
  return Object.freeze({
    resolveCurrentRequest:
      resolveCurrentRequest as FormalProvenanceResolverV1['resolveCurrentRequest'] | null,
    resolveMembership:
      resolveMembership as FreshActiveMembershipProviderV1['resolve'] | null,
    resolveAnchor:
      resolveAnchor as ActiveInstitutionAnchorProviderV1['resolve'] | null,
    now,
  });
}

function isProvenanceRejectionCode(
  value: unknown,
): value is (typeof PROVENANCE_REJECTION_CODES_V1)[number] {
  return PROVENANCE_REJECTION_CODES_V1.some((code) => code === value);
}

function isMembershipRejectionCode(
  value: unknown,
): value is (typeof MEMBERSHIP_REJECTION_CODES_V1)[number] {
  return MEMBERSHIP_REJECTION_CODES_V1.some((code) => code === value);
}

async function authorizeCurrentRequest(
  dependencies: ScopeGuardDependenciesV1,
): Promise<InstitutionScopeGuardResolutionV1> {
  if (!dependencies.resolveCurrentRequest) {
    return reject('provenance_unavailable');
  }

  let rawProvenanceResolution: unknown;
  try {
    rawProvenanceResolution = await dependencies.resolveCurrentRequest();
  } catch {
    return reject('provenance_unavailable');
  }

  const verifiedProvenanceResolution = snapshotExactPlainRecord(
    rawProvenanceResolution,
    ['kind', 'evidence'],
  );
  if (verifiedProvenanceResolution?.kind !== 'verified') {
    const failedProvenanceResolution = snapshotExactPlainRecord(
      rawProvenanceResolution,
      ['kind', 'code'],
    );
    if (
      failedProvenanceResolution?.kind === 'rejected' &&
      isProvenanceRejectionCode(failedProvenanceResolution.code)
    ) {
      return reject(failedProvenanceResolution.code);
    }
    if (
      failedProvenanceResolution?.kind === 'unavailable' &&
      failedProvenanceResolution.code === 'provenance_unavailable'
    ) {
      return reject('provenance_unavailable');
    }
    return reject('provenance_unavailable');
  }

  const rawProvenance = snapshotExactPlainRecord(
    verifiedProvenanceResolution.evidence,
    PROVENANCE_KEYS,
  );
  if (!rawProvenance) return reject('invalid_context_shape');
  if (!isInstitutionAccessContextSourceV1(rawProvenance.source)) {
    return reject('provenance_source_denied');
  }
  const provenance = parseProvenance(verifiedProvenanceResolution.evidence);
  if (!provenance) return reject('invalid_context_shape');

  const decisionTime = trustedNow(dependencies.now);
  if (!decisionTime) return reject('provenance_unavailable');
  if (
    provenance.issuedAt.epochMs > decisionTime.epochMs ||
    provenance.verifiedAt.epochMs > decisionTime.epochMs
  ) {
    return reject('invalid_context_shape');
  }
  if (decisionTime.epochMs >= provenance.validUntil.epochMs) {
    return reject('provenance_expired');
  }
  if (!dependencies.resolveMembership) {
    return reject('membership_unavailable');
  }

  const requestedScope = Object.freeze({
    tenantId: provenance.tenantId,
    institutionId: provenance.institutionId,
  });
  const membershipRequest = Object.freeze({
    provenance:
      verifiedProvenanceResolution.evidence as FormalRequestProvenanceEvidenceV1,
    requestedScope,
  });
  let rawMembershipResolution: unknown;
  try {
    rawMembershipResolution =
      await dependencies.resolveMembership(membershipRequest);
  } catch {
    return reject('membership_unavailable');
  }

  const failedMembershipResolution = snapshotExactPlainRecord(
    rawMembershipResolution,
    ['kind', 'code'],
  );
  if (
    failedMembershipResolution?.kind === 'rejected' &&
    isMembershipRejectionCode(failedMembershipResolution.code)
  ) {
    return reject(failedMembershipResolution.code);
  }
  const membership = parseMembership(rawMembershipResolution);
  if (!membership) return reject('membership_invalid');
  if (
    membership.userReference !== provenance.userReference ||
    membership.tenantId !== provenance.tenantId ||
    membership.institutionId !== provenance.institutionId ||
    membership.observedAt.epochMs > decisionTime.epochMs
  ) {
    return reject('membership_invalid');
  }
  if (decisionTime.epochMs >= membership.freshUntil.epochMs) {
    return reject('membership_stale');
  }
  if (!dependencies.resolveAnchor) {
    return reject('institution_anchor_unavailable');
  }

  let rawAnchorResolution: unknown;
  try {
    rawAnchorResolution = await dependencies.resolveAnchor(requestedScope);
  } catch {
    return reject('institution_anchor_unavailable');
  }
  const failedAnchorResolution = snapshotExactPlainRecord(
    rawAnchorResolution,
    ['kind', 'code'],
  );
  if (
    failedAnchorResolution?.kind === 'denied' &&
    failedAnchorResolution.code === 'institution_anchor_denied'
  ) {
    return reject('institution_anchor_denied');
  }
  if (
    failedAnchorResolution?.kind === 'unavailable' &&
    failedAnchorResolution.code === 'institution_anchor_unavailable'
  ) {
    return reject('institution_anchor_unavailable');
  }
  const anchor = parseAnchor(rawAnchorResolution);
  if (!anchor) return reject('institution_anchor_unavailable');
  if (
    anchor.tenantId !== provenance.tenantId ||
    anchor.institutionId !== provenance.institutionId ||
    anchor.observedAt.epochMs > decisionTime.epochMs ||
    decisionTime.epochMs >= anchor.freshUntil.epochMs
  ) {
    return reject('institution_anchor_unavailable');
  }

  return decideInstitutionScope(provenance, membership, anchor, decisionTime);
}

export function isInstitutionScopeGuardV1(
  value: unknown,
): value is InstitutionScopeGuardV1 {
  return (
    value !== null &&
    typeof value === 'object' &&
    !isProxy(value) &&
    authenticGuards.has(value)
  );
}

export function isInstitutionScopeAllowV1(
  value: unknown,
): value is InstitutionScopeAllowV1 {
  return (
    value !== null &&
    typeof value === 'object' &&
    !isProxy(value) &&
    authenticAllows.has(value)
  );
}

/**
 * Composes owner-held request evidence into a non-serializable scope decision. The public handle
 * accepts no caller scope or evidence and grants no section, object, action, or capability access.
 */
export function createInstitutionScopeGuardV1(input: Readonly<{
  provenanceResolver: FormalProvenanceResolverV1;
  membershipProvider: FreshActiveMembershipProviderV1;
  anchorProvider: ActiveInstitutionAnchorProviderV1;
  now: () => Date;
}>): InstitutionScopeGuardV1 {
  const dependencies = snapshotDependencies(input);
  const guard = Object.freeze({
    authorizeCurrentRequest: () => authorizeCurrentRequest(dependencies),
  });
  authenticGuards.add(guard);
  return guard as unknown as InstitutionScopeGuardV1;
}
