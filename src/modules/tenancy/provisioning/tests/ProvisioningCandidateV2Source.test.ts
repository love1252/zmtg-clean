import { describe, expect, it } from 'vitest';
import {
  computeProvisioningCandidateV2SourceDigest,
  PROVISIONING_CANDIDATE_V2_SOURCE_TYPE,
  PROVISIONING_CANDIDATE_V2_SOURCE_VERSION,
  type ProvisioningCandidateV2CanonicalSource,
} from '../provisioning-candidate-v2-canonicalization';
import {
  assertParsedProvisioningCandidateV2Source,
  createProvisioningCandidateV2FromSource,
  parseProvisioningCandidateV2Source,
} from '../provisioning-candidate-v2-source';
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

function createSource(
  overrides: Record<string, unknown> = {},
  digestOverride?: string,
): Record<string, unknown> {
  const canonical = {
    sourceVersion: PROVISIONING_CANDIDATE_V2_SOURCE_VERSION,
    sourceType: PROVISIONING_CANDIDATE_V2_SOURCE_TYPE,
    sourceAuthorizationReference: 'synthetic-source-authority-001',
    sourceAuthorizedAt: '2026-07-30T01:00:00.000Z',
    entries: [createEntry()],
    ...overrides,
  };
  let sourceDigest = `sha256:${'0'.repeat(64)}`;
  try {
    sourceDigest = computeProvisioningCandidateV2SourceDigest(
      canonical as unknown as ProvisioningCandidateV2CanonicalSource,
    ).sourceDigest;
  } catch {
    // 非法形状用例应由 Parser fail-closed，不由测试工厂提前失败。
  }
  sourceDigest = digestOverride ?? sourceDigest;
  return { ...canonical, sourceDigest };
}

function expectSourceError(value: unknown, code: string): void {
  expect(() =>
    parseProvisioningCandidateV2Source(value, { contextPolicy }),
  ).toThrow(code);
}

