import {
  computeProvisioningManifestDigest,
  PROVISIONING_MANIFEST_VERSION,
  sortProvisioningEntries,
  type ProvisioningCanonicalEntryV1,
  type ProvisioningCanonicalManifestV1,
  type ProvisioningContextSourceV1,
  type ProvisioningScopeStatusV1,
} from './provisioning-canonicalization';
import type {
  ProvisioningContextHeadRowV1,
  ProvisioningContextVersionRowV1,
  ProvisioningExpectedTripletV1,
  ProvisioningScopeRowV1,
} from './provisioning-ports';

const MANIFEST_KEYS = Object.freeze([
  'approvalStatus',
  'approvedAt',
  'approvedByReference',
  'digest',
  'entries',
  'manifestVersion',
]);
const ENTRY_KEYS = Object.freeze([
  'contextHeadRevision',
  'contextSource',
  'contextVersion',
  'currency',
  'effectiveAt',
  'effectiveFromBusinessDate',
  'institutionId',
  'latestVersion',
  'provisioningSource',
  'scopeRevision',
  'scopeStatus',
  'tenantId',
  'timezone',
]);
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const APPROVAL_REFERENCE_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CANONICAL_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const FORBIDDEN_SENSITIVE_REFERENCE_PATTERN =
  /^(?:https?|postgres(?:ql)?|mysql|mongodb|redis):|(?:^|[._:-])(?:api[_-]?key|citizen[_-]?id|database[_-]?url|id[_-]?card|mobile|password|passwd|phone|secret|token|sk-(?:proj|svcacct)?)(?:[._:-]|$)/i;
const parsedProvisioningManifests = new WeakSet<object>();

export interface ProvisioningContextPolicyV1 {
  readonly timezones: readonly string[];
  readonly currencies: readonly string[];
}

declare const parsedManifestBrand: unique symbol;
export interface ProvisioningManifestV1
  extends ProvisioningCanonicalManifestV1 {
  readonly digest: `sha256:${string}`;
  readonly databaseDigest: string;
  readonly [parsedManifestBrand]: true;
}

export class ProvisioningManifestError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ProvisioningManifestError';
  }
}

function fail(code: string): never {
  throw new ProvisioningManifestError(code);
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

function requireLiteral<T extends string | number>(
  value: unknown,
  expected: T,
  code: string,
): T {
  if (value !== expected) {
    fail(code);
  }
  return expected;
}

function requireEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  code: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail(code);
  }
  return value as T;
}

function requireCanonicalInstant(value: unknown, code: string): string {
  const instant = requireSafeNfcString(value, CANONICAL_INSTANT_PATTERN, code);
  if (Number.isNaN(Date.parse(instant)) || new Date(instant).toISOString() !== instant) {
    fail(code);
  }
  return instant;
}

function requireBusinessDate(value: unknown): string {
  const businessDate = requireSafeNfcString(
    value,
    BUSINESS_DATE_PATTERN,
    'manifest_business_date_invalid',
  );
  const [year, month, day] = businessDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    fail('manifest_business_date_invalid');
  }
  return businessDate;
}

