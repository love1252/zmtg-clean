import { describe, expect, it } from 'vitest';
import {
  buildV1KnowledgeBaseVersionVisibilityReadonlySummary,
  defaultV1KnowledgeBaseVersionVisibilityReadonlyPolicy,
  v1KnowledgeBaseVersionVisibilityReadonlyItemFields,
} from '@/modules/workspace/domain/v1-knowledge-base-version-visibility-readonly-view-models';
import { validateV1LowSensitivityFieldWhitelist } from '@/modules/workspace/domain/v1-low-sensitivity-field-whitelist';
import type { V1KnowledgeBaseReadonlyCandidateInput } from '@/modules/workspace/domain/v1-knowledge-base-readonly-view-models';

const enabledPlatformPolicy = {
  featureEnabled: true,
  canReadKnowledgeBaseVersionVisibility: true,
  tenantScopeMatched: true,
  viewerScope: 'platform' as const,
};

const enabledInstitutionPolicy = {
  featureEnabled: true,
  canReadKnowledgeBaseVersionVisibility: true,
  tenantScopeMatched: true,
  viewerScope: 'institution' as const,
  viewerInstitutionScopeCode: 'demo-inst-a',
};

const versionVisibilitySummaryFields = [
  'status',
  'reasonCode',
  'resultCode',
  'readonly',
  'emptyCopy',
  'exceptionCopy',
  'items',
];

const versionVisibilityLowSensitiveFields = [
  ...versionVisibilitySummaryFields,
  ...v1KnowledgeBaseVersionVisibilityReadonlyItemFields,
];

function platformCandidate(
  overrides: Partial<V1KnowledgeBaseReadonlyCandidateInput> = {},
): V1KnowledgeBaseReadonlyCandidateInput {
  return {
    scope: 'platform_knowledge_base',
    knowledgeType: 'project_knowledge',
    title: '平台项目知识',
    lowSensitiveSummary: 'demo 平台项目知识版本摘要',
    sourceLabel: '平台知识种子',
    visibilityScope: 'platform_global',
    publishStatus: 'published',
    versionSummary: 'v1 stable',
    versionStatus: 'current',
    permissionStatus: 'visible',
    mockSeedDemoFlag: 'demo',
    ...overrides,
  };
}

function institutionCandidate(
  overrides: Partial<V1KnowledgeBaseReadonlyCandidateInput> = {},
): V1KnowledgeBaseReadonlyCandidateInput {
  return {
    scope: 'institution_knowledge_base',
    knowledgeType: 'institution_faq',
    title: '机构 FAQ',
    lowSensitiveSummary: 'seed 机构 FAQ 版本摘要',
    sourceLabel: '机构知识种子',
    visibilityScope: 'institution_private:demo-inst-a',
    publishStatus: 'published',
    versionSummary: 'v2 stable',
    versionStatus: 'current',
    permissionStatus: 'visible',
    mockSeedDemoFlag: 'seed',
    ...overrides,
  };
}

function expectVersionVisibilityLowSensitiveWhitelist(payload: unknown) {
  const result = validateV1LowSensitivityFieldWhitelist(payload, {
    allowedFields: versionVisibilityLowSensitiveFields,
  });

  expect(result.valid).toBe(true);
  expect(result.unknownFields).toEqual([]);
  expect(result.forbiddenFields).toEqual([]);
  expect(result.forbiddenValues).toEqual([]);
}

