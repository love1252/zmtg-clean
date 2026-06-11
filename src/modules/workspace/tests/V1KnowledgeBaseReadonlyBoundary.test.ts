import { describe, expect, it } from 'vitest';
import {
  buildV1KnowledgeBaseReadonlySummary,
  defaultV1KnowledgeBaseReadonlyPolicy,
  v1InstitutionKnowledgeBaseTypes,
  v1KnowledgeBaseReadonlyItemFields,
  v1PlatformKnowledgeBaseTypes,
} from '@/modules/workspace/domain/v1-knowledge-base-readonly-view-models';
import { validateV1LowSensitivityFieldWhitelist } from '@/modules/workspace/domain/v1-low-sensitivity-field-whitelist';

const enabledPolicy = {
  featureEnabled: true,
  canReadKnowledgeBase: true,
  tenantScopeMatched: true,
};

const knowledgeBaseReadonlySummaryFields = [
  'status',
  'reasonCode',
  'resultCode',
  'readonly',
  'emptyCopy',
  'exceptionCopy',
  'items',
];

const knowledgeBaseReadonlyLowSensitiveFields = [
  ...knowledgeBaseReadonlySummaryFields,
  ...v1KnowledgeBaseReadonlyItemFields,
];

function expectKnowledgeBaseReadonlyWhitelist(payload: unknown) {
  const result = validateV1LowSensitivityFieldWhitelist(payload, {
    allowedFields: knowledgeBaseReadonlyLowSensitiveFields,
  });

  expect(result.valid).toBe(true);
  expect(result.unknownFields).toEqual([]);
  expect(result.forbiddenFields).toEqual([]);
  expect(result.forbiddenValues).toEqual([]);
}

