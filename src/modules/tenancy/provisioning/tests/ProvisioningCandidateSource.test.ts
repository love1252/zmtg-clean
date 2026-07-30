import { describe, expect, it } from 'vitest';
import {
  PROVISIONING_CANDIDATE_SOURCE_TYPE,
  PROVISIONING_CANDIDATE_SOURCE_VERSION,
  type ProvisioningCandidateEntryV1,
} from '../provisioning-candidate-canonicalization';
import {
  assertParsedProvisioningCandidateSource,
  createProvisioningCandidateFromSource,
  parseProvisioningCandidateSource,
} from '../provisioning-candidate-source';
import { LOCAL_ACCEPTANCE_PROVISIONING_CONTEXT_POLICY } from '../provisioning-context-policy';

const contextPolicy = LOCAL_ACCEPTANCE_PROVISIONING_CONTEXT_POLICY;

function createEntry(
  overrides: Record<string, unknown> = {},
): ProvisioningCandidateEntryV1 & Record<string, unknown> {
  return {
    tenantReference: 'synthetic-tenant-ref-001',
    institutionReference: 'synthetic-institution-ref-001',
    scopeStatusCandidate: 'active',
    contextCandidate: 'institution_config',
    timezone: 'Asia/Shanghai',
    currency: 'CNY',
    effectiveFromBusinessDate: '2026-07-30',
    effectiveAt: '2026-07-30T00:00:00.000Z',
    ...overrides,
  } as ProvisioningCandidateEntryV1 & Record<string, unknown>;
}

function createSource(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    sourceVersion: PROVISIONING_CANDIDATE_SOURCE_VERSION,
    sourceType: PROVISIONING_CANDIDATE_SOURCE_TYPE,
    entries: [createEntry()],
    ...overrides,
  };
}

