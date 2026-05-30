import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET as appointmentsGet } from '@/app/api/institution/appointments/route';
import { GET as customersGet } from '@/app/api/institution/customers/route';
import { GET as followupsGet } from '@/app/api/institution/followups/route';
import type { AccessContext } from '@/modules/security/domain/access-control';
import { handleTenantBusinessListRequest } from '@/modules/institution/server/tenant-business-api';

const getDatabaseMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return {
    ...actual,
    getDatabase: getDatabaseMock,
  };
});

const tenantContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
};

afterEach(() => {
  getDatabaseMock.mockReset();
});

describe('租户业务只读 API 流程', () => {
  it('使用服务端上下文租户读取客户，不信任 URL 租户参数', async () => {
    const repository = {
      listCustomersByTenant: vi.fn(async () => [{ id: 'cust_001', tenantId: 'demo-tenant-001' }]),
      listAppointmentsByTenant: vi.fn(),
      listFollowUpTasksByTenant: vi.fn(),
    };
    const auditRepository = { record: vi.fn(async () => undefined) };

    const response = await handleTenantBusinessListRequest({
      request: new Request('http://localhost/api/institution/customers?tenantId=other-tenant'),
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
      request: new Request('http://localhost/api/institution/customers'),
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
    const platformContext: AccessContext = {
      userId: 'demo-user-platform',
      role: 'platform_admin',
      scope: 'platform',
      tenantId: null,
      source: 'demo_session',
    };
    const auditRepository = { record: vi.fn(async () => undefined) };

    const response = await handleTenantBusinessListRequest({
      request: new Request('http://localhost/api/institution/customers'),
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
      request: new Request('http://localhost/api/institution/appointments'),
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
  it('数据库异常返回 503 且不泄露连接信息', async () => {
    getDatabaseMock.mockImplementation(() => {
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
});
