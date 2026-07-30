import { describe, expect, it } from 'vitest';
import {
  computeProvisioningCandidateV2ManifestDigest,
  PROVISIONING_CANDIDATE_V2_MANIFEST_VERSION,
  PROVISIONING_CANDIDATE_V2_SOURCE_TYPE,
  PROVISIONING_CANDIDATE_V2_SOURCE_VERSION,
  type ProvisioningCandidateV2CanonicalManifest,
} from '../provisioning-candidate-v2-canonicalization';
import {
  assertParsedProvisioningCandidateV2Manifest,
  createGeneratedCandidateV2ReviewState,
  markCandidateV2ReviewPending,
  parseProvisioningCandidateV2Manifest,
} from '../provisioning-candidate-v2-manifest';
import { LOCAL_ACCEPTANCE_PROVISIONING_CONTEXT_POLICY } from '../provisioning-context-policy';

const contextPolicy = LOCAL_ACCEPTANCE_PROVISIONING_CONTEXT_POLICY;

function createEntry(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
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

function createCanonical(
  overrides: Record<string, unknown> = {},
): ProvisioningCandidateV2CanonicalManifest & Record<string, unknown> {
  return {
    manifestVersion: PROVISIONING_CANDIDATE_V2_MANIFEST_VERSION,
    candidateStatus: 'candidate',
    candidateSource: {
      sourceVersion: PROVISIONING_CANDIDATE_V2_SOURCE_VERSION,
      sourceType: PROVISIONING_CANDIDATE_V2_SOURCE_TYPE,
      sourceAuthorizationReference: 'synthetic-source-authority-001',
      sourceDigest: `sha256:${'1'.repeat(64)}`,
    },
    generatedAt: '2026-07-30T02:00:00.000Z',
    generatedByReference: 'synthetic-generator-001',
    entries: [createEntry()],
    ...overrides,
  } as unknown as ProvisioningCandidateV2CanonicalManifest &
    Record<string, unknown>;
}

function createCandidate(
  canonicalOverrides: Record<string, unknown> = {},
  manifestOverrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const canonical = createCanonical(canonicalOverrides);
  let candidateDigest = `sha256:${'0'.repeat(64)}`;
  try {
    candidateDigest =
      computeProvisioningCandidateV2ManifestDigest(canonical).candidateDigest;
  } catch {
    // 非法形状用例应由 Parser fail-closed，不由测试工厂提前失败。
  }
  return {
    ...canonical,
    candidateDigest,
    ...manifestOverrides,
  };
}

function expectManifestError(
  value: unknown,
  code: string,
  policy: unknown = contextPolicy,
): void {
  expect(() =>
    parseProvisioningCandidateV2Manifest(value, {
      contextPolicy: policy as typeof contextPolicy,
    }),
  ).toThrow(code);
}

describe('MIG-01A2 Candidate v2 Manifest 与审核契约', () => {
  it('接受 exact shape、稳定排序并深层冻结 Candidate', () => {
    const candidate = createCandidate({
      entries: [
        createEntry({
          tenantReference: 'tenant-synthetic-b',
          institutionReference: 'institution-synthetic-2',
        }),
        createEntry({
          tenantReference: 'tenant-synthetic-a',
          institutionReference: 'institution-synthetic-1',
        }),
      ],
    });
    const parsed = parseProvisioningCandidateV2Manifest(candidate, {
      contextPolicy,
    });

    expect(parsed.candidateStatus).toBe('candidate');
    expect(parsed.entries.map((entry) => entry.tenantReference)).toEqual([
      'tenant-synthetic-a',
      'tenant-synthetic-b',
    ]);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.candidateSource)).toBe(true);
    expect(Object.isFrozen(parsed.entries)).toBe(true);
    expect(Object.isFrozen(parsed.entries[0])).toBe(true);
    expect(() =>
      assertParsedProvisioningCandidateV2Manifest(parsed),
    ).not.toThrow();
  });

  it.each([null, [], 'candidate'])('拒绝非对象 Candidate：%j', (value) => {
    expectManifestError(value, 'provisioning_candidate_v2_manifest_invalid');
  });

  it('拒绝未知顶层字段', () => {
    expectManifestError(
      { ...createCandidate(), unexpected: true },
      'provisioning_candidate_v2_manifest_shape_invalid',
    );
  });

  it.each([
    'manifestVersion',
    'candidateStatus',
    'candidateSource',
    'generatedAt',
    'generatedByReference',
    'entries',
    'candidateDigest',
  ])('拒绝缺少顶层字段 %s', (field) => {
    const candidate = createCandidate();
    delete candidate[field];
    expectManifestError(
      candidate,
      'provisioning_candidate_v2_manifest_shape_invalid',
    );
  });

  it.each(['mig01-a2-candidate/v1', 'mig01-a2/v1'])(
    '拒绝非 v2 Candidate 版本 %s',
    (manifestVersion) => {
      expectManifestError(
        createCandidate(
          { manifestVersion },
          { candidateDigest: `sha256:${'0'.repeat(64)}` },
        ),
        'provisioning_candidate_v2_manifest_version_invalid',
      );
    },
  );

  it('拒绝 approved 状态', () => {
    expectManifestError(
      createCandidate(
        { candidateStatus: 'approved' },
        { candidateDigest: `sha256:${'0'.repeat(64)}` },
      ),
      'provisioning_candidate_v2_approved_forbidden',
    );
  });

  it.each(['generated', 'review_pending', 'pending'])(
    '拒绝把审核状态 %s 写入 Candidate payload',
    (candidateStatus) => {
      expectManifestError(
        createCandidate(
          { candidateStatus },
          { candidateDigest: `sha256:${'0'.repeat(64)}` },
        ),
        'provisioning_candidate_v2_status_invalid',
      );
    },
  );

  it.each(['approvalStatus', 'approvedAt', 'approvedByReference'])(
    '拒绝 Approved Manifest 字段 %s',
    (field) => {
      expectManifestError(
        { ...createCandidate(), [field]: 'forbidden' },
        'provisioning_candidate_v2_approval_field_forbidden',
      );
    },
  );

  it.each([null, [], 'source'])(
    '拒绝非对象 Source descriptor：%j',
    (candidateSource) => {
      expectManifestError(
        createCandidate(
          { candidateSource },
          { candidateDigest: `sha256:${'0'.repeat(64)}` },
        ),
        'provisioning_candidate_v2_source_descriptor_invalid',
      );
    },
  );

  it('拒绝未知 Source descriptor 字段', () => {
    const candidateSource = {
      ...(createCanonical().candidateSource as object),
      database: 'forbidden',
    };
    expectManifestError(
      createCandidate(
        { candidateSource },
        { candidateDigest: `sha256:${'0'.repeat(64)}` },
      ),
      'provisioning_candidate_v2_source_descriptor_shape_invalid',
    );
  });

  it.each([
    'sourceVersion',
    'sourceType',
    'sourceAuthorizationReference',
    'sourceDigest',
  ])('拒绝缺少 Source descriptor 字段 %s', (field) => {
    const candidateSource = {
      ...(createCanonical().candidateSource as unknown as Record<
        string,
        unknown
      >),
    };
    delete candidateSource[field];
    expectManifestError(
      createCandidate(
        { candidateSource },
        { candidateDigest: `sha256:${'0'.repeat(64)}` },
      ),
      'provisioning_candidate_v2_source_descriptor_shape_invalid',
    );
  });

  it.each(['mig01-a2-candidate-source/v1', 'unknown-source'])(
    '拒绝 Source version %s',
    (sourceVersion) => {
      expectManifestError(
        createCandidate(
          {
            candidateSource: {
              ...(createCanonical().candidateSource as object),
              sourceVersion,
            },
          },
          { candidateDigest: `sha256:${'0'.repeat(64)}` },
        ),
        'provisioning_candidate_v2_source_version_invalid',
      );
    },
  );

  it.each(['local_acceptance_fixture', 'database', 'repository'])(
    '拒绝 Source type %s',
    (sourceType) => {
      expectManifestError(
        createCandidate(
          {
            candidateSource: {
              ...(createCanonical().candidateSource as object),
              sourceType,
            },
          },
          { candidateDigest: `sha256:${'0'.repeat(64)}` },
        ),
        'provisioning_candidate_v2_source_type_invalid',
      );
    },
  );

  it.each([
    ['非 NFC', 'synthe\u0301tic-authority'],
    ['URL', 'https://example.invalid'],
    ['Token 语义', 'token-ref-001'],
    ['手机号', '13800138000'],
    ['超长', `a${'x'.repeat(96)}`],
  ])('拒绝%s Source authorization reference', (_name, reference) => {
    expectManifestError(
      createCandidate(
        {
          candidateSource: {
            ...(createCanonical().candidateSource as object),
            sourceAuthorizationReference: reference,
          },
        },
        { candidateDigest: `sha256:${'0'.repeat(64)}` },
      ),
      'provisioning_candidate_v2_source_authorization_reference_invalid',
    );
  });

  it.each([
    `sha256:${'A'.repeat(64)}`,
    `sha512:${'0'.repeat(64)}`,
    'sha256:1234',
  ])('拒绝非法 Source digest %s', (sourceDigest) => {
    expectManifestError(
      createCandidate(
        {
          candidateSource: {
            ...(createCanonical().candidateSource as object),
            sourceDigest,
          },
        },
        { candidateDigest: `sha256:${'0'.repeat(64)}` },
      ),
      'provisioning_candidate_v2_source_digest_invalid',
    );
  });

  it.each([null, 'entries'])('拒绝非数组 entries：%j', (entries) => {
    expectManifestError(
      createCandidate(
        { entries },
        { candidateDigest: `sha256:${'0'.repeat(64)}` },
      ),
      'provisioning_candidate_v2_entries_invalid',
    );
  });

  it('拒绝空 entries', () => {
    expectManifestError(
      createCandidate(
        { entries: [] },
        { candidateDigest: `sha256:${'0'.repeat(64)}` },
      ),
      'provisioning_candidate_v2_entries_invalid',
    );
  });

  it('拒绝重复 tenantReference + institutionReference', () => {
    const entry = createEntry();
    const canonical = createCanonical({ entries: [entry, { ...entry }] });
    expectManifestError(
      {
        ...canonical,
        candidateDigest:
          computeProvisioningCandidateV2ManifestDigest(canonical)
            .candidateDigest,
      },
      'provisioning_candidate_v2_duplicate_scope',
    );
  });

  it.each([null, [], 'entry'])('拒绝非对象 entry：%j', (entry) => {
    expectManifestError(
      createCandidate(
        { entries: [entry] },
        { candidateDigest: `sha256:${'0'.repeat(64)}` },
      ),
      'provisioning_candidate_v2_entry_invalid',
    );
  });

  it('拒绝未知 entry 字段', () => {
    const canonical = createCanonical({
      entries: [createEntry({ notes: 'forbidden' })],
    });
    expectManifestError(
      {
        ...canonical,
        candidateDigest:
          computeProvisioningCandidateV2ManifestDigest(canonical)
            .candidateDigest,
      },
      'provisioning_candidate_v2_entry_shape_invalid',
    );
  });

  it.each([
    'tenantReference',
    'institutionReference',
    'scopeStatusCandidate',
    'contextCandidate',
    'timezone',
    'currency',
    'effectiveFromBusinessDate',
    'effectiveAt',
  ])('拒绝缺少 entry 字段 %s', (field) => {
    const entry = createEntry();
    delete entry[field];
    const canonical = createCanonical({ entries: [entry] });
    expectManifestError(
      {
        ...canonical,
        candidateDigest:
          computeProvisioningCandidateV2ManifestDigest(canonical)
            .candidateDigest,
      },
      'provisioning_candidate_v2_entry_shape_invalid',
    );
  });

  it.each([
    ['非 NFC', 'te\u0301nant-ref'],
    ['URL', 'https://example.invalid'],
    ['Token 语义', 'token-ref-001'],
    ['手机号', '13800138000'],
    ['超长', `t${'x'.repeat(64)}`],
  ])('拒绝%s tenantReference', (_name, tenantReference) => {
    const canonical = createCanonical({
      entries: [createEntry({ tenantReference })],
    });
    expectManifestError(
      {
        ...canonical,
        candidateDigest:
          computeProvisioningCandidateV2ManifestDigest(canonical)
            .candidateDigest,
      },
      'provisioning_candidate_v2_tenant_reference_invalid',
    );
  });

  it.each([
    ['非 NFC', 'institu\u0301tion-ref'],
    ['URL', 'https://example.invalid'],
    ['Secret 语义', 'secret-ref-001'],
    ['手机号', '13800138000'],
    ['超长', `i${'x'.repeat(64)}`],
  ])('拒绝%s institutionReference', (_name, institutionReference) => {
    const canonical = createCanonical({
      entries: [createEntry({ institutionReference })],
    });
    expectManifestError(
      {
        ...canonical,
        candidateDigest:
          computeProvisioningCandidateV2ManifestDigest(canonical)
            .candidateDigest,
      },
      'provisioning_candidate_v2_institution_reference_invalid',
    );
  });

  it('拒绝非法 scopeStatusCandidate', () => {
    const canonical = createCanonical({
      entries: [createEntry({ scopeStatusCandidate: 'deleted' })],
    });
    expectManifestError(
      {
        ...canonical,
        candidateDigest:
          computeProvisioningCandidateV2ManifestDigest(canonical)
            .candidateDigest,
      },
      'provisioning_candidate_v2_scope_status_invalid',
    );
  });

  it('拒绝非法 contextCandidate', () => {
    const canonical = createCanonical({
      entries: [createEntry({ contextCandidate: 'database_default' })],
    });
    expectManifestError(
      {
        ...canonical,
        candidateDigest:
          computeProvisioningCandidateV2ManifestDigest(canonical)
            .candidateDigest,
      },
      'provisioning_candidate_v2_context_candidate_invalid',
    );
  });

  it.each([
    ['格式非法', 'Asia Shanghai', 'provisioning_candidate_v2_timezone_invalid'],
    ['不在政策内', 'UTC', 'provisioning_candidate_v2_timezone_not_allowed'],
  ])('拒绝%s timezone', (_name, timezone, code) => {
    const canonical = createCanonical({
      entries: [createEntry({ timezone })],
    });
    expectManifestError(
      {
        ...canonical,
        candidateDigest:
          computeProvisioningCandidateV2ManifestDigest(canonical)
            .candidateDigest,
      },
      code,
    );
  });

  it.each([
    ['格式非法', 'cny', 'provisioning_candidate_v2_currency_invalid'],
    ['不在政策内', 'USD', 'provisioning_candidate_v2_currency_not_allowed'],
  ])('拒绝%s currency', (_name, currency, code) => {
    const canonical = createCanonical({
      entries: [createEntry({ currency })],
    });
    expectManifestError(
      {
        ...canonical,
        candidateDigest:
          computeProvisioningCandidateV2ManifestDigest(canonical)
            .candidateDigest,
      },
      code,
    );
  });

  it.each(['2026-02-30', '2026/07/30'])(
    '拒绝非法业务日期 %s',
    (effectiveFromBusinessDate) => {
      const canonical = createCanonical({
        entries: [createEntry({ effectiveFromBusinessDate })],
      });
      expectManifestError(
        {
          ...canonical,
          candidateDigest:
            computeProvisioningCandidateV2ManifestDigest(canonical)
              .candidateDigest,
        },
        'provisioning_candidate_v2_business_date_invalid',
      );
    },
  );

  it.each([
    '2026-07-29T16:00:00Z',
    '2026-07-29T16:00:00.000+00:00',
    'not-an-instant',
  ])('拒绝非 canonical effectiveAt %s', (effectiveAt) => {
    const canonical = createCanonical({
      entries: [createEntry({ effectiveAt })],
    });
    expectManifestError(
      {
        ...canonical,
        candidateDigest:
          computeProvisioningCandidateV2ManifestDigest(canonical)
            .candidateDigest,
      },
      'provisioning_candidate_v2_effective_at_invalid',
    );
  });

  it('拒绝业务日期与 timezone 下 instant 不一致', () => {
    const canonical = createCanonical({
      entries: [
        createEntry({ effectiveFromBusinessDate: '2026-07-29' }),
      ],
    });
    expectManifestError(
      {
        ...canonical,
        candidateDigest:
          computeProvisioningCandidateV2ManifestDigest(canonical)
            .candidateDigest,
      },
      'provisioning_candidate_v2_effective_date_mismatch',
    );
  });

  it.each([
    [
      'policyVersion',
      { ...contextPolicy, policyVersion: 'other-policy' },
      'provisioning_candidate_v2_context_policy_invalid',
    ],
    [
      'targetEnvironment',
      { ...contextPolicy, targetEnvironment: 'production' },
      'provisioning_candidate_v2_context_policy_environment_invalid',
    ],
    [
      'timezones',
      { ...contextPolicy, timezones: ['UTC'] },
      'provisioning_candidate_v2_context_timezone_policy_invalid',
    ],
    [
      'currencies',
      { ...contextPolicy, currencies: ['USD'] },
      'provisioning_candidate_v2_context_currency_policy_invalid',
    ],
  ])('拒绝伪造 Context Policy %s', (_field, policy, code) => {
    expectManifestError(createCandidate(), code, policy);
  });

  it.each([
    '2026-07-30T02:00:00Z',
    '2026-07-30T02:00:00.000+00:00',
    'not-an-instant',
  ])('拒绝非 canonical generatedAt %s', (generatedAt) => {
    expectManifestError(
      createCandidate(
        { generatedAt },
        { candidateDigest: `sha256:${'0'.repeat(64)}` },
      ),
      'provisioning_candidate_v2_generated_at_invalid',
    );
  });

  it.each([
    ['非 NFC', 'genera\u0301tor-ref'],
    ['URL', 'https://example.invalid'],
    ['Token 语义', 'token-generator-001'],
    ['手机号', '13800138000'],
    ['超长', `g${'x'.repeat(96)}`],
  ])('拒绝%s Generator reference', (_name, generatedByReference) => {
    expectManifestError(
      createCandidate(
        { generatedByReference },
        { candidateDigest: `sha256:${'0'.repeat(64)}` },
      ),
      'provisioning_candidate_v2_generated_by_reference_invalid',
    );
  });

  it.each([
    `sha256:${'A'.repeat(64)}`,
    `sha512:${'0'.repeat(64)}`,
    'sha256:1234',
  ])('拒绝非法 Candidate digest %s', (candidateDigest) => {
    expectManifestError(
      createCandidate({}, { candidateDigest }),
      'provisioning_candidate_v2_digest_invalid',
    );
  });

  it('拒绝 Candidate digest mismatch', () => {
    expectManifestError(
      createCandidate({}, { candidateDigest: `sha256:${'0'.repeat(64)}` }),
      'provisioning_candidate_v2_digest_mismatch',
    );
  });

  it('拒绝未由 Parser 颁发的 Candidate', () => {
    expect(() =>
      assertParsedProvisioningCandidateV2Manifest(createCandidate()),
    ).toThrow('provisioning_candidate_v2_not_parsed');
  });

  it('只允许 generated → review_pending 且保持 digest 不变', () => {
    const parsed = parseProvisioningCandidateV2Manifest(createCandidate(), {
      contextPolicy,
    });
    const generated = createGeneratedCandidateV2ReviewState(parsed);
    const pending = markCandidateV2ReviewPending(generated, {
      reviewerReference: 'synthetic-reviewer-001',
    });

    expect(generated).toEqual({
      candidateDigest: parsed.candidateDigest,
      generatedByReference: parsed.generatedByReference,
      reviewStatus: 'generated',
      reviewerReference: null,
    });
    expect(pending).toEqual({
      candidateDigest: parsed.candidateDigest,
      generatedByReference: parsed.generatedByReference,
      reviewStatus: 'review_pending',
      reviewerReference: 'synthetic-reviewer-001',
    });
    expect(pending).not.toHaveProperty('approvalStatus');
    expect(Object.isFrozen(pending)).toBe(true);
  });

  it('拒绝重复进入 review_pending', () => {
    const parsed = parseProvisioningCandidateV2Manifest(createCandidate(), {
      contextPolicy,
    });
    const pending = markCandidateV2ReviewPending(
      createGeneratedCandidateV2ReviewState(parsed),
      { reviewerReference: 'synthetic-reviewer-001' },
    );

    expect(() =>
      markCandidateV2ReviewPending(pending, {
        reviewerReference: 'synthetic-reviewer-002',
      }),
    ).toThrow('provisioning_candidate_v2_review_transition_invalid');
  });

  it.each([
    ['非 NFC', 'reviewe\u0301r-ref'],
    ['URL', 'https://example.invalid'],
    ['Secret 语义', 'secret-reviewer-001'],
    ['手机号', '13800138000'],
    ['超长', `r${'x'.repeat(96)}`],
  ])('拒绝%s Reviewer reference', (_name, reviewerReference) => {
    const parsed = parseProvisioningCandidateV2Manifest(createCandidate(), {
      contextPolicy,
    });
    expect(() =>
      markCandidateV2ReviewPending(
        createGeneratedCandidateV2ReviewState(parsed),
        { reviewerReference },
      ),
    ).toThrow('provisioning_candidate_v2_reviewer_reference_invalid');
  });

  it('拒绝 Generator 兼任 Reviewer', () => {
    const parsed = parseProvisioningCandidateV2Manifest(createCandidate(), {
      contextPolicy,
    });
    expect(() =>
      markCandidateV2ReviewPending(
        createGeneratedCandidateV2ReviewState(parsed),
        { reviewerReference: parsed.generatedByReference },
      ),
    ).toThrow('provisioning_candidate_v2_reviewer_generator_conflict');
  });

  it('拒绝伪造 Review State', () => {
    expect(() =>
      markCandidateV2ReviewPending(
        {
          candidateDigest: `sha256:${'0'.repeat(64)}`,
          generatedByReference: 'synthetic-generator-001',
          reviewStatus: 'generated',
          reviewerReference: null,
        } as never,
        { reviewerReference: 'synthetic-reviewer-001' },
      ),
    ).toThrow('provisioning_candidate_v2_review_state_invalid');
  });

  it('Parser 不修改原始输入', () => {
    const raw = createCandidate();
    const before = structuredClone(raw);
    parseProvisioningCandidateV2Manifest(raw, { contextPolicy });
    expect(raw).toEqual(before);
  });

  it('Candidate v2 不提供 approved 状态或转换结果', () => {
    const parsed = parseProvisioningCandidateV2Manifest(createCandidate(), {
      contextPolicy,
    });
    const pending = markCandidateV2ReviewPending(
      createGeneratedCandidateV2ReviewState(parsed),
      { reviewerReference: 'synthetic-reviewer-001' },
    );

    expect(parsed).not.toHaveProperty('approvedAt');
    expect(parsed).not.toHaveProperty('approvedByReference');
    expect(pending).not.toHaveProperty('approvedAt');
    expect(pending).not.toHaveProperty('approvedByReference');
  });
});
