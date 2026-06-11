import { describe, expect, it } from 'vitest';
import {
  buildV1InstitutionKnowledgeBaseDemoSourceReadonlySummary,
  buildV1KnowledgeBaseDemoSourceGovernanceReadonlyInput,
  buildV1KnowledgeBaseDemoSourceReadonlySummary,
  buildV1PlatformKnowledgeBaseDemoSourceReadonlySummary,
  defaultV1KnowledgeBaseDemoSourceReadonlyPolicy,
  v1KnowledgeBaseDemoSourceReadonlySummaryFields,
  type V1KnowledgeBaseDemoSourceInput,
  type V1KnowledgeBaseDemoSourceReadonlyPolicy,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-demo-source-contract';
import { buildV1KnowledgeBaseGovernanceReadonlySummary } from '@/modules/knowledge-base/domain/v1-knowledge-base-governance-readonly-view-models';

const enabledPolicy = {
  featureEnabled: true,
  canReadKnowledgeBaseDemoSource: true,
  tenantScopeMatched: true,
  workspaceScopeMatched: true,
  institutionScopeMatched: true,
  tenantId: 'demo-tenant-a',
  workspaceId: 'demo-workspace-a',
  institutionId: 'demo-inst-a',
  viewerScope: 'institution' as const,
  viewerInstitutionScopeCode: 'demo-inst-a',
} satisfies V1KnowledgeBaseDemoSourceReadonlyPolicy;

function demoInput(
  overrides: Partial<V1KnowledgeBaseDemoSourceInput> = {},
): V1KnowledgeBaseDemoSourceInput {
  return {
    sources: [
      {
        tenantId: 'demo-tenant-a',
        institutionId: 'platform',
        workspaceId: 'demo-workspace-a',
        knowledgeBaseId: 'kb-platform-demo',
        knowledgeItemId: 'item-platform-published',
        knowledgeBaseType: 'platform',
        knowledgeType: 'faq',
        sourceType: 'demo_reference',
        sourceLabel: '平台 FAQ demo 来源',
        catalogPath: ['平台知识库', 'FAQ'],
        publishStatus: 'published',
        reviewStatus: 'approved',
        version: 'v1',
        visibilityScope: 'specified_institution:demo-inst-a',
        lastReviewedAt: '2026-06-01',
        lastPublishedAt: '2026-06-02',
        lastRetiredAt: 'none',
        citationSourceSummary: 'demo faq reference',
        riskFlags: ['none'],
        mockSeedDemoFlag: 'demo',
      },
      {
        tenantId: 'demo-tenant-a',
        institutionId: 'demo-inst-a',
        workspaceId: 'demo-workspace-a',
        knowledgeBaseId: 'kb-institution-demo',
        knowledgeItemId: 'item-institution-draft',
        knowledgeBaseType: 'institution',
        knowledgeType: 'institution_faq',
        sourceType: 'seed_catalog',
        sourceLabel: '机构 FAQ seed 来源',
        catalogPath: ['机构知识库', 'FAQ'],
        publishStatus: 'draft',
        reviewStatus: 'pending',
        version: 'v2-review',
        visibilityScope: 'institution_private:demo-inst-a',
        lastReviewedAt: '2026-06-03',
        lastPublishedAt: 'none',
        lastRetiredAt: 'none',
        citationSourceSummary: 'seed faq reference',
        riskFlags: ['review_pending'],
        mockSeedDemoFlag: 'seed',
      },
    ],
    ...overrides,
  };
}

function demoSourceAt(index: number) {
  const source = demoInput().sources?.[index];

  if (source === undefined) {
    throw new Error(`missing demo source fixture at index ${index}`);
  }

  return source;
}

function collectFields(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => collectFields(item));
  }

  if (typeof payload !== 'object' || payload === null) {
    return [];
  }

  return Object.entries(payload).flatMap(([field, value]) => [
    field,
    ...collectFields(value),
  ]);
}

function expectDemoSourceWhitelist(payload: unknown) {
  const fields = collectFields(payload);
  const allowedFields = new Set<string>(v1KnowledgeBaseDemoSourceReadonlySummaryFields);
  const unknownFields = fields.filter((field) => !allowedFields.has(field));

  expect(unknownFields).toEqual([]);
}

