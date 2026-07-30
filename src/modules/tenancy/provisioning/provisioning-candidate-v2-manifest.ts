import {
  computeProvisioningCandidateV2ManifestDigest,
  PROVISIONING_CANDIDATE_V2_MANIFEST_VERSION,
  PROVISIONING_CANDIDATE_V2_SOURCE_TYPE,
  PROVISIONING_CANDIDATE_V2_SOURCE_VERSION,
  sortProvisioningCandidateV2Entries,
  type ProvisioningCandidateV2CanonicalManifest,
  type ProvisioningCandidateV2Context,
  type ProvisioningCandidateV2Entry,
  type ProvisioningCandidateV2ScopeStatus,
  type ProvisioningCandidateV2SourceDescriptor,
} from './provisioning-candidate-v2-canonicalization';
import {
  PROVISIONING_CONTEXT_POLICY_CURRENCIES,
  PROVISIONING_CONTEXT_POLICY_TARGET_ENVIRONMENT,
  PROVISIONING_CONTEXT_POLICY_TIMEZONES,
  PROVISIONING_CONTEXT_POLICY_VERSION,
} from './provisioning-context-policy';

const MANIFEST_KEYS = Object.freeze([
  'candidateDigest',
  'candidateSource',
  'candidateStatus',
  'entries',
  'generatedAt',
  'generatedByReference',
  'manifestVersion',
]);
const SOURCE_DESCRIPTOR_KEYS = Object.freeze([
  'sourceAuthorizationReference',
  'sourceDigest',
  'sourceType',
  'sourceVersion',
]);
const ENTRY_KEYS = Object.freeze([
  'contextCandidate',
  'currency',
  'effectiveAt',
  'effectiveFromBusinessDate',
  'institutionReference',
  'scopeStatusCandidate',
  'tenantReference',
  'timezone',
]);
const APPROVAL_FIELDS = Object.freeze([
  'approvalStatus',
  'approvedAt',
  'approvedByReference',
]);
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const SCOPE_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CANONICAL_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const FORBIDDEN_SENSITIVE_REFERENCE_PATTERN =
  /^(?:https?|postgres(?:ql)?|mysql|mongodb|redis):|(?:^|[._:-])(?:api[_-]?key|citizen[_-]?id|database[_-]?url|id[_-]?card|mobile|password|passwd|phone|secret|token|sk-(?:proj|svcacct)?)(?:[._:-]|$)/i;
const CONTEXT_POLICY_KEYS = Object.freeze([
  'currencies',
  'policyVersion',
  'targetEnvironment',
  'timezones',
]);

export interface ProvisioningCandidateV2ContextPolicy {
  readonly policyVersion: typeof PROVISIONING_CONTEXT_POLICY_VERSION;
  readonly targetEnvironment: typeof PROVISIONING_CONTEXT_POLICY_TARGET_ENVIRONMENT;
  readonly timezones: typeof PROVISIONING_CONTEXT_POLICY_TIMEZONES;
  readonly currencies: typeof PROVISIONING_CONTEXT_POLICY_CURRENCIES;
}

declare const parsedCandidateV2ManifestBrand: unique symbol;
export interface ProvisioningCandidateV2Manifest
  extends ProvisioningCandidateV2CanonicalManifest {
  readonly candidateDigest: `sha256:${string}`;
  readonly [parsedCandidateV2ManifestBrand]: true;
}

declare const parsedCandidateV2ReviewStateBrand: unique symbol;
export type ProvisioningCandidateV2ReviewState = Readonly<
  (
    | {
        readonly candidateDigest: `sha256:${string}`;
        readonly generatedByReference: string;
        readonly reviewStatus: 'generated';
        readonly reviewerReference: null;
      }
    | {
        readonly candidateDigest: `sha256:${string}`;
        readonly generatedByReference: string;
        readonly reviewStatus: 'review_pending';
        readonly reviewerReference: string;
      }
  ) & {
    readonly [parsedCandidateV2ReviewStateBrand]: true;
  }
>;

const parsedCandidateV2Manifests = new WeakSet<object>();
const parsedCandidateV2ReviewStates = new WeakSet<object>();

export class ProvisioningCandidateV2ManifestError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ProvisioningCandidateV2ManifestError';
  }
}

function fail(code: string): never {
  throw new ProvisioningCandidateV2ManifestError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  code: string,
): void {
  const actual = Object.keys(value).sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail(code);
  }
}

