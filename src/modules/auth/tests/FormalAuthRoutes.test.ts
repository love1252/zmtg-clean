import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as sessionGet } from '@/app/api/auth/session/route';
import { decodeDemoSession, DEMO_SESSION_COOKIE } from '@/modules/auth/server/demo-session';
import type { AuthAccountRepository } from '@/modules/auth/server/auth-account-service';

const routeMocks = vi.hoisted(() => {
  const account = {
    id: 'auth-user-zhengpu-admin',
    username: 'zhengpu_admin',
    displayName: '陈磊',
    phone: '13985162273',
    email: null,
    passwordHash: 'scrypt$16384$8$1$salt$hash',
    passwordUpdatedAt: new Date('2026-06-25T07:00:00.000Z'),
    passwordResetRequired: true,
    status: 'password_reset_required',
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdBy: 'demo-user-platform',
    updatedBy: 'demo-user-platform',
    createdAt: new Date('2026-06-25T07:00:00.000Z'),
    updatedAt: new Date('2026-06-25T07:00:00.000Z'),
  };
  const repository = {
    createAccount: vi.fn(),
    findAccountByUsername: vi.fn(),
    findPrimaryTenantMembershipByUserId: vi.fn(),
    listActiveInstitutionBindingsByAccountAndTenant: vi.fn(),
    recordLoginFailure: vi.fn(),
    recordLoginSuccess: vi.fn(),
    updateAccountStatus: vi.fn(),
    updatePassword: vi.fn(),
  };
  const service = {
    authenticatePasswordAccount: vi.fn(),
  };
  const membership = {
    id: 'tenant-member-zhengpu-admin',
    tenantId: 'tenant-zhengpu',
    userId: 'auth-user-zhengpu-admin',
    role: 'tenant_admin',
    displayName: '陈磊',
    createdAt: new Date('2026-06-25T07:00:00.000Z'),
    updatedAt: new Date('2026-06-25T07:00:00.000Z'),
  };
  const auditRepository = {
    record: vi.fn(),
    listCustomerAuditEventsByResourceId: vi.fn(),
    listAuditEvents: vi.fn(),
    listFollowUpPathAnalysisAuditEventsByTenant: vi.fn(),
  };

  return {
    auditRepository,
    account,
    membership,
    createAuthAccountRepository: vi.fn(() => repository),
    createAuthAccountService: vi.fn(() => service),
    createAuditEventRepository: vi.fn(() => auditRepository),
    database: { database: 'formal-auth-db' },
    getDatabase: vi.fn(),
    provisionDemoDataForTenant: vi.fn(),
    repository,
    service,
  };
});

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return {
    ...actual,
    getDatabase: routeMocks.getDatabase,
  };
});

vi.mock('@/modules/auth/server/auth-account-repository', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/auth/server/auth-account-repository')>();
  return {
    ...actual,
    createAuthAccountRepository: routeMocks.createAuthAccountRepository,
  };
});

vi.mock('@/modules/auth/server/auth-account-service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/auth/server/auth-account-service')>();
  return {
    ...actual,
    createAuthAccountService: routeMocks.createAuthAccountService,
  };
});

vi.mock('@/modules/audit/server/audit-event-repository', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/audit/server/audit-event-repository')>();
  return {
    ...actual,
    createAuditEventRepository: routeMocks.createAuditEventRepository,
  };
});

vi.mock('@/modules/institution/server/trial-provisioning-service', () => ({
  provisionDemoDataForTenant: routeMocks.provisionDemoDataForTenant,
}));

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function readCookie(setCookie: string | null) {
  expect(setCookie).toBeTruthy();
  return setCookie?.split(';')[0] ?? '';
}

