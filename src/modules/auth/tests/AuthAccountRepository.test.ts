import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { AuthAccountRecord } from '@/modules/auth/domain/auth-account';
import {
  consumeFormalServerSessionUserSnapshotV1,
  createAuthAccountRepository,
  isFormalServerSessionUserSnapshotV1,
  type FormalServerSessionUserSnapshotV1,
} from '@/modules/auth/server/auth-account-repository';
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

const institutionMembershipFactRow = {
  accountId: 'auth-user-chenlei',
  accountStatus: 'active',
  accountPasswordResetRequired: false,
  accountLockedUntil: null,
  membershipId: 'tenant-member-chenlei',
  membershipTenantId: 'tenant-zhengpu',
  membershipUserId: 'auth-user-chenlei',
  membershipRole: 'tenant_admin',
  membershipUpdatedAt: new Date('2026-06-25T07:00:00.000Z'),
  bindingId: 'auth-binding-chenlei',
  bindingAccountId: 'auth-user-chenlei',
  bindingTenantId: 'tenant-zhengpu',
  bindingInstitutionId: 'institution-zhengpu',
  bindingStatus: 'active',
  bindingSource: 'manual_admin',
  bindingAssignedAt: new Date('2026-06-25T07:00:00.000Z'),
  bindingExpiresAt: null,
  bindingRevokedAt: null,
  bindingVersion: 1,
};

const formalSessionUserRow = {
  accountId: 'auth-user-chenlei',
  accountUsername: 'chenlei_admin',
  accountDisplayName: '账号陈磊',
  accountStatus: 'active',
  accountPasswordResetRequired: false,
  accountLockedUntil: null,
  membershipTenantId: 'tenant-zhengpu',
  membershipUserId: 'auth-user-chenlei',
  membershipRole: 'tenant_operator',
  membershipDisplayName: '机构陈磊',
  bindingId: 'auth-binding-chenlei',
  bindingAccountId: 'auth-user-chenlei',
  bindingTenantId: 'tenant-zhengpu',
  bindingInstitutionId: 'institution-zhengpu',
  bindingStatus: 'active',
  bindingSource: 'manual_admin',
  bindingAssignedAt: new Date('2026-06-25T07:00:00.000Z'),
  bindingExpiresAt: null,
  bindingRevokedAt: null,
  bindingVersion: 1,
};

