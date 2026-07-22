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
  type ActiveInstitutionAnchorEvidenceV1,
  type AnchorRevisionReferenceV1,
  type BindingRevisionReferenceV1,
  type FormalRequestProvenanceEvidenceV1,
  type FreshActiveMembershipEvidenceV1,
  type MembershipRevisionReferenceV1,
  type RequestReferenceV1,
  type UserReferenceV1,
} from '@/modules/security/server/institution-guard-evidence';

const MAX_PROVENANCE_TTL_MS = 5 * 60 * 1_000;
const MAX_CURRENT_FACT_TTL_MS = 60 * 1_000;
const CANONICAL_UTC_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const FACTORY_INPUT_KEYS = Object.freeze(['now'] as const);
const EVALUATE_INPUT_KEYS = Object.freeze([
  'provenance',
  'membership',
  'anchor',
] as const);
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
  'provenance_source_denied',
  'provenance_expired',
  'provenance_unavailable',
  'membership_invalid',
  'membership_stale',
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

export type InstitutionScopeGuardInputV1 = Readonly<{
  provenance: FormalRequestProvenanceEvidenceV1;
  membership: FreshActiveMembershipEvidenceV1;
  anchor: ActiveInstitutionAnchorEvidenceV1;
}>;

export type InstitutionScopeGuardV1 = InstitutionScopeGuardSealV1 &
  Readonly<{
    evaluate: (
      input: InstitutionScopeGuardInputV1,
    ) => InstitutionScopeGuardResolutionV1;
  }>;

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
  return INSTITUTION_GUARD_ACCEPTED_KEY_VERSIONS_V1.some(
    (accepted) => accepted === keyVersion,
  );
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

function evaluate(
  now: (() => Date) | null,
  value: InstitutionScopeGuardInputV1,
): InstitutionScopeGuardResolutionV1 {
  const input = snapshotExactPlainRecord(value, EVALUATE_INPUT_KEYS);
  if (!input) return reject('invalid_context_shape');

  const rawProvenance = snapshotExactPlainRecord(
    input.provenance,
    PROVENANCE_KEYS,
  );
  if (!rawProvenance) return reject('invalid_context_shape');
  if (!isInstitutionAccessContextSourceV1(rawProvenance.source)) {
    return reject('provenance_source_denied');
  }

  const provenance = parseProvenance(input.provenance);
  if (!provenance) return reject('invalid_context_shape');
  const decisionTime = trustedNow(now);
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

  const membership = parseMembership(input.membership);
  if (!membership) return reject('membership_invalid');
  if (
    membership.userReference !== provenance.userReference ||
    membership.tenantId !== provenance.tenantId ||
    membership.institutionId !== provenance.institutionId
  ) {
    return reject('membership_invalid');
  }
  if (membership.observedAt.epochMs > decisionTime.epochMs) {
    return reject('membership_invalid');
  }
  if (decisionTime.epochMs >= membership.freshUntil.epochMs) {
    return reject('membership_stale');
  }

  const anchor = parseAnchor(input.anchor);
  if (!anchor) return reject('institution_anchor_unavailable');
  if (
    anchor.tenantId !== provenance.tenantId ||
    anchor.institutionId !== provenance.institutionId
  ) {
    return reject('institution_anchor_unavailable');
  }
  if (anchor.observedAt.epochMs > decisionTime.epochMs) {
    return reject('institution_anchor_unavailable');
  }
  if (decisionTime.epochMs >= anchor.freshUntil.epochMs) {
    return reject('institution_anchor_unavailable');
  }

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
  return Object.freeze({
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
  }) as unknown as InstitutionScopeAllowV1;
}

/**
 * Creates a pure request-time scope guard. The result grants no section, object, action, or
 * capability access and is intentionally not serializable back into an allow through any parser.
 */
export function createInstitutionScopeGuardV1(input: Readonly<{
  now: () => Date;
}>): InstitutionScopeGuardV1 {
  const snapshot = snapshotExactPlainRecord(input, FACTORY_INPUT_KEYS);
  const now =
    snapshot && typeof snapshot.now === 'function' && !isProxy(snapshot.now)
      ? (snapshot.now as () => Date)
      : null;
  return Object.freeze({
    evaluate: (value: InstitutionScopeGuardInputV1) => evaluate(now, value),
  }) as unknown as InstitutionScopeGuardV1;
}
