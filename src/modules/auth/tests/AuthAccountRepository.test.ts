import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthAccountRecord } from '@/modules/auth/domain/auth-account';
import { createAuthAccountRepository } from '@/modules/auth/server/auth-account-repository';
import type { TenantDatabase } from '@/server/db/client';
import {
  authAccountInstitutionBindings,
  authUsers,
  tenantMembers,
} from '@/server/db/schema';

const andMock = vi.hoisted(() =>
  vi.fn((...conditions: unknown[]) => ({
    conditions,
    operator: 'and',
  })),
);

const eqMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({
    column,
    operator: 'eq',
    value,
  })),
);

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: andMock,
    eq: eqMock,
  };
});

const accountRow: AuthAccountRecord = {
  id: 'auth-user-chenlei',
  username: 'chenlei_admin',
  displayName: '陈磊',
  phone: '13985162273',
  email: 'chenlei@example.com',
  passwordHash: 'scrypt$16384$8$1$salt$hash',
  passwordUpdatedAt: new Date('2026-06-25T07:00:00.000Z'),
  passwordResetRequired: true,
  status: 'password_reset_required',
  lastLoginAt: null,
  failedLoginCount: 0,
  lockedUntil: null,
  createdBy: 'platform-admin',
  updatedBy: 'platform-admin',
  createdAt: new Date('2026-06-25T07:00:00.000Z'),
  updatedAt: new Date('2026-06-25T07:00:00.000Z'),
};

const membershipRow = {
  id: 'tenant-member-chenlei',
  tenantId: 'tenant-zhengpu',
  userId: 'auth-user-chenlei',
  role: 'tenant_admin',
  displayName: '陈磊',
  createdAt: new Date('2026-06-25T07:00:00.000Z'),
  updatedAt: new Date('2026-06-25T07:00:00.000Z'),
};

const institutionBindingRow = {
  id: 'auth-binding-chenlei',
  accountId: 'auth-user-chenlei',
  tenantId: 'tenant-zhengpu',
  institutionId: 'institution-zhengpu',
  status: 'active',
  source: 'manual_admin',
  assignedBy: 'platform-admin',
  assignedAt: new Date('2026-06-25T07:00:00.000Z'),
  expiresAt: null,
  revokedAt: null,
  version: 1,
  createdAt: new Date('2026-06-25T07:00:00.000Z'),
  updatedAt: new Date('2026-06-25T07:00:00.000Z'),
};

function createSelectChain(rows: unknown[]) {
  const limit = vi.fn(async () => rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));

  return {
    chain: { from },
    from,
    limit,
    where,
  };
}

function createInsertChain(rows: unknown[]) {
  const returning = vi.fn(async () => rows);
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn((table: unknown) => ({ values }));

  return {
    insert,
    returning,
    values,
  };
}

function createUpdateChain() {
  const where = vi.fn(async () => undefined);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn((table: unknown) => ({ set }));

  return {
    set,
    update,
    where,
  };
}

function createDatabase(input: {
  insertRows?: unknown[];
  selectRows?: unknown[][];
} = {}) {
  const allSelectChains = (input.selectRows ?? []).map(createSelectChain);
  const selectChains = [...allSelectChains];
  const insertChain = createInsertChain(input.insertRows ?? []);
  const updateChain = createUpdateChain();
  const select = vi.fn(() => {
    const next = selectChains.shift();
    if (!next) throw new Error('没有配置更多 select chain');
    return next.chain;
  });

  return {
    database: {
      insert: insertChain.insert,
      select,
      update: updateChain.update,
    } as unknown as TenantDatabase,
    insertChain,
    select,
    selectChains: allSelectChains,
    updateChain,
  };
}

beforeEach(() => {
  andMock.mockClear();
  eqMock.mockClear();
});