function requireSafeNfcString(
  value: unknown,
  pattern: RegExp,
  code: string,
): string {
  if (typeof value !== 'string' || !pattern.test(value)) {
    fail(code);
  }
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) {
        fail(code);
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      fail(code);
    }
  }
  if (value.normalize('NFC') !== value) {
    fail(code);
  }
  return value;
}

function requireLowSensitiveReference(
  value: unknown,
  pattern: RegExp,
  code: string,
): string {
  const result = requireSafeNfcString(value, pattern, code);
  const compactDigits = result.replace(/[._:-]/g, '');
  if (
    FORBIDDEN_SENSITIVE_REFERENCE_PATTERN.test(result) ||
    /^(?:1[3-9]\d{9}|\d{15}|\d{16,19}|\d{17}[0-9Xx])$/.test(
      compactDigits,
    )
  ) {
    fail(code);
  }
  return result;
}

function requireCanonicalInstant(value: unknown, code: string): string {
  const instant = requireSafeNfcString(value, CANONICAL_INSTANT_PATTERN, code);
  if (
    Number.isNaN(Date.parse(instant)) ||
    new Date(instant).toISOString() !== instant
  ) {
    fail(code);
  }
  return instant;
}

function requireBusinessDate(value: unknown): string {
  const businessDate = requireSafeNfcString(
    value,
    BUSINESS_DATE_PATTERN,
    'provisioning_candidate_v2_business_date_invalid',
  );
  const [year, month, day] = businessDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    fail('provisioning_candidate_v2_business_date_invalid');
  }
  return businessDate;
}

function isRegisteredTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

function isRegisteredCurrency(value: string): boolean {
  return (
    typeof Intl.supportedValuesOf === 'function' &&
    Intl.supportedValuesOf('currency').includes(value)
  );
}

function requireCandidateV2ContextPolicy(
  value: unknown,
): ProvisioningCandidateV2ContextPolicy {
  if (!isRecord(value)) {
    fail('provisioning_candidate_v2_context_policy_invalid');
  }
  requireExactKeys(
    value,
    CONTEXT_POLICY_KEYS,
    'provisioning_candidate_v2_context_policy_invalid',
  );
  if (value.policyVersion !== PROVISIONING_CONTEXT_POLICY_VERSION) {
    fail('provisioning_candidate_v2_context_policy_invalid');
  }
  if (
    value.targetEnvironment !==
    PROVISIONING_CONTEXT_POLICY_TARGET_ENVIRONMENT
  ) {
    fail('provisioning_candidate_v2_context_policy_environment_invalid');
  }
  if (
    !Array.isArray(value.timezones) ||
    value.timezones.length !== 1 ||
    value.timezones[0] !== PROVISIONING_CONTEXT_POLICY_TIMEZONES[0] ||
    !isRegisteredTimezone(value.timezones[0])
  ) {
    fail('provisioning_candidate_v2_context_timezone_policy_invalid');
  }
  if (
    !Array.isArray(value.currencies) ||
    value.currencies.length !== 1 ||
    value.currencies[0] !== PROVISIONING_CONTEXT_POLICY_CURRENCIES[0] ||
    !isRegisteredCurrency(value.currencies[0])
  ) {
    fail('provisioning_candidate_v2_context_currency_policy_invalid');
  }
  return Object.freeze({
    policyVersion: PROVISIONING_CONTEXT_POLICY_VERSION,
    targetEnvironment: PROVISIONING_CONTEXT_POLICY_TARGET_ENVIRONMENT,
    timezones: PROVISIONING_CONTEXT_POLICY_TIMEZONES,
    currencies: PROVISIONING_CONTEXT_POLICY_CURRENCIES,
  });
}

