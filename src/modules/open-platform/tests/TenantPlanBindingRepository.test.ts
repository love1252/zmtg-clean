import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTenantPlanBindingRepository,
  type TenantOnboardingMembershipCommands,
  type TenantOnboardingMembershipExternalTransactionPort,
} from '@/modules/open-platform/server/tenant-plan-binding-repository';
import type {
  TenantOnboardingMembershipIntent,
  TenantPlanBindingRepository,
} from '@/modules/open-platform/server/tenant-plan-binding-service';
import type { TenantDatabase } from '@/server/db/client';
import {
  authUsers,
  auditEvents,
  tenantContacts,
  tenantAuthorizationSnapshots,
  tenantPlanAssignments,
  tenantPlanVersions,
  tenantPlans,
  tenants,
  tenantCommercialRecords,
} from '@/server/db/schema';

const andMock = vi.hoisted(() =>
  vi.fn((...conditions: unknown[]) => ({
    conditions,
    operator: 'and',
  })),
);
const ascMock = vi.hoisted(() =>
  vi.fn((column: unknown) => ({
    column,
    direction: 'asc',
  })),
);
const descMock = vi.hoisted(() =>
  vi.fn((column: unknown) => ({
    column,
    direction: 'desc',
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
    asc: ascMock,
    desc: descMock,
    eq: eqMock,
  };
});

const planRow = {
  id: 'plan-professional',
  name: 'Professional 专业版',
  code: 'professional',
  description: '成长型机构套餐',
  status: 'active',
  createdAt: new Date('2026-06-23T00:00:00.000Z'),
  updatedAt: new Date('2026-06-23T00:00:00.000Z'),
};

const versionRow = {
  id: 'plan-version-professional-published',
  planId: 'plan-professional',
  versionCode: '2026-06-v1',
  status: 'published',
  displayName: 'Professional 专业版 2026-06',
  displayPrice: '¥2999/月',
  priceNote: '展示价格，人工确认口径',
  agentLimit: 3,
  seatLimit: 40,
  monthlyAiCallLimit: 300000,
  knowledgeStorageGb: 100,
  connectorEntitlementsJson: { connectors: ['企微', 'HIS'] },
  serviceEntitlementsJson: { services: ['上线培训'] },
  featureEntitlementsJson: { modules: ['客户管理', '知识库'] },
  quotaEntitlementsJson: { aiCallsPerMonth: 300000 },
  changeSummary: '首个正式版本',
  createdBy: 'demo-user-platform',
  updatedBy: 'demo-user-platform',
  publishedBy: 'demo-user-platform',
  publishedAt: new Date('2026-06-23T01:00:00.000Z'),
  retiredAt: null,
  createdAt: new Date('2026-06-23T00:00:00.000Z'),
  updatedAt: new Date('2026-06-23T01:00:00.000Z'),
};

function createSelectChain(rows: unknown[]) {
  const orderBy = vi.fn(async (..._orders: unknown[]) => rows);
  const limit = vi.fn(async (..._args: unknown[]) => rows);
  const where = vi.fn(() => ({ limit, orderBy }));
  const innerJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ innerJoin }));

  return {
    chain: { from },
    from,
    innerJoin,
    limit,
    orderBy,
    where,
  };
}

type WriteMutation = Readonly<{
  kind: 'insert' | 'membership-current' | 'membership-transition';
  table?: unknown;
  values?: unknown;
}>;

function tableLabel(table: unknown): string {
  const labels = new Map<unknown, string>([
    [tenants, 'tenants'],
    [authUsers, 'authUsers'],
    [tenantContacts, 'tenantContacts'],
    [tenantPlanAssignments, 'tenantPlanAssignments'],
    [tenantAuthorizationSnapshots, 'tenantAuthorizationSnapshots'],
    [auditEvents, 'auditEvents'],
    [tenantCommercialRecords, 'tenantCommercialRecords'],
  ]);
  return labels.get(table) ?? 'unknown';
}

