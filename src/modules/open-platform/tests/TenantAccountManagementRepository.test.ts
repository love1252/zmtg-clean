import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTenantAccountManagementRepository } from '@/modules/open-platform/server/tenant-account-management-repository';
import type { TenantDatabase } from '@/server/db/client';
import {
  authUsers,
  auditEvents,
  tenantContacts,
  tenantMembers,
  tenantCommercialRecords,
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

const now = new Date('2026-06-25T10:00:00.000Z');

const accountRow = {
  id: 'auth-user-zhengpu-admin',
  username: 'zhengpu_admin',
  displayName: '陈磊',
  phone: '13985162273',
  email: null,
  passwordHash: 'scrypt$old',
  passwordUpdatedAt: new Date('2026-06-25T08:00:00.000Z'),
  passwordResetRequired: true,
  status: 'password_reset_required',
  lastLoginAt: null,
  failedLoginCount: 0,
  lockedUntil: null,
  createdBy: 'demo-user-platform',
  updatedBy: 'demo-user-platform',
  createdAt: new Date('2026-06-25T08:00:00.000Z'),
  updatedAt: new Date('2026-06-25T08:00:00.000Z'),
};

const memberRow = {
  id: 'tenant-member-zhengpu-admin',
  tenantId: 'tenant-zhengpu',
  userId: 'auth-user-zhengpu-admin',
  role: 'tenant_admin',
  displayName: '陈磊',
  createdAt: new Date('2026-06-25T08:00:00.000Z'),
  updatedAt: new Date('2026-06-25T08:00:00.000Z'),
};

const contactRow = {
  id: 'tenant-contact-zhengpu',
  tenantId: 'tenant-zhengpu',
  contactName: '陈磊',
  contactPhone: '13985162773',
  contactEmail: 'contact@example.com',
  initialAdminUserId: 'auth-user-zhengpu-admin',
  createdBy: 'demo-user-platform',
  updatedBy: 'demo-user-platform',
  createdAt: new Date('2026-06-25T08:00:00.000Z'),
  updatedAt: new Date('2026-06-25T08:00:00.000Z'),
};

function createSelectChain(rows: unknown[]) {
  const limit = vi.fn(async () => rows);
  const where = vi.fn(() => ({ limit }));
  const innerJoinMember = vi.fn(() => ({ where }));
  const innerJoinAccount = vi.fn(() => ({ innerJoin: innerJoinMember }));
  const from = vi.fn(() => ({ innerJoin: innerJoinAccount }));

  return {
    chain: { from },
    from,
    innerJoinAccount,
    innerJoinMember,
    limit,
    where,
  };
}

function createDatabase(input: { selectRows?: unknown[][] } = {}) {
  const allSelectChains = (input.selectRows ?? []).map(createSelectChain);
  const selectChains = [...allSelectChains];
  const inserted: Array<{ table: unknown; values: unknown }> = [];
  const updated: Array<{ table: unknown; values: unknown; where: unknown }> = [];
  const transactionInsert = vi.fn((table: unknown) => ({
    values: vi.fn(async (values: unknown) => {
      inserted.push({ table, values });
    }),
  }));
  const transactionUpdate = vi.fn((table: unknown) => ({
    set: vi.fn((values: unknown) => ({
      where: vi.fn(async (where: unknown) => {
        updated.push({ table, values, where });
      }),
    })),
  }));
  const transaction = vi.fn(async (callback: (database: unknown) => Promise<unknown>) =>
    callback({ insert: transactionInsert, update: transactionUpdate }),
  );
  const select = vi.fn(() => {
    const next = selectChains.shift();
    if (!next) throw new Error('没有配置更多 select chain');
    return next.chain;
  });

  return {
    database: { select, transaction } as unknown as TenantDatabase,
    inserted,
    select,
    selectChains: allSelectChains,
    transaction,
    transactionInsert,
    transactionUpdate,
    updated,
  };
}

beforeEach(() => {
  andMock.mockClear();
  eqMock.mockClear();
});

describe('租户初始管理员账号管理 repository', () => {
  it('通过 tenant_contacts 找到初始管理员账号和租户成员关系', async () => {
    const query = createDatabase({
      selectRows: [[{ account: accountRow, contact: contactRow, member: memberRow }]],
    });

    const result = await createTenantAccountManagementRepository(
      query.database,
    ).findInitialAdminAccountByTenantId('tenant-zhengpu');

    expect(query.selectChains[0].from).toHaveBeenCalledWith(tenantContacts);
    expect(query.selectChains[0].innerJoinAccount).toHaveBeenCalledWith(authUsers, {
      column: authUsers.id,
      operator: 'eq',
      value: tenantContacts.initialAdminUserId,
    });
    expect(query.selectChains[0].innerJoinMember).toHaveBeenCalledWith(tenantMembers, {
      conditions: [
        { column: tenantMembers.tenantId, operator: 'eq', value: tenantContacts.tenantId },
        { column: tenantMembers.userId, operator: 'eq', value: authUsers.id },
      ],
      operator: 'and',
    });
    expect(query.selectChains[0].where).toHaveBeenCalledWith({
      column: tenantContacts.tenantId,
      operator: 'eq',
      value: 'tenant-zhengpu',
    });
    expect(query.selectChains[0].limit).toHaveBeenCalledWith(1);
    expect(result).toEqual({
      tenantId: 'tenant-zhengpu',
      accountId: 'auth-user-zhengpu-admin',
      tenantMemberId: 'tenant-member-zhengpu-admin',
      username: 'zhengpu_admin',
      displayName: '陈磊',
      role: 'tenant_admin',
      status: 'password_reset_required',
      passwordResetRequired: true,
    });
  });

  it('事务内重置密码并写入账号审计事件，返回低敏账号结果', async () => {
    const query = createDatabase();

    const result = await createTenantAccountManagementRepository(
      query.database,
    ).applyTenantAccountOperation({
      action: 'reset_password',
      account: {
        tenantId: 'tenant-zhengpu',
        accountId: 'auth-user-zhengpu-admin',
        tenantMemberId: 'tenant-member-zhengpu-admin',
        username: 'zhengpu_admin',
        displayName: '陈磊',
        role: 'tenant_admin',
        status: 'password_reset_required',
        passwordResetRequired: true,
      },
      nextStatus: 'password_reset_required',
      passwordResetRequired: true,
      passwordHash: 'scrypt$16384$8$1$newSalt$newHash',
      passwordUpdatedAt: now,
      lockedUntil: null,
      updatedAt: now,
      updatedBy: 'demo-user-platform',
      auditEvent: {
        eventId: 'audit-event-fixed',
        actorId: 'demo-user-platform',
        actorRole: 'platform_admin',
        tenantId: 'tenant-zhengpu',
        scope: 'platform',
        resource: 'tenant_member',
        resourceId: 'tenant-member-zhengpu-admin',
        action: 'manage_credentials',
        result: 'transitioned',
        reason: 'tenant_account_password_reset',
        occurredAt: now.toISOString(),
        source: 'server_session',
      },
    });

    expect(query.transaction).toHaveBeenCalledTimes(1);
    expect(query.updated).toEqual([
      {
        table: authUsers,
        values: {
          failedLoginCount: 0,
          lockedUntil: null,
          passwordHash: 'scrypt$16384$8$1$newSalt$newHash',
          passwordResetRequired: true,
          passwordUpdatedAt: now,
          status: 'password_reset_required',
          updatedAt: now,
          updatedBy: 'demo-user-platform',
        },
        where: {
          column: authUsers.id,
          operator: 'eq',
          value: 'auth-user-zhengpu-admin',
        },
      },
    ]);
    expect(query.inserted).toEqual([
      {
        table: auditEvents,
        values: expect.objectContaining({
          eventId: 'audit-event-fixed',
          resource: 'tenant_member',
          resourceId: 'tenant-member-zhengpu-admin',
          reason: 'tenant_account_password_reset',
        }),
      },
      {
        table: tenantCommercialRecords,
        values: expect.objectContaining({
          recordType: 'account_status_change',
          displayCode: '账号重置密码-zhengpu_admin',
        }),
      },
    ]);
    expect(result).toEqual({
      status: 'account_updated',
      action: 'reset_password',
      auditEventId: 'audit-event-fixed',
      account: {
        tenantId: 'tenant-zhengpu',
        accountId: 'auth-user-zhengpu-admin',
        tenantMemberId: 'tenant-member-zhengpu-admin',
        username: 'zhengpu_admin',
        displayName: '陈磊',
        role: 'tenant_admin',
        status: 'password_reset_required',
        passwordResetRequired: true,
        updatedAt: '2026-06-25T10:00:00.000Z',
      },
    });
    expect(JSON.stringify([result, query.inserted.map((item) => item.values)])).not.toMatch(
      /New#2026-Strong|passwordHash|scrypt\$|requestBody|select \*/i,
    );
  });

  it('事务内停用账号只更新状态并写入停用审计事件', async () => {
    const query = createDatabase();

    await createTenantAccountManagementRepository(query.database).applyTenantAccountOperation({
      action: 'disable',
      account: {
        tenantId: 'tenant-zhengpu',
        accountId: 'auth-user-zhengpu-admin',
        tenantMemberId: 'tenant-member-zhengpu-admin',
        username: 'zhengpu_admin',
        displayName: '陈磊',
        role: 'tenant_admin',
        status: 'active',
        passwordResetRequired: false,
      },
      nextStatus: 'disabled',
      passwordResetRequired: false,
      lockedUntil: null,
      updatedAt: now,
      updatedBy: 'demo-user-platform',
      auditEvent: {
        eventId: 'audit-event-disabled',
        actorId: 'demo-user-platform',
        actorRole: 'platform_admin',
        tenantId: 'tenant-zhengpu',
        scope: 'platform',
        resource: 'tenant_member',
        resourceId: 'tenant-member-zhengpu-admin',
        action: 'manage_status',
        result: 'transitioned',
        reason: 'tenant_account_disabled',
        occurredAt: now.toISOString(),
        source: 'server_session',
      },
    });

    expect(query.updated[0].values).toEqual({
      lockedUntil: null,
      status: 'disabled',
      updatedAt: now,
      updatedBy: 'demo-user-platform',
    });
    expect(query.inserted[0].values).toEqual(
      expect.objectContaining({
        eventId: 'audit-event-disabled',
        reason: 'tenant_account_disabled',
      }),
    );
  });
});
