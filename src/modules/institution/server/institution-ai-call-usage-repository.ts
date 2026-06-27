import { desc, eq, sql } from 'drizzle-orm';
import type { TenantDatabase } from '@/server/db/client';
import {
  aiCallUsageRecords,
  platformAiProviderConfigs,
  tenants,
} from '@/server/db/schema';
import type { EncryptedSecretEnvelope } from '@/modules/security/server/secretEncryption';
import type {
  AiCallUsageRecord,
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

    async createUsageRecord(input: {
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
    }): Promise<AiCallUsageRecord> {
      const rows = await database
        .insert(aiCallUsageRecords)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          actorUserId: input.actorUserId,
          provider: input.provider,
          model: input.model,
          promptTokens: input.promptTokens,
          completionTokens: input.completionTokens,
          totalTokens: input.totalTokens,
          latencyMs: input.latencyMs,
          status: input.status,
          errorCode: input.errorCode,
        })
        .returning();

      const row = rows[0];
      if (!row) throw new Error('ai_call_usage_record_create_failed');

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
        status: row.status as AiCallUsageStatus,
        errorCode: row.errorCode,
        createdAt: row.createdAt,
      };
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
          eq(aiCallUsageRecords.tenantId, input.tenantId),
        )
        .orderBy(desc(aiCallUsageRecords.createdAt))
        .limit(input.limit);

      return rows
        .filter((row) => row.institutionId === input.institutionId)
        .map((row) => ({
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
          createdAt: row.createdAt,
        }));
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