function expectNoForbiddenKnowledgeBaseRuntimeFragments(payload: unknown) {
  const serialized = JSON.stringify(payload);

  [
    'phone',
    'idCard',
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
  ].forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

describe('V1 知识库 readonly 边界 view model', () => {
  it('默认关闭时优先返回 disabled 且不回显候选知识详情', () => {
    const summary = buildV1KnowledgeBaseReadonlySummary(
      {
        candidates: [
          {
            scope: 'platform_knowledge_base',
            knowledgeType: 'project_knowledge',
            title: '平台项目知识',
            lowSensitiveSummary: 'demo 平台项目知识摘要',
            sourceLabel: 'demo source',
            visibilityScope: 'platform_default',
            publishStatus: 'published',
            versionSummary: 'v1 stable',
            versionStatus: 'current',
            permissionStatus: 'visible',
            mockSeedDemoFlag: 'demo',
            credential: 'credential_should_not_render',
            uploadPayload: { fileName: 'real.docx' },
            embeddingVector: [0.1, 0.2],
            mutationPayload: { createTask: true },
          },
        ],
      },
      defaultV1KnowledgeBaseReadonlyPolicy,
    );

    expect(defaultV1KnowledgeBaseReadonlyPolicy.featureEnabled).toBe(false);
    expect(summary).toEqual({
      status: 'disabled',
      reasonCode: 'feature_flag_disabled',
      resultCode: 'skipped',
      readonly: true,
      emptyCopy: '该知识库只读能力暂未开启',
      items: [],
    });
    expect(JSON.stringify(summary)).not.toContain('平台项目知识');
    expectKnowledgeBaseReadonlyWhitelist(summary);
    expectNoForbiddenKnowledgeBaseRuntimeFragments(summary);
  });

  it('平台知识库 ready 输出支持平台知识类型并保持低敏 readonly', () => {
    const summary = buildV1KnowledgeBaseReadonlySummary(
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
            phone: '13800001252',
            modelApiKey: 'sk_should_not_render',
          },
          {
            scope: 'platform_knowledge_base',
            knowledgeType: 'ai_template',
            title: 'AI 模板',
            lowSensitiveSummary: 'seed AI 模板目录摘要，仅用于只读展示',
            sourceLabel: '平台模板库',
            visibilityScope: 'platform_internal',
            publishStatus: 'draft',
            versionSummary: 'v2 review',
            versionStatus: 'reviewing',
            permissionStatus: 'restricted',
            mockSeedDemoFlag: 'seed',
            completion: 'model completion should not render',
          },
        ],
      },
      enabledPolicy,
    );

    expect(v1PlatformKnowledgeBaseTypes).toEqual([
      'project_knowledge',
      'treatment_instruction',
      'recovery_cycle',
      'faq',
      'risk_notice',
      'disabled_words',
      'followup_sop',
      'revisit_rule',
      'repurchase_rule',
      'dormant_customer_wakeup_rule',
      'ai_template',
      'standard_talk_script',
      'material_library',
    ]);
    expect(summary).toMatchObject({
      status: 'ready',
      reasonCode: 'knowledge_base_ready',
      resultCode: 'readonly',
      readonly: true,
    });
    expect(summary.items).toEqual([
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
        readonly: true,
        reasonCode: 'knowledge_base_item_ready',
        resultCode: 'readonly',
      },
      {
        scope: 'platform_knowledge_base',
        knowledgeType: 'ai_template',
        title: 'AI 模板',
        lowSensitiveSummary: 'seed AI 模板目录摘要，仅用于只读展示',
        sourceLabel: '平台模板库',
        visibilityScope: 'platform_internal',
        publishStatus: 'draft',
        versionSummary: 'v2 review',
        versionStatus: 'reviewing',
        permissionStatus: 'restricted',
        mockSeedDemoFlag: 'seed',
        readonly: true,
        reasonCode: 'knowledge_base_item_draft',
        resultCode: 'readonly',
      },
    ]);
    summary.items.forEach((item) => {
      expect(Object.keys(item).sort()).toEqual([...v1KnowledgeBaseReadonlyItemFields].sort());
      expect(item.readonly).toBe(true);
    });
    expectKnowledgeBaseReadonlyWhitelist(summary);
    expectNoForbiddenKnowledgeBaseRuntimeFragments(summary);
  });

  it('机构知识库 ready 输出支持机构知识类型且不与平台类型混淆', () => {
    const summary = buildV1KnowledgeBaseReadonlySummary(
      {
        candidates: [
          {
            scope: 'institution_knowledge_base',
            knowledgeType: 'project_material',
            title: '机构项目资料',
            lowSensitiveSummary: 'mock 机构项目资料目录摘要',
            sourceLabel: '机构素材库',
            visibilityScope: 'institution_internal',
            publishStatus: 'published',
            versionSummary: 'v3 stable',
            versionStatus: 'current',
            permissionStatus: 'visible',
            mockSeedDemoFlag: 'mock',
          },
          {
            scope: 'platform_knowledge_base',
            knowledgeType: 'price_package',
            title: '平台不应使用机构价格套餐',
            lowSensitiveSummary: '不应展示',
            sourceLabel: 'invalid',
            visibilityScope: 'platform_default',
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

    expect(v1InstitutionKnowledgeBaseTypes).toEqual([
      'project_material',
      'price_package',
      'doctor_profile',
      'postoperative_care',
      'service_sop',
      'communication_script',
      'repurchase_campaign',
      'institution_material',
      'institution_faq',
    ]);
    expect(summary.status).toBe('ready');
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]).toMatchObject({
      scope: 'institution_knowledge_base',
      knowledgeType: 'project_material',
      title: '机构项目资料',
      readonly: true,
      resultCode: 'readonly',
    });
    expect(JSON.stringify(summary)).not.toContain('平台不应使用机构价格套餐');
    expectKnowledgeBaseReadonlyWhitelist(summary);
  });

  it('empty / tenant mismatch / RBAC denied 返回低敏 readonly 状态', () => {
    const empty = buildV1KnowledgeBaseReadonlySummary({ candidates: [] }, enabledPolicy);
    const tenantDenied = buildV1KnowledgeBaseReadonlySummary(
      {
        candidates: [
          {
            scope: 'institution_knowledge_base',
            knowledgeType: 'doctor_profile',
            title: '医生介绍',
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
      {
        ...enabledPolicy,
        tenantScopeMatched: false,
      },
    );
    const rbacDenied = buildV1KnowledgeBaseReadonlySummary(
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
      {
        ...enabledPolicy,
        canReadKnowledgeBase: false,
      },
    );

    expect(empty).toEqual({
      status: 'empty',
      reasonCode: 'no_knowledge_base_candidates',
      resultCode: 'empty',
      readonly: true,
      emptyCopy: '暂无可展示知识库目录',
      items: [],
    });
    expect(tenantDenied).toEqual({
      status: 'denied',
      reasonCode: 'tenant_scope_mismatch',
      resultCode: 'denied',
      readonly: true,
      exceptionCopy: '当前账号没有访问权限',
      items: [],
    });
    expect(rbacDenied).toEqual({
      status: 'denied',
      reasonCode: 'permission_denied',
      resultCode: 'denied',
      readonly: true,
      exceptionCopy: '当前账号没有访问权限',
      items: [],
    });
    [empty, tenantDenied, rbacDenied].forEach((summary) => {
      expectKnowledgeBaseReadonlyWhitelist(summary);
      expectNoForbiddenKnowledgeBaseRuntimeFragments(summary);
    });
  });

  it('所有候选来源不完整或非法时返回低敏 exception', () => {
    const summary = buildV1KnowledgeBaseReadonlySummary(
      {
        candidates: [
          {
            scope: 'platform_knowledge_base',
            knowledgeType: 'project_knowledge',
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
          {
            scope: 'institution_knowledge_base',
            knowledgeType: 'real_model_output' as never,
            title: '真实模型输出不应展示',
            lowSensitiveSummary: '不应展示',
            sourceLabel: 'real',
            visibilityScope: 'institution_internal',
            publishStatus: 'published',
            versionSummary: 'v1',
            versionStatus: 'current',
            permissionStatus: 'visible',
            mockSeedDemoFlag: 'demo',
            embeddingVector: [0.1, 0.2],
          },
        ],
      },
      enabledPolicy,
    );

    expect(summary).toEqual({
      status: 'exception',
      reasonCode: 'knowledge_base_source_missing',
      resultCode: 'unavailable',
      readonly: true,
      exceptionCopy: '知识库来源不完整，仅作内部参考',
      items: [],
    });
    expect(JSON.stringify(summary)).not.toContain('缺少摘要不应展示');
    expect(JSON.stringify(summary)).not.toContain('真实模型输出不应展示');
    expectKnowledgeBaseReadonlyWhitelist(summary);
    expectNoForbiddenKnowledgeBaseRuntimeFragments(summary);
  });

  it('混合候选只保留 mock / seed / demo 来源完整的低敏知识项', () => {
    const summary = buildV1KnowledgeBaseReadonlySummary(
      {
        candidates: [
          {
            scope: 'platform_knowledge_base',
            knowledgeType: 'faq',
            title: '平台 FAQ',
            lowSensitiveSummary: 'demo FAQ 目录摘要',
            sourceLabel: '平台 FAQ 种子',
            visibilityScope: 'platform_default',
            publishStatus: 'archived',
            versionSummary: 'v1 archived',
            versionStatus: 'deprecated',
            permissionStatus: 'visible',
            mockSeedDemoFlag: 'demo',
          },
          {
            scope: 'platform_knowledge_base',
            knowledgeType: 'risk_notice',
            title: '非法真实来源不应展示',
            lowSensitiveSummary: '不应展示',
            sourceLabel: 'real source',
            visibilityScope: 'platform_default',
            publishStatus: 'published',
            versionSummary: 'v1',
            versionStatus: 'current',
            permissionStatus: 'visible',
            mockSeedDemoFlag: 'production' as never,
          },
          {
            scope: 'institution_knowledge_base',
            knowledgeType: 'institution_faq',
            title: '',
            lowSensitiveSummary: '缺少标题不应展示',
            sourceLabel: 'seed',
            visibilityScope: 'institution_internal',
            publishStatus: 'draft',
            versionSummary: 'v1',
            versionStatus: 'reviewing',
            permissionStatus: 'restricted',
            mockSeedDemoFlag: 'seed',
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
      title: '平台 FAQ',
      publishStatus: 'archived',
      readonly: true,
    });
    expect(JSON.stringify(summary)).not.toContain('非法真实来源不应展示');
    expect(JSON.stringify(summary)).not.toContain('缺少标题不应展示');
    expectKnowledgeBaseReadonlyWhitelist(summary);
  });
});
