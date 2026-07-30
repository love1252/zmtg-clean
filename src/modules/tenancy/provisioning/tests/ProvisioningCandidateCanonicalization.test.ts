import { describe, expect, it } from 'vitest';
import {
  buildProvisioningCandidateCanonicalArray,
  computeProvisioningCandidateManifestDigest,
  PROVISIONING_CANDIDATE_CANONICALIZATION_VERSION,
  PROVISIONING_CANDIDATE_MANIFEST_DOMAIN,
  PROVISIONING_CANDIDATE_MANIFEST_VERSION,
  PROVISIONING_CANDIDATE_SOURCE_TYPE,
  PROVISIONING_CANDIDATE_SOURCE_VERSION,
  sortProvisioningCandidateEntries,
  type ProvisioningCandidateCanonicalManifestV1,
  type ProvisioningCandidateEntryV1,
} from '../provisioning-candidate-canonicalization';

function createEntry(
  overrides: Partial<ProvisioningCandidateEntryV1> = {},
): ProvisioningCandidateEntryV1 {
  return {
    tenantReference: 'tenant-ref-001',
    institutionReference: 'institution-ref-001',
    scopeStatusCandidate: 'active',
    contextCandidate: 'institution_config',
    timezone: 'Asia/Shanghai',
    currency: 'CNY',
    effectiveFromBusinessDate: '2026-07-30',
    effectiveAt: '2026-07-30T00:00:00.000Z',
    ...overrides,
  };
}

function createCanonical(
  overrides: Partial<ProvisioningCandidateCanonicalManifestV1> = {},
): ProvisioningCandidateCanonicalManifestV1 {
  return {
    manifestVersion: PROVISIONING_CANDIDATE_MANIFEST_VERSION,
    candidateStatus: 'candidate',
    candidateSource: {
      sourceVersion: PROVISIONING_CANDIDATE_SOURCE_VERSION,
      sourceType: PROVISIONING_CANDIDATE_SOURCE_TYPE,
    },
    generatedAt: '2026-07-30T01:02:03.000Z',
    generatedByReference: 'generator-ref-001',
    entries: [createEntry()],
    ...overrides,
  };
}

