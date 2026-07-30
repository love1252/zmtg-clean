import { describe, expect, it } from 'vitest';
import {
  buildProvisioningCandidateV2CanonicalArray,
  buildProvisioningCandidateV2SourceCanonicalArray,
  computeProvisioningCandidateV2ManifestDigest,
  computeProvisioningCandidateV2SourceDigest,
  PROVISIONING_CANDIDATE_V2_CANONICALIZATION_VERSION,
  PROVISIONING_CANDIDATE_V2_MANIFEST_DOMAIN,
  PROVISIONING_CANDIDATE_V2_MANIFEST_VERSION,
  PROVISIONING_CANDIDATE_V2_SOURCE_CANONICALIZATION_VERSION,
  PROVISIONING_CANDIDATE_V2_SOURCE_DOMAIN,
  PROVISIONING_CANDIDATE_V2_SOURCE_TYPE,
  PROVISIONING_CANDIDATE_V2_SOURCE_VERSION,
  sortProvisioningCandidateV2Entries,
  type ProvisioningCandidateV2CanonicalManifest,
  type ProvisioningCandidateV2CanonicalSource,
  type ProvisioningCandidateV2Entry,
} from '../provisioning-candidate-v2-canonicalization';

function createEntry(
  overrides: Partial<ProvisioningCandidateV2Entry> = {},
): ProvisioningCandidateV2Entry {
  return {
    tenantReference: 'tenant-synthetic-001',
    institutionReference: 'institution-synthetic-001',
    scopeStatusCandidate: 'active',
    contextCandidate: 'product_default',
    timezone: 'Asia/Shanghai',
    currency: 'CNY',
    effectiveFromBusinessDate: '2026-07-30',
    effectiveAt: '2026-07-29T16:00:00.000Z',
    ...overrides,
  };
}

function createSource(
  overrides: Partial<ProvisioningCandidateV2CanonicalSource> = {},
): ProvisioningCandidateV2CanonicalSource {
  return {
    sourceVersion: PROVISIONING_CANDIDATE_V2_SOURCE_VERSION,
    sourceType: PROVISIONING_CANDIDATE_V2_SOURCE_TYPE,
    sourceAuthorizationReference: 'synthetic-source-authority-001',
    sourceAuthorizedAt: '2026-07-30T01:00:00.000Z',
    entries: [createEntry()],
    ...overrides,
  };
}

function createManifest(
  overrides: Partial<ProvisioningCandidateV2CanonicalManifest> = {},
): ProvisioningCandidateV2CanonicalManifest {
  const source = createSource();
  return {
    manifestVersion: PROVISIONING_CANDIDATE_V2_MANIFEST_VERSION,
    candidateStatus: 'candidate',
    candidateSource: {
      sourceVersion: source.sourceVersion,
      sourceType: source.sourceType,
      sourceAuthorizationReference: source.sourceAuthorizationReference,
      sourceDigest:
        computeProvisioningCandidateV2SourceDigest(source).sourceDigest,
    },
    generatedAt: '2026-07-30T02:00:00.000Z',
    generatedByReference: 'synthetic-generator-001',
    entries: source.entries,
    ...overrides,
  };
}

