
import { describe, expect, it, vi } from 'vitest';

import {
  CustomerCommandInputError,
  createCustomerCommandService,
  type CustomerCommandRecord,
  type CustomerCommandRepository,
} from '@/modules/customers/application/customer-command-service';

const UPDATED_AT = '2026-08-18T12:00:00.000Z';

const customerRecord: CustomerCommandRecord = {
  id: 'cust_001',
  tenantId: 'tenant_001',
  institutionId: 'inst_001',
  displayName: '王女士',
  lifecycle: 'consulting',
  priority: 'high',
  ownerUserId: 'user_001',
  projectInterest: '皮肤管理',
  maskedPhone: '',
  maskedMedicalRecordNo: '',
  lastTouchSummary: '',
  nextAction: '',
  tags: [],
  gender: '',
  birthDate: '',
  referralSource: '',
  notes: '',
  updatedAt: UPDATED_AT,
};

function createRepositoryMock() {
  const create = vi.fn(async () => customerRecord);
  const update = vi.fn(async () => customerRecord);
  return {
    repository: { create, update } as CustomerCommandRepository,
    create,
    update,
  };
}

describe('CustomerCommandService', () => {
  it('create injects exact server attribution and strips forged ownership fields', async () => {
    const mock = createRepositoryMock();
    const service = createCustomerCommandService(mock.repository);

    await service.createCustomer({
      attribution: { tenantId: 'tenant_001', institutionId: 'inst_001' },
      customer: {
        id: 'cust_001',
        displayName: '王女士',
        lifecycle: 'consulting',
        priority: 'high',
        ownerUserId: 'user_001',
        projectInterest: '皮肤管理',
        maskedPhone: '',
        maskedMedicalRecordNo: '',
        lastTouchSummary: '',
        nextAction: '',
        tags: [],
        gender: '',
        birthDate: '',
        referralSource: '',
        notes: '',
        tenantId: 'attacker',
        institutionId: 'attacker',
        updatedAt: 'attacker',
      } as never,
    });

    expect(mock.create).toHaveBeenCalledWith({
      id: 'cust_001',
      tenantId: 'tenant_001',
      institutionId: 'inst_001',
      displayName: '王女士',
      lifecycle: 'consulting',
      priority: 'high',
      ownerUserId: 'user_001',
      projectInterest: '皮肤管理',
      maskedPhone: '',
      maskedMedicalRecordNo: '',
      lastTouchSummary: '',
      nextAction: '',
      tags: [],
      gender: '',
      birthDate: '',
      referralSource: '',
      notes: '',
    });
  });

  it('update requires canonical expectedUpdatedAt and preserves exact scope', async () => {
    const mock = createRepositoryMock();
    const service = createCustomerCommandService(mock.repository);

    await service.updateCustomer({
      attribution: { tenantId: 'tenant_001', institutionId: 'inst_001' },
      customerId: 'cust_001',
      expectedUpdatedAt: UPDATED_AT,
      changes: {
        displayName: '王女士更新',
        id: 'attacker',
        tenantId: 'attacker',
      } as never,
    });

    expect(mock.update).toHaveBeenCalledWith({
      tenantId: 'tenant_001',
      institutionId: 'inst_001',
      id: 'cust_001',
      expectedUpdatedAt: UPDATED_AT,
      changes: { displayName: '王女士更新' },
    });
  });

  it('invalid attribution or CAS fails before repository', async () => {
    const mock = createRepositoryMock();
    const service = createCustomerCommandService(mock.repository);

    await expect(
      service.updateCustomer({
        attribution: { tenantId: 'tenant_001', institutionId: 'inst_001' },
        customerId: 'cust_001',
        expectedUpdatedAt: 'not-canonical',
        changes: { priority: 'medium' },
      }),
    ).rejects.toBeInstanceOf(CustomerCommandInputError);

    expect(mock.update).not.toHaveBeenCalled();
  });

  it('repository null remains a fail-closed update result', async () => {
    const repository = {
      create: vi.fn(),
      update: vi.fn(async () => null),
    } as unknown as CustomerCommandRepository;
    const service = createCustomerCommandService(repository);

    await expect(
      service.updateCustomer({
        attribution: { tenantId: 'tenant_001', institutionId: 'inst_001' },
        customerId: 'cust_missing',
        expectedUpdatedAt: UPDATED_AT,
        changes: { priority: 'medium' },
      }),
    ).resolves.toBeNull();
  });
});