describe('MIG-01A2 Candidate 独立 canonicalization', () => {
  it('锁定 Candidate domain、版本、固定位置数组和 digest 向量', () => {
    const canonical = createCanonical();
    const result = computeProvisioningCandidateManifestDigest(canonical);

    expect(PROVISIONING_CANDIDATE_MANIFEST_DOMAIN).toBe(
      'zmtg.mig01-a2.provisioning-candidate-manifest',
    );
    expect(PROVISIONING_CANDIDATE_CANONICALIZATION_VERSION).toBe(
      'candidate-canonicalization-v1',
    );
    expect(result.candidateDigest).toBe(
      'sha256:0c8dae73d9dddf4ee003163869aef124c4b9dc292b36d983bdee3bc8b135b43e',
    );
    expect(JSON.parse(result.canonicalJson)).toEqual([
      'zmtg.mig01-a2.provisioning-candidate-manifest',
      'candidate-canonicalization-v1',
      'mig01-a2-candidate/v1',
      'candidate',
      'mig01-a2-candidate-source/v1',
      'local_acceptance_fixture',
      '2026-07-30T01:02:03.000Z',
      'generator-ref-001',
      1,
      [
        [
          'tenant-ref-001',
          'institution-ref-001',
          'active',
          'institution_config',
          'Asia/Shanghai',
          'CNY',
          '2026-07-30',
          '2026-07-30T00:00:00.000Z',
        ],
      ],
    ]);
  });

  it('对象属性插入顺序不影响固定投影', () => {
    const normal = createCanonical();
    const reordered = {
      entries: normal.entries,
      generatedByReference: normal.generatedByReference,
      candidateSource: normal.candidateSource,
      candidateStatus: normal.candidateStatus,
      generatedAt: normal.generatedAt,
      manifestVersion: normal.manifestVersion,
    } as ProvisioningCandidateCanonicalManifestV1;

    expect(
      computeProvisioningCandidateManifestDigest(reordered).candidateDigest,
    ).toBe(
      computeProvisioningCandidateManifestDigest(normal).candidateDigest,
    );
  });

  it('entries 输入顺序不影响 digest', () => {
    const first = createEntry({
      tenantReference: 'tenant-ref-a',
      institutionReference: 'institution-ref-1',
    });
    const second = createEntry({
      tenantReference: 'tenant-ref-b',
      institutionReference: 'institution-ref-2',
    });

    expect(
      computeProvisioningCandidateManifestDigest(
        createCanonical({ entries: [first, second] }),
      ).candidateDigest,
    ).toBe(
      computeProvisioningCandidateManifestDigest(
        createCanonical({ entries: [second, first] }),
      ).candidateDigest,
    );
  });

  it('按 UTF-8 tenantReference 和 institutionReference 排序', () => {
    const sorted = sortProvisioningCandidateEntries([
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
    ['tenantReference', { tenantReference: 'tenant-ref-002' }],
    ['institutionReference', { institutionReference: 'institution-ref-002' }],
    ['scopeStatusCandidate', { scopeStatusCandidate: 'suspended' as const }],
    ['contextCandidate', { contextCandidate: 'product_default' as const }],
    ['timezone', { timezone: 'UTC' }],
    ['currency', { currency: 'USD' }],
    ['effectiveFromBusinessDate', { effectiveFromBusinessDate: '2026-07-31' }],
    ['effectiveAt', { effectiveAt: '2026-07-30T00:00:01.000Z' }],
  ])('entry 字段 %s 变化会改变 digest', (_name, entryOverride) => {
    const baseline = computeProvisioningCandidateManifestDigest(
      createCanonical(),
    ).candidateDigest;
    const changed = computeProvisioningCandidateManifestDigest(
      createCanonical({ entries: [createEntry(entryOverride)] }),
    ).candidateDigest;

    expect(changed).not.toBe(baseline);
  });

  it.each([
    ['generatedAt', { generatedAt: '2026-07-30T01:02:04.000Z' }],
    ['generatedByReference', { generatedByReference: 'generator-ref-002' }],
  ])('顶层字段 %s 变化会改变 digest', (_name, override) => {
    expect(
      computeProvisioningCandidateManifestDigest(createCanonical(override))
        .candidateDigest,
    ).not.toBe(
      computeProvisioningCandidateManifestDigest(createCanonical())
        .candidateDigest,
    );
  });

  it('Source descriptor 进入 digest', () => {
    const baseline = createCanonical();
    const changed = {
      ...baseline,
      candidateSource: {
        ...baseline.candidateSource,
        sourceType: 'other_fixture',
      },
    } as unknown as ProvisioningCandidateCanonicalManifestV1;

    expect(
      computeProvisioningCandidateManifestDigest(changed).candidateDigest,
    ).not.toBe(
      computeProvisioningCandidateManifestDigest(baseline).candidateDigest,
    );
  });

  it('candidateDigest 自身不进入 preimage', () => {
    const canonical = createCanonical();
    const withDigest = {
      ...canonical,
      candidateDigest: `sha256:${'0'.repeat(64)}`,
    } as ProvisioningCandidateCanonicalManifestV1 & {
      readonly candidateDigest: string;
    };

    expect(
      computeProvisioningCandidateManifestDigest(withDigest).candidateDigest,
    ).toBe(
      computeProvisioningCandidateManifestDigest(canonical).candidateDigest,
    );
  });

  it.each(['approvedAt', 'approvedByReference', 'approvalStatus'])(
    '审批字段 %s 不存在于 Candidate preimage',
    (field) => {
      const canonical = createCanonical();
      const withApproval = {
        ...canonical,
        [field]: 'external-approval-value',
      } as ProvisioningCandidateCanonicalManifestV1 &
        Record<string, unknown>;

      expect(
        computeProvisioningCandidateManifestDigest(withApproval)
          .candidateDigest,
      ).toBe(
        computeProvisioningCandidateManifestDigest(canonical).candidateDigest,
      );
      expect(
        buildProvisioningCandidateCanonicalArray(withApproval),
      ).toEqual(buildProvisioningCandidateCanonicalArray(canonical));
    },
  );

  it('reviewStatus 和 Reviewer 不存在于 Candidate preimage', () => {
    const canonical = createCanonical();
    const withReview = {
      ...canonical,
      reviewStatus: 'review_pending',
      reviewerReference: 'reviewer-ref-001',
    } as ProvisioningCandidateCanonicalManifestV1 &
      Record<string, unknown>;

    expect(
      computeProvisioningCandidateManifestDigest(withReview).candidateDigest,
    ).toBe(
      computeProvisioningCandidateManifestDigest(canonical).candidateDigest,
    );
  });

  it('不静默 NFC normalize，原始 UTF-8 字节变化会改变 digest', () => {
    const nfc = createCanonical({
      entries: [createEntry({ tenantReference: 'ténant-ref' })],
    });
    const nonNfc = createCanonical({
      entries: [createEntry({ tenantReference: 'te\u0301nant-ref' })],
    });

    expect(
      computeProvisioningCandidateManifestDigest(nonNfc).candidateDigest,
    ).not.toBe(
      computeProvisioningCandidateManifestDigest(nfc).candidateDigest,
    );
  });

  it('合法 Unicode NFC 输入的 digest 稳定', () => {
    const canonical = createCanonical({
      entries: [createEntry({ tenantReference: 'tenant-é' })],
    });

    expect(
      computeProvisioningCandidateManifestDigest(canonical).candidateDigest,
    ).toBe(
      computeProvisioningCandidateManifestDigest(structuredClone(canonical))
        .candidateDigest,
    );
  });

  it('entry count 显式进入固定位置数组', () => {
    const array = buildProvisioningCandidateCanonicalArray(
      createCanonical({
        entries: [
          createEntry(),
          createEntry({
            tenantReference: 'tenant-ref-002',
            institutionReference: 'institution-ref-002',
          }),
        ],
      }),
    );

    expect(array[8]).toBe(2);
  });

  it('Candidate digest 与 Approved digest 使用不同协议', () => {
    expect(PROVISIONING_CANDIDATE_MANIFEST_VERSION).not.toBe('mig01-a2/v1');
    expect(PROVISIONING_CANDIDATE_CANONICALIZATION_VERSION).not.toBe(
      'c14n-v1',
    );
    expect(PROVISIONING_CANDIDATE_MANIFEST_DOMAIN).not.toBe(
      'zmtg.mig01-a2.provisioning-manifest',
    );
    expect(
      computeProvisioningCandidateManifestDigest(createCanonical())
        .candidateDigest,
    ).not.toBe(
      'sha256:a42fda705e6256a3fd36d74f2d243f27fefcb19dc0ad63c3a00970d42d16de1a',
    );
  });
});
