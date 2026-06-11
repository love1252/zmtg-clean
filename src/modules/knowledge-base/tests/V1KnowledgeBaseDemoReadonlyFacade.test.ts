import { describe, expect, it } from 'vitest';
import {
  buildV1KnowledgeBaseDemoReadonlyFacade,
  defaultV1KnowledgeBaseDemoReadonlyFacadePolicy,
  v1KnowledgeBaseDemoReadonlyFacadeFields,
  type V1KnowledgeBaseDemoReadonlyFacadeInput,
  type V1KnowledgeBaseDemoReadonlyFacadePolicy,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-demo-readonly-facade';

const enabledPolicy = {
  featureEnabled: true,
  canReadKnowledgeBaseDemoReadonlyFacade: true,
  tenantScopeMatched: true,
  workspaceScopeMatched: true,
  institutionScopeMatched: true,
  tenantId: 'demo-tenant-a',
  workspaceId: 'demo-workspace-a',
  institutionId: 'demo-inst-a',
  viewerScope: 'institution' as const,
  viewerInstitutionScopeCode: 'demo-inst-a',
} satisfies V1KnowledgeBaseDemoReadonlyFacadePolicy;

function facadeInput(
  overrides: Partial<V1KnowledgeBaseDemoReadonlyFacadeInput> = {},
): V1KnowledgeBaseDemoReadonlyFacadeInput {
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

function facadeSourceAt(index: number) {
  const source = facadeInput().sources?.[index];

  if (source === undefined) {
    throw new Error(`missing facade source fixture at index ${index}`);
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

function expectFacadeWhitelist(payload: unknown) {
  const fields = collectFields(payload);
  const allowedFields = new Set<string>(v1KnowledgeBaseDemoReadonlyFacadeFields);
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

describe('V1 知识库 demo readonly facade', () => {
  it('feature disabled 时返回低敏 disabled facade 且不回显来源详情', () => {
    const facade = buildV1KnowledgeBaseDemoReadonlyFacade(
      facadeInput({
        sources: [
          {
            ...facadeSourceAt(0),
            phone: '13800001252',
            hisConnection: 'his_connection_should_not_render',
          },
        ],
      }),
      defaultV1KnowledgeBaseDemoReadonlyFacadePolicy,
    );

    expect(defaultV1KnowledgeBaseDemoReadonlyFacadePolicy.featureEnabled).toBe(false);
    expect(facade).toEqual({
      status: 'disabled',
      reasonCode: 'feature_flag_disabled',
      resultCode: 'skipped',
      readonly: true,
      emptyCopy: '该知识库 demo readonly facade 暂未开启',
      tenantId: 'not_available',
      institutionId: 'not_available',
      workspaceId: 'not_available',
      facadeStatus: 'disabled',
      platformKnowledgeBase: 'not_available',
      institutionKnowledgeBase: 'not_available',
      catalogSummary: 'not_available',
      publishStatusSummary: 'not_available',
      versionSummary: 'not_available',
      visibilitySummary: 'not_available',
      auditSummary: 'not_available',
      governanceSummary: 'not_available',
      demoSourceSummary: 'not_available',
      riskFlags: [],
      recommendedReadonlyActions: [],
    });
    expect(JSON.stringify(facade)).not.toContain('13800001252');
    expectFacadeWhitelist(facade);
    expectNoSensitiveOrRuntimeFragments(facade);
  });

  it('tenant mismatch 时拒绝输出跨 tenant 数据', () => {
    const facade = buildV1KnowledgeBaseDemoReadonlyFacade(
      facadeInput({
        sources: [
          {
            ...facadeSourceAt(0),
            tenantId: 'other-tenant',
            sourceLabel: '其他租户不应展示',
          },
        ],
      }),
      { ...enabledPolicy, tenantScopeMatched: false },
    );

    expect(facade).toMatchObject({
      status: 'denied',
      reasonCode: 'tenant_scope_mismatch',
      resultCode: 'denied',
      readonly: true,
      facadeStatus: 'denied',
      exceptionCopy: '当前账号没有访问权限',
    });
    expect(JSON.stringify(facade)).not.toContain('其他租户不应展示');
    expectFacadeWhitelist(facade);
    expectNoSensitiveOrRuntimeFragments(facade);
  });

  it('RBAC denied 时只返回低敏拒绝状态', () => {
    const facade = buildV1KnowledgeBaseDemoReadonlyFacade(facadeInput(), {
      ...enabledPolicy,
      canReadKnowledgeBaseDemoReadonlyFacade: false,
    });

    expect(facade).toMatchObject({
      status: 'denied',
      reasonCode: 'permission_denied',
      resultCode: 'denied',
      readonly: true,
      facadeStatus: 'denied',
      exceptionCopy: '当前账号没有访问权限',
    });
    expect(JSON.stringify(facade)).not.toContain('平台 FAQ demo 来源');
    expectFacadeWhitelist(facade);
    expectNoSensitiveOrRuntimeFragments(facade);
  });

  it('empty demo source 时返回 empty facade', () => {
    const facade = buildV1KnowledgeBaseDemoReadonlyFacade({ sources: [] }, enabledPolicy);

    expect(facade).toMatchObject({
      status: 'empty',
      reasonCode: 'no_knowledge_base_demo_sources',
      resultCode: 'empty',
      readonly: true,
      emptyCopy: '暂无可展示知识库 demo readonly facade',
      facadeStatus: 'empty',
    });
    expectFacadeWhitelist(facade);
    expectNoSensitiveOrRuntimeFragments(facade);
  });

  it('source missing 时返回 source missing facade 且只给只读提示', () => {
    const facade = buildV1KnowledgeBaseDemoReadonlyFacade(
      facadeInput({
        sources: [
          {
            ...facadeSourceAt(0),
            sourceLabel: undefined,
            modelApiKey: 'sk_should_not_render',
          },
        ],
      }),
      enabledPolicy,
    );

    expect(facade).toMatchObject({
      status: 'exception',
      reasonCode: 'knowledge_base_demo_readonly_facade_source_missing',
      resultCode: 'unavailable',
      readonly: true,
      exceptionCopy: '知识库 demo readonly facade 来源不完整，仅作内部参考',
      facadeStatus: 'source_missing',
      demoSourceSummary: 'exception / source_missing',
      riskFlags: ['demo_source_missing'],
      recommendedReadonlyActions: ['review_demo_source_readonly'],
    });
    expectFacadeWhitelist(facade);
    expectNoSensitiveOrRuntimeFragments(facade);
    expectReadonlyActionsOnly(facade.recommendedReadonlyActions);
  });

  it('partial 时保留可用只读总览并标记缺失来源', () => {
    const facade = buildV1KnowledgeBaseDemoReadonlyFacade(
      facadeInput({
        sources: [
          facadeSourceAt(0),
          {
            ...facadeSourceAt(1),
            sourceLabel: undefined,
          },
        ],
      }),
      enabledPolicy,
    );

    expect(facade).toMatchObject({
      status: 'partial',
      reasonCode: 'knowledge_base_demo_readonly_facade_partial',
      resultCode: 'partial',
      readonly: true,
      exceptionCopy: '知识库 demo readonly facade 部分来源不完整，仅展示可用只读总览',
      facadeStatus: 'partial',
      platformKnowledgeBase: 'platform_items:1 / published:1 / draft:0 / archived:0 / disabled:0',
      institutionKnowledgeBase: 'institution_items:0 / published:0 / draft:0 / archived:0 / disabled:0',
      catalogSummary: 'ready / items:1',
      publishStatusSummary: 'platform_items:1 / published:1 / draft:0 / archived:0 / disabled:0 | institution_items:0 / published:0 / draft:0 / archived:0 / disabled:0',
      demoSourceSummary: 'partial / partial',
      riskFlags: ['demo_source_missing'],
      recommendedReadonlyActions: ['review_demo_source_readonly'],
    });
    expectFacadeWhitelist(facade);
    expectNoSensitiveOrRuntimeFragments(facade);
    expectReadonlyActionsOnly(facade.recommendedReadonlyActions);
  });

  it('ready 时输出稳定低敏 facade 结构供 API / UI demo 消费', () => {
    const facade = buildV1KnowledgeBaseDemoReadonlyFacade(facadeInput(), enabledPolicy);

    expect(facade).toEqual({
      status: 'ready',
      reasonCode: 'knowledge_base_demo_readonly_facade_ready',
      resultCode: 'readonly',
      readonly: true,
      tenantId: 'demo-tenant-a',
      institutionId: 'demo-inst-a',
      workspaceId: 'demo-workspace-a',
      facadeStatus: 'ready',
      platformKnowledgeBase: 'platform_items:1 / published:1 / draft:0 / archived:0 / disabled:0',
      institutionKnowledgeBase: 'institution_items:1 / published:0 / draft:1 / archived:0 / disabled:0',
      catalogSummary: 'ready / items:2',
      publishStatusSummary: 'platform_items:1 / published:1 / draft:0 / archived:0 / disabled:0 | institution_items:1 / published:0 / draft:1 / archived:0 / disabled:0',
      versionSummary: 'ready / current:1 / reviewing:1 / deprecated:0',
      visibilitySummary: 'ready / platform_global:0 / specified_institution:1 / institution_private:1',
      auditSummary: 'ready / items:2 / stale:0',
      governanceSummary: 'ready / ready',
      demoSourceSummary: 'ready / ready',
      riskFlags: ['reviewing_version_present'],
      recommendedReadonlyActions: ['review_draft_or_restricted_knowledge_readonly'],
    });
    expect(Object.keys(facade).sort()).toEqual(
      [
        'auditSummary',
        'catalogSummary',
        'demoSourceSummary',
        'facadeStatus',
        'governanceSummary',
        'institutionId',
        'institutionKnowledgeBase',
        'platformKnowledgeBase',
        'publishStatusSummary',
        'readonly',
        'reasonCode',
        'recommendedReadonlyActions',
        'resultCode',
        'riskFlags',
        'status',
        'tenantId',
        'versionSummary',
        'visibilitySummary',
        'workspaceId',
      ].sort(),
    );
    expectFacadeWhitelist(facade);
    expectNoSensitiveOrRuntimeFragments(facade);
    expectReadonlyActionsOnly(facade.recommendedReadonlyActions);
  });

  it('stale 时聚合 stale 状态与只读复核提示', () => {
    const facade = buildV1KnowledgeBaseDemoReadonlyFacade(
      facadeInput({
        sources: [
          {
            ...facadeSourceAt(0),
            publishStatus: 'archived',
            reviewStatus: 'stale',
            lastRetiredAt: '2026-06-05',
            riskFlags: ['stale_reference'],
          },
        ],
      }),
      enabledPolicy,
    );

    expect(facade).toMatchObject({
      status: 'stale',
      reasonCode: 'knowledge_base_demo_readonly_facade_stale',
      resultCode: 'stale',
      readonly: true,
      staleCopy: '知识库 demo readonly facade 可能已过期',
      facadeStatus: 'stale',
      auditSummary: 'stale / items:1 / stale:1',
      governanceSummary: 'stale / stale',
      demoSourceSummary: 'stale / stale',
      riskFlags: ['stale_audit_present', 'stale_demo_source_present'],
      recommendedReadonlyActions: [
        'review_stale_audit_source_readonly',
        'review_stale_demo_source_readonly',
      ],
    });
    expectFacadeWhitelist(facade);
    expectNoSensitiveOrRuntimeFragments(facade);
    expectReadonlyActionsOnly(facade.recommendedReadonlyActions);
  });

  it('平台知识库 demo source 可进入 facade 输出', () => {
    const facade = buildV1KnowledgeBaseDemoReadonlyFacade(
      facadeInput({ sources: [facadeSourceAt(0)] }),
      enabledPolicy,
    );

    expect(facade.status).toBe('ready');
    expect(facade.platformKnowledgeBase).toBe(
      'platform_items:1 / published:1 / draft:0 / archived:0 / disabled:0',
    );
    expect(facade.institutionKnowledgeBase).toBe(
      'institution_items:0 / published:0 / draft:0 / archived:0 / disabled:0',
    );
    expect(facade.catalogSummary).toBe('ready / items:1');
    expect(facade.auditSummary).toBe('ready / items:1 / stale:0');
  });

  it('机构知识库 demo source 可进入 facade 输出', () => {
    const facade = buildV1KnowledgeBaseDemoReadonlyFacade(
      facadeInput({ sources: [facadeSourceAt(1)] }),
      enabledPolicy,
    );

    expect(facade.status).toBe('ready');
    expect(facade.platformKnowledgeBase).toBe(
      'platform_items:0 / published:0 / draft:0 / archived:0 / disabled:0',
    );
    expect(facade.institutionKnowledgeBase).toBe(
      'institution_items:1 / published:0 / draft:1 / archived:0 / disabled:0',
    );
    expect(facade.versionSummary).toBe('ready / current:0 / reviewing:1 / deprecated:0');
    expect(facade.visibilitySummary).toBe(
      'ready / platform_global:0 / specified_institution:0 / institution_private:1',
    );
  });

  it('visibility 受限时不泄露不可见知识', () => {
    const facade = buildV1KnowledgeBaseDemoReadonlyFacade(
      facadeInput({
        sources: [
          facadeSourceAt(0),
          {
            ...facadeSourceAt(0),
            knowledgeBaseId: 'kb-hidden-platform',
            knowledgeItemId: 'item-hidden-platform',
            visibilityScope: 'specified_institution:other-inst',
            sourceLabel: '其他机构平台知识不应展示',
          },
          {
            ...facadeSourceAt(1),
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

    expect(facade.status).toBe('ready');
    expect(facade.platformKnowledgeBase).toBe(
      'platform_items:1 / published:1 / draft:0 / archived:0 / disabled:0',
    );
    expect(facade.institutionKnowledgeBase).toBe(
      'institution_items:0 / published:0 / draft:0 / archived:0 / disabled:0',
    );
    expect(JSON.stringify(facade)).not.toContain('其他机构平台知识不应展示');
    expect(JSON.stringify(facade)).not.toContain('其他机构私有知识不应展示');
    expectFacadeWhitelist(facade);
    expectNoSensitiveOrRuntimeFragments(facade);
  });

  it('输出不含真实客户 / HIS / credential / 模型字段且推荐动作不含写行为', () => {
    const facade = buildV1KnowledgeBaseDemoReadonlyFacade(
      facadeInput({
        sources: [
          {
            ...facadeSourceAt(0),
            credential: 'credential_should_not_render',
            hisConnection: 'his_connection_should_not_render',
            realCustomerData: 'real_customer_should_not_render',
            prompt: 'prompt_should_not_render',
            mutationPayload: { createTask: true },
          },
          {
            ...facadeSourceAt(1),
            publishStatus: 'disabled',
            reviewStatus: 'approved',
            lastRetiredAt: '2026-06-06',
          },
        ],
      }),
      enabledPolicy,
    );

    expect(facade.status).toBe('ready');
    expectFacadeWhitelist(facade);
    expectNoSensitiveOrRuntimeFragments(facade);
    expectReadonlyActionsOnly(facade.recommendedReadonlyActions);
  });
});
