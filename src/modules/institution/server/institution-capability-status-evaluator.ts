import {
  CAPABILITY_STATUS_SAFE_SUMMARY_MAX_LENGTH_V1,
  isCapabilityStatusCodeMaturityV1,
  isCapabilityStatusConnectionAvailabilityV1,
  isCapabilityStatusDataReadinessV1,
  isCapabilityStatusInstitutionAuthorizationV1,
  isCapabilityStatusProductionReleaseV1,
  type CapabilityStatusCodeMaturityV1,
  type CapabilityStatusConnectionAvailabilityV1,
  type CapabilityStatusDataReadinessV1,
  type CapabilityStatusInstitutionAuthorizationV1,
  type CapabilityStatusProductionReleaseV1,
} from '@/modules/institution-contracts/v1/institution-capability';
import {
  isInstitutionCapabilityKeyV1,
  type InstitutionCapabilityKeyV1,
} from '@/modules/institution-contracts/v1/institution-capability-registry';
import { snapshotExactDataRecord } from '@/modules/institution/server/strict-input-snapshot';

const EVALUATION_INPUT_KEYS = Object.freeze([
  'candidateCapabilityKey',
  'dimensionClaims',
  'summaryCandidate',
] as const);

const DIMENSION_CLAIM_KEYS = Object.freeze([
  'codeMaturityClaim',
  'institutionAuthorizationClaim',
  'connectionAvailabilityClaim',
  'dataReadinessClaim',
  'productionReleaseClaim',
] as const);

export const INSTITUTION_CAPABILITY_OWNER_REQUIREMENTS_V1 = Object.freeze([
  'formal_provenance',
  'fresh_active_membership',
  'active_institution_anchor',
  'owner_capability_facts',
  'trusted_server_clock',
  'diagnostic_route_guard',
  'capability_revision',
] as const);

export type InstitutionCapabilityOwnerRequirementV1 =
  (typeof INSTITUTION_CAPABILITY_OWNER_REQUIREMENTS_V1)[number];

export const INSTITUTION_CAPABILITY_CANDIDATE_SUMMARIES_V1 = Object.freeze([
  '当前能力已核验',
  '当前能力暂无数据',
  '当前能力部分可用',
  '当前能力数据已过期',
  '当前能力连接暂不可用',
  '当前能力数据暂不可用',
  '当前能力尚未核验',
  '当前能力尚未发布',
  '当前能力已暂停',
] as const);

export type InstitutionCapabilityDimensionClaimsV1 = Readonly<{
  codeMaturityClaim: CapabilityStatusCodeMaturityV1;
  institutionAuthorizationClaim: CapabilityStatusInstitutionAuthorizationV1;
  connectionAvailabilityClaim: CapabilityStatusConnectionAvailabilityV1;
  dataReadinessClaim: CapabilityStatusDataReadinessV1;
  productionReleaseClaim: CapabilityStatusProductionReleaseV1;
}>;

export type InstitutionCapabilityEvaluationCandidateInputV1 = Readonly<{
  candidateCapabilityKey: InstitutionCapabilityKeyV1;
  dimensionClaims: InstitutionCapabilityDimensionClaimsV1;
  summaryCandidate: string | null;
}>;

export type InstitutionCapabilityEvaluationBlockReasonV1 =
  | 'invalid_input'
  | 'unknown_capability'
  | 'invalid_dimension_claims'
  | 'unsafe_summary_candidate';

export type InstitutionCapabilityEvaluationCandidateV1 = Readonly<{
  kind: 'non_authorizing_candidate';
  candidateCapabilityKey: InstitutionCapabilityKeyV1;
  untrustedDimensionClaims: InstitutionCapabilityDimensionClaimsV1;
  untrustedSummaryClaim: string | null;
  ownerRequirements: typeof INSTITUTION_CAPABILITY_OWNER_REQUIREMENTS_V1;
}>;

