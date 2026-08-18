import { describe, expect, it, vi } from 'vitest';

import { createCustomerReferenceRepositoryV1 } from '@/modules/customer-center/server/customer-reference-repository';

function databaseWithRows(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  return {
    database: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit })),
        })),
      })),
    },
    limit,
  };
}

describe('CustomerReferenceV1 owner repository', () => {
  it('returns one exact-pair low-sensitive customer reference', async () => {
    const created = databaseWithRows([
      {
        id: 'customer-1',
        displayName: '客户A',
        tenantId: 'tenant-1',
        institutionId: 'institution-1',
      },
    ]);

    const result = await createCustomerReferenceRepositoryV1(
      created.database as never,
    ).resolve({
      tenantId: 'tenant-1',
      institutionId: 'institution-1',
      customerId: 'customer-1',
    });

    expect(result).toEqual({
      contractVersion: 'v1',
      customerId: 'customer-1',
      displayName: '客户A',
      maskedReference: null,
    });
    expect(created.limit).toHaveBeenCalledWith(2);
  });

  it('fails closed on duplicates, scope mismatch, and malformed identifiers', async () => {
    const duplicate = databaseWithRows([
      {
        id: 'customer-1',
        displayName: '客户A',
        tenantId: 'tenant-1',
        institutionId: 'institution-1',
      },
      {
        id: 'customer-1',
        displayName: '客户A',
        tenantId: 'tenant-1',
        institutionId: 'institution-1',
      },
    ]);
    await expect(
      createCustomerReferenceRepositoryV1(duplicate.database as never).resolve({
        tenantId: 'tenant-1',
        institutionId: 'institution-1',
        customerId: 'customer-1',
      }),
    ).resolves.toBeNull();

    const mismatch = databaseWithRows([
      {
        id: 'customer-1',
        displayName: '客户A',
        tenantId: 'tenant-1',
        institutionId: 'institution-other',
      },
    ]);
    await expect(
      createCustomerReferenceRepositoryV1(mismatch.database as never).resolve({
        tenantId: 'tenant-1',
        institutionId: 'institution-1',
        customerId: 'customer-1',
      }),
    ).resolves.toBeNull();

    const malformed = databaseWithRows([]);
    await expect(
      createCustomerReferenceRepositoryV1(malformed.database as never).resolve({
        tenantId: ' tenant-1',
        institutionId: 'institution-1',
        customerId: 'customer-1',
      }),
    ).resolves.toBeNull();
    expect(malformed.database.select).not.toHaveBeenCalled();
  });
});