function createDatabase(input: {
  selectRows?: unknown[][];
  failOnTable?: unknown;
  failure?: Error;
} = {}) {
  const allSelectChains = (input.selectRows ?? []).map(createSelectChain);
  const selectChains = [...allSelectChains];
  const attempted: WriteMutation[] = [];
  const committed: WriteMutation[] = [];
  const events: string[] = [];
  const transactionDatabases: object[] = [];
  const stagedByTransaction = new WeakMap<object, WriteMutation[]>();
  const transaction = vi.fn(async (
    callback: (database: unknown) => Promise<unknown>,
    _options: unknown,
  ) => {
    const staged: WriteMutation[] = [];
    const transactionDatabase = {
      insert: vi.fn((table: unknown) => ({
        values: vi.fn(async (values: unknown) => {
          const mutation = { kind: 'insert', table, values } as const;
          attempted.push(mutation);
          events.push(`insert:${tableLabel(table)}`);
          if (table === input.failOnTable) {
            throw input.failure ?? new Error('transaction insert failed');
          }
          staged.push(mutation);
        }),
      })),
    };
    transactionDatabases.push(transactionDatabase);
    stagedByTransaction.set(transactionDatabase, staged);
    events.push('begin');
    try {
      const result = await callback(transactionDatabase);
      committed.push(...staged);
      events.push('commit');
      return result;
    } catch (error) {
      events.push('rollback');
      throw error;
    } finally {
      stagedByTransaction.delete(transactionDatabase);
    }
  });
  const select = vi.fn(() => {
    const next = selectChains.shift();
    if (!next) throw new Error('没有配置更多 select chain');
    return next.chain;
  });

  return {
    database: { select, transaction } as unknown as TenantDatabase,
    attempted,
    committed,
    events,
    select,
    selectChains: allSelectChains,
    stageExternal(
      transactionDatabase: TenantDatabase,
      mutation: WriteMutation,
    ) {
      const staged = stagedByTransaction.get(transactionDatabase as object);
      if (!staged) throw new Error('external mutation escaped transaction');
      attempted.push(mutation);
      staged.push(mutation);
    },
    transaction,
    transactionDatabases,
  };
}

function createMembershipExternalTransaction(
  databaseState: ReturnType<typeof createDatabase>,
  input: Readonly<{ failureAfterCurrent?: Error }> = {},
) {
  const createMembership = vi.fn(async (
    intent: TenantOnboardingMembershipIntent,
  ) => {
    const transactionDatabase = activeTransaction;
    if (!transactionDatabase) throw new Error('missing active transaction');
    databaseState.events.push('membership-current');
    databaseState.stageExternal(transactionDatabase, {
      kind: 'membership-current',
      values: intent,
    });
    if (input.failureAfterCurrent) throw input.failureAfterCurrent;
    databaseState.events.push('membership-transition');
    databaseState.stageExternal(transactionDatabase, {
      kind: 'membership-transition',
      values: { membershipId: intent.membershipId },
    });
  });
  let activeTransaction: TenantDatabase | null = null;
  const run = vi.fn(async (
    transactionDatabase: TenantDatabase,
    work: (commands: TenantOnboardingMembershipCommands) => Promise<unknown>,
  ): Promise<unknown> => {
    databaseState.events.push('timeouts-ready');
    activeTransaction = transactionDatabase;
    try {
      return await work({ createMembership });
    } finally {
      activeTransaction = null;
    }
  });
  const port: TenantOnboardingMembershipExternalTransactionPort = {
    transactionOptions: {
      isolationLevel: 'serializable',
      accessMode: 'read write',
    },
    run: run as TenantOnboardingMembershipExternalTransactionPort['run'],
  };
  return { createMembership, port, run };
}

function createTenantOnboardingInput(
  now = new Date('2026-06-23T03:00:00.000Z'),
): Parameters<
  TenantPlanBindingRepository['createTenantWithPlanAuthorization']
