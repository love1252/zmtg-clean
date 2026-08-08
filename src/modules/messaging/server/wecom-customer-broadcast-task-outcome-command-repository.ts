import { and, eq } from 'drizzle-orm';

import type {
  BroadcastOutcomeCommandRepository,
  BroadcastOutcomeRepositoryCreateInput,
  BroadcastOutcomeRepositoryUpdateInput,
  BroadcastOutcomeState,
} from '@/modules/messaging/application/wecom-customer-broadcast-task-outcome-command-service';
import type { TenantDatabase } from '@/server/db/client';
import { weComCustomerBroadcastTaskProviderAttempts } from '@/server/db/schema';

type ProviderAttemptRow = typeof weComCustomerBroadcastTaskProviderAttempts.$inferSelect;

function mapRow(row: ProviderAttemptRow): BroadcastOutcomeState {
  return {
    id: row.id,
    operationId: row.operationId,
    operationRef: row.operationRef,
    tenantId: row.tenantId,
    institutionId: row.institutionId,
    customerId: row.customerId,
    capabilityKind: row.capabilityKind as 'customer_broadcast_task',
    providerKind: row.providerKind as 'wecom_official_customer_broadcast',
    dispatchState: row.dispatchState,
    dispatchCount: row.dispatchCount as 0 | 1,
    dispatchStartedAt: row.dispatchStartedAt?.toISOString() ?? null,
    dispatchTerminalAt: row.dispatchTerminalAt?.toISOString() ?? null,
    taskRefDigest: row.taskRefDigest,
    memberConfirmationRequired: true,
    providerResultCategory: row.providerResultCategory,
    sendResultStatus: row.sendResultStatus,
    sendResultCheckedAt: row.sendResultCheckedAt?.toISOString() ?? null,
    finalizeState: row.finalizeState,
    reconciliationState: row.reconciliationState,
    manualReviewRequired: row.manualReviewRequired,
    automaticRetryAllowed: false,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function outcomeMatchesInput(input: BroadcastOutcomeRepositoryUpdateInput) {
  const { outcome } = input;
  return (
    outcome.tenantId === input.tenantId &&
    outcome.institutionId === input.institutionId &&
    outcome.customerId === input.customerId &&
    outcome.operationId === input.operationId &&
    outcome.operationRef === input.operationRef &&
    outcome.version === input.expectedVersion + 1 &&
    outcome.capabilityKind === 'customer_broadcast_task' &&
    outcome.providerKind === 'wecom_official_customer_broadcast' &&
    outcome.memberConfirmationRequired === true &&
    outcome.finalizeState === 'not_finalized' &&
    outcome.automaticRetryAllowed === false
  );
}

export function createBroadcastOutcomeCommandRepository(
  database: TenantDatabase,
): BroadcastOutcomeCommandRepository {
  return Object.freeze({
    async createNotStarted(
      input: BroadcastOutcomeRepositoryCreateInput,
    ): Promise<BroadcastOutcomeState | null> {
      const occurredAt = new Date(input.occurredAt);
      const [row] = await database
        .insert(weComCustomerBroadcastTaskProviderAttempts)
        .values({
          id: input.id,
          operationId: input.operationId,
          operationRef: input.operationRef,
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          customerId: input.customerId,
          capabilityKind: 'customer_broadcast_task',
          providerKind: 'wecom_official_customer_broadcast',
          dispatchState: 'not_started',
          dispatchCount: 0,
          memberConfirmationRequired: true,
          sendResultStatus: 'not_checked',
          finalizeState: 'not_finalized',
          reconciliationState: 'none',
          manualReviewRequired: false,
          automaticRetryAllowed: false,
          version: 1,
          createdAt: occurredAt,
          updatedAt: occurredAt,
        })
        .onConflictDoNothing()
        .returning();

      return row ? mapRow(row) : null;
    },

    async updateWhenVersionMatches(
      input: BroadcastOutcomeRepositoryUpdateInput,
    ): Promise<BroadcastOutcomeState | null> {
      if (!outcomeMatchesInput(input)) return null;

      const outcome = input.outcome;
      const [row] = await database
        .update(weComCustomerBroadcastTaskProviderAttempts)
        .set({
          dispatchState: outcome.dispatchState,
          dispatchCount: outcome.dispatchCount,
          dispatchStartedAt: outcome.dispatchStartedAt
            ? new Date(outcome.dispatchStartedAt)
            : null,
          dispatchTerminalAt: outcome.dispatchTerminalAt
            ? new Date(outcome.dispatchTerminalAt)
            : null,
          taskRefDigest: outcome.taskRefDigest,
          memberConfirmationRequired: true,
          providerResultCategory: outcome.providerResultCategory,
          sendResultStatus: outcome.sendResultStatus,
          sendResultCheckedAt: outcome.sendResultCheckedAt
            ? new Date(outcome.sendResultCheckedAt)
            : null,
          finalizeState: outcome.finalizeState,
          reconciliationState: outcome.reconciliationState,
          manualReviewRequired: outcome.manualReviewRequired,
          automaticRetryAllowed: false,
          version: outcome.version,
          updatedAt: new Date(outcome.updatedAt),
        })
        .where(
          and(
            eq(
              weComCustomerBroadcastTaskProviderAttempts.tenantId,
              input.tenantId,
            ),
            eq(
              weComCustomerBroadcastTaskProviderAttempts.institutionId,
              input.institutionId,
            ),
            eq(
              weComCustomerBroadcastTaskProviderAttempts.customerId,
              input.customerId,
            ),
            eq(
              weComCustomerBroadcastTaskProviderAttempts.operationId,
              input.operationId,
            ),
            eq(
              weComCustomerBroadcastTaskProviderAttempts.operationRef,
              input.operationRef,
            ),
            eq(
              weComCustomerBroadcastTaskProviderAttempts.version,
              input.expectedVersion,
            ),
            eq(
              weComCustomerBroadcastTaskProviderAttempts.finalizeState,
              'not_finalized',
            ),
          ),
        )
        .returning();

      return row ? mapRow(row) : null;
    },
  });
}
