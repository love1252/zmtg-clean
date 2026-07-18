import {
  isInstitutionSourceFailureCodeV1,
  isInstitutionSourcePartitionReadinessV1,
  type InstitutionSourceFailureCodeV1,
  type InstitutionSourcePartitionReadinessV1,
} from '@/modules/institution-contracts/v1/institution-source';
import type { CapabilityStatusDimensionsV1 } from '@/modules/institution-contracts/v1/institution-capability';
import {
  INSTITUTION_CAPABILITY_REGISTRY_V1,
  isInstitutionCapabilityKeyV1,
  type InstitutionCapabilityKeyV1,
  type InstitutionDiagnosticTargetCapabilityKeyV1,
} from '@/modules/institution-contracts/v1/institution-capability-registry';
import {
  evaluateInstitutionCapabilityCandidateV1,
  INSTITUTION_CAPABILITY_OWNER_REQUIREMENTS_V1,
  type InstitutionCapabilityEvaluationCandidateInputV1,
  type InstitutionCapabilityEvaluationCandidateV1,
} from '@/modules/institution/server/institution-capability-status-evaluator';
import {
  hasExactSnapshotKeys,
  snapshotExactDataRecord,
  snapshotStrictArray,
  snapshotStrictDataRecord,
} from '@/modules/institution/server/strict-input-snapshot';

const SCOPE_INTENT_KEYS = Object.freeze([
  'tenantIdIntent',
  'institutionIdIntent',
] as const);
const SCOPE_CLAIM_KEYS = Object.freeze([
  'tenantIdClaim',
  'institutionIdClaim',
] as const);
const PROVIDER_CANDIDATE_KEYS = Object.freeze([
  'scopeClaim',
  'sourcePartitionClaims',
  'capabilityEvaluationCandidates',
] as const);
const PARTITION_CLAIM_KEYS = Object.freeze([
  'candidateCapabilityKey',
  'sourceReadinessClaim',
  'freshnessClaim',
  'sourceFailureClaim',
] as const);
const FRESHNESS_CLAIM_KEYS = Object.freeze([
  'observedAtClaim',
  'freshUntilClaim',
] as const);
const READ_CANDIDATE_KEYS = Object.freeze([
  'scopeIntent',
  'providerCandidate',
] as const);

const capabilityDisplayOrder = new Map<InstitutionCapabilityKeyV1, number>(
  INSTITUTION_CAPABILITY_REGISTRY_V1.map((definition, index) => [definition.key, index]),
);

declare class InstitutionCapabilityOwnerEvidenceSealV1 {
  private readonly ownerSeal;
}

/**
 * Future composition-root-only evidence. The private nominal seal has no exported constructor,
 * parser, assertion, or raw-value promotion path in this candidate-only slice.
 */
export type InstitutionCapabilityOwnerEvidenceV1 =
  InstitutionCapabilityOwnerEvidenceSealV1 &
    Readonly<{
      formalProvenance: Readonly<{ evidenceKind: 'formal_provenance' }>;
      freshActiveMembership: Readonly<{
        evidenceKind: 'fresh_active_membership';
      }>;
      activeInstitutionAnchor: Readonly<{
        evidenceKind: 'active_institution_anchor';
      }>;
      ownerCapabilityFacts: readonly Readonly<{
        capabilityKey: InstitutionCapabilityKeyV1;
        dimensions: Readonly<CapabilityStatusDimensionsV1>;
        observedAt: string;
        freshUntil: string;
      }>[];
      trustedServerNow: string;
      diagnosticRouteGuard: Readonly<{
        reachableTargets: readonly InstitutionDiagnosticTargetCapabilityKeyV1[];
      }>;
      capabilityRevision: Readonly<{
        evidenceKind: 'capability_revision';
        reference: string;
      }>;
    }>;

export type InstitutionCapabilityScopeIntentV1 = Readonly<{
  tenantIdIntent: string;
  institutionIdIntent: string;
}>;

export type InstitutionCapabilityProviderScopeClaimV1 = Readonly<{
  tenantIdClaim: string;
  institutionIdClaim: string;
}>;

export type InstitutionCapabilityFreshnessClaimV1 = Readonly<{
  observedAtClaim: string;
  freshUntilClaim: string;
}>;

