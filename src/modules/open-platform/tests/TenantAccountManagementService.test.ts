import { describe, expect, it, vi } from 'vitest';
import {
  manageTenantAccountService,
  type TenantAccountManagementRepository,
} from '@/modules/open-platform/server/tenant-account-management-service';

const tenantAdminAccount = {
  tenantId: 'tenant-zhengpu',
  accountId: 'auth-user-zhengpu-admin',
  tenantMemberId: 'tenant-member-zhengpu-admin',
  username: 'zhengpu_admin',
  displayName: '陈磊',
  role: 'tenant_admin' as const,
  status: 'password_reset_required' as const,
  passwordResetRequired: true,
};

function createRepository(overrides: Partial<TenantAccountManagementRepository> = {}) {
  return {
    findInitialAdminAccountByTenantId: vi.fn(async () => tenantAdminAccount),
    applyTenantAccountOperation: vi.fn(async (input) => ({
      status: 'account_updated' as const,
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
    })),
    ...overrides,
  } satisfies TenantAccountManagementRepository;
}

describe('租户初始管理员账号管理 service', () => {
  it('重置密码只写入哈希和重置状态，并生成低敏审计事件', async () => {
    const repository = createRepository();
    const passwordHasher = {
      hash: vi.fn(async () => 'scrypt$16384$8$1$newSalt$newHash'),
    };

    const result = await manageTenantAccountService({
      repository,
      actorId: 'demo-user-platform',
      actorRole: 'platform_admin',
      tenantId: 'tenant-zhengpu',
      payload: {
        action: 'reset_password',
        newPassword: 'New#2026-Strong',
        requestBody: { newPassword: 'New#2026-Strong' },
        sql: 'select * from auth_users',
      },
      now: () => new Date('2026-06-25T10:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-fixed`,
      passwordHasher,
    });

    expect(passwordHasher.hash).toHaveBeenCalledWith('New#2026-Strong');
    expect(repository.applyTenantAccountOperation).toHaveBeenCalledWith({
      action: 'reset_password',
      account: tenantAdminAccount,
      nextStatus: 'password_reset_required',
      passwordResetRequired: true,
      passwordHash: 'scrypt$16384$8$1$newSalt$newHash',
      passwordUpdatedAt: new Date('2026-06-25T10:00:00.000Z'),
      lockedUntil: null,
      updatedAt: new Date('2026-06-25T10:00:00.000Z'),
      updatedBy: 'demo-user-platform',
      auditEvent: {
        eventId: 'audit-event-fixed',
        actorId: 'demo-user-platform',
        actorRole: 'platform_admin',
        tenantId: 'tenant-zhengpu',
        institutionId: null,
        institutionAttribution: 'not_applicable',
        scope: 'platform',
        resource: 'tenant_member',
        resourceId: 'tenant-member-zhengpu-admin',
        action: 'manage_credentials',
        result: 'transitioned',
        reason: 'tenant_account_password_reset',
        occurredAt: '2026-06-25T10:00:00.000Z',
        source: 'server_session',
      },
    });
    expect(result).toEqual({
      status: 'account_updated',
      action: 'reset_password',
      auditEventId: 'audit-event-fixed',
      account: expect.objectContaining({
        accountId: 'auth-user-zhengpu-admin',
        status: 'password_reset_required',
        passwordResetRequired: true,
      }),
    });
    expect(JSON.stringify([result, vi.mocked(repository.applyTenantAccountOperation).mock.calls[0][0].auditEvent])).not.toMatch(
      /New#2026-Strong|scrypt\$|passwordHash|requestBody|select \*/i,
    );
  });

  it('停用和启用账号会生成稳定状态与审计 reason', async () => {
    const repository = createRepository();

    await manageTenantAccountService({
      repository,
      actorId: 'demo-user-platform',
      actorRole: 'platform_admin',
      tenantId: 'tenant-zhengpu',
      payload: { action: 'disable' },
      now: () => new Date('2026-06-25T10:05:00.000Z'),
      idFactory: (prefix) => `${prefix}-disabled`,
    });

    await manageTenantAccountService({
      repository,
      actorId: 'demo-user-platform',
      actorRole: 'platform_admin',
      tenantId: 'tenant-zhengpu',
      payload: { action: 'enable' },
      now: () => new Date('2026-06-25T10:10:00.000Z'),
      idFactory: (prefix) => `${prefix}-enabled`,
    });

    expect(repository.applyTenantAccountOperation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: 'disable',
        nextStatus: 'disabled',
        passwordResetRequired: true,
        auditEvent: expect.objectContaining({
          eventId: 'audit-event-disabled',
          action: 'manage_status',
          reason: 'tenant_account_disabled',
        }),
      }),
    );
    expect(repository.applyTenantAccountOperation).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: 'enable',
        nextStatus: 'active',
        passwordResetRequired: true,
        auditEvent: expect.objectContaining({
          eventId: 'audit-event-enabled',
          action: 'manage_status',
          reason: 'tenant_account_enabled',
        }),
      }),
    );
  });

  it('拒绝缺少 action、缺少新密码和不存在的租户账号', async () => {
    await expect(
      manageTenantAccountService({
        repository: createRepository(),
        actorId: 'demo-user-platform',
        actorRole: 'platform_admin',
        tenantId: 'tenant-zhengpu',
        payload: {},
      }),
    ).resolves.toEqual({ status: 'validation_error', errors: ['ACTION_REQUIRED'] });

    await expect(
      manageTenantAccountService({
        repository: createRepository(),
        actorId: 'demo-user-platform',
        actorRole: 'platform_admin',
        tenantId: 'tenant-zhengpu',
        payload: { action: 'reset_password', newPassword: '   ' },
      }),
    ).resolves.toEqual({ status: 'validation_error', errors: ['PASSWORD_REQUIRED'] });

    await expect(
      manageTenantAccountService({
        repository: createRepository({ findInitialAdminAccountByTenantId: vi.fn(async () => null) }),
        actorId: 'demo-user-platform',
        actorRole: 'platform_admin',
        tenantId: 'tenant-missing',
        payload: { action: 'disable' },
      }),
    ).resolves.toEqual({ status: 'not_found', errorCode: 'TENANT_ACCOUNT_NOT_FOUND' });
  });
});
