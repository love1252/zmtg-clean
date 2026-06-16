import { eq } from 'drizzle-orm';
import type { TenantDatabase } from '@/server/db/client';
import { platformAiProviderConfigs } from '@/server/db/schema';
import { isSupportedVendor, type SupportedVendor } from '@/modules/open-platform/domain/vendor-catalog';
import type {
  VendorProviderConfigRecord,
  VendorProviderConfigUpsertInput,
  VendorProviderConfigLastCheckStatus,
} from './vendorProviderConfigTypes';

const SINGLETON_ID = 'platform-ai-provider-config-default';

type ProviderConfigRow = typeof platformAiProviderConfigs.$inferSelect;

export function vendorProviderConfigId(vendor: SupportedVendor): string {
  return `provider-config-${vendor}`;
}

function normalizeLastCheckStatus(value: string | null): VendorProviderConfigLastCheckStatus {
  if (value === 'ok' || value === 'failed' || value === 'skipped') return value;
  return 'not_checked';
}

function mapVendorConfigRow(row: ProviderConfigRow): VendorProviderConfigRecord | null {
  if (!isSupportedVendor(row.provider)) return null;

  return {
    id: row.id,
    vendor: row.provider,
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

export function createVendorProviderConfigRepository(database: TenantDatabase) {
  return {
    async findAll(): Promise<VendorProviderConfigRecord[]> {
      const rows = await database
        .select()
        .from(platformAiProviderConfigs)
        .orderBy(platformAiProviderConfigs.id);

      return rows
        .filter((row) => row.id !== SINGLETON_ID)
        .map(mapVendorConfigRow)
        .filter((r): r is VendorProviderConfigRecord => r !== null);
    },

    async findByVendor(vendor: SupportedVendor): Promise<VendorProviderConfigRecord | null> {
      const rows = await database
        .select()
        .from(platformAiProviderConfigs)
        .where(eq(platformAiProviderConfigs.id, vendorProviderConfigId(vendor)))
        .limit(1);

      const row = rows[0];
      return row ? mapVendorConfigRow(row) : null;
    },

    async upsertVendorConfig(input: VendorProviderConfigUpsertInput): Promise<VendorProviderConfigRecord> {
      const rows = await database
        .insert(platformAiProviderConfigs)
        .values({
          id: input.id,
          provider: input.vendor,
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
            provider: input.vendor,
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

      const row = rows[0];
      const mappedRecord = row ? mapVendorConfigRow(row) : null;
      if (!mappedRecord) throw new Error('vendor_provider_config_save_failed');

      return mappedRecord;
    },

    async deleteByVendor(vendor: SupportedVendor): Promise<void> {
      await database
        .delete(platformAiProviderConfigs)
        .where(eq(platformAiProviderConfigs.id, vendorProviderConfigId(vendor)));
    },
  };
}

export type VendorProviderConfigRepository = ReturnType<typeof createVendorProviderConfigRepository>;