>[0] {
  return {
    planVersion: {
      planId: 'plan-professional',
      planCode: 'professional',
      planName: 'Professional 专业版',
      planStatus: 'active',
      versionId: 'plan-version-professional-published',
      versionCode: '2026-06-v1',
      status: 'published',
      displayName: 'Professional 专业版 2026-06',
      displayPrice: '¥2999/月',
      priceNote: '展示价格，人工确认口径',
      agentLimit: 3,
      seatLimit: 40,
      monthlyAiCallLimit: 300000,
      knowledgeStorageGb: 100,
      connectorEntitlementsJson: { connectors: ['企微', 'HIS'] },
      serviceEntitlementsJson: { services: ['上线培训'] },
      featureEntitlementsJson: {},
      quotaEntitlementsJson: {},
    },
    tenant: {
      id: 'tenant-fixed',
      name: '星澜医美中心',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    authAccount: {
      id: 'auth-user-fixed',
      username: 'xinglan_admin',
      displayName: '李静',
      phone: null,
      email: 'admin@example.com',
      passwordHash: 'scrypt$16384$8$1$salt$hash',
      passwordUpdatedAt: now,
      passwordResetRequired: true,
      status: 'password_reset_required',
      lastLoginAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
      createdBy: 'demo-user-platform',
      updatedBy: 'demo-user-platform',
      createdAt: now,
      updatedAt: now,
    },
    membershipIntent: {
      membershipId: 'tenant-member-fixed',
      tenantId: 'tenant-fixed',
      userId: 'auth-user-fixed',
      role: 'tenant_admin',
      displayName: '李静',
      actorId: 'demo-user-platform',
      occurredAt: now.toISOString(),
    },
    tenantContact: {
      id: 'tenant-contact-fixed',
      tenantId: 'tenant-fixed',
      contactName: '陈磊',
      contactPhone: '13800000000',
      contactEmail: 'contact@example.com',
      initialAdminUserId: 'auth-user-fixed',
      createdBy: 'demo-user-platform',
      updatedBy: 'demo-user-platform',
      createdAt: now,
      updatedAt: now,
    },
    assignment: {
      id: 'tenant-plan-assignment-fixed',
      tenantId: 'tenant-fixed',
      planId: 'plan-professional',
      planVersionId: 'plan-version-professional-published',
      status: 'active',
      startedAt: now,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    },
    authorizationSnapshot: {
      id: 'tenant-authorization-snapshot-fixed',
      tenantId: 'tenant-fixed',
      planAssignmentId: 'tenant-plan-assignment-fixed',
      planVersionId: 'plan-version-professional-published',
      status: 'active',
      snapshotJson: {
        planCode: 'professional',
        openingContact: {
          contactName: '陈磊',
          contactPhone: '13800000000',
          contactEmail: 'contact@example.com',
          adminName: '李静',
          adminAccount: 'xinglan_admin',
          adminContact: 'admin@example.com',
        },
      },
      quotaJson: { monthlyAiCallLimit: 300000 },
      connectorJson: { connectors: ['企微', 'HIS'] },
      serviceJson: { services: ['上线培训'] },
      sourceChangeRecordId: null,
      generatedBy: 'demo-user-platform',
      generatedAt: now,
      supersededAt: null,
      createdAt: now,
    },
    auditEvent: {
      eventId: 'audit-event-fixed',
      actorId: 'demo-user-platform',
      actorRole: 'platform_admin',
      tenantId: 'tenant-fixed',
      scope: 'platform',
      resource: 'tenant',
      resourceId: 'tenant-fixed',
      action: 'create',
      result: 'allowed',
      reason: 'tenant_plan_assignment_created',
      occurredAt: now.toISOString(),
      source: 'demo_session',
    },
    accountAuditEvent: {
      eventId: 'audit-event-account-fixed',
      actorId: 'demo-user-platform',
      actorRole: 'platform_admin',
      tenantId: 'tenant-fixed',
      scope: 'platform',
      resource: 'tenant_member',
      resourceId: 'tenant-member-fixed',
      action: 'create',
      result: 'allowed',
      reason: 'tenant_account_created',
      occurredAt: now.toISOString(),
      source: 'demo_session',
    },
  };
}

beforeEach(() => {
  andMock.mockClear();
  ascMock.mockClear();
  descMock.mockClear();
  eqMock.mockClear();
});

describe('租户套餐绑定 repository', () => {
  it('只查询 active 套餐下的 published 套餐版本选项', async () => {
    const query = createDatabase({
      selectRows: [[{ plan: planRow, version: versionRow }]],
    });

    const result = await createTenantPlanBindingRepository(query.database).listPublishedPlanVersions();

    expect(query.selectChains[0].from).toHaveBeenCalledWith(tenantPlanVersions);
    expect(query.selectChains[0].innerJoin).toHaveBeenCalledWith(
      tenantPlans,
      { column: tenantPlans.id, operator: 'eq', value: tenantPlanVersions.planId },
    );
    expect(query.selectChains[0].where).toHaveBeenCalledWith({
      conditions: [
        { column: tenantPlanVersions.status, operator: 'eq', value: 'published' },
        { column: tenantPlans.status, operator: 'eq', value: 'active' },
      ],
      operator: 'and',
    });
    expect(result).toEqual([
      {
        planId: 'plan-professional',
        planCode: 'professional',
        planName: 'Professional 专业版',
        planStatus: 'active',
        versionId: 'plan-version-professional-published',
        versionCode: '2026-06-v1',
        status: 'published',
        displayName: 'Professional 专业版 2026-06',
        displayPrice: '¥2999/月',
        priceNote: '展示价格，人工确认口径',
        agentLimit: 3,
        seatLimit: 40,
        monthlyAiCallLimit: 300000,
        knowledgeStorageGb: 100,
        connectorEntitlementsJson: { connectors: ['企微', 'HIS'] },
        serviceEntitlementsJson: { services: ['上线培训'] },
        featureEntitlementsJson: { modules: ['客户管理', '知识库'] },
        quotaEntitlementsJson: { aiCallsPerMonth: 300000 },
      },
    ]);
  });

  it('按版本 ID 查找 published 套餐版本', async () => {
    const query = createDatabase({
      selectRows: [[{ plan: planRow, version: versionRow }]],
    });

    const result = await createTenantPlanBindingRepository(query.database).findPublishedPlanVersionById(
      'plan-version-professional-published',
    );

    expect(query.selectChains[0].where).toHaveBeenCalledWith({
      conditions: [
        {
          column: tenantPlanVersions.id,
          operator: 'eq',
          value: 'plan-version-professional-published',
        },
        { column: tenantPlanVersions.status, operator: 'eq', value: 'published' },
        { column: tenantPlans.status, operator: 'eq', value: 'active' },
      ],
      operator: 'and',
    });
    expect(query.selectChains[0].limit).toHaveBeenCalledWith(1);
    expect(result?.versionId).toBe('plan-version-professional-published');
  });

  it('读取型工厂缺少 Membership Adapter 时，写路径在事务与 DML 前 fail-closed', async () => {
    const query = createDatabase();
    const readRepository = createTenantPlanBindingRepository(query.database);
    const repository = readRepository as unknown as TenantPlanBindingRepository;

    await expect(repository.createTenantWithPlanAuthorization(
      createTenantOnboardingInput(),
    )).rejects.toMatchObject({
      code: 'tenant_onboarding_membership_command_unavailable',
      message: 'tenant_onboarding_membership_command_unavailable',
    });
    expect(query.transaction).not.toHaveBeenCalled();
    expect(query.attempted).toEqual([]);
    expect(query.committed).toEqual([]);
  });

  it('事务内写入租户、套餐分配、active 授权快照和开通审计，并返回低敏租户 DTO', async () => {
    const query = createDatabase();
    const now = new Date('2026-06-23T03:00:00.000Z');

    const membership = createMembershipExternalTransaction(query);
    const input = createTenantOnboardingInput(now);
    const result = await createTenantPlanBindingRepository(query.database, {
      membershipCommandExternalTransaction: membership.port,
    }).createTenantWithPlanAuthorization(input);

    expect(query.transaction).toHaveBeenCalledTimes(1);
    expect(query.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      membership.port.transactionOptions,
    );
    expect(membership.run).toHaveBeenCalledTimes(1);
    expect(membership.run.mock.calls[0]?.[0]).toBe(
      query.transactionDatabases[0],
    );
    expect(membership.createMembership).toHaveBeenCalledOnce();
    expect(membership.createMembership).toHaveBeenCalledWith(
      input.membershipIntent,
    );
    expect(query.committed).toEqual(query.attempted);
    const inserted = query.committed.filter(
      (mutation) => mutation.kind === 'insert',
    );
    expect(inserted.map((item) => item.table)).toEqual([
      tenants,
      authUsers,
      tenantContacts,
      tenantPlanAssignments,
      tenantAuthorizationSnapshots,
      auditEvents,
      auditEvents,
      tenantCommercialRecords,
      tenantCommercialRecords,
      tenantCommercialRecords,
    ]);
    expect(query.events).toEqual([
      'begin',
      'timeouts-ready',
      'insert:tenants',
      'insert:authUsers',
      'membership-current',
      'membership-transition',
      'insert:tenantContacts',
      'insert:tenantPlanAssignments',
      'insert:tenantAuthorizationSnapshots',
      'insert:auditEvents',
      'insert:auditEvents',
      'insert:tenantCommercialRecords',
      'insert:tenantCommercialRecords',
      'insert:tenantCommercialRecords',
      'commit',
    ]);
    expect(inserted[1].values).toEqual(
      expect.objectContaining({
        id: 'auth-user-fixed',
        username: 'xinglan_admin',
        passwordHash: 'scrypt$16384$8$1$salt$hash',
        status: 'password_reset_required',
      }),
    );
    expect(inserted[2].values).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-fixed',
        contactName: '陈磊',
        contactPhone: '13800000000',
        initialAdminUserId: 'auth-user-fixed',
      }),
    );
    expect(inserted[3].values).toEqual(
      expect.objectContaining({
        planVersionId: 'plan-version-professional-published',
      }),
    );
    expect(inserted[4].values).toEqual(
      expect.objectContaining({
        status: 'active',
        planVersionId: 'plan-version-professional-published',
      }),
    );
    expect(inserted[5].values).toEqual(
      expect.objectContaining({
        eventId: 'audit-event-fixed',
        tenantId: 'tenant-fixed',
        resource: 'tenant',
        resourceId: 'tenant-fixed',
        action: 'create',
        result: 'allowed',
        reason: 'tenant_plan_assignment_created',
      }),
    );
    expect(inserted[6].values).toEqual(
      expect.objectContaining({
        eventId: 'audit-event-account-fixed',
        tenantId: 'tenant-fixed',
        resource: 'tenant_member',
        resourceId: 'tenant-member-fixed',
        action: 'create',
        result: 'allowed',
        reason: 'tenant_account_created',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-fixed',
        tenantName: '星澜医美中心',
        planVersionId: 'plan-version-professional-published',
        authorizationSnapshotId: 'tenant-authorization-snapshot-fixed',
        authorizationSnapshotStatus: 'active',
        authorizationGeneratedAt: '2026-06-23T03:00:00.000Z',
        openingContact: {
          contactName: '陈磊',
          contactPhone: '13800000000',
          contactEmail: 'contact@example.com',
          adminName: '李静',
          adminAccount: 'xinglan_admin',
          adminContact: 'admin@example.com',
        },
      }),
    );
    expect(JSON.stringify(query.committed.map((item) => item.values))).not.toMatch(
      /PlaintextPasswordShouldNotPass|select \* from tenants|payment_token|webhook_secret|client_secret|api_key/i,
    );
  });

  it('Membership current／evidence 失败时外层事务不提交任何部分状态', async () => {
    const failure = new Error('membership evidence failed');
    const query = createDatabase();
    const membership = createMembershipExternalTransaction(query, {
      failureAfterCurrent: failure,
    });
    const repository = createTenantPlanBindingRepository(query.database, {
      membershipCommandExternalTransaction: membership.port,
    });

    await expect(repository.createTenantWithPlanAuthorization(
      createTenantOnboardingInput(),
    )).rejects.toBe(failure);
    expect(query.events).toEqual([
      'begin',
      'timeouts-ready',
      'insert:tenants',
      'insert:authUsers',
      'membership-current',
      'rollback',
    ]);
    expect(query.attempted.map((mutation) => mutation.kind)).toEqual([
      'insert',
      'insert',
      'membership-current',
    ]);
    expect(query.committed).toEqual([]);
  });

  it('Membership Adapter 在首个 DML 前失败时外层事务以零尝试写回滚', async () => {
    const failure = new Error('membership timeout setup failed');
    const query = createDatabase();
    const run = vi.fn(async () => {
      query.events.push('timeouts-failed');
      throw failure;
    });
    const port: TenantOnboardingMembershipExternalTransactionPort = {
      transactionOptions: {
        isolationLevel: 'serializable',
        accessMode: 'read write',
      },
      run: run as TenantOnboardingMembershipExternalTransactionPort['run'],
    };
    const repository = createTenantPlanBindingRepository(query.database, {
      membershipCommandExternalTransaction: port,
    });

    await expect(repository.createTenantWithPlanAuthorization(
      createTenantOnboardingInput(),
    )).rejects.toBe(failure);
    expect(query.events).toEqual(['begin', 'timeouts-failed', 'rollback']);
    expect(query.attempted).toEqual([]);
    expect(query.committed).toEqual([]);
  });

  it('Membership 与 evidence 完成后下游失败仍回滚同一外层事务', async () => {
    const failure = new Error('downstream contact failed');
    const query = createDatabase({
      failOnTable: tenantContacts,
      failure,
    });
    const membership = createMembershipExternalTransaction(query);
    const repository = createTenantPlanBindingRepository(query.database, {
      membershipCommandExternalTransaction: membership.port,
    });

    await expect(repository.createTenantWithPlanAuthorization(
      createTenantOnboardingInput(),
    )).rejects.toBe(failure);
    expect(query.events).toEqual([
      'begin',
      'timeouts-ready',
      'insert:tenants',
      'insert:authUsers',
      'membership-current',
      'membership-transition',
      'insert:tenantContacts',
      'rollback',
    ]);
    expect(query.attempted.map((mutation) => mutation.kind)).toEqual([
      'insert',
      'insert',
      'membership-current',
      'membership-transition',
      'insert',
    ]);
    expect(query.committed).toEqual([]);
    expect(query.events).not.toContain('commit');
  });
});
