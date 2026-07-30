import { createHash } from 'node:crypto';

export const PROVISIONING_CANDIDATE_MANIFEST_VERSION =
  'mig01-a2-candidate/v1' as const;
export const PROVISIONING_CANDIDATE_CANONICALIZATION_VERSION =
  'candidate-canonicalization-v1' as const;
export const PROVISIONING_CANDIDATE_MANIFEST_DOMAIN =
  'zmtg.mig01-a2.provisioning-candidate-manifest' as const;
export const PROVISIONING_CANDIDATE_SOURCE_VERSION =
  'mig01-a2-candidate-source/v1' as const;
export const PROVISIONING_CANDIDATE_SOURCE_TYPE =
  'local_acceptance_fixture' as const;

export type ProvisioningCandidateScopeStatusV1 = 'active' | 'suspended';
export type ProvisioningCandidateContextV1 =
  | 'institution_config'
  | 'product_default';

export interface ProvisioningCandidateSourceDescriptorV1 {
  readonly sourceVersion: typeof PROVISIONING_CANDIDATE_SOURCE_VERSION;
  readonly sourceType: typeof PROVISIONING_CANDIDATE_SOURCE_TYPE;
}

export interface ProvisioningCandidateEntryV1 {
  readonly tenantReference: string;
  readonly institutionReference: string;
  readonly scopeStatusCandidate: ProvisioningCandidateScopeStatusV1;
  readonly contextCandidate: ProvisioningCandidateContextV1;
  readonly timezone: string;
  readonly currency: string;
  readonly effectiveFromBusinessDate: string;
  readonly effectiveAt: string;
}

export interface ProvisioningCandidateCanonicalManifestV1 {
  readonly manifestVersion: typeof PROVISIONING_CANDIDATE_MANIFEST_VERSION;
  readonly candidateStatus: 'candidate';
  readonly candidateSource: ProvisioningCandidateSourceDescriptorV1;
  readonly generatedAt: string;
  readonly generatedByReference: string;
  readonly entries: readonly ProvisioningCandidateEntryV1[];
}

export interface ProvisioningCandidateDigestV1 {
  readonly candidateDigest: `sha256:${string}`;
  readonly canonicalJson: string;
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

export function sortProvisioningCandidateEntries(
  entries: readonly ProvisioningCandidateEntryV1[],
): readonly ProvisioningCandidateEntryV1[] {
  return [...entries].sort(
    (left, right) =>
      compareUtf8(left.tenantReference, right.tenantReference) ||
      compareUtf8(left.institutionReference, right.institutionReference),
  );
}

export function buildProvisioningCandidateCanonicalArray(
  manifest: ProvisioningCandidateCanonicalManifestV1,
): readonly unknown[] {
  const entries = sortProvisioningCandidateEntries(manifest.entries).map(
    (entry) => [
      entry.tenantReference,
      entry.institutionReference,
      entry.scopeStatusCandidate,
      entry.contextCandidate,
      entry.timezone,
      entry.currency,
      entry.effectiveFromBusinessDate,
      entry.effectiveAt,
    ],
  );

  return [
    PROVISIONING_CANDIDATE_MANIFEST_DOMAIN,
    PROVISIONING_CANDIDATE_CANONICALIZATION_VERSION,
    manifest.manifestVersion,
    manifest.candidateStatus,
    manifest.candidateSource.sourceVersion,
    manifest.candidateSource.sourceType,
    manifest.generatedAt,
    manifest.generatedByReference,
    entries.length,
    entries,
  ];
}

export function computeProvisioningCandidateManifestDigest(
  manifest: ProvisioningCandidateCanonicalManifestV1,
): ProvisioningCandidateDigestV1 {
  const canonicalJson = JSON.stringify(
    buildProvisioningCandidateCanonicalArray(manifest),
  );
  const digest = createHash('sha256')
    .update(Buffer.from(canonicalJson, 'utf8'))
    .digest('hex');

  return Object.freeze({
    candidateDigest: `sha256:${digest}`,
    canonicalJson,
  });
}
