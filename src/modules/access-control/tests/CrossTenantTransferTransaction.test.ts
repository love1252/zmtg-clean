import { describe, expect, it, vi } from 'vitest';

import { CrossTenantTransferTransactionError } from '@/modules/access-control/application/cross-tenant-transfer-service';
import {
  CROSS_TENANT_TRANSFER_IDLE_TIMEOUT_MS,
  CROSS_TENANT_TRANSFER_LOCK_NAMESPACE,
  CROSS_TENANT_TRANSFER_LOCK_TIMEOUT_MS,
  CROSS_TENANT_TRANSFER_STATEMENT_TIMEOUT_MS,
  CROSS_TENANT_TRANSFER_TRANSACTION_OPTIONS,
  createCrossTenantTransferTransactionPort,
} from '@/modules/access-control/server/cross-tenant-transfer-transaction';
import type { TenantDatabase } from '@/server/db/client';

type TransactionWork = (transaction: TenantDatabase) => Promise<unknown>;

function databaseHarness(input: Readonly<{
  commitFailure?: boolean;
  executeFailureAt?: number;
}> = {}) {
  let executeCount = 0;
  const execute = vi.fn(async () => {
    executeCount += 1;
    if (input.executeFailureAt === executeCount) {
      throw new Error('synthetic execute failure');
    }
    return [];
  });
  const transactionDatabase = {
    execute,
  } as unknown as TenantDatabase;

  const seenOptions: unknown[] = [];
  const transaction = vi.fn(
    async (work: TransactionWork, options: unknown) => {
      seenOptions.push(options);
      const value = await work(transactionDatabase);
      if (input.commitFailure) {
        throw new Error('synthetic commit disconnect');
      }
      return value;
    },
  );
  const database = {
    transaction,
  } as unknown as TenantDatabase;

  return {
    database,
    execute,
    transaction,
    seenOptions,
  };
}

describe('BASE-B5 cross-tenant transfer transaction', () => {
  it('固定 SERIALIZABLE READ WRITE 与 timeout，并在 tenant-scoped UoW 前获取 account advisory xact lock', async () => {
    const test = databaseHarness();
    const port = createCrossTenantTransferTransactionPort(test.database);

    const result = await port.run(async ({
      lockTransferAccount,
      unitOfWork,
    }) => {
      expect(test.execute).toHaveBeenCalledTimes(3);

      await lockTransferAccount({ accountId: 'account-001' });
      expect(test.execute).toHaveBeenCalledTimes(4);

      await unitOfWork.lockCreateIdentity({
        tenantId: 'tenant-target',
        userId: 'account-001',
      });
      expect(test.execute).toHaveBeenCalledTimes(5);
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(test.transaction).toHaveBeenCalledTimes(1);
    expect(test.seenOptions).toEqual([
      {
        isolationLevel: 'serializable',
        accessMode: 'read write',
      },
    ]);
    expect(CROSS_TENANT_TRANSFER_TRANSACTION_OPTIONS).toEqual({
      isolationLevel: 'serializable',
      accessMode: 'read write',
    });
    expect(CROSS_TENANT_TRANSFER_STATEMENT_TIMEOUT_MS).toBe(5_000);
    expect(CROSS_TENANT_TRANSFER_LOCK_TIMEOUT_MS).toBe(1_000);
    expect(CROSS_TENANT_TRANSFER_IDLE_TIMEOUT_MS).toBe(5_000);
    expect(CROSS_TENANT_TRANSFER_LOCK_NAMESPACE).toBe(
      'base02-cross-tenant-transfer',
    );
  });

  it('account lock 之前调用 UoW fail-closed', async () => {
    const test = databaseHarness();
    const port = createCrossTenantTransferTransactionPort(test.database);

    await expect(
      port.run(async ({ unitOfWork }) => {
        await unitOfWork.lockCreateIdentity({
          tenantId: 'tenant-target',
          userId: 'account-001',
        });
      }),
    ).rejects.toMatchObject({
      code: 'transfer_account_lock_required',
    });
    expect(test.transaction).toHaveBeenCalledTimes(1);
    expect(test.execute).toHaveBeenCalledTimes(3);
  });

  it('同 account 重复 lock 幂等，不重复获取 advisory lock', async () => {
    const test = databaseHarness();
    const port = createCrossTenantTransferTransactionPort(test.database);

    await port.run(async ({ lockTransferAccount }) => {
      await lockTransferAccount({ accountId: 'account-001' });
      await lockTransferAccount({ accountId: 'account-001' });
    });

    expect(test.execute).toHaveBeenCalledTimes(4);
  });

  it('一个 transaction 尝试切换到第二 account 时 fail-closed', async () => {
    const test = databaseHarness();
    const port = createCrossTenantTransferTransactionPort(test.database);

    await expect(
      port.run(async ({ lockTransferAccount }) => {
        await lockTransferAccount({ accountId: 'account-001' });
        await lockTransferAccount({ accountId: 'account-002' });
      }),
    ).rejects.toMatchObject({
      code: 'transfer_account_lock_mismatch',
    });
    expect(test.transaction).toHaveBeenCalledTimes(1);
    expect(test.execute).toHaveBeenCalledTimes(4);
  });

  it('callback failure 原样穿透且 transaction 不自动 retry', async () => {
    const test = databaseHarness();
    const port = createCrossTenantTransferTransactionPort(test.database);
    const failure = new CrossTenantTransferTransactionError(
      'transfer_repository_unavailable',
    );

    await expect(
      port.run(async ({ lockTransferAccount }) => {
        await lockTransferAccount({ accountId: 'account-001' });
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(test.transaction).toHaveBeenCalledTimes(1);
  });

  it('callback 已完成但 transaction promise 在 commit 阶段失败时标记 outcome unknown 且不 retry', async () => {
    const test = databaseHarness({ commitFailure: true });
    const port = createCrossTenantTransferTransactionPort(test.database);

    await expect(
      port.run(async ({ lockTransferAccount }) => {
        await lockTransferAccount({ accountId: 'account-001' });
        return 'staged';
      }),
    ).rejects.toMatchObject({
      code: 'transfer_outcome_unknown',
    });
    expect(test.transaction).toHaveBeenCalledTimes(1);
  });

  it('transaction setup SQL 失败时映射 repository unavailable', async () => {
    const test = databaseHarness({ executeFailureAt: 1 });
    const port = createCrossTenantTransferTransactionPort(test.database);

    await expect(
      port.run(async () => 'never'),
    ).rejects.toMatchObject({
      code: 'transfer_repository_unavailable',
    });
    expect(test.transaction).toHaveBeenCalledTimes(1);
  });
});
