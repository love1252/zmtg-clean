import { describe, expect, it } from 'vitest';
import {
  buildV1KnowledgeBaseDemoReadonlyFacade,
  type V1KnowledgeBaseDemoReadonlyFacadeInput,
  type V1KnowledgeBaseDemoReadonlyFacadePolicy,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-demo-readonly-facade';
import {
  buildV1KnowledgeBaseDemoReadonlyApiContractResponse,
  v1KnowledgeBaseDemoReadonlyApiContractFields,
  type V1KnowledgeBaseDemoReadonlyApiContractMapperInput,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-demo-readonly-api-contract';

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
    throw new Error(`missing api contract source fixture at index ${index}`);
  }

  return source;
}

function contractInput(
  overrides: Partial<V1KnowledgeBaseDemoReadonlyApiContractMapperInput> = {},
): V1KnowledgeBaseDemoReadonlyApiContractMapperInput {
  return {
    requestId: 'demo-request-001',
    facade: buildV1KnowledgeBaseDemoReadonlyFacade(facadeInput(), enabledPolicy),
    ...overrides,
  };
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

function expectContractWhitelist(payload: unknown) {
  const fields = collectFields(payload);
  const allowedFields = new Set<string>(v1KnowledgeBaseDemoReadonlyApiContractFields);
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
    'worker',
    'stack',
    'node_modules',
    '/src/',
    '.ts:',
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

describe('V1 知识库 demo readonly API contract', () => {
  it('feature disabled facade 可转换为低敏 API contract response', () => {
    const facade = buildV1KnowledgeBaseDemoReadonlyFacade(facadeInput(), {
      ...enabledPolicy,
      featureEnabled: false,
    });
    const response = buildV1KnowledgeBaseDemoReadonlyApiContractResponse({
      requestId: 'demo-request-disabled',
      facade,
    });

    expect(response).toMatchObject({
      requestId: 'demo-request-disabled',
      tenantId: 'demo-tenant-a',
      institutionId: 'demo-inst-a',
      workspaceId: 'demo-workspace-a',
      status: 'disabled',
      summary: {
        title: '知识库 demo readonly API 契约',
        statusText: 'disabled / skipped',
        description: '该知识库 demo readonly facade 暂未开启',
      },
      categories: [],
      folders: [],
      knowledgeItems: [],
      taskRecords: [
        {
          recordId: 'demo-readonly-facade-disabled',
          status: 'skipped',
          title: '知识库 demo readonly facade',
          failureReason: '只读能力暂未开启',
          readonly: true,
        },
      ],
      searchPreview: {
        mode: 'mock_demo_preview',
        query: '知识库 demo 只读预览',
        resultCount: 0,
        results: [],
        readonly: true,
      },
      riskFlags: [],
      recommendedReadonlyActions: [],
    });
    expectContractWhitelist(response);
    expectNoSensitiveOrRuntimeFragments(response);
  });

  it('tenant mismatch facade 转换后不泄露跨 tenant 来源', () => {
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
    const response = buildV1KnowledgeBaseDemoReadonlyApiContractResponse({
      requestId: 'demo-request-tenant-denied',
      facade,
    });

    expect(response).toMatchObject({
      status: 'denied',
      summary: {
        statusText: 'denied / denied',
        description: '当前账号没有访问权限',
      },
      taskRecords: [
        {
          recordId: 'demo-readonly-facade-denied',
          status: 'blocked',
          failureReason: '当前账号没有访问权限',
          readonly: true,
        },
      ],
    });
    expect(JSON.stringify(response)).not.toContain('其他租户不应展示');
    expectContractWhitelist(response);
    expectNoSensitiveOrRuntimeFragments(response);
  });

  it('RBAC denied facade 转换后只返回低敏拒绝状态', () => {
    const facade = buildV1KnowledgeBaseDemoReadonlyFacade(facadeInput(), {
      ...enabledPolicy,
      canReadKnowledgeBaseDemoReadonlyFacade: false,
    });
    const response = buildV1KnowledgeBaseDemoReadonlyApiContractResponse({
      requestId: 'demo-request-rbac-denied',
      facade,
    });

    expect(response.status).toBe('denied');
    expect(response.taskRecords).toEqual([
      {
        recordId: 'demo-readonly-facade-denied',
        status: 'blocked',
        title: '知识库 demo readonly facade',
        failureReason: '当前账号没有访问权限',
        readonly: true,
      },
    ]);
    expect(JSON.stringify(response)).not.toContain('平台 FAQ demo 来源');
    expectContractWhitelist(response);
    expectNoSensitiveOrRuntimeFragments(response);
  });

  it('empty facade 转换为空 API contract response', () => {
    const facade = buildV1KnowledgeBaseDemoReadonlyFacade({ sources: [] }, enabledPolicy);
    const response = buildV1KnowledgeBaseDemoReadonlyApiContractResponse({
      requestId: 'demo-request-empty',
      facade,
    });

    expect(response).toMatchObject({
      status: 'empty',
      categories: [],
      folders: [],
      knowledgeItems: [],
      taskRecords: [
        {
          recordId: 'demo-readonly-facade-empty',
          status: 'empty',
          failureReason: '暂无可展示知识库 demo readonly facade',
          readonly: true,
        },
      ],
      searchPreview: {
        mode: 'mock_demo_preview',
        resultCount: 0,
        results: [],
      },
    });
    expectContractWhitelist(response);
    expectNoSensitiveOrRuntimeFragments(response);
  });

  it('source missing facade 转换为 source missing API contract response', () => {
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
    const response = buildV1KnowledgeBaseDemoReadonlyApiContractResponse({
      requestId: 'demo-request-source-missing',
      facade,
    });

    expect(response).toMatchObject({
      status: 'exception',
      summary: {
        statusText: 'source_missing / unavailable',
        description: '知识库 demo readonly facade 来源不完整，仅作内部参考',
      },
      taskRecords: [
        {
          recordId: 'demo-readonly-facade-source-missing',
          status: 'blocked',
          failureReason: '知识库 demo 来源不完整，请复核 demo seed 配置',
          readonly: true,
        },
      ],
      riskFlags: ['demo_source_missing'],
      recommendedReadonlyActions: ['review_demo_source_readonly'],
    });
    expectReadonlyActionsOnly(response.recommendedReadonlyActions);
    expectContractWhitelist(response);
    expectNoSensitiveOrRuntimeFragments(response);
  });

  it('partial facade 转换后保留可用低敏结构', () => {
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
    const response = buildV1KnowledgeBaseDemoReadonlyApiContractResponse({
      requestId: 'demo-request-partial',
      facade,
    });

    expect(response.status).toBe('partial');
    expect(response.categories).toEqual([
      {
        categoryId: 'platform-knowledge-base',
        label: '平台知识库',
        summary: 'platform_items:1 / published:1 / draft:0 / archived:0 / disabled:0',
        readonly: true,
      },
      {
        categoryId: 'institution-knowledge-base',
        label: '机构知识库',
        summary: 'institution_items:0 / published:0 / draft:0 / archived:0 / disabled:0',
        readonly: true,
      },
    ]);
    expect(response.taskRecords[0]).toMatchObject({
      recordId: 'demo-readonly-facade-partial',
      status: 'partial',
      failureReason: '知识库 demo 来源部分不完整，仅展示可用只读总览',
      readonly: true,
    });
    expectContractWhitelist(response);
    expectNoSensitiveOrRuntimeFragments(response);
  });

  it('ready facade 可转换为稳定 API contract response', () => {
    const response = buildV1KnowledgeBaseDemoReadonlyApiContractResponse(contractInput());

    expect(response).toEqual({
      requestId: 'demo-request-001',
      tenantId: 'demo-tenant-a',
      institutionId: 'demo-inst-a',
      workspaceId: 'demo-workspace-a',
      status: 'ready',
      summary: {
        title: '知识库 demo readonly API 契约',
        statusText: 'ready / readonly',
        description: '知识库 demo readonly facade 可用于只读 API / UI 演示',
      },
      categories: [
        {
          categoryId: 'platform-knowledge-base',
          label: '平台知识库',
          summary: 'platform_items:1 / published:1 / draft:0 / archived:0 / disabled:0',
          readonly: true,
        },
        {
          categoryId: 'institution-knowledge-base',
          label: '机构知识库',
          summary: 'institution_items:1 / published:0 / draft:1 / archived:0 / disabled:0',
          readonly: true,
        },
      ],
      folders: [
        {
          folderId: 'catalog-summary',
          label: '目录总览',
          summary: 'ready / items:2',
          readonly: true,
        },
        {
          folderId: 'visibility-summary',
          label: '可见范围',
          summary: 'ready / platform_global:0 / specified_institution:1 / institution_private:1',
          readonly: true,
        },
      ],
      knowledgeItems: [
        {
          itemId: 'publish-status-summary',
          title: '发布状态总览',
          summary: 'platform_items:1 / published:1 / draft:0 / archived:0 / disabled:0 | institution_items:1 / published:0 / draft:1 / archived:0 / disabled:0',
          status: 'ready',
          readonly: true,
        },
        {
          itemId: 'version-summary',
          title: '版本总览',
          summary: 'ready / current:1 / reviewing:1 / deprecated:0',
          status: 'ready',
          readonly: true,
        },
        {
          itemId: 'audit-summary',
          title: '审计总览',
          summary: 'ready / items:2 / stale:0',
          status: 'ready',
          readonly: true,
        },
      ],
      taskRecords: [
        {
          recordId: 'demo-readonly-facade-ready',
          status: 'ready',
          title: '知识库 demo readonly facade',
          failureReason: 'not_available',
          readonly: true,
        },
      ],
      searchPreview: {
        mode: 'mock_demo_preview',
        query: '知识库 demo 只读预览',
        resultCount: 2,
        results: [
          {
            previewId: 'platform-knowledge-base-preview',
            title: '平台知识库 demo 预览',
            snippet: 'platform_items:1 / published:1 / draft:0 / archived:0 / disabled:0',
            sourceKind: 'demo',
            readonly: true,
          },
          {
            previewId: 'institution-knowledge-base-preview',
            title: '机构知识库 seed 预览',
            snippet: 'institution_items:1 / published:0 / draft:1 / archived:0 / disabled:0',
            sourceKind: 'seed',
            readonly: true,
          },
        ],
        readonly: true,
      },
      facade: {
        status: 'ready',
        facadeStatus: 'ready',
        governanceSummary: 'ready / ready',
        demoSourceSummary: 'ready / ready',
        readonly: true,
      },
      riskFlags: ['reviewing_version_present'],
      recommendedReadonlyActions: ['review_draft_or_restricted_knowledge_readonly'],
      readonly: true,
    });
    expectContractWhitelist(response);
    expectNoSensitiveOrRuntimeFragments(response);
    expectReadonlyActionsOnly(response.recommendedReadonlyActions);
  });

  it('stale facade 转换后保留 stale 状态与只读复核提示', () => {
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
    const response = buildV1KnowledgeBaseDemoReadonlyApiContractResponse({
      requestId: 'demo-request-stale',
      facade,
    });

    expect(response.status).toBe('stale');
    expect(response.taskRecords).toEqual([
      {
        recordId: 'demo-readonly-facade-stale',
        status: 'stale',
        title: '知识库 demo readonly facade',
        failureReason: '知识库 demo readonly facade 可能已过期',
        readonly: true,
      },
    ]);
    expect(response.riskFlags).toEqual(['stale_audit_present', 'stale_demo_source_present']);
    expect(response.recommendedReadonlyActions).toEqual([
      'review_stale_audit_source_readonly',
      'review_stale_demo_source_readonly',
    ]);
    expectContractWhitelist(response);
    expectNoSensitiveOrRuntimeFragments(response);
  });

  it('categories / folders / knowledgeItems / taskRecords 结构稳定', () => {
    const response = buildV1KnowledgeBaseDemoReadonlyApiContractResponse(contractInput());

    expect(Object.keys(response.categories[0]).sort()).toEqual(
      ['categoryId', 'label', 'readonly', 'summary'].sort(),
    );
    expect(Object.keys(response.folders[0]).sort()).toEqual(
      ['folderId', 'label', 'readonly', 'summary'].sort(),
    );
    expect(Object.keys(response.knowledgeItems[0]).sort()).toEqual(
      ['itemId', 'readonly', 'status', 'summary', 'title'].sort(),
    );
    expect(Object.keys(response.taskRecords[0]).sort()).toEqual(
      ['failureReason', 'readonly', 'recordId', 'status', 'title'].sort(),
    );
    expect(Object.keys(response.searchPreview.results[0]).sort()).toEqual(
      ['previewId', 'readonly', 'snippet', 'sourceKind', 'title'].sort(),
    );
    expectContractWhitelist(response);
  });

  it('searchPreview 仅为 mock / demo 预览，不触发真实检索', () => {
    const response = buildV1KnowledgeBaseDemoReadonlyApiContractResponse(contractInput());

    expect(response.searchPreview.mode).toBe('mock_demo_preview');
    expect(response.searchPreview.results.map((item) => item.sourceKind)).toEqual([
      'demo',
      'seed',
    ]);
    expect(JSON.stringify(response.searchPreview)).not.toContain('embedding');
    expect(JSON.stringify(response.searchPreview)).not.toContain('vector');
    expect(JSON.stringify(response.searchPreview)).not.toContain('retrieval');
  });

  it('失败原因不暴露技术栈、文件路径、worker 或依赖错误', () => {
    const facade = buildV1KnowledgeBaseDemoReadonlyFacade(
      facadeInput({
        sources: [
          {
            ...facadeSourceAt(0),
            sourceLabel: undefined,
            dependencyError: 'node_modules/pkg/index.ts:1 worker crashed',
          },
        ],
      }),
      enabledPolicy,
    );
    const response = buildV1KnowledgeBaseDemoReadonlyApiContractResponse({
      requestId: 'demo-request-product-copy',
      facade,
    });
    const failureReasons = response.taskRecords.map((record) => record.failureReason).join(' ');

    expect(failureReasons).toContain('知识库 demo 来源不完整');
    ['node_modules', 'worker', '.ts:', '/src/', 'dependencyError'].forEach((fragment) => {
      expect(failureReasons).not.toContain(fragment);
    });
    expectNoSensitiveOrRuntimeFragments(response);
  });

  it('输出不含真实客户 / HIS / credential / 模型字段，推荐动作不含写行为', () => {
    const facade = buildV1KnowledgeBaseDemoReadonlyFacade(
      facadeInput({
        sources: [
          {
            ...facadeSourceAt(0),
            phone: '13800001252',
            credential: 'credential_should_not_render',
            hisConnection: 'his_connection_should_not_render',
            realCustomerData: 'real_customer_should_not_render',
            prompt: 'prompt_should_not_render',
            mutationPayload: { createTask: true },
          },
        ],
      }),
      enabledPolicy,
    );
    const response = buildV1KnowledgeBaseDemoReadonlyApiContractResponse({
      requestId: 'demo-request-sensitive-filter',
      facade,
    });

    expectContractWhitelist(response);
    expectNoSensitiveOrRuntimeFragments(response);
    expectReadonlyActionsOnly(response.recommendedReadonlyActions);
  });
});
