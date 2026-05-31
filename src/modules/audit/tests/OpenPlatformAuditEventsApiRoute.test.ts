import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as openPlatformAuditEventsGet } from '@/app/api/open-platform/audit-events/route';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
  const auditRepository = {
    listAuditEvents: vi.fn(),
  };
  const database = { database: 'test-db' };

  return {
    auditRepository,
    createAuditEventRepository: vi.fn(() => auditRepository),
    database,
    getDatabase: vi.fn(),
    getDemoAccessContextFromRequest: vi.fn(),
  };
});

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return {
    ...actual,
    getDatabase: routeMocks.getDatabase,
  };
});

vi.mock('@/modules/security/server/access-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/security/server/access-context')>();
  return {
    ...actual,
    getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
  };
});

vi.mock('@/modules/audit/server/audit-event-repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/audit/server/audit-event-repository')>();
  return {
    ...actual,
    createAuditEventRepository: routeMocks.createAuditEventRepository,
  };
});

const platformAdminContext: AccessContext = {
  userId: 'demo-user-platform',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

const securityAuditorContext: AccessContext = {
  userId: 'demo-user-auditor',
  role: 'security_auditor',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

const platformOperatorContext: AccessContext = {
  userId: 'demo-user-operator',
  role: 'platform_operator',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

const tenantContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
};

const auditEventRecord = {
  id: 'audit_evt_platform_001',
  tenantId: 'demo-tenant-001',
  resource: 'customer',
  resourceId: 'cust_001',
  action: 'update',
  result: 'allowed',
  reason: 'allowed_by_policy',
  actorId: 'demo-user-admin',
  actorRole: 'tenant_admin',
  occurredAt: '2026-05-31T09:00:00.000Z',
  requestBody: { phoneNumber: '13800000000' },
  metadata: { sql: 'select * from audit_events' },
  stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_should_not_return',
  secret: 'raw-secret',
};

function auditRequest(path = 'http://localhost/api/open-platform/audit-events', init?: RequestInit) {
  return new Request(path, init);
}

function expectNoSensitiveAuditPayload(payload: unknown) {
  const serialized = JSON.stringify(payload);

  expect(serialized).not.toContain('requestBody');
  expect(serialized).not.toContain('metadata');
  expect(serialized).not.toContain('select * from audit_events');
  expect(serialized).not.toContain('DATABASE_URL');
  expect(serialized).not.toContain('postgres://');
  expect(serialized).not.toContain('stack');
  expect(serialized).not.toContain('token');
  expect(serialized).not.toContain('secret');
  expect(serialized).not.toContain('13800000000');
  expect(serialized).not.toContain('110101199001010011');
  expect(serialized).not.toContain('MR-RAW-001');
  expect(serialized).not.toContain('完整治疗记录正文');
  expect(serialized).not.toContain('咨询对话全文');
}

beforeEach(() => {
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
  routeMocks.createAuditEventRepository.mockClear();
  routeMocks.auditRepository.listAuditEvents.mockReset();
  routeMocks.auditRepository.listAuditEvents.mockResolvedValue({
    records: [auditEventRecord],
    pageInfo: {
      hasMore: false,
      limit: 50,
      nextCursor: null,
    },
  });
});

describe('平台端审计日志只读 API', () => {
  it('platform_admin 可查看平台可见范围审计事件并保留 tenantId 筛选展示字段', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);

    const response = await openPlatformAuditEventsGet(auditRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(routeMocks.auditRepository.listAuditEvents).toHaveBeenCalledWith({
      scope: { kind: 'platform' },
      query: {
        filters: {},
        limit: 50,
      },
    });
    expect(payload).toEqual({
      records: [
        {
          id: 'audit_evt_platform_001',
          tenantId: 'demo-tenant-001',
          resource: 'customer',
          resourceId: 'cust_001',
          action: 'update',
          result: 'allowed',
          reason: 'allowed_by_policy',
          actorId: 'demo-user-admin',
          actorRole: 'tenant_admin',
          occurredAt: '2026-05-31T09:00:00.000Z',
        },
      ],
      pageInfo: {
        hasMore: false,
        limit: 50,
        nextCursor: null,
      },
    });
    expectNoSensitiveAuditPayload(payload);
  });

  it('security_auditor 角色也可使用同一只读审计查询能力', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(securityAuditorContext);

    const response = await openPlatformAuditEventsGet(auditRequest());

    expect(response.status).toBe(200);
    expect(routeMocks.auditRepository.listAuditEvents).toHaveBeenCalledWith({
      scope: { kind: 'platform' },
      query: {
        filters: {},
        limit: 50,
      },
    });
  });

  it('tenantId 作为平台端筛选条件生效，其他白名单筛选参数传给 repository', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);

    const response = await openPlatformAuditEventsGet(
      auditRequest(
        'http://localhost/api/open-platform/audit-events?tenantId=demo-tenant-001&from=2026-05-31T08%3A00%3A00.000Z&to=2026-05-31T10%3A00%3A00.000Z&resource=customer&resourceId=cust_001&action=update&result=allowed&reason=allowed_by_policy&actorId=demo-user-admin&limit=25',
      ),
    );

    expect(response.status).toBe(200);
    expect(routeMocks.auditRepository.listAuditEvents).toHaveBeenCalledWith({
      scope: { kind: 'platform', tenantId: 'demo-tenant-001' },
      query: {
        filters: {
          from: '2026-05-31T08:00:00.000Z',
          to: '2026-05-31T10:00:00.000Z',
          resource: 'customer',
          resourceId: 'cust_001',
          action: 'update',
          result: 'allowed',
          reason: 'allowed_by_policy',
          actorId: 'demo-user-admin',
        },
        limit: 25,
      },
    });
  });

  it('非法 tenantId、伪造 role 参数和超出上限的 limit 返回 400 且不查询数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);

    const invalidTenantResponse = await openPlatformAuditEventsGet(
      auditRequest('http://localhost/api/open-platform/audit-events?tenantId=other tenant'),
    );
    const forgedRoleResponse = await openPlatformAuditEventsGet(
      auditRequest('http://localhost/api/open-platform/audit-events?role=security_auditor'),
    );
    const overLimitResponse = await openPlatformAuditEventsGet(
      auditRequest('http://localhost/api/open-platform/audit-events?limit=101'),
    );

    expect(invalidTenantResponse.status).toBe(400);
    await expect(invalidTenantResponse.json()).resolves.toEqual({
      error: 'tenantId 格式不正确',
    });
    expect(forgedRoleResponse.status).toBe(400);
    await expect(forgedRoleResponse.json()).resolves.toEqual({
      error: '不支持的筛选参数: role',
    });
    expect(overLimitResponse.status).toBe(400);
    await expect(overLimitResponse.json()).resolves.toEqual({
      error: 'limit 必须在 1 到 100 之间',
    });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.auditRepository.listAuditEvents).not.toHaveBeenCalled();
  });

  it('未登录返回 401 且不初始化数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
    routeMocks.getDatabase.mockImplementation(() => {
      throw new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg');
    });

    const response = await openPlatformAuditEventsGet(auditRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it.each([
    ['platform_operator', platformOperatorContext],
    ['tenant_admin', tenantContext],
  ])('%s 访问平台审计 API 返回 403 且不初始化数据库', async (_role, context) => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(context);

    const response = await openPlatformAuditEventsGet(auditRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.auditRepository.listAuditEvents).not.toHaveBeenCalled();
  });

  it('数据服务不可用返回稳定 503 且不泄露错误详情', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);
    routeMocks.getDatabase.mockImplementation(() => {
      throw new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg');
    });

    const response = await openPlatformAuditEventsGet(auditRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: '数据服务暂时不可用' });
    expectNoSensitiveAuditPayload(payload);
  });
});