beforeEach(() => {
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.createAuthAccountRepository.mockClear();
  routeMocks.createAuthAccountService.mockClear();
  routeMocks.createAuditEventRepository.mockClear();
  routeMocks.provisionDemoDataForTenant.mockReset();
  Object.values(routeMocks.repository).forEach((mock) => mock.mockReset());
  Object.values(routeMocks.auditRepository).forEach((mock) => mock.mockReset());
  routeMocks.service.authenticatePasswordAccount.mockReset();
  routeMocks.repository.findAccountByUsername.mockResolvedValue(routeMocks.account);
  routeMocks.repository.findPrimaryTenantMembershipByUserId.mockResolvedValue(routeMocks.membership);
  routeMocks.repository.listActiveInstitutionBindingsByAccountAndTenant.mockResolvedValue([]);
  routeMocks.service.authenticatePasswordAccount.mockResolvedValue({
    status: 'authenticated',
    passwordResetRequired: true,
    user: {
      id: 'auth-user-zhengpu-admin',
      username: 'zhengpu_admin',
      name: '陈磊',
      role: 'tenant_admin',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
    },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('正式账号登录路由', () => {
  it('机构端登录优先认证 auth_users，并沿用现有签名 session cookie', async () => {
    const { POST } = await import('@/app/api/auth/login/route');

    const response = await POST(
      jsonRequest({
        username: 'zhengpu_admin',
        password: 'Init#2026-Strong',
        scope: 'institution',
      }),
    );
    const payload = await response.json();
    const cookie = readCookie(response.headers.get('set-cookie'));
    const encodedSession = cookie.slice(`${DEMO_SESSION_COOKIE}=`.length);

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      code: 0,
      data: {
        user: {
          id: 'auth-user-zhengpu-admin',
          username: 'zhengpu_admin',
          name: '陈磊',
          role: 'tenant_admin',
          tenantId: 'tenant-zhengpu',
          institutionId: 'institution-zhengpu',
        },
        passwordResetRequired: true,
      },
    });
    expect(routeMocks.getDatabase).toHaveBeenCalledWith();
    expect(routeMocks.getDatabase).toHaveBeenCalledTimes(1);
    expect(routeMocks.provisionDemoDataForTenant).not.toHaveBeenCalled();
    expect(routeMocks.createAuthAccountRepository).toHaveBeenCalledWith(routeMocks.database);
    expect(routeMocks.repository.findAccountByUsername).toHaveBeenCalledWith('zhengpu_admin');
    expect(routeMocks.repository.findPrimaryTenantMembershipByUserId).toHaveBeenCalledWith(
      'auth-user-zhengpu-admin',
    );
    expect(routeMocks.createAuthAccountService).toHaveBeenCalledWith({
      repository: routeMocks.repository as AuthAccountRepository,
    });
    expect(routeMocks.service.authenticatePasswordAccount).toHaveBeenCalledWith({
      username: 'zhengpu_admin',
      plaintextPassword: 'Init#2026-Strong',
      scope: 'institution',
    });
    expect(decodeDemoSession(encodedSession)).toEqual({
      user: {
        id: 'auth-user-zhengpu-admin',
        username: 'zhengpu_admin',
        name: '陈磊',
        role: 'tenant_admin',
        tenantId: 'tenant-zhengpu',
        institutionId: 'institution-zhengpu',
      },
      expiresAt: expect.any(Number),
      source: 'server_session',
    });
    expect(routeMocks.createAuditEventRepository).toHaveBeenCalledWith(routeMocks.database);
    expect(routeMocks.auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'auth-user-zhengpu-admin',
        actorRole: 'tenant_admin',
        tenantId: 'tenant-zhengpu',
        scope: 'tenant',
        resource: 'tenant_member',
        resourceId: 'tenant-member-zhengpu-admin',
        action: 'read_own_tenant',
        result: 'allowed',
        reason: 'tenant_login_succeeded',
      }),
    );
    expect(JSON.stringify(payload)).not.toMatch(/Init#2026-Strong|passwordHash|scrypt\$/i);
    expect(JSON.stringify(routeMocks.auditRepository.record.mock.calls)).not.toMatch(
      /Init#2026-Strong|passwordHash|scrypt\$|requestBody|select \*/i,
    );
  });

  it('正式账号存在但密码错误时不回退到同名演示账号', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    routeMocks.repository.findAccountByUsername.mockResolvedValue({
      ...routeMocks.account,
      username: 'admin',
    });
    routeMocks.service.authenticatePasswordAccount.mockResolvedValue({
      status: 'rejected',
      reason: 'invalid_credentials',
    });

    const response = await POST(
      jsonRequest({
        username: 'admin',
        password: 'admin123',
        scope: 'institution',
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: 401,
      message: '用户名或密码错误',
    });
    expect(routeMocks.auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'auth-user-zhengpu-admin',
        actorRole: 'tenant_admin',
        tenantId: 'tenant-zhengpu',
        scope: 'tenant',
        resource: 'tenant_member',
        resourceId: 'tenant-member-zhengpu-admin',
        action: 'read_own_tenant',
        result: 'denied',
        reason: 'tenant_login_failed',
      }),
    );
    expect(JSON.stringify(routeMocks.auditRepository.record.mock.calls)).not.toMatch(
      /admin123|passwordHash|scrypt\$|requestBody|select \*/i,
    );
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('生产关闭演示认证时仍允许已验证的正式 server session 完成会话检查', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ZMTG_ENABLE_DEMO_AUTH', 'false');
    vi.stubEnv('ZMTG_DEMO_SESSION_SECRET', 'formal-session-test-signing-key');
    const { POST } = await import('@/app/api/auth/login/route');

    const loginResponse = await POST(
      jsonRequest({
        username: 'zhengpu_admin',
        password: 'Init#2026-Strong',
        scope: 'institution',
      }),
    );
    const cookie = readCookie(loginResponse.headers.get('set-cookie'));
    const sessionResponse = await sessionGet(
      new Request('http://localhost/api/auth/session', {
        headers: { cookie },
      }),
    );

    expect(loginResponse.status).toBe(200);
    expect(sessionResponse.status).toBe(200);
    await expect(sessionResponse.json()).resolves.toMatchObject({
      authenticated: true,
      user: {
        id: 'auth-user-zhengpu-admin',
        institutionId: 'institution-zhengpu',
      },
    });
  });
});