function createSelectChain(rows: unknown[]) {
  const limit = vi.fn(async () => rows);
  const chain = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    limit,
    where: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);

  return {
    chain,
    from: chain.from,
    innerJoin: chain.innerJoin,
    leftJoin: chain.leftJoin,
    limit,
    where: chain.where,
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

  it('用一次低敏 JOIN 查询读取账号、租户成员和 active 机构绑定事实', async () => {
    const query = createDatabase({
      selectRows: [[institutionMembershipFactRow]],
    });

    const result = await createAuthAccountRepository(
      query.database,
    ).findCurrentInstitutionMembershipFacts({
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
    });

    expect(query.select).toHaveBeenCalledTimes(1);
    expect(query.select).toHaveBeenCalledWith({
      accountId: authUsers.id,
      accountStatus: authUsers.status,
      accountPasswordResetRequired: authUsers.passwordResetRequired,
      accountLockedUntil: authUsers.lockedUntil,
      membershipId: tenantMembers.id,
      membershipTenantId: tenantMembers.tenantId,
      membershipUserId: tenantMembers.userId,
      membershipRole: tenantMembers.role,
      membershipUpdatedAt: tenantMembers.updatedAt,
      bindingId: authAccountInstitutionBindings.id,
      bindingAccountId: authAccountInstitutionBindings.accountId,
      bindingTenantId: authAccountInstitutionBindings.tenantId,
      bindingInstitutionId: authAccountInstitutionBindings.institutionId,
      bindingStatus: authAccountInstitutionBindings.status,
      bindingSource: authAccountInstitutionBindings.source,
      bindingAssignedAt: authAccountInstitutionBindings.assignedAt,
      bindingExpiresAt: authAccountInstitutionBindings.expiresAt,
      bindingRevokedAt: authAccountInstitutionBindings.revokedAt,
      bindingVersion: authAccountInstitutionBindings.version,
    });
    expect(query.selectChains[0].from).toHaveBeenCalledWith(authUsers);
    expect(query.selectChains[0].innerJoin).toHaveBeenCalledWith(
      tenantMembers,
      {
        operator: 'and',
        conditions: [
          {
            column: tenantMembers.userId,
            operator: 'eq',
            value: authUsers.id,
          },
          {
            column: tenantMembers.tenantId,
            operator: 'eq',
            value: 'tenant-zhengpu',
          },
        ],
      },
    );
    expect(query.selectChains[0].leftJoin).toHaveBeenCalledWith(
      authAccountInstitutionBindings,
      {
        operator: 'and',
        conditions: [
          {
            column: authAccountInstitutionBindings.accountId,
            operator: 'eq',
            value: authUsers.id,
          },
          {
            column: authAccountInstitutionBindings.tenantId,
            operator: 'eq',
            value: tenantMembers.tenantId,
          },
          {
            column: authAccountInstitutionBindings.status,
            operator: 'eq',
            value: 'active',
          },
        ],
      },
    );
    expect(query.selectChains[0].where).toHaveBeenCalledWith({
      column: authUsers.id,
      operator: 'eq',
      value: 'auth-user-chenlei',
    });
    expect(query.selectChains[0].limit).toHaveBeenCalledWith(2);
    expect(result).toEqual([institutionMembershipFactRow]);
  });

  it('按已验证的账号、租户、机构三元组单次查询并从数据库生成低敏会话用户', async () => {
    type LookupInput = Parameters<
      ReturnType<typeof createAuthAccountRepository>['findCurrentFormalSessionUser']
    >[0];
    expectTypeOf<keyof LookupInput>().toEqualTypeOf<
      'accountId' | 'tenantId' | 'institutionId'
    >();
    const query = createDatabase({
      selectRows: [[formalSessionUserRow]],
    });

    const result = await createAuthAccountRepository(
      query.database,
    ).findCurrentFormalSessionUser({
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
    });

    expect(query.select).toHaveBeenCalledTimes(1);
    expect(query.select).toHaveBeenCalledWith({
      accountId: authUsers.id,
      accountUsername: authUsers.username,
      accountDisplayName: authUsers.displayName,
      accountStatus: authUsers.status,
      accountPasswordResetRequired: authUsers.passwordResetRequired,
      accountLockedUntil: authUsers.lockedUntil,
      membershipTenantId: tenantMembers.tenantId,
      membershipUserId: tenantMembers.userId,
      membershipRole: tenantMembers.role,
      membershipDisplayName: tenantMembers.displayName,
      bindingId: authAccountInstitutionBindings.id,
      bindingAccountId: authAccountInstitutionBindings.accountId,
      bindingTenantId: authAccountInstitutionBindings.tenantId,
      bindingInstitutionId: authAccountInstitutionBindings.institutionId,
      bindingStatus: authAccountInstitutionBindings.status,
      bindingSource: authAccountInstitutionBindings.source,
      bindingAssignedAt: authAccountInstitutionBindings.assignedAt,
      bindingExpiresAt: authAccountInstitutionBindings.expiresAt,
      bindingRevokedAt: authAccountInstitutionBindings.revokedAt,
      bindingVersion: authAccountInstitutionBindings.version,
    });
    expect(query.selectChains[0].from).toHaveBeenCalledWith(authUsers);
    expect(query.selectChains[0].innerJoin).toHaveBeenNthCalledWith(
      1,
      tenantMembers,
      {
        operator: 'and',
        conditions: [
          {
            column: tenantMembers.userId,
            operator: 'eq',
            value: authUsers.id,
          },
          {
            column: tenantMembers.tenantId,
            operator: 'eq',
            value: 'tenant-zhengpu',
          },
        ],
      },
    );
    expect(query.selectChains[0].innerJoin).toHaveBeenNthCalledWith(
      2,
      authAccountInstitutionBindings,
      {
        operator: 'and',
        conditions: [
          {
            column: authAccountInstitutionBindings.accountId,
            operator: 'eq',
            value: authUsers.id,
          },
          {
            column: authAccountInstitutionBindings.tenantId,
            operator: 'eq',
            value: tenantMembers.tenantId,
          },
          {
            column: authAccountInstitutionBindings.institutionId,
            operator: 'eq',
            value: 'institution-zhengpu',
          },
        ],
      },
    );
    expect(query.selectChains[0].where).toHaveBeenCalledWith({
      column: authUsers.id,
      operator: 'eq',
      value: 'auth-user-chenlei',
    });
    expect(query.selectChains[0].limit).toHaveBeenCalledWith(2);
    expectTypeOf(result).toEqualTypeOf<FormalServerSessionUserSnapshotV1 | null>();
    expect(result).not.toBeNull();
    if (!result) throw new Error('expected formal session user snapshot');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.keys(result)).toEqual([]);
    expect(isFormalServerSessionUserSnapshotV1(result)).toBe(true);
    expect(consumeFormalServerSessionUserSnapshotV1(result)).toEqual({
      id: 'auth-user-chenlei',
      username: 'chenlei_admin',
      name: '机构陈磊',
      role: 'tenant_operator',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
    });
    expect(consumeFormalServerSessionUserSnapshotV1(result)).toBeNull();
    expect(isFormalServerSessionUserSnapshotV1(result)).toBe(false);
  });

  it('拒绝重置密码、锁定、撤销、过期、多行和作用域不一致的会话账号快照', async () => {
    const cases: unknown[][] = [
      [{ ...formalSessionUserRow, accountPasswordResetRequired: true }],
      [{ ...formalSessionUserRow, accountStatus: 'locked' }],
      [{ ...formalSessionUserRow, accountLockedUntil: new Date('2099-01-01T00:00:00.000Z') }],
      [{ ...formalSessionUserRow, membershipRole: 'platform_admin' }],
      [{ ...formalSessionUserRow, bindingStatus: 'revoked', bindingRevokedAt: new Date() }],
      [{ ...formalSessionUserRow, bindingSource: 'migration_placeholder' }],
      [{ ...formalSessionUserRow, bindingSource: 'unknown_source' }],
      [{ ...formalSessionUserRow, bindingAssignedAt: new Date('2099-01-01T00:00:00.000Z') }],
      [{ ...formalSessionUserRow, bindingAssignedAt: new Date(Number.NaN) }],
      [{ ...formalSessionUserRow, bindingExpiresAt: new Date('2000-01-01T00:00:00.000Z') }],
      [{ ...formalSessionUserRow, bindingExpiresAt: new Date(Number.NaN) }],
      [{ ...formalSessionUserRow, bindingVersion: 0 }],
      [{ ...formalSessionUserRow, bindingVersion: 1.5 }],
      [formalSessionUserRow, { ...formalSessionUserRow }],
      [{ ...formalSessionUserRow, membershipTenantId: 'tenant-other' }],
      [{ ...formalSessionUserRow, bindingInstitutionId: 'institution-other' }],
      [{ ...formalSessionUserRow, bindingId: 'unsafe/binding' }],
      [{ ...formalSessionUserRow, extra: 'not-an-exact-row' }],
    ];

    for (const rows of cases) {
      const query = createDatabase({ selectRows: [rows] });
      await expect(
        createAuthAccountRepository(query.database).findCurrentFormalSessionUser({
          accountId: 'auth-user-chenlei',
          tenantId: 'tenant-zhengpu',
          institutionId: 'institution-zhengpu',
        }),
      ).resolves.toBeNull();
      expect(query.select).toHaveBeenCalledTimes(1);
    }
  });

  it('先安全快照和校验查询三元组，非法输入不读取数据库或 accessor/proxy', async () => {
    let getterReads = 0;
    let proxyTraps = 0;
    const accessor = {
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
    };
    Object.defineProperty(accessor, 'accountId', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('query getter must not run');
      },
    });
    const proxy = new Proxy({
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
    }, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('query proxy trap must not run');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('query proxy trap must not run');
      },
    });
    const nullPrototype = Object.assign(Object.create(null) as object, {
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
    });
    for (const input of [
      { accountId: 'unsafe/id', tenantId: 'tenant-zhengpu', institutionId: 'institution-zhengpu' },
      { accountId: 'auth-user-chenlei', tenantId: 'tenant-zhengpu', institutionId: 'institution-zhengpu', extra: true },
      accessor,
      proxy,
      nullPrototype,
    ]) {
      const query = createDatabase();
      await expect(
        createAuthAccountRepository(query.database).findCurrentFormalSessionUser(
          input as never,
        ),
      ).resolves.toBeNull();
      expect(query.select).not.toHaveBeenCalled();
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('拒绝 accessor、Proxy、null-prototype 和非精确数据库行且不发布 handle', async () => {
    let getterReads = 0;
    let proxyTraps = 0;
    const accessor = { ...formalSessionUserRow };
    Object.defineProperty(accessor, 'accountId', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('row getter must not run');
      },
    });
    const proxy = new Proxy({ ...formalSessionUserRow }, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('row proxy trap must not run');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('row proxy trap must not run');
      },
    });
    const nullPrototype = Object.assign(
      Object.create(null) as object,
      formalSessionUserRow,
    );
    for (const row of [accessor, proxy, nullPrototype]) {
      const query = createDatabase({ selectRows: [[row]] });
      const result = await createAuthAccountRepository(
        query.database,
      ).findCurrentFormalSessionUser({
        accountId: 'auth-user-chenlei',
        tenantId: 'tenant-zhengpu',
        institutionId: 'institution-zhengpu',
      });
      expect(result).toBeNull();
      expect(isFormalServerSessionUserSnapshotV1(result)).toBe(false);
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('只认可 genuine handle，普通、clone、null-prototype、accessor、proxy 和 revoked 均零读取拒绝', async () => {
    const query = createDatabase({ selectRows: [[formalSessionUserRow], [formalSessionUserRow]] });
    const repository = createAuthAccountRepository(query.database);
    const genuine = await repository.findCurrentFormalSessionUser({
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
    });
    const revoked = await repository.findCurrentFormalSessionUser({
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
    });
    if (!genuine || !revoked) throw new Error('expected genuine snapshots');
    expect(consumeFormalServerSessionUserSnapshotV1(revoked)).not.toBeNull();
    let getterReads = 0;
    let proxyTraps = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, 'user', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('handle getter must not run');
      },
    });
    const proxy = new Proxy(genuine, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('handle proxy trap must not run');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('handle proxy trap must not run');
      },
    });
    for (const value of [
      {},
      { ...genuine },
      Object.create(null) as object,
      Object.create(genuine) as object,
      accessor,
      proxy,
      revoked,
    ]) {
      expect(isFormalServerSessionUserSnapshotV1(value)).toBe(false);
      expect(consumeFormalServerSessionUserSnapshotV1(value)).toBeNull();
    }
    expect(isFormalServerSessionUserSnapshotV1(genuine)).toBe(true);
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('并发双消费只有一次得到冻结 session user', async () => {
    const query = createDatabase({ selectRows: [[formalSessionUserRow]] });
    const snapshot = await createAuthAccountRepository(
      query.database,
    ).findCurrentFormalSessionUser({
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
    });
    if (!snapshot) throw new Error('expected formal session user snapshot');
    const results = await Promise.all([
      Promise.resolve().then(() => consumeFormalServerSessionUserSnapshotV1(snapshot)),
      Promise.resolve().then(() => consumeFormalServerSessionUserSnapshotV1(snapshot)),
    ]);
    const users = results.filter((value) => value !== null);
    expect(users).toHaveLength(1);
    expect(Object.isFrozen(users[0])).toBe(true);
    expect(results.filter((value) => value === null)).toHaveLength(1);
    expect(isFormalServerSessionUserSnapshotV1(snapshot)).toBe(false);
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
