import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as tenantAccountRoute from '@/app/api/v1/open-platform/tenants/[tenantId]/account/route';
import { checkTenantQuotaForCreate } from '@/modules/institution/server/tenant-quota-enforcement';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
  const repository = {
    findInitialAdminAccountByTenantId: vi.fn(),
    applyTenantAccountOperation: vi.fn(),
  };
  const database = { database: 'tenant-account-management-db' };

  return {
    createTenantAccountManagementRepository: vi.fn(() => repository),
    database,
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

vi.mock('@/modules/open-platform/server/tenant-account-management-repository', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/open-platform/server/tenant-account-management-repository')>();
  return {
    ...actual,
    createTenantAccountManagementRepository: routeMocks.createTenantAccountManagementRepository,
  };
});

vi.mock('@/modules/institution/server/tenant-quota-enforcement', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/institution/server/tenant-quota-enforcement')>();
  return {
    ...actual,
    checkTenantQuotaForCreate: vi.fn(),
  };
});

const platformAdminContext: AccessContext = {
  userId: 'demo-user-platform',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

const platformOperatorContext: AccessContext = {
  userId: 'demo-user-platform-operator',
  role: 'platform_operator',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

const tenantAdminAccount = {
  tenantId: 'tenant-zhengpu',
  accountId: 'auth-user-zhengpu-admin',
  tenantMemberId: 'tenant-member-zhengpu-admin',
  username: 'zhengpu_admin',
  displayName: '陈磊',
  role: 'tenant_admin',
  status: 'password_reset_required',
  passwordResetRequired: true,
};

function request(url: string, body: unknown = {}) {
  return new Request(`http://localhost${url}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function routeContext(tenantId = 'tenant-zhengpu') {
  return { params: Promise.resolve({ tenantId }) };
}

function expectNoSensitivePayload(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(
    /New#2026-Strong|passwordHash|scrypt\$|requestBody|select \*|payment_token|webhook_secret|client_secret|api_key|DATABASE_URL|postgres:\/\//i,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
  routeMocks.repository.findInitialAdminAccountByTenantId.mockResolvedValue(tenantAdminAccount);
  routeMocks.repository.applyTenantAccountOperation.mockImplementation(async (input) => ({
    status: 'account_updated',
    action: input.action,
    auditEventId: input.auditEvent.eventId,
    account: {
      tenantId: input.account.tenantId,
      accountId: input.account.accountId,
      tenantMemberId: input.account.tenantMemberId,
      username: input.account.username,
      displayName: input.account.displayName,
      role: input.account.role,
      status: input.nextStatus,
      passwordResetRequired: input.passwordResetRequired,
      updatedAt: input.updatedAt.toISOString(),
    },
  }));
});

describe('租户初始管理员账号管理 API', () => {
  it('platform_admin 可重置初始管理员密码并返回低敏账号状态和 audit id', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);

    const response = await tenantAccountRoute.PATCH(
      request('/api/v1/open-platform/tenants/tenant-zhengpu/account', {
        action: 'reset_password',
        newPassword: 'New#2026-Strong',
        requestBody: { newPassword: 'New#2026-Strong' },
        sql: 'select * from auth_users',
      }),
      routeContext(),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      status: 'account_updated',
      action: 'reset_password',
      auditEventId: expect.stringMatching(/^audit-event-/u),
      account: expect.objectContaining({
        tenantId: 'tenant-zhengpu',
        accountId: 'auth-user-zhengpu-admin',
        status: 'password_reset_required',
        passwordResetRequired: true,
      }),
    });
    expect(routeMocks.createTenantAccountManagementRepository).toHaveBeenCalledWith(
      routeMocks.database,
    );
    expectNoSensitivePayload(payload);
    expectNoSensitivePayload(routeMocks.repository.applyTenantAccountOperation.mock.calls[0][0].auditEvent);
  });

  it('platform_admin 可停用初始管理员账号', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);

    const disabled = await tenantAccountRoute.PATCH(
      request('/api/v1/open-platform/tenants/tenant-zhengpu/account', { action: 'disable' }),
      routeContext(),
    );
    expect(disabled.status).toBe(200);
    await expect(disabled.json()).resolves.toMatchObject({
      ok: true,
      action: 'disable',
      account: { status: 'disabled' },
    });
  });

  it('enable 未超限时成功', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: true,
      current: 1,
      limit: 5,
      resource: 'staff_seats',
    });

    const enabled = await tenantAccountRoute.PATCH(
      request('/api/v1/open-platform/tenants/tenant-zhengpu/account', { action: 'enable' }),
      routeContext(),
    );
    expect(enabled.status).toBe(200);
    await expect(enabled.json()).resolves.toMatchObject({
      ok: true,
      action: 'enable',
      account: { status: 'active' },
    });
    expect(routeMocks.repository.applyTenantAccountOperation).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'enable' }),
    );
  });

  it('enable 员工席位超限时返回 409', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: false,
      current: 5,
      limit: 5,
      reason: 'quota_exceeded_staff_seats',
      resource: 'staff_seats',
    });

    const enabled = await tenantAccountRoute.PATCH(
      request('/api/v1/open-platform/tenants/tenant-zhengpu/account', { action: 'enable' }),
      routeContext(),
    );
    const body = await enabled.json();

    expect(enabled.status).toBe(409);
    expect(body.errorCode).toBe('quota_exceeded_staff_seats');
    expect(body.error).toContain('员工席位');
    // 超限时不应调用 service
    expect(routeMocks.repository.applyTenantAccountOperation).not.toHaveBeenCalled();
  });

  it('enable 超限 response 不泄露敏感字段', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: false,
      current: 5,
      limit: 5,
      reason: 'quota_exceeded_staff_seats',
      resource: 'staff_seats',
    });

    const enabled = await tenantAccountRoute.PATCH(
      request('/api/v1/open-platform/tenants/tenant-zhengpu/account', { action: 'enable' }),
      routeContext(),
    );
    const body = await enabled.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('postgres://');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('token');
  });

  it('跨租户 active 账号计数隔离（按当前 tenantId）', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: true,
      current: 1,
      limit: 5,
      resource: 'staff_seats',
    });

    const enabled = await tenantAccountRoute.PATCH(
      request('/api/v1/open-platform/tenants/tenant-zhengpu/account', { action: 'enable' }),
      routeContext(),
    );
    expect(enabled.status).toBe(200);
    // checkTenantQuotaForCreate must be called with the target tenantId
    expect(checkTenantQuotaForCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'staff_seats',
        tenantId: 'tenant-zhengpu',
      }),
    );
  });

  it('无登录态或非 platform_admin 返回低敏错误且不初始化数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);

    const unauthorized = await tenantAccountRoute.PATCH(
      request('/api/v1/open-platform/tenants/tenant-zhengpu/account', { action: 'disable' }),
      routeContext(),
    );
    expect(unauthorized.status).toBe(401);

    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformOperatorContext);
    const forbidden = await tenantAccountRoute.PATCH(
      request('/api/v1/open-platform/tenants/tenant-zhengpu/account', { action: 'disable' }),
      routeContext(),
    );
    expect(forbidden.status).toBe(403);
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('非法 payload 和缺少账号返回稳定低敏错误', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);

    const validation = await tenantAccountRoute.PATCH(
      request('/api/v1/open-platform/tenants/tenant-zhengpu/account', {
        action: 'reset_password',
        newPassword: ' ',
        requestBody: { newPassword: 'New#2026-Strong' },
      }),
      routeContext(),
    );
    expect(validation.status).toBe(400);
    await expect(validation.json()).resolves.toEqual({
      ok: false,
      status: 'validation_error',
      errors: ['PASSWORD_REQUIRED'],
    });

    routeMocks.repository.findInitialAdminAccountByTenantId.mockResolvedValueOnce(null);
    const missing = await tenantAccountRoute.PATCH(
      request('/api/v1/open-platform/tenants/tenant-missing/account', { action: 'disable' }),
      routeContext('tenant-missing'),
    );
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({
      ok: false,
      errorCode: 'TENANT_ACCOUNT_NOT_FOUND',
    });
  });
});
