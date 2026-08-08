
import { and, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';

import type { WeComRealSendProofOperation } from '@/modules/institution/domain/wecom-real-send-proof';
import type {
  CustomerChannelContactConsent,
  CustomerChannelFrequencyState,
  InstitutionChannelDryRunSnapshot,
  WeComReachOutCommandWriter,
  WeComReachOutSafetyScope,
  WeComRealSendProofOperationCreateInput,
} from '@/modules/messaging/application/wecom-reachout-command-port';
import type { TenantDatabase } from '@/server/db/client';
import {
  customerChannelContactConsents,
  customerChannelFrequencyStates,
  institutionChannelDryRunSnapshots,
  weComRealSendProofOperations,
} from '@/server/db/schema';

function mapConsent(
  row: typeof customerChannelContactConsents.$inferSelect,
): CustomerChannelContactConsent {
  return {
    ...row,
    channelType: 'wechat_work',
    recordedAt: row.recordedAt.toISOString(),
  };
}

function mapFrequency(
  row: typeof customerChannelFrequencyStates.$inferSelect,
): CustomerChannelFrequencyState {
  return {
    ...row,
    channelType: 'wechat_work',
    maxPreparedCount: 1,
    maxCompletedCount: 1,
    windowStartedAt: row.windowStartedAt.toISOString(),
    windowEndsAt: row.windowEndsAt.toISOString(),
    nextAllowedAt: row.nextAllowedAt.toISOString(),
  };
}

function mapSnapshot(
  row: typeof institutionChannelDryRunSnapshots.$inferSelect,
): InstitutionChannelDryRunSnapshot {
  return {
    ...row,
    channelType: 'wechat_work',
    configStatus:
      row.configStatus as InstitutionChannelDryRunSnapshot['configStatus'],
    preflightStatus:
      row.preflightStatus as InstitutionChannelDryRunSnapshot['preflightStatus'],
    evaluatedAt: row.evaluatedAt.toISOString(),
    allowRealSend: false,
    externalChannelEnabled: false,
    realSendAllowed: false,
    dryRunOnly: true,
  };
}

function mapOperation(
  row: typeof weComRealSendProofOperations.$inferSelect,
): WeComRealSendProofOperation {
  return {
    ...row,
    sessionProvenance: row.sessionProvenance,
    confirmationIssuedAt: row.confirmationIssuedAt.toISOString(),
    confirmationExpiresAt: row.confirmationExpiresAt.toISOString(),
    confirmationConsumedAt: row.confirmationConsumedAt?.toISOString() ?? null,
    requestedAt: row.requestedAt.toISOString(),
    attemptedAt: row.attemptedAt?.toISOString() ?? null,
    terminalAt: row.terminalAt?.toISOString() ?? null,
    attemptCount: row.attemptCount as 0 | 1,
  };
}

function consentScopeWhere(scope: WeComReachOutSafetyScope) {
  return and(
    eq(customerChannelContactConsents.tenantId, scope.tenantId),
    eq(customerChannelContactConsents.institutionId, scope.institutionId),
    eq(customerChannelContactConsents.customerId, scope.customerId),
    eq(customerChannelContactConsents.channelType, 'wechat_work'),
  );
}

function frequencyScopeWhere(scope: WeComReachOutSafetyScope) {
  return and(
    eq(customerChannelFrequencyStates.tenantId, scope.tenantId),
    eq(customerChannelFrequencyStates.institutionId, scope.institutionId),
    eq(customerChannelFrequencyStates.customerId, scope.customerId),
    eq(customerChannelFrequencyStates.channelType, 'wechat_work'),
  );
}

export function createWeComReachOutCommandRepository(
  database: TenantDatabase,
): WeComReachOutCommandWriter {
  return Object.freeze({
    async upsertConsent(
      input: Parameters<WeComReachOutCommandWriter['upsertConsent']>[0],
    ) {
      if (input.expectedVersion === null) {
        const [row] = await database
          .insert(customerChannelContactConsents)
          .values({
            id: input.id,
            tenantId: input.tenantId,
            institutionId: input.institutionId,
            customerId: input.customerId,
            channelType: 'wechat_work',
            status: input.status,
            sourceType: input.sourceType,
            evidenceRef: input.evidenceRef,
            recordedBy: input.recordedBy,
            recordedAt: input.recordedAt,
          })
          .onConflictDoNothing()
          .returning();

        return row ? mapConsent(row) : null;
      }

      const [row] = await database
        .update(customerChannelContactConsents)
        .set({
          status: input.status,
          sourceType: input.sourceType,
          evidenceRef: input.evidenceRef,
          recordedBy: input.recordedBy,
          recordedAt: input.recordedAt,
          version: input.expectedVersion + 1,
          updatedAt: input.recordedAt,
        })
        .where(
          and(
            consentScopeWhere(input),
            eq(customerChannelContactConsents.version, input.expectedVersion),
          ),
        )
        .returning();

      return row ? mapConsent(row) : null;
    },

    async createFrequencyIfAbsent(
      input: Parameters<WeComReachOutCommandWriter['createFrequencyIfAbsent']>[0],
    ) {
      const [row] = await database
        .insert(customerChannelFrequencyStates)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          customerId: input.customerId,
          channelType: 'wechat_work',
          windowStartedAt: input.now,
          windowEndsAt: input.windowEndsAt,
          preparedCount: 1,
          completedCount: 0,
          maxPreparedCount: 1,
          maxCompletedCount: 1,
          nextAllowedAt: input.windowEndsAt,
          lastPreparedRef: input.operationRef,
        })
        .onConflictDoNothing()
        .returning();

      return row ? mapFrequency(row) : null;
    },

    async updateFrequencyWhenVersion(
      input: Parameters<WeComReachOutCommandWriter['updateFrequencyWhenVersion']>[0],
    ) {
      const [row] = await database
        .update(customerChannelFrequencyStates)
        .set({
          windowStartedAt: input.windowStartedAt,
          windowEndsAt: input.windowEndsAt,
          preparedCount: input.preparedCount,
          completedCount: input.completedCount,
          maxPreparedCount: 1,
          maxCompletedCount: 1,
          nextAllowedAt: input.nextAllowedAt,
          lastPreparedRef: input.operationRef,
          version: input.expectedVersion + 1,
          updatedAt: input.now,
        })
        .where(
          and(
            frequencyScopeWhere(input),
            eq(customerChannelFrequencyStates.version, input.expectedVersion),
          ),
        )
        .returning();

      return row ? mapFrequency(row) : null;
    },

    async upsertDryRunSnapshot(
      input: Parameters<WeComReachOutCommandWriter['upsertDryRunSnapshot']>[0],
    ) {
      const newerEvaluation = lt(
        institutionChannelDryRunSnapshots.evaluatedAt,
        input.evaluatedAt,
      );
      const updateCondition =
        input.configStatus === 'dry_run_ready'
          ? newerEvaluation
          : or(
              newerEvaluation,
              and(
                eq(
                  institutionChannelDryRunSnapshots.evaluatedAt,
                  input.evaluatedAt,
                ),
                eq(
                  institutionChannelDryRunSnapshots.configStatus,
                  'dry_run_ready',
                ),
              ),
            );

      const [row] = await database
        .insert(institutionChannelDryRunSnapshots)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          channelType: 'wechat_work',
          officialRoute: input.officialRoute,
          proofInstitutionRef: input.proofInstitutionRef,
          callbackPlaceholderRef: input.callbackPlaceholderRef,
          configStatus: input.configStatus,
          preflightStatus: input.preflightStatus,
          proofEligibleMock: input.proofEligibleMock,
          evaluatedBy: input.evaluatedBy,
          evaluatedAt: input.evaluatedAt,
          allowRealSend: false,
          externalChannelEnabled: false,
          realSendAllowed: false,
          dryRunOnly: true,
        })
        .onConflictDoUpdate({
          target: [
            institutionChannelDryRunSnapshots.tenantId,
            institutionChannelDryRunSnapshots.institutionId,
            institutionChannelDryRunSnapshots.channelType,
          ],
          set: {
            officialRoute: input.officialRoute,
            proofInstitutionRef: input.proofInstitutionRef,
            callbackPlaceholderRef: input.callbackPlaceholderRef,
            configStatus: input.configStatus,
            preflightStatus: input.preflightStatus,
            proofEligibleMock: input.proofEligibleMock,
            evaluatedBy: input.evaluatedBy,
            evaluatedAt: input.evaluatedAt,
            allowRealSend: false,
            externalChannelEnabled: false,
            realSendAllowed: false,
            dryRunOnly: true,
            version: sql`${institutionChannelDryRunSnapshots.version} + 1`,
            updatedAt: input.evaluatedAt,
          },
          setWhere: updateCondition,
        })
        .returning();

      return row ? mapSnapshot(row) : null;
    },

    async createRealSendOperation(input: WeComRealSendProofOperationCreateInput) {
      const [row] = await database
        .insert(weComRealSendProofOperations)
        .values(input as typeof weComRealSendProofOperations.$inferInsert)
        .onConflictDoNothing()
        .returning();

      return row ? mapOperation(row) : null;
    },

    async consumeRealSendConfirmation(
      input: Parameters<WeComReachOutCommandWriter['consumeRealSendConfirmation']>[0],
    ) {
      const [row] = await database
        .update(weComRealSendProofOperations)
        .set({
          confirmationConsumedAt: input.now,
          attemptedAt: input.now,
          attemptCount: 1,
          status: 'attempted',
          version: sql`${weComRealSendProofOperations.version} + 1`,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(weComRealSendProofOperations.operationRef, input.operationRef),
            eq(weComRealSendProofOperations.tenantId, input.tenantId),
            eq(weComRealSendProofOperations.institutionId, input.institutionId),
            eq(
              weComRealSendProofOperations.confirmationTokenDigest,
              input.tokenDigest,
            ),
            eq(weComRealSendProofOperations.operatorId, input.operatorId),
            eq(weComRealSendProofOperations.status, 'requested'),
            isNull(weComRealSendProofOperations.confirmationConsumedAt),
            lt(weComRealSendProofOperations.confirmationIssuedAt, input.now),
            gt(weComRealSendProofOperations.confirmationExpiresAt, input.now),
          ),
        )
        .returning();

      return row ? mapOperation(row) : null;
    },

    async abortRealSendOperation(
      input: Parameters<WeComReachOutCommandWriter['abortRealSendOperation']>[0],
    ) {
      const [row] = await database
        .update(weComRealSendProofOperations)
        .set({
          status: 'aborted',
          terminalAt: input.now,
          version: sql`${weComRealSendProofOperations.version} + 1`,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(weComRealSendProofOperations.operationRef, input.operationRef),
            eq(weComRealSendProofOperations.tenantId, input.tenantId),
            eq(weComRealSendProofOperations.institutionId, input.institutionId),
            eq(weComRealSendProofOperations.operatorId, input.operatorId),
            eq(weComRealSendProofOperations.status, 'requested'),
          ),
        )
        .returning();

      return row ? mapOperation(row) : null;
    },

    async finalizeRealSendNonSuccess(
      input: Parameters<WeComReachOutCommandWriter['finalizeRealSendNonSuccess']>[0],
    ) {
      const categoryMatchesStatus =
        input.status === 'failed'
          ? input.providerResultCategory === 'rejected'
          : ['transport_error', 'timeout', 'indeterminate'].includes(
              input.providerResultCategory,
            );

      if (!categoryMatchesStatus) return null;

      const [row] = await database
        .update(weComRealSendProofOperations)
        .set({
          status: input.status,
          providerResultCategory: input.providerResultCategory,
          terminalAt: input.now,
          version: sql`${weComRealSendProofOperations.version} + 1`,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(weComRealSendProofOperations.operationRef, input.operationRef),
            eq(weComRealSendProofOperations.tenantId, input.tenantId),
            eq(weComRealSendProofOperations.institutionId, input.institutionId),
            eq(weComRealSendProofOperations.operatorId, input.operatorId),
            eq(weComRealSendProofOperations.status, 'attempted'),
          ),
        )
        .returning();

      return row ? mapOperation(row) : null;
    },

    async recordCompletedFrequency(
      input: Parameters<WeComReachOutCommandWriter['recordCompletedFrequency']>[0],
    ) {
      if (
        input.operation.status !== 'attempted' ||
        input.operation.attemptCount !== 1 ||
        !input.operation.confirmationConsumedAt
      ) {
        return null;
      }

      const [frequency] = await database
        .select()
        .from(customerChannelFrequencyStates)
        .where(
          and(
            eq(
              customerChannelFrequencyStates.id,
              input.operation.frequencyStateId,
            ),
            eq(
              customerChannelFrequencyStates.tenantId,
              input.operation.tenantId,
            ),
            eq(
              customerChannelFrequencyStates.institutionId,
              input.operation.institutionId,
            ),
            eq(
              customerChannelFrequencyStates.customerId,
              input.operation.customerId,
            ),
            eq(
              customerChannelFrequencyStates.channelType,
              input.operation.channelType,
            ),
          ),
        )
        .for('update');

      if (
        !frequency ||
        frequency.lastPreparedRef !== input.operation.operationRef ||
        frequency.completedCount >= frequency.maxCompletedCount ||
        frequency.completedCount >= frequency.preparedCount
      ) {
        return null;
      }

      const [updated] = await database
        .update(customerChannelFrequencyStates)
        .set({
          completedCount: frequency.completedCount + 1,
          lastCompletedRef: input.operation.operationRef,
          version: frequency.version + 1,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(customerChannelFrequencyStates.id, frequency.id),
            eq(
              customerChannelFrequencyStates.tenantId,
              input.operation.tenantId,
            ),
            eq(
              customerChannelFrequencyStates.institutionId,
              input.operation.institutionId,
            ),
            eq(
              customerChannelFrequencyStates.customerId,
              input.operation.customerId,
            ),
            eq(
              customerChannelFrequencyStates.channelType,
              input.operation.channelType,
            ),
            eq(
              customerChannelFrequencyStates.lastPreparedRef,
              input.operation.operationRef,
            ),
            eq(customerChannelFrequencyStates.version, frequency.version),
          ),
        )
        .returning();

      return updated ? mapFrequency(updated) : null;
    },

    async markRealSendSucceeded(
      input: Parameters<WeComReachOutCommandWriter['markRealSendSucceeded']>[0],
    ) {
      if (input.completedFrequencyRef !== input.operationRef) return null;

      const [row] = await database
        .update(weComRealSendProofOperations)
        .set({
          status: 'succeeded',
          providerResultCategory: 'accepted',
          completedFrequencyRef: input.completedFrequencyRef,
          terminalAt: input.now,
          version: sql`${weComRealSendProofOperations.version} + 1`,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(weComRealSendProofOperations.operationRef, input.operationRef),
            eq(weComRealSendProofOperations.tenantId, input.tenantId),
            eq(weComRealSendProofOperations.institutionId, input.institutionId),
            eq(weComRealSendProofOperations.operatorId, input.operatorId),
            eq(weComRealSendProofOperations.status, 'attempted'),
          ),
        )
        .returning();

      return row ? mapOperation(row) : null;
    },
  });
}
