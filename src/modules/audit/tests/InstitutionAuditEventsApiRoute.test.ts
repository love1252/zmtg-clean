import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as institutionAuditEventsGet } from '@/app/api/institution/audit-events/route';

const routeMocks = vi.hoisted(() => ({
  createAuditEventRepository: vi.fn(),
  getDatabase: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
  parseAuditEventQueryParams: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({ getDatabase: routeMocks.getDatabase }));
vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
}));
vi.mock('@/modules/audit/server/audit-event-query-parser', () => ({
  parseAuditEventQueryParams: routeMocks.parseAuditEventQueryParams,
}));
vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: routeMocks.createAuditEventRepository,
}));

beforeEach(() => {
  for (const mock of Object.values(routeMocks)) mock.mockReset();
});

describe('机构端审计日志 capability gate', () => {
  it('固定返回低敏 503，且 hostile Request 不触发任何读取或服务副作用', async () => {
    const traps = { get: 0, ownKeys: 0, descriptor: 0 };
    const hostileRequest = new Proxy({}, {
      get() { traps.get += 1; throw new Error('request must not be read'); },
      ownKeys() { traps.ownKeys += 1; throw new Error('request must not be enumerated'); },
      getOwnPropertyDescriptor() { traps.descriptor += 1; throw new Error('request must not be described'); },
    }) as Request;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    try {
      const response = await institutionAuditEventsGet(hostileRequest);
      const payload = await response.json();

      expect(response.status).toBe(503);
      expect(payload).toEqual({
        code: 'institution_audit_events_capability_disabled',
        error: '机构审计日志能力暂未启用',
      });
      expect(payload).not.toHaveProperty('records');
      expect(payload).not.toHaveProperty('pageInfo');
      expect(payload).not.toHaveProperty('tenant');
      expect(payload).not.toHaveProperty('customer');
      expect(payload).not.toHaveProperty('actor');
      expect(payload).not.toHaveProperty('resource');
      expect(traps).toEqual({ get: 0, ownKeys: 0, descriptor: 0 });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
      expect(routeMocks.parseAuditEventQueryParams).not.toHaveBeenCalled();
      expect(routeMocks.getDatabase).not.toHaveBeenCalled();
      expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it.each([
    'http://localhost/api/institution/audit-events',
    'http://localhost/api/institution/audit-events?tenantId=other-tenant&resource=customer',
    'http://localhost/api/institution/audit-events?limit=101',
  ])('任意旧查询输入仍固定返回低敏 503：%s', async (path) => {
    const response = await institutionAuditEventsGet(new Request(path));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      code: 'institution_audit_events_capability_disabled',
      error: '机构审计日志能力暂未启用',
    });
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.parseAuditEventQueryParams).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
  });
});
