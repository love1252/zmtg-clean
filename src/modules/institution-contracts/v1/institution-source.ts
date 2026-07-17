export const INSTITUTION_SOURCE_READINESS_VALUES_V1 = Object.freeze([
  'ready',
  'empty',
  'partial',
  'stale',
  'unavailable',
  'denied',
  'disabled',
] as const);

export type InstitutionSourceReadinessV1 =
  (typeof INSTITUTION_SOURCE_READINESS_VALUES_V1)[number];

export const INSTITUTION_SOURCE_PARTITION_READINESS_VALUES_V1 = Object.freeze([
  'ready',
  'empty',
  'stale',
  'unavailable',
  'denied',
  'disabled',
] as const satisfies readonly Exclude<InstitutionSourceReadinessV1, 'partial'>[]);

export type InstitutionSourcePartitionReadinessV1 = Exclude<
  InstitutionSourceReadinessV1,
  'partial'
>;

export const INSTITUTION_SOURCE_FAILURE_CODES_V1 = Object.freeze([
  'upstream_unavailable',
  'timeout',
  'invalid_payload',
  'scope_mismatch',
  'permission_denied',
  'not_released',
  'data_incomplete',
] as const);

export type InstitutionSourceFailureCodeV1 =
  (typeof INSTITUTION_SOURCE_FAILURE_CODES_V1)[number];

export type InstitutionSourceFreshnessV1 = {
  observedAt: string;
  freshUntil: string;
};

export type InstitutionSourcePartitionV1<K extends string> = {
  key: K;
  readiness: InstitutionSourcePartitionReadinessV1;
  freshness: InstitutionSourceFreshnessV1 | null;
  failureCode: InstitutionSourceFailureCodeV1 | null;
};

/**
 * Frozen V1 wire shape only. Cross-field readiness, freshness, failure-code, and data
 * invariants require the separately approved reader/parser contract before untrusted use.
 */
export type InstitutionSourceEnvelopeV1<T, K extends string> = {
  contractVersion: 'v1';
  scope: {
    tenantId: string;
    institutionId: string;
  };
  readiness: InstitutionSourceReadinessV1;
  freshness: InstitutionSourceFreshnessV1 | null;
  partitions: InstitutionSourcePartitionV1<K>[];
  data: T | null;
  failureCode: InstitutionSourceFailureCodeV1 | null;
};

export function isInstitutionSourceReadinessV1(
  value: unknown,
): value is InstitutionSourceReadinessV1 {
  return INSTITUTION_SOURCE_READINESS_VALUES_V1.some((candidate) => candidate === value);
}

export function isInstitutionSourcePartitionReadinessV1(
  value: unknown,
): value is InstitutionSourcePartitionReadinessV1 {
  return INSTITUTION_SOURCE_PARTITION_READINESS_VALUES_V1.some(
    (candidate) => candidate === value,
  );
}

export function isInstitutionSourceFailureCodeV1(
  value: unknown,
): value is InstitutionSourceFailureCodeV1 {
  return INSTITUTION_SOURCE_FAILURE_CODES_V1.some((candidate) => candidate === value);
}
