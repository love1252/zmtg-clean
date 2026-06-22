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
  '受控示例',
  '示例用量',
  '智美天工医美智能运营系统',
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

  it('返回 AI 配置只读结构和未接入用量空态', async () => {
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
      dataSource: 'unconnected',
      registryVersion: expect.any(String),
      usageVersion: 'ai-usage-cost-v1-unconnected',
      usageStatus: 'not_connected',
      costDisclaimer: expect.stringContaining('估算费用不是正式账单'),
      selectedMonth: '2026-06',
      month: '2026-06',
      hasUsageData: false,
      emptyState: {
        title: '暂无真实 AI 用量记录',
        description: '当前未接入真实 AI 调用日志；不会展示预置用量、机构排行或估算账单。',
      },
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
          totalCalls: 0,
          totalTokens: 0,
          estimatedCostCny: 0,
          billingStatusLabel: '估算费用 / 运营参考，不是正式账单',
        }),
        providerModelRows: [],
        dailyRows: [],
        providerUsageGroups: [],
        scenarioRows: [],
        sampleInstitutionRanking: [],
      },
      safetyBanner: expect.objectContaining({
        title: 'AI 用量未接入',
      }),
    });
    expectLowSensitivePayload(routePayload);
  });

  it('异常月份参数使用安全默认月份', async () => {
    expect(normalizeAiReadonlyMonth('bad-month')).toBe('2026-06');
    expect(normalizeAiReadonlyMonth('2026-13')).toBe('2026-06');
    expect(normalizeAiReadonlyMonth('../../secret')).toBe('2026-06');
    expect(normalizeAiReadonlyMonth('2026-05')).toBe('2026-05');

    const routeResponse = await aiReadonlyRoute.GET(new Request(`${aiReadonlyUrl}?month=../../secret`));
    const payload = await readJson(routeResponse);

    expect(routeResponse.status).toBe(200);
    expect(payload.month).toBe('2026-06');
    expectLowSensitivePayload(payload);
  });

  it('按日期查询仍返回未接入空态且 X-Tenant-ID 不影响响应', async () => {
    const directPayload = getPlatformAiReadonlyResponse({ usageDate: '2026-06-22' });
    const routeResponse = await aiReadonlyRoute.GET(new Request(`${aiReadonlyUrl}?usageDate=2026-06-22`, {
      headers: {
        'X-Tenant-ID': 'forged-real-tenant',
      },
    }));
    const payload = await readJson(routeResponse);

    expect(routeResponse.status).toBe(200);
    expect(payload).toEqual(directPayload);
    expect(payload).toMatchObject({
      readonly: true,
      dataSource: 'unconnected',
      selectedMonth: '2026-06',
      usageDate: '2026-06-22',
      hasUsageData: false,
      emptyState: {
        title: '暂无真实 AI 用量记录',
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
