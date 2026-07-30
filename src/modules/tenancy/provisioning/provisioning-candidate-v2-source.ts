import {
  computeProvisioningCandidateV2ManifestDigest,
  computeProvisioningCandidateV2SourceDigest,
  PROVISIONING_CANDIDATE_V2_MANIFEST_VERSION,
  PROVISIONING_CANDIDATE_V2_SOURCE_TYPE,
  PROVISIONING_CANDIDATE_V2_SOURCE_VERSION,
  sortProvisioningCandidateV2Entries,
  type ProvisioningCandidateV2CanonicalManifest,
  type ProvisioningCandidateV2CanonicalSource,
  type ProvisioningCandidateV2Entry,
} from './provisioning-candidate-v2-canonicalization';
import {
  parseProvisioningCandidateV2Entry,
  parseProvisioningCandidateV2Manifest,
  type ProvisioningCandidateV2ContextPolicy,
  type ProvisioningCandidateV2Manifest,
} from './provisioning-candidate-v2-manifest';

const SOURCE_KEYS = Object.freeze([
  'entries',
  'sourceAuthorizationReference',
  'sourceAuthorizedAt',
  'sourceDigest',
  'sourceType',
  'sourceVersion',
]);
const FORBIDDEN_GOVERNANCE_FIELDS = Object.freeze([
  'DATABASE_URL',
  'approvalStatus',
  'approvedAt',
  'approvedByReference',
  'candidateDigest',
  'candidateStatus',
  'connectionString',
  'databaseConnection',
  'databaseUrl',
  'description',
  'executionLease',
  'lease',
  'notes',
  'operatorCredential',
  'reviewStatus',
  'reviewerReference',
  'secret',
  'token',
  'url',
]);
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const CANONICAL_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const FORBIDDEN_SENSITIVE_REFERENCE_PATTERN =
  /^(?:https?|postgres(?:ql)?|mysql|mongodb|redis):|(?:^|[._:-])(?:api[_-]?key|citizen[_-]?id|database[_-]?url|id[_-]?card|mobile|password|passwd|phone|secret|token|sk-(?:proj|svcacct)?)(?:[._:-]|$)/i;

declare const parsedCandidateV2SourceBrand: unique symbol;
export interface ProvisioningCandidateV2Source
  extends ProvisioningCandidateV2CanonicalSource {
  readonly sourceDigest: `sha256:${string}`;
  readonly [parsedCandidateV2SourceBrand]: true;
}

const parsedCandidateV2Sources = new WeakSet<object>();

export class ProvisioningCandidateV2SourceError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ProvisioningCandidateV2SourceError';
  }
}

function fail(code: string): never {
  throw new ProvisioningCandidateV2SourceError(code);
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
  if (
    typeof value !== 'string' ||
    !pattern.test(value) ||
    value.normalize('NFC') !== value
  ) {
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
  return value;
}

function requireLowSensitiveReference(
  value: unknown,
  code: string,
): string {
  const result = requireSafeNfcString(value, REFERENCE_PATTERN, code);
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
      fail('provisioning_candidate_v2_source_duplicate_scope');
    }
    seen.add(key);
  }
}

export function parseProvisioningCandidateV2Source(
  value: unknown,
  options: {
    readonly contextPolicy: ProvisioningCandidateV2ContextPolicy;
  },
): ProvisioningCandidateV2Source {
  if (!isRecord(value)) {
    fail('provisioning_candidate_v2_source_invalid');
  }
  if (
    FORBIDDEN_GOVERNANCE_FIELDS.some((field) => Object.hasOwn(value, field))
  ) {
    fail('provisioning_candidate_v2_source_governance_field_forbidden');
  }
  requireExactKeys(
    value,
    SOURCE_KEYS,
    'provisioning_candidate_v2_source_shape_invalid',
  );
  if (value.sourceVersion !== PROVISIONING_CANDIDATE_V2_SOURCE_VERSION) {
    fail('provisioning_candidate_v2_source_version_invalid');
  }
  if (value.sourceType !== PROVISIONING_CANDIDATE_V2_SOURCE_TYPE) {
    fail('provisioning_candidate_v2_source_type_invalid');
  }
  const sourceAuthorizationReference = requireLowSensitiveReference(
    value.sourceAuthorizationReference,
    'provisioning_candidate_v2_source_authorization_reference_invalid',
  );
  const sourceAuthorizedAt = requireCanonicalInstant(
    value.sourceAuthorizedAt,
    'provisioning_candidate_v2_source_authorized_at_invalid',
  );
  const sourceDigest = requireSafeNfcString(
    value.sourceDigest,
    DIGEST_PATTERN,
    'provisioning_candidate_v2_source_digest_invalid',
  ) as `sha256:${string}`;
  if (!Array.isArray(value.entries) || value.entries.length === 0) {
    fail('provisioning_candidate_v2_source_entries_invalid');
  }
  const entries = value.entries.map((entry) =>
    parseProvisioningCandidateV2Entry(entry, options),
  );
  rejectDuplicateEntries(entries);

  const canonicalSource: ProvisioningCandidateV2CanonicalSource = {
    sourceVersion: PROVISIONING_CANDIDATE_V2_SOURCE_VERSION,
    sourceType: PROVISIONING_CANDIDATE_V2_SOURCE_TYPE,
    sourceAuthorizationReference,
    sourceAuthorizedAt,
    entries,
  };
  const computed = computeProvisioningCandidateV2SourceDigest(canonicalSource);
  if (sourceDigest !== computed.sourceDigest) {
    fail('provisioning_candidate_v2_source_digest_mismatch');
  }

  const parsed = Object.freeze({
    ...canonicalSource,
    entries: Object.freeze(sortProvisioningCandidateV2Entries(entries)),
    sourceDigest,
  }) as ProvisioningCandidateV2Source;
  parsedCandidateV2Sources.add(parsed);
  return parsed;
}

export function assertParsedProvisioningCandidateV2Source(
  value: unknown,
): asserts value is ProvisioningCandidateV2Source {
  if (
    value === null ||
    typeof value !== 'object' ||
    !parsedCandidateV2Sources.has(value)
  ) {
    fail('provisioning_candidate_v2_source_not_parsed');
  }
}

export function createProvisioningCandidateV2FromSource(
  source: ProvisioningCandidateV2Source,
  input: {
    readonly generatedAt: string;
    readonly generatedByReference: string;
  },
  options: {
    readonly contextPolicy: ProvisioningCandidateV2ContextPolicy;
  },
): ProvisioningCandidateV2Manifest {
  assertParsedProvisioningCandidateV2Source(source);
  const canonicalManifest: ProvisioningCandidateV2CanonicalManifest = {
    manifestVersion: PROVISIONING_CANDIDATE_V2_MANIFEST_VERSION,
    candidateStatus: 'candidate',
    candidateSource: Object.freeze({
      sourceVersion: source.sourceVersion,
      sourceType: source.sourceType,
      sourceAuthorizationReference: source.sourceAuthorizationReference,
      sourceDigest: source.sourceDigest,
    }),
    generatedAt: input.generatedAt,
    generatedByReference: input.generatedByReference,
    entries: source.entries,
  };
  const digest =
    computeProvisioningCandidateV2ManifestDigest(canonicalManifest);
  return parseProvisioningCandidateV2Manifest(
    {
      ...canonicalManifest,
      candidateDigest: digest.candidateDigest,
    },
    options,
  );
}
