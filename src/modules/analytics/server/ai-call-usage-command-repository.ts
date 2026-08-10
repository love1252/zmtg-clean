import type {
  AiCallUsageCommandRepository,
  AnalyticsAiCallUsageRecord,
  AnalyticsAiCallUsageStatus,
  AnalyticsAiCreditMeteringStatus,
  NormalizedAiCallUsageAppend,
} from '@/modules/analytics/application/ai-call-usage-command-service';
import type { TenantDatabase } from '@/server/db/client';
import { aiCallUsageRecords } from '@/server/db/schema';

function mapRow(
  row: typeof aiCallUsageRecords.$inferSelect,
): AnalyticsAiCallUsageRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    institutionId: row.institutionId,
    actorUserId: row.actorUserId,
    provider: row.provider,
    model: row.model,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    totalTokens: row.totalTokens,
    latencyMs: row.latencyMs,
    status: row.status as AnalyticsAiCallUsageStatus,
    errorCode: row.errorCode,
    aiCreditsConsumed: row.aiCreditsConsumed,
    meteringStatus: row.meteringStatus as AnalyticsAiCreditMeteringStatus | null,
    meteringVersion: row.meteringVersion,
    meteringDetails: row.meteringDetails ?? null,
    serviceCategory: row.serviceCategory ?? null,
    serviceName: row.serviceName ?? null,
    serviceSource: row.serviceSource ?? null,
    serviceAction: row.serviceAction ?? null,
    serviceVersion: row.serviceVersion ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt,
  };
}

export function createAiCallUsageCommandRepository(
  database: TenantDatabase,
): AiCallUsageCommandRepository {
  return Object.freeze({
    async append(
      input: NormalizedAiCallUsageAppend,
    ): Promise<AnalyticsAiCallUsageRecord> {
      const rows = await database
        .insert(aiCallUsageRecords)
        .values({
          id: input.id,
          tenantId: input.scope.tenantId,
          institutionId:
            input.scope.kind === 'institution' ? input.scope.institutionId : null,
          actorUserId: input.actorUserId,
          provider: input.provider,
          model: input.model,
          promptTokens: input.promptTokens,
          completionTokens: input.completionTokens,
          totalTokens: input.totalTokens,
          latencyMs: input.latencyMs,
          status: input.status,
          errorCode: input.errorCode,
          aiCreditsConsumed: input.aiCreditsConsumed,
          meteringStatus: input.meteringStatus,
          meteringVersion: input.meteringVersion,
          meteringDetails: input.meteringDetails,
          serviceCategory: input.serviceCategory,
          serviceName: input.serviceName,
          serviceSource: input.serviceSource,
          serviceAction: input.serviceAction,
          serviceVersion: input.serviceVersion,
          metadata: input.metadata,
        })
        .returning();

      const row = rows[0];
      if (!row) throw new Error('ai_call_usage_record_create_failed');
      return mapRow(row);
    },
  });
}
