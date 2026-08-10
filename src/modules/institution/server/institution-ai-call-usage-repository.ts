import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import type { TenantDatabase } from '@/server/db/client';
import { INSTITUTION_AI_USAGE_METRICS_MAX_RECORDS } from '@/modules/institution-system/server/institution-ai-usage-metrics-reader';
import {
  aiCallUsageRecords,
  platformAiProviderConfigs,
  tenants,
} from '@/server/db/schema';
import type {
  AiCreditMeteringDetails,
  AiCreditMeteringStatus,
} from '@/modules/institution/domain/ai-credits-metering';
import type { EncryptedSecretEnvelope } from '@/modules/security/server/secretEncryption';
import type {
  AiCallUsageMetadata,
  AiCallUsageRecord,
  AiCallUsageServiceProject,
  AiCallUsageStatus,
  PlatformAiUsageSummary,
} from '@/modules/institution/server/institution-ai-call-service';

export function createAiCallUsageRepository(database: TenantDatabase) {
  return {
    async findVendorConfig(vendor: string): Promise<{
      baseUrl: string;
      model: string;
      encryptedApiKey: EncryptedSecretEnvelope;
      configured: boolean;
    } | null> {
      const rows = await database
        .select()
        .from(platformAiProviderConfigs)
        .where(eq(platformAiProviderConfigs.provider, vendor))
        .limit(1);

      const row = rows[0];
      if (!row || !row.configured) return null;

      return {
        baseUrl: row.baseUrl,
        model: row.model,
        encryptedApiKey: row.encryptedApiKey as EncryptedSecretEnvelope,
        configured: row.configured,
      };
    },

    async createUsageRecord(_input: {
      id: string;
      tenantId: string;
      institutionId: string | null;
      actorUserId: string;
      provider: string;
      model: string;
      promptTokens: number | null;
      completionTokens: number | null;
      totalTokens: number | null;
      latencyMs: number | null;
      status: AiCallUsageStatus;
      errorCode: string | null;
      aiCreditsConsumed: number | null;
      meteringStatus: AiCreditMeteringStatus | null;
      meteringVersion: string | null;
      meteringDetails: AiCreditMeteringDetails | null;
      metadata?: AiCallUsageMetadata;
    } & AiCallUsageServiceProject): Promise<AiCallUsageRecord> {
      throw new Error('legacy_institution_ai_call_usage_writer_disabled');
    },

    async listInstitutionUsageRecords(input: {
      tenantId: string;
      institutionId: string;
      limit: number;
    }): Promise<AiCallUsageRecord[]> {
      const rows = await database
        .select()
        .from(aiCallUsageRecords)
        .where(
          and(
            eq(aiCallUsageRecords.tenantId, input.tenantId),
            eq(aiCallUsageRecords.institutionId, input.institutionId),
          ),
        )
        .orderBy(desc(aiCallUsageRecords.createdAt))
        .limit(input.limit);

      return rows.map((row) => ({
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
          status: row.status as AiCallUsageStatus,
          errorCode: row.errorCode,
          metadata: (row.metadata as AiCallUsageMetadata | null) ?? null,
          aiCreditsConsumed: row.aiCreditsConsumed,
          meteringStatus: row.meteringStatus as AiCreditMeteringStatus | null,
          meteringVersion: row.meteringVersion,
          meteringDetails: (row.meteringDetails as AiCreditMeteringDetails | null) ?? null,
          serviceCategory: row.serviceCategory,
          serviceName: row.serviceName,
          serviceSource: row.serviceSource,
          serviceAction: row.serviceAction,
          serviceVersion: row.serviceVersion,
          createdAt: row.createdAt,
        }));
    },

    async listInstitutionUsageMetricRecords(input: {
      tenantId: string;
      institutionId: string;
      startInclusiveEpochMs: number;
      endExclusiveEpochMs: number;
    }): Promise<Array<{
      tenantId: string;
      institutionId: string | null;
      status: string;
      serviceCategory: string | null;
      serviceAction: string | null;
      createdAt: Date;
    }>> {
      const rows = await database
        .select({
          tenantId: aiCallUsageRecords.tenantId,
          institutionId: aiCallUsageRecords.institutionId,
          status: aiCallUsageRecords.status,
          serviceCategory: aiCallUsageRecords.serviceCategory,
          serviceAction: aiCallUsageRecords.serviceAction,
          createdAt: aiCallUsageRecords.createdAt,
        })
        .from(aiCallUsageRecords)
        .where(and(
          eq(aiCallUsageRecords.tenantId, input.tenantId),
          eq(aiCallUsageRecords.institutionId, input.institutionId),
          gte(aiCallUsageRecords.createdAt, new Date(input.startInclusiveEpochMs)),
          lt(aiCallUsageRecords.createdAt, new Date(input.endExclusiveEpochMs)),
        ))
        .orderBy(desc(aiCallUsageRecords.createdAt))
        .limit(INSTITUTION_AI_USAGE_METRICS_MAX_RECORDS + 1);

      return rows;
    },

    async listPlatformUsageSummary(): Promise<PlatformAiUsageSummary[]> {
      const rows = await database
        .select({
          tenantId: aiCallUsageRecords.tenantId,
          callCount: sql<number>`count(*)::int`,
          totalTokens: sql<number | null>`sum(${aiCallUsageRecords.totalTokens})::int`,
          succeededCount: sql<number>`count(case when ${aiCallUsageRecords.status} = 'succeeded' then 1 end)::int`,
          rejectedCount: sql<number>`count(case when ${aiCallUsageRecords.status} = 'rejected' then 1 end)::int`,
          quotaExceededCount: sql<number>`count(case when ${aiCallUsageRecords.status} = 'rejected' and ${aiCallUsageRecords.errorCode} = 'quota_exceeded_ai_calls' then 1 end)::int`,
          failedCount: sql<number>`count(case when ${aiCallUsageRecords.status} != 'succeeded' and not (${aiCallUsageRecords.status} = 'rejected' and ${aiCallUsageRecords.errorCode} = 'quota_exceeded_ai_calls') then 1 end)::int`,
        })
        .from(aiCallUsageRecords)
        .groupBy(aiCallUsageRecords.tenantId)
        .orderBy(sql`count(*) DESC`);

      return rows.map((row) => ({
        tenantId: row.tenantId,
        callCount: row.callCount,
        totalTokens: row.totalTokens,
        succeededCount: row.succeededCount,
        failedCount: row.failedCount,
        rejectedCount: row.rejectedCount,
        quotaExceededCount: row.quotaExceededCount,
      }));
    },
  };
}

export type AiCallUsageRepositoryReturn = ReturnType<typeof createAiCallUsageRepository>;
