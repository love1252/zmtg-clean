import { describe, expect, it, vi } from 'vitest';
import {
  customers,
  followUpCustomerTimelineEvents,
  followUpMessageDrafts,
  followUpPathEnrollments,
  followUpPathStages,
  followUpTasks,
} from '@/server/db/schema';
import type { TenantDatabase } from '@/server/db/client';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';

const eqMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({
    column,
    operator: 'eq',
    value,
  })),
);
const andMock = vi.hoisted(() =>
  vi.fn((...conditions: unknown[]) => ({
    conditions,
    operator: 'and',
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

function createOperationsSnapshotDatabase(customerRows: unknown[]) {
  const conditionsByTable = new Map<unknown, unknown>();
  const whereByTable = new Map<unknown, ReturnType<typeof vi.fn>>();
  const from = vi.fn((table: unknown) => {
    const where = vi.fn(async (condition: unknown) => {
      conditionsByTable.set(table, condition);
      return table === customers ? customerRows : [];
    });
    whereByTable.set(table, where);
    return { where };
  });
  const select = vi.fn(() => ({ from }));

  return {
    conditionsByTable,
    database: { select } as unknown as TenantDatabase,
    from,
    whereByTable,
  };
}

describe('follow-up operations dashboard repository institution boundary', () => {
  it('机构范围快照只将当前机构客户用于联系人摘要，并将 tenant 与 institution 下推到 customerRows 查询', async () => {
    const query = createOperationsSnapshotDatabase([
      {
        id: 'cust-inst-a',
        tenantId: 'demo-tenant-001',
        institutionId: 'inst-a',
        displayName: '当前机构客户',
        ownerUserId: 'owner-a',
      },
      {
        id: 'cust-inst-b',
        tenantId: 'demo-tenant-001',
        institutionId: 'inst-b',
        displayName: '其他机构客户',
        ownerUserId: 'owner-b',
      },
      {
        id: 'cust-other-tenant',
        tenantId: 'other-tenant',
        institutionId: 'inst-a',
        displayName: '其他租户客户',
        ownerUserId: 'owner-c',
      },
    ]);

    const snapshot = await createTenantBusinessRepository(query.database).listFollowUpOperationsSnapshot({
      tenantId: 'demo-tenant-001',
      institutionId: 'inst-a',
    });

    expect(query.conditionsByTable.get(customers)).toEqual({
      conditions: [
        { column: customers.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: customers.institutionId, operator: 'eq', value: 'inst-a' },
      ],
      operator: 'and',
    });
    expect(query.whereByTable.get(customers)).toHaveBeenCalledTimes(1);
    const contactSync = snapshot.weComCustomerContactSync;
    expect(contactSync).toBeDefined();
    if (!contactSync) throw new Error('expected customer contact sync snapshot');
    expect(contactSync.contacts).toHaveLength(1);
    const firstContact = contactSync.contacts[0];
    expect(firstContact).toBeDefined();
    if (!firstContact) throw new Error('expected current institution contact');
    expect(firstContact).toEqual(
      expect.objectContaining({
        customerDisplayName: '当前机构客户',
        customerId: 'cust-inst-a',
      }),
    );
    expect(JSON.stringify(contactSync)).not.toContain('其他机构客户');
    expect(JSON.stringify(contactSync)).not.toContain('其他租户客户');
  });

  it('未提供 institutionId 时保留既有 tenant-only 内部快照条件', async () => {
    const query = createOperationsSnapshotDatabase([]);

    await createTenantBusinessRepository(query.database).listFollowUpOperationsSnapshot({
      tenantId: 'demo-tenant-001',
      institutionId: null,
    });

    expect(query.conditionsByTable.get(customers)).toEqual({
      column: customers.tenantId,
      operator: 'eq',
      value: 'demo-tenant-001',
    });
  });

  it('仅构造快照所需的六个只读查询', async () => {
    const query = createOperationsSnapshotDatabase([]);

    await createTenantBusinessRepository(query.database).listFollowUpOperationsSnapshot({
      tenantId: 'demo-tenant-001',
      institutionId: 'inst-a',
    });

    expect(query.from).toHaveBeenCalledWith(followUpTasks);
    expect(query.from).toHaveBeenCalledWith(followUpPathEnrollments);
    expect(query.from).toHaveBeenCalledWith(followUpPathStages);
    expect(query.from).toHaveBeenCalledWith(followUpMessageDrafts);
    expect(query.from).toHaveBeenCalledWith(followUpCustomerTimelineEvents);
    expect(query.from).toHaveBeenCalledWith(customers);
  });
});
