import { describe, expect, it } from 'vitest';
import {
  buildV1KnowledgeBaseCatalogReadonlySummary,
  defaultV1KnowledgeBaseCatalogReadonlyPolicy,
  v1KnowledgeBaseCatalogReadonlyItemFields,
} from '@/modules/workspace/domain/v1-knowledge-base-catalog-readonly-view-models';
import { validateV1LowSensitivityFieldWhitelist } from '@/modules/workspace/domain/v1-low-sensitivity-field-whitelist';

const enabledPolicy = {
  featureEnabled: true,
  canReadKnowledgeBaseCatalog: true,
  tenantScopeMatched: true,
};

const catalogSummaryFields = [
  'status',
  'reasonCode',
  'resultCode',
  'readonly',
  'emptyCopy',
  'exceptionCopy',
  'items',
];

const catalogLowSensitiveFields = [
  ...catalogSummaryFields,
  ...v1KnowledgeBaseCatalogReadonlyItemFields,
];

function expectCatalogLowSensitiveWhitelist(payload: unknown) {
  const result = validateV1LowSensitivityFieldWhitelist(payload, {
    allowedFields: catalogLowSensitiveFields,
  });

  expect(result.valid).toBe(true);
  expect(result.unknownFields).toEqual([]);
  expect(result.forbiddenFields).toEqual([]);
  expect(result.forbiddenValues).toEqual([]);
}