function expectNoSensitiveOrRuntimeFragments(payload: unknown) {
  const serialized = JSON.stringify(payload);

  [
    'phone',
    'mobile',
    'idCard',
    'identityCard',
    'medicalRecord',
    'diagnosis',
    'order',
    'payment',
    'contract',
    'invoice',
    'credential',
    'token',
    'secret',
    'hisConnection',
    'hisRawPayload',
    'realCustomerData',
    'modelApiKey',
    'prompt',
    'completion',
    'upload',
    'parse',
    'chunk',
    'embedding',
    'vector',
    'retrieval',
    'aiKnowledgeRuntime',
    'runtime',
    'allowedActions',
    'selectedAction',
    'executableAction',
    'mutationPayload',
    'createTask',
    'createAppointment',
    'createDeal',
    'autoMarketing',
    'autoTouch',
  ].forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

function expectReadonlyActionsOnly(actions: readonly string[]) {
  const forbidden = [
    'task',
    'appointment',
    'touch',
    'marketing',
    'deal',
    'payment',
    'contract',
    'invoice',
    '预约',
    '触达',
    '营销',
    '成交',
    '支付',
    '合同',
    '发票',
  ];

  actions.forEach((action) => {
    expect(action.endsWith('_readonly')).toBe(true);
    forbidden.forEach((fragment) => {
      expect(action.toLowerCase()).not.toContain(fragment.toLowerCase());
    });
  });
}

describe('V1 知识库 mock / seed / demo 来源契约与只读装配能力', () => {
  it('feature disabled 时返回只读禁用状态且不回显 demo 来源详情', () => {
    const summary = buildV1KnowledgeBaseDemoSourceReadonlySummary(
      demoInput({
        sources: [
          {
            ...demoSourceAt(0),
            phone: '13800001252',
            hisConnection: 'his_connection_should_not_render',
          },
        ],
      }),
      defaultV1KnowledgeBaseDemoSourceReadonlyPolicy,
    );

    expect(defaultV1KnowledgeBaseDemoSourceReadonlyPolicy.featureEnabled).toBe(false);
    expect(summary).toEqual({
      status: 'disabled',
      reasonCode: 'feature_flag_disabled',
      resultCode: 'skipped',
      readonly: true,
      emptyCopy: '该知识库 demo 来源只读装配能力暂未开启',
      tenantId: 'not_available',
      institutionId: 'not_available',
      workspaceId: 'not_available',
      platformKnowledgeBaseSummary: 'not_available',
      institutionKnowledgeBaseSummary: 'not_available',
      governanceInputSummary: 'not_available',
      governanceSummary: 'not_available',
      sourceStatus: 'disabled',
      riskFlags: [],
      recommendedReadonlyActions: [],
    });
    expect(JSON.stringify(summary)).not.toContain('13800001252');
    expectDemoSourceWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
  });

  it('tenant mismatch 时拒绝输出跨 tenant 数据', () => {
    const summary = buildV1KnowledgeBaseDemoSourceReadonlySummary(
      demoInput({
        sources: [
          {
            ...demoSourceAt(0),
            tenantId: 'other-tenant',
            sourceLabel: '其他租户不应展示',
          },
        ],
      }),
      { ...enabledPolicy, tenantScopeMatched: false },
    );

    expect(summary).toMatchObject({
      status: 'denied',
      reasonCode: 'tenant_scope_mismatch',
      resultCode: 'denied',
      readonly: true,
      sourceStatus: 'denied',
      exceptionCopy: '当前账号没有访问权限',
    });
    expect(JSON.stringify(summary)).not.toContain('其他租户不应展示');
    expectDemoSourceWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
  });

  it('RBAC denied 时只返回低敏拒绝状态', () => {
    const summary = buildV1KnowledgeBaseDemoSourceReadonlySummary(demoInput(), {
      ...enabledPolicy,
      canReadKnowledgeBaseDemoSource: false,
    });

    expect(summary).toMatchObject({
      status: 'denied',
      reasonCode: 'permission_denied',
      resultCode: 'denied',
      readonly: true,
      sourceStatus: 'denied',
      exceptionCopy: '当前账号没有访问权限',
    });
    expect(JSON.stringify(summary)).not.toContain('平台 FAQ demo 来源');
    expectDemoSourceWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
  });

  it('empty demo source 时返回 empty 状态', () => {
    const summary = buildV1KnowledgeBaseDemoSourceReadonlySummary({ sources: [] }, enabledPolicy);

    expect(summary).toMatchObject({
      status: 'empty',
      reasonCode: 'no_knowledge_base_demo_sources',
      resultCode: 'empty',
      readonly: true,
      emptyCopy: '暂无可展示知识库 demo 来源',
      sourceStatus: 'empty',
    });
    expectDemoSourceWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
  });

  it('source missing 时返回 source missing 状态', () => {
    const summary = buildV1KnowledgeBaseDemoSourceReadonlySummary(
      demoInput({
        sources: [
          {
            ...demoSourceAt(0),
            sourceLabel: undefined,
            modelApiKey: 'sk_should_not_render',
          },
        ],
      }),
      enabledPolicy,
    );

    expect(summary).toEqual({
      status: 'exception',
      reasonCode: 'knowledge_base_demo_source_missing',
      resultCode: 'unavailable',
      readonly: true,
      exceptionCopy: '知识库 demo 来源不完整，仅作内部参考',
      tenantId: 'demo-tenant-a',
      institutionId: 'demo-inst-a',
      workspaceId: 'demo-workspace-a',
      platformKnowledgeBaseSummary: 'not_available',
      institutionKnowledgeBaseSummary: 'not_available',
      governanceInputSummary: 'not_available',
      governanceSummary: 'not_available',
      sourceStatus: 'source_missing',
      riskFlags: ['demo_source_missing'],
      recommendedReadonlyActions: ['review_demo_source_readonly'],
    });
    expectDemoSourceWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
    expectReadonlyActionsOnly(summary.recommendedReadonlyActions);
  });

  it('平台知识库 demo source 可装配为只读摘要与 governance 输入', () => {
    const input = demoInput({ sources: [demoSourceAt(0)] });
    const platform = buildV1PlatformKnowledgeBaseDemoSourceReadonlySummary(input, enabledPolicy);
    const governanceInput = buildV1KnowledgeBaseDemoSourceGovernanceReadonlyInput(
      input,
      enabledPolicy,
    );
    const governance = buildV1KnowledgeBaseGovernanceReadonlySummary(governanceInput, {
      featureEnabled: true,
      canReadKnowledgeBaseGovernance: true,
      tenantScopeMatched: true,
      workspaceScopeMatched: true,
      institutionScopeMatched: true,
      tenantId: 'demo-tenant-a',
      workspaceId: 'demo-workspace-a',
      institutionId: 'demo-inst-a',
      viewerScope: 'institution',
      viewerInstitutionScopeCode: 'demo-inst-a',
    });

    expect(platform).toBe('platform_items:1 / published:1 / draft:0 / archived:0 / disabled:0');
    expect(governanceInput.knowledgeBaseCandidates).toHaveLength(1);
    expect(governanceInput.auditCandidates).toHaveLength(1);
    expect(governance.platformKnowledgeBaseSummary).toBe(
      'platform_items:1 / published:1 / draft:0 / archived:0 / disabled:0',
    );
    expect(governance.auditSummary).toBe('ready / items:1 / stale:0');
  });

  it('机构知识库 demo source 可装配为只读摘要与 governance 输入', () => {
    const input = demoInput({ sources: [demoSourceAt(1)] });
    const institution = buildV1InstitutionKnowledgeBaseDemoSourceReadonlySummary(
      input,
      enabledPolicy,
    );
    const governanceInput = buildV1KnowledgeBaseDemoSourceGovernanceReadonlyInput(
      input,
      enabledPolicy,
    );

    expect(institution).toBe(
      'institution_items:1 / published:0 / draft:1 / archived:0 / disabled:0',
    );
    expect(governanceInput.knowledgeBaseCandidates?.[0]).toMatchObject({
      scope: 'institution_knowledge_base',
      knowledgeType: 'institution_faq',
      publishStatus: 'draft',
      versionStatus: 'reviewing',
      permissionStatus: 'restricted',
      mockSeedDemoFlag: 'seed',
    });
    expect(governanceInput.auditCandidates?.[0]).toMatchObject({
      scope: 'institution_knowledge_base',
      sourceType: 'seed_catalog',
      reviewStatus: 'pending',
      mockSeedDemoFlag: 'seed',
    });
  });

  it('stale demo source 可被标记为 stale', () => {
    const summary = buildV1KnowledgeBaseDemoSourceReadonlySummary(
      demoInput({
        sources: [
          {
            ...demoSourceAt(0),
            publishStatus: 'archived',
            reviewStatus: 'stale',
            lastRetiredAt: '2026-06-05',
            riskFlags: ['stale_reference'],
          },
        ],
      }),
      enabledPolicy,
    );

    expect(summary).toMatchObject({
      status: 'stale',
      reasonCode: 'knowledge_base_demo_source_stale',
      resultCode: 'stale',
      readonly: true,
      staleCopy: '知识库 demo 来源可能已过期',
      sourceStatus: 'stale',
      riskFlags: ['stale_demo_source_present'],
      recommendedReadonlyActions: ['review_stale_demo_source_readonly'],
    });
    expectReadonlyActionsOnly(summary.recommendedReadonlyActions);
  });

  it('visibility 受限时不泄露不可见知识', () => {
    const summary = buildV1KnowledgeBaseDemoSourceReadonlySummary(
      demoInput({
        sources: [
          demoSourceAt(0),
          {
            ...demoSourceAt(0),
            knowledgeBaseId: 'kb-hidden-platform',
            knowledgeItemId: 'item-hidden-platform',
            visibilityScope: 'specified_institution:other-inst',
            sourceLabel: '其他机构平台知识不应展示',
          },
          {
            ...demoSourceAt(1),
            knowledgeBaseId: 'kb-hidden-institution',
            knowledgeItemId: 'item-hidden-institution',
            institutionId: 'other-inst',
            visibilityScope: 'institution_private:other-inst',
            sourceLabel: '其他机构私有知识不应展示',
          },
        ],
      }),
      enabledPolicy,
    );

    expect(summary.status).toBe('ready');
    expect(summary.platformKnowledgeBaseSummary).toBe(
      'platform_items:1 / published:1 / draft:0 / archived:0 / disabled:0',
    );
    expect(summary.institutionKnowledgeBaseSummary).toBe(
      'institution_items:0 / published:0 / draft:0 / archived:0 / disabled:0',
    );
    expect(JSON.stringify(summary)).not.toContain('其他机构平台知识不应展示');
    expect(JSON.stringify(summary)).not.toContain('其他机构私有知识不应展示');
    expectDemoSourceWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
  });

  it('partial 时保留可用只读摘要并标记 demo 来源缺失', () => {
    const summary = buildV1KnowledgeBaseDemoSourceReadonlySummary(
      demoInput({
        sources: [
          demoSourceAt(0),
          {
            ...demoSourceAt(1),
            sourceLabel: undefined,
          },
        ],
      }),
      enabledPolicy,
    );

    expect(summary).toMatchObject({
      status: 'partial',
      reasonCode: 'knowledge_base_demo_source_partial',
      resultCode: 'partial',
      readonly: true,
      exceptionCopy: '知识库 demo 来源部分不完整，仅展示可用只读摘要',
      platformKnowledgeBaseSummary:
        'platform_items:1 / published:1 / draft:0 / archived:0 / disabled:0',
      institutionKnowledgeBaseSummary:
        'institution_items:0 / published:0 / draft:0 / archived:0 / disabled:0',
      sourceStatus: 'partial',
      riskFlags: ['demo_source_missing'],
      recommendedReadonlyActions: ['review_demo_source_readonly'],
    });
    expectDemoSourceWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
    expectReadonlyActionsOnly(summary.recommendedReadonlyActions);
  });

  it('输出不包含真实客户 / HIS / credential / 模型字段，推荐动作不包含写行为', () => {
    const summary = buildV1KnowledgeBaseDemoSourceReadonlySummary(
      demoInput({
        sources: [
          {
            ...demoSourceAt(0),
            credential: 'credential_should_not_render',
            hisConnection: 'his_connection_should_not_render',
            realCustomerData: 'real_customer_should_not_render',
            prompt: 'prompt_should_not_render',
            mutationPayload: { createTask: true },
          },
          {
            ...demoSourceAt(1),
            publishStatus: 'disabled',
            reviewStatus: 'approved',
            lastRetiredAt: '2026-06-06',
          },
        ],
      }),
      enabledPolicy,
    );

    expect(summary.status).toBe('ready');
    expect(summary.platformKnowledgeBaseSummary).toContain('published:1');
    expect(summary.institutionKnowledgeBaseSummary).toContain('disabled:1');
    expectDemoSourceWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
    expectReadonlyActionsOnly(summary.recommendedReadonlyActions);
  });
});
