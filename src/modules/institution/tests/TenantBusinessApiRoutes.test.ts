import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as appointmentsGet } from '@/app/api/institution/appointments/route';
import { GET as customersGet } from '@/app/api/institution/customers/route';
import { GET as followupsGet } from '@/app/api/institution/followups/route';
import type { AccessContext } from '@/modules/security/domain/access-control';
import { handleTenantBusinessListRequest } from '@/modules/institution/server/tenant-business-api';

const routeMocks = vi.hoisted(() => {
  const repository = {
    listCustomersByTenant: vi.fn(),
    listAppointmentsByTenant: vi.fn(),
    listFollowUpTasksByTenant: vi.fn(),
  };
  const auditRecord = vi.fn();

  return {
    auditRecord,
    createAuditEventRepository: vi.fn(() => ({ record: auditRecord })),
    createTenantBusinessRepository: vi.fn(() => repository),
    getDatabase: vi.fn(),
    getDemoAccessContextFromRequest: vi.fn(),
    repository,
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

vi.mock('@/modules/institution/server/tenant-business-repository', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/institution/server/tenant-business-repository')
  >();
  return {
    ...actual,
    createTenantBusinessRepository: routeMocks.createTenantBusinessRepository,
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

beforeEach(() => {
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue({ database: 'test-db' });
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
  routeMocks.createTenantBusinessRepository.mockClear();
  routeMocks.createAuditEventRepository.mockClear();
  routeMocks.auditRecord.mockReset();
  routeMocks.auditRecord.mockResolvedValue(undefined);
  routeMocks.repository.listCustomersByTenant.mockReset();
  routeMocks.repository.listCustomersByTenant.mockResolvedValue([
    { id: 'cust_001', tenantId: 'demo-tenant-001' },
  ]);
  routeMocks.repository.listAppointmentsByTenant.mockReset();
  routeMocks.repository.listAppointmentsByTenant.mockResolvedValue([
    { id: 'appt_001', tenantId: 'demo-tenant-001' },
  ]);
  routeMocks.repository.listFollowUpTasksByTenant.mockReset();
  routeMocks.repository.listFollowUpTasksByTenant.mockResolvedValue([
    { id: 'fu_001', tenantId: 'demo-tenant-001' },
  ]);
});

describe('租户业务只读 API 流程', () => {
  it('使用访问上下文租户读取客户', async () => {
    const repository = {
      listCustomersByTenant: vi.fn(async () => [{ id: 'cust_001', tenantId: 'demo-tenant-001' }]),
      listAppointmentsByTenant: vi.fn(),
      listFollowUpTasksByTenant: vi.fn(),
    };
    const auditRepository = { record: vi.fn(async () => undefined) };

    const response = await handleTenantBusinessListRequest({
      context: tenantContext,
      resource: 'customer',
      list: repository.listCustomersByTenant,
      auditRepository,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      records: [{ id: 'cust_001', tenantId: 'demo-tenant-001' }],
    });
    expect(repository.listCustomersByTenant).toHaveBeenCalledWith('demo-tenant-001');
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      result: 'allowed',
      tenantId: 'demo-tenant-001',
      resource: 'customer',
    }));
  });

  it('没有访问上下文时返回 401 且不写审计', async () => {
    const auditRepository = { record: vi.fn(async () => undefined) };

    const response = await handleTenantBusinessListRequest({
      context: null,
      resource: 'customer',
      list: vi.fn(),
      auditRepository,
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
    expect(auditRepository.record).not.toHaveBeenCalled();
  });

  it('权限拒绝时返回 403 并写入审计事件', async () => {
    const auditRepository = { record: vi.fn(async () => undefined) };

    const response = await handleTenantBusinessListRequest({
      context: platformContext,
      resource: 'customer',
      list: vi.fn(),
      auditRepository,
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      result: 'denied',
      reason: 'role_denied',
    }));
  });

  it('租户作用域缺少 tenantId 时返回 403 并写入 missing_tenant 审计', async () => {
    const auditRepository = { record: vi.fn(async () => undefined) };
    const list = vi.fn();

    const response = await handleTenantBusinessListRequest({
      context: { ...tenantContext, tenantId: null },
      resource: 'appointment',
      list,
      auditRepository,
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(list).not.toHaveBeenCalled();
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'appointment',
      result: 'denied',
      reason: 'missing_tenant',
    }));
  });
});

describe('租户业务只读 API route', () => {
  it('未登录时优先返回 401 且不初始化数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
    routeMocks.getDatabase.mockImplementation(() => {
      throw new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg');
    });

    const routeHandlers = [customersGet, appointmentsGet, followupsGet];

    for (const routeHandler of routeHandlers) {
      const response = await routeHandler(new Request('http://localhost/api/institution/customers'));

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: '请先登录' });
    }
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('带恶意 URL 和 header tenant 时仍使用访问上下文 tenant', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await customersGet(
      new Request('http://localhost/api/institution/customers?tenantId=other-tenant', {
        headers: { 'x-tenant-id': 'other-tenant' },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      records: [{ id: 'cust_001', tenantId: 'demo-tenant-001' }],
    });
    expect(routeMocks.repository.listCustomersByTenant).toHaveBeenCalledWith('demo-tenant-001');
    expect(routeMocks.repository.listCustomersByTenant).not.toHaveBeenCalledWith('other-tenant');
  });

  it('权限拒绝时返回 403 且不被 route catch 成 503', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);

    const response = await customersGet(new Request('http://localhost/api/institution/customers'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(routeMocks.repository.listCustomersByTenant).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'role_denied',
      resource: 'customer',
      result: 'denied',
    }));
  });

  it('三个 route 绑定各自的列表方法和审计资源', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const routeCases = [
      {
        handler: customersGet,
        path: '/api/institution/customers',
        list: routeMocks.repository.listCustomersByTenant,
        resource: 'customer',
      },
      {
        handler: appointmentsGet,
        path: '/api/institution/appointments',
        list: routeMocks.repository.listAppointmentsByTenant,
        resource: 'appointment',
      },
      {
        handler: followupsGet,
        path: '/api/institution/followups',
        list: routeMocks.repository.listFollowUpTasksByTenant,
        resource: 'follow_up',
      },
    ] as const;

    for (const routeCase of routeCases) {
      routeMocks.auditRecord.mockClear();
      const response = await routeCase.handler(new Request(`http://localhost${routeCase.path}`));

      expect(response.status).toBe(200);
      expect(routeCase.list).toHaveBeenCalledWith('demo-tenant-001');
      expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
        action: 'read_own_tenant',
        resource: routeCase.resource,
        result: 'allowed',
        tenantId: 'demo-tenant-001',
      }));
    }
  });

  it('数据库异常返回 503 且不泄露连接信息', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.getDatabase.mockImplementation(() => {
      throw new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg');
    });

    const routeHandlers = [customersGet, appointmentsGet, followupsGet];

    for (const routeHandler of routeHandlers) {
      const response = await routeHandler(new Request('http://localhost/api/institution/customers'));
      const payload = await response.json();
      const serializedPayload = JSON.stringify(payload);

      expect(response.status).toBe(503);
      expect(payload).toEqual({ error: '数据服务暂时不可用' });
      expect(serializedPayload).not.toContain('DATABASE_URL');
      expect(serializedPayload).not.toContain('postgres://');
      expect(serializedPayload).not.toContain('secret');
    }
  });

  it('审计写入失败时 fail-closed 返回 503 且不泄露错误详情', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.auditRecord.mockRejectedValue(
      new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg'),
    );

    const response = await customersGet(new Request('http://localhost/api/institution/customers'));
    const payload = await response.json();
    const serializedPayload = JSON.stringify(payload);

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: '数据服务暂时不可用' });
    expect(serializedPayload).not.toContain('DATABASE_URL');
    expect(serializedPayload).not.toContain('postgres://');
    expect(serializedPayload).not.toContain('secret');
  });
});