function expectNoVersionVisibilityRuntimeFragments(payload: unknown) {
  const serialized = JSON.stringify(payload);

  [
    'upload',
    'parse',
    'embedding',
    'vector',
    'runtime',
    'allowedActions',
    'selectedAction',
    'executableAction',
    'mutationPayload',
    'createTask',
    'createAppointment',
    'createDeal',
    'credential',
    'hisConnection',
    'hisRawPayload',
    'realCustomerData',
    'modelApiKey',
    'prompt',
    'completion',
    'payment',
    'contract',
    'invoice',
  ].forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

describe('V1 知识库版本与可见范围 readonly 治理 view model', () => {
  it('默认关闭时优先返回 disabled 且不回显候选版本详情', () => {
    const summary = buildV1KnowledgeBaseVersionVisibilityReadonlySummary(
      {
        candidates: [
          platformCandidate({
            uploadPayload: { fileName: 'real.docx' },
            embeddingVector: [0.1, 0.2],
          }),
        ],
      },
      defaultV1KnowledgeBaseVersionVisibilityReadonlyPolicy,
    );

    expect(defaultV1KnowledgeBaseVersionVisibilityReadonlyPolicy.featureEnabled).toBe(false);
    expect(summary).toEqual({
      status: 'disabled',
      reasonCode: 'feature_flag_disabled',
      resultCode: 'skipped',
      readonly: true,
      emptyCopy: '该知识库版本与可见范围只读能力暂未开启',
      items: [],
    });
    expect(JSON.stringify(summary)).not.toContain('平台项目知识');
    expectVersionVisibilityLowSensitiveWhitelist(summary);
    expectNoVersionVisibilityRuntimeFragments(summary);
  });

  it('平台知识版本 ready 输出平台全局与指定机构可见范围摘要', () => {
    const summary = buildV1KnowledgeBaseVersionVisibilityReadonlySummary(
      {
        candidates: [
          platformCandidate({
            visibilityScope: 'platform_global',
            publishStatus: 'published',
            versionSummary: 'v1 stable',
            versionStatus: 'current',
            permissionStatus: 'visible',
            prompt: 'prompt should not render',
          }),
          platformCandidate({
            knowledgeType: 'risk_notice',
            title: '平台风险提示',
            lowSensitiveSummary: 'seed 风险提示版本摘要',
            visibilityScope: 'specified_institution:demo-inst-a',
            publishStatus: 'draft',
            versionSummary: 'v2 review',
            versionStatus: 'reviewing',
            permissionStatus: 'restricted',
            mockSeedDemoFlag: 'seed',
          }),
        ],
      },
      enabledPlatformPolicy,
    );

    expect(summary).toMatchObject({
      status: 'ready',
      reasonCode: 'knowledge_base_version_visibility_ready',
      resultCode: 'readonly',
      readonly: true,
    });
    expect(summary.items).toEqual([
      {
        scope: 'platform_knowledge_base',
        knowledgeType: 'project_knowledge',
        versionSummary: 'v1 stable',
        versionStatus: 'current',
        publishStatus: 'published',
        publishStatusSummary: 'published / visible',
        visibilityGovernance: 'platform_global',
        visibilityScopeSummary: '平台全局',
        versionGovernance: 'current',
        readiness: 'ready',
        mockSeedDemoFlag: 'demo',
        readonly: true,
        reasonCode: 'knowledge_base_version_visibility_ready',
        resultCode: 'readonly',
      },
      {
        scope: 'platform_knowledge_base',
        knowledgeType: 'risk_notice',
        versionSummary: 'v2 review',
        versionStatus: 'reviewing',
        publishStatus: 'draft',
        publishStatusSummary: 'draft / restricted',
        visibilityGovernance: 'specified_institution',
        visibilityScopeSummary: '指定机构',
        versionGovernance: 'reviewing',
        readiness: 'draft',
        mockSeedDemoFlag: 'seed',
        readonly: true,
        reasonCode: 'knowledge_base_version_visibility_draft',
        resultCode: 'readonly',
      },
    ]);
    summary.items.forEach((item) => {
      expect(Object.keys(item).sort()).toEqual(
        [...v1KnowledgeBaseVersionVisibilityReadonlyItemFields].sort(),
      );
      expect(item.readonly).toBe(true);
    });
    expect(JSON.stringify(summary)).not.toContain('demo-inst-a');
    expectVersionVisibilityLowSensitiveWhitelist(summary);
    expectNoVersionVisibilityRuntimeFragments(summary);
  });

  it('机构知识版本 ready 输出机构私有摘要并隔离其他机构私有知识', () => {
    const summary = buildV1KnowledgeBaseVersionVisibilityReadonlySummary(
      {
        candidates: [
          institutionCandidate(),
          institutionCandidate({
            title: '其他机构私有知识不应展示',
            lowSensitiveSummary: '不应展示',
            visibilityScope: 'institution_private:demo-inst-b',
            mockSeedDemoFlag: 'mock',
          }),
          institutionCandidate({
            knowledgeType: 'project_knowledge' as never,
            title: '机构不应混入平台知识类型',
            lowSensitiveSummary: '不应展示',
            visibilityScope: 'institution_private:demo-inst-a',
            mockSeedDemoFlag: 'demo',
          }),
        ],
      },
      enabledInstitutionPolicy,
    );

    expect(summary.status).toBe('ready');
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]).toEqual({
      scope: 'institution_knowledge_base',
      knowledgeType: 'institution_faq',
      versionSummary: 'v2 stable',
      versionStatus: 'current',
      publishStatus: 'published',
      publishStatusSummary: 'published / visible',
      visibilityGovernance: 'institution_private',
      visibilityScopeSummary: '机构私有',
      versionGovernance: 'current',
      readiness: 'ready',
      mockSeedDemoFlag: 'seed',
      readonly: true,
      reasonCode: 'knowledge_base_version_visibility_ready',
      resultCode: 'readonly',
    });
    expect(JSON.stringify(summary)).not.toContain('其他机构私有知识不应展示');
    expect(JSON.stringify(summary)).not.toContain('机构不应混入平台知识类型');
    expect(JSON.stringify(summary)).not.toContain('demo-inst-a');
    expect(JSON.stringify(summary)).not.toContain('demo-inst-b');
    expectVersionVisibilityLowSensitiveWhitelist(summary);
    expectNoVersionVisibilityRuntimeFragments(summary);
  });

  it('发布状态治理覆盖 draft / published / archived / disabled', () => {
    const summary = buildV1KnowledgeBaseVersionVisibilityReadonlySummary(
      {
        candidates: ['draft', 'published', 'archived', 'disabled'].map((publishStatus) =>
          platformCandidate({
            knowledgeType: 'faq',
            title: `${publishStatus} FAQ`,
            lowSensitiveSummary: `${publishStatus} FAQ version summary`,
            publishStatus: publishStatus as 'draft' | 'published' | 'archived' | 'disabled',
            versionSummary: `${publishStatus} version`,
            versionStatus: publishStatus === 'draft' ? 'reviewing' : 'current',
            permissionStatus: 'visible',
            mockSeedDemoFlag: 'demo',
          }),
        ),
      },
      enabledPlatformPolicy,
    );

    expect(summary.items.map((item) => item.publishStatus)).toEqual([
      'draft',
      'published',
      'archived',
      'disabled',
    ]);
    expect(summary.items.map((item) => item.readiness)).toEqual([
      'draft',
      'ready',
      'archived',
      'disabled',
    ]);
    expect(summary.items.map((item) => item.reasonCode)).toEqual([
      'knowledge_base_version_visibility_draft',
      'knowledge_base_version_visibility_ready',
      'knowledge_base_version_visibility_archived',
      'knowledge_base_version_visibility_disabled',
    ]);
    expectVersionVisibilityLowSensitiveWhitelist(summary);
  });

  it('empty / tenant mismatch / RBAC denied / exception 返回低敏 readonly 状态', () => {
    const empty = buildV1KnowledgeBaseVersionVisibilityReadonlySummary(
      { candidates: [] },
      enabledPlatformPolicy,
    );
    const tenantDenied = buildV1KnowledgeBaseVersionVisibilityReadonlySummary(
      { candidates: [institutionCandidate()] },
      { ...enabledInstitutionPolicy, tenantScopeMatched: false },
    );
    const rbacDenied = buildV1KnowledgeBaseVersionVisibilityReadonlySummary(
      { candidates: [platformCandidate()] },
      { ...enabledPlatformPolicy, canReadKnowledgeBaseVersionVisibility: false },
    );
    const exception = buildV1KnowledgeBaseVersionVisibilityReadonlySummary(
      {
        candidates: [
          platformCandidate({
            lowSensitiveSummary: undefined,
            parseJobId: 'parse_job_should_not_render',
          }),
        ],
      },
      enabledPlatformPolicy,
    );

    expect(empty).toEqual({
      status: 'empty',
      reasonCode: 'no_knowledge_base_version_visibility_candidates',
      resultCode: 'empty',
      readonly: true,
      emptyCopy: '暂无可展示知识库版本与可见范围治理',
      items: [],
    });
    expect(tenantDenied).toMatchObject({
      status: 'denied',
      reasonCode: 'tenant_scope_mismatch',
      resultCode: 'denied',
      readonly: true,
      items: [],
    });
    expect(rbacDenied).toMatchObject({
      status: 'denied',
      reasonCode: 'permission_denied',
      resultCode: 'denied',
      readonly: true,
      items: [],
    });
    expect(exception).toEqual({
      status: 'exception',
      reasonCode: 'knowledge_base_version_visibility_source_missing',
      resultCode: 'unavailable',
      readonly: true,
      exceptionCopy: '知识库版本与可见范围来源不完整，仅作内部参考',
      items: [],
    });
    [empty, tenantDenied, rbacDenied, exception].forEach((summary) => {
      expectVersionVisibilityLowSensitiveWhitelist(summary);
      expectNoVersionVisibilityRuntimeFragments(summary);
    });
  });

  it('非 mock / seed / demo 来源安全降级且不输出高敏或写操作字段', () => {
    const summary = buildV1KnowledgeBaseVersionVisibilityReadonlySummary(
      {
        candidates: [
          platformCandidate({
            knowledgeType: 'faq',
            title: '平台 FAQ',
            lowSensitiveSummary: 'demo FAQ 版本摘要',
            mockSeedDemoFlag: 'demo',
          }),
          platformCandidate({
            knowledgeType: 'risk_notice',
            title: '真实来源不应展示',
            lowSensitiveSummary: '不应展示',
            sourceLabel: 'production',
            mockSeedDemoFlag: 'production' as never,
            vectorIndexId: 'vector_index_should_not_render',
            mutationPayload: { createTask: true },
          }),
        ],
      },
      enabledPlatformPolicy,
    );

    expect(summary.status).toBe('ready');
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]).toMatchObject({
      scope: 'platform_knowledge_base',
      knowledgeType: 'faq',
      readonly: true,
      resultCode: 'readonly',
    });
    expect(JSON.stringify(summary)).not.toContain('真实来源不应展示');
    expectVersionVisibilityLowSensitiveWhitelist(summary);
    expectNoVersionVisibilityRuntimeFragments(summary);
  });
});
