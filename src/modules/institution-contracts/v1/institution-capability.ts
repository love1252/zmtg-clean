import type {
  InstitutionCapabilityKeyV1,
  InstitutionDiagnosticTargetCapabilityKeyV1,
} from './institution-capability-registry';
import type { InstitutionSourceEnvelopeV1 } from './institution-source';

export const CAPABILITY_STATUS_DECISIONS_V1 = Object.freeze([
  'hidden',
  'read_only',
  'operational',
] as const);

export type CapabilityStatusDecisionV1 =
  (typeof CAPABILITY_STATUS_DECISIONS_V1)[number];

export const CAPABILITY_STATUS_CODE_MATURITY_VALUES_V1 = Object.freeze([
  'unverified',
  'verified',
] as const);

export type CapabilityStatusCodeMaturityV1 =
  (typeof CAPABILITY_STATUS_CODE_MATURITY_VALUES_V1)[number];

export const CAPABILITY_STATUS_INSTITUTION_AUTHORIZATION_VALUES_V1 = Object.freeze([
  'not_authorized',
  'authorized',
] as const);

export type CapabilityStatusInstitutionAuthorizationV1 =
  (typeof CAPABILITY_STATUS_INSTITUTION_AUTHORIZATION_VALUES_V1)[number];

export const CAPABILITY_STATUS_CONNECTION_AVAILABILITY_VALUES_V1 = Object.freeze([
  'not_required',
  'unavailable',
  'available',
] as const);

export type CapabilityStatusConnectionAvailabilityV1 =
  (typeof CAPABILITY_STATUS_CONNECTION_AVAILABILITY_VALUES_V1)[number];

export const CAPABILITY_STATUS_DATA_READINESS_VALUES_V1 = Object.freeze([
  'not_required',
  'ready',
  'empty',
  'partial',
  'stale',
  'unavailable',
] as const);

export type CapabilityStatusDataReadinessV1 =
  (typeof CAPABILITY_STATUS_DATA_READINESS_VALUES_V1)[number];

export const CAPABILITY_STATUS_PRODUCTION_RELEASE_VALUES_V1 = Object.freeze([
  'not_released',
  'pilot_released',
  'released',
  'suspended',
] as const);

export type CapabilityStatusProductionReleaseV1 =
  (typeof CAPABILITY_STATUS_PRODUCTION_RELEASE_VALUES_V1)[number];

export const CAPABILITY_STATUS_SAFE_SUMMARY_MAX_LENGTH_V1 = 120 as const;

/**
 * Explanatory dimensions behind the authoritative server-side decision. They describe code
 * maturity, institution authorization, required connection availability, business-data
 * readiness, and production release separately. They are not action permissions, and consumers
 * must not recompute or override `decision` from them. `institutionAuthorization` and `decision`
 * are evaluated for the current server-side AccessContext; the response must not be cached or
 * reused across actors or access contexts.
 */
export type CapabilityStatusDimensionsV1 = {
  codeMaturity: CapabilityStatusCodeMaturityV1;
  institutionAuthorization: CapabilityStatusInstitutionAuthorizationV1;
  connectionAvailability: CapabilityStatusConnectionAvailabilityV1;
  dataReadiness: CapabilityStatusDataReadinessV1;
  productionRelease: CapabilityStatusProductionReleaseV1;
};

export type CapabilityStatusItemV1 = {
  key: InstitutionCapabilityKeyV1;
  /**
   * Final display/interaction projection for the current server-side AccessContext. Consumers
   * must not recalculate it or reuse it across actors.
   */
  decision: CapabilityStatusDecisionV1;
  dimensions: CapabilityStatusDimensionsV1;
  /**
   * Provider-validated low-sensitivity business text or null, limited to
   * CAPABILITY_STATUS_SAFE_SUMMARY_MAX_LENGTH_V1 Unicode code points. It never contains provider,
   * adapter, endpoint, credential, environment, raw exception, customer, message, payment, or
   * treatment content. This declaration does not sanitize or length-check an untrusted string.
   */
  safeSummary: string | null;
  /** Registry key only; consumers resolve its canonical route and never accept a provider URL. */
  diagnosticTargetKey: InstitutionDiagnosticTargetCapabilityKeyV1 | null;
};

export type CapabilityStatusPayloadV1 = {
  capabilities: CapabilityStatusItemV1[];
};

/**
 * Frozen V1 wire shape only. It is not a parser, reader, authorizer, or capability evaluator.
 *
 * The source envelope reports whether the authoritative capability evaluation itself is usable.
 * `decision` is the server-side display/interaction conclusion. `dimensions` explain the distinct
 * code, institution, connection, business-data, and release inputs. None of those layers grants a
 * target operation: `operational` is only a necessary entry condition, and the target page/API
 * must reauthorize the current scope, role, capability, object, and business prerequisites.
 * In particular, an action capability key with `operational` never authorizes that action by
 * itself; the target action must perform that independent reauthorization.
 *
 * A stale source is at most `read_only`. Denied, disabled, and scope-mismatch responses carry
 * `data: null`. Cross-field enforcement, partition coverage, freshness validation, low-sensitivity
 * text validation, uniqueness, registry membership, section/page/action decision consistency,
 * and diagnostic-target reachability for the current AccessContext require the separately
 * approved runtime evaluator/reader/parser. Consumers must never derive a replacement decision
 * from the five dimensions or treat a diagnostic target key as page authorization.
 */
export type CapabilityStatusV1 = InstitutionSourceEnvelopeV1<
  CapabilityStatusPayloadV1,
  InstitutionCapabilityKeyV1
>;

/** Scalar vocabulary guard only; not a capability item or envelope parser. */
export function isCapabilityStatusDecisionV1(
  value: unknown,
): value is CapabilityStatusDecisionV1 {
  return CAPABILITY_STATUS_DECISIONS_V1.some((candidate) => candidate === value);
}

/** Scalar vocabulary guard only; not a capability item or envelope parser. */
export function isCapabilityStatusCodeMaturityV1(
  value: unknown,
): value is CapabilityStatusCodeMaturityV1 {
  return CAPABILITY_STATUS_CODE_MATURITY_VALUES_V1.some(
    (candidate) => candidate === value,
  );
}

/** Scalar vocabulary guard only; not a capability item or envelope parser. */
export function isCapabilityStatusInstitutionAuthorizationV1(
  value: unknown,
): value is CapabilityStatusInstitutionAuthorizationV1 {
  return CAPABILITY_STATUS_INSTITUTION_AUTHORIZATION_VALUES_V1.some(
    (candidate) => candidate === value,
  );
}

/** Scalar vocabulary guard only; not a capability item or envelope parser. */
export function isCapabilityStatusConnectionAvailabilityV1(
  value: unknown,
): value is CapabilityStatusConnectionAvailabilityV1 {
  return CAPABILITY_STATUS_CONNECTION_AVAILABILITY_VALUES_V1.some(
    (candidate) => candidate === value,
  );
}

/** Scalar vocabulary guard only; not a capability item or envelope parser. */
export function isCapabilityStatusDataReadinessV1(
  value: unknown,
): value is CapabilityStatusDataReadinessV1 {
  return CAPABILITY_STATUS_DATA_READINESS_VALUES_V1.some(
    (candidate) => candidate === value,
  );
}

/** Scalar vocabulary guard only; not a capability item or envelope parser. */
export function isCapabilityStatusProductionReleaseV1(
  value: unknown,
): value is CapabilityStatusProductionReleaseV1 {
  return CAPABILITY_STATUS_PRODUCTION_RELEASE_VALUES_V1.some(
    (candidate) => candidate === value,
  );
}
