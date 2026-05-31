import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as institutionAuditEventsGet } from '@/app/api/institution/audit-events/route';
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

const tenantContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
};

const platformContext: AccessContext = {
  userId: 'demo-user-platform',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

const auditEventRecord = {
  id: 'audit_evt_001',
  tenantId: 'demo-tenant-001',
  resource: 'customer',
  resourceId: 'cust_001',
  action: 'update',
  result: 'allowed',
  reason: 'allowed_by_policy',
  actorId: 'demo-user-admin',
  actorRole: 'tenant_admin',
  occurredAt: '2026-05-31T09:00:00.000Z',
};

function auditRequest(path = 'http://localhost/api/institution/audit-events', init?: RequestInit) {
  return new Request(path, init);
}

function expectNoSensitiveAuditPayload(payload: unknown) {
  const serialized = JSON.stringify(payload);

  expect(serialized).not.toContain('tenantId');
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

describe('机构端审计日志只读 API', () => {
  it('只使用当前访问上下文租户查询审计事件并隐藏 tenantId', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await institutionAuditEventsGet(auditRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(routeMocks.auditRepository.listAuditEvents).toHaveBeenCalledWith({
      scope: { kind: 'institution', tenantId: 'demo-tenant-001' },
      query: {
        filters: {},
        limit: 50,
      },
    });
    expect(payload).toEqual({
      records: [
        {
          id: 'audit_evt_001',
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

  it('即使 repository 返回其他租户事件也不会通过机构端 API 返回', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.auditRepository.listAuditEvents.mockResolvedValueOnce({
      records: [
        auditEventRecord,
        {
          ...auditEventRecord,
          id: 'audit_evt_other_tenant',
          tenantId: 'other-tenant',
          resourceId: 'cust_other_tenant',
        },
      ],
      pageInfo: {
        hasMore: false,
        limit: 50,
        nextCursor: null,
      },
    });

    const response = await institutionAuditEventsGet(
      auditRequest('http://localhost/api/institution/audit-events?tenantId=other-tenant'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.records).toEqual([
      expect.objectContaining({
        id: 'audit_evt_001',
        resourceId: 'cust_001',
      }),
    ]);
    expect(JSON.stringify(payload)).not.toContain('audit_evt_other_tenant');
    expect(JSON.stringify(payload)).not.toContain('cust_other_tenant');
    expect(JSON.stringify(payload)).not.toContain('other-tenant');
  });

  it('URL query 和 header 中的 tenantId 不影响服务端租户判断', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await institutionAuditEventsGet(
      auditRequest('http://localhost/api/institution/audit-events?tenantId=other-tenant&resource=customer', {
        headers: { 'x-tenant-id': 'other-tenant' },
      }),
    );

    expect(response.status).toBe(200);
    expect(routeMocks.auditRepository.listAuditEvents).toHaveBeenCalledWith({
      scope: { kind: 'institution', tenantId: 'demo-tenant-001' },
      query: {
        filters: {
          resource: 'customer',
        },
        limit: 50,
      },
    });
    expect(routeMocks.auditRepository.listAuditEvents).not.toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { kind: 'institution', tenantId: 'other-tenant' },
      }),
    );
  });

  it('白名单筛选参数会解析后传给 repository', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await institutionAuditEventsGet(
      auditRequest(
        'http://localhost/api/institution/audit-events?from=2026-05-31T08%3A00%3A00.000Z&to=2026-05-31T10%3A00%3A00.000Z&resource=customer&resourceId=cust_001&action=update&result=allowed&reason=allowed_by_policy&actorId=demo-user-admin&limit=25',
      ),
    );

    expect(response.status).toBe(200);
    expect(routeMocks.auditRepository.listAuditEvents).toHaveBeenCalledWith({
      scope: { kind: 'institution', tenantId: 'demo-tenant-001' },
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

  it('非法筛选参数和超出上限的 limit 返回 400 且不查询数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const unknownParamResponse = await institutionAuditEventsGet(
      auditRequest('http://localhost/api/institution/audit-events?sql=select%20*%20from%20audit_events'),
    );
    const overLimitResponse = await institutionAuditEventsGet(
      auditRequest('http://localhost/api/institution/audit-events?limit=101'),
    );

    expect(unknownParamResponse.status).toBe(400);
    await expect(unknownParamResponse.json()).resolves.toEqual({
      error: '不支持的筛选参数: sql',
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

    const response = await institutionAuditEventsGet(auditRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('非机构审计可见角色返回 403 且不初始化数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);

    const response = await institutionAuditEventsGet(auditRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.auditRepository.listAuditEvents).not.toHaveBeenCalled();
  });

  it('数据服务不可用返回稳定 503 且不泄露错误详情', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.getDatabase.mockImplementation(() => {
      throw new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg');
    });

    const response = await institutionAuditEventsGet(auditRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: '数据服务暂时不可用' });
    expectNoSensitiveAuditPayload(payload);
  });
});
