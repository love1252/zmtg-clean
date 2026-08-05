import { describe, expect, it, vi } from 'vitest';

import {
  createCustomerObjectFactReaderV1,
  createCustomerObjectFactSourceV1,
  isCustomerObjectFactSourceV1,
} from '@/modules/customers/application/customer-object-fact-reader';
import {
  isAuthoritativeInstitutionObjectFactV1,
  isInstitutionObjectFactReaderV1,
} from '@/modules/security/server/institution-object-guard';

const NOW = new Date('2026-08-05T09:00:00.000Z');
const query = Object.freeze({
  objectType: 'customer' as const,
  objectId: 'customer-001',
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
});

function candidate() {
  return Object.freeze({
    customerId: query.objectId,
    tenantId: query.tenantId,
    institutionId: query.institutionId,
    updatedAt: '2026-08-05T08:59:00.000Z',
  });
}

describe('BASE-B4 customer object fact reader', () => {
  it('maps an exact scoped customer to one genuine low-sensitive fact', async () => {
    const resolve = vi.fn(async () => candidate());
    const source = createCustomerObjectFactSourceV1({ resolve });
    const reader = createCustomerObjectFactReaderV1({
      source,
      now: () => new Date(NOW.getTime()),
    });

    expect(isCustomerObjectFactSourceV1(source)).toBe(true);
    expect(isInstitutionObjectFactReaderV1(reader)).toBe(true);

    const result = await reader.resolve(query);
    expect(isAuthoritativeInstitutionObjectFactV1(result)).toBe(true);
    expect(result).toEqual({
      kind: 'current_object_fact',
      objectType: 'customer',
      objectId: query.objectId,
      tenantId: query.tenantId,
      institutionId: query.institutionId,
      status: 'active',
      revision: Date.parse('2026-08-05T08:59:00.000Z'),
      observedAt: NOW.toISOString(),
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Reflect.ownKeys(result)).toEqual([
      'kind',
      'objectType',
      'objectId',
      'tenantId',
      'institutionId',
      'status',
      'revision',
      'observedAt',
    ]);
    expect(resolve).toHaveBeenCalledWith({
      customerId: query.objectId,
      tenantId: query.tenantId,
      institutionId: query.institutionId,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /displayName|phone|medical|tags|notes|raw/i,
    );
  });

  it('maps not-found and cross-scope to object_denied', async () => {
    for (const value of [
      null,
      { ...candidate(), institutionId: 'institution-other' },
    ]) {
      const reader = createCustomerObjectFactReaderV1({
        source: createCustomerObjectFactSourceV1({
          resolve: async () => value,
        }),
        now: () => new Date(NOW.getTime()),
      });
      await expect(reader.resolve(query)).resolves.toEqual({
        kind: 'rejected',
        code: 'object_denied',
      });
    }
  });

  it('maps source exceptions to object_unavailable', async () => {
    const reader = createCustomerObjectFactReaderV1({
      source: createCustomerObjectFactSourceV1({
        async resolve() {
          throw new Error('source unavailable');
        },
      }),
      now: () => new Date(NOW.getTime()),
    });
    await expect(reader.resolve(query)).resolves.toEqual({
      kind: 'rejected',
      code: 'object_unavailable',
    });
  });

  it.each([
    ['noncanonical', { ...candidate(), updatedAt: '2026-08-05 08:59:00' }],
    ['invalid date', { ...candidate(), updatedAt: '2026-02-30T08:59:00.000Z' }],
    ['extra field', { ...candidate(), displayName: '禁止字段' }],
  ])('rejects invalid source shape: %s', async (_label, value) => {
    const reader = createCustomerObjectFactReaderV1({
      source: createCustomerObjectFactSourceV1({
        resolve: async () => value,
      }),
      now: () => new Date(NOW.getTime()),
    });
    await expect(reader.resolve(query)).resolves.toEqual({
      kind: 'rejected',
      code: 'object_invalid',
    });
  });

  it('rejects another object type before source access', async () => {
    const resolve = vi.fn(async () => candidate());
    const reader = createCustomerObjectFactReaderV1({
      source: createCustomerObjectFactSourceV1({ resolve }),
      now: () => new Date(NOW.getTime()),
    });
    await expect(
      reader.resolve({ ...query, objectType: 'knowledge_item' }),
    ).resolves.toEqual({
      kind: 'rejected',
      code: 'object_invalid',
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('rejects an invalid clock', async () => {
    const reader = createCustomerObjectFactReaderV1({
      source: createCustomerObjectFactSourceV1({
        resolve: async () => candidate(),
      }),
      now: () => new Date(Number.NaN),
    });
    await expect(reader.resolve(query)).resolves.toEqual({
      kind: 'rejected',
      code: 'object_invalid',
    });
  });

  it('keeps fake source handles and malformed factories fail-closed', async () => {
    const fakeSource = Object.freeze({
      resolve: vi.fn(async () => ({
        kind: 'customer_current_source',
        ...candidate(),
      })),
    });
    const reader = createCustomerObjectFactReaderV1({
      source: fakeSource as never,
      now: () => new Date(NOW.getTime()),
    });
    const malformed = createCustomerObjectFactSourceV1({} as never);

    expect(isCustomerObjectFactSourceV1(fakeSource)).toBe(false);
    expect(isCustomerObjectFactSourceV1(malformed)).toBe(true);
    await expect(reader.resolve(query)).resolves.toEqual({
      kind: 'rejected',
      code: 'object_unavailable',
    });
    await expect(
      malformed.resolve({
        customerId: query.objectId,
        tenantId: query.tenantId,
        institutionId: query.institutionId,
      }),
    ).resolves.toEqual({
      kind: 'rejected',
      code: 'customer_unavailable',
    });
  });

  it('rejects malformed and proxy source queries', async () => {
    const resolve = vi.fn(async () => candidate());
    const source = createCustomerObjectFactSourceV1({ resolve });
    const values = [
      {
        customerId: '',
        tenantId: query.tenantId,
        institutionId: query.institutionId,
      },
      {
        customerId: query.objectId,
        tenantId: query.tenantId,
      },
      new Proxy(
        {
          customerId: query.objectId,
          tenantId: query.tenantId,
          institutionId: query.institutionId,
        },
        {},
      ),
    ];
    for (const value of values) {
      await expect(source.resolve(value as never)).resolves.toEqual({
        kind: 'rejected',
        code: 'customer_invalid',
      });
    }
    expect(resolve).not.toHaveBeenCalled();
  });
});
