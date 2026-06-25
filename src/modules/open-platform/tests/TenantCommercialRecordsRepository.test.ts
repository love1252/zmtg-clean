import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTenantCommercialRecordsRepository } from '@/modules/open-platform/server/tenant-commercial-records-repository';
import type { TenantDatabase } from '@/server/db/client';
import { tenantCommercialRecords } from '@/server/db/schema';

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
    desc: descMock,
    eq: eqMock,
  };
});

const commercialRow = {
  id: 'commercial-record-order-001',
  tenantId: 'demo-tenant-001',
  recordType: 'order',
  status: 'pending',
  displayCode: 'ORD-2026-0001',
  displayAmount: '¥2999/月',
  periodLabel: '2026-06',
  relatedPlanChangeId: 'tenant-plan-change-demo-001',
  note: '内部备注 payment_token=payment_token_should_not_return',
  occurredAt: new Date('2026-06-23T06:00:00.000Z'),
  createdBy: 'demo-user-platform',
  updatedBy: 'demo-user-platform',
  createdAt: new Date('2026-06-23T06:00:00.000Z'),
  updatedAt: new Date('2026-06-23T06:10:00.000Z'),
  webhook_secret: 'webhook_secret_should_not_return',
  contract_body: '完整合同正文',
};

function createCommercialRecordsDatabase(rows: unknown[] = []) {
  const orderBy = vi.fn(async (..._orders: unknown[]) => rows);
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return {
    database: { select } as unknown as TenantDatabase,
    from,
    orderBy,
    select,
    where,
  };
}

beforeEach(() => {
  descMock.mockClear();
  eqMock.mockClear();
});

describe('租户商业化预留 repository', () => {
  it('按租户查询商业化预留记录并返回低敏 DTO', async () => {
    const query = createCommercialRecordsDatabase([commercialRow]);

    const result =
      await createTenantCommercialRecordsRepository(query.database).listTenantCommercialRecords(
        'demo-tenant-001',
      );

    expect(query.from).toHaveBeenCalledWith(tenantCommercialRecords);
    expect(query.where).toHaveBeenCalledWith({
      column: tenantCommercialRecords.tenantId,
      operator: 'eq',
      value: 'demo-tenant-001',
    });
    expect(query.orderBy).toHaveBeenCalledWith({
      column: tenantCommercialRecords.createdAt,
      direction: 'desc',
    });
    expect(result).toEqual([
      {
        recordId: 'commercial-record-order-001',
        tenantId: 'demo-tenant-001',
        recordType: 'order',
        recordTypeLabel: '订单',
        status: 'pending',
        statusLabel: '待人工确认',
        displayCode: 'ORD-2026-0001',
        displayAmount: '¥2999/月',
        periodLabel: '2026-06',
        relatedPlanChangeId: 'tenant-plan-change-demo-001',
        occurredAt: '2026-06-23T06:00:00.000Z',
        createdAt: '2026-06-23T06:00:00.000Z',
        updatedAt: '2026-06-23T06:10:00.000Z',
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /note|payment_token|webhook_secret|contract_body|完整合同正文/i,
    );
  });
});
