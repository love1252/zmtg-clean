import {
  CAPABILITY_STATUS_SAFE_SUMMARY_MAX_LENGTH_V1,
  isCapabilityStatusCodeMaturityV1,
  isCapabilityStatusConnectionAvailabilityV1,
  isCapabilityStatusDataReadinessV1,
  isCapabilityStatusInstitutionAuthorizationV1,
  isCapabilityStatusProductionReleaseV1,
  type CapabilityStatusDecisionV1,
  type CapabilityStatusDimensionsV1,
  type CapabilityStatusItemV1,
} from '@/modules/institution-contracts/v1/institution-capability';
import {
  isInstitutionCapabilityKeyV1,
  isInstitutionDiagnosticTargetCapabilityKeyV1,
  type InstitutionCapabilityKeyV1,
  type InstitutionDiagnosticTargetCapabilityKeyV1,
} from '@/modules/institution-contracts/v1/institution-capability-registry';
import {
  snapshotExactDataRecord,
  type StrictDataRecordSnapshot,
} from '@/modules/institution/server/strict-input-snapshot';

const EVALUATION_INPUT_KEYS = Object.freeze([
  'key',
  'dimensions',
  'safeSummary',
  'diagnosticTargetKey',
] as const);

const DIMENSION_KEYS = Object.freeze([
  'codeMaturity',
  'institutionAuthorization',
  'connectionAvailability',
  'dataReadiness',
  'productionRelease',
] as const);

export const INSTITUTION_CAPABILITY_SAFE_SUMMARIES_V1 = Object.freeze([
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

export type InstitutionCapabilityEvaluationInputV1 = Readonly<{
  key: InstitutionCapabilityKeyV1;
  dimensions: CapabilityStatusDimensionsV1;
  safeSummary: string | null;
  diagnosticTargetKey: InstitutionDiagnosticTargetCapabilityKeyV1 | null;
}>;

export type InstitutionCapabilityEvaluationFailureReasonV1 =
  | 'invalid_input'
  | 'unknown_capability'
  | 'invalid_dimensions'
  | 'unsafe_summary'
  | 'invalid_diagnostic_target';

export type InstitutionCapabilityEvaluationResultV1 =
  | Readonly<{ ok: true; item: Readonly<CapabilityStatusItemV1> }>
  | Readonly<{
      ok: false;
      failureReason: InstitutionCapabilityEvaluationFailureReasonV1;
    }>;

function parseDimensions(value: unknown): CapabilityStatusDimensionsV1 | null {
  const snapshot = snapshotExactDataRecord(value, DIMENSION_KEYS);
  if (!snapshot) return null;
  if (!isCapabilityStatusCodeMaturityV1(snapshot.codeMaturity)) return null;
  if (!isCapabilityStatusInstitutionAuthorizationV1(snapshot.institutionAuthorization)) {
    return null;
  }
  if (!isCapabilityStatusConnectionAvailabilityV1(snapshot.connectionAvailability)) {
    return null;
  }
  if (!isCapabilityStatusDataReadinessV1(snapshot.dataReadiness)) return null;
  if (!isCapabilityStatusProductionReleaseV1(snapshot.productionRelease)) return null;

  return Object.freeze({
    codeMaturity: snapshot.codeMaturity,
    institutionAuthorization: snapshot.institutionAuthorization,
    connectionAvailability: snapshot.connectionAvailability,
    dataReadiness: snapshot.dataReadiness,
    productionRelease: snapshot.productionRelease,
  });
}

export function isInstitutionCapabilitySafeSummaryV1(
  value: unknown,
): value is string | null {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  if (Array.from(value).length > CAPABILITY_STATUS_SAFE_SUMMARY_MAX_LENGTH_V1) {
    return false;
  }
  return INSTITUTION_CAPABILITY_SAFE_SUMMARIES_V1.some(
    (candidate) => candidate === value,
  );
}

export function deriveInstitutionCapabilityDecisionV1(
  dimensions: unknown,
): CapabilityStatusDecisionV1 {
  const parsedDimensions = parseDimensions(dimensions);
  if (!parsedDimensions) return 'hidden';

  if (
    parsedDimensions.codeMaturity !== 'verified' ||
    parsedDimensions.institutionAuthorization !== 'authorized' ||
    parsedDimensions.productionRelease === 'not_released' ||
    parsedDimensions.productionRelease === 'suspended' ||
    parsedDimensions.connectionAvailability === 'unavailable' ||
    parsedDimensions.dataReadiness === 'unavailable'
  ) {
    return 'hidden';
  }

  if (
    parsedDimensions.dataReadiness === 'partial' ||
    parsedDimensions.dataReadiness === 'stale'
  ) {
    return 'read_only';
  }

  return 'operational';
}

export function evaluateInstitutionCapabilityStatusV1(
  input: unknown,
): InstitutionCapabilityEvaluationResultV1 {
  try {
    const snapshot = snapshotExactDataRecord(input, EVALUATION_INPUT_KEYS);
    if (!snapshot) {
      return Object.freeze({ ok: false, failureReason: 'invalid_input' });
    }
    if (!isInstitutionCapabilityKeyV1(snapshot.key)) {
      return Object.freeze({ ok: false, failureReason: 'unknown_capability' });
    }

    const dimensions = parseDimensions(snapshot.dimensions);
    if (!dimensions) {
      return Object.freeze({ ok: false, failureReason: 'invalid_dimensions' });
    }
    if (!isInstitutionCapabilitySafeSummaryV1(snapshot.safeSummary)) {
      return Object.freeze({ ok: false, failureReason: 'unsafe_summary' });
    }
    if (
      snapshot.diagnosticTargetKey !== null &&
      !isInstitutionDiagnosticTargetCapabilityKeyV1(snapshot.diagnosticTargetKey)
    ) {
      return Object.freeze({ ok: false, failureReason: 'invalid_diagnostic_target' });
    }

    const item = Object.freeze({
      key: snapshot.key,
      decision: deriveInstitutionCapabilityDecisionV1(dimensions),
      dimensions,
      safeSummary:
        dimensions.institutionAuthorization === 'authorized'
          ? snapshot.safeSummary
          : null,
      diagnosticTargetKey:
        dimensions.institutionAuthorization === 'authorized'
          ? snapshot.diagnosticTargetKey
          : null,
    }) satisfies Readonly<CapabilityStatusItemV1>;

    return Object.freeze({ ok: true, item });
  } catch {
    return Object.freeze({ ok: false, failureReason: 'invalid_input' });
  }
}
