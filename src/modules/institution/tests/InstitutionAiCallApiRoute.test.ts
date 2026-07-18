import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as aiCallUsageGet } from '@/app/api/institution/knowledge-management/ai-call/usage/route';
import { GET as platformAiUsageGet } from '@/app/api/v1/open-platform/ai-usage/route';

const routeMocks = vi.hoisted(() => ({
  createAiCallUsageRepository: vi.fn(),
  getDatabase: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
  listInstitutionAiCallUsageService: vi.fn(),
  listPlatformAiUsageSummaryService: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({ getDatabase: routeMocks.getDatabase }));
vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
}));
vi.mock('@/modules/institution/server/institution-ai-call-service', () => ({
  listInstitutionAiCallUsageService: routeMocks.listInstitutionAiCallUsageService,
  listPlatformAiUsageSummaryService: routeMocks.listPlatformAiUsageSummaryService,
}));
vi.mock('@/modules/institution/server/institution-ai-call-usage-repository', () => ({
  createAiCallUsageRepository: routeMocks.createAiCallUsageRepository,
}));

const capabilityDisabledResponse = {
  code: 'capability_disabled',
  error: '机构 AI 调用记录能力暂未启用。',
};

const tenantContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin' as const,
  scope: 'tenant' as const,
  tenantId: 'demo-tenant-001',
  institutionId: 'demo-inst-001',
  source: 'demo_session' as const,
};

const platformContext = {
  userId: 'demo-user-platform',
  role: 'platform_admin' as const,
  scope: 'platform' as const,
  tenantId: null,
  institutionId: null,
  source: 'demo_session' as const,
};

const fetchMock = vi.fn();
type RouteHandler = (...args: readonly unknown[]) => Promise<Response>;
const institutionHandler = aiCallUsageGet as RouteHandler;

function request() {
  return new Request(
    'http://localhost/api/institution/knowledge-management/ai-call/usage?tenantId=other-tenant&serviceName=should-not-read',
    { headers: { cookie: 'demo_session=should-not-read; token=should-not-read' } },
  );
}

function hostileRequest() {
  const traps = { get: 0, ownKeys: 0, descriptor: 0 };
  const value = new Proxy({} as Request, {
    get() {
      traps.get += 1;
      throw new Error('request must not be read');
    },
    getOwnPropertyDescriptor() {
      traps.descriptor += 1;
      throw new Error('request descriptors must not be read');
    },
    ownKeys() {
      traps.ownKeys += 1;
      throw new Error('request keys must not be read');
    },
  });
  return { traps, value };
}

function expectNoInstitutionDownstreamCalls() {
  expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
  expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  expect(routeMocks.createAiCallUsageRepository).not.toHaveBeenCalled();
  expect(routeMocks.listInstitutionAiCallUsageService).not.toHaveBeenCalled();
  expect(routeMocks.listPlatformAiUsageSummaryService).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
}

async function expectInstitutionCapabilityDisabled(input: unknown) {
  const response = await institutionHandler(input);
  const result = await response.json();

  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(result).toEqual(capabilityDisabledResponse);
  expect(Object.keys(result as object).sort()).toEqual(['code', 'error']);
  expect(JSON.stringify(result)).not.toMatch(
    /other-tenant|serviceName|records|usage|count|token|model|provider|prompt|answer/i,
  );
  expectNoInstitutionDownstreamCalls();
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  Object.values(routeMocks).forEach((mock) => mock.mockReset());
  routeMocks.getDatabase.mockReturnValue({ database: 'ai-call-api-test-db' });
  routeMocks.createAiCallUsageRepository.mockReturnValue({});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('机构端 AI 调用记录 capability-off API route', () => {
  it('普通或非法查询固定返回低敏 503，DB/service 异常不伪装为 200 空记录', async () => {
    routeMocks.getDatabase.mockImplementation(() => {
      throw new Error('DATABASE_URL must not be reached');
    });
    routeMocks.listInstitutionAiCallUsageService.mockRejectedValue(
      new Error('service failure must not become records=[]'),
    );

    await expectInstitutionCapabilityDisabled(
      new Request(
        'http://localhost/api/institution/knowledge-management/ai-call/usage',
      ),
    );
    await expectInstitutionCapabilityDisabled(request());
  });

  it('不解引用 hostile Request', async () => {
    const hostileInput = hostileRequest();

    await expectInstitutionCapabilityDisabled(hostileInput.value);
    expect(hostileInput.traps).toEqual({ get: 0, ownKeys: 0, descriptor: 0 });
  });

  it('route 仅导入 NextResponse，且不含 session、持久化、服务或 AI 用量事实路径', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/app/api/institution/knowledge-management/ai-call/usage/route.ts',
      ),
      'utf8',
    );
    const imports = source.match(/^import .*$/gmu) ?? [];

    expect(imports).toEqual(["import { NextResponse } from 'next/server';"]);
    expect(source).not.toMatch(
      /getDemoAccessContextFromRequest|getDatabase|createAiCallUsageRepository|listInstitutionAiCallUsageService|request\.|cookie|session|repository|service|records|emptyState|count|token|model|provider|prompt|answer|fetch\(|process\.env/i,
    );
  });
});

describe('平台端 AI 用量聚合 API route 保持正向契约', () => {
  it('机构账号访问仍返回 403', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await platformAiUsageGet(
      new Request('http://localhost/api/v1/open-platform/ai-usage'),
    );

    expect(response.status).toBe(403);
  });

  it('平台管理员仍可读取 service 结果', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);
    routeMocks.listPlatformAiUsageSummaryService.mockResolvedValue({
      requestId: 'platform-ai-usage-summary',
      readonly: true,
      dataSource: 'repository',
      records: [{ tenantId: 'tenant-a', callCount: 3 }],
    });

    const response = await platformAiUsageGet(
      new Request('http://localhost/api/v1/open-platform/ai-usage'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      records: [{ tenantId: 'tenant-a', callCount: 3 }],
    });
    expect(routeMocks.listPlatformAiUsageSummaryService).toHaveBeenCalledTimes(1);
  });

  it('未登录仍返回 401', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);

    const response = await platformAiUsageGet(
      new Request('http://localhost/api/v1/open-platform/ai-usage'),
    );

    expect(response.status).toBe(401);
  });
});
