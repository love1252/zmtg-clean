import { describe, expect, it } from 'vitest';
import * as aiReadonlyRoute from '@/app/api/v1/open-platform/ai-readonly/route';
import {
  getPlatformAiReadonlyResponse,
  normalizeAiReadonlyMonth,
} from '@/modules/open-platform/server/platformAiReadonlyApiContract';

const aiReadonlyUrl = 'http://localhost/api/v1/open-platform/ai-readonly';
const forbiddenFragments = [
  'token',
  'secret',
  'credential',
  'apiKey',
  'DATABASE_URL',
  'stack',
  '/Users/',
  'raw metadata',
  'error_message',
  'tenant_id',
  '账单金额',
  '应收',
  '发票',
];

function expectLowSensitivePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);

  forbiddenFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

async function readJson(response: Response) {
  expect(response.headers.get('content-type')).toContain('application/json');

  return response.json() as Promise<Record<string, unknown>>;
}

describe('平台端 AI 模型与用量只读 contract', () => {
  it('只暴露 GET route，不提供 mutation 能力', () => {
    expect(Object.keys(aiReadonlyRoute).sort()).toEqual(['GET']);
  });

  it('返回受控示例数据和低敏模型、用量结构', async () => {
    const directPayload = getPlatformAiReadonlyResponse({ month: '2026-06' });
    const routeResponse = await aiReadonlyRoute.GET(new Request(`${aiReadonlyUrl}?month=2026-06`, {
      headers: {
        'X-Tenant-ID': 'forged-tenant-should-not-be-trusted',
      },
    }));
    const routePayload = await readJson(routeResponse);

    expect(routeResponse.status).toBe(200);
    expect(routePayload).toEqual(directPayload);
    expect(routePayload).toMatchObject({
      readonly: true,
      dataSource: 'controlled_demo',
      selectedMonth: '2026-06',
      month: '2026-06',
      availableMonths: [
        { value: '2026-06', label: '2026年06月', hasUsageData: true },
        { value: '2026-05', label: '2026年05月', hasUsageData: false },
      ],
      hasUsageData: true,
      emptyState: null,
      capabilityCoverageRows: expect.arrayContaining([
        expect.objectContaining({
          capabilityId: 'vision',
          capabilityName: '视觉理解',
          safetyNote: 'OCR 未启用',
        }),
        expect.objectContaining({
          capabilityId: 'embedding',
          capabilityName: '向量模型',
          safetyNote: '真实向量库未启用',
        }),
      ]),
      disabledCapabilities: expect.arrayContaining([
        '真实 AI',
        'API Key 管理',
        '厂商模型同步',
        'OCR',
        '真实向量库',
        '自动扣费',
        '正式账单',
      ]),
      modelCatalog: {
        providers: expect.any(Array),
        capabilityGroups: expect.any(Array),
        scenarioDefaults: expect.any(Array),
        agentInheritance: expect.any(Array),
      },
      usage: {
        summary: expect.objectContaining({
          estimatedCostCny: expect.any(Number),
          billingStatusLabel: '估算费用 / 运营参考，不是正式账单',
        }),
        providerModelRows: expect.any(Array),
        scenarioRows: expect.any(Array),
        sampleInstitutionRanking: expect.any(Array),
      },
      safetyBanner: expect.objectContaining({
        title: '当前为受控示例数据',
      }),
    });
    expectLowSensitivePayload(routePayload);
  });

  it('异常月份参数使用安全默认月份', async () => {
    expect(normalizeAiReadonlyMonth('bad-month')).toBe('2026-06');
    expect(normalizeAiReadonlyMonth('2026-13')).toBe('2026-06');
    expect(normalizeAiReadonlyMonth('../../secret')).toBe('2026-06');
    expect(normalizeAiReadonlyMonth('2026-04')).toBe('2026-06');
    expect(normalizeAiReadonlyMonth('2026-05')).toBe('2026-05');

    const routeResponse = await aiReadonlyRoute.GET(new Request(`${aiReadonlyUrl}?month=../../secret`));
    const payload = await readJson(routeResponse);

    expect(routeResponse.status).toBe(200);
    expect(payload.month).toBe('2026-06');
    expectLowSensitivePayload(payload);
  });

  it('空状态月份返回低敏 emptyState 且 X-Tenant-ID 不影响响应', async () => {
    const directPayload = getPlatformAiReadonlyResponse({ month: '2026-05' });
    const routeResponse = await aiReadonlyRoute.GET(new Request(`${aiReadonlyUrl}?month=2026-05`, {
      headers: {
        'X-Tenant-ID': 'forged-real-tenant',
      },
    }));
    const payload = await readJson(routeResponse);

    expect(routeResponse.status).toBe(200);
    expect(payload).toEqual(directPayload);
    expect(payload).toMatchObject({
      readonly: true,
      dataSource: 'controlled_demo',
      selectedMonth: '2026-05',
      hasUsageData: false,
      emptyState: {
        title: '暂无受控示例用量',
        description: '2026年05月为受控示例月份，未读取真实 AI 日志；估算费用不是正式账单。',
      },
      usage: {
        summary: expect.objectContaining({
          totalCalls: 0,
          totalTokens: 0,
          estimatedCostCny: 0,
        }),
        providerModelRows: [],
        scenarioRows: [],
        sampleInstitutionRanking: [],
      },
    });
    expectLowSensitivePayload(payload);
  });
});
