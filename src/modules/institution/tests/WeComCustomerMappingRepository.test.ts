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

describe('WeComCustomerMappingRepository legacy compatibility', () => {
  it('read compatibility：按 tenant + institution + proofContact 查询', async () => {
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
        { column: weComCustomerMappingStates.proofContactId, operator: 'eq', value: 'live-contact-proof-01' },
      ],
      operator: 'and',
    });
    expect(result).toEqual(mapWeComCustomerMappingStateRow(row));
  });

  it('read compatibility：SELECT FOR UPDATE 继续按完整 scope 锁定', async () => {
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

    expect(forLock).toHaveBeenCalledWith('update');
    expect(result).toEqual(mapWeComCustomerMappingStateRow(row));
  });

  it('legacy create/update Writer 均 fail-closed 且不触发 DB mutation', async () => {
    const insert = vi.fn();
    const update = vi.fn();
    const repository = createWeComCustomerMappingRepository({ insert, update } as unknown as TenantDatabase);

    await expect(
      repository.createIfAbsent({
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
      }),
    ).rejects.toThrow('legacy_wecom_mapping_writer_disabled');

    await expect(
      repository.updateWhenCurrentStatus({
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        proofContactId: 'live-contact-proof-01',
        customerId: 'customer-b',
        expectedCustomerId: 'customer-a',
        expectedStatus: 'confirmed',
        status: 'revoked',
        decidedBy: 'admin-a',
        decidedAt: '2026-07-10T09:00:00.000Z',
      }),
    ).rejects.toThrow('legacy_wecom_mapping_writer_disabled');

    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
