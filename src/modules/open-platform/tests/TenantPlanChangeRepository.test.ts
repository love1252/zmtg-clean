import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTenantPlanChangeRepository } from '@/modules/open-platform/server/tenant-plan-change-repository';
import type { TenantDatabase } from '@/server/db/client';
import {
  auditEvents,
  tenantAuthorizationSnapshots,
  tenantPlanAssignments,
  tenantPlanChangeRecords,
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

const tenantRow = {
  id: 'tenant-001',
  name: '星澜医美中心',
  status: 'active',
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-20T00:00:00.000Z'),
};

const assignmentRow = {
  id: 'assignment-growth-active',
  tenantId: 'tenant-001',
  planId: 'plan-growth',
  planVersionId: 'plan-version-growth-202606',
  status: 'active',
  startedAt: new Date('2026-06-01T00:00:00.000Z'),
  expiresAt: null,
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
};

const planRow = {
  id: 'plan-growth',
  name: 'Growth 成长版',
  code: 'growth-care',
  description: '成长型机构套餐',
  status: 'active',
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
};

const planVersionRow = {
  id: 'plan-version-growth-202606',
  planId: 'plan-growth',
  versionCode: '2026-06-v1',
  status: 'published',
  displayName: 'Growth 成长版 2026-06',
  displayPrice: '¥1999/月',
  priceNote: '展示价格，人工确认口径',
  agentLimit: 2,
  seatLimit: 20,
  monthlyAiCallLimit: 100000,
  knowledgeStorageGb: 50,
  connectorEntitlementsJson: { connectors: ['企微'] },
  serviceEntitlementsJson: { services: ['基础培训'] },
  featureEntitlementsJson: {},
  quotaEntitlementsJson: {},
  changeSummary: '',
  createdBy: 'demo-user-platform',
  updatedBy: 'demo-user-platform',
  publishedBy: 'demo-user-platform',
  publishedAt: new Date('2026-06-01T00:00:00.000Z'),
  retiredAt: null,
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
};

const authorizationSnapshotRow = {
  id: 'auth-snapshot-growth-active',
  tenantId: 'tenant-001',
  planAssignmentId: 'assignment-growth-active',
  planVersionId: 'plan-version-growth-202606',
  status: 'active',
  snapshotJson: {
    openingContact: {
      contactName: '陈磊',
      contactPhone: '13985162773',
      contactEmail: 'contact@example.com',
      adminName: '陈磊',
      adminAccount: 'zhengpu',
      adminContact: '13985162273',
      requestBody: { password: 'PlaintextPasswordShouldNotPass' },
      sql: 'select * from tenants',
    },
  },
  quotaJson: {},
  connectorJson: { connectors: ['企微'] },
  serviceJson: { services: ['基础培训'] },
  sourceChangeRecordId: null,
  generatedBy: 'demo-user-platform',
  generatedAt: new Date('2026-06-01T00:00:00.000Z'),
  supersededAt: null,
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
};

function createSelectChain(rows: unknown[]) {
  const limit = vi.fn(async () => rows);
  const where = vi.fn(() => ({ limit }));
  const leftJoinAuthorizationSnapshots = vi.fn(() => ({ where }));
  const innerJoinPlanVersions = vi.fn(() => ({ leftJoin: leftJoinAuthorizationSnapshots, where }));
  const innerJoinPlans = vi.fn(() => ({ innerJoin: innerJoinPlanVersions, where }));
  const innerJoinAssignments = vi.fn(() => ({ innerJoin: innerJoinPlans }));
  const from = vi.fn(() => ({ innerJoin: innerJoinAssignments, where }));

  return {
    chain: { from },
    from,
    innerJoinAssignments,
    innerJoinPlans,
    innerJoinPlanVersions,
    leftJoinAuthorizationSnapshots,
    limit,
    where,
  };
}

function createMutationStore() {
  const inserted: Array<{ table: unknown; values: unknown }> = [];
  const updated: Array<{ table: unknown; set: unknown; where: unknown }> = [];
  const insert = vi.fn((table: unknown) => ({
    values: vi.fn(async (values: unknown) => {
      inserted.push({ table, values });
    }),
  }));
  const update = vi.fn((table: unknown) => ({
    set: vi.fn((set: unknown) => ({
      where: vi.fn(async (where: unknown) => {
        updated.push({ table, set, where });
      }),
    })),
  }));

  return { insert, inserted, update, updated };
}

function createDatabase(input: { selectRows?: unknown[][] } = {}) {
  const allSelectChains = (input.selectRows ?? []).map(createSelectChain);
  const selectChains = [...allSelectChains];
  const rootMutations = createMutationStore();
  const transactionMutations = createMutationStore();
  const select = vi.fn(() => {
    const next = selectChains.shift();
    if (!next) throw new Error('没有配置更多 select chain');
    return next.chain;
  });
  const transaction = vi.fn(async (callback: (database: unknown) => Promise<unknown>) =>
    callback({
      insert: transactionMutations.insert,
      update: transactionMutations.update,
    }),
  );

  return {
    database: {
      select,
      insert: rootMutations.insert,
      update: rootMutations.update,
      transaction,
    } as unknown as TenantDatabase,
    select,
    selectChains: allSelectChains,
    transaction,
    transactionMutations,
  };
}

beforeEach(() => {
  andMock.mockClear();
  eqMock.mockClear();
});

describe('租户套餐变更 repository', () => {
  it('查询租户当前 active assignment、published 版本和 active 授权快照', async () => {
    const query = createDatabase({
      selectRows: [[{
        tenant: tenantRow,
        assignment: assignmentRow,
        plan: planRow,
        planVersion: planVersionRow,
        authorizationSnapshot: authorizationSnapshotRow,
      }]],
    });

    const result = await createTenantPlanChangeRepository(query.database).findCurrentTenantPlanState(
      'tenant-001',
    );

    expect(query.selectChains[0].from).toHaveBeenCalledWith(tenants);
    expect(query.selectChains[0].innerJoinAssignments).toHaveBeenCalledWith(
      tenantPlanAssignments,
      {
        conditions: [
          { column: tenantPlanAssignments.tenantId, operator: 'eq', value: tenants.id },
          { column: tenantPlanAssignments.status, operator: 'eq', value: 'active' },
        ],
        operator: 'and',
      },
    );
    expect(query.selectChains[0].leftJoinAuthorizationSnapshots).toHaveBeenCalledWith(
      tenantAuthorizationSnapshots,
      {
        conditions: [
          { column: tenantAuthorizationSnapshots.tenantId, operator: 'eq', value: tenants.id },
          { column: tenantAuthorizationSnapshots.status, operator: 'eq', value: 'active' },
        ],
        operator: 'and',
      },
    );
    expect(query.selectChains[0].where).toHaveBeenCalledWith({
      column: tenants.id,
      operator: 'eq',
      value: 'tenant-001',
    });
    expect(query.selectChains[0].limit).toHaveBeenCalledWith(1);
    expect(result).toEqual(
      expect.objectContaining({
        tenant: expect.objectContaining({ id: 'tenant-001' }),
        assignment: expect.objectContaining({ id: 'assignment-growth-active' }),
        planVersion: expect.objectContaining({ versionId: 'plan-version-growth-202606' }),
        authorizationSnapshot: expect.objectContaining({ id: 'auth-snapshot-growth-active' }),
      }),
    );
  });

  it('事务内过期旧分配、supersede 旧快照，并写入新分配、新快照、变更记录和审计事件', async () => {
    const query = createDatabase();
    const now = new Date('2026-06-23T04:00:00.000Z');

    const result = await createTenantPlanChangeRepository(query.database).applyTenantPlanChange({
      tenant: tenantRow,
      currentAssignment: assignmentRow,
      currentAuthorizationSnapshot: authorizationSnapshotRow,
      toPlanVersion: {
        planId: 'plan-professional',
        planCode: 'professional',
        planName: 'Professional 专业版',
        planStatus: 'active',
        versionId: 'plan-version-professional-202606',
        versionCode: '2026-06-v1',
        status: 'published',
        displayName: 'Professional 专业版 2026-06',
        displayPrice: '¥2999/月',
        priceNote: '',
        agentLimit: 3,
        seatLimit: 40,
        monthlyAiCallLimit: 300000,
        knowledgeStorageGb: 100,
        connectorEntitlementsJson: { connectors: ['企微', 'HIS'] },
        serviceEntitlementsJson: { services: ['上线培训'] },
        featureEntitlementsJson: {},
        quotaEntitlementsJson: {},
      },
      newAssignment: {
        id: 'assignment-professional-active',
        tenantId: 'tenant-001',
        planId: 'plan-professional',
        planVersionId: 'plan-version-professional-202606',
        status: 'active',
        startedAt: now,
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
      },
      newAuthorizationSnapshot: {
        id: 'auth-snapshot-professional-active',
        tenantId: 'tenant-001',
        planAssignmentId: 'assignment-professional-active',
        planVersionId: 'plan-version-professional-202606',
        status: 'active',
        snapshotJson: {
          planCode: 'professional',
          openingContact: {
            contactName: '陈磊',
            contactPhone: '13985162773',
            contactEmail: 'contact@example.com',
            adminName: '陈磊',
            adminAccount: 'zhengpu',
            adminContact: '13985162273',
          },
        },
        quotaJson: { monthlyAiCallLimit: 300000 },
        connectorJson: { connectors: ['企微', 'HIS'] },
        serviceJson: { services: ['上线培训'] },
        sourceChangeRecordId: 'change-001',
        generatedBy: 'demo-user-platform',
        generatedAt: now,
        supersededAt: null,
        createdAt: now,
      },
      changeRecord: {
        id: 'change-001',
        tenantId: 'tenant-001',
        fromPlanVersionId: 'plan-version-growth-202606',
        toPlanVersionId: 'plan-version-professional-202606',
        fromSnapshotId: 'auth-snapshot-growth-active',
        toSnapshotId: 'auth-snapshot-professional-active',
        status: 'applied',
        diffJson: { changedItemCount: 8 },
        reason: '机构升级到专业版',
        requestedBy: 'demo-user-platform',
        appliedBy: 'demo-user-platform',
        appliedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      auditEvent: {
        eventId: 'audit-001',
        actorId: 'demo-user-platform',
        actorRole: 'platform_admin',
        tenantId: 'tenant-001',
        scope: 'platform',
        resource: 'tenant',
        resourceId: 'tenant-001',
        action: 'manage_status',
        result: 'transitioned',
        reason: 'tenant_plan_changed',
        occurredAt: now.toISOString(),
        source: 'server_session',
      },
      appliedAt: now,
    });

    expect(query.transaction).toHaveBeenCalledTimes(1);
    expect(query.transactionMutations.updated).toEqual([
      expect.objectContaining({
        table: tenantPlanAssignments,
        set: expect.objectContaining({ status: 'expired', expiresAt: now, updatedAt: now }),
      }),
      expect.objectContaining({
        table: tenantAuthorizationSnapshots,
        set: expect.objectContaining({ status: 'superseded', supersededAt: now }),
      }),
    ]);
    expect(query.transactionMutations.inserted.map((item) => item.table)).toEqual([
      tenantPlanAssignments,
      tenantAuthorizationSnapshots,
      tenantPlanChangeRecords,
      auditEvents,
      tenantCommercialRecords,
    ]);
    expect(result).toEqual(
      expect.objectContaining({
        status: 'plan_changed',
        changeRecordId: 'change-001',
        auditEventId: 'audit-001',
        tenant: expect.objectContaining({
          tenantId: 'tenant-001',
          planVersionId: 'plan-version-professional-202606',
          authorizationSnapshotId: 'auth-snapshot-professional-active',
          authorizationSnapshotStatus: 'active',
          openingContact: {
            contactName: '陈磊',
            contactPhone: '13985162773',
            contactEmail: 'contact@example.com',
            adminName: '陈磊',
            adminAccount: 'zhengpu',
            adminContact: '13985162273',
          },
        }),
      }),
    );
    expect(JSON.stringify(query.transactionMutations.inserted.map((item) => item.values))).not.toMatch(
      /13800000000|payment_token|PlaintextPasswordShouldNotPass|select \* from tenants|webhook_secret|client_secret|api_key/i,
    );
  });
});
