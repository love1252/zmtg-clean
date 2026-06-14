import { sql } from 'drizzle-orm';
import type { TenantDatabase } from '@/server/db/client';
import { platformAiProviderConfigs } from '@/server/db/schema';
import type {
  PlatformAiProviderConfigRecord,
  PlatformAiProviderConfigRepository,
  PlatformAiProviderConfigUpsertInput,
} from './platformAiProviderConfig';

const providerConfigId = 'platform-ai-provider-config-default';

type ProviderConfigRow = typeof platformAiProviderConfigs.$inferSelect;

function normalizeLastCheckStatus(value: string): PlatformAiProviderConfigRecord['lastCheckStatus'] {
  if (value === 'ok' || value === 'failed' || value === 'skipped') return value;
  return 'not_checked';
}

function normalizeProvider(value: string): PlatformAiProviderConfigRecord['provider'] {
  return value === 'openai_compatible' ? 'openai_compatible' : 'openai_compatible';
}

function mapProviderConfigRow(row: ProviderConfigRow): PlatformAiProviderConfigRecord {
  return {
    id: row.id,
    provider: normalizeProvider(row.provider),
    baseUrl: row.baseUrl,
    model: row.model,
    encryptedApiKey: row.encryptedApiKey,
    configured: row.configured,
    lastCheckStatus: normalizeLastCheckStatus(row.lastCheckStatus),
    lastCheckedAt: row.lastCheckedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createPlatformAiProviderConfigRepository(
  database: TenantDatabase,
): PlatformAiProviderConfigRepository {
  return {
    async findProviderConfig() {
      const rows = await database
        .select()
        .from(platformAiProviderConfigs)
        .where(sql`${platformAiProviderConfigs.id} = ${providerConfigId}`)
        .limit(1);

      const row = rows[0];
      return row ? mapProviderConfigRow(row) : null;
    },

    async upsertProviderConfig(input: PlatformAiProviderConfigUpsertInput) {
      const rows = await database
        .insert(platformAiProviderConfigs)
        .values({
          id: providerConfigId,
          provider: input.provider,
          baseUrl: input.baseUrl,
          model: input.model,
          encryptedApiKey: input.encryptedApiKey,
          configured: input.configured,
          lastCheckStatus: 'not_checked',
          lastCheckedAt: null,
          updatedAt: input.updatedAt,
        })
        .onConflictDoUpdate({
          target: platformAiProviderConfigs.id,
          set: {
            provider: input.provider,
            baseUrl: input.baseUrl,
            model: input.model,
            encryptedApiKey: input.encryptedApiKey,
            configured: input.configured,
            lastCheckStatus: 'not_checked',
            lastCheckedAt: null,
            updatedAt: input.updatedAt,
          },
        })
        .returning();

      return mapProviderConfigRow(rows[0]);
    },
  };
}