describe('MIG-01A2 Candidate Source 低敏 fixture 边界', () => {
  it('只接受 synthetic local_acceptance_fixture 并冻结排序结果', () => {
    const parsed = parseProvisioningCandidateSource(
      createSource({
        entries: [
          createEntry({
            tenantReference: 'synthetic-tenant-b',
            institutionReference: 'synthetic-institution-2',
          }),
          createEntry({
            tenantReference: 'synthetic-tenant-a',
            institutionReference: 'synthetic-institution-1',
          }),
        ],
      }),
      { contextPolicy },
    );

    expect(parsed.sourceType).toBe('local_acceptance_fixture');
    expect(parsed.entries.map((entry) => entry.tenantReference)).toEqual([
      'synthetic-tenant-a',
      'synthetic-tenant-b',
    ]);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.entries)).toBe(true);
    expect(Object.isFrozen(parsed.entries[0])).toBe(true);
    expect(() => assertParsedProvisioningCandidateSource(parsed)).not.toThrow();
  });

  it('拒绝非对象 Source', () => {
    expect(() =>
      parseProvisioningCandidateSource(null, { contextPolicy }),
    ).toThrow('provisioning_candidate_source_invalid');
  });

  it('拒绝未知 Source 字段和数据库旁路能力', () => {
    expect(() =>
      parseProvisioningCandidateSource(
        { ...createSource(), query: 'SELECT * FROM tenants' },
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_source_shape_invalid');
  });

  it.each(['sourceVersion', 'sourceType', 'entries'])(
    '拒绝缺少 Source 字段 %s',
    (field) => {
      const source = createSource();
      delete source[field];
      expect(() =>
        parseProvisioningCandidateSource(source, { contextPolicy }),
      ).toThrow('provisioning_candidate_source_shape_invalid');
    },
  );

  it('拒绝未知 Source 版本', () => {
    expect(() =>
      parseProvisioningCandidateSource(
        createSource({ sourceVersion: 'mig01-a2-candidate-source/v2' }),
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_source_version_invalid');
  });

  it.each(['database', 'tenants', 'repository', 'environment'])(
    '拒绝从 %s 推断 Candidate',
    (sourceType) => {
      expect(() =>
        parseProvisioningCandidateSource(createSource({ sourceType }), {
          contextPolicy,
        }),
      ).toThrow('provisioning_candidate_source_type_invalid');
    },
  );

  it('拒绝空 fixture，不把缺失事实解释为 no-op', () => {
    expect(() =>
      parseProvisioningCandidateSource(createSource({ entries: [] }), {
        contextPolicy,
      }),
    ).toThrow('provisioning_candidate_source_entries_invalid');
  });

  it('拒绝重复 tenant／institution reference', () => {
    const entry = createEntry();
    expect(() =>
      parseProvisioningCandidateSource(
        createSource({ entries: [entry, { ...entry }] }),
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_source_duplicate_scope');
  });

  it('拒绝 tenantId／institutionId 数据库字段别名', () => {
    expect(() =>
      parseProvisioningCandidateSource(
        createSource({
          entries: [
            {
              ...createEntry(),
              tenantId: 'do-not-infer',
              institutionId: 'do-not-infer',
            },
          ],
        }),
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_entry_shape_invalid');
  });

  it.each([
    'institutionReference',
    'contextCandidate',
    'timezone',
    'currency',
    'effectiveFromBusinessDate',
    'effectiveAt',
  ])('拒绝缺失的显式 Candidate 字段 %s', (field) => {
    const entry = createEntry();
    delete entry[field];
    expect(() =>
      parseProvisioningCandidateSource(
        createSource({ entries: [entry] }),
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_entry_shape_invalid');
  });

  it('拒绝把敏感引用放入 fixture', () => {
    expect(() =>
      parseProvisioningCandidateSource(
        createSource({
          entries: [
            createEntry({
              institutionReference: 'secret-ref-001',
            }),
          ],
        }),
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_institution_reference_invalid');
  });

  it('从已解析 Source 创建 Candidate，不产生 Approved 字段', () => {
    const source = parseProvisioningCandidateSource(createSource(), {
      contextPolicy,
    });
    const candidate = createProvisioningCandidateFromSource(
      source,
      {
        generatedAt: '2026-07-30T02:03:04.000Z',
        generatedByReference: 'generator-ref-001',
      },
      { contextPolicy },
    );

    expect(candidate.manifestVersion).toBe('mig01-a2-candidate/v1');
    expect(candidate.candidateStatus).toBe('candidate');
    expect(candidate.candidateSource).toEqual({
      sourceVersion: 'mig01-a2-candidate-source/v1',
      sourceType: 'local_acceptance_fixture',
    });
    expect(candidate.generatedAt).toBe('2026-07-30T02:03:04.000Z');
    expect(candidate).not.toHaveProperty('approvalStatus');
    expect(candidate).not.toHaveProperty('approvedAt');
    expect(candidate).not.toHaveProperty('approvedByReference');
  });

  it('Generator time 必须由调用方显式提供且进入 Candidate', () => {
    const source = parseProvisioningCandidateSource(createSource(), {
      contextPolicy,
    });
    const first = createProvisioningCandidateFromSource(
      source,
      {
        generatedAt: '2026-07-30T02:03:04.000Z',
        generatedByReference: 'generator-ref-001',
      },
      { contextPolicy },
    );
    const second = createProvisioningCandidateFromSource(
      source,
      {
        generatedAt: '2026-07-30T02:03:05.000Z',
        generatedByReference: 'generator-ref-001',
      },
      { contextPolicy },
    );

    expect(first.generatedAt).not.toBe(second.generatedAt);
    expect(first.candidateDigest).not.toBe(second.candidateDigest);
  });

  it('解析与 Candidate 创建不修改输入 fixture', () => {
    const raw = createSource();
    const before = structuredClone(raw);
    const source = parseProvisioningCandidateSource(raw, { contextPolicy });
    createProvisioningCandidateFromSource(
      source,
      {
        generatedAt: '2026-07-30T02:03:04.000Z',
        generatedByReference: 'generator-ref-001',
      },
      { contextPolicy },
    );

    expect(raw).toEqual(before);
  });

  it('拒绝未由 Source Parser 颁发的结构伪造对象', () => {
    expect(() =>
      createProvisioningCandidateFromSource(
        createSource() as never,
        {
          generatedAt: '2026-07-30T02:03:04.000Z',
          generatedByReference: 'generator-ref-001',
        },
        { contextPolicy },
      ),
    ).toThrow('provisioning_candidate_source_not_parsed');
  });
});
