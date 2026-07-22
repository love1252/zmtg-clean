import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as treatmentSummariesGet } from '@/app/api/institution/treatment-summaries/route';

const routeMocks = vi.hoisted(() => ({
  auditRecord: vi.fn(),
  createAuditEventRepository: vi.fn(),
  createTreatmentSummaryRepository: vi.fn(),
  getDatabase: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({ getDatabase: routeMocks.getDatabase }));
vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
}));
vi.mock('@/modules/institution/server/treatment-summary-repository', () => ({
  createTreatmentSummaryRepository: routeMocks.createTreatmentSummaryRepository,
}));
vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: routeMocks.createAuditEventRepository,
}));

beforeEach(() => {
  for (const mock of Object.values(routeMocks)) mock.mockReset();
});

describe('机构端治疗记录列表 capability gate', () => {
  it('对普通 query 和 Cookie 仍只返回低敏且不可缓存的 503', async () => {
    const response = await treatmentSummariesGet(new Request(
      'http://localhost/api/institution/treatment-summaries?customerId=customer-other&limit=999',
      { headers: { cookie: 'session=not-read' } },
    ));

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      code: 'treatment_summary_list_capability_disabled',
      error: '治疗记录列表能力暂未启用',
    });
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.createTreatmentSummaryRepository).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
  });

  it('固定返回低敏 503，且 hostile Request 不触发任何读取或服务副作用', async () => {
    const traps = { get: 0, ownKeys: 0, descriptor: 0 };
    const hostileRequest = new Proxy({}, {
      get() { traps.get += 1; throw new Error('request must not be read'); },
      ownKeys() { traps.ownKeys += 1; throw new Error('request must not be enumerated'); },
      getOwnPropertyDescriptor() { traps.descriptor += 1; throw new Error('request must not be described'); },
    }) as Request;

    const response = await treatmentSummariesGet(hostileRequest);
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(payload).toEqual({
      code: 'treatment_summary_list_capability_disabled',
      error: '治疗记录列表能力暂未启用',
    });
    expect(payload).not.toHaveProperty('records');
    expect(traps).toEqual({ get: 0, ownKeys: 0, descriptor: 0 });
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.createTreatmentSummaryRepository).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
  });
});
