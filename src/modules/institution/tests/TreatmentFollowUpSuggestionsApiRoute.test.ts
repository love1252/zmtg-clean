import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as treatmentFollowUpSuggestionsGet } from '@/app/api/institution/treatment-summaries/[summaryId]/follow-up-suggestions/route';
import { listTreatmentFollowUpSuggestions } from '@/modules/institution/client/tenant-business-client';

const routeMocks = vi.hoisted(() => ({
  auditRecord: vi.fn(),
  canAccessResource: vi.fn(),
  createAuditEventRepository: vi.fn(),
  createTreatmentSummaryRepository: vi.fn(),
  getDatabase: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
  getTreatmentFollowUpSuggestionsForSummary: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({ getDatabase: routeMocks.getDatabase }));
vi.mock('@/modules/security/domain/access-control', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/security/domain/access-control')>();
  return { ...actual, canAccessResource: routeMocks.canAccessResource };
});
vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
}));
vi.mock('@/modules/institution/server/treatment-summary-repository', () => ({
  createTreatmentSummaryRepository: routeMocks.createTreatmentSummaryRepository,
}));
vi.mock('@/modules/institution/server/treatment-followup-confirmation', () => ({
  getTreatmentFollowUpSuggestionsForSummary: routeMocks.getTreatmentFollowUpSuggestionsForSummary,
}));
vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: routeMocks.createAuditEventRepository,
}));

beforeEach(() => {
  for (const mock of Object.values(routeMocks)) mock.mockReset();
});

describe('机构端治疗随访建议 capability gate', () => {
  it('对普通 summaryId query 和 Cookie 仍只返回低敏且不可缓存的 503', async () => {
    const response = await treatmentFollowUpSuggestionsGet(
      new Request(
        'http://localhost/api/institution/treatment-summaries/summary-other/follow-up-suggestions?include=customer',
        { headers: { cookie: 'session=not-read' } },
      ),
      { params: Promise.resolve({ summaryId: 'summary-other' }) },
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      code: 'treatment_followup_suggestions_capability_disabled',
      error: '治疗随访建议能力暂未启用',
    });
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.canAccessResource).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.createTreatmentSummaryRepository).not.toHaveBeenCalled();
    expect(routeMocks.getTreatmentFollowUpSuggestionsForSummary).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
  });

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
      const response = await treatmentFollowUpSuggestionsGet(hostileRequest, hostileContext as never);
      const payload = await response.json();

      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(payload).toEqual({
        code: 'treatment_followup_suggestions_capability_disabled',
        error: '治疗随访建议能力暂未启用',
      });
      expect(payload).not.toHaveProperty('suggestions');
      expect(payload).not.toHaveProperty('customer');
      expect(payload).not.toHaveProperty('treatment');
      expect(payload).not.toHaveProperty('summary');
      expect(payload).not.toHaveProperty('task');
      expect(payload).not.toHaveProperty('count');
      expect(requestTraps).toEqual({ get: 0, ownKeys: 0, descriptor: 0 });
      expect(contextTraps).toEqual({ get: 0, ownKeys: 0, descriptor: 0 });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
      expect(routeMocks.canAccessResource).not.toHaveBeenCalled();
      expect(routeMocks.getDatabase).not.toHaveBeenCalled();
      expect(routeMocks.createTreatmentSummaryRepository).not.toHaveBeenCalled();
      expect(routeMocks.getTreatmentFollowUpSuggestionsForSummary).not.toHaveBeenCalled();
      expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
      expect(routeMocks.auditRecord).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('消费者将 capability-disabled 响应保持为稳定的不可用错误态', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      code: 'treatment_followup_suggestions_capability_disabled',
      error: '治疗随访建议能力暂未启用',
    }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;

    await expect(
      listTreatmentFollowUpSuggestions('treatment_safe_001', { fetcher }),
    ).resolves.toEqual({
      ok: false,
      error: {
        kind: 'service_unavailable',
        message: '治疗随访建议能力暂未启用',
        status: 503,
      },
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/institution/treatment-summaries/treatment_safe_001/follow-up-suggestions',
      { cache: 'no-store' },
    );
  });
});
