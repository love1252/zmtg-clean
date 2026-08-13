
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runReachOutTransaction: vi.fn(),
}));

vi.mock('@/server/orchestration/wecom-reachout-transaction', () => ({
  runAttributedWeComReachOutTransaction: mocks.runReachOutTransaction,
}));

import {
  runTrustedReachOutSafetyTransaction,
} from '@/modules/institution/server/trusted-reachout-safety-transaction';

describe('trusted reachout safety transaction compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('委托 top-level canonical orchestration 并只投影 Safety 所需依赖', async () => {
    const database = { kind: 'database' };
    const customerRepository = { kind: 'customer' };
    const mappingRepository = { kind: 'mapping' };
    const safetyRepository = { kind: 'canonical-safety' };
    const auditRepository = { kind: 'audit' };
    const auditAttribution = { kind: 'attribution' };

    mocks.runReachOutTransaction.mockImplementation(
      async (_database, _businessPair, operation) =>
        operation({
          customerRepository,
          mappingRepository,
          safetyRepository,
          auditRepository,
          auditAttribution,
        }),
    );

    const result = await runTrustedReachOutSafetyTransaction(
      database as never,
      { tenantId: 'tenant-a', institutionId: 'inst-a' },
      async (dependencies) => dependencies,
    );

    expect(mocks.runReachOutTransaction).toHaveBeenCalledWith(
      database,
      { tenantId: 'tenant-a', institutionId: 'inst-a' },
      expect.any(Function),
    );
    expect(result).toEqual({
      customerRepository,
      safetyRepository,
      auditRepository,
      auditAttribution,
    });
  });

  it('canonical orchestration 失败时原样传播，不回退 legacy transaction', async () => {
    mocks.runReachOutTransaction.mockRejectedValue(
      new Error('canonical-transaction-failed'),
    );

    await expect(
      runTrustedReachOutSafetyTransaction(
        {} as never,
        { tenantId: 'tenant-a', institutionId: 'inst-a' },
        async () => 'never',
      ),
    ).rejects.toThrow('canonical-transaction-failed');
  });
});