describe('MIG-01A2 用户授权 Source v2 契约', () => {
  it('接受 exact shape、校验 digest、排序并深层冻结 Source', () => {
    const parsed = parseProvisioningCandidateV2Source(
      createSource({
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
      }),
      { contextPolicy },
    );

    expect(parsed.sourceVersion).toBe('mig01-a2-candidate-source/v2');
    expect(parsed.sourceType).toBe(
      'local_acceptance_user_authorized_input',
    );
    expect(parsed.entries.map((entry) => entry.tenantReference)).toEqual([
      'tenant-synthetic-a',
      'tenant-synthetic-b',
    ]);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.entries)).toBe(true);
    expect(Object.isFrozen(parsed.entries[0])).toBe(true);
    expect(() =>
      assertParsedProvisioningCandidateV2Source(parsed),
    ).not.toThrow();
  });

  it.each([null, [], 'source'])('拒绝非对象 Source：%j', (value) => {
    expectSourceError(value, 'provisioning_candidate_v2_source_invalid');
  });

  it.each([
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
  ])('拒绝治理、执行或敏感字段 %s', (field) => {
    expectSourceError(
      { ...createSource(), [field]: 'forbidden' },
      'provisioning_candidate_v2_source_governance_field_forbidden',
    );
  });

  it('拒绝未知顶层字段', () => {
    expectSourceError(
      { ...createSource(), unexpected: true },
      'provisioning_candidate_v2_source_shape_invalid',
    );
  });

  it.each([
    'sourceVersion',
    'sourceType',
    'sourceAuthorizationReference',
    'sourceAuthorizedAt',
    'entries',
    'sourceDigest',
  ])('拒绝缺少 Source 字段 %s', (field) => {
    const source = createSource();
    delete source[field];
    expectSourceError(
      source,
      'provisioning_candidate_v2_source_shape_invalid',
    );
  });

  it.each(['mig01-a2-candidate-source/v1', 'unknown-source'])(
    '拒绝 Source version %s',
    (sourceVersion) => {
      expectSourceError(
        createSource(
          { sourceVersion },
          `sha256:${'0'.repeat(64)}`,
        ),
        'provisioning_candidate_v2_source_version_invalid',
      );
    },
  );

  it.each([
    'local_acceptance_fixture',
    'database',
    'repository',
    'environment',
  ])('拒绝 Source type %s', (sourceType) => {
    expectSourceError(
      createSource({ sourceType }, `sha256:${'0'.repeat(64)}`),
      'provisioning_candidate_v2_source_type_invalid',
    );
  });

  it.each([
    ['非 NFC', 'synthe\u0301tic-authority'],
    ['URL', 'https://example.invalid'],
    ['Token 语义', 'token-ref-001'],
    ['手机号', '13800138000'],
    ['超长', `a${'x'.repeat(96)}`],
  ])('拒绝%s Source authorization reference', (_name, reference) => {
    expectSourceError(
      createSource(
        { sourceAuthorizationReference: reference },
        `sha256:${'0'.repeat(64)}`,
      ),
      'provisioning_candidate_v2_source_authorization_reference_invalid',
    );
  });

  it.each([
    '2026-07-30T01:00:00Z',
    '2026-07-30T01:00:00.000+00:00',
    'not-an-instant',
    '2026-02-30T01:00:00.000Z',
  ])('拒绝非 canonical Source authorization time %s', (sourceAuthorizedAt) => {
    expectSourceError(
      createSource(
        { sourceAuthorizedAt },
        `sha256:${'0'.repeat(64)}`,
      ),
      'provisioning_candidate_v2_source_authorized_at_invalid',
    );
  });

  it.each([null, 'entries'])('拒绝非数组 entries：%j', (entries) => {
    expectSourceError(
      createSource({ entries }),
      'provisioning_candidate_v2_source_entries_invalid',
    );
  });

  it('拒绝空 entries', () => {
    expectSourceError(
      createSource({ entries: [] }),
      'provisioning_candidate_v2_source_entries_invalid',
    );
  });

  it('拒绝重复 tenantReference + institutionReference', () => {
    const entry = createEntry();
    expectSourceError(
      createSource({ entries: [entry, { ...entry }] }),
      'provisioning_candidate_v2_source_duplicate_scope',
    );
  });

  it.each([null, [], 'entry'])('拒绝非对象 entry：%j', (entry) => {
    expectSourceError(
      createSource({ entries: [entry] }),
      'provisioning_candidate_v2_entry_invalid',
    );
  });

  it('拒绝未知 entry 字段', () => {
    expectSourceError(
      createSource({ entries: [createEntry({ notes: 'forbidden' })] }),
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
    expectSourceError(
      createSource({ entries: [entry] }),
      'provisioning_candidate_v2_entry_shape_invalid',
    );
  });

  it.each([
    ['tenantReference', 'token-ref-001', 'tenant'],
    ['tenantReference', '13800138000', 'tenant'],
    ['institutionReference', 'secret-ref-001', 'institution'],
    ['institutionReference', '13800138000', 'institution'],
  ])('拒绝 %s 中的敏感引用 %s', (field, reference, kind) => {
    expectSourceError(
      createSource({ entries: [createEntry({ [field]: reference })] }),
      `provisioning_candidate_v2_${kind}_reference_invalid`,
    );
  });

  it.each([
    `sha256:${'A'.repeat(64)}`,
    `sha512:${'0'.repeat(64)}`,
    'sha256:1234',
  ])('拒绝非法 Source digest %s', (sourceDigest) => {
    expectSourceError(
      createSource({}, sourceDigest),
      'provisioning_candidate_v2_source_digest_invalid',
    );
  });

  it('拒绝 Source digest mismatch', () => {
    expectSourceError(
      createSource({}, `sha256:${'0'.repeat(64)}`),
      'provisioning_candidate_v2_source_digest_mismatch',
    );
  });

  it('拒绝未由 Source Parser 颁发的结构伪造对象', () => {
    expect(() =>
      assertParsedProvisioningCandidateV2Source(createSource()),
    ).toThrow('provisioning_candidate_v2_source_not_parsed');
  });

  it('v1 Source 无法冒充 v2 Source', () => {
    const source = createSource({
      sourceVersion: 'mig01-a2-candidate-source/v1',
      sourceType: 'local_acceptance_fixture',
    });
    expectSourceError(
      source,
      'provisioning_candidate_v2_source_version_invalid',
    );
  });

  it('只从已解析 Source 创建 Candidate，并绑定四个 Source 字段', () => {
    const source = parseProvisioningCandidateV2Source(createSource(), {
      contextPolicy,
    });
    const candidate = createProvisioningCandidateV2FromSource(
      source,
      {
        generatedAt: '2026-07-30T02:00:00.000Z',
        generatedByReference: 'synthetic-generator-001',
      },
      { contextPolicy },
    );

    expect(candidate.manifestVersion).toBe('mig01-a2-candidate/v2');
    expect(candidate.candidateStatus).toBe('candidate');
    expect(candidate.candidateSource).toEqual({
      sourceVersion: source.sourceVersion,
      sourceType: source.sourceType,
      sourceAuthorizationReference: source.sourceAuthorizationReference,
      sourceDigest: source.sourceDigest,
    });
    expect(candidate).not.toHaveProperty('approvalStatus');
    expect(candidate).not.toHaveProperty('approvedAt');
    expect(candidate).not.toHaveProperty('approvedByReference');
  });

  it('Source digest 变化会传播到 Candidate digest', () => {
    const firstSource = parseProvisioningCandidateV2Source(createSource(), {
      contextPolicy,
    });
    const secondSource = parseProvisioningCandidateV2Source(
      createSource({
        sourceAuthorizedAt: '2026-07-30T01:00:01.000Z',
      }),
      { contextPolicy },
    );
    const generate = (
      source: Parameters<typeof createProvisioningCandidateV2FromSource>[0],
    ) =>
      createProvisioningCandidateV2FromSource(
        source,
        {
          generatedAt: '2026-07-30T02:00:00.000Z',
          generatedByReference: 'synthetic-generator-001',
        },
        { contextPolicy },
      );

    expect(generate(firstSource).candidateDigest).not.toBe(
      generate(secondSource).candidateDigest,
    );
  });

  it('generatedAt 必须由调用方显式提供并进入 Candidate digest', () => {
    const source = parseProvisioningCandidateV2Source(createSource(), {
      contextPolicy,
    });
    const first = createProvisioningCandidateV2FromSource(
      source,
      {
        generatedAt: '2026-07-30T02:00:00.000Z',
        generatedByReference: 'synthetic-generator-001',
      },
      { contextPolicy },
    );
    const second = createProvisioningCandidateV2FromSource(
      source,
      {
        generatedAt: '2026-07-30T02:00:01.000Z',
        generatedByReference: 'synthetic-generator-001',
      },
      { contextPolicy },
    );

    expect(first.generatedAt).not.toBe(second.generatedAt);
    expect(first.candidateDigest).not.toBe(second.candidateDigest);
  });

  it('解析与 Candidate 创建均不修改输入 Source', () => {
    const raw = createSource();
    const before = structuredClone(raw);
    const source = parseProvisioningCandidateV2Source(raw, {
      contextPolicy,
    });
    createProvisioningCandidateV2FromSource(
      source,
      {
        generatedAt: '2026-07-30T02:00:00.000Z',
        generatedByReference: 'synthetic-generator-001',
      },
      { contextPolicy },
    );
    expect(raw).toEqual(before);
  });

  it('拒绝绕过 Parser 直接创建 Candidate', () => {
    expect(() =>
      createProvisioningCandidateV2FromSource(
        createSource() as never,
        {
          generatedAt: '2026-07-30T02:00:00.000Z',
          generatedByReference: 'synthetic-generator-001',
        },
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_v2_source_not_parsed');
  });
});
