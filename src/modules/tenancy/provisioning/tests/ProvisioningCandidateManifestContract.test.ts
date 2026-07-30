import { describe, expect, it } from 'vitest';
import {
  computeProvisioningCandidateManifestDigest,
  PROVISIONING_CANDIDATE_MANIFEST_VERSION,
  PROVISIONING_CANDIDATE_SOURCE_TYPE,
  PROVISIONING_CANDIDATE_SOURCE_VERSION,
  type ProvisioningCandidateCanonicalManifestV1,
  type ProvisioningCandidateEntryV1,
} from '../provisioning-candidate-canonicalization';
import {
  assertParsedProvisioningCandidateManifest,
  createGeneratedCandidateReviewState,
  markCandidateReviewPending,
  parseProvisioningCandidateManifest,
} from '../provisioning-candidate-manifest';
import { LOCAL_ACCEPTANCE_PROVISIONING_CONTEXT_POLICY } from '../provisioning-context-policy';

const contextPolicy = LOCAL_ACCEPTANCE_PROVISIONING_CONTEXT_POLICY;

function createEntry(
  overrides: Record<string, unknown> = {},
): ProvisioningCandidateEntryV1 & Record<string, unknown> {
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
  } as ProvisioningCandidateEntryV1 & Record<string, unknown>;
}

function createCanonical(
  overrides: Record<string, unknown> = {},
): ProvisioningCandidateCanonicalManifestV1 & Record<string, unknown> {
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
  } as ProvisioningCandidateCanonicalManifestV1 &
    Record<string, unknown>;
}

function createCandidate(
  canonicalOverrides: Record<string, unknown> = {},
  manifestOverrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const canonical = createCanonical(canonicalOverrides);
  return {
    ...canonical,
    candidateDigest:
      computeProvisioningCandidateManifestDigest(canonical).candidateDigest,
    ...manifestOverrides,
  };
}