describe('MIG-01A2 Source／Candidate v2 canonicalization', () => {
  it('锁定 Source v2 domain、版本、固定数组和 digest 向量', () => {
    const source = createSource();
    const result = computeProvisioningCandidateV2SourceDigest(source);

    expect(PROVISIONING_CANDIDATE_V2_SOURCE_DOMAIN).toBe(
      'zmtg.mig01-a2.provisioning-candidate-source',
    );
    expect(PROVISIONING_CANDIDATE_V2_SOURCE_CANONICALIZATION_VERSION).toBe(
      'candidate-source-canonicalization-v1',
    );
    expect(result.sourceDigest).toBe(
      'sha256:73aa676de0e272baa4108086e374b0f04cd5898f005429f2c24d0e2de3f95b1a',
    );
    expect(JSON.parse(result.canonicalJson)).toEqual([
      'zmtg.mig01-a2.provisioning-candidate-source',
      'candidate-source-canonicalization-v1',
      'mig01-a2-candidate-source/v2',
      'local_acceptance_user_authorized_input',
      'synthetic-source-authority-001',
      '2026-07-30T01:00:00.000Z',
      1,
      [
        [
          'tenant-synthetic-001',
          'institution-synthetic-001',
          'active',
          'product_default',
          'Asia/Shanghai',
          'CNY',
          '2026-07-30',
          '2026-07-29T16:00:00.000Z',
        ],
      ],
    ]);
  });

  it('锁定 Candidate v2 domain、版本、Source 绑定和 digest 向量', () => {
    const manifest = createManifest();
    const result = computeProvisioningCandidateV2ManifestDigest(manifest);

    expect(PROVISIONING_CANDIDATE_V2_MANIFEST_DOMAIN).toBe(
      'zmtg.mig01-a2.provisioning-candidate-manifest-v2',
    );
    expect(PROVISIONING_CANDIDATE_V2_CANONICALIZATION_VERSION).toBe(
      'candidate-canonicalization-v2',
    );
    expect(result.candidateDigest).toBe(
      'sha256:2e7b576823688f4af6c0ddf1e8c9ef98da004b6befd9576c86e1218b3003bd61',
    );
    expect(JSON.parse(result.canonicalJson)).toEqual([
      'zmtg.mig01-a2.provisioning-candidate-manifest-v2',
      'candidate-canonicalization-v2',
      'mig01-a2-candidate/v2',
      'candidate',
      'mig01-a2-candidate-source/v2',
      'local_acceptance_user_authorized_input',
      'synthetic-source-authority-001',
      'sha256:73aa676de0e272baa4108086e374b0f04cd5898f005429f2c24d0e2de3f95b1a',
      '2026-07-30T02:00:00.000Z',
      'synthetic-generator-001',
      1,
      [
        [
          'tenant-synthetic-001',
          'institution-synthetic-001',
          'active',
          'product_default',
          'Asia/Shanghai',
          'CNY',
          '2026-07-30',
          '2026-07-29T16:00:00.000Z',
        ],
      ],
    ]);
  });

  it('Source 对象属性插入顺序不影响 digest', () => {
    const source = createSource();
    const reordered = {
      entries: source.entries,
      sourceAuthorizedAt: source.sourceAuthorizedAt,
      sourceAuthorizationReference: source.sourceAuthorizationReference,
      sourceType: source.sourceType,
      sourceVersion: source.sourceVersion,
    } as ProvisioningCandidateV2CanonicalSource;

    expect(
      computeProvisioningCandidateV2SourceDigest(reordered).sourceDigest,
    ).toBe(
      computeProvisioningCandidateV2SourceDigest(source).sourceDigest,
    );
  });

  it('Candidate 对象属性插入顺序不影响 digest', () => {
    const manifest = createManifest();
    const reordered = {
      entries: manifest.entries,
      generatedByReference: manifest.generatedByReference,
      candidateSource: manifest.candidateSource,
      generatedAt: manifest.generatedAt,
      candidateStatus: manifest.candidateStatus,
      manifestVersion: manifest.manifestVersion,
    } as ProvisioningCandidateV2CanonicalManifest;

    expect(
      computeProvisioningCandidateV2ManifestDigest(reordered).candidateDigest,
    ).toBe(
      computeProvisioningCandidateV2ManifestDigest(manifest).candidateDigest,
    );
  });

  it.each(['Source', 'Candidate'])('%s 的 entries 输入顺序不影响 digest', (kind) => {
    const first = createEntry({
      tenantReference: 'tenant-synthetic-a',
      institutionReference: 'institution-synthetic-1',
    });
    const second = createEntry({
      tenantReference: 'tenant-synthetic-b',
      institutionReference: 'institution-synthetic-2',
    });

    if (kind === 'Source') {
      expect(
        computeProvisioningCandidateV2SourceDigest(
          createSource({ entries: [first, second] }),
        ).sourceDigest,
      ).toBe(
        computeProvisioningCandidateV2SourceDigest(
          createSource({ entries: [second, first] }),
        ).sourceDigest,
      );
      return;
    }
    expect(
      computeProvisioningCandidateV2ManifestDigest(
        createManifest({ entries: [first, second] }),
      ).candidateDigest,
    ).toBe(
      computeProvisioningCandidateV2ManifestDigest(
        createManifest({ entries: [second, first] }),
      ).candidateDigest,
    );
  });

  it('按 UTF-8 tenantReference、institutionReference 排序', () => {
    const sorted = sortProvisioningCandidateV2Entries([
      createEntry({
        tenantReference: 'tenant-b',
        institutionReference: 'institution-2',
      }),
      createEntry({
        tenantReference: 'tenant-a',
        institutionReference: 'institution-2',
      }),
      createEntry({
        tenantReference: 'tenant-a',
        institutionReference: 'institution-1',
      }),
    ]);

    expect(
      sorted.map((entry) => [
        entry.tenantReference,
        entry.institutionReference,
      ]),
    ).toEqual([
      ['tenant-a', 'institution-1'],
      ['tenant-a', 'institution-2'],
      ['tenant-b', 'institution-2'],
    ]);
  });

  it.each([
    ['tenantReference', { tenantReference: 'tenant-synthetic-002' }],
    [
      'institutionReference',
      { institutionReference: 'institution-synthetic-002' },
    ],
    ['scopeStatusCandidate', { scopeStatusCandidate: 'suspended' as const }],
    [
      'contextCandidate',
      { contextCandidate: 'institution_config' as const },
    ],
    ['timezone', { timezone: 'UTC' }],
    ['currency', { currency: 'USD' }],
    ['effectiveFromBusinessDate', { effectiveFromBusinessDate: '2026-07-31' }],
    ['effectiveAt', { effectiveAt: '2026-07-29T16:00:01.000Z' }],
  ])('entry 字段 %s 变化会改变 Source digest', (_name, override) => {
    expect(
      computeProvisioningCandidateV2SourceDigest(
        createSource({ entries: [createEntry(override)] }),
      ).sourceDigest,
    ).not.toBe(
      computeProvisioningCandidateV2SourceDigest(createSource()).sourceDigest,
    );
  });

  it.each([
    ['tenantReference', { tenantReference: 'tenant-synthetic-002' }],
    [
      'institutionReference',
      { institutionReference: 'institution-synthetic-002' },
    ],
    ['scopeStatusCandidate', { scopeStatusCandidate: 'suspended' as const }],
    [
      'contextCandidate',
      { contextCandidate: 'institution_config' as const },
    ],
    ['timezone', { timezone: 'UTC' }],
    ['currency', { currency: 'USD' }],
    ['effectiveFromBusinessDate', { effectiveFromBusinessDate: '2026-07-31' }],
    ['effectiveAt', { effectiveAt: '2026-07-29T16:00:01.000Z' }],
  ])('entry 字段 %s 变化会改变 Candidate digest', (_name, override) => {
    expect(
      computeProvisioningCandidateV2ManifestDigest(
        createManifest({ entries: [createEntry(override)] }),
      ).candidateDigest,
    ).not.toBe(
      computeProvisioningCandidateV2ManifestDigest(createManifest())
        .candidateDigest,
    );
  });

  it.each([
    [
      'sourceAuthorizationReference',
      { sourceAuthorizationReference: 'synthetic-source-authority-002' },
    ],
    ['sourceAuthorizedAt', { sourceAuthorizedAt: '2026-07-30T01:00:01.000Z' }],
  ])('Source 字段 %s 变化会改变 Source digest', (_name, override) => {
    expect(
      computeProvisioningCandidateV2SourceDigest(createSource(override))
        .sourceDigest,
    ).not.toBe(
      computeProvisioningCandidateV2SourceDigest(createSource()).sourceDigest,
    );
  });

  it.each([
    ['sourceVersion', { sourceVersion: 'other-source-version' }],
    ['sourceType', { sourceType: 'other-source-type' }],
    [
      'sourceAuthorizationReference',
      { sourceAuthorizationReference: 'synthetic-source-authority-002' },
    ],
    ['sourceDigest', { sourceDigest: `sha256:${'f'.repeat(64)}` }],
  ])('Source descriptor 字段 %s 变化会改变 Candidate digest', (_name, change) => {
    const manifest = createManifest();
    const changed = {
      ...manifest,
      candidateSource: { ...manifest.candidateSource, ...change },
    } as unknown as ProvisioningCandidateV2CanonicalManifest;

    expect(
      computeProvisioningCandidateV2ManifestDigest(changed).candidateDigest,
    ).not.toBe(
      computeProvisioningCandidateV2ManifestDigest(manifest).candidateDigest,
    );
  });

  it.each([
    ['generatedAt', { generatedAt: '2026-07-30T02:00:01.000Z' }],
    [
      'generatedByReference',
      { generatedByReference: 'synthetic-generator-002' },
    ],
  ])('Candidate 字段 %s 变化会改变 digest', (_name, override) => {
    expect(
      computeProvisioningCandidateV2ManifestDigest(createManifest(override))
        .candidateDigest,
    ).not.toBe(
      computeProvisioningCandidateV2ManifestDigest(createManifest())
        .candidateDigest,
    );
  });

  it('Source digest 自身不进入 Source preimage', () => {
    const source = createSource();
    const withDigest = {
      ...source,
      sourceDigest: `sha256:${'0'.repeat(64)}`,
    } as ProvisioningCandidateV2CanonicalSource & {
      readonly sourceDigest: string;
    };

    expect(
      computeProvisioningCandidateV2SourceDigest(withDigest).sourceDigest,
    ).toBe(
      computeProvisioningCandidateV2SourceDigest(source).sourceDigest,
    );
  });

  it('Candidate digest 自身不进入 Candidate preimage', () => {
    const manifest = createManifest();
    const withDigest = {
      ...manifest,
      candidateDigest: `sha256:${'0'.repeat(64)}`,
    } as ProvisioningCandidateV2CanonicalManifest & {
      readonly candidateDigest: string;
    };

    expect(
      computeProvisioningCandidateV2ManifestDigest(withDigest).candidateDigest,
    ).toBe(
      computeProvisioningCandidateV2ManifestDigest(manifest).candidateDigest,
    );
  });

  it.each([
    'reviewStatus',
    'reviewerReference',
    'approvalStatus',
    'approvedAt',
    'approvedByReference',
  ])('%s 不进入 Candidate preimage', (field) => {
    const manifest = createManifest();
    const extended = {
      ...manifest,
      [field]: 'synthetic-governance-value',
    } as ProvisioningCandidateV2CanonicalManifest & Record<string, unknown>;

    expect(buildProvisioningCandidateV2CanonicalArray(extended)).toEqual(
      buildProvisioningCandidateV2CanonicalArray(manifest),
    );
  });

  it.each(['Source', 'Candidate'])('%s 固定数组显式绑定 entry count', (kind) => {
    const entries = [
      createEntry(),
      createEntry({
        tenantReference: 'tenant-synthetic-002',
        institutionReference: 'institution-synthetic-002',
      }),
    ];
    if (kind === 'Source') {
      expect(
        buildProvisioningCandidateV2SourceCanonicalArray(
          createSource({ entries }),
        )[6],
      ).toBe(2);
      return;
    }
    expect(
      buildProvisioningCandidateV2CanonicalArray(
        createManifest({ entries }),
      )[10],
    ).toBe(2);
  });

  it('v1 Candidate、v2 Candidate 与 Approved Manifest 协议保持隔离', () => {
    expect(PROVISIONING_CANDIDATE_V2_MANIFEST_VERSION).not.toBe(
      'mig01-a2-candidate/v1',
    );
    expect(PROVISIONING_CANDIDATE_V2_MANIFEST_VERSION).not.toBe('mig01-a2/v1');
    expect(PROVISIONING_CANDIDATE_V2_MANIFEST_DOMAIN).not.toBe(
      'zmtg.mig01-a2.provisioning-candidate-manifest',
    );
    expect(PROVISIONING_CANDIDATE_V2_MANIFEST_DOMAIN).not.toBe(
      'zmtg.mig01-a2.provisioning-manifest',
    );
  });
});
