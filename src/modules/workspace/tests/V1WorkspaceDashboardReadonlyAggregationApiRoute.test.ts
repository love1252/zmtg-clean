import { describe, expect, it } from 'vitest';
import * as workspaceDashboardRoute from '@/app/api/v1/workspace-dashboard/readonly-aggregation/route';
import {
  v1WorkspaceDashboardReadonlyAggregationApiContractFields,
  type V1WorkspaceDashboardReadonlyAggregationApiContractResponse,
} from '@/modules/workspace/domain/v1-workspace-dashboard-readonly-api-contract';

const routeUrl = 'http://localhost/api/v1/workspace-dashboard/readonly-aggregation';

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

async function callRoute(): Promise<V1WorkspaceDashboardReadonlyAggregationApiContractResponse> {
  const response = await workspaceDashboardRoute.GET(new Request(routeUrl));

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/json');

  return response.json() as Promise<V1WorkspaceDashboardReadonlyAggregationApiContractResponse>;
}

describe('V1 workspace dashboard readonly aggregation API route', () => {
  it('route 存在且只暴露只读 GET', () => {
    expect(workspaceDashboardRoute.GET).toEqual(expect.any(Function));
    expect(Object.keys(workspaceDashboardRoute).sort()).toEqual(['GET']);
  });

  it('GET 返回 200 且 response shape 稳定', async () => {
    const payload = await callRoute();

    expect(payload).toMatchObject({
      requestId: 'workspace-dashboard-readonly-aggregation-route-request',
      tenantId: 'not_available',
      institutionId: 'not_available',
      workspaceId: 'not_available',
      status: 'empty',
      dashboardStatus: 'empty',
      readonly: true,
      summary: {
        title: 'workspace dashboard readonly aggregation API 契约',
        statusText: 'empty / empty',
      },
      businessLoop: expect.objectContaining({ readonly: true }),
      managementConfig: expect.objectContaining({ readonly: true }),
      knowledgeGovernance: expect.objectContaining({ readonly: true }),
      readonlyPolicy: expect.objectContaining({ readonly: true }),
      aggregation: expect.objectContaining({
        status: 'empty',
        dashboardStatus: 'empty',
        readonly: true,
      }),
    });
    expect(payload.taskRecords).toEqual([
      expect.objectContaining({
        recordId: 'workspace-dashboard-readonly-aggregation-empty',
        status: 'empty',
        failureReason: '暂无可展示 workspace dashboard 只读聚合',
        readonly: true,
      }),
    ]);
    expect(JSON.stringify(payload)).not.toContain('demo-tenant-a');
    expect(JSON.stringify(payload)).not.toContain('demo-inst-a');
    expectContractWhitelist(payload);
  });

  it('默认返回空聚合，不返回 mock / seed / demo 内容或 runtime 片段', async () => {
    const payload = await callRoute();

    expect(payload.businessLoop.summary).toBe('not_available');
    expect(payload.managementConfig.summary).toBe('not_available');
    expect(payload.knowledgeGovernance.summary).toBe('not_available');
    expect(payload.readonlyPolicy.summary).toBe('not_available');
    expectNoSensitiveOrRuntimeFragments(payload);
  });

  it('recommendedReadonlyActions 仅为 readonly hint，不包含 mutation 行为', async () => {
    const payload = await callRoute();

    expect(payload.recommendedReadonlyActions).toEqual([]);
    expectReadonlyActionsOnly(payload.recommendedReadonlyActions);
    expectNoSensitiveOrRuntimeFragments(payload);
  });
});
