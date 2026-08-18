
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readCustomer: vi.fn(),
  mutateCustomer: vi.fn(),
}));

vi.mock('@/server/orchestration/institution-customer-controlled-write-runtime', () => ({
  readCurrentInstitutionCustomerControlledV1: mocks.readCustomer,
  mutateCurrentInstitutionCustomerControlledV1: mocks.mutateCustomer,
}));

import {
  GET,
  PATCH,
} from '@/app/api/v1/institution/customers/[customerId]/route';

const record = {
  contractVersion: 'v1',
  customerId: 'customer-1',
  displayName: '客户甲',
  lifecycle: 'consulting',
  priority: 'high',
  ownerUserId: 'consultant-1',
  projectInterest: '皮肤管理',
  updatedAt: '2026-08-18T12:00:00.000Z',
  permissions: { canUpdate: true, canReassignOwner: true },
};

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.readCustomer.mockResolvedValue({ kind: 'ready', record });
  mocks.mutateCustomer.mockResolvedValue({ kind: 'ready', record });
});

describe('/api/v1/institution/customers/[customerId]', () => {
  it('GET returns controlled low-sensitive detail', async () => {
    const response = await GET(
      new Request('http://localhost/api/v1/institution/customers/customer-1'),
      { params: Promise.resolve({ customerId: 'customer-1' }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.readCustomer).toHaveBeenCalledWith('customer-1');
  });

  it('PATCH delegates expectedUpdatedAt CAS and maps stale conflict', async () => {
    const command = {
      expectedUpdatedAt: record.updatedAt,
      changes: { priority: 'medium' },
    };
    const response = await PATCH(
      new Request('http://localhost/api/v1/institution/customers/customer-1', {
        method: 'PATCH',
        body: JSON.stringify(command),
      }),
      { params: Promise.resolve({ customerId: 'customer-1' }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.mutateCustomer).toHaveBeenCalledWith('customer-1', command);

    mocks.mutateCustomer.mockResolvedValueOnce({
      kind: 'conflict',
      code: 'stale_update',
    });
    const conflict = await PATCH(
      new Request('http://localhost/api/v1/institution/customers/customer-1', {
        method: 'PATCH',
        body: JSON.stringify(command),
      }),
      { params: Promise.resolve({ customerId: 'customer-1' }) },
    );
    expect(conflict.status).toBe(409);
  });
});
