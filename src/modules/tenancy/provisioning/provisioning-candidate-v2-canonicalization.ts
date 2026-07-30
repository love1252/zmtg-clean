import { createHash } from 'node:crypto';

export const PROVISIONING_CANDIDATE_V2_MANIFEST_VERSION =
  'mig01-a2-candidate/v2' as const;
export const PROVISIONING_CANDIDATE_V2_CANONICALIZATION_VERSION =
  'candidate-canonicalization-v2' as const;
export const PROVISIONING_CANDIDATE_V2_MANIFEST_DOMAIN =
  'zmtg.mig01-a2.provisioning-candidate-manifest-v2' as const;

export const PROVISIONING_CANDIDATE_V2_SOURCE_VERSION =
  'mig01-a2-candidate-source/v2' as const;
export const PROVISIONING_CANDIDATE_V2_SOURCE_TYPE =
  'local_acceptance_user_authorized_input' as const;
export const PROVISIONING_CANDIDATE_V2_SOURCE_CANONICALIZATION_VERSION =
  'candidate-source-canonicalization-v1' as const;
export const PROVISIONING_CANDIDATE_V2_SOURCE_DOMAIN =
  'zmtg.mig01-a2.provisioning-candidate-source' as const;

export type ProvisioningCandidateV2ScopeStatus = 'active' | 'suspended';
export type ProvisioningCandidateV2Context =
  | 'institution_config'
  | 'product_default';

export interface ProvisioningCandidateV2Entry {
  readonly tenantReference: string;
  readonly institutionReference: string;
  readonly scopeStatusCandidate: ProvisioningCandidateV2ScopeStatus;
  readonly contextCandidate: ProvisioningCandidateV2Context;
  readonly timezone: string;
  readonly currency: string;
  readonly effectiveFromBusinessDate: string;
  readonly effectiveAt: string;
}

export interface ProvisioningCandidateV2CanonicalSource {
  readonly sourceVersion: typeof PROVISIONING_CANDIDATE_V2_SOURCE_VERSION;
  readonly sourceType: typeof PROVISIONING_CANDIDATE_V2_SOURCE_TYPE;
  readonly sourceAuthorizationReference: string;
  readonly sourceAuthorizedAt: string;
  readonly entries: readonly ProvisioningCandidateV2Entry[];
}

export interface ProvisioningCandidateV2SourceDescriptor {
  readonly sourceVersion: typeof PROVISIONING_CANDIDATE_V2_SOURCE_VERSION;
  readonly sourceType: typeof PROVISIONING_CANDIDATE_V2_SOURCE_TYPE;
  readonly sourceAuthorizationReference: string;
  readonly sourceDigest: `sha256:${string}`;
}

export interface ProvisioningCandidateV2CanonicalManifest {
  readonly manifestVersion: typeof PROVISIONING_CANDIDATE_V2_MANIFEST_VERSION;
  readonly candidateStatus: 'candidate';
  readonly candidateSource: ProvisioningCandidateV2SourceDescriptor;
  readonly generatedAt: string;
  readonly generatedByReference: string;
  readonly entries: readonly ProvisioningCandidateV2Entry[];
}

export interface ProvisioningCandidateV2SourceDigest {
  readonly sourceDigest: `sha256:${string}`;
  readonly canonicalJson: string;
}

export interface ProvisioningCandidateV2ManifestDigest {
  readonly candidateDigest: `sha256:${string}`;
  readonly canonicalJson: string;
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

export function sortProvisioningCandidateV2Entries(
  entries: readonly ProvisioningCandidateV2Entry[],
): readonly ProvisioningCandidateV2Entry[] {
  return [...entries].sort(
    (left, right) =>
      compareUtf8(left.tenantReference, right.tenantReference) ||
      compareUtf8(left.institutionReference, right.institutionReference),
  );
}

function buildCanonicalEntries(
  entries: readonly ProvisioningCandidateV2Entry[],
): readonly (readonly unknown[])[] {
  return sortProvisioningCandidateV2Entries(entries).map((entry) => [
    entry.tenantReference,
    entry.institutionReference,
    entry.scopeStatusCandidate,
    entry.contextCandidate,
    entry.timezone,
    entry.currency,
    entry.effectiveFromBusinessDate,
    entry.effectiveAt,
  ]);
}

export function buildProvisioningCandidateV2SourceCanonicalArray(
  source: ProvisioningCandidateV2CanonicalSource,
): readonly unknown[] {
  const entries = buildCanonicalEntries(source.entries);

  return [
    PROVISIONING_CANDIDATE_V2_SOURCE_DOMAIN,
    PROVISIONING_CANDIDATE_V2_SOURCE_CANONICALIZATION_VERSION,
    source.sourceVersion,
    source.sourceType,
    source.sourceAuthorizationReference,
    source.sourceAuthorizedAt,
    entries.length,
    entries,
  ];
}

export function computeProvisioningCandidateV2SourceDigest(
  source: ProvisioningCandidateV2CanonicalSource,
): ProvisioningCandidateV2SourceDigest {
  const canonicalJson = JSON.stringify(
    buildProvisioningCandidateV2SourceCanonicalArray(source),
  );
  const digest = createHash('sha256')
    .update(Buffer.from(canonicalJson, 'utf8'))
    .digest('hex');

  return Object.freeze({
    sourceDigest: `sha256:${digest}`,
    canonicalJson,
  });
}

export function buildProvisioningCandidateV2CanonicalArray(
  manifest: ProvisioningCandidateV2CanonicalManifest,
): readonly unknown[] {
  const entries = buildCanonicalEntries(manifest.entries);

  return [
    PROVISIONING_CANDIDATE_V2_MANIFEST_DOMAIN,
    PROVISIONING_CANDIDATE_V2_CANONICALIZATION_VERSION,
    manifest.manifestVersion,
    manifest.candidateStatus,
    manifest.candidateSource.sourceVersion,
    manifest.candidateSource.sourceType,
    manifest.candidateSource.sourceAuthorizationReference,
    manifest.candidateSource.sourceDigest,
    manifest.generatedAt,
    manifest.generatedByReference,
    entries.length,
    entries,
  ];
}

export function computeProvisioningCandidateV2ManifestDigest(
  manifest: ProvisioningCandidateV2CanonicalManifest,
): ProvisioningCandidateV2ManifestDigest {
  const canonicalJson = JSON.stringify(
    buildProvisioningCandidateV2CanonicalArray(manifest),
  );
  const digest = createHash('sha256')
    .update(Buffer.from(canonicalJson, 'utf8'))
    .digest('hex');

  return Object.freeze({
    candidateDigest: `sha256:${digest}`,
    canonicalJson,
  });
}
