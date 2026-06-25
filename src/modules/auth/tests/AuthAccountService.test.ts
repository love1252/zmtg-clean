import { describe, expect, it, vi } from 'vitest';
import type { AuthAccountRecord, AuthTenantMembershipRecord } from '@/modules/auth/domain/auth-account';
import {
  createAuthAccountService,
  type AuthAccountRepository,
} from '@/modules/auth/server/auth-account-service';

const now = new Date('2026-06-25T08:00:00.000Z');

function createAccount(overrides: Partial<AuthAccountRecord> = {}): AuthAccountRecord {
  return {
    id: 'auth-user-chenlei',
    username: 'chenlei_admin',
    displayName: '陈磊',
    phone: '13985162273',
    email: 'chenlei@example.com',
    passwordHash: 'scrypt$16384$8$1$salt$hash',
    passwordUpdatedAt: new Date('2026-06-25T07:00:00.000Z'),
    passwordResetRequired: false,
    status: 'active',
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdBy: 'platform-admin',
    updatedBy: 'platform-admin',
    createdAt: new Date('2026-06-25T07:00:00.000Z'),
    updatedAt: new Date('2026-06-25T07:00:00.000Z'),
    ...overrides,
  };
}

const tenantAdminMembership: AuthTenantMembershipRecord = {
  id: 'tenant-member-chenlei',
  tenantId: 'tenant-zhengpu',
  userId: 'auth-user-chenlei',
  role: 'tenant_admin',
  displayName: '陈磊',
  createdAt: new Date('2026-06-25T07:00:00.000Z'),
  updatedAt: new Date('2026-06-25T07:00:00.000Z'),
};

