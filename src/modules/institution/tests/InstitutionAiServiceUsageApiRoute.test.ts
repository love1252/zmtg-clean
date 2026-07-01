import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/institution/ai-service-usage/route';

const routeMocks = vi.hoisted(() => {
  const database = { database: 'institution-ai-service-usage-test-db' };
  const getInstitutionAiServiceUsage = vi.fn();
  return {
    database,
    getDatabase: vi.fn(() => database),
    getDemoAccessContextFromRequest: vi.fn(),
    getInstitutionAiServiceUsage,
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
    },
  ],
  quota: {
    isLinked: false,
  },
  notes: ['只展示机构端低敏服务使用统计，不展示内部模型或成本信息。'],
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
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(200);
    expect(serialized).not.toMatch(/provider|model|modelCode|totalTokens|Token|aiCreditsConsumed|prompt|question|answer|rawResponse|metadata|meteringDetails|apiKey|encryptedApiKey|baseUrl|Authorization|Cookie|RMB|¥|客户姓名|手机号|身份证|病历详情/i);
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
