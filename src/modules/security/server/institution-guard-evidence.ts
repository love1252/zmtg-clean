import { isProxy } from 'node:util/types';

import {
  isInstitutionRoleV1,
  type InstitutionRoleV1,
} from '@/modules/institution-contracts/v1/institution-navigation';
import {
  isInstitutionAccessContextSourceV1,
  isInstitutionScopeIdV1,
  type InstitutionAccessContextSourceV1,
} from '@/modules/security/domain/institution-access';

export const INSTITUTION_GUARD_REFERENCE_PREFIXES_V1 = Object.freeze([
  'usr',
  'mbr',
  'bnd',
  'anc',
  'prf',
  'req',
  'cor',
  'objd',
  'mrv',
  'brv',
  'arv',
  'prv',
  'srv',
  'crv',
] as const);

export type InstitutionGuardReferencePrefixV1 =
  (typeof INSTITUTION_GUARD_REFERENCE_PREFIXES_V1)[number];

export const INSTITUTION_GUARD_ACCEPTED_KEY_VERSIONS_V1 = Object.freeze([
  1,
] as const);

declare const guardReferenceCandidateMarkerV1: unique symbol;
declare const safeGuardReferenceMarkerV1: unique symbol;
declare const objectReferenceCandidateMarkerV1: unique symbol;
declare const safeObjectReferenceMarkerV1: unique symbol;

declare class FormalProvenanceEvidenceSealV1 {
  private readonly ownerSeal;
}
declare class FreshActiveMembershipEvidenceSealV1 {
  private readonly ownerSeal;
}
declare class ActiveInstitutionAnchorEvidenceSealV1 {
  private readonly ownerSeal;
}
declare class FormalProvenanceResolverSealV1 {
  private readonly ownerSeal;
}
declare class FreshActiveMembershipProviderSealV1 {
  private readonly ownerSeal;
}
declare class ActiveInstitutionAnchorProviderSealV1 {
  private readonly ownerSeal;
}

/** Format-only candidate. It is not owner-verified and grants no authority. */
export type GuardReferenceCandidateV1<
  Prefix extends InstitutionGuardReferencePrefixV1,
> = string & {
  readonly [guardReferenceCandidateMarkerV1]: Prefix;
};

/**
 * Owner-issued/verified reference. This module deliberately exports no raw-value promotion
 * function; the future owner implementation must create it behind its private composition root.
 */
export type SafeGuardReferenceV1<
  Prefix extends InstitutionGuardReferencePrefixV1,
> = string & {
  readonly [safeGuardReferenceMarkerV1]: Prefix;
};

export type UserReferenceV1 = SafeGuardReferenceV1<'usr'>;
export type MembershipReferenceV1 = SafeGuardReferenceV1<'mbr'>;
export type BindingReferenceV1 = SafeGuardReferenceV1<'bnd'>;
export type AnchorReferenceV1 = SafeGuardReferenceV1<'anc'>;
export type ProofReferenceV1 = SafeGuardReferenceV1<'prf'>;
export type RequestReferenceV1 = SafeGuardReferenceV1<'req'>;
export type CorrelationReferenceV1 = SafeGuardReferenceV1<'cor'>;
export type ObjectDigestReferenceV1 = SafeGuardReferenceV1<'objd'>;
export type MembershipRevisionReferenceV1 = SafeGuardReferenceV1<'mrv'>;
export type BindingRevisionReferenceV1 = SafeGuardReferenceV1<'brv'>;
export type AnchorRevisionReferenceV1 = SafeGuardReferenceV1<'arv'>;
export type PolicyRevisionReferenceV1 = SafeGuardReferenceV1<'prv'>;
export type ObjectScopeRevisionReferenceV1 = SafeGuardReferenceV1<'srv'>;
export type CapabilityDecisionRevisionReferenceV1 =
  SafeGuardReferenceV1<'crv'>;

/** Format-only object candidate. It is not owner-verified and grants no authority. */
export type ObjectReferenceCandidateV1 = string & {
  readonly [objectReferenceCandidateMarkerV1]: 'syntax_only';
};