describe('MIG-01A2 Candidate Manifest 独立契约', () => {
  it('接受 exact shape、排序并深层冻结 Candidate', () => {
    const canonical = createCanonical({
      entries: [
        createEntry({
          tenantReference: 'tenant-ref-b',
          institutionReference: 'institution-ref-2',
        }),
        createEntry({
          tenantReference: 'tenant-ref-a',
          institutionReference: 'institution-ref-1',
        }),
      ],
    });
    const parsed = parseProvisioningCandidateManifest(
      {
        ...canonical,
        candidateDigest:
          computeProvisioningCandidateManifestDigest(canonical)
            .candidateDigest,
      },
      { contextPolicy },
    );

    expect(parsed.candidateStatus).toBe('candidate');
    expect(parsed.entries.map((entry) => entry.tenantReference)).toEqual([
      'tenant-ref-a',
      'tenant-ref-b',
    ]);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.entries)).toBe(true);
    expect(Object.isFrozen(parsed.entries[0])).toBe(true);
    expect(() => assertParsedProvisioningCandidateManifest(parsed)).not.toThrow();
  });

  it('拒绝非对象 Candidate', () => {
    expect(() =>
      parseProvisioningCandidateManifest(null, { contextPolicy }),
    ).toThrow('provisioning_candidate_manifest_invalid');
  });

  it('拒绝未知顶层字段', () => {
    expect(() =>
      parseProvisioningCandidateManifest(
        { ...createCandidate(), unexpected: true },
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_manifest_shape_invalid');
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
    expect(() =>
      parseProvisioningCandidateManifest(candidate, { contextPolicy }),
    ).toThrow('provisioning_candidate_manifest_shape_invalid');
  });

  it('拒绝未知 Candidate 版本', () => {
    expect(() =>
      parseProvisioningCandidateManifest(
        createCandidate(
          { manifestVersion: 'mig01-a2-candidate/v2' },
          { candidateDigest: `sha256:${'0'.repeat(64)}` },
        ),
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_manifest_version_invalid');
  });

  it('拒绝 approved 状态', () => {
    expect(() =>
      parseProvisioningCandidateManifest(
        createCandidate(
          { candidateStatus: 'approved' },
          { candidateDigest: `sha256:${'0'.repeat(64)}` },
        ),
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_approved_forbidden');
  });

  it.each(['generated', 'review_pending', 'pending'])(
    '拒绝把审核生命周期状态 %s 写入 Candidate',
    (candidateStatus) => {
      expect(() =>
        parseProvisioningCandidateManifest(
          createCandidate(
            { candidateStatus },
            { candidateDigest: `sha256:${'0'.repeat(64)}` },
          ),
          { contextPolicy },
        ),
      ).toThrow('provisioning_candidate_status_invalid');
    },
  );

  it.each(['approvalStatus', 'approvedAt', 'approvedByReference'])(
    '拒绝审批字段 %s',
    (field) => {
      expect(() =>
        parseProvisioningCandidateManifest(
          { ...createCandidate(), [field]: 'forbidden' },
          { contextPolicy },
        ),
      ).toThrow('provisioning_candidate_approval_field_forbidden');
    },
  );

  it('拒绝未知 Source descriptor 字段', () => {
    expect(() =>
      parseProvisioningCandidateManifest(
        createCandidate(
          {
            candidateSource: {
              sourceVersion: PROVISIONING_CANDIDATE_SOURCE_VERSION,
              sourceType: PROVISIONING_CANDIDATE_SOURCE_TYPE,
              database: 'forbidden',
            },
          },
          { candidateDigest: `sha256:${'0'.repeat(64)}` },
        ),
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_source_descriptor_shape_invalid');
  });

  it('拒绝数据库 Source 类型', () => {
    expect(() =>
      parseProvisioningCandidateManifest(
        createCandidate(
          {
            candidateSource: {
              sourceVersion: PROVISIONING_CANDIDATE_SOURCE_VERSION,
              sourceType: 'database',
            },
          },
          { candidateDigest: `sha256:${'0'.repeat(64)}` },
        ),
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_source_type_invalid');
  });

  it('拒绝空 entries', () => {
    expect(() =>
      parseProvisioningCandidateManifest(
        createCandidate(
          { entries: [] },
          { candidateDigest: `sha256:${'0'.repeat(64)}` },
        ),
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_entries_invalid');
  });

  it('拒绝重复 tenantReference + institutionReference', () => {
    const entry = createEntry();
    const canonical = createCanonical({ entries: [entry, { ...entry }] });
    expect(() =>
      parseProvisioningCandidateManifest(
        {
          ...canonical,
          candidateDigest:
            computeProvisioningCandidateManifestDigest(canonical)
              .candidateDigest,
        },
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_duplicate_scope');
  });

  it('拒绝未知 entry 字段', () => {
    const canonical = createCanonical({
      entries: [createEntry({ notes: 'forbidden' })],
    });
    expect(() =>
      parseProvisioningCandidateManifest(
        {
          ...canonical,
          candidateDigest:
            computeProvisioningCandidateManifestDigest(canonical)
              .candidateDigest,
        },
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_entry_shape_invalid');
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
    expect(() =>
      parseProvisioningCandidateManifest(
        {
          ...canonical,
          candidateDigest:
            computeProvisioningCandidateManifestDigest(canonical)
              .candidateDigest,
        },
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_entry_shape_invalid');
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
    expect(() =>
      parseProvisioningCandidateManifest(
        {
          ...canonical,
          candidateDigest:
            computeProvisioningCandidateManifestDigest(canonical)
              .candidateDigest,
        },
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_tenant_reference_invalid');
  });

  it('拒绝非法 scopeStatusCandidate', () => {
    const canonical = createCanonical({
      entries: [createEntry({ scopeStatusCandidate: 'deleted' })],
    });
    expect(() =>
      parseProvisioningCandidateManifest(
        {
          ...canonical,
          candidateDigest:
            computeProvisioningCandidateManifestDigest(canonical)
              .candidateDigest,
        },
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_scope_status_invalid');
  });

  it('拒绝非法 contextCandidate', () => {
    const canonical = createCanonical({
      entries: [createEntry({ contextCandidate: 'runtime_default' })],
    });
    expect(() =>
      parseProvisioningCandidateManifest(
        {
          ...canonical,
          candidateDigest:
            computeProvisioningCandidateManifestDigest(canonical)
              .candidateDigest,
        },
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_context_candidate_invalid');
  });

  it.each([
    ['未批准时区', { timezone: 'UTC' }, 'provisioning_candidate_timezone_not_allowed'],
    ['非法时区', { timezone: 'Not A Zone' }, 'provisioning_candidate_timezone_invalid'],
    ['未批准币种', { currency: 'USD' }, 'provisioning_candidate_currency_not_allowed'],
    ['非法币种', { currency: 'cny' }, 'provisioning_candidate_currency_invalid'],
  ])('拒绝%s', (_name, override, code) => {
    const canonical = createCanonical({
      entries: [createEntry(override)],
    });
    expect(() =>
      parseProvisioningCandidateManifest(
        {
          ...canonical,
          candidateDigest:
            computeProvisioningCandidateManifestDigest(canonical)
              .candidateDigest,
        },
        { contextPolicy },
      ),
    ).toThrow(code);
  });

  it('拒绝调用方伪造 UTC／USD Context Policy', () => {
    const canonical = createCanonical({
      entries: [
        createEntry({
          timezone: 'UTC',
          currency: 'USD',
          effectiveAt: '2026-07-30T00:00:00.000Z',
        }),
      ],
    });
    expect(() =>
      parseProvisioningCandidateManifest(
        {
          ...canonical,
          candidateDigest:
            computeProvisioningCandidateManifestDigest(canonical)
              .candidateDigest,
        },
        {
          contextPolicy: {
            policyVersion: 'mig01-a2-local-acceptance-context-policy/v1',
            targetEnvironment: 'local_acceptance',
            timezones: ['UTC'],
            currencies: ['USD'],
          } as never,
        },
      ),
    ).toThrow('provisioning_candidate_context_timezone_policy_invalid');
  });

  it.each([
    [
      '非法日期',
      { effectiveFromBusinessDate: '2026-02-30' },
      'provisioning_candidate_business_date_invalid',
    ],
    [
      '非法 instant',
      { effectiveAt: '2026-07-30T00:00:00Z' },
      'provisioning_candidate_effective_at_invalid',
    ],
    [
      '业务日期不匹配',
      { effectiveFromBusinessDate: '2026-07-31' },
      'provisioning_candidate_effective_date_mismatch',
    ],
  ])('拒绝%s', (_name, override, code) => {
    const canonical = createCanonical({
      entries: [createEntry(override)],
    });
    expect(() =>
      parseProvisioningCandidateManifest(
        {
          ...canonical,
          candidateDigest:
            computeProvisioningCandidateManifestDigest(canonical)
              .candidateDigest,
        },
        { contextPolicy },
      ),
    ).toThrow(code);
  });

  it('拒绝非法 generatedAt', () => {
    expect(() =>
      parseProvisioningCandidateManifest(
        createCandidate(
          { generatedAt: '2026-07-30T01:02:03Z' },
          { candidateDigest: `sha256:${'0'.repeat(64)}` },
        ),
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_generated_at_invalid');
  });

  it('拒绝敏感 generatedByReference', () => {
    expect(() =>
      parseProvisioningCandidateManifest(
        createCandidate(
          { generatedByReference: 'secret-ref-001' },
          { candidateDigest: `sha256:${'0'.repeat(64)}` },
        ),
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_generated_by_reference_invalid');
  });

  it('拒绝非法 digest 格式', () => {
    expect(() =>
      parseProvisioningCandidateManifest(
        createCandidate({}, { candidateDigest: 'sha256:not-a-digest' }),
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_digest_invalid');
  });

  it('拒绝 digest mismatch', () => {
    expect(() =>
      parseProvisioningCandidateManifest(
        createCandidate({}, { candidateDigest: `sha256:${'0'.repeat(64)}` }),
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_digest_mismatch');
  });

  it('拒绝未由 Parser 颁发的结构伪造对象', () => {
    expect(() =>
      assertParsedProvisioningCandidateManifest(createCandidate()),
    ).toThrow('provisioning_candidate_not_parsed');
  });

  it('审核生命周期从 generated 单向进入 review_pending 且 digest 不变', () => {
    const parsed = parseProvisioningCandidateManifest(createCandidate(), {
      contextPolicy,
    });
    const generated = createGeneratedCandidateReviewState(parsed);
    const pending = markCandidateReviewPending(generated, {
      reviewerReference: 'reviewer-ref-001',
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
      reviewerReference: 'reviewer-ref-001',
    });
    expect(Object.isFrozen(generated)).toBe(true);
    expect(Object.isFrozen(pending)).toBe(true);
  });

  it('拒绝从 review_pending 重复流转', () => {
    const parsed = parseProvisioningCandidateManifest(createCandidate(), {
      contextPolicy,
    });
    const pending = markCandidateReviewPending(
      createGeneratedCandidateReviewState(parsed),
      { reviewerReference: 'reviewer-ref-001' },
    );
    expect(() =>
      markCandidateReviewPending(pending, {
        reviewerReference: 'reviewer-ref-002',
      }),
    ).toThrow('provisioning_candidate_review_transition_invalid');
  });

  it('拒绝敏感 Reviewer 引用', () => {
    const parsed = parseProvisioningCandidateManifest(createCandidate(), {
      contextPolicy,
    });
    expect(() =>
      markCandidateReviewPending(createGeneratedCandidateReviewState(parsed), {
        reviewerReference: 'password-ref',
      }),
    ).toThrow('provisioning_candidate_reviewer_reference_invalid');
  });

  it('拒绝 Generator 兼任 Reviewer', () => {
    const parsed = parseProvisioningCandidateManifest(createCandidate(), {
      contextPolicy,
    });
    expect(() =>
      markCandidateReviewPending(createGeneratedCandidateReviewState(parsed), {
        reviewerReference: parsed.generatedByReference,
      }),
    ).toThrow('provisioning_candidate_reviewer_generator_conflict');
  });

  it('拒绝伪造审核状态', () => {
    expect(() =>
      markCandidateReviewPending(
        {
          candidateDigest: `sha256:${'0'.repeat(64)}`,
          generatedByReference: 'generator-ref-001',
          reviewStatus: 'generated',
          reviewerReference: null,
        } as never,
        { reviewerReference: 'reviewer-ref-001' },
      ),
    ).toThrow('provisioning_candidate_review_state_invalid');
  });
});
