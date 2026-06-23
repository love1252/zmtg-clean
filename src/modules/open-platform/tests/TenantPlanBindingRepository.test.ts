import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTenantPlanBindingRepository } from '@/modules/open-platform/server/tenant-plan-binding-repository';
import type { TenantDatabase } from '@/server/db/client';
import {
  tenantAuthorizationSnapshots,
  tenantPlanAssignments,
  tenantPlanVersions,
  tenantPlans,
  tenants,
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

function createDatabase(input: { selectRows?: unknown[][] } = {}) {
  const allSelectChains = (input.selectRows ?? []).map(createSelectChain);
  const selectChains = [...allSelectChains];
  const inserted: Array<{ table: unknown; values: unknown }> = [];
  const transactionInsert = vi.fn((table: unknown) => ({
    values: vi.fn(async (values: unknown) => {
      inserted.push({ table, values });
    }),
  }));
  const transaction = vi.fn(async (callback: (database: unknown) => Promise<unknown>) =>
    callback({ insert: transactionInsert }),
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

  it('事务内写入租户、套餐分配和 active 授权快照，并返回低敏租户 DTO', async () => {
    const query = createDatabase();
    const now = new Date('2026-06-23T03:00:00.000Z');

    const result = await createTenantPlanBindingRepository(query.database).createTenantWithPlanAuthorization({
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
        snapshotJson: { planCode: 'professional' },
        quotaJson: { monthlyAiCallLimit: 300000 },
        connectorJson: { connectors: ['企微', 'HIS'] },
        serviceJson: { services: ['上线培训'] },
        sourceChangeRecordId: null,
        generatedBy: 'demo-user-platform',
        generatedAt: now,
        supersededAt: null,
        createdAt: now,
      },
    });

    expect(query.transaction).toHaveBeenCalledTimes(1);
    expect(query.inserted.map((item) => item.table)).toEqual([
      tenants,
      tenantPlanAssignments,
      tenantAuthorizationSnapshots,
    ]);
    expect(query.inserted[1].values).toEqual(
      expect.objectContaining({
        planVersionId: 'plan-version-professional-published',
      }),
    );
    expect(query.inserted[2].values).toEqual(
      expect.objectContaining({
        status: 'active',
        planVersionId: 'plan-version-professional-published',
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
      }),
    );
    expect(JSON.stringify(query.inserted.map((item) => item.values))).not.toMatch(
      /13800000000|admin@example.com|payment_token|webhook_secret|client_secret|api_key/i,
    );
  });
});