export type InstitutionCapabilityEvaluationResultV1 =
  | InstitutionCapabilityEvaluationCandidateV1
  | Readonly<{
      kind: 'blocked';
      blockReason: InstitutionCapabilityEvaluationBlockReasonV1;
      ownerRequirements: typeof INSTITUTION_CAPABILITY_OWNER_REQUIREMENTS_V1;
    }>;

function blocked(
  blockReason: InstitutionCapabilityEvaluationBlockReasonV1,
): InstitutionCapabilityEvaluationResultV1 {
  return Object.freeze({
    kind: 'blocked',
    blockReason,
    ownerRequirements: INSTITUTION_CAPABILITY_OWNER_REQUIREMENTS_V1,
  });
}

function parseDimensionClaims(
  value: unknown,
): InstitutionCapabilityDimensionClaimsV1 | null {
  const snapshot = snapshotExactDataRecord(value, DIMENSION_CLAIM_KEYS);
  if (!snapshot) return null;
  if (!isCapabilityStatusCodeMaturityV1(snapshot.codeMaturityClaim)) return null;
  if (
    !isCapabilityStatusInstitutionAuthorizationV1(
      snapshot.institutionAuthorizationClaim,
    )
  ) {
    return null;
  }
  if (
    !isCapabilityStatusConnectionAvailabilityV1(
      snapshot.connectionAvailabilityClaim,
    )
  ) {
    return null;
  }
  if (!isCapabilityStatusDataReadinessV1(snapshot.dataReadinessClaim)) return null;
  if (!isCapabilityStatusProductionReleaseV1(snapshot.productionReleaseClaim)) {
    return null;
  }

  return Object.freeze({
    codeMaturityClaim: snapshot.codeMaturityClaim,
    institutionAuthorizationClaim: snapshot.institutionAuthorizationClaim,
    connectionAvailabilityClaim: snapshot.connectionAvailabilityClaim,
    dataReadinessClaim: snapshot.dataReadinessClaim,
    productionReleaseClaim: snapshot.productionReleaseClaim,
  });
}

export function isInstitutionCapabilitySummaryCandidateV1(
  value: unknown,
): value is string | null {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  if (value.length > CAPABILITY_STATUS_SAFE_SUMMARY_MAX_LENGTH_V1 * 2) {
    return false;
  }
  if (Array.from(value).length > CAPABILITY_STATUS_SAFE_SUMMARY_MAX_LENGTH_V1) {
    return false;
  }
  return INSTITUTION_CAPABILITY_CANDIDATE_SUMMARIES_V1.some(
    (candidate) => candidate === value,
  );
}

/**
 * Parses only a non-authorizing candidate. Raw claims can never create CapabilityStatusV1,
 * a display decision, diagnostic reachability, or evidence for a target operation.
 */
export function evaluateInstitutionCapabilityCandidateV1(
  input: unknown,
): InstitutionCapabilityEvaluationResultV1 {
  try {
    const snapshot = snapshotExactDataRecord(input, EVALUATION_INPUT_KEYS);
    if (!snapshot) return blocked('invalid_input');
    if (!isInstitutionCapabilityKeyV1(snapshot.candidateCapabilityKey)) {
      return blocked('unknown_capability');
    }

    const dimensionClaims = parseDimensionClaims(snapshot.dimensionClaims);
    if (!dimensionClaims) {
      return blocked('invalid_dimension_claims');
    }
    if (!isInstitutionCapabilitySummaryCandidateV1(snapshot.summaryCandidate)) {
      return blocked('unsafe_summary_candidate');
    }

    return Object.freeze({
      kind: 'non_authorizing_candidate',
      candidateCapabilityKey: snapshot.candidateCapabilityKey,
      untrustedDimensionClaims: dimensionClaims,
      untrustedSummaryClaim: snapshot.summaryCandidate,
      ownerRequirements: INSTITUTION_CAPABILITY_OWNER_REQUIREMENTS_V1,
    });
  } catch {
    return blocked('invalid_input');
  }
}
