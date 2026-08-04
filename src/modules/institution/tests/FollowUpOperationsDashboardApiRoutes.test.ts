import { createElement } from 'react';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GET } from '@/app/api/institution/followup-operations/dashboard/route';
import { getFollowUpOperationsDashboard } from '@/modules/institution/client/tenant-business-client';
import { SmartFollowUpShell } from '@/modules/institution/components/SmartFollowUpShell';

vi.mock('@/app/api/institution/_shared/institution-route-guard', () => ({
  withInstitutionSectionRouteGuardV1: ({
    handler,
  }: {
    handler: (...args: unknown[]) => Response | Promise<Response>;
  }) => handler,
}));

const routeMocks = vi.hoisted(() => ({
  createAuditEventRepository: vi.fn(),
  createTenantBusinessRepository: vi.fn(),
  getDatabase: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
  getFollowUpOperationsDashboard: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({ getDatabase: routeMocks.getDatabase }));
vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
}));
vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: routeMocks.createAuditEventRepository,
}));
vi.mock('@/modules/institution/server/tenant-business-repository', () => ({
  createTenantBusinessRepository: routeMocks.createTenantBusinessRepository,
}));
vi.mock('@/modules/institution/server/followup-operations-dashboard-service', () => ({
  getFollowUpOperationsDashboard: routeMocks.getFollowUpOperationsDashboard,
}));

const disabledPayload = {
  code: 'follow_up_operations_dashboard_capability_disabled',
  error: '随访运营看板能力暂未启用',
};

function expectNoRouteSideEffects() {
  expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
  expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
  expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
  expect(routeMocks.getFollowUpOperationsDashboard).not.toHaveBeenCalled();
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  for (const mock of Object.values(routeMocks)) mock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('follow-up operations dashboard capability gate', () => {
  it('普通及带查询参数请求固定返回低敏 503，且不返回运营业务字段', async () => {
    for (const request of [
      new Request('http://localhost/api/institution/followup-operations/dashboard'),
      new Request('http://localhost/api/institution/followup-operations/dashboard?tenantId=other-tenant&institutionId=other-institution'),
      new Request('http://localhost/api/institution/followup-operations/dashboard', {
        headers: {
          cookie: 'session=header-secret',
          'x-institution-id': 'header-institution-secret',
        },
      }),
    ]) {
      const apiResponse = await GET(request);
      const payload = await apiResponse.json();

      expect(apiResponse.status).toBe(503);
      expect(apiResponse.headers.get('cache-control')).toBe('no-store');
      expect(payload).toEqual(disabledPayload);
      expect(JSON.stringify(payload)).not.toContain('header-secret');
      expect(JSON.stringify(payload)).not.toContain('header-institution-secret');
      expect(payload).not.toHaveProperty('overview');
      expect(payload).not.toHaveProperty('pathPerformance');
      expect(payload).not.toHaveProperty('workload');
      expect(payload).not.toHaveProperty('draftOperations');
      expect(payload).not.toHaveProperty('messageDeliveries');
      expect(payload).not.toHaveProperty('contactSafety');
      expect(payload).not.toHaveProperty('weComAuthorization');
      expect(payload).not.toHaveProperty('weComCustomerContactSync');
      expect(payload).not.toHaveProperty('weComMockReachOut');
      expect(payload).not.toHaveProperty('riskSummary');
    }

    expectNoRouteSideEffects();
  });

  it('route source 不导入或初始化 capability-off 以外的依赖', async () => {
    const source = await readFile(
      resolve(process.cwd(), 'src/app/api/institution/followup-operations/dashboard/route.ts'),
      'utf8',
    );

    expect(source.match(/^import .+;$/gmu) ?? []).toEqual([
      "import { withInstitutionSectionRouteGuardV1 } from '@/app/api/institution/_shared/institution-route-guard';",
      "import { NextResponse } from 'next/server';",
    ]);
    expect(source).toContain('async function GET(_request: Request)');
    expect(source).toContain(
      'export { _base02B4GuardedGET as GET };',
    );
    expect(source).not.toMatch(
      /getDemoAccessContextFromRequest|getDatabase|create(?:AuditEvent|TenantBusiness)Repository|getFollowUpOperationsDashboard|fetch\(/u,
    );
  });

  it('hostile Request Proxy traps 为零，且不触发 fetch 或任何服务', async () => {
    const traps = { get: 0, ownKeys: 0, descriptor: 0 };
    const hostileRequest = new Proxy({}, {
      get() { traps.get += 1; throw new Error('request must not be read'); },
      ownKeys() { traps.ownKeys += 1; throw new Error('request must not be enumerated'); },
      getOwnPropertyDescriptor() { traps.descriptor += 1; throw new Error('request must not be described'); },
    }) as Request;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    try {
      const apiResponse = await GET(hostileRequest);

      expect(apiResponse.status).toBe(503);
      await expect(apiResponse.json()).resolves.toEqual(disabledPayload);
      expect(traps).toEqual({ get: 0, ownKeys: 0, descriptor: 0 });
      expect(fetchSpy).not.toHaveBeenCalled();
      expectNoRouteSideEffects();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('客户端将 capability-disabled 保持为不可用错误，不构造 dashboard', async () => {
    const fetcher = vi.fn(async () => response(disabledPayload, 503)) as unknown as typeof fetch;

    const result = await getFollowUpOperationsDashboard({ fetcher });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'service_unavailable',
        message: '随访运营看板能力暂未启用',
        status: 503,
      },
    });
    expect(result).not.toHaveProperty('dashboard');
    expect(fetcher).toHaveBeenCalledWith(
      '/api/institution/followup-operations/dashboard',
      { cache: 'no-store' },
    );
  });

  it('SmartFollowUpShell 在看板不可用时展示错误态，不渲染伪 0 指标', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/institution/followup-operations/dashboard')) {
        return response(disabledPayload, 503);
      }
      if (url.includes('/api/institution/followups')) {
        return response({
          code: 'follow_up_list_capability_disabled',
          error: '随访列表能力暂未启用',
        }, 503);
      }
      if (url.includes('/api/institution/followup-paths/enrollments')) {
        return response({ records: [] });
      }
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(createElement(SmartFollowUpShell));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/institution/followup-operations/dashboard',
        { cache: 'no-store' },
      );
    });
    expect(
      (await screen.findAllByText('数据服务暂时不可用，请稍后刷新或切换演示备份')).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('今日待随访')).not.toBeInTheDocument();
    expect(screen.queryByText('逾期任务')).not.toBeInTheDocument();
  });
});
