import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/institution/ai-service-usage/route';
import { InstitutionAiServiceUsageShell } from '@/modules/institution/components/InstitutionAiServiceUsageShell';

const routeMocks = vi.hoisted(() => {
  const database = { database: 'institution-ai-service-usage-test-db' };
  const getInstitutionAiServiceUsage = vi.fn();
  return {
    database,
    getDatabase: vi.fn(() => database),
    getDemoAccessContextFromRequest: vi.fn(),
    getInstitutionAiServiceUsage,
    getInstitutionAiServiceUsageClient: vi.fn(),
  };
});

vi.mock('@/server/db/client', () => ({
  getDatabase: routeMocks.getDatabase,
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
}));

vi.mock('@/modules/institution/server/institution-ai-service-usage', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/institution/server/institution-ai-service-usage')
  >('@/modules/institution/server/institution-ai-service-usage');
  return {
    ...actual,
    getInstitutionAiServiceUsage: routeMocks.getInstitutionAiServiceUsage,
  };
});

vi.mock('@/modules/institution/client/institution-ai-service-usage-client', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/institution/client/institution-ai-service-usage-client')
  >('@/modules/institution/client/institution-ai-service-usage-client');
  return {
    ...actual,
    getInstitutionAiServiceUsage: routeMocks.getInstitutionAiServiceUsageClient,
  };
});

function createRequest(search = '') {
  return new Request(`http://localhost:3000/api/institution/ai-service-usage${search}`);
}

const tenantContext = {
  userId: 'tenant-admin',
  role: 'tenant_admin' as const,
  scope: 'tenant' as const,
  tenantId: 'tenant-current',
  institutionId: 'institution-current',
  source: 'demo_session' as const,
};

const mockResponse = {
  requestId: 'institution-ai-service-usage' as const,
  readonly: true,
  period: {
    from: '2026-06-01',
    to: '2026-06-30',
    preset: 'currentMonth' as const,
  },
  summary: {
    totalUsageCount: 1,
    succeededCount: 1,
    failedCount: 0,
    rejectedCount: 0,
    successRate: 100,
    aiServiceUnitsUsed: 2,
  },
  trend: [
    { date: '2026-06-29', usageCount: 1, aiServiceUnitsUsed: 2 },
  ],
  serviceProjects: [
    {
      serviceCategory: 'ai_qa',
      serviceName: 'AI 问答',
      usageCount: 1,
      succeededCount: 1,
      failedCount: 0,
      rejectedCount: 0,
      successRate: 100,
      aiServiceUnitsUsed: 2,
      sharePercent: 100,
      used: 180,
      remaining: 270,
      usageRate: 40,
    },
  ],
  quota: {
    isLinked: true,
    status: 'active',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    totalAllowance: 1000,
    used: 420,
    remaining: 580,
    usageRate: 42,
    warningLevel: 'low',
    displayUnit: 'AI 服务额度',
    notes: [],
  },
  notes: ['当前为只读额度视图，不代表真实扣减，不代表财务账单。'],
};

describe('机构端 GET /api/institution/ai-service-usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未登录返回 401', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);

    const response = await GET(createRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'unauthorized' });
  });

  it('平台账号访问返回 403', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue({
      userId: 'platform-admin',
      role: 'platform_admin',
      scope: 'platform',
      tenantId: null,
      institutionId: null,
      source: 'demo_session',
    });

    const response = await GET(createRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'forbidden' });
  });

  it('机构账号只能使用 accessContext tenant/institution，不能用 query tenantId 覆盖', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.getInstitutionAiServiceUsage.mockResolvedValue(mockResponse);

    const response = await GET(createRequest('?tenantId=other-tenant&preset=lastMonth'));

    expect(response.status).toBe(200);
    expect(routeMocks.getInstitutionAiServiceUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        database: routeMocks.database,
        tenantId: 'tenant-current',
        institutionId: 'institution-current',
        period: expect.objectContaining({
          preset: 'lastMonth',
        }),
      }),
    );
    const serialized = JSON.stringify(await response.json());
    expect(serialized).not.toContain('other-tenant');
  });

  it('非法日期返回低敏 400', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await GET(createRequest('?from=2026-06-31&to=2026-06-01'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: 'invalid_date_range',
      error: '时间范围无效',
    });
    expect(routeMocks.getInstitutionAiServiceUsage).not.toHaveBeenCalled();
  });

  it('response 不泄露平台内部 AI 用量字段或高敏字段', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.getInstitutionAiServiceUsage.mockResolvedValue(mockResponse);

    const response = await GET(createRequest());
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.quota).toMatchObject({
      isLinked: true,
      status: 'active',
      totalAllowance: 1000,
      used: 420,
      remaining: 580,
      usageRate: 42,
      warningLevel: 'low',
      displayUnit: 'AI 服务额度',
    });
    expect(body.serviceProjects[0]).toMatchObject({
      used: 180,
      remaining: 270,
      usageRate: 40,
    });
    expect(serialized).not.toMatch(/provider|model|modelCode|totalTokens|Token|aiCreditsConsumed|prompt|question|answer|rawResponse|metadata|meteringDetails|apiKey|encryptedApiKey|baseUrl|Authorization|Cookie|RMB|¥|客户姓名|手机号|身份证|病历详情/i);
  });

  it('overLimit 只返回状态展示字段，不返回阻断、扣减或告警动作字段', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.getInstitutionAiServiceUsage.mockResolvedValue({
      ...mockResponse,
      quota: {
        isLinked: true,
        status: 'overLimit',
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
        totalAllowance: 100,
        used: 126,
        remaining: 0,
        usageRate: 126,
        warningLevel: 'exceeded',
        displayUnit: 'AI 服务额度',
        notes: [],
      },
    });

    const response = await GET(createRequest());
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.quota).toMatchObject({
      isLinked: true,
      status: 'overLimit',
      remaining: 0,
      warningLevel: 'exceeded',
    });
    expect(serialized).not.toMatch(/shouldBlock|isBlocked|hardBlock|deduct|charge|alert|warningSent/i);
  });

  it('service 异常返回 503 且不暴露错误细节', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.getInstitutionAiServiceUsage.mockRejectedValue(new Error('database password leaked stack'));

    const response = await GET(createRequest());
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(503);
    expect(body).toEqual({
      code: 'service_unavailable',
      error: 'AI 服务使用数据暂时不可用',
    });
    expect(serialized).not.toContain('database password leaked stack');
  });
});