/** Registry-issued/verified object reference; no public raw-value promotion exists here. */
export type SafeObjectReferenceV1 = string & {
  readonly [safeObjectReferenceMarkerV1]: 'registry_verified';
};

export const PROVENANCE_REJECTION_CODES_V1 = Object.freeze([
  'provenance_missing',
  'provenance_invalid',
  'provenance_expired',
  'provenance_source_denied',
] as const);

export type ProvenanceRejectionCodeV1 =
  (typeof PROVENANCE_REJECTION_CODES_V1)[number];

export const MEMBERSHIP_REJECTION_CODES_V1 = Object.freeze([
  'membership_denied',
  'membership_invalid',
  'membership_unavailable',
  'membership_stale',
] as const);

export type MembershipRejectionCodeV1 =
  (typeof MEMBERSHIP_REJECTION_CODES_V1)[number];

export type FormalRequestProvenanceEvidenceV1 =
  FormalProvenanceEvidenceSealV1 &
    Readonly<{
      source: InstitutionAccessContextSourceV1;
      userReference: UserReferenceV1;
      tenantId: string;
      institutionId: string;
      requestReference: RequestReferenceV1;
      proofReference: ProofReferenceV1;
      issuedAt: string;
      verifiedAt: string;
      validUntil: string;
    }>;

export type ProvenanceResolutionV1 =
  | Readonly<{ kind: 'verified'; evidence: FormalRequestProvenanceEvidenceV1 }>
  | Readonly<{ kind: 'rejected'; code: ProvenanceRejectionCodeV1 }>
  | Readonly<{ kind: 'unavailable'; code: 'provenance_unavailable' }>;

export type FreshActiveMembershipEvidenceV1 =
  FreshActiveMembershipEvidenceSealV1 &
    Readonly<{
      kind: 'fresh_active';
      userReference: UserReferenceV1;
      role: InstitutionRoleV1;
      tenantId: string;
      institutionId: string;
      membershipReference: MembershipReferenceV1;
      membershipRevision: MembershipRevisionReferenceV1;
      bindingReference: BindingReferenceV1;
      bindingRevision: BindingRevisionReferenceV1;
      observedAt: string;
      freshUntil: string;
    }>;

export type FreshActiveMembershipResolutionV1 =
  | FreshActiveMembershipEvidenceV1
  | Readonly<{ kind: 'rejected'; code: MembershipRejectionCodeV1 }>;

export type ActiveInstitutionAnchorEvidenceV1 =
  ActiveInstitutionAnchorEvidenceSealV1 &
    Readonly<{
      kind: 'active';
      tenantId: string;
      institutionId: string;
      anchorReference: AnchorReferenceV1;
      anchorRevision: AnchorRevisionReferenceV1;
      observedAt: string;
      freshUntil: string;
    }>;

export type ActiveInstitutionAnchorResolutionV1 =
  | ActiveInstitutionAnchorEvidenceV1
  | Readonly<{ kind: 'denied'; code: 'institution_anchor_denied' }>
  | Readonly<{
      kind: 'unavailable';
      code: 'institution_anchor_unavailable';
    }>;

/**
 * Request-scoped handle created only inside the authentication/gateway composition root. The
 * shared module exposes neither its private nominal marker nor a constructor.
 */
export type FormalProvenanceResolverV1 = FormalProvenanceResolverSealV1 &
  Readonly<{
    resolveCurrentRequest: () => Promise<ProvenanceResolutionV1>;
  }>;

/** Provider implementations own their authoritative store and trusted clock. */
export type FreshActiveMembershipProviderV1 =
  FreshActiveMembershipProviderSealV1 &
    Readonly<{
      resolve: (input: Readonly<{
        provenance: FormalRequestProvenanceEvidenceV1;
        requestedScope: Readonly<{ tenantId: string; institutionId: string }>;
      }>) => Promise<FreshActiveMembershipResolutionV1>;
    }>;

/** Provider implementations own their authoritative store and trusted clock. */
export type ActiveInstitutionAnchorProviderV1 =
  ActiveInstitutionAnchorProviderSealV1 &
    Readonly<{
      resolve: (input: Readonly<{
        tenantId: string;
        institutionId: string;
      }>) => Promise<ActiveInstitutionAnchorResolutionV1>;
    }>;