export type InstitutionCapabilitySourcePartitionClaimV1 = Readonly<{
  candidateCapabilityKey: InstitutionCapabilityKeyV1;
  sourceReadinessClaim: InstitutionSourcePartitionReadinessV1;
  freshnessClaim: InstitutionCapabilityFreshnessClaimV1 | null;
  sourceFailureClaim: InstitutionSourceFailureCodeV1 | null;
}>;

export type InstitutionCapabilityProviderCandidateInputV1 = Readonly<{
  scopeClaim: InstitutionCapabilityProviderScopeClaimV1;
  sourcePartitionClaims: readonly InstitutionCapabilitySourcePartitionClaimV1[];
  capabilityEvaluationCandidates: readonly InstitutionCapabilityEvaluationCandidateInputV1[];
}>;

export type InstitutionCapabilityStatusCandidateReadInputV1 = Readonly<{
  scopeIntent: InstitutionCapabilityScopeIntentV1;
  providerCandidate: InstitutionCapabilityProviderCandidateInputV1;
}>;

export type InstitutionCapabilityStatusCandidateBlockReasonV1 =
  | 'invalid_input'
  | 'invalid_scope_intent'
  | 'invalid_provider_candidate'
  | 'scope_intent_mismatch'
  | 'invalid_partition_candidate'
  | 'invalid_evaluation_candidate'
  | 'duplicate_candidate'
  | 'candidate_key_mismatch';

export type InstitutionCapabilityStatusCandidateReadResultV1 =
  | Readonly<{
      kind: 'non_authorizing_candidate';
      tenantIntentCandidate: string;
      institutionIntentCandidate: string;
      sourcePartitionCandidates: readonly InstitutionCapabilitySourcePartitionClaimV1[];
      capabilityCandidates: readonly InstitutionCapabilityEvaluationCandidateV1[];
      ownerRequirements: typeof INSTITUTION_CAPABILITY_OWNER_REQUIREMENTS_V1;
    }>
  | Readonly<{
      kind: 'blocked';
      blockReason: InstitutionCapabilityStatusCandidateBlockReasonV1;
      ownerRequirements: typeof INSTITUTION_CAPABILITY_OWNER_REQUIREMENTS_V1;
    }>;

function blocked(
  blockReason: InstitutionCapabilityStatusCandidateBlockReasonV1,
): InstitutionCapabilityStatusCandidateReadResultV1 {
  return Object.freeze({
    kind: 'blocked',
    blockReason,
    ownerRequirements: INSTITUTION_CAPABILITY_OWNER_REQUIREMENTS_V1,
  });
}

function isSafeScopeIntentId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
  );
}

function parseScopeIntent(value: unknown): InstitutionCapabilityScopeIntentV1 | null {
  const snapshot = snapshotExactDataRecord(value, SCOPE_INTENT_KEYS);
  if (
    !snapshot ||
    !isSafeScopeIntentId(snapshot.tenantIdIntent) ||
    !isSafeScopeIntentId(snapshot.institutionIdIntent)
  ) {
    return null;
  }
  return Object.freeze({
    tenantIdIntent: snapshot.tenantIdIntent,
    institutionIdIntent: snapshot.institutionIdIntent,
  });
}

function parseScopeClaim(
  value: unknown,
): InstitutionCapabilityProviderScopeClaimV1 | null {
  const snapshot = snapshotExactDataRecord(value, SCOPE_CLAIM_KEYS);
  if (
    !snapshot ||
    !isSafeScopeIntentId(snapshot.tenantIdClaim) ||
    !isSafeScopeIntentId(snapshot.institutionIdClaim)
  ) {
    return null;
  }
  return Object.freeze({
    tenantIdClaim: snapshot.tenantIdClaim,
    institutionIdClaim: snapshot.institutionIdClaim,
  });
}

function parseCanonicalInstantClaim(value: unknown): string | null {
  if (typeof value !== 'string' || value.length !== 24) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString() === value ? value : null;
}