describe('正式账号 repository', () => {
  it('按标准化账号查询 auth_users 并返回完整内部账号记录', async () => {
    const query = createDatabase({
      selectRows: [[accountRow]],
    });

    const result = await createAuthAccountRepository(query.database).findAccountByUsername(
      'chenlei_admin',
    );

    expect(query.selectChains[0].from).toHaveBeenCalledWith(authUsers);
    expect(query.selectChains[0].where).toHaveBeenCalledWith({
      column: authUsers.username,
      operator: 'eq',
      value: 'chenlei_admin',
    });
    expect(query.selectChains[0].limit).toHaveBeenCalledWith(1);
    expect(result).toEqual(accountRow);
  });

  it('创建账号时写入 auth_users 并通过 returning 取回落库记录', async () => {
    const query = createDatabase({
      insertRows: [accountRow],
    });

    const result = await createAuthAccountRepository(query.database).createAccount(accountRow);

    expect(query.insertChain.insert).toHaveBeenCalledWith(authUsers);
    expect(query.insertChain.values).toHaveBeenCalledWith(accountRow);
    expect(query.insertChain.returning).toHaveBeenCalledTimes(1);
    expect(result).toEqual(accountRow);
  });

  it('查询账号的租户成员关系用于生成登录会话', async () => {
    const query = createDatabase({
      selectRows: [[membershipRow]],
    });

    const result = await createAuthAccountRepository(query.database).findPrimaryTenantMembershipByUserId(
      'auth-user-chenlei',
    );

    expect(query.selectChains[0].from).toHaveBeenCalledWith(tenantMembers);
    expect(query.selectChains[0].where).toHaveBeenCalledWith({
      column: tenantMembers.userId,
      operator: 'eq',
      value: 'auth-user-chenlei',
    });
    expect(query.selectChains[0].limit).toHaveBeenCalledWith(1);
    expect(result).toEqual(membershipRow);
  });

  it('仅按账号、租户和 active 状态读取至多两个权威机构绑定', async () => {
    const query = createDatabase({
      selectRows: [[institutionBindingRow]],
    });

    const result = await createAuthAccountRepository(
      query.database,
    ).listActiveInstitutionBindingsByAccountAndTenant({
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
    });

    expect(query.selectChains[0].from).toHaveBeenCalledWith(
      authAccountInstitutionBindings,
    );
    expect(query.selectChains[0].where).toHaveBeenCalledWith({
      operator: 'and',
      conditions: [
        {
          column: authAccountInstitutionBindings.accountId,
          operator: 'eq',
          value: 'auth-user-chenlei',
        },
        {
          column: authAccountInstitutionBindings.tenantId,
          operator: 'eq',
          value: 'tenant-zhengpu',
        },
        {
          column: authAccountInstitutionBindings.status,
          operator: 'eq',
          value: 'active',
        },
      ],
    });
    expect(query.selectChains[0].limit).toHaveBeenCalledWith(2);
    expect(result).toEqual([institutionBindingRow]);
  });

  it('记录登录失败时只更新失败计数、锁定状态和更新时间', async () => {
    const query = createDatabase();
    const failedAt = new Date('2026-06-25T08:00:00.000Z');
    const lockedUntil = new Date('2026-06-25T08:15:00.000Z');

    await createAuthAccountRepository(query.database).recordLoginFailure({
      accountId: 'auth-user-chenlei',
      failedAt,
      updatedBy: 'auth-user-chenlei',
      failedLoginCount: 5,
      status: 'locked',
      lockedUntil,
    });

    expect(query.updateChain.update).toHaveBeenCalledWith(authUsers);
    expect(query.updateChain.set).toHaveBeenCalledWith({
      failedLoginCount: 5,
      lockedUntil,
      status: 'locked',
      updatedAt: failedAt,
      updatedBy: 'auth-user-chenlei',
    });
    expect(query.updateChain.where).toHaveBeenCalledWith({
      column: authUsers.id,
      operator: 'eq',
      value: 'auth-user-chenlei',
    });
  });

  it('记录登录成功时清空锁定与失败计数并保留重置状态', async () => {
    const query = createDatabase();
    const loggedInAt = new Date('2026-06-25T08:00:00.000Z');

    await createAuthAccountRepository(query.database).recordLoginSuccess({
      accountId: 'auth-user-chenlei',
      loggedInAt,
      updatedBy: 'auth-user-chenlei',
      status: 'password_reset_required',
    });

    expect(query.updateChain.set).toHaveBeenCalledWith({
      failedLoginCount: 0,
      lastLoginAt: loggedInAt,
      lockedUntil: null,
      status: 'password_reset_required',
      updatedAt: loggedInAt,
      updatedBy: 'auth-user-chenlei',
    });
  });
});