function businessDateAt(instant: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get('year')}-${byType.get('month')}-${byType.get('day')}`;
}

function parseCandidateV2SourceDescriptor(
  value: unknown,
): ProvisioningCandidateV2SourceDescriptor {
  if (!isRecord(value)) {
    fail('provisioning_candidate_v2_source_descriptor_invalid');
  }
  requireExactKeys(
    value,
    SOURCE_DESCRIPTOR_KEYS,
    'provisioning_candidate_v2_source_descriptor_shape_invalid',
  );
  if (value.sourceVersion !== PROVISIONING_CANDIDATE_V2_SOURCE_VERSION) {
    fail('provisioning_candidate_v2_source_version_invalid');
  }
  if (value.sourceType !== PROVISIONING_CANDIDATE_V2_SOURCE_TYPE) {
    fail('provisioning_candidate_v2_source_type_invalid');
  }
  const sourceAuthorizationReference = requireLowSensitiveReference(
    value.sourceAuthorizationReference,
    REFERENCE_PATTERN,
    'provisioning_candidate_v2_source_authorization_reference_invalid',
  );
  const sourceDigest = requireSafeNfcString(
    value.sourceDigest,
    DIGEST_PATTERN,
    'provisioning_candidate_v2_source_digest_invalid',
  ) as `sha256:${string}`;

  return Object.freeze({
    sourceVersion: PROVISIONING_CANDIDATE_V2_SOURCE_VERSION,
    sourceType: PROVISIONING_CANDIDATE_V2_SOURCE_TYPE,
    sourceAuthorizationReference,
    sourceDigest,
  });
}

export function parseProvisioningCandidateV2Entry(
  value: unknown,
  options: {
    readonly contextPolicy: ProvisioningCandidateV2ContextPolicy;
  },
): ProvisioningCandidateV2Entry {
  if (!isRecord(value)) {
    fail('provisioning_candidate_v2_entry_invalid');
  }
  requireExactKeys(
    value,
    ENTRY_KEYS,
    'provisioning_candidate_v2_entry_shape_invalid',
  );

  const tenantReference = requireLowSensitiveReference(
    value.tenantReference,
    SCOPE_REFERENCE_PATTERN,
    'provisioning_candidate_v2_tenant_reference_invalid',
  );
  const institutionReference = requireLowSensitiveReference(
    value.institutionReference,
    SCOPE_REFERENCE_PATTERN,
    'provisioning_candidate_v2_institution_reference_invalid',
  );
  const timezone = requireSafeNfcString(
    value.timezone,
    /^[A-Za-z0-9_+\-/]{1,64}$/,
    'provisioning_candidate_v2_timezone_invalid',
  );
  const currency = requireSafeNfcString(
    value.currency,
    CURRENCY_PATTERN,
    'provisioning_candidate_v2_currency_invalid',
  );
  const contextPolicy = requireCandidateV2ContextPolicy(
    options?.contextPolicy,
  );
  if (timezone !== contextPolicy.timezones[0]) {
    fail('provisioning_candidate_v2_timezone_not_allowed');
  }
  if (currency !== contextPolicy.currencies[0]) {
    fail('provisioning_candidate_v2_currency_not_allowed');
  }

  const effectiveFromBusinessDate = requireBusinessDate(
    value.effectiveFromBusinessDate,
  );
  const effectiveAt = requireCanonicalInstant(
    value.effectiveAt,
    'provisioning_candidate_v2_effective_at_invalid',
  );
  if (businessDateAt(effectiveAt, timezone) !== effectiveFromBusinessDate) {
    fail('provisioning_candidate_v2_effective_date_mismatch');
  }

  if (
    value.scopeStatusCandidate !== 'active' &&
    value.scopeStatusCandidate !== 'suspended'
  ) {
    fail('provisioning_candidate_v2_scope_status_invalid');
  }
  if (
    value.contextCandidate !== 'institution_config' &&
    value.contextCandidate !== 'product_default'
  ) {
    fail('provisioning_candidate_v2_context_candidate_invalid');
  }

  return Object.freeze({
    tenantReference,
    institutionReference,
    scopeStatusCandidate:
      value.scopeStatusCandidate as ProvisioningCandidateV2ScopeStatus,
    contextCandidate: value.contextCandidate as ProvisioningCandidateV2Context,
    timezone,
    currency,
    effectiveFromBusinessDate,
    effectiveAt,
  });
}

function rejectDuplicateEntries(
  entries: readonly ProvisioningCandidateV2Entry[],
): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = JSON.stringify([
      entry.tenantReference,
      entry.institutionReference,
    ]);
    if (seen.has(key)) {
      fail('provisioning_candidate_v2_duplicate_scope');
    }
    seen.add(key);
  }
}

export function parseProvisioningCandidateV2Manifest(
  value: unknown,
  options: {
    readonly contextPolicy: ProvisioningCandidateV2ContextPolicy;
  },
): ProvisioningCandidateV2Manifest {
  if (!isRecord(value)) {
    fail('provisioning_candidate_v2_manifest_invalid');
  }
  if (APPROVAL_FIELDS.some((field) => Object.hasOwn(value, field))) {
    fail('provisioning_candidate_v2_approval_field_forbidden');
  }
  requireExactKeys(
    value,
    MANIFEST_KEYS,
    'provisioning_candidate_v2_manifest_shape_invalid',
  );
  if (value.manifestVersion !== PROVISIONING_CANDIDATE_V2_MANIFEST_VERSION) {
    fail('provisioning_candidate_v2_manifest_version_invalid');
  }
  if (value.candidateStatus === 'approved') {
    fail('provisioning_candidate_v2_approved_forbidden');
  }
  if (value.candidateStatus !== 'candidate') {
    fail('provisioning_candidate_v2_status_invalid');
  }
  const candidateSource = parseCandidateV2SourceDescriptor(
    value.candidateSource,
  );
  const generatedAt = requireCanonicalInstant(
    value.generatedAt,
    'provisioning_candidate_v2_generated_at_invalid',
  );
  const generatedByReference = requireLowSensitiveReference(
    value.generatedByReference,
    REFERENCE_PATTERN,
    'provisioning_candidate_v2_generated_by_reference_invalid',
  );
  const candidateDigest = requireSafeNfcString(
    value.candidateDigest,
    DIGEST_PATTERN,
    'provisioning_candidate_v2_digest_invalid',
  ) as `sha256:${string}`;
  if (!Array.isArray(value.entries) || value.entries.length === 0) {
    fail('provisioning_candidate_v2_entries_invalid');
  }
  const entries = value.entries.map((entry) =>
    parseProvisioningCandidateV2Entry(entry, options),
  );
  rejectDuplicateEntries(entries);

  const canonicalManifest: ProvisioningCandidateV2CanonicalManifest = {
    manifestVersion: PROVISIONING_CANDIDATE_V2_MANIFEST_VERSION,
    candidateStatus: 'candidate',
    candidateSource,
    generatedAt,
    generatedByReference,
    entries,
  };
  const computed =
    computeProvisioningCandidateV2ManifestDigest(canonicalManifest);
  if (candidateDigest !== computed.candidateDigest) {
    fail('provisioning_candidate_v2_digest_mismatch');
  }

  const parsed = Object.freeze({
    ...canonicalManifest,
    entries: Object.freeze(sortProvisioningCandidateV2Entries(entries)),
    candidateDigest,
  }) as ProvisioningCandidateV2Manifest;
  parsedCandidateV2Manifests.add(parsed);
  return parsed;
}

export function assertParsedProvisioningCandidateV2Manifest(
  value: unknown,
): asserts value is ProvisioningCandidateV2Manifest {
  if (
    value === null ||
    typeof value !== 'object' ||
    !parsedCandidateV2Manifests.has(value)
  ) {
    fail('provisioning_candidate_v2_not_parsed');
  }
}

export function createGeneratedCandidateV2ReviewState(
  manifest: ProvisioningCandidateV2Manifest,
): ProvisioningCandidateV2ReviewState {
  assertParsedProvisioningCandidateV2Manifest(manifest);
  const state = Object.freeze({
    candidateDigest: manifest.candidateDigest,
    generatedByReference: manifest.generatedByReference,
    reviewStatus: 'generated',
    reviewerReference: null,
  }) as ProvisioningCandidateV2ReviewState;
  parsedCandidateV2ReviewStates.add(state);
  return state;
}

export function assertParsedProvisioningCandidateV2ReviewState(
  value: unknown,
): asserts value is ProvisioningCandidateV2ReviewState {
  if (
    value === null ||
    typeof value !== 'object' ||
    !parsedCandidateV2ReviewStates.has(value)
  ) {
    fail('provisioning_candidate_v2_review_state_invalid');
  }
}

export function markCandidateV2ReviewPending(
  state: ProvisioningCandidateV2ReviewState,
  input: { readonly reviewerReference: string },
): ProvisioningCandidateV2ReviewState {
  assertParsedProvisioningCandidateV2ReviewState(state);
  if (state.reviewStatus !== 'generated') {
    fail('provisioning_candidate_v2_review_transition_invalid');
  }
  const reviewerReference = requireLowSensitiveReference(
    input.reviewerReference,
    REFERENCE_PATTERN,
    'provisioning_candidate_v2_reviewer_reference_invalid',
  );
  if (reviewerReference === state.generatedByReference) {
    fail('provisioning_candidate_v2_reviewer_generator_conflict');
  }
  const next = Object.freeze({
    candidateDigest: state.candidateDigest,
    generatedByReference: state.generatedByReference,
    reviewStatus: 'review_pending',
    reviewerReference,
  }) as ProvisioningCandidateV2ReviewState;
  parsedCandidateV2ReviewStates.add(next);
  return next;
}
