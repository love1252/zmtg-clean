import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as customerFollowUpTimelineGet } from '@/app/api/institution/customers/[customerId]/followup-timeline/route';
import { listCustomerFollowUpTimelineEvents } from '@/modules/institution/client/tenant-business-client';

const routeMocks = vi.hoisted(() => ({
  auditRecord: vi.fn(),
  createAuditEventRepository: vi.fn(),
  createTenantBusinessRepository: vi.fn(),
  getDatabase: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
  listCustomerFollowUpTimelineEvents: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({ getDatabase: routeMocks.getDatabase }));
vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
}));
vi.mock('@/modules/institution/server/tenant-business-repository', () => ({
  createTenantBusinessRepository: routeMocks.createTenantBusinessRepository,
}));
vi.mock('@/modules/institution/server/followup-customer-timeline-service', () => ({
  listCustomerFollowUpTimelineEvents: routeMocks.listCustomerFollowUpTimelineEvents,
}));
vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: routeMocks.createAuditEventRepository,
}));

beforeEach(() => {
  for (const mock of Object.values(routeMocks)) mock.mockReset();
});

describe('机构端客户随访时间线 capability gate', () => {
  it('固定返回低敏 503，且 hostile Request 和 context 不触发任何读取或服务副作用', async () => {
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
      const response = await customerFollowUpTimelineGet(hostileRequest, hostileContext as never);
      const payload = await response.json();

      expect(response.status).toBe(503);
      expect(payload).toEqual({
        code: 'customer_followup_timeline_capability_disabled',
        error: '客户随访时间线能力暂未启用',
      });
      expect(payload).not.toHaveProperty('records');
      expect(payload).not.toHaveProperty('customer');
      expect(payload).not.toHaveProperty('task');
      expect(payload).not.toHaveProperty('event');
      expect(requestTraps).toEqual({ get: 0, ownKeys: 0, descriptor: 0 });
      expect(contextTraps).toEqual({ get: 0, ownKeys: 0, descriptor: 0 });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
      expect(routeMocks.getDatabase).not.toHaveBeenCalled();
      expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
      expect(routeMocks.listCustomerFollowUpTimelineEvents).not.toHaveBeenCalled();
      expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
      expect(routeMocks.auditRecord).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('消费者将 capability-disabled 响应保持为稳定的不可用错误态', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      code: 'customer_followup_timeline_capability_disabled',
      error: '客户随访时间线能力暂未启用',
    }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;

    await expect(
      listCustomerFollowUpTimelineEvents('customer_safe_001', { fetcher }),
    ).resolves.toEqual({
      ok: false,
      error: {
        kind: 'service_unavailable',
        message: '客户随访时间线能力暂未启用',
        status: 503,
      },
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/institution/customers/customer_safe_001/followup-timeline',
      { cache: 'no-store' },
    );
  });
});
