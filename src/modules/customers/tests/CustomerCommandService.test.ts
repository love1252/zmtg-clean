import { describe, expect, it, vi } from 'vitest';

import {
  CustomerCommandInputError,
  createCustomerCommandService,
  type CustomerCommandRecord,
  type CustomerCommandRepository,
} from '@/modules/customers/application/customer-command-service';

const customerRecord: CustomerCommandRecord = {
  id: 'cust_001',
  tenantId: 'tenant_001',
  institutionId: 'inst_001',
  displayName: '王女士',
  lifecycle: 'consulting',
  priority: 'high',
  ownerUserId: 'user_001',
  projectInterest: '皮肤管理',
  maskedPhone: '138****0001',
  maskedMedicalRecordNo: 'MR****001',
  lastTouchSummary: '首次咨询',
  nextAction: '人工跟进',
  tags: ['重点'],
  gender: 'female',
  birthDate: '1990-01',
  referralSource: '转介绍',
  notes: '低敏备注',
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
  it('create 只从 server attribution 注入 tenantId + institutionId 并剥离伪造归属字段', async () => {
    const mock = createRepositoryMock();
    const service = createCustomerCommandService(mock.repository);

    await service.createCustomer({
      attribution: {
        tenantId: 'tenant_001',
        institutionId: 'inst_001',
      },
      customer: {
        id: 'cust_001',
        displayName: '王女士',
        lifecycle: 'consulting',
        priority: 'high',
        ownerUserId: 'user_001',
        projectInterest: '皮肤管理',
        maskedPhone: '138****0001',
        maskedMedicalRecordNo: 'MR****001',
        lastTouchSummary: '首次咨询',
        nextAction: '人工跟进',
        tags: ['重点'],
        gender: 'female',
        birthDate: '1990-01',
        referralSource: '转介绍',
        notes: '低敏备注',
        tenantId: 'attacker_tenant',
        institutionId: 'attacker_institution',
      } as never,
    });

    expect(mock.create).toHaveBeenCalledWith({
      ...customerRecord,
      tenantId: 'tenant_001',
      institutionId: 'inst_001',
    });
  });

  it('缺失或非规范 server attribution 时 fail-closed 且不触发 repository', async () => {
    const mock = createRepositoryMock();
    const service = createCustomerCommandService(mock.repository);

    await expect(
      service.createCustomer({
        attribution: {
          tenantId: ' tenant_001',
          institutionId: 'inst_001',
        },
        customer: customerRecord,
      }),
    ).rejects.toBeInstanceOf(CustomerCommandInputError);

    await expect(
      service.updateCustomer({
        attribution: {
          tenantId: 'tenant_001',
          institutionId: '',
        },
        customerId: 'cust_001',
        changes: { displayName: '更新' },
      }),
    ).rejects.toBeInstanceOf(CustomerCommandInputError);

    expect(mock.create).not.toHaveBeenCalled();
    expect(mock.update).not.toHaveBeenCalled();
  });

  it('update 固定 customerId 与 attribution，剥离 identity/attribution/createdAt 注入', async () => {
    const mock = createRepositoryMock();
    const service = createCustomerCommandService(mock.repository);

    await service.updateCustomer({
      attribution: {
        tenantId: 'tenant_001',
        institutionId: 'inst_001',
      },
      customerId: 'cust_001',
      changes: {
        displayName: '王女士更新',
        tags: ['更新'],
        id: 'attacker_customer',
        tenantId: 'attacker_tenant',
        institutionId: 'attacker_institution',
        createdAt: new Date(),
      } as never,
    });

    expect(mock.update).toHaveBeenCalledWith({
      tenantId: 'tenant_001',
      institutionId: 'inst_001',
      id: 'cust_001',
      changes: {
        displayName: '王女士更新',
        tags: ['更新'],
      },
    });
  });

  it('update repository 返回 null 时保持 not-found 语义', async () => {
    const update = vi.fn(async () => null);
    const repository = {
      create: vi.fn(),
      update,
    } as unknown as CustomerCommandRepository;
    const service = createCustomerCommandService(repository);

    await expect(
      service.updateCustomer({
        attribution: {
          tenantId: 'tenant_001',
          institutionId: 'inst_001',
        },
        customerId: 'cust_missing',
        changes: { displayName: '不存在' },
      }),
    ).resolves.toBeNull();
  });
});
