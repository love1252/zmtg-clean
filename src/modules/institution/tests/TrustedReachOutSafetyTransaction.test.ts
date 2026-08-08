
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runReachOutTransaction: vi.fn(),
}));

vi.mock('@/server/orchestration/wecom-reachout-transaction', () => ({
  runWeComReachOutTransaction: mocks.runReachOutTransaction,
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

    mocks.runReachOutTransaction.mockImplementation(
      async (_database, operation) =>
        operation({
          customerRepository,
          mappingRepository,
          safetyRepository,
          auditRepository,
        }),
    );

    const result = await runTrustedReachOutSafetyTransaction(
      database as never,
      async (dependencies) => dependencies,
    );

    expect(mocks.runReachOutTransaction).toHaveBeenCalledWith(
      database,
      expect.any(Function),
    );
    expect(result).toEqual({
      customerRepository,
      safetyRepository,
      auditRepository,
    });
  });

  it('canonical orchestration 失败时原样传播，不回退 legacy transaction', async () => {
    mocks.runReachOutTransaction.mockRejectedValue(
      new Error('canonical-transaction-failed'),
    );

    await expect(
      runTrustedReachOutSafetyTransaction(
        {} as never,
        async () => 'never',
      ),
    ).rejects.toThrow('canonical-transaction-failed');
  });
});
