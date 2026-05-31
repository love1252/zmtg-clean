import { describe, expect, it, vi } from 'vitest';
import { getOpenPlatformCommercialHealth } from '@/modules/open-platform/client/platform-tenant-management-client';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
}

describe('平台商业化健康 client helper', () => {
  it('复用平台租户与审计日志只读 API 派生商业化健康 view model', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/api/open-platform/tenants') {
        return jsonResponse({
          records: [
            {
              tenantId: 'tenant-active',
              tenantName: '有效套餐机构',
              tenantStatus: 'active',
              createdAt: '2026-05-30T00:00:00.000Z',
              updatedAt: '2026-05-31T00:00:00.000Z',
              planName: '成长版',
              planCode: 'growth-care',
              planStatus: 'active',
              assignmentStatus: 'active',
              startedAt: '2026-05-31T00:00:00.000Z',
              expiresAt: null,
              maxCustomers: 100,
              maxAppointments: 100,
              maxFollowUps: 100,
              maxAiCalls: 100,
              currentCustomers: 88,
              currentAppointments: 10,
              currentFollowUps: 10,
              currentAiCalls: 10,
              snapshotAt: '2026-05-31T08:00:00.000Z',
            },
          ],
        });
      }

      if (path === '/api/open-platform/audit-events?result=denied&limit=100') {
        return jsonResponse({
          records: [
            {
              id: 'audit_evt_001',
              tenantId: 'tenant-active',
              resource: 'customer',
              resourceId: 'cust_001',
              action: 'create',
              result: 'denied',
              reason: 'quota_exceeded_customers',
              actorId: 'demo-user-admin',
              actorRole: 'tenant_admin',
              occurredAt: '2026-05-31T10:00:00.000Z',
              requestBody: { phoneNumber: '13800000000' },
              metadata: { sql: 'select * from audit_events' },
              stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
              token: 'sk_test_should_not_return',
              secret: 'raw-secret',
            },
          ],
          pageInfo: {
            hasMore: false,
            limit: 100,
            nextCursor: null,
          },
        });
      }

      return jsonResponse({ error: 'unexpected path' }, { status: 404 });
    }) as unknown as typeof fetch;

    const result = await getOpenPlatformCommercialHealth({
      fetcher,
      now: '2026-06-01T00:00:00.000Z',
    });

    expect(result).toEqual({
      ok: true,
      health: expect.objectContaining({
        planCoverage: {
          tenantTotal: 1,
          activePlanTenantCount: 1,
          missingActivePlanTenantCount: 0,
          coverageRate: 1,
        },
        riskTenants: [
          expect.objectContaining({
            tenantId: 'tenant-active',
            quotaKey: 'customers',
            status: 'near_limit',
          }),
        ],
        quotaDeniedSignals: expect.objectContaining({
          totalCount: 1,
          byReason: [{ reason: 'quota_exceeded_customers', count: 1 }],
          byResource: [{ resource: 'customer', count: 1 }],
        }),
        lastUpdatedAt: '2026-06-01T00:00:00.000Z',
      }),
    });
    expect(fetcher).toHaveBeenCalledWith('/api/open-platform/tenants', { cache: 'no-store' });
    expect(fetcher).toHaveBeenCalledWith('/api/open-platform/audit-events?result=denied&limit=100', {
      cache: 'no-store',
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('requestBody');
    expect(serialized).not.toContain('metadata');
    expect(serialized).not.toContain('phoneNumber');
    expect(serialized).not.toContain('13800000000');
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('secret');
  });

  it('租户 API 失败时返回稳定错误，不进入 UI、写入或 enforcement 能力', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ error: '没有访问权限' }, { status: 403 }),
    ) as unknown as typeof fetch;

    await expect(getOpenPlatformCommercialHealth({ fetcher })).resolves.toEqual({
      ok: false,
      error: {
        kind: 'forbidden',
        message: '没有访问权限',
        status: 403,
      },
    });
  });
});
