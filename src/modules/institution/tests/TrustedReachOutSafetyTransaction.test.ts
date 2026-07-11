import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAuditRepository: vi.fn(),
  createCustomerRepository: vi.fn(),
  createSafetyRepository: vi.fn(),
}));

vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: mocks.createAuditRepository,
}));
vi.mock('@/modules/institution/server/tenant-business-repository', () => ({
  createTenantBusinessRepository: mocks.createCustomerRepository,
}));
vi.mock('@/modules/institution/server/trusted-reachout-safety-repository', () => ({
  createTrustedReachOutSafetyRepository: mocks.createSafetyRepository,
}));

import { runTrustedReachOutSafetyTransaction } from '@/modules/institution/server/trusted-reachout-safety-transaction';

describe('trusted reachout safety transaction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('consent、frequency 与 audit repository 均绑定同一个 transaction database', async () => {
    const transactionDatabase = { transaction: 'same-db' };
    const customerRepository = { kind: 'customer' };
    const safetyRepository = { kind: 'safety' };
    const auditRepository = { kind: 'audit' };
    mocks.createCustomerRepository.mockReturnValue(customerRepository);
    mocks.createSafetyRepository.mockReturnValue(safetyRepository);
    mocks.createAuditRepository.mockReturnValue(auditRepository);
    const database = {
      transaction: vi.fn(async (operation) => operation(transactionDatabase)),
    };

    const result = await runTrustedReachOutSafetyTransaction(database as never, async (repositories) => repositories);

    expect(mocks.createCustomerRepository).toHaveBeenCalledWith(transactionDatabase);
    expect(mocks.createSafetyRepository).toHaveBeenCalledWith(transactionDatabase);
    expect(mocks.createAuditRepository).toHaveBeenCalledWith(transactionDatabase);
    expect(result).toEqual({ customerRepository, safetyRepository, auditRepository });
  });

  it('audit 失败时 transaction 不提交已修改的状态或频控计数', async () => {
    let committedCount = 0;
    mocks.createCustomerRepository.mockReturnValue({});
    mocks.createSafetyRepository.mockImplementation((transactionDatabase) => ({
      increment: () => {
        (transactionDatabase as { count: number }).count += 1;
      },
    }));
    mocks.createAuditRepository.mockReturnValue({
      record: async () => {
        throw new Error('audit unavailable');
      },
    });
    const database = {
      transaction: async (operation: (database: { count: number }) => Promise<unknown>) => {
        const transactionDatabase = { count: committedCount };
        const result = await operation(transactionDatabase);
        committedCount = transactionDatabase.count;
        return result;
      },
    };

    await expect(runTrustedReachOutSafetyTransaction(database as never, async (repositories) => {
      const transactionRepositories = repositories as unknown as {
        safetyRepository: { increment: () => void };
        auditRepository: { record: () => Promise<void> };
      };
      transactionRepositories.safetyRepository.increment();
      await transactionRepositories.auditRepository.record();
    })).rejects.toThrow('audit unavailable');

    expect(committedCount).toBe(0);
  });
});
