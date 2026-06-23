import { and, asc, desc, eq, ne } from 'drizzle-orm';

import type {
  PlanCatalogRecord,
  PlanCatalogVersionRecord,
  PlanCatalogVersionStatus,
  PlanVersionDraftPayload,
} from '@/modules/open-platform/domain/plan-catalog';
import type { TenantDatabase } from '@/server/db/client';
import { tenantPlans, tenantPlanVersions } from '@/server/db/schema';

type PlanRow = typeof tenantPlans.$inferSelect;
type VersionRow = typeof tenantPlanVersions.$inferSelect;

type PlanCatalogQueryRow = {
  plan: PlanRow;
  version: VersionRow | null;
};

type PlanCatalogPlanRecord = Omit<PlanCatalogRecord, 'versions'>;

type VersionStatusUpdate = {
  updatedBy: string;
  updatedAt: Date;
  publishedBy?: string | null;
  publishedAt?: Date | null;
  retiredAt?: Date | null;
};

function mapPlanRow(row: PlanRow): PlanCatalogPlanRecord {
  return {
    planId: row.id,
    planName: row.name,
    planCode: row.code,
    planDescription: row.description,
    planStatus: row.status,
  };
}

function mapVersionRow(row: VersionRow): PlanCatalogVersionRecord {
  return {
    versionId: row.id,
    planId: row.planId,
    versionCode: row.versionCode,
    status: row.status,
    displayName: row.displayName,
    displayPrice: row.displayPrice,
    priceNote: row.priceNote,
    agentLimit: row.agentLimit,
    seatLimit: row.seatLimit,
    monthlyAiCallLimit: row.monthlyAiCallLimit,
    knowledgeStorageGb: row.knowledgeStorageGb,
    connectorEntitlementsJson: row.connectorEntitlementsJson,
    serviceEntitlementsJson: row.serviceEntitlementsJson,
    featureEntitlementsJson: row.featureEntitlementsJson,
    quotaEntitlementsJson: row.quotaEntitlementsJson,
    changeSummary: row.changeSummary,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    publishedBy: row.publishedBy,
    publishedAt: row.publishedAt,
    retiredAt: row.retiredAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function toNullableDate(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function groupPlanCatalogRows(rows: PlanCatalogQueryRow[]): PlanCatalogRecord[] {
  const records = new Map<string, PlanCatalogRecord>();

  rows.forEach((row) => {
    const existing =
      records.get(row.plan.id) ??
      ({
        ...mapPlanRow(row.plan),
        versions: [],
      } satisfies PlanCatalogRecord);

    if (row.version) {
      existing.versions.push(mapVersionRow(row.version));
    }
    records.set(row.plan.id, existing);
  });

  return Array.from(records.values());
}

function versionRecordToInsertValues(record: PlanCatalogVersionRecord) {
  return {
    id: record.versionId,
    planId: record.planId,
    versionCode: record.versionCode,
    status: record.status,
    displayName: record.displayName,
    displayPrice: record.displayPrice,
    priceNote: record.priceNote,
    agentLimit: record.agentLimit,
    seatLimit: record.seatLimit,
    monthlyAiCallLimit: record.monthlyAiCallLimit,
    knowledgeStorageGb: record.knowledgeStorageGb,
    connectorEntitlementsJson: record.connectorEntitlementsJson,
    serviceEntitlementsJson: record.serviceEntitlementsJson,
    featureEntitlementsJson: record.featureEntitlementsJson,
    quotaEntitlementsJson: record.quotaEntitlementsJson,
    changeSummary: record.changeSummary,
    createdBy: record.createdBy,
    updatedBy: record.updatedBy,
    publishedBy: record.publishedBy,
    publishedAt: toNullableDate(record.publishedAt),
    retiredAt: toNullableDate(record.retiredAt),
    createdAt: toDate(record.createdAt),
    updatedAt: toDate(record.updatedAt),
  };
}

export function createPlanCatalogRepository(database: TenantDatabase) {
  return {
    async listPlanCatalogRecords(): Promise<PlanCatalogRecord[]> {
      const rows = await database
        .select({
          plan: tenantPlans,
          version: tenantPlanVersions,
        })
        .from(tenantPlans)
        .leftJoin(tenantPlanVersions, eq(tenantPlanVersions.planId, tenantPlans.id))
        .orderBy(asc(tenantPlans.code), desc(tenantPlanVersions.updatedAt));

      return groupPlanCatalogRows(rows as PlanCatalogQueryRow[]);
    },

    async findPlan(planId: string): Promise<PlanCatalogPlanRecord | null> {
      const rows = await database
        .select()
        .from(tenantPlans)
        .where(eq(tenantPlans.id, planId))
        .limit(1);

      return rows[0] ? mapPlanRow(rows[0]) : null;
    },

    async findVersion(versionId: string): Promise<PlanCatalogVersionRecord | null> {
      const rows = await database
        .select()
        .from(tenantPlanVersions)
        .where(eq(tenantPlanVersions.id, versionId))
        .limit(1);

      return rows[0] ? mapVersionRow(rows[0]) : null;
    },

    async listVersionsByPlanId(planId: string): Promise<PlanCatalogVersionRecord[]> {
      const rows = await database
        .select()
        .from(tenantPlanVersions)
        .where(eq(tenantPlanVersions.planId, planId))
        .orderBy(desc(tenantPlanVersions.updatedAt));

      return rows.map(mapVersionRow);
    },

    async createVersion(record: PlanCatalogVersionRecord): Promise<PlanCatalogVersionRecord> {
      const rows = await database
        .insert(tenantPlanVersions)
        .values(versionRecordToInsertValues(record))
        .returning();

      if (!rows[0]) throw new Error('plan_catalog_version_create_failed');
      return mapVersionRow(rows[0]);
    },

    async updateVersionDraft(
      versionId: string,
      input: PlanVersionDraftPayload & { updatedBy: string; updatedAt: Date },
    ): Promise<PlanCatalogVersionRecord> {
      const rows = await database
        .update(tenantPlanVersions)
        .set({
          versionCode: input.versionCode,
          displayName: input.displayName,
          displayPrice: input.displayPrice,
          priceNote: input.priceNote,
          agentLimit: input.agentLimit,
          seatLimit: input.seatLimit,
          monthlyAiCallLimit: input.monthlyAiCallLimit,
          knowledgeStorageGb: input.knowledgeStorageGb,
          connectorEntitlementsJson: input.connectorEntitlementsJson,
          serviceEntitlementsJson: input.serviceEntitlementsJson,
          featureEntitlementsJson: input.featureEntitlementsJson,
          quotaEntitlementsJson: input.quotaEntitlementsJson,
          changeSummary: input.changeSummary,
          updatedBy: input.updatedBy,
          updatedAt: input.updatedAt,
        })
        .where(eq(tenantPlanVersions.id, versionId))
        .returning();

      if (!rows[0]) throw new Error('plan_catalog_version_update_failed');
      return mapVersionRow(rows[0]);
    },

    async updateVersionStatus(
      versionId: string,
      status: PlanCatalogVersionStatus,
      input: VersionStatusUpdate,
    ): Promise<PlanCatalogVersionRecord> {
      const rows = await database
        .update(tenantPlanVersions)
        .set({
          status,
          updatedBy: input.updatedBy,
          updatedAt: input.updatedAt,
          publishedBy: input.publishedBy,
          publishedAt: input.publishedAt,
          retiredAt: input.retiredAt,
        })
        .where(eq(tenantPlanVersions.id, versionId))
        .returning();

      if (!rows[0]) throw new Error('plan_catalog_version_status_update_failed');
      return mapVersionRow(rows[0]);
    },

    async retirePublishedVersionsForPlan(
      planId: string,
      input: { exceptVersionId: string; updatedBy: string; retiredAt: Date },
    ): Promise<void> {
      await database
        .update(tenantPlanVersions)
        .set({
          status: 'retired',
          updatedBy: input.updatedBy,
          updatedAt: input.retiredAt,
          retiredAt: input.retiredAt,
        })
        .where(
          and(
            eq(tenantPlanVersions.planId, planId),
            eq(tenantPlanVersions.status, 'published'),
            ne(tenantPlanVersions.id, input.exceptVersionId),
          ),
        );
    },
  };
}

export type PlanCatalogRepository = ReturnType<typeof createPlanCatalogRepository>;