function parseFreshnessClaim(
  value: unknown,
): InstitutionCapabilityFreshnessClaimV1 | null {
  const snapshot = snapshotExactDataRecord(value, FRESHNESS_CLAIM_KEYS);
  if (!snapshot) return null;
  const observedAtClaim = parseCanonicalInstantClaim(snapshot.observedAtClaim);
  const freshUntilClaim = parseCanonicalInstantClaim(snapshot.freshUntilClaim);
  if (
    !observedAtClaim ||
    !freshUntilClaim ||
    Date.parse(observedAtClaim) > Date.parse(freshUntilClaim)
  ) {
    return null;
  }
  return Object.freeze({ observedAtClaim, freshUntilClaim });
}

function isCandidateCrossFieldShapeValid(
  candidate: InstitutionCapabilitySourcePartitionClaimV1,
) {
  if (
    candidate.sourceReadinessClaim === 'ready' ||
    candidate.sourceReadinessClaim === 'empty'
  ) {
    return candidate.freshnessClaim !== null && candidate.sourceFailureClaim === null;
  }
  if (candidate.sourceReadinessClaim === 'stale') {
    return (
      candidate.freshnessClaim !== null &&
      candidate.sourceFailureClaim === 'data_incomplete'
    );
  }
  if (candidate.sourceReadinessClaim === 'denied') {
    return (
      candidate.freshnessClaim === null &&
      (candidate.sourceFailureClaim === 'permission_denied' ||
        candidate.sourceFailureClaim === 'scope_mismatch')
    );
  }
  if (candidate.sourceReadinessClaim === 'disabled') {
    return (
      candidate.freshnessClaim === null &&
      candidate.sourceFailureClaim === 'not_released'
    );
  }
  return (
    candidate.freshnessClaim === null &&
    (candidate.sourceFailureClaim === 'upstream_unavailable' ||
      candidate.sourceFailureClaim === 'timeout' ||
      candidate.sourceFailureClaim === 'invalid_payload' ||
      candidate.sourceFailureClaim === 'data_incomplete')
  );
}

function parsePartitionClaim(
  value: unknown,
): InstitutionCapabilitySourcePartitionClaimV1 | null {
  const snapshot = snapshotExactDataRecord(value, PARTITION_CLAIM_KEYS);
  if (!snapshot) return null;
  if (!isInstitutionCapabilityKeyV1(snapshot.candidateCapabilityKey)) return null;
  if (!isInstitutionSourcePartitionReadinessV1(snapshot.sourceReadinessClaim)) {
    return null;
  }
  if (
    snapshot.sourceFailureClaim !== null &&
    !isInstitutionSourceFailureCodeV1(snapshot.sourceFailureClaim)
  ) {
    return null;
  }

  const freshnessClaim =
    snapshot.freshnessClaim === null
      ? null
      : parseFreshnessClaim(snapshot.freshnessClaim);
  if (snapshot.freshnessClaim !== null && freshnessClaim === null) return null;

  const candidate = Object.freeze({
    candidateCapabilityKey: snapshot.candidateCapabilityKey,
    sourceReadinessClaim: snapshot.sourceReadinessClaim,
    freshnessClaim,
    sourceFailureClaim: snapshot.sourceFailureClaim,
  }) satisfies InstitutionCapabilitySourcePartitionClaimV1;
  return isCandidateCrossFieldShapeValid(candidate) ? candidate : null;
}

function isDataBearingClaim(readinessClaim: InstitutionSourcePartitionReadinessV1) {
  return (
    readinessClaim === 'ready' ||
    readinessClaim === 'empty' ||
    readinessClaim === 'stale'
  );
}

/**
 * Parses a candidate bundle only. It performs shape and self-consistency checks but never creates
 * CapabilityStatusV1, current/ready state, a display decision, diagnostic reachability, or allow.
 * Future-time and TTL validity remain owned by the trusted server clock requirement above.
 */
