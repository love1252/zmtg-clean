import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as customerTimelineGet } from '@/app/api/institution/customers/[customerId]/timeline/route';
import { getCustomerTimeline } from '@/modules/institution/client/tenant-business-client';

const routeMocks = vi.hoisted(() => ({
  createAuditEventRepository: vi.fn(),
  createTenantBusinessRepository: vi.fn(),
  createTreatmentSummaryRepository: vi.fn(),
  getDatabase: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({ getDatabase: routeMocks.getDatabase }));
vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
}));
vi.mock('@/modules/institution/server/tenant-business-repository', () => ({
  createTenantBusinessRepository: routeMocks.createTenantBusinessRepository,
}));
vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: routeMocks.createAuditEventRepository,
}));
vi.mock('@/modules/institution/server/treatment-summary-repository', () => ({
  createTreatmentSummaryRepository: routeMocks.createTreatmentSummaryRepository,
}));

const disabledPayload = {
  code: 'customer_timeline_capability_disabled',
  error: '客户完整时间线能力暂未启用',
};

function routeContext(customerId = 'cust_001') {
  return { params: Promise.resolve({ customerId }) };
}

function expectNoRouteSideEffects() {
  expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
  expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
  expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
  expect(routeMocks.createTreatmentSummaryRepository).not.toHaveBeenCalled();
}

beforeEach(() => {
  for (const mock of Object.values(routeMocks)) mock.mockReset();
});

describe('客户完整 timeline capability gate', () => {
  it('普通及带查询参数请求固定返回低敏 503，且不读取客户或关联记录', async () => {
    for (const request of [
      new Request('http://localhost/api/institution/customers/cust_001/timeline'),
      new Request('http://localhost/api/institution/customers/cust_001/timeline?tenantId=other-tenant&institutionId=other-institution'),
    ]) {
      const response = await customerTimelineGet(request, routeContext());
      const payload = await response.json();

      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(payload).toEqual(disabledPayload);
      expect(payload).not.toHaveProperty('customer');
      expect(payload).not.toHaveProperty('timeline');
      expect(payload).not.toHaveProperty('appointments');
      expect(payload).not.toHaveProperty('followups');
      expect(payload).not.toHaveProperty('treatments');
      expect(payload).not.toHaveProperty('treatmentSummaries');
      expect(payload).not.toHaveProperty('audit');
      expect(payload).not.toHaveProperty('auditEvents');
      expect(JSON.stringify(payload)).not.toMatch(/other-tenant|other-institution|cust_001/i);
    }

    expectNoRouteSideEffects();
  });

  it('hostile Request 与 context Proxy 的 traps 均为零，且不会触发 fetch 或任何服务', async () => {
    const requestTraps = { get: 0, ownKeys: 0, descriptor: 0 };
    const contextTraps = { get: 0, ownKeys: 0, descriptor: 0 };
    const hostileRequest = new Proxy({}, {
      get() { requestTraps.get += 1; throw new Error('request must not be read'); },
      ownKeys() { requestTraps.ownKeys += 1; throw new Error('request must not be enumerated'); },
      getOwnPropertyDescriptor() { requestTraps.descriptor += 1; throw new Error('request must not be described'); },
    }) as Request;
    const hostileContext = new Proxy({}, {
      get() { contextTraps.get += 1; throw new Error('context must not be read'); },
      ownKeys() { contextTraps.ownKeys += 1; throw new Error('context must not be enumerated'); },
      getOwnPropertyDescriptor() { contextTraps.descriptor += 1; throw new Error('context must not be described'); },
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    try {
      const response = await customerTimelineGet(hostileRequest, hostileContext as never);

      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      await expect(response.json()).resolves.toEqual(disabledPayload);
      expect(requestTraps).toEqual({ get: 0, ownKeys: 0, descriptor: 0 });
      expect(contextTraps).toEqual({ get: 0, ownKeys: 0, descriptor: 0 });
      expect(fetchSpy).not.toHaveBeenCalled();
      expectNoRouteSideEffects();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('消费者将 capability-disabled 保持为不可用错误，不构造空 timeline 或零计数', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(disabledPayload), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;

    const result = await getCustomerTimeline('customer_safe_001', { fetcher });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'service_unavailable',
        message: '客户完整时间线能力暂未启用',
        status: 503,
      },
    });
    expect(result).not.toHaveProperty('timeline');
    expect(fetcher).toHaveBeenCalledWith(
      '/api/institution/customers/customer_safe_001/timeline',
      { cache: 'no-store' },
    );
  });
});
