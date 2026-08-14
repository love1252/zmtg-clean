import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/api/institution/_shared/institution-route-guard', () => ({
  withInstitutionSectionRouteGuardV1: ({
    handler,
  }: {
    handler: (...args: unknown[]) => Response | Promise<Response>;
  }) => handler,
}));

const routeMocks = vi.hoisted(() => ({
  readCurrentInstitutionAuditEventsV1: vi.fn(),
}));

vi.mock('@/server/orchestration/institution-audit-reader', () => ({
  readCurrentInstitutionAuditEventsV1:
    routeMocks.readCurrentInstitutionAuditEventsV1,
}));

import { GET as institutionAuditEventsGet } from '@/app/api/institution/audit-events/route';

const safeRecord = Object.freeze({
  id: 'audit_evt_001',
  resource: 'customer',
  resourceId: 'cust_001',
  action: 'read_own_tenant',
  result: 'allowed',
  reason: 'allowed_by_policy',
  actorId: 'actor_001',
  actorRole: 'tenant_admin',
  occurredAt: '2026-08-13T08:00:00.000Z',
});

const partialCoverage = Object.freeze({
  state: 'partial_verified_only',
  safeDataAvailable: true,
  historicalCoverageComplete: false,
  partialCoverageSafe: true,
});

beforeEach(() => {
  routeMocks.readCurrentInstitutionAuditEventsV1.mockReset();
  routeMocks.readCurrentInstitutionAuditEventsV1.mockResolvedValue({
    kind: 'ready',
    records: [safeRecord],
    pageInfo: { hasMore: false, limit: 20, nextCursor: null },
    coverage: partialCoverage,
  });
});

describe('机构端审计日志只读 Route', () => {
  it('解析正式查询并返回 200、no-store 与低敏结果', async () => {
    const response = await institutionAuditEventsGet(
      new Request(
        'http://localhost/api/institution/audit-events?resource=customer&limit=20',
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(routeMocks.readCurrentInstitutionAuditEventsV1).toHaveBeenCalledWith({
      filters: { resource: 'customer' },
      limit: 20,
    });
    expect(payload).toEqual({
      records: [safeRecord],
      pageInfo: { hasMore: false, limit: 20, nextCursor: null },
      coverage: partialCoverage,
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('tenantId');
    expect(serialized).not.toContain('institutionId');
    expect(serialized).not.toContain('institutionAttribution');
    expect(serialized).not.toContain('secret');
  });

  it('非法查询返回低敏 400、no-store 且不调用 Reader', async () => {
    const response = await institutionAuditEventsGet(
      new Request('http://localhost/api/institution/audit-events?limit=101'),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(payload).toEqual({ error: expect.any(String) });
    expect(routeMocks.readCurrentInstitutionAuditEventsV1).not.toHaveBeenCalled();
  });

  it.each([
    'tenantId=tenant-attacker',
    'institutionId=institution-attacker',
    'scope=platform',
    'role=platform_admin',
  ])('拒绝 caller scope 注入：%s', async (queryString) => {
    const response = await institutionAuditEventsGet(
      new Request(`http://localhost/api/institution/audit-events?${queryString}`),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(routeMocks.readCurrentInstitutionAuditEventsV1).not.toHaveBeenCalled();
  });

  it.each([
    'tenant_operator',
    'consultant',
    'customer_service',
  ] as const)('可信非管理员角色 %s 返回低敏 403 与 no-store', async (_role) => {
    routeMocks.readCurrentInstitutionAuditEventsV1.mockResolvedValue({
      kind: 'forbidden',
    });

    const response = await institutionAuditEventsGet(
      new Request('http://localhost/api/institution/audit-events'),
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(payload).toEqual({
      code: 'institution_audit_events_forbidden',
      error: '无权读取机构审计日志',
    });
    expect(JSON.stringify(payload)).not.toContain('tenant_operator');
    expect(JSON.stringify(payload)).not.toContain('consultant');
    expect(JSON.stringify(payload)).not.toContain('customer_service');
    expect(JSON.stringify(payload)).not.toContain('membership');
    expect(JSON.stringify(payload)).not.toContain('scope');
  });

  it('Reader unavailable 返回低敏 503 与 no-store', async () => {
    routeMocks.readCurrentInstitutionAuditEventsV1.mockResolvedValue({
      kind: 'unavailable',
    });

    const response = await institutionAuditEventsGet(
      new Request('http://localhost/api/institution/audit-events'),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(payload).toEqual({
      code: 'institution_audit_events_service_unavailable',
      error: '机构审计日志服务暂时不可用',
    });
    expect(JSON.stringify(payload)).not.toContain('stack');
    expect(JSON.stringify(payload)).not.toContain('DATABASE_URL');
  });

  it.each([
    null,
    {
      state: 'complete',
      safeDataAvailable: true,
      historicalCoverageComplete: false,
      partialCoverageSafe: false,
    },
    {
      state: 'partial_verified_only',
      safeDataAvailable: false,
      historicalCoverageComplete: true,
      partialCoverageSafe: true,
    },
    {
      ...partialCoverage,
      tenantId: 'must-not-cross-the-route-contract',
    },
  ])('非法 coverage state fail-closed 且不返回 records：%j', async (coverage) => {
    routeMocks.readCurrentInstitutionAuditEventsV1.mockResolvedValue({
      kind: 'ready',
      records: [safeRecord],
      pageInfo: { hasMore: false, limit: 20, nextCursor: null },
      coverage,
    });

    const response = await institutionAuditEventsGet(
      new Request('http://localhost/api/institution/audit-events'),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: 'institution_audit_events_service_unavailable',
      error: '机构审计日志服务暂时不可用',
    });
  });
});
