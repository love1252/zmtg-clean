import { and, eq } from 'drizzle-orm';

import type {
  WeComCustomerBroadcastTaskProviderAttempt,
} from '@/modules/institution/domain/wecom-customer-broadcast-task-outcome';
import type { TenantDatabase } from '@/server/db/client';
import {
  weComCustomerBroadcastTaskProviderAttempts,
  weComRealSendProofOperations,
} from '@/server/db/schema';

export type WeComCustomerBroadcastTaskOutcomeScope = Readonly<{
  tenantId: string;
  institutionId: string;
  customerId: string;
  operationId: string;
  operationRef: string;
}>;

export type WeComCustomerBroadcastTaskOutcomeDraftScopeInput = Readonly<{
  tenantId: string;
  institutionId: string;
  draftId: string;
  operationRef: string;
}>;

/**
 * 供 route 在进入 sidecar CAS 前按 tenant + institution + draft 解析完整 scope。
 * 返回 null 统一表示不存在或越权，避免泄露其他机构的 operation。
 */
export async function findWeComCustomerBroadcastTaskOutcomeScopeForDraft(
  database: TenantDatabase,
  input: WeComCustomerBroadcastTaskOutcomeDraftScopeInput,
): Promise<WeComCustomerBroadcastTaskOutcomeScope | null> {
  const rows = await database
    .select({
      operationId: weComCustomerBroadcastTaskProviderAttempts.operationId,
      operationRef: weComCustomerBroadcastTaskProviderAttempts.operationRef,
      tenantId: weComCustomerBroadcastTaskProviderAttempts.tenantId,
      institutionId: weComCustomerBroadcastTaskProviderAttempts.institutionId,
      customerId: weComCustomerBroadcastTaskProviderAttempts.customerId,
    })
    .from(weComCustomerBroadcastTaskProviderAttempts)
    .innerJoin(
      weComRealSendProofOperations,
      and(
        eq(
          weComCustomerBroadcastTaskProviderAttempts.operationId,
          weComRealSendProofOperations.id,
        ),
        eq(
          weComCustomerBroadcastTaskProviderAttempts.operationRef,
          weComRealSendProofOperations.operationRef,
        ),
        eq(
          weComCustomerBroadcastTaskProviderAttempts.tenantId,
          weComRealSendProofOperations.tenantId,
        ),
        eq(
          weComCustomerBroadcastTaskProviderAttempts.institutionId,
          weComRealSendProofOperations.institutionId,
        ),
        eq(
          weComCustomerBroadcastTaskProviderAttempts.customerId,
          weComRealSendProofOperations.customerId,
        ),
      ),
    )
    .where(and(
      eq(weComCustomerBroadcastTaskProviderAttempts.tenantId, input.tenantId),
      eq(
        weComCustomerBroadcastTaskProviderAttempts.institutionId,
        input.institutionId,
      ),
      eq(weComCustomerBroadcastTaskProviderAttempts.operationRef, input.operationRef),
      eq(weComRealSendProofOperations.draftId, input.draftId),
      eq(weComRealSendProofOperations.tenantId, input.tenantId),
      eq(weComRealSendProofOperations.institutionId, input.institutionId),
    ))
    .limit(2);
  if (rows.length !== 1) return null;
  const row = rows[0];
  if (!row) return null;
  return {
    tenantId: row.tenantId,
    institutionId: row.institutionId,
    customerId: row.customerId,
    operationId: row.operationId,
    operationRef: row.operationRef,
  };
}

export type CreateWeComCustomerBroadcastTaskProviderAttemptInput =
  WeComCustomerBroadcastTaskOutcomeScope & Readonly<{
    id: string;
    occurredAt: string;
  }>;

export type UpdateWeComCustomerBroadcastTaskProviderAttemptInput =
  WeComCustomerBroadcastTaskOutcomeScope & Readonly<{
    expectedVersion: number;
    outcome: WeComCustomerBroadcastTaskProviderAttempt;
  }>;

/**
 * 05B-B3-A 只定义 sidecar 的持久化端口。调用方必须按完整 scope 查询并用
 * version CAS 更新；本端口不包含 provider、proof finalizer 或重试能力。
 */
export interface WeComCustomerBroadcastTaskOutcomeRepository {
  findByScope(
    input: WeComCustomerBroadcastTaskOutcomeScope,
  ): Promise<WeComCustomerBroadcastTaskProviderAttempt | null>;
  createNotStarted(
    input: CreateWeComCustomerBroadcastTaskProviderAttemptInput,
  ): Promise<WeComCustomerBroadcastTaskProviderAttempt | null>;
  updateWhenVersionMatches(
    input: UpdateWeComCustomerBroadcastTaskProviderAttemptInput,
  ): Promise<WeComCustomerBroadcastTaskProviderAttempt | null>;
}

type ProviderAttemptRow = typeof weComCustomerBroadcastTaskProviderAttempts.$inferSelect;

export function mapWeComCustomerBroadcastTaskProviderAttemptRow(
  row: ProviderAttemptRow,
): WeComCustomerBroadcastTaskProviderAttempt {
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

function outcomeScopeMatches(
  input: UpdateWeComCustomerBroadcastTaskProviderAttemptInput,
) {
  return input.outcome.tenantId === input.tenantId &&
    input.outcome.institutionId === input.institutionId &&
    input.outcome.customerId === input.customerId &&
    input.outcome.operationId === input.operationId &&
    input.outcome.operationRef === input.operationRef &&
    input.outcome.version === input.expectedVersion + 1 &&
    input.outcome.capabilityKind === 'customer_broadcast_task' &&
    input.outcome.providerKind === 'wecom_official_customer_broadcast' &&
    input.outcome.memberConfirmationRequired === true &&
    input.outcome.finalizeState === 'not_finalized' &&
    input.outcome.automaticRetryAllowed === false;
}

export function createWeComCustomerBroadcastTaskOutcomeRepository(
  database: TenantDatabase,
): WeComCustomerBroadcastTaskOutcomeRepository {
  return {
    async findByScope(input) {
      const [row] = await database
        .select()
        .from(weComCustomerBroadcastTaskProviderAttempts)
        .where(and(
          eq(weComCustomerBroadcastTaskProviderAttempts.tenantId, input.tenantId),
          eq(
            weComCustomerBroadcastTaskProviderAttempts.institutionId,
            input.institutionId,
          ),
          eq(
            weComCustomerBroadcastTaskProviderAttempts.operationRef,
            input.operationRef,
          ),
          eq(
            weComCustomerBroadcastTaskProviderAttempts.customerId,
            input.customerId,
          ),
          eq(
            weComCustomerBroadcastTaskProviderAttempts.operationId,
            input.operationId,
          ),
        ))
        .limit(1);
      return row ? mapWeComCustomerBroadcastTaskProviderAttemptRow(row) : null;
    },

    async createNotStarted(input) {
      void input;
      throw new Error('legacy_wecom_broadcast_outcome_writer_disabled');
    },

    async updateWhenVersionMatches(input) {
      void input;
      throw new Error('legacy_wecom_broadcast_outcome_writer_disabled');
    },
  };
}
