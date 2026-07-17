import type { InstitutionSourceEnvelopeV1 } from './institution-source';

export const INSTITUTION_OPERATING_CONTEXT_PARTITION_KEY_V1 =
  'operating_context' as const;

export type InstitutionOperatingContextPartitionKeyV1 =
  typeof INSTITUTION_OPERATING_CONTEXT_PARTITION_KEY_V1;

export const INSTITUTION_OPERATING_CONTEXT_SOURCE_VALUES_V1 = Object.freeze([
  'institution_config',
  'product_default',
] as const);

export type InstitutionOperatingContextSourceV1 =
  (typeof INSTITUTION_OPERATING_CONTEXT_SOURCE_VALUES_V1)[number];

/**
 * Product defaults are explicit source facts, not synthetic institution configuration.
 * A provider using these values must also declare `source: 'product_default'`.
 */
export const INSTITUTION_OPERATING_CONTEXT_PRODUCT_DEFAULT_V1 = Object.freeze({
  source: 'product_default',
  current: Object.freeze({
    timeZone: 'Asia/Shanghai',
    defaultCurrency: 'CNY',
  }),
} as const);

export type InstitutionOperatingContextCurrentV1 = {
  timeZone: string;
  defaultCurrency: string;
};

export type InstitutionOperatingContextPendingV1 = {
  timeZone: string;
  defaultCurrency: string;
  requestedVersion: string;
  effectiveFromBusinessDate: string;
};

export type InstitutionOperatingContextPayloadV1 = {
  version: string;
  source: InstitutionOperatingContextSourceV1;
  current: InstitutionOperatingContextCurrentV1;
  pending: InstitutionOperatingContextPendingV1 | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

/**
 * Frozen V1 wire declaration only. IANA time-zone, ISO 4217 currency, business-date,
 * product-default consistency, and cross-field envelope invariants require the separately
 * approved provider and untrusted-value parser. This declaration performs no parsing,
 * authorization, persistence, scheduling, currency conversion, or historical recomputation.
 */
export type InstitutionOperatingContextV1 = InstitutionSourceEnvelopeV1<
  InstitutionOperatingContextPayloadV1,
  'operating_context'
>;

/** Scalar vocabulary guard only; not a payload or envelope parser. */
export function isInstitutionOperatingContextSourceV1(
  value: unknown,
): value is InstitutionOperatingContextSourceV1 {
  return INSTITUTION_OPERATING_CONTEXT_SOURCE_VALUES_V1.some(
    (candidate) => candidate === value,
  );
}