/**
 * Strictly parsed but still unverified. Candidate values must never be passed to a guard,
 * business reader, audit writer, URL, or client projection as authorization evidence.
 */
export type RequestProvenanceEvidenceCandidateV1 = Readonly<{
  source: InstitutionAccessContextSourceV1;
  userReference: GuardReferenceCandidateV1<'usr'>;
  tenantId: string;
  institutionId: string;
  requestReference: GuardReferenceCandidateV1<'req'>;
  proofReference: GuardReferenceCandidateV1<'prf'>;
  issuedAt: string;
  verifiedAt: string;
  validUntil: string;
}>;

export type ProvenanceResolutionCandidateV1 =
  | Readonly<{
      kind: 'provenance_candidate';
      evidence: RequestProvenanceEvidenceCandidateV1;
    }>
  | Readonly<{ kind: 'rejected'; code: ProvenanceRejectionCodeV1 }>;

export type MembershipResolutionCandidateV1 =
  | Readonly<{
      kind: 'membership_candidate';
      userReference: GuardReferenceCandidateV1<'usr'>;
      role: InstitutionRoleV1;
      tenantId: string;
      institutionId: string;
      membershipReference: GuardReferenceCandidateV1<'mbr'>;
      membershipRevision: GuardReferenceCandidateV1<'mrv'>;
      bindingReference: GuardReferenceCandidateV1<'bnd'>;
      bindingRevision: GuardReferenceCandidateV1<'brv'>;
      observedAt: string;
      freshUntil: string;
    }>
  | Readonly<{ kind: 'rejected'; code: MembershipRejectionCodeV1 }>;

export type InstitutionAnchorResolutionCandidateV1 =
  | Readonly<{
      kind: 'anchor_candidate';
      tenantId: string;
      institutionId: string;
      anchorReference: GuardReferenceCandidateV1<'anc'>;
      anchorRevision: GuardReferenceCandidateV1<'arv'>;
      observedAt: string;
      freshUntil: string;
    }>
  | Readonly<{ kind: 'denied'; code: 'institution_anchor_denied' }>
  | Readonly<{
      kind: 'unavailable';
      code: 'institution_anchor_unavailable';
    }>;

