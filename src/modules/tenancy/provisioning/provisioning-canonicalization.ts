import { createHash } from 'node:crypto';

export const PROVISIONING_MANIFEST_VERSION = 'mig01-a2/v1' as const;
export const PROVISIONING_CANONICALIZATION_VERSION = 'c14n-v1' as const;
export const PROVISIONING_MANIFEST_DOMAIN =
  'zmtg.mig01-a2.provisioning-manifest' as const;
export const PROVISIONING_ENTRY_KEYS_DOMAIN =
  'zmtg.mig01-a2.provisioning-entry-keys' as const;

export type ProvisioningScopeStatusV1 = 'active' | 'suspended';
export type ProvisioningSourceV1 = 'approved_migration_manifest';
export type ProvisioningContextSourceV1 =
  | 'institution_config'
  | 'product_default';

export interface ProvisioningCanonicalEntryV1 {
  readonly tenantId: string;
  readonly institutionId: string;
  readonly scopeStatus: ProvisioningScopeStatusV1;
  readonly scopeRevision: 1;
  readonly provisioningSource: ProvisioningSourceV1;
  readonly contextVersion: 1;
  readonly contextHeadRevision: 1;
  readonly latestVersion: 1;
  readonly contextSource: ProvisioningContextSourceV1;
  readonly timezone: string;
  readonly currency: string;
  readonly effectiveFromBusinessDate: string;
  readonly effectiveAt: string;
}

export interface ProvisioningCanonicalManifestV1 {
  readonly manifestVersion: typeof PROVISIONING_MANIFEST_VERSION;
  readonly approvalStatus: 'approved';
  readonly approvedByReference: string;
  readonly approvedAt: string;
  readonly entries: readonly ProvisioningCanonicalEntryV1[];
}

export interface ProvisioningDigestV1 {
  readonly external: `sha256:${string}`;
  readonly database: string;
  readonly canonicalJson: string;
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

export function sortProvisioningEntries(
  entries: readonly ProvisioningCanonicalEntryV1[],
): readonly ProvisioningCanonicalEntryV1[] {
  return [...entries].sort(
    (left, right) =>
      compareUtf8(left.tenantId, right.tenantId) ||
      compareUtf8(left.institutionId, right.institutionId),
  );
}

export function buildProvisioningCanonicalArray(
  manifest: ProvisioningCanonicalManifestV1,
): readonly unknown[] {
  const entries = sortProvisioningEntries(manifest.entries).map((entry) => [
    entry.tenantId,
    entry.institutionId,
    entry.scopeStatus,
    entry.scopeRevision,
    entry.provisioningSource,
    entry.contextVersion,
    entry.contextHeadRevision,
    entry.latestVersion,
    entry.contextSource,
    entry.timezone,
    entry.currency,
    entry.effectiveFromBusinessDate,
    entry.effectiveAt,
    null,
  ]);

  return [
    PROVISIONING_MANIFEST_DOMAIN,
    PROVISIONING_CANONICALIZATION_VERSION,
    manifest.manifestVersion,
    manifest.approvalStatus,
    manifest.approvedByReference,
    manifest.approvedAt,
    entries.length,
    entries,
  ];
}

export function computeProvisioningManifestDigest(
  manifest: ProvisioningCanonicalManifestV1,
): ProvisioningDigestV1 {
  const canonicalJson = JSON.stringify(buildProvisioningCanonicalArray(manifest));
  const database = createHash('sha256')
    .update(Buffer.from(canonicalJson, 'utf8'))
    .digest('hex');

  return Object.freeze({
    external: `sha256:${database}`,
    database,
    canonicalJson,
  });
}

export function computeProvisioningEntryKeysDigest(
  entries: readonly Pick<
    ProvisioningCanonicalEntryV1,
    'tenantId' | 'institutionId'
  >[],
): `sha256:${string}` {
  const keys = [...entries]
    .sort(
      (left, right) =>
        compareUtf8(left.tenantId, right.tenantId) ||
        compareUtf8(left.institutionId, right.institutionId),
    )
    .map((entry) => [entry.tenantId, entry.institutionId]);
  const canonicalJson = JSON.stringify([
    PROVISIONING_ENTRY_KEYS_DOMAIN,
    PROVISIONING_CANONICALIZATION_VERSION,
    keys.length,
    keys,
  ]);
  const digest = createHash('sha256')
    .update(Buffer.from(canonicalJson, 'utf8'))
    .digest('hex');

  return `sha256:${digest}`;
}
