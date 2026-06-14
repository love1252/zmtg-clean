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
      month: '2026-06',
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
    expect(normalizeAiReadonlyMonth('2026-05')).toBe('2026-05');

    const routeResponse = await aiReadonlyRoute.GET(new Request(`${aiReadonlyUrl}?month=../../secret`));
    const payload = await readJson(routeResponse);

    expect(routeResponse.status).toBe(200);
    expect(payload.month).toBe('2026-06');
    expectLowSensitivePayload(payload);
  });
});