function buildApprovedSet(
  values: readonly string[],
  validate: (value: string) => boolean,
  code: string,
): ReadonlySet<string> {
  if (!Array.isArray(values) || values.length === 0) {
    fail(code);
  }
  const result = new Set<string>();
  for (const value of values) {
    if (
      typeof value !== 'string' ||
      value.normalize('NFC') !== value ||
      !validate(value) ||
      result.has(value)
    ) {
      fail(code);
    }
    result.add(value);
  }
  return result;
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

function parseEntry(
  value: unknown,
  approvedTimezones: ReadonlySet<string>,
  approvedCurrencies: ReadonlySet<string>,
): ProvisioningCanonicalEntryV1 {
  if (!isRecord(value)) {
    fail('manifest_entry_invalid');
  }
  requireExactKeys(value, ENTRY_KEYS, 'manifest_entry_shape_invalid');

  const tenantId = requireLowSensitiveReference(
    value.tenantId,
    IDENTIFIER_PATTERN,
    'manifest_tenant_id_invalid',
  );
  const institutionId = requireLowSensitiveReference(
    value.institutionId,
    IDENTIFIER_PATTERN,
    'manifest_institution_id_invalid',
  );
  const timezone = requireSafeNfcString(
    value.timezone,
    /^[A-Za-z0-9_+\-/]{1,64}$/,
    'manifest_timezone_invalid',
  );
  const currency = requireSafeNfcString(
    value.currency,
    CURRENCY_PATTERN,
    'manifest_currency_invalid',
  );
  if (!approvedTimezones.has(timezone)) {
    fail('manifest_timezone_not_approved');
  }
  if (!approvedCurrencies.has(currency)) {
    fail('manifest_currency_not_approved');
  }

  const effectiveFromBusinessDate = requireBusinessDate(
    value.effectiveFromBusinessDate,
  );
  const effectiveAt = requireCanonicalInstant(
    value.effectiveAt,
    'manifest_effective_at_invalid',
  );
  if (businessDateAt(effectiveAt, timezone) !== effectiveFromBusinessDate) {
    fail('manifest_effective_date_mismatch');
  }

  return Object.freeze({
    tenantId,
    institutionId,
    scopeStatus: requireEnum<ProvisioningScopeStatusV1>(
      value.scopeStatus,
      ['active', 'suspended'],
      'manifest_scope_status_invalid',
    ),
    scopeRevision: requireLiteral(
      value.scopeRevision,
      1,
      'manifest_scope_revision_invalid',
    ),
    provisioningSource: requireLiteral(
      value.provisioningSource,
      'approved_migration_manifest',
      'manifest_provisioning_source_invalid',
    ),
    contextVersion: requireLiteral(
      value.contextVersion,
      1,
      'manifest_context_version_invalid',
    ),
    contextHeadRevision: requireLiteral(
      value.contextHeadRevision,
      1,
      'manifest_context_head_revision_invalid',
    ),
    latestVersion: requireLiteral(
      value.latestVersion,
      1,
      'manifest_latest_version_invalid',
    ),
    contextSource: requireEnum<ProvisioningContextSourceV1>(
      value.contextSource,
      ['institution_config', 'product_default'],
      'manifest_context_source_invalid',
    ),
    timezone,
    currency,
    effectiveFromBusinessDate,
    effectiveAt,
  });
}

export function parseProvisioningManifest(
  value: unknown,
  options: { readonly contextPolicy: ProvisioningContextPolicyV1 },
): ProvisioningManifestV1 {
  if (!isRecord(value)) {
    fail('manifest_invalid');
  }
  requireExactKeys(value, MANIFEST_KEYS, 'manifest_shape_invalid');
  requireLiteral(
    value.manifestVersion,
    PROVISIONING_MANIFEST_VERSION,
    'manifest_version_invalid',
  );
  requireLiteral(
    value.approvalStatus,
    'approved',
    'manifest_not_approved',
  );
  const approvedByReference = requireLowSensitiveReference(
    value.approvedByReference,
    APPROVAL_REFERENCE_PATTERN,
    'manifest_approval_reference_invalid',
  );
  const approvedAt = requireCanonicalInstant(
    value.approvedAt,
    'manifest_approved_at_invalid',
  );
  const digest = requireSafeNfcString(
    value.digest,
    DIGEST_PATTERN,
    'manifest_digest_invalid',
  ) as `sha256:${string}`;
  if (!Array.isArray(value.entries) || value.entries.length === 0) {
    fail('manifest_entries_invalid');
  }

  const approvedTimezones = buildApprovedSet(
    options.contextPolicy.timezones,
    isRegisteredTimezone,
    'context_timezone_policy_invalid',
  );
  const approvedCurrencies = buildApprovedSet(
    options.contextPolicy.currencies,
    (currency) =>
      CURRENCY_PATTERN.test(currency) && isRegisteredCurrency(currency),
    'context_currency_policy_invalid',
  );
  const entries = value.entries.map((entry) =>
    parseEntry(entry, approvedTimezones, approvedCurrencies),
  );
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = JSON.stringify([entry.tenantId, entry.institutionId]);
    if (seen.has(key)) {
      fail('manifest_duplicate_scope');
    }
    seen.add(key);
  }

  const canonicalManifest: ProvisioningCanonicalManifestV1 = {
    manifestVersion: PROVISIONING_MANIFEST_VERSION,
    approvalStatus: 'approved',
    approvedByReference,
    approvedAt,
    entries,
  };
  const computed = computeProvisioningManifestDigest(canonicalManifest);
  if (digest !== computed.external) {
    fail('manifest_digest_mismatch');
  }

  const parsed = Object.freeze({
    ...canonicalManifest,
    entries: Object.freeze(sortProvisioningEntries(entries)),
    digest,
    databaseDigest: computed.database,
  }) as ProvisioningManifestV1;
  parsedProvisioningManifests.add(parsed);
  return parsed;
}

export function assertParsedProvisioningManifest(
  value: unknown,
): asserts value is ProvisioningManifestV1 {
  if (
    value === null ||
    typeof value !== 'object' ||
    !parsedProvisioningManifests.has(value)
  ) {
    fail('manifest_not_parsed');
  }
}

export function toProvisioningExpectedTriplet(
  manifest: ProvisioningManifestV1,
  entry: ProvisioningCanonicalEntryV1,
): ProvisioningExpectedTripletV1 {
  assertParsedProvisioningManifest(manifest);
  if (!manifest.entries.includes(entry)) {
    fail('manifest_entry_not_parsed');
  }
  const scope: ProvisioningScopeRowV1 = Object.freeze({
    tenantId: entry.tenantId,
    institutionId: entry.institutionId,
    status: entry.scopeStatus,
    revision: entry.scopeRevision,
    provisioningSource: entry.provisioningSource,
    provisioningReferenceDigest: manifest.databaseDigest,
    approvedBy: manifest.approvedByReference,
    approvedAt: manifest.approvedAt,
  });
  const version: ProvisioningContextVersionRowV1 = Object.freeze({
    tenantId: entry.tenantId,
    institutionId: entry.institutionId,
    version: entry.contextVersion,
    timezone: entry.timezone,
    currency: entry.currency,
    effectiveFromBusinessDate: entry.effectiveFromBusinessDate,
    effectiveAt: entry.effectiveAt,
    source: entry.contextSource,
    migrationProvenance: null,
    createdBy: manifest.approvedByReference,
  });
  const head: ProvisioningContextHeadRowV1 = Object.freeze({
    tenantId: entry.tenantId,
    institutionId: entry.institutionId,
    revision: entry.contextHeadRevision,
    latestVersion: entry.latestVersion,
    updatedBy: manifest.approvedByReference,
  });

  return Object.freeze({ scope, version, head });
}