function createRepository(overrides: Partial<AuthAccountRepository> = {}): AuthAccountRepository {
  return {
    createAccount: vi.fn(async (record) => record),
    findAccountByUsername: vi.fn(async () => null),
    findPrimaryTenantMembershipByUserId: vi.fn(async () => null),
    recordLoginFailure: vi.fn(async () => undefined),
    recordLoginSuccess: vi.fn(async () => undefined),
    updateAccountStatus: vi.fn(async () => undefined),
    updatePassword: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('正式账号服务', () => {
  it('创建账号时只保存密码哈希，返回结果不泄露明文或哈希字段', async () => {
    const repository = createRepository();
    const passwordHasher = {
      hash: vi.fn(async () => 'scrypt$16384$8$1$salt$hash'),
      verify: vi.fn(),
    };
    const service = createAuthAccountService({
      repository,
      passwordHasher,
      now: () => now,
    });

    const result = await service.createPasswordAccount({
      id: 'auth-user-chenlei',
      username: '  ChenLei_Admin ',
      displayName: '陈磊',
      phone: '13985162273',
      email: 'chenlei@example.com',
      plaintextPassword: 'Init#2026-Strong',
      actorId: 'platform-admin',
    });

    expect(passwordHasher.hash).toHaveBeenCalledWith('Init#2026-Strong');
    expect(repository.createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'auth-user-chenlei',
        username: 'chenlei_admin',
        displayName: '陈磊',
        phone: '13985162273',
        email: 'chenlei@example.com',
        passwordHash: 'scrypt$16384$8$1$salt$hash',
        passwordUpdatedAt: now,
        passwordResetRequired: true,
        status: 'password_reset_required',
        createdBy: 'platform-admin',
        updatedBy: 'platform-admin',
        createdAt: now,
        updatedAt: now,
      }),
    );
    expect(result.status).toBe('created');
    expect(JSON.stringify(result)).not.toContain('Init#2026-Strong');
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain('scrypt$');
  });

  it('创建账号时拒绝空白密码且不写入 repository', async () => {
    const repository = createRepository();
    const passwordHasher = {
      hash: vi.fn(async () => 'scrypt$16384$8$1$salt$hash'),
      verify: vi.fn(),
    };
    const service = createAuthAccountService({
      repository,
      passwordHasher,
      now: () => now,
    });

    const result = await service.createPasswordAccount({
      id: 'auth-user-chenlei',
      username: 'chenlei_admin',
      displayName: '陈磊',
      phone: '13985162273',
      email: 'chenlei@example.com',
      plaintextPassword: '   ',
      actorId: 'platform-admin',
    });

    expect(result).toEqual({
      status: 'rejected',
      reason: 'password_required',
    });
    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(repository.createAccount).not.toHaveBeenCalled();
  });

  it('正确密码会生成绑定租户和角色的会话用户，并重置失败计数', async () => {
    const account = createAccount({
      passwordResetRequired: true,
      status: 'password_reset_required',
    });
    const repository = createRepository({
      findAccountByUsername: vi.fn(async () => account),
      findPrimaryTenantMembershipByUserId: vi.fn(async () => tenantAdminMembership),
    });
    const passwordHasher = {
      hash: vi.fn(),
      verify: vi.fn(async () => true),
    };
    const service = createAuthAccountService({
      repository,
      passwordHasher,
      now: () => now,
    });

    const result = await service.authenticatePasswordAccount({
      username: ' ChenLei_Admin ',
      plaintextPassword: 'Init#2026-Strong',
      scope: 'institution',
    });

    expect(repository.findAccountByUsername).toHaveBeenCalledWith('chenlei_admin');
    expect(passwordHasher.verify).toHaveBeenCalledWith('Init#2026-Strong', account.passwordHash);
    expect(repository.recordLoginSuccess).toHaveBeenCalledWith({
      accountId: 'auth-user-chenlei',
      loggedInAt: now,
      updatedBy: 'auth-user-chenlei',
      status: 'password_reset_required',
    });
    expect(result).toEqual({
      status: 'authenticated',
      passwordResetRequired: true,
      user: {
        id: 'auth-user-chenlei',
        username: 'chenlei_admin',
        name: '陈磊',
        role: 'tenant_admin',
        tenantId: 'tenant-zhengpu',
      },
    });
  });

  it('错误密码会累计失败次数，达到阈值时锁定账号但不暴露具体敏感信息', async () => {
    const account = createAccount({ failedLoginCount: 4 });
    const repository = createRepository({
      findAccountByUsername: vi.fn(async () => account),
    });
    const passwordHasher = {
      hash: vi.fn(),
      verify: vi.fn(async () => false),
    };
    const service = createAuthAccountService({
      repository,
      passwordHasher,
      now: () => now,
    });

    const result = await service.authenticatePasswordAccount({
      username: 'chenlei_admin',
      plaintextPassword: 'wrong-password',
      scope: 'institution',
    });

    expect(repository.recordLoginFailure).toHaveBeenCalledWith({
      accountId: 'auth-user-chenlei',
      failedAt: now,
      updatedBy: 'auth-user-chenlei',
      failedLoginCount: 5,
      status: 'locked',
      lockedUntil: new Date('2026-06-25T08:15:00.000Z'),
    });
    expect(result).toEqual({
      status: 'rejected',
      reason: 'invalid_credentials',
    });
    expect(JSON.stringify(result)).not.toContain('wrong-password');
    expect(JSON.stringify(result)).not.toContain('scrypt$');
  });

  it('停用账号不会进入密码校验，也不会写入登录成功', async () => {
    const repository = createRepository({
      findAccountByUsername: vi.fn(async () => createAccount({ status: 'disabled' })),
    });
    const passwordHasher = {
      hash: vi.fn(),
      verify: vi.fn(async () => true),
    };
    const service = createAuthAccountService({
      repository,
      passwordHasher,
      now: () => now,
    });

    const result = await service.authenticatePasswordAccount({
      username: 'chenlei_admin',
      plaintextPassword: 'Init#2026-Strong',
      scope: 'institution',
    });

    expect(passwordHasher.verify).not.toHaveBeenCalled();
    expect(repository.recordLoginSuccess).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'rejected',
      reason: 'account_disabled',
    });
  });

  it('重置密码只写入新哈希和重置状态，不返回明文', async () => {
    const repository = createRepository();
    const passwordHasher = {
      hash: vi.fn(async () => 'scrypt$16384$8$1$newSalt$newHash'),
      verify: vi.fn(),
    };
    const service = createAuthAccountService({
      repository,
      passwordHasher,
      now: () => now,
    });

    const result = await service.resetPassword({
      accountId: 'auth-user-chenlei',
      plaintextPassword: 'New#2026-Strong',
      actorId: 'platform-admin',
    });

    expect(repository.updatePassword).toHaveBeenCalledWith({
      accountId: 'auth-user-chenlei',
      passwordHash: 'scrypt$16384$8$1$newSalt$newHash',
      passwordUpdatedAt: now,
      passwordResetRequired: true,
      status: 'password_reset_required',
      updatedAt: now,
      updatedBy: 'platform-admin',
    });
    expect(result).toEqual({ status: 'password_reset_required' });
    expect(JSON.stringify(result)).not.toContain('New#2026-Strong');
  });

  it('重置密码拒绝空白密码且不写入 repository', async () => {
    const repository = createRepository();
    const passwordHasher = {
      hash: vi.fn(async () => 'scrypt$16384$8$1$newSalt$newHash'),
      verify: vi.fn(),
    };
    const service = createAuthAccountService({
      repository,
      passwordHasher,
      now: () => now,
    });

    const result = await service.resetPassword({
      accountId: 'auth-user-chenlei',
      plaintextPassword: '  ',
      actorId: 'platform-admin',
    });

    expect(result).toEqual({
      status: 'rejected',
      reason: 'password_required',
    });
    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(repository.updatePassword).not.toHaveBeenCalled();
  });
});
