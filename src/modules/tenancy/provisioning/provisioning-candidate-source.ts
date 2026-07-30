import {
  computeProvisioningCandidateManifestDigest,
  PROVISIONING_CANDIDATE_MANIFEST_VERSION,
  PROVISIONING_CANDIDATE_SOURCE_TYPE,
  PROVISIONING_CANDIDATE_SOURCE_VERSION,
  sortProvisioningCandidateEntries,
  type ProvisioningCandidateCanonicalManifestV1,
  type ProvisioningCandidateEntryV1,
} from './provisioning-candidate-canonicalization';
import {
  parseProvisioningCandidateEntry,
  parseProvisioningCandidateManifest,
  type ProvisioningCandidateContextPolicyV1,
  type ProvisioningCandidateManifestV1,
} from './provisioning-candidate-manifest';

const SOURCE_KEYS = Object.freeze(['entries', 'sourceType', 'sourceVersion']);
const parsedCandidateSources = new WeakSet<object>();

declare const parsedCandidateSourceBrand: unique symbol;
export interface ProvisioningCandidateSourceV1 {
  readonly sourceVersion: typeof PROVISIONING_CANDIDATE_SOURCE_VERSION;
  readonly sourceType: typeof PROVISIONING_CANDIDATE_SOURCE_TYPE;
  readonly entries: readonly ProvisioningCandidateEntryV1[];
  readonly [parsedCandidateSourceBrand]: true;
}

export class ProvisioningCandidateSourceError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ProvisioningCandidateSourceError';
  }
}

function fail(code: string): never {
  throw new ProvisioningCandidateSourceError(code);
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

function rejectDuplicateEntries(
  entries: readonly ProvisioningCandidateEntryV1[],
): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = JSON.stringify([
      entry.tenantReference,
      entry.institutionReference,
    ]);
    if (seen.has(key)) {
      fail('provisioning_candidate_source_duplicate_scope');
    }
    seen.add(key);
  }
}

export function parseProvisioningCandidateSource(
  value: unknown,
  options: {
    readonly contextPolicy: ProvisioningCandidateContextPolicyV1;
  },
): ProvisioningCandidateSourceV1 {
  if (!isRecord(value)) {
    fail('provisioning_candidate_source_invalid');
  }
  requireExactKeys(
    value,
    SOURCE_KEYS,
    'provisioning_candidate_source_shape_invalid',
  );
  if (value.sourceVersion !== PROVISIONING_CANDIDATE_SOURCE_VERSION) {
    fail('provisioning_candidate_source_version_invalid');
  }
  if (value.sourceType !== PROVISIONING_CANDIDATE_SOURCE_TYPE) {
    fail('provisioning_candidate_source_type_invalid');
  }
  if (!Array.isArray(value.entries) || value.entries.length === 0) {
    fail('provisioning_candidate_source_entries_invalid');
  }
  const entries = value.entries.map((entry) =>
    parseProvisioningCandidateEntry(entry, options),
  );
  rejectDuplicateEntries(entries);

  const parsed = Object.freeze({
    sourceVersion: PROVISIONING_CANDIDATE_SOURCE_VERSION,
    sourceType: PROVISIONING_CANDIDATE_SOURCE_TYPE,
    entries: Object.freeze(sortProvisioningCandidateEntries(entries)),
  }) as ProvisioningCandidateSourceV1;
  parsedCandidateSources.add(parsed);
  return parsed;
}

export function assertParsedProvisioningCandidateSource(
  value: unknown,
): asserts value is ProvisioningCandidateSourceV1 {
  if (
    value === null ||
    typeof value !== 'object' ||
    !parsedCandidateSources.has(value)
  ) {
    fail('provisioning_candidate_source_not_parsed');
  }
}

export function createProvisioningCandidateFromSource(
  source: ProvisioningCandidateSourceV1,
  input: {
    readonly generatedAt: string;
    readonly generatedByReference: string;
  },
  options: {
    readonly contextPolicy: ProvisioningCandidateContextPolicyV1;
  },
): ProvisioningCandidateManifestV1 {
  assertParsedProvisioningCandidateSource(source);
  const canonical: ProvisioningCandidateCanonicalManifestV1 = {
    manifestVersion: PROVISIONING_CANDIDATE_MANIFEST_VERSION,
    candidateStatus: 'candidate',
    candidateSource: Object.freeze({
      sourceVersion: source.sourceVersion,
      sourceType: source.sourceType,
    }),
    generatedAt: input.generatedAt,
    generatedByReference: input.generatedByReference,
    entries: source.entries,
  };
  const digest = computeProvisioningCandidateManifestDigest(canonical);
  return parseProvisioningCandidateManifest(
    {
      ...canonical,
      candidateDigest: digest.candidateDigest,
    },
    options,
  );
}
