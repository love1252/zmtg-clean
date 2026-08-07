import { sql, type SQL } from 'drizzle-orm';

import {
  CrossTenantTransferTransactionError,
  type CrossTenantTransferTransactionContext,
  type CrossTenantTransferTransactionPort,
} from '@/modules/access-control/application/cross-tenant-transfer-service';
import type { MembershipCommandUnitOfWork } from '@/modules/access-control/ports/membership-command-unit-of-work';
import {
  MEMBERSHIP_COMMAND_IDLE_TIMEOUT_MS,
  MEMBERSHIP_COMMAND_LOCK_TIMEOUT_MS,
  MEMBERSHIP_COMMAND_STATEMENT_TIMEOUT_MS,
  MEMBERSHIP_COMMAND_TRANSACTION_OPTIONS,
  createTransactionBoundMembershipCommandUnitOfWork,
  type MembershipCommandTransactionDatabase,
  type TransactionBoundScopeAssertionFactory,
} from '@/modules/access-control/server/membership-command-repository';
import type { TenantDatabase } from '@/server/db/client';

export const CROSS_TENANT_TRANSFER_TRANSACTION_OPTIONS =
  MEMBERSHIP_COMMAND_TRANSACTION_OPTIONS;
export const CROSS_TENANT_TRANSFER_STATEMENT_TIMEOUT_MS =
  MEMBERSHIP_COMMAND_STATEMENT_TIMEOUT_MS;
export const CROSS_TENANT_TRANSFER_LOCK_TIMEOUT_MS =
  MEMBERSHIP_COMMAND_LOCK_TIMEOUT_MS;
export const CROSS_TENANT_TRANSFER_IDLE_TIMEOUT_MS =
  MEMBERSHIP_COMMAND_IDLE_TIMEOUT_MS;
export const CROSS_TENANT_TRANSFER_LOCK_NAMESPACE =
  'base02-cross-tenant-transfer';

class CrossTenantTransferCallbackFailure {
  constructor(readonly reason: unknown) {}
}

async function executeStatement(
  transaction: TenantDatabase,
  statement: SQL,
): Promise<void> {
  try {
    await transaction.execute(statement);
  } catch {
    throw new CrossTenantTransferTransactionError(
      'transfer_repository_unavailable',
    );
  }
}

function createAccountLockGuardedUnitOfWork(
  unitOfWork: MembershipCommandUnitOfWork,
  isActive: () => boolean,
  isAccountLocked: () => boolean,
): MembershipCommandUnitOfWork {
  const assertAccountLock = (): void => {
    if (!isActive() || !isAccountLocked()) {
      throw new CrossTenantTransferTransactionError(
        'transfer_account_lock_required',
      );
    }
  };

  const guarded: MembershipCommandUnitOfWork = {
    lockCreateIdentity: async (input) => {
      assertAccountLock();
      return unitOfWork.lockCreateIdentity(input);
    },
    lockMembershipByTenantUser: async (input) => {
      assertAccountLock();
      return unitOfWork.lockMembershipByTenantUser(input);
    },
    lockMembershipById: async (input) => {
      assertAccountLock();
      return unitOfWork.lockMembershipById(input);
    },
    lockActiveBinding: async (input) => {
      assertAccountLock();
      return unitOfWork.lockActiveBinding(input);
    },
    lockBindingById: async (input) => {
      assertAccountLock();
      return unitOfWork.lockBindingById(input);
    },
    commandExists: async (input) => {
      assertAccountLock();
      return unitOfWork.commandExists(input);
    },
    insertMembership: async (current) => {
      assertAccountLock();
      return unitOfWork.insertMembership(current);
    },
    updateMembershipByCas: async (input) => {
      assertAccountLock();
      return unitOfWork.updateMembershipByCas(input);
    },
    insertActiveBinding: async (row) => {
      assertAccountLock();
      return unitOfWork.insertActiveBinding(row);
    },
    revokeActiveBindingByCas: async (input) => {
      assertAccountLock();
      return unitOfWork.revokeActiveBindingByCas(input);
    },
    appendBindingTransition: async (transition) => {
      assertAccountLock();
      return unitOfWork.appendBindingTransition(transition);
    },
    appendTransition: async (transition) => {
      assertAccountLock();
      return unitOfWork.appendTransition(transition);
    },
  };

  return Object.freeze(guarded);
}

