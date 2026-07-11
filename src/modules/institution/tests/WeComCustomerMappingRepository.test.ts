import { describe, expect, it, vi } from 'vitest';
import type { TenantDatabase } from '@/server/db/client';
import { weComCustomerMappingStates } from '@/server/db/schema';
import {
  createWeComCustomerMappingRepository,
  mapWeComCustomerMappingStateRow,
} from '@/modules/institution/server/wecom-customer-mapping-repository';

const eqMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({ column, operator: 'eq', value })),
);
const andMock = vi.hoisted(() =>
  vi.fn((...conditions: unknown[]) => ({ conditions, operator: 'and' })),
);

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, and: andMock, eq: eqMock };
});

const row = {
  id: 'mapping-01',
  tenantId: 'tenant-a',
  institutionId: 'inst-a',
  proofContactId: 'live-contact-proof-01',
  proofEmployeeId: 'live-employee-proof-01',
  sourceMode: 'real_readonly_proof',
  customerId: 'customer-a',
  status: 'confirmed',
  decidedBy: 'admin-a',
  decidedAt: new Date('2026-07-10T08:00:00.000Z'),
  createdAt: new Date('2026-07-10T08:00:00.000Z'),
  updatedAt: new Date('2026-07-10T08:00:00.000Z'),
} satisfies typeof weComCustomerMappingStates.$inferSelect;

describe('WeComCustomerMappingRepository', () => {
  it('按 tenantId + institutionId + proofContactId 查询并只返回低敏字段', async () => {
    const where = vi.fn(async () => [row]);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const repository = createWeComCustomerMappingRepository({ select } as unknown as TenantDatabase);

    const result = await repository.findByScope({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      proofContactId: 'live-contact-proof-01',
    });

    expect(where).toHaveBeenCalledWith({
      conditions: [
        { column: weComCustomerMappingStates.tenantId, operator: 'eq', value: 'tenant-a' },
        { column: weComCustomerMappingStates.institutionId, operator: 'eq', value: 'inst-a' },
        {
          column: weComCustomerMappingStates.proofContactId,
          operator: 'eq',
          value: 'live-contact-proof-01',
        },
      ],
      operator: 'and',
    });
    expect(result).toEqual(mapWeComCustomerMappingStateRow(row));
    expect(JSON.stringify(result)).not.toMatch(
      /external_userid|userid|corpId|Secret|token|rawResponse/i,
    );
  });

  it('事务准备链路按完整 scope SELECT FOR UPDATE 锁定 mapping row', async () => {
    const forLock = vi.fn(async () => [row]);
    const where = vi.fn(() => ({ for: forLock }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const repository = createWeComCustomerMappingRepository({ select } as unknown as TenantDatabase);

    const result = await repository.findByScopeForUpdate({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      proofContactId: 'live-contact-proof-01',
    });

    expect(where).toHaveBeenCalledWith({
      conditions: [
        { column: weComCustomerMappingStates.tenantId, operator: 'eq', value: 'tenant-a' },
        { column: weComCustomerMappingStates.institutionId, operator: 'eq', value: 'inst-a' },
        { column: weComCustomerMappingStates.proofContactId, operator: 'eq', value: 'live-contact-proof-01' },
      ],
      operator: 'and',
    });
    expect(forLock).toHaveBeenCalledWith('update');
    expect(result).toEqual(mapWeComCustomerMappingStateRow(row));
  });

  it('create-if-absent 使用 on-conflict-do-nothing，冲突时不覆盖已有状态', async () => {
    const returning = vi.fn(async () => [row]);
    const onConflictDoNothing = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoNothing }));
    const insert = vi.fn(() => ({ values }));
    const repository = createWeComCustomerMappingRepository({ insert } as unknown as TenantDatabase);

    const result = await repository.createIfAbsent({
      id: 'mapping-01',
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      proofContactId: 'live-contact-proof-01',
      proofEmployeeId: 'live-employee-proof-01',
      sourceMode: 'real_readonly_proof',
      customerId: 'customer-a',
      status: 'confirmed',
      decidedBy: 'admin-a',
      decidedAt: '2026-07-10T08:00:00.000Z',
    });

    expect(onConflictDoNothing).toHaveBeenCalledOnce();
    expect(result).toEqual(mapWeComCustomerMappingStateRow(row));
    expect(insert).toHaveBeenCalledWith(weComCustomerMappingStates);
    expect(values).toHaveBeenCalledWith({
      id: 'mapping-01',
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      proofContactId: 'live-contact-proof-01',
      proofEmployeeId: 'live-employee-proof-01',
      sourceMode: 'real_readonly_proof',
      customerId: 'customer-a',
      status: 'confirmed',
      decidedBy: 'admin-a',
      decidedAt: new Date('2026-07-10T08:00:00.000Z'),
    });
  });

  it('create-if-absent 冲突时返回 null', async () => {
    const returning = vi.fn(async () => []);
    const onConflictDoNothing = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoNothing }));
    const insert = vi.fn(() => ({ values }));
    const repository = createWeComCustomerMappingRepository({ insert } as unknown as TenantDatabase);

    const result = await repository.createIfAbsent({
      id: 'mapping-02',
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      proofContactId: 'live-contact-proof-01',
      proofEmployeeId: 'live-employee-proof-01',
      sourceMode: 'real_readonly_proof',
      customerId: 'customer-b',
      status: 'rejected',
      decidedBy: 'admin-a',
      decidedAt: '2026-07-10T08:00:00.000Z',
    });

    expect(result).toBeNull();
  });

  it('条件更新同时绑定 scope、customer 和当前状态，零返回行表示未更新', async () => {
    const returning = vi.fn(async () => []);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const repository = createWeComCustomerMappingRepository({ update } as unknown as TenantDatabase);

    const result = await repository.updateWhenCurrentStatus({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      proofContactId: 'live-contact-proof-01',
      customerId: 'customer-a',
      expectedCustomerId: 'customer-a',
      expectedStatus: 'confirmed',
      status: 'revoked',
      decidedBy: 'admin-a',
      decidedAt: '2026-07-10T09:00:00.000Z',
    });

    expect(where).toHaveBeenCalledWith({
      conditions: [
        { column: weComCustomerMappingStates.tenantId, operator: 'eq', value: 'tenant-a' },
        { column: weComCustomerMappingStates.institutionId, operator: 'eq', value: 'inst-a' },
        {
          column: weComCustomerMappingStates.proofContactId,
          operator: 'eq',
          value: 'live-contact-proof-01',
        },
        { column: weComCustomerMappingStates.customerId, operator: 'eq', value: 'customer-a' },
        { column: weComCustomerMappingStates.status, operator: 'eq', value: 'confirmed' },
      ],
      operator: 'and',
    });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'customer-a',
        status: 'revoked',
        decidedBy: 'admin-a',
      }),
    );
    expect(result).toBeNull();
  });
});
