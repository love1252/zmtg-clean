import type { InstitutionSourceEnvelopeV1 } from './institution-source';

export const CUSTOMER_LIFECYCLE_VALUES_V1 = Object.freeze([
  'consulting',
  'scheduled',
  'post_care',
  'repurchase_window',
  'silent_reactivation',
] as const);

export type CustomerLifecycleV1 = (typeof CUSTOMER_LIFECYCLE_VALUES_V1)[number];

/**
 * Low-sensitivity locator only, never an authorization credential. Consumers must revalidate
 * tenant, institution, reader, and customer scope on the server. This type does not parse,
 * sanitize, or remove extra fields from untrusted runtime values.
 */
export type CustomerReferenceV1 = {
  contractVersion: 'v1';
  customerId: string;
  displayName: string;
  maskedReference: string | null;
};

export type CustomerLifecycleSummaryPayloadV1 = {
  buckets: Array<{
    key: CustomerLifecycleV1;
    count: number | null;
  }>;
};

/**
 * Public wire shape only. The customer provider remains responsible for emitting each
 * lifecycle key exactly once and for enforcing the approved envelope semantics.
 */
export type CustomerLifecycleSummaryV1 = InstitutionSourceEnvelopeV1<
  CustomerLifecycleSummaryPayloadV1,
  CustomerLifecycleV1
>;

export function isCustomerLifecycleV1(value: unknown): value is CustomerLifecycleV1 {
  return CUSTOMER_LIFECYCLE_VALUES_V1.some((candidate) => candidate === value);
}