function isCanonicalAccountId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 96 &&
    value.trim() === value &&
    value.normalize('NFC') === value
  );
}

export function createCrossTenantTransferTransactionPort(
  database: TenantDatabase,
  dependencies: Readonly<{
    createScopeAssertion?: TransactionBoundScopeAssertionFactory;
  }> = {},
): CrossTenantTransferTransactionPort {
  return Object.freeze({
    run: async <T>(
      work: (context: CrossTenantTransferTransactionContext) => Promise<T>,
    ): Promise<T> => {
      let callbackCompleted = false;

      try {
        const result = await database.transaction(
          async (transactionDatabase) => {
            const transaction = transactionDatabase as unknown as
              MembershipCommandTransactionDatabase;
            const tenantTransaction = transaction as unknown as TenantDatabase;

            await executeStatement(tenantTransaction, sql`
              SET LOCAL statement_timeout = '5000ms'
            `);
            await executeStatement(tenantTransaction, sql`
              SET LOCAL lock_timeout = '1000ms'
            `);
            await executeStatement(tenantTransaction, sql`
              SET LOCAL idle_in_transaction_session_timeout = '5000ms'
            `);

            let active = true;
            let lockedAccountId: string | null = null;
            const isActive = (): boolean => active;
            const isAccountLocked = (): boolean => lockedAccountId !== null;

            const baseUnitOfWork =
              createTransactionBoundMembershipCommandUnitOfWork(
                transaction,
                isActive,
              );
            const unitOfWork = createAccountLockGuardedUnitOfWork(
              baseUnitOfWork,
              isActive,
              isAccountLocked,
            );
            const baseScopeAssertion = dependencies.createScopeAssertion?.(
              transaction,
              isActive,
            );
            const scopeAssertion = baseScopeAssertion === undefined
              ? undefined
              : Object.freeze({
                  assertActive: async (
                    input: Readonly<{
                      tenantId: string;
                      institutionId: string;
                    }>,
                  ) => {
                    if (!active || lockedAccountId === null) {
                      return Object.freeze({
                        kind: 'rejected' as const,
                        code: 'scope_unavailable' as const,
                      });
                    }
                    return baseScopeAssertion.assertActive(input);
                  },
                });

            const context: CrossTenantTransferTransactionContext =
              Object.freeze({
                unitOfWork,
                scopeAssertion,
                lockTransferAccount: async (
                  input: Readonly<{ accountId: string }>,
                ): Promise<void> => {
                  if (!active || !isCanonicalAccountId(input.accountId)) {
                    throw new CrossTenantTransferTransactionError(
                      'transfer_repository_unavailable',
                    );
                  }
                  if (lockedAccountId !== null) {
                    if (lockedAccountId === input.accountId) return;
                    throw new CrossTenantTransferTransactionError(
                      'transfer_account_lock_mismatch',
                    );
                  }
                  await executeStatement(tenantTransaction, sql`
                    SELECT pg_catalog.pg_advisory_xact_lock(
                      pg_catalog.hashtext(${CROSS_TENANT_TRANSFER_LOCK_NAMESPACE}),
                      pg_catalog.hashtext(${input.accountId})
                    )
                  `);
                  lockedAccountId = input.accountId;
                },
              });

            try {
              const value = await work(context);
              callbackCompleted = true;
              return { value };
            } catch (error) {
              throw new CrossTenantTransferCallbackFailure(error);
            } finally {
              active = false;
            }
          },
          CROSS_TENANT_TRANSFER_TRANSACTION_OPTIONS,
        );
        return result.value;
      } catch (error) {
        if (error instanceof CrossTenantTransferCallbackFailure) {
          throw error.reason;
        }
        if (callbackCompleted) {
          throw new CrossTenantTransferTransactionError(
            'transfer_outcome_unknown',
          );
        }
        if (error instanceof CrossTenantTransferTransactionError) {
          throw error;
        }
        throw new CrossTenantTransferTransactionError(
          'transfer_repository_unavailable',
        );
      }
    },
  });
}
