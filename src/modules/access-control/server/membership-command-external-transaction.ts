import { sql, type SQL } from 'drizzle-orm';

import {
  createMembershipCommandId,
  createMembershipTransitionId,
  executeMembershipCommandWithUnitOfWork,
  type MembershipCommandBlockCode,
} from '@/modules/access-control/application/membership-command-service';
import { MembershipCommandPersistenceError } from '@/modules/access-control/ports/membership-command-unit-of-work';
import {
  MEMBERSHIP_COMMAND_TRANSACTION_OPTIONS,
  createTransactionBoundMembershipCommandUnitOfWork,
  type MembershipCommandTransactionDatabase,
} from '@/modules/access-control/server/membership-command-repository';
import type { TenantDatabase } from '@/server/db/client';

export const MEMBERSHIP_EXTERNAL_TRANSACTION_ADAPTER_ERROR_CODES = [
  'membership_onboarding_command_result_invalid',
  'membership_onboarding_invocation_count_invalid',
] as const;

export type MembershipExternalTransactionErrorCode =
  | MembershipCommandBlockCode
  | (typeof MEMBERSHIP_EXTERNAL_TRANSACTION_ADAPTER_ERROR_CODES)[number];

export class MembershipExternalTransactionError extends Error {
  constructor(readonly code: MembershipExternalTransactionErrorCode) {
    super(code);
    this.name = 'MembershipExternalTransactionError';
  }
}

export type FormalOnboardingMembershipIntent = Readonly<{
  membershipId: string;
  tenantId: string;
  userId: string;
  role: 'tenant_admin';
  displayName: string;
  actorId: string;
  occurredAt: string;
}>;

export type FormalOnboardingMembershipCommands = Readonly<{
  createMembership(intent: FormalOnboardingMembershipIntent): Promise<void>;
}>;

export type MembershipExternalTransactionAdapter = Readonly<{
  transactionOptions: typeof MEMBERSHIP_COMMAND_TRANSACTION_OPTIONS;
  run<T>(
    transaction: TenantDatabase,
    work: (commands: FormalOnboardingMembershipCommands) => Promise<T>,
  ): Promise<T>;
}>;

type MembershipExternalTransactionDependencies = Readonly<{
  createCommandId?: () => string;
  createTransitionId?: () => string;
  now?: () => Date;
}>;

async function executeSetLocal(
  transaction: TenantDatabase,
  statement: SQL,
): Promise<void> {
  try {
    await transaction.execute(statement);
  } catch {
    throw new MembershipCommandPersistenceError(
      'membership_command_repository_unavailable',
    );
  }
}

function fail(code: MembershipExternalTransactionErrorCode): never {
  throw new MembershipExternalTransactionError(code);
}

/**
 * 将调用方已经开启的单一外层事务适配为 Access Control transaction-bound
 * Membership command。该适配器绝不创建事务，也不向调用方暴露品牌类型。
 */
export function createMembershipCommandExternalTransactionAdapter(
  dependencies: MembershipExternalTransactionDependencies = {},
): MembershipExternalTransactionAdapter {
  return Object.freeze({
    transactionOptions: MEMBERSHIP_COMMAND_TRANSACTION_OPTIONS,
    run: async <T>(
      transaction: TenantDatabase,
      work: (commands: FormalOnboardingMembershipCommands) => Promise<T>,
    ): Promise<T> => {
      let active = false;
      let commandAttempts = 0;
      let commandApplied = false;

      try {
        await executeSetLocal(transaction, sql`
          SET LOCAL statement_timeout = '5000ms'
        `);
        await executeSetLocal(transaction, sql`
          SET LOCAL lock_timeout = '1000ms'
        `);
        await executeSetLocal(transaction, sql`
          SET LOCAL idle_in_transaction_session_timeout = '5000ms'
        `);
        active = true;

        const unitOfWork = createTransactionBoundMembershipCommandUnitOfWork(
          transaction as unknown as MembershipCommandTransactionDatabase,
          () => active,
        );
        const commands: FormalOnboardingMembershipCommands = Object.freeze({
          createMembership: async (
            intent: FormalOnboardingMembershipIntent,
          ): Promise<void> => {
            if (!active) {
              throw new MembershipCommandPersistenceError(
                'membership_command_repository_unavailable',
              );
            }
            commandAttempts += 1;
            if (commandAttempts !== 1) {
              fail('membership_onboarding_invocation_count_invalid');
            }

            let result;
            let commandId: string;
            try {
              commandId = (dependencies.createCommandId ??
                createMembershipCommandId)();
              result = await executeMembershipCommandWithUnitOfWork({
                unitOfWork,
                command: Object.freeze({
                  kind: 'create' as const,
                  commandId,
                  tenantId: intent.tenantId,
                  membershipId: intent.membershipId,
                  actorId: intent.actorId,
                  reasonCode: 'formal_onboarding',
                  occurredAt: intent.occurredAt,
                  expectedRevision: null,
                  userId: intent.userId,
                  role: intent.role,
                  displayName: intent.displayName,
                  source: 'formal_onboarding' as const,
                  binding: null,
                }),
                createTransitionId:
                  dependencies.createTransitionId ??
                  createMembershipTransitionId,
                now: dependencies.now,
              });
            } catch (error) {
              if (
                error instanceof MembershipCommandPersistenceError ||
                error instanceof MembershipExternalTransactionError
              ) {
                throw error;
              }
              throw new MembershipCommandPersistenceError(
                'membership_command_repository_unavailable',
              );
            }

            if (result.status === 'blocked') {
              fail(result.code);
            }
            if (
              result.status !== 'applied' ||
              result.commandId !== commandId ||
              result.membershipId !== intent.membershipId ||
              result.revision !== 1 ||
              result.lifecycleStatus !== 'active' ||
              result.role !== 'tenant_admin' ||
              result.binding.kind !== 'unchanged'
            ) {
              fail('membership_onboarding_command_result_invalid');
            }
            commandApplied = true;
          },
        });

        const result = await work(commands);
        if (commandAttempts !== 1 || !commandApplied) {
          fail('membership_onboarding_invocation_count_invalid');
        }
        return result;
      } finally {
        active = false;
      }
    },
  });
}