function expectNoCatalogRuntimeFragments(payload: unknown) {
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

describe('V1 知识库目录与发布状态 readonly 聚合 view model', () => {
  it('默认关闭时优先返回 disabled 且不回显候选目录详情', () => {
    const summary = buildV1KnowledgeBaseCatalogReadonlySummary(
      {
        candidates: [
          {
            scope: 'platform_knowledge_base',
            knowledgeType: 'project_knowledge',
            title: '平台项目知识',
            lowSensitiveSummary: 'demo 项目知识目录摘要',
            sourceLabel: '平台种子知识',
            visibilityScope: 'platform_default',
            publishStatus: 'published',
            versionSummary: 'v1 stable',
            versionStatus: 'current',
            permissionStatus: 'visible',
            mockSeedDemoFlag: 'demo',
            uploadPayload: { fileName: 'real.docx' },
            embeddingVector: [0.1, 0.2],
          },
        ],
      },
      defaultV1KnowledgeBaseCatalogReadonlyPolicy,
    );

    expect(defaultV1KnowledgeBaseCatalogReadonlyPolicy.featureEnabled).toBe(false);
    expect(summary).toEqual({
      status: 'disabled',
      reasonCode: 'feature_flag_disabled',
      resultCode: 'skipped',
      readonly: true,
      emptyCopy: '该知识库目录只读能力暂未开启',
      items: [],
    });
    expect(JSON.stringify(summary)).not.toContain('平台项目知识');
    expectCatalogLowSensitiveWhitelist(summary);
    expectNoCatalogRuntimeFragments(summary);
  });

  it('平台知识目录 ready 输出分类、发布状态、版本和可见范围低敏摘要', () => {
    const summary = buildV1KnowledgeBaseCatalogReadonlySummary(
      {
        candidates: [
          {
            scope: 'platform_knowledge_base',
            knowledgeType: 'project_knowledge',
            title: '平台项目知识 A',
            lowSensitiveSummary: 'demo 项目知识目录摘要',
            sourceLabel: '平台知识种子',
            visibilityScope: 'platform_default',
            publishStatus: 'published',
            versionSummary: 'v1 stable',
            versionStatus: 'current',
            permissionStatus: 'visible',
            mockSeedDemoFlag: 'demo',
            prompt: 'prompt should not render',
          },
          {
            scope: 'platform_knowledge_base',
            knowledgeType: 'risk_notice',
            title: '风险提示 B',
            lowSensitiveSummary: 'seed 风险提示目录摘要',
            sourceLabel: '平台风控知识',
            visibilityScope: 'platform_internal',
            publishStatus: 'draft',
            versionSummary: 'v2 review',
            versionStatus: 'reviewing',
            permissionStatus: 'restricted',
            mockSeedDemoFlag: 'seed',
          },
        ],
      },
      enabledPolicy,
    );

    expect(summary).toMatchObject({
      status: 'ready',
      reasonCode: 'knowledge_base_catalog_ready',
      resultCode: 'readonly',
      readonly: true,
    });
    expect(summary.items).toEqual([
      {
        scope: 'platform_knowledge_base',
        knowledgeType: 'project_knowledge',
        categorySummary: 'platform_knowledge_base / project_knowledge',
        publishStatus: 'published',
        publishStatusSummary: 'published / visible',
        versionSummary: 'v1 stable',
        visibilityScopeSummary: 'platform_default',
        readiness: 'ready',
        mockSeedDemoFlag: 'demo',
        readonly: true,
        reasonCode: 'knowledge_base_catalog_ready',
        resultCode: 'readonly',
      },
      {
        scope: 'platform_knowledge_base',
        knowledgeType: 'risk_notice',
        categorySummary: 'platform_knowledge_base / risk_notice',
        publishStatus: 'draft',
        publishStatusSummary: 'draft / restricted',
        versionSummary: 'v2 review',
        visibilityScopeSummary: 'platform_internal',
        readiness: 'draft',
        mockSeedDemoFlag: 'seed',
        readonly: true,
        reasonCode: 'knowledge_base_catalog_draft',
        resultCode: 'readonly',
      },
    ]);
    summary.items.forEach((item) => {
      expect(Object.keys(item).sort()).toEqual([...v1KnowledgeBaseCatalogReadonlyItemFields].sort());
      expect(item.readonly).toBe(true);
    });
    expect(JSON.stringify(summary)).not.toContain('平台项目知识 A');
    expectCatalogLowSensitiveWhitelist(summary);
    expectNoCatalogRuntimeFragments(summary);
  });

  it('机构知识目录 ready 且不与平台目录混淆', () => {
    const summary = buildV1KnowledgeBaseCatalogReadonlySummary(
      {
        candidates: [
          {
            scope: 'institution_knowledge_base',
            knowledgeType: 'price_package',
            title: '机构价格套餐',
            lowSensitiveSummary: 'mock 价格套餐目录摘要',
            sourceLabel: '机构知识种子',
            visibilityScope: 'institution_internal',
            publishStatus: 'archived',
            versionSummary: 'v3 archived',
            versionStatus: 'deprecated',
            permissionStatus: 'visible',
            mockSeedDemoFlag: 'mock',
          },
          {
            scope: 'institution_knowledge_base',
            knowledgeType: 'project_knowledge' as never,
            title: '机构不应使用平台项目知识',
            lowSensitiveSummary: '不应展示',
            sourceLabel: 'invalid',
            visibilityScope: 'institution_internal',
            publishStatus: 'published',
            versionSummary: 'v1',
            versionStatus: 'current',
            permissionStatus: 'visible',
            mockSeedDemoFlag: 'demo',
          },
        ],
      },
      enabledPolicy,
    );

    expect(summary.status).toBe('ready');
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]).toEqual({
      scope: 'institution_knowledge_base',
      knowledgeType: 'price_package',
      categorySummary: 'institution_knowledge_base / price_package',
      publishStatus: 'archived',
      publishStatusSummary: 'archived / visible',
      versionSummary: 'v3 archived',
      visibilityScopeSummary: 'institution_internal',
      readiness: 'archived',
      mockSeedDemoFlag: 'mock',
      readonly: true,
      reasonCode: 'knowledge_base_catalog_archived',
      resultCode: 'readonly',
    });
    expect(JSON.stringify(summary)).not.toContain('机构不应使用平台项目知识');
    expectCatalogLowSensitiveWhitelist(summary);
  });

  it('发布状态聚合覆盖 draft / published / archived / disabled', () => {
    const summary = buildV1KnowledgeBaseCatalogReadonlySummary(
      {
        candidates: ['draft', 'published', 'archived', 'disabled'].map((publishStatus) => ({
          scope: 'platform_knowledge_base' as const,
          knowledgeType: 'faq' as const,
          title: `${publishStatus} FAQ`,
          lowSensitiveSummary: `${publishStatus} FAQ low sensitive summary`,
          sourceLabel: 'platform faq',
          visibilityScope: 'platform_default',
          publishStatus: publishStatus as 'draft' | 'published' | 'archived' | 'disabled',
          versionSummary: `${publishStatus} version`,
          versionStatus: publishStatus === 'draft' ? 'reviewing' : 'current',
          permissionStatus: 'visible' as const,
          mockSeedDemoFlag: 'demo' as const,
        })),
      },
      enabledPolicy,
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
    expectCatalogLowSensitiveWhitelist(summary);
  });

  it('empty / tenant mismatch / RBAC denied / exception 返回低敏 readonly 状态', () => {
    const empty = buildV1KnowledgeBaseCatalogReadonlySummary({ candidates: [] }, enabledPolicy);
    const tenantDenied = buildV1KnowledgeBaseCatalogReadonlySummary(
      {
        candidates: [
          {
            scope: 'institution_knowledge_base',
            knowledgeType: 'institution_faq',
            title: '机构 FAQ',
            lowSensitiveSummary: '不应展示',
            sourceLabel: 'seed',
            visibilityScope: 'institution_internal',
            publishStatus: 'published',
            versionSummary: 'v1',
            versionStatus: 'current',
            permissionStatus: 'visible',
            mockSeedDemoFlag: 'seed',
          },
        ],
      },
      { ...enabledPolicy, tenantScopeMatched: false },
    );
    const rbacDenied = buildV1KnowledgeBaseCatalogReadonlySummary(
      {
        candidates: [
          {
            scope: 'platform_knowledge_base',
            knowledgeType: 'faq',
            title: '平台 FAQ',
            lowSensitiveSummary: '不应展示',
            sourceLabel: 'seed',
            visibilityScope: 'platform_default',
            publishStatus: 'published',
            versionSummary: 'v1',
            versionStatus: 'current',
            permissionStatus: 'visible',
            mockSeedDemoFlag: 'seed',
          },
        ],
      },
      { ...enabledPolicy, canReadKnowledgeBaseCatalog: false },
    );
    const exception = buildV1KnowledgeBaseCatalogReadonlySummary(
      {
        candidates: [
          {
            scope: 'platform_knowledge_base',
            knowledgeType: 'faq',
            title: '缺少摘要不应展示',
            sourceLabel: 'seed',
            visibilityScope: 'platform_default',
            publishStatus: 'published',
            versionSummary: 'v1',
            versionStatus: 'current',
            permissionStatus: 'visible',
            mockSeedDemoFlag: 'seed',
            parseJobId: 'parse_job_should_not_render',
          },
        ],
      },
      enabledPolicy,
    );

    expect(empty).toEqual({
      status: 'empty',
      reasonCode: 'no_knowledge_base_catalog_candidates',
      resultCode: 'empty',
      readonly: true,
      emptyCopy: '暂无可展示知识库目录聚合',
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
      reasonCode: 'knowledge_base_catalog_source_missing',
      resultCode: 'unavailable',
      readonly: true,
      exceptionCopy: '知识库目录来源不完整，仅作内部参考',
      items: [],
    });
    [empty, tenantDenied, rbacDenied, exception].forEach((summary) => {
      expectCatalogLowSensitiveWhitelist(summary);
      expectNoCatalogRuntimeFragments(summary);
    });
  });

  it('非法来源安全降级且非 mock / seed / demo 不输出', () => {
    const summary = buildV1KnowledgeBaseCatalogReadonlySummary(
      {
        candidates: [
          {
            scope: 'platform_knowledge_base',
            knowledgeType: 'faq',
            title: '平台 FAQ',
            lowSensitiveSummary: 'demo FAQ 目录摘要',
            sourceLabel: 'platform faq',
            visibilityScope: 'platform_default',
            publishStatus: 'published',
            versionSummary: 'v1',
            versionStatus: 'current',
            permissionStatus: 'visible',
            mockSeedDemoFlag: 'demo',
          },
          {
            scope: 'platform_knowledge_base',
            knowledgeType: 'risk_notice',
            title: '真实来源不应展示',
            lowSensitiveSummary: '不应展示',
            sourceLabel: 'production',
            visibilityScope: 'platform_default',
            publishStatus: 'published',
            versionSummary: 'v1',
            versionStatus: 'current',
            permissionStatus: 'visible',
            mockSeedDemoFlag: 'production' as never,
            vectorIndexId: 'vector_index_should_not_render',
          },
        ],
      },
      enabledPolicy,
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
    expectCatalogLowSensitiveWhitelist(summary);
    expectNoCatalogRuntimeFragments(summary);
  });
});
