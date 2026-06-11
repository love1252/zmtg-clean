import { describe, expect, it } from 'vitest';
import * as demoReadonlyRoute from '@/app/api/v1/knowledge-base/demo-readonly/route';
import {
  v1KnowledgeBaseDemoReadonlyApiContractFields,
  type V1KnowledgeBaseDemoReadonlyApiContractResponse,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-demo-readonly-api-contract';

const routeUrl = 'http://localhost/api/v1/knowledge-base/demo-readonly';

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

async function callRoute(): Promise<V1KnowledgeBaseDemoReadonlyApiContractResponse> {
  const response = await demoReadonlyRoute.GET(new Request(routeUrl));

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/json');

  return response.json() as Promise<V1KnowledgeBaseDemoReadonlyApiContractResponse>;
}

describe('V1 知识库 demo readonly API route', () => {
  it('route 存在且只暴露只读 GET', () => {
    expect(demoReadonlyRoute.GET).toEqual(expect.any(Function));
    expect(Object.keys(demoReadonlyRoute).sort()).toEqual(['GET']);
  });

  it('GET 返回 200 且结构符合 demo readonly API contract', async () => {
    const payload = await callRoute();

    expect(payload).toMatchObject({
      requestId: 'demo-readonly-api-route-request',
      tenantId: 'demo-tenant-a',
      institutionId: 'demo-inst-a',
      workspaceId: 'demo-workspace-a',
      status: 'ready',
      readonly: true,
      summary: {
        title: '知识库 demo readonly API 契约',
      },
      facade: {
        facadeStatus: 'ready',
        readonly: true,
      },
    });
    expectContractWhitelist(payload);
  });

  it('包含 categories / folders / knowledgeItems / taskRecords / searchPreview', async () => {
    const payload = await callRoute();

    expect(payload.categories).toEqual([
      expect.objectContaining({ categoryId: 'platform-knowledge-base', readonly: true }),
      expect.objectContaining({ categoryId: 'institution-knowledge-base', readonly: true }),
    ]);
    expect(payload.folders).toEqual([
      expect.objectContaining({ folderId: 'catalog-summary', readonly: true }),
      expect.objectContaining({ folderId: 'visibility-summary', readonly: true }),
    ]);
    expect(payload.knowledgeItems).toEqual([
      expect.objectContaining({ itemId: 'publish-status-summary', readonly: true }),
      expect.objectContaining({ itemId: 'version-summary', readonly: true }),
      expect.objectContaining({ itemId: 'audit-summary', readonly: true }),
    ]);
    expect(payload.taskRecords).toEqual([
      expect.objectContaining({
        recordId: 'demo-readonly-facade-ready',
        status: 'ready',
        failureReason: 'not_available',
        readonly: true,
      }),
    ]);
    expect(payload.searchPreview).toEqual(
      expect.objectContaining({
        mode: 'mock_demo_preview',
        query: '知识库 demo 只读预览',
        resultCount: 2,
        readonly: true,
      }),
    );
  });

  it('searchPreview 仅为 mock / demo 预览，不触发真实检索', async () => {
    const payload = await callRoute();

    expect(payload.searchPreview.results.map((item) => item.sourceKind)).toEqual([
      'demo',
      'seed',
    ]);
    expect(JSON.stringify(payload.searchPreview)).not.toContain('embedding');
    expect(JSON.stringify(payload.searchPreview)).not.toContain('vector');
    expect(JSON.stringify(payload.searchPreview)).not.toContain('retrieval');
  });

  it('失败原因不暴露技术栈、文件路径、worker 或依赖错误', async () => {
    const payload = await callRoute();
    const failureReasons = payload.taskRecords.map((record) => record.failureReason).join(' ');

    ['node_modules', 'worker', '.ts:', '/src/', 'dependencyError'].forEach((fragment) => {
      expect(failureReasons).not.toContain(fragment);
    });
    expectNoSensitiveOrRuntimeFragments(payload);
  });

  it('输出不含真实客户 / HIS / credential / 模型字段，推荐动作不含写行为', async () => {
    const payload = await callRoute();

    expectNoSensitiveOrRuntimeFragments(payload);
    expectReadonlyActionsOnly(payload.recommendedReadonlyActions);
  });
});
