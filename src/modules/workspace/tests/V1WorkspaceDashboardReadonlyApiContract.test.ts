import { describe, expect, it } from 'vitest';
import {
  buildV1WorkspaceDashboardReadonlyAggregationApiContractResponse,
  v1WorkspaceDashboardReadonlyAggregationApiContractFields,
  type V1WorkspaceDashboardReadonlyAggregationApiContractResponse,
} from '@/modules/workspace/domain/v1-workspace-dashboard-readonly-api-contract';
import {
  buildV1WorkspaceDashboardReadonlyAggregationSummary,
  type V1WorkspaceDashboardReadonlyAggregationInput,
  type V1WorkspaceDashboardReadonlyAggregationPolicy,
} from '@/modules/workspace/domain/v1-workspace-dashboard-readonly-aggregation-view-models';

const enabledPolicy = {
  featureEnabled: true,
  canReadWorkspaceDashboardAggregation: true,
  tenantScopeMatched: true,
  workspaceScopeMatched: true,
  institutionScopeMatched: true,
  tenantId: 'demo-tenant-a',
  institutionId: 'demo-inst-a',
  workspaceId: 'demo-workspace-a',
} as const satisfies V1WorkspaceDashboardReadonlyAggregationPolicy;

function dashboardInput(
  overrides: Partial<V1WorkspaceDashboardReadonlyAggregationInput> = {},
): V1WorkspaceDashboardReadonlyAggregationInput {
  return {
    businessLoopCandidates: [
      {
        sourceKey: 'business_closed_loop_readonly',
        label: '主业务闭环',
        lowSensitiveSummary: 'demo 主业务闭环只读摘要',
        readiness: 'ready',
        metricValue: '3 readonly signals',
        mockSeedDemoFlag: 'demo',
      },
      {
        sourceKey: 'management_readonly_config',
        label: '管理配置',
        lowSensitiveSummary: 'seed 管理配置只读摘要',
        readiness: 'blocked',
        metricValue: '1 blocked signal',
        mockSeedDemoFlag: 'seed',
      },
    ],
    managementConfigCandidates: [
      {
        scope: 'platform',
        configKey: 'platform-governance',
        label: '平台治理配置',
        lowSensitiveSummary: 'demo 平台配置摘要',
        readiness: 'ready',
        mockSeedDemoFlag: 'demo',
      },
      {
        scope: 'institution',
        configKey: 'institution-governance',
        label: '机构治理配置',
        lowSensitiveSummary: 'seed 机构配置摘要',
        readiness: 'blocked',
        mockSeedDemoFlag: 'seed',
      },
    ],
    knowledgeGovernanceInput: {
      knowledgeBaseCandidates: [
        {
          scope: 'platform_knowledge_base',
          knowledgeType: 'faq',
          title: '平台 FAQ',
          lowSensitiveSummary: 'demo 平台 FAQ 治理摘要',
          sourceLabel: '平台知识种子',
          visibilityScope: 'specified_institution:demo-inst-a',
          publishStatus: 'published',
          versionSummary: 'v1 stable',
          versionStatus: 'current',
          permissionStatus: 'visible',
          mockSeedDemoFlag: 'demo',
        },
        {
          scope: 'institution_knowledge_base',
          knowledgeType: 'institution_faq',
          title: '机构 FAQ',
          lowSensitiveSummary: 'seed 机构 FAQ 治理摘要',
          sourceLabel: '机构知识种子',
          visibilityScope: 'institution_private:demo-inst-a',
          publishStatus: 'draft',
          versionSummary: 'v2 review',
          versionStatus: 'reviewing',
          permissionStatus: 'restricted',
          mockSeedDemoFlag: 'seed',
        },
      ],
      auditCandidates: [
        {
          knowledgeBaseId: 'kb-demo-001',
          tenantId: 'demo-tenant-a',
          institutionId: 'demo-inst-a',
          workspaceId: 'demo-workspace-a',
          scope: 'institution_knowledge_base',
          knowledgeType: 'institution_faq',
          sourceType: 'seed_catalog',
          sourceLabel: '机构 FAQ 种子来源',
          reviewStatus: 'approved',
          publishStatus: 'published',
          visibilityScope: 'institution_private',
          lastReviewedAt: '2026-06-01',
          lastPublishedAt: '2026-06-02',
          lastRetiredAt: 'none',
          citationSourceSummary: 'seed faq reference',
          riskFlags: ['none'],
          mockSeedDemoFlag: 'seed',
        },
      ],
    },
    ...overrides,
  };
}

