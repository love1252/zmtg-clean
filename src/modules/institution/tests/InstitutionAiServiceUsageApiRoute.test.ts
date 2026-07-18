import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/institution/ai-service-usage/route';
import { InstitutionAiServiceUsageShell } from '@/modules/institution/components/InstitutionAiServiceUsageShell';

const routeMocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
  getInstitutionAiServiceUsage: vi.fn(),
  resolveInstitutionAiServiceUsagePeriod: vi.fn(),
  getInstitutionAiServiceUsageClient: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({
  getDatabase: routeMocks.getDatabase,
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
}));

vi.mock('@/modules/institution/server/institution-ai-service-usage', () => ({
  getInstitutionAiServiceUsage: routeMocks.getInstitutionAiServiceUsage,
  resolveInstitutionAiServiceUsagePeriod: routeMocks.resolveInstitutionAiServiceUsagePeriod,
}));

vi.mock('@/modules/institution/client/institution-ai-service-usage-client', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/institution/client/institution-ai-service-usage-client')
  >('@/modules/institution/client/institution-ai-service-usage-client');
  return {
    ...actual,
    getInstitutionAiServiceUsage: routeMocks.getInstitutionAiServiceUsageClient,
  };
});

const capabilityOffBody = Object.freeze({
  code: 'institution_ai_usage_capability_off',
  error: 'AI 服务使用能力当前未开放。',
});

function expectNoLegacyDependencyCalls() {
  expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
  expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  expect(routeMocks.getInstitutionAiServiceUsage).not.toHaveBeenCalled();
  expect(routeMocks.resolveInstitutionAiServiceUsagePeriod).not.toHaveBeenCalled();
}

async function expectCapabilityOff(request: Request) {
  const response = await GET(request);
  const body = await response.json();

  expect(response.status).toBe(410);
  expect(body).toEqual(capabilityOffBody);
  expect(Object.keys(body)).toEqual(['code', 'error']);
  expect(JSON.stringify(body)).not.toMatch(
    /tenant|serviceName|trend|unit|quota|remaining|model|provider|token|prompt|answer/i,
  );
  expectNoLegacyDependencyCalls();
}

describe('机构端 GET /api/institution/ai-service-usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('对普通、带 query 与 cookie 的请求均固定返回低敏 capability-off，且零依赖调用', async () => {
    await expectCapabilityOff(new Request('http://localhost:3000/api/institution/ai-service-usage'));
    await expectCapabilityOff(new Request(
      'http://localhost:3000/api/institution/ai-service-usage?tenantId=other&preset=lastMonth&from=2026-99-99',
      { headers: { cookie: 'demo_session=hostile; tenantId=other' } },
    ));
  });

  it('不读取 hostile Request Proxy 的任何字段或 trap', async () => {
    let trapCount = 0;
    const hostileRequest = new Proxy({} as Request, {
      get() {
        trapCount += 1;
        throw new Error('request must not be inspected');
      },
      getOwnPropertyDescriptor() {
        trapCount += 1;
        throw new Error('request must not be inspected');
      },
      ownKeys() {
        trapCount += 1;
        throw new Error('request must not be inspected');
      },
    });

    await expectCapabilityOff(hostileRequest);
    expect(trapCount).toBe(0);
  });
});

describe('遗留 AI 服务使用消费者', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('client 对 capability-off 保持受控不可用，不解析旧 payload 或传递 tenantId', async () => {
    const actualClient = await vi.importActual<
      typeof import('@/modules/institution/client/institution-ai-service-usage-client')
    >('@/modules/institution/client/institution-ai-service-usage-client');
    const fetcher = vi.fn(async () => Response.json(capabilityOffBody, { status: 410 }));

    const result = await actualClient.getInstitutionAiServiceUsage({
      preset: 'last7days',
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(result).toEqual({
      ok: false,
      error: { status: 410, message: 'AI 服务使用数据暂时不可用' },
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/institution/ai-service-usage?preset=last7days',
      { cache: 'no-store' },
    );
    expect(String(fetcher.mock.calls.at(0)?.at(0))).not.toContain('tenantId');
  });

  it('shell 只显示受控不可用，不渲染数据卡片、趋势、余额或服务项目区', async () => {
    routeMocks.getInstitutionAiServiceUsageClient.mockResolvedValue({
      ok: false,
      error: { status: 410, message: 'AI 服务使用数据暂时不可用' },
    });

    const { container } = render(createElement(InstitutionAiServiceUsageShell));

    await waitFor(() => {
      expect(screen.getByText('AI 服务使用数据暂时不可用')).toBeInTheDocument();
    });

    expect(container.querySelectorAll('article')).toHaveLength(0);
    expect(screen.queryByText('AI 服务使用趋势')).not.toBeInTheDocument();
    expect(screen.queryByText('套餐 AI 服务额度')).not.toBeInTheDocument();
    expect(screen.queryByText('AI 服务项目使用排行')).not.toBeInTheDocument();
  });
});