describe('机构端 AI 服务使用 UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('前端请求不传 tenantId，并展示 linked 只读额度字段和非真实扣减文案', async () => {
    routeMocks.getInstitutionAiServiceUsageClient.mockResolvedValue({
      ok: true,
      data: mockResponse,
    });

    const { container } = render(createElement(InstitutionAiServiceUsageShell));

    await waitFor(() => {
      expect(routeMocks.getInstitutionAiServiceUsageClient).toHaveBeenCalledWith({ preset: 'currentMonth' });
    });

    expect(screen.getByText('只读额度视图')).toBeInTheDocument();
    expect(screen.getByText('总额度')).toBeInTheDocument();
    expect(screen.getAllByText('已用').length).toBeGreaterThan(0);
    expect(screen.getAllByText('剩余').length).toBeGreaterThan(0);
    expect(screen.getAllByText('使用率').length).toBeGreaterThan(0);
    expect(screen.getByText('状态：正常')).toBeInTheDocument();
    expect(screen.getByText('warningLevel：低')).toBeInTheDocument();
    expect(screen.getByText('2026-07-01 至 2026-07-31')).toBeInTheDocument();
    expect(screen.getByText(/当前为只读额度视图，不代表真实扣减，不代表财务账单/)).toBeInTheDocument();
    expect(screen.getByText(/超出额度仅显示状态，不阻断服务、不触发扣减或告警/)).toBeInTheDocument();

    const rendered = container.textContent ?? '';
    expect(rendered).toContain('1,000');
    expect(rendered).toContain('420');
    expect(rendered).toContain('580');
    expect(rendered).toContain('42%');
    expect(rendered).not.toMatch(/provider|model|Token|totalTokens|RMB|¥|真实成本|prompt|answer|rawResponse|metadata|apiKey|baseUrl|客户姓名|手机号|身份证|病历详情/i);
  });

  it('client fetch URL 只包含 preset，不拼接 tenantId', async () => {
    const actualClient = await vi.importActual<
      typeof import('@/modules/institution/client/institution-ai-service-usage-client')
    >('@/modules/institution/client/institution-ai-service-usage-client');
    const fetcher = vi.fn(async () => Response.json(mockResponse));

    const result = await actualClient.getInstitutionAiServiceUsage({
      preset: 'last7days',
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(result.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledWith(
      '/api/institution/ai-service-usage?preset=last7days',
      { cache: 'no-store' },
    );
    const calledUrl = fetcher.mock.calls.at(0)?.at(0);
    expect(String(calledUrl)).not.toContain('tenantId');
  });

  it('UI 对 overLimit 只显示状态，不暗示阻断、扣减或告警动作', async () => {
    routeMocks.getInstitutionAiServiceUsageClient.mockResolvedValue({
      ok: true,
      data: {
        ...mockResponse,
        quota: {
          isLinked: true,
          status: 'overLimit',
          periodStart: '2026-07-01',
          periodEnd: '2026-07-31',
          totalAllowance: 100,
          used: 126,
          remaining: 0,
          usageRate: 126,
          warningLevel: 'exceeded',
          displayUnit: 'AI 服务额度',
          notes: [],
        },
      },
    });

    const { container } = render(createElement(InstitutionAiServiceUsageShell));

    expect(await screen.findByText('状态：已超出')).toBeInTheDocument();
    expect(screen.getByText('warningLevel：已超出')).toBeInTheDocument();
    expect(screen.getByText(/超出额度仅显示状态，不阻断服务、不触发扣减或告警/)).toBeInTheDocument();
    expect(container.textContent ?? '').not.toMatch(/停止服务|自动扣减|已发送告警/);
  });
});