function responseFrom(
  input: V1WorkspaceDashboardReadonlyAggregationInput,
  policy: V1WorkspaceDashboardReadonlyAggregationPolicy = enabledPolicy,
): V1WorkspaceDashboardReadonlyAggregationApiContractResponse {
  const aggregation = buildV1WorkspaceDashboardReadonlyAggregationSummary(input, policy);

  return buildV1WorkspaceDashboardReadonlyAggregationApiContractResponse({
    requestId: 'workspace-dashboard-readonly-api-response-test',
    aggregation,
  });
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
  const allowedFields = new Set<string>(
    v1WorkspaceDashboardReadonlyAggregationApiContractFields,
  );
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
    'raw',
    'payload',
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

describe('V1 workspace dashboard readonly aggregation API contract', () => {
  it('feature disabled 时返回低敏 disabled response', () => {
    const response = responseFrom(dashboardInput(), {
      ...enabledPolicy,
      featureEnabled: false,
    });

    expect(response).toMatchObject({
      requestId: 'workspace-dashboard-readonly-api-response-test',
      tenantId: 'demo-tenant-a',
      institutionId: 'demo-inst-a',
      workspaceId: 'demo-workspace-a',
      status: 'disabled',
      dashboardStatus: 'disabled',
      readonly: true,
      summary: {
        title: 'workspace dashboard readonly aggregation API 契约',
        statusText: 'disabled / skipped',
      },
      taskRecords: [
        expect.objectContaining({
          recordId: 'workspace-dashboard-readonly-aggregation-disabled',
          status: 'skipped',
          failureReason: '只读聚合能力暂未开启',
          readonly: true,
        }),
      ],
    });
    expect(response.businessLoop.summary).toBe('not_available');
    expectContractWhitelist(response);
    expectNoSensitiveOrRuntimeFragments(response);
  });

  it('tenant / workspace / institution mismatch 与 RBAC denied 返回低敏 denied response', () => {
    const deniedResponses = [
      responseFrom(dashboardInput(), { ...enabledPolicy, tenantScopeMatched: false }),
      responseFrom(dashboardInput(), { ...enabledPolicy, workspaceScopeMatched: false }),
      responseFrom(dashboardInput(), { ...enabledPolicy, institutionScopeMatched: false }),
      responseFrom(dashboardInput(), {
        ...enabledPolicy,
        canReadWorkspaceDashboardAggregation: false,
      }),
    ];

    deniedResponses.forEach((response) => {
      expect(response).toMatchObject({
        status: 'denied',
        dashboardStatus: 'denied',
        readonly: true,
        taskRecords: [
          expect.objectContaining({
            recordId: 'workspace-dashboard-readonly-aggregation-denied',
            status: 'blocked',
            failureReason: '当前账号没有访问权限',
            readonly: true,
          }),
        ],
      });
      expect(response.businessLoop.summary).toBe('not_available');
      expectContractWhitelist(response);
      expectNoSensitiveOrRuntimeFragments(response);
    });
  });

  it('empty demo source 时返回 empty response', () => {
    const response = responseFrom({
      businessLoopCandidates: [],
      managementConfigCandidates: [],
      knowledgeGovernanceInput: {
        knowledgeBaseCandidates: [],
        auditCandidates: [],
      },
    });

    expect(response).toMatchObject({
      status: 'empty',
      dashboardStatus: 'empty',
      readonly: true,
      summary: {
        statusText: 'empty / empty',
        description: '暂无可展示 workspace dashboard 只读聚合',
      },
      taskRecords: [
        expect.objectContaining({
          recordId: 'workspace-dashboard-readonly-aggregation-empty',
          status: 'empty',
        }),
      ],
    });
    expect(response.riskFlags).toEqual([]);
    expect(response.recommendedReadonlyActions).toEqual([]);
    expectContractWhitelist(response);
    expectNoSensitiveOrRuntimeFragments(response);
  });

  it('partial / stale / ready 状态都能映射为稳定 response shape', () => {
    const partial = responseFrom(
      dashboardInput({
        knowledgeGovernanceInput: {
          ...dashboardInput().knowledgeGovernanceInput,
          auditCandidates: [
            {
              knowledgeBaseId: 'kb-demo-001',
              tenantId: 'demo-tenant-a',
              institutionId: 'demo-inst-a',
              workspaceId: 'demo-workspace-a',
              scope: 'institution_knowledge_base',
              knowledgeType: 'institution_faq',
              sourceType: 'seed_catalog',
              sourceLabel: undefined,
              reviewStatus: 'approved',
              publishStatus: 'published',
              visibilityScope: 'institution_private',
              lastReviewedAt: '2026-06-01',
              lastPublishedAt: '2026-06-02',
              lastRetiredAt: 'none',
              citationSourceSummary: 'seed faq reference',
              riskFlags: ['none'],
              mockSeedDemoFlag: 'seed',
            },
          ],
        },
      }),
    );
    const stale = responseFrom(
      dashboardInput({
        knowledgeGovernanceInput: {
          ...dashboardInput().knowledgeGovernanceInput,
          auditCandidates: [
            {
              knowledgeBaseId: 'kb-demo-001',
              tenantId: 'demo-tenant-a',
              institutionId: 'demo-inst-a',
              workspaceId: 'demo-workspace-a',
              scope: 'institution_knowledge_base',
              knowledgeType: 'institution_faq',
              sourceType: 'seed_catalog',
              sourceLabel: '机构 FAQ 种子来源',
              reviewStatus: 'stale',
              publishStatus: 'archived',
              visibilityScope: 'institution_private',
              lastReviewedAt: '2026-05-01',
              lastPublishedAt: '2026-05-02',
              lastRetiredAt: '2026-06-01',
              citationSourceSummary: 'seed faq reference',
              riskFlags: ['stale_reference'],
              mockSeedDemoFlag: 'seed',
            },
          ],
        },
      }),
    );
    const ready = responseFrom(dashboardInput());

    expect(partial).toMatchObject({
      status: 'partial',
      dashboardStatus: 'partial',
      taskRecords: [
        expect.objectContaining({
          recordId: 'workspace-dashboard-readonly-aggregation-partial',
          status: 'partial',
          failureReason: 'workspace dashboard 部分来源不完整，仅展示可用只读摘要',
        }),
      ],
    });
    expect(stale).toMatchObject({
      status: 'stale',
      dashboardStatus: 'stale',
      taskRecords: [
        expect.objectContaining({
          recordId: 'workspace-dashboard-readonly-aggregation-stale',
          status: 'stale',
          failureReason: 'workspace dashboard 只读聚合可能已过期',
        }),
      ],
    });
    expect(ready).toMatchObject({
      status: 'ready',
      dashboardStatus: 'ready',
      businessLoop: expect.objectContaining({ readonly: true }),
      managementConfig: expect.objectContaining({ readonly: true }),
      knowledgeGovernance: expect.objectContaining({ readonly: true }),
      readonlyPolicy: expect.objectContaining({ readonly: true }),
      taskRecords: [
        expect.objectContaining({
          recordId: 'workspace-dashboard-readonly-aggregation-ready',
          status: 'ready',
          failureReason: 'not_available',
        }),
      ],
    });
    [partial, stale, ready].forEach((response) => {
      expectContractWhitelist(response);
      expectNoSensitiveOrRuntimeFragments(response);
      expectReadonlyActionsOnly(response.recommendedReadonlyActions);
    });
  });
});
