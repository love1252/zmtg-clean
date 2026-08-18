
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readCustomers: vi.fn(),
  createCustomer: vi.fn(),
}));

vi.mock('@/server/orchestration/institution-customer-list-reader', () => ({
  readCurrentInstitutionCustomersV1: mocks.readCustomers,
}));
vi.mock('@/server/orchestration/institution-customer-controlled-write-runtime', () => ({
  createCurrentInstitutionCustomerControlledV1: mocks.createCustomer,
}));

import { GET, POST } from '@/app/api/v1/institution/customers/route';

const ready = Object.freeze({
  kind: 'ready' as const,
  records: Object.freeze([
    Object.freeze({
      contractVersion: 'v1' as const,
      customerId: 'customer-001',
      displayName: '客户甲',
      lifecycle: 'consulting' as const,
      priority: 'high' as const,
      updatedAt: '2026-08-18T12:00:00.000Z',
    }),
  ]),
  pageInfo: Object.freeze({ page: 1, pageSize: 20 as const, hasMore: false }),
});

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.readCustomers.mockResolvedValue(ready);
  mocks.createCustomer.mockResolvedValue({
    kind: 'ready',
    record: {
      contractVersion: 'v1',
      customerId: 'customer-new',
      displayName: '客户乙',
      lifecycle: 'consulting',
      priority: 'medium',
      ownerUserId: 'consultant-1',
      projectInterest: '',
      updatedAt: '2026-08-18T12:10:00.000Z',
      permissions: { canUpdate: true, canReassignOwner: true },
    },
  });
});

describe('/api/v1/institution/customers', () => {
  it('GET keeps the existing exact low-sensitive contract', async () => {
    const response = await GET(
      new Request('http://localhost/api/v1/institution/customers?page=1'),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      records: ready.records,
      pageInfo: ready.pageInfo,
    });
  });

  it('POST delegates controlled create and returns no-store 201', async () => {
    const body = {
      displayName: '客户乙',
      lifecycle: 'consulting',
      priority: 'medium',
      ownerUserId: 'consultant-1',
      projectInterest: '',
    };
    const response = await POST(
      new Request('http://localhost/api/v1/institution/customers', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.createCustomer).toHaveBeenCalledWith(body);
  });

  it.each([
    [{ kind: 'invalid', code: 'invalid_customer_create' }, 400],
    [{ kind: 'forbidden' }, 403],
    [{ kind: 'conflict', code: 'customer_conflict' }, 409],
    [{ kind: 'quota_denied', code: 'quota_exceeded_customers' }, 409],
    [{ kind: 'unavailable' }, 503],
  ] as const)('POST maps %o to HTTP %i', async (result, status) => {
    mocks.createCustomer.mockResolvedValueOnce(result);
    const response = await POST(
      new Request('http://localhost/api/v1/institution/customers', {
        method: 'POST',
        body: '{}',
      }),
    );
    expect(response.status).toBe(status);
  });

  it('versioned route remains orchestration-only', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/v1/institution/customers/route.ts'),
      'utf8',
    );
    expect(source).toContain('createCurrentInstitutionCustomerControlledV1');
    expect(source).not.toContain('getDatabase');
    expect(source).not.toMatch(/export\s+(?:async\s+)?function\s+(?:PATCH|DELETE)/u);
  });
});
