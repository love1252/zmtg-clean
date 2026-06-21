import { desc, eq } from 'drizzle-orm';

import type { TenantDatabase } from '@/server/db/client';
import {
  homepageBrandAssets,
  homepageBrandAuditLogs,
  homepageBrandConfigVersions,
  homepageBrandConfigs,
} from '@/server/db/schema';
import type { HomepageBrandConfig } from '@/modules/marketing/domain/homepageBrandConfig';
import type {
  HomepageBrandAuditLogRecord,
  HomepageBrandAssetRecord,
  HomepageBrandConfigRecord,
  HomepageBrandRepository,
  HomepageBrandVersionRecord,
} from './homepage-brand-service';

type ConfigRow = typeof homepageBrandConfigs.$inferSelect;
type VersionRow = typeof homepageBrandConfigVersions.$inferSelect;
type AuditLogRow = typeof homepageBrandAuditLogs.$inferSelect;

function mapConfigRow(row: ConfigRow): HomepageBrandConfigRecord {
  return {
    id: row.id,
    status: row.status,
    draftConfig: row.draftConfigJson as HomepageBrandConfig,
    publishedVersionId: row.publishedVersionId,
    draftUpdatedBy: row.draftUpdatedBy,
    publishedBy: row.publishedBy,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapVersionRow(row: VersionRow): HomepageBrandVersionRecord {
  return {
    id: row.id,
    configId: row.configId,
    versionNumber: row.versionNumber,
    config: row.configJson as HomepageBrandConfig,
    summary: row.summary,
    publishedBy: row.publishedBy,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAuditLogRow(row: AuditLogRow): HomepageBrandAuditLogRecord {
  return {
    id: row.id,
    action: row.action,
    configId: row.configId,
    versionId: row.versionId,
    assetId: row.assetId,
    actorId: row.actorId,
    summary: row.summary,
    metadata: row.metadata as Record<string, string | number | boolean | null>,
    createdAt: row.createdAt,
  };
}

function mapAssetRow(row: typeof homepageBrandAssets.$inferSelect): HomepageBrandAssetRecord {
  return {
    id: row.id,
    kind: row.kind,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storageKey: row.storageKey,
    publicUrl: row.publicUrl,
    checksumSha256: row.checksumSha256,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createHomepageBrandRepository(database: TenantDatabase): HomepageBrandRepository & {
  createAsset(record: HomepageBrandAssetRecord): Promise<HomepageBrandAssetRecord>;
  listAssets(): Promise<HomepageBrandAssetRecord[]>;
} {
  return {
    async findConfig(id: string) {
      const rows = await database
        .select()
        .from(homepageBrandConfigs)
        .where(eq(homepageBrandConfigs.id, id))
        .limit(1);

      return rows[0] ? mapConfigRow(rows[0]) : null;
    },

    async upsertConfigDraft(record: HomepageBrandConfigRecord) {
      const rows = await database
        .insert(homepageBrandConfigs)
        .values({
          id: record.id,
          status: record.status,
          draftConfigJson: record.draftConfig,
          publishedVersionId: record.publishedVersionId,
          draftUpdatedBy: record.draftUpdatedBy,
          publishedBy: record.publishedBy,
          publishedAt: record.publishedAt,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })
        .onConflictDoUpdate({
          target: homepageBrandConfigs.id,
          set: {
            status: record.status,
            draftConfigJson: record.draftConfig,
            draftUpdatedBy: record.draftUpdatedBy,
            updatedAt: record.updatedAt,
          },
        })
        .returning();

      if (!rows[0]) throw new Error('homepage_brand_config_save_failed');
      return mapConfigRow(rows[0]);
    },

    async listVersions(configId: string) {
      const rows = await database
        .select()
        .from(homepageBrandConfigVersions)
        .where(eq(homepageBrandConfigVersions.configId, configId))
        .orderBy(desc(homepageBrandConfigVersions.versionNumber));

      return rows.map(mapVersionRow);
    },

    async findVersion(versionId: string) {
      const rows = await database
        .select()
        .from(homepageBrandConfigVersions)
        .where(eq(homepageBrandConfigVersions.id, versionId))
        .limit(1);

      return rows[0] ? mapVersionRow(rows[0]) : null;
    },

    async createVersion(record: HomepageBrandVersionRecord) {
      const rows = await database
        .insert(homepageBrandConfigVersions)
        .values({
          id: record.id,
          configId: record.configId,
          versionNumber: record.versionNumber,
          configJson: record.config,
          summary: record.summary,
          publishedBy: record.publishedBy,
          publishedAt: record.publishedAt,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })
        .returning();

      if (!rows[0]) throw new Error('homepage_brand_version_create_failed');
      return mapVersionRow(rows[0]);
    },

    async markConfigPublished(input) {
      const rows = await database
        .update(homepageBrandConfigs)
        .set({
          status: 'published',
          draftConfigJson: input.draftConfig,
          publishedVersionId: input.publishedVersionId,
          draftUpdatedBy: input.actorId,
          publishedBy: input.actorId,
          publishedAt: input.publishedAt,
          updatedAt: input.publishedAt,
        })
        .where(eq(homepageBrandConfigs.id, input.id))
        .returning();

      if (!rows[0]) throw new Error('homepage_brand_config_publish_failed');
      return mapConfigRow(rows[0]);
    },

    async createAuditLog(record: HomepageBrandAuditLogRecord) {
      const rows = await database
        .insert(homepageBrandAuditLogs)
        .values({
          id: record.id,
          action: record.action,
          configId: record.configId,
          versionId: record.versionId,
          assetId: record.assetId,
          actorId: record.actorId,
          summary: record.summary,
          metadata: record.metadata,
          createdAt: record.createdAt,
        })
        .returning();

      if (!rows[0]) throw new Error('homepage_brand_audit_log_create_failed');
      return mapAuditLogRow(rows[0]);
    },

    async listAuditLogs(configId: string) {
      const rows = await database
        .select()
        .from(homepageBrandAuditLogs)
        .where(eq(homepageBrandAuditLogs.configId, configId))
        .orderBy(desc(homepageBrandAuditLogs.createdAt))
        .limit(50);

      return rows.map(mapAuditLogRow);
    },

    async createAsset(record: HomepageBrandAssetRecord) {
      const rows = await database
        .insert(homepageBrandAssets)
        .values(record)
        .returning();

      if (!rows[0]) throw new Error('homepage_brand_asset_create_failed');
      return mapAssetRow(rows[0]);
    },

    async listAssets() {
      const rows = await database
        .select()
        .from(homepageBrandAssets)
        .orderBy(desc(homepageBrandAssets.createdAt));

      return rows.map(mapAssetRow);
    },
  };
}
