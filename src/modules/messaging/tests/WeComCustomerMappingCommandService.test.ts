import { describe, expect, it, vi } from 'vitest';

import {
  createWeComMappingCommandService,
  WeComMappingCommandInputError,
  type WeComMappingCommandRepository,
  type WeComMappingState,
} from '@/modules/messaging/application/wecom-customer-mapping-command-service';

const state: WeComMappingState = {
  id: 'mapping-01',
  tenantId: 'tenant-a',
  institutionId: 'inst-a',
  proofContactId: 'contact-proof-a',
  proofEmployeeId: 'employee-proof-a',
  sourceMode: 'real_readonly_proof',
  customerId: 'customer-a',
  status: 'confirmed',
  decidedBy: 'user-a',
  decidedAt: '2026-08-08T08:00:00.000Z',
  createdAt: '2026-08-08T08:00:00.000Z',
  updatedAt: '2026-08-08T08:00:00.000Z',
};

function createRepositoryMock() {
  const create = vi.fn(async () => state);
  const update = vi.fn(async () => state);
  const repository = { create, update } as WeComMappingCommandRepository;
  return { repository, create, update };
}

describe('WeComMappingCommandService', () => {
  it('create 仅从 canonical scope 注入 tenant + institution + proofContact', async () => {
    const mock = createRepositoryMock();
    const service = createWeComMappingCommandService(mock.repository);

    await service.createMapping({
      scope: {
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        proofContactId: 'contact-proof-a',
      },
      mapping: {
        id: 'mapping-01',
        proofEmployeeId: 'employee-proof-a',
        sourceMode: 'real_readonly_proof',
        customerId: 'customer-a',
        status: 'confirmed',
        tenantId: 'attacker-tenant',
        institutionId: 'attacker-inst',
        proofContactId: 'attacker-proof',
      } as never,
      decision: {
        decidedBy: 'user-a',
        decidedAt: '2026-08-08T08:00:00.000Z',
      },
    });

    expect(mock.create).toHaveBeenCalledWith({
      id: 'mapping-01',
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      proofContactId: 'contact-proof-a',
      proofEmployeeId: 'employee-proof-a',
      sourceMode: 'real_readonly_proof',
      customerId: 'customer-a',
      status: 'confirmed',
      decidedBy: 'user-a',
      decidedAt: '2026-08-08T08:00:00.000Z',
    });
  });

  it('缺失或非规范 scope 时 fail-closed 且不调用 repository', async () => {
    const mock = createRepositoryMock();
    const service = createWeComMappingCommandService(mock.repository);

    await expect(
      service.createMapping({
        scope: {
          tenantId: 'tenant-a',
          institutionId: '',
          proofContactId: 'contact-proof-a',
        },
        mapping: {
          id: 'mapping-01',
          proofEmployeeId: 'employee-proof-a',
          sourceMode: 'real_readonly_proof',
          customerId: 'customer-a',
          status: 'confirmed',
        },
        decision: {
          decidedBy: 'user-a',
          decidedAt: '2026-08-08T08:00:00.000Z',
        },
      }),
    ).rejects.toBeInstanceOf(WeComMappingCommandInputError);

    await expect(
      service.updateMapping({
        scope: {
          tenantId: ' tenant-a',
          institutionId: 'inst-a',
          proofContactId: 'contact-proof-a',
        },
        transition: {
          customerId: 'customer-a',
          expectedCustomerId: 'customer-a',
          expectedStatus: 'confirmed',
          status: 'revoked',
        },
        decision: {
          decidedBy: 'user-a',
          decidedAt: '2026-08-08T09:00:00.000Z',
        },
      }),
    ).rejects.toBeInstanceOf(WeComMappingCommandInputError);

    expect(mock.create).not.toHaveBeenCalled();
    expect(mock.update).not.toHaveBeenCalled();
  });

  it('update 固定 scope 与 expected state，剥离伪造 scope 字段', async () => {
    const mock = createRepositoryMock();
    const service = createWeComMappingCommandService(mock.repository);

    await service.updateMapping({
      scope: {
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        proofContactId: 'contact-proof-a',
      },
      transition: {
        customerId: 'customer-b',
        expectedCustomerId: 'customer-a',
        expectedStatus: 'confirmed',
        status: 'revoked',
        tenantId: 'attacker-tenant',
        institutionId: 'attacker-inst',
        proofContactId: 'attacker-proof',
      } as never,
      decision: {
        decidedBy: 'user-a',
        decidedAt: '2026-08-08T09:00:00.000Z',
      },
    });

    expect(mock.update).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      proofContactId: 'contact-proof-a',
      customerId: 'customer-b',
      expectedCustomerId: 'customer-a',
      expectedStatus: 'confirmed',
      status: 'revoked',
      decidedBy: 'user-a',
      decidedAt: '2026-08-08T09:00:00.000Z',
    });
  });

  it('stale/conflict repository null 保持 fail-closed null 语义', async () => {
    const repository = {
      create: vi.fn(async () => null),
      update: vi.fn(async () => null),
    } as WeComMappingCommandRepository;
    const service = createWeComMappingCommandService(repository);

    await expect(
      service.updateMapping({
        scope: {
          tenantId: 'tenant-a',
          institutionId: 'inst-a',
          proofContactId: 'contact-proof-a',
        },
        transition: {
          customerId: 'customer-b',
          expectedCustomerId: 'customer-a',
          expectedStatus: 'confirmed',
          status: 'revoked',
        },
        decision: {
          decidedBy: 'user-a',
          decidedAt: '2026-08-08T09:00:00.000Z',
        },
      }),
    ).resolves.toBeNull();
  });
});