const PROVENANCE_EVIDENCE_KEYS = Object.freeze([
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
const PROVENANCE_CANDIDATE_KEYS = Object.freeze(['kind', 'evidence'] as const);
const REJECTED_RESOLUTION_KEYS = Object.freeze(['kind', 'code'] as const);
const MEMBERSHIP_CANDIDATE_KEYS = Object.freeze([
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
const ANCHOR_CANDIDATE_KEYS = Object.freeze([
  'kind',
  'tenantId',
  'institutionId',
  'anchorReference',
  'anchorRevision',
  'observedAt',
  'freshUntil',
] as const);

const CANONICAL_UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const MAX_PROVENANCE_TTL_MS = 5 * 60 * 1_000;
const MAX_CURRENT_FACT_TTL_MS = 60 * 1_000;

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

function readOwnDataKind(value: unknown): unknown {
  try {
    if (value === null || typeof value !== 'object' || isProxy(value)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, 'kind');
    return descriptor && 'value' in descriptor ? descriptor.value : null;
  } catch {
    return null;
  }
}

function parseCanonicalUtcInstant(
  value: unknown,
): Readonly<{ raw: string; epochMs: number }> | null {
  if (typeof value !== 'string' || !CANONICAL_UTC_INSTANT.test(value)) return null;
  const epochMs = Date.parse(value);
  if (!Number.isFinite(epochMs) || new Date(epochMs).toISOString() !== value) {
    return null;
  }
  return Object.freeze({ raw: value, epochMs });
}

function isReferencePrefixV1(
  value: unknown,
): value is InstitutionGuardReferencePrefixV1 {
  return INSTITUTION_GUARD_REFERENCE_PREFIXES_V1.some(
    (candidate) => candidate === value,
  );
}

export function isGuardReferenceCandidateV1<
  Prefix extends InstitutionGuardReferencePrefixV1,
>(
  value: unknown,
  expectedPrefix: Prefix,
): value is GuardReferenceCandidateV1<Prefix> {
  if (typeof value !== 'string' || !isReferencePrefixV1(expectedPrefix)) {
    return false;
  }
  const match = /^(usr|mbr|bnd|anc|prf|req|cor|objd|mrv|brv|arv|prv|srv|crv)_v1_k([1-9][0-9]{0,2})_([A-Za-z0-9_-]{22,43})$/u.exec(
    value,
  );
  if (!match || match[1] !== expectedPrefix) return false;
  const keyVersion = Number(match[2]);
  return INSTITUTION_GUARD_ACCEPTED_KEY_VERSIONS_V1.some(
    (accepted) => accepted === keyVersion,
  );
}

export function isObjectReferenceCandidateV1(
  value: unknown,
): value is ObjectReferenceCandidateV1 {
  if (typeof value !== 'string') return false;
  const match = /^oref_v1_k([1-9][0-9]{0,2})_([A-Za-z0-9_-]{22,43})$/u.exec(
    value,
  );
  if (!match) return false;
  const keyVersion = Number(match[1]);
  return INSTITUTION_GUARD_ACCEPTED_KEY_VERSIONS_V1.some(
    (accepted) => accepted === keyVersion,
  );
}

function isRejectionCode<T extends string>(
  value: unknown,
  codes: readonly T[],
): value is T {
  return codes.some((candidate) => candidate === value);
}

export function parseRequestProvenanceEvidenceCandidateV1(
  value: unknown,
): RequestProvenanceEvidenceCandidateV1 | null {
  const snapshot = snapshotExactPlainRecord(value, PROVENANCE_EVIDENCE_KEYS);
  if (!snapshot) return null;

  const issuedAt = parseCanonicalUtcInstant(snapshot.issuedAt);
  const verifiedAt = parseCanonicalUtcInstant(snapshot.verifiedAt);
  const validUntil = parseCanonicalUtcInstant(snapshot.validUntil);
  if (
    !isInstitutionAccessContextSourceV1(snapshot.source) ||
    !isGuardReferenceCandidateV1(snapshot.userReference, 'usr') ||
    !isInstitutionScopeIdV1(snapshot.tenantId) ||
    !isInstitutionScopeIdV1(snapshot.institutionId) ||
    !isGuardReferenceCandidateV1(snapshot.requestReference, 'req') ||
    !isGuardReferenceCandidateV1(snapshot.proofReference, 'prf') ||
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
    userReference: snapshot.userReference,
    tenantId: snapshot.tenantId,
    institutionId: snapshot.institutionId,
    requestReference: snapshot.requestReference,
    proofReference: snapshot.proofReference,
    issuedAt: issuedAt.raw,
    verifiedAt: verifiedAt.raw,
    validUntil: validUntil.raw,
  });
}

export function parseProvenanceResolutionCandidateV1(
  value: unknown,
): ProvenanceResolutionCandidateV1 | null {
  const kind = readOwnDataKind(value);
  if (kind === 'provenance_candidate') {
    const snapshot = snapshotExactPlainRecord(value, PROVENANCE_CANDIDATE_KEYS);
    if (!snapshot) return null;
    const evidence = parseRequestProvenanceEvidenceCandidateV1(snapshot.evidence);
    return evidence
      ? Object.freeze({ kind: 'provenance_candidate', evidence })
      : null;
  }
  if (kind === 'rejected') {
    const snapshot = snapshotExactPlainRecord(value, REJECTED_RESOLUTION_KEYS);
    if (!snapshot || !isRejectionCode(snapshot.code, PROVENANCE_REJECTION_CODES_V1)) {
      return null;
    }
    return Object.freeze({ kind: 'rejected', code: snapshot.code });
  }
  return null;
}

export function parseMembershipResolutionCandidateV1(
  value: unknown,
): MembershipResolutionCandidateV1 | null {
  const kind = readOwnDataKind(value);
  if (kind === 'rejected') {
    const snapshot = snapshotExactPlainRecord(value, REJECTED_RESOLUTION_KEYS);
    if (!snapshot || !isRejectionCode(snapshot.code, MEMBERSHIP_REJECTION_CODES_V1)) {
      return null;
    }
    return Object.freeze({ kind: 'rejected', code: snapshot.code });
  }
  if (kind !== 'membership_candidate') return null;

  const snapshot = snapshotExactPlainRecord(value, MEMBERSHIP_CANDIDATE_KEYS);
  if (!snapshot) return null;
  const observedAt = parseCanonicalUtcInstant(snapshot.observedAt);
  const freshUntil = parseCanonicalUtcInstant(snapshot.freshUntil);
  if (
    !isGuardReferenceCandidateV1(snapshot.userReference, 'usr') ||
    !isInstitutionRoleV1(snapshot.role) ||
    !isInstitutionScopeIdV1(snapshot.tenantId) ||
    !isInstitutionScopeIdV1(snapshot.institutionId) ||
    !isGuardReferenceCandidateV1(snapshot.membershipReference, 'mbr') ||
    !isGuardReferenceCandidateV1(snapshot.membershipRevision, 'mrv') ||
    !isGuardReferenceCandidateV1(snapshot.bindingReference, 'bnd') ||
    !isGuardReferenceCandidateV1(snapshot.bindingRevision, 'brv') ||
    !observedAt ||
    !freshUntil ||
    observedAt.epochMs >= freshUntil.epochMs ||
    freshUntil.epochMs - observedAt.epochMs > MAX_CURRENT_FACT_TTL_MS
  ) {
    return null;
  }

  return Object.freeze({
    kind: 'membership_candidate',
    userReference: snapshot.userReference,
    role: snapshot.role,
    tenantId: snapshot.tenantId,
    institutionId: snapshot.institutionId,
    membershipReference: snapshot.membershipReference,
    membershipRevision: snapshot.membershipRevision,
    bindingReference: snapshot.bindingReference,
    bindingRevision: snapshot.bindingRevision,
    observedAt: observedAt.raw,
    freshUntil: freshUntil.raw,
  });
}

export function parseInstitutionAnchorResolutionCandidateV1(
  value: unknown,
): InstitutionAnchorResolutionCandidateV1 | null {
  const kind = readOwnDataKind(value);
  if (kind === 'denied' || kind === 'unavailable') {
    const snapshot = snapshotExactPlainRecord(value, REJECTED_RESOLUTION_KEYS);
    if (!snapshot) return null;
    if (kind === 'denied' && snapshot.code === 'institution_anchor_denied') {
      return Object.freeze({ kind: 'denied', code: 'institution_anchor_denied' });
    }
    if (
      kind === 'unavailable' &&
      snapshot.code === 'institution_anchor_unavailable'
    ) {
      return Object.freeze({
        kind: 'unavailable',
        code: 'institution_anchor_unavailable',
      });
    }
    return null;
  }
  if (kind !== 'anchor_candidate') return null;

  const snapshot = snapshotExactPlainRecord(value, ANCHOR_CANDIDATE_KEYS);
  if (!snapshot) return null;
  const observedAt = parseCanonicalUtcInstant(snapshot.observedAt);
  const freshUntil = parseCanonicalUtcInstant(snapshot.freshUntil);
  if (
    !isInstitutionScopeIdV1(snapshot.tenantId) ||
    !isInstitutionScopeIdV1(snapshot.institutionId) ||
    !isGuardReferenceCandidateV1(snapshot.anchorReference, 'anc') ||
    !isGuardReferenceCandidateV1(snapshot.anchorRevision, 'arv') ||
    !observedAt ||
    !freshUntil ||
    observedAt.epochMs >= freshUntil.epochMs ||
    freshUntil.epochMs - observedAt.epochMs > MAX_CURRENT_FACT_TTL_MS
  ) {
    return null;
  }

  return Object.freeze({
    kind: 'anchor_candidate',
    tenantId: snapshot.tenantId,
    institutionId: snapshot.institutionId,
    anchorReference: snapshot.anchorReference,
    anchorRevision: snapshot.anchorRevision,
    observedAt: observedAt.raw,
    freshUntil: freshUntil.raw,
  });
}