export function readInstitutionCapabilityStatusCandidateV1(
  input: unknown,
): InstitutionCapabilityStatusCandidateReadResultV1 {
  try {
    const inputSnapshot = snapshotStrictDataRecord(input);
    if (!inputSnapshot || !hasExactSnapshotKeys(inputSnapshot, READ_CANDIDATE_KEYS)) {
      return blocked('invalid_input');
    }

    const scopeIntent = parseScopeIntent(inputSnapshot.scopeIntent);
    if (!scopeIntent) return blocked('invalid_scope_intent');

    const providerSnapshot = snapshotStrictDataRecord(inputSnapshot.providerCandidate);
    if (
      !providerSnapshot ||
      !hasExactSnapshotKeys(providerSnapshot, PROVIDER_CANDIDATE_KEYS)
    ) {
      return blocked('invalid_provider_candidate');
    }

    const scopeClaim = parseScopeClaim(providerSnapshot.scopeClaim);
    if (!scopeClaim) return blocked('invalid_provider_candidate');
    if (
      scopeClaim.tenantIdClaim !== scopeIntent.tenantIdIntent ||
      scopeClaim.institutionIdClaim !== scopeIntent.institutionIdIntent
    ) {
      return blocked('scope_intent_mismatch');
    }

    const rawPartitionClaims = snapshotStrictArray(
      providerSnapshot.sourcePartitionClaims,
      INSTITUTION_CAPABILITY_REGISTRY_V1.length,
    );
    const rawEvaluationCandidates = snapshotStrictArray(
      providerSnapshot.capabilityEvaluationCandidates,
      INSTITUTION_CAPABILITY_REGISTRY_V1.length,
    );
    if (!rawPartitionClaims || rawPartitionClaims.length === 0 || !rawEvaluationCandidates) {
      return blocked('invalid_provider_candidate');
    }

    const sourcePartitionCandidates: InstitutionCapabilitySourcePartitionClaimV1[] = [];
    const partitionKeys = new Set<InstitutionCapabilityKeyV1>();
    for (const rawPartitionClaim of rawPartitionClaims) {
      const partitionCandidate = parsePartitionClaim(rawPartitionClaim);
      if (!partitionCandidate) return blocked('invalid_partition_candidate');
      if (partitionKeys.has(partitionCandidate.candidateCapabilityKey)) {
        return blocked('duplicate_candidate');
      }
      partitionKeys.add(partitionCandidate.candidateCapabilityKey);
      sourcePartitionCandidates.push(partitionCandidate);
    }

    const capabilityCandidates: InstitutionCapabilityEvaluationCandidateV1[] = [];
    const capabilityKeys = new Set<InstitutionCapabilityKeyV1>();
    for (const rawEvaluationCandidate of rawEvaluationCandidates) {
      const evaluationCandidate = evaluateInstitutionCapabilityCandidateV1(
        rawEvaluationCandidate,
      );
      if (evaluationCandidate.kind === 'blocked') {
        return blocked('invalid_evaluation_candidate');
      }
      if (capabilityKeys.has(evaluationCandidate.candidateCapabilityKey)) {
        return blocked('duplicate_candidate');
      }
      capabilityKeys.add(evaluationCandidate.candidateCapabilityKey);
      capabilityCandidates.push(evaluationCandidate);
    }

    const dataBearingClaimKeys = new Set(
      sourcePartitionCandidates
        .filter((candidate) => isDataBearingClaim(candidate.sourceReadinessClaim))
        .map((candidate) => candidate.candidateCapabilityKey),
    );
    if (
      dataBearingClaimKeys.size !== capabilityKeys.size ||
      [...dataBearingClaimKeys].some((key) => !capabilityKeys.has(key))
    ) {
      return blocked('candidate_key_mismatch');
    }

    sourcePartitionCandidates.sort(
      (left, right) =>
        (capabilityDisplayOrder.get(left.candidateCapabilityKey) ??
          Number.MAX_SAFE_INTEGER) -
        (capabilityDisplayOrder.get(right.candidateCapabilityKey) ??
          Number.MAX_SAFE_INTEGER),
    );
    capabilityCandidates.sort(
      (left, right) =>
        (capabilityDisplayOrder.get(left.candidateCapabilityKey) ??
          Number.MAX_SAFE_INTEGER) -
        (capabilityDisplayOrder.get(right.candidateCapabilityKey) ??
          Number.MAX_SAFE_INTEGER),
    );

    Object.freeze(sourcePartitionCandidates);
    Object.freeze(capabilityCandidates);
    return Object.freeze({
      kind: 'non_authorizing_candidate',
      tenantIntentCandidate: scopeIntent.tenantIdIntent,
      institutionIntentCandidate: scopeIntent.institutionIdIntent,
      sourcePartitionCandidates,
      capabilityCandidates,
      ownerRequirements: INSTITUTION_CAPABILITY_OWNER_REQUIREMENTS_V1,
    });
  } catch {
    return blocked('invalid_input');
  }
}
