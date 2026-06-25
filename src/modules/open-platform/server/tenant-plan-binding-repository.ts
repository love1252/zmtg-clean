import { and, asc, desc, eq } from 'drizzle-orm';

import { mapAuditEventToInsert } from '@/modules/audit/server/audit-event-repository';
import {
  mapTenantManagementRecordToDto,
  normalizeTenantOpeningContact,
} from '@/modules/open-platform/domain/tenant-management';
import type { TenantPlanPublishedVersionRecord } from '@/modules/open-platform/domain/tenant-plan-binding';
import type { TenantPlanBindingRepository } from '@/modules/open-platform/server/tenant-plan-binding-service';
import type { TenantDatabase } from '@/server/db/client';
import {
  authUsers,
  auditEvents,
  tenantContacts,
  tenantAuthorizationSnapshots,
  tenantMembers,
  tenantPlanAssignments,
  tenantPlanVersions,
  tenantPlans,
  tenants,
} from '@/server/db/schema';

type PlanRow = typeof tenantPlans.$inferSelect;
type VersionRow = typeof tenantPlanVersions.$inferSelect;

type PlanVersionQueryRow = {
  plan: PlanRow;
  version: VersionRow;
};

function readStringList(json: unknown, key: string) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return [];
  const value = (json as Record<string, unknown>)[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function readOpeningContact(json: unknown) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  return normalizeTenantOpeningContact((json as Record<string, unknown>).openingContact);
}

function mapPublishedPlanVersionRow(row: PlanVersionQueryRow): TenantPlanPublishedVersionRecord {
  return {
    planId: row.plan.id,
    planCode: row.plan.code,
    planName: row.plan.name,
    planStatus: row.plan.status,
    versionId: row.version.id,
    versionCode: row.version.versionCode,
    status: row.version.status,
    displayName: row.version.displayName,
    displayPrice: row.version.displayPrice,
    priceNote: row.version.priceNote,
    agentLimit: row.version.agentLimit,
    seatLimit: row.version.seatLimit,
    monthlyAiCallLimit: row.version.monthlyAiCallLimit,
    knowledgeStorageGb: row.version.knowledgeStorageGb,
    connectorEntitlementsJson: row.version.connectorEntitlementsJson,
    serviceEntitlementsJson: row.version.serviceEntitlementsJson,
    featureEntitlementsJson: row.version.featureEntitlementsJson,
    quotaEntitlementsJson: row.version.quotaEntitlementsJson,
  };
}

export function createTenantPlanBindingRepository(database: TenantDatabase): TenantPlanBindingRepository {
  return {
    async listPublishedPlanVersions() {
      const rows = await database
        .select({
          plan: tenantPlans,
          version: tenantPlanVersions,
        })
        .from(tenantPlanVersions)
        .innerJoin(tenantPlans, eq(tenantPlans.id, tenantPlanVersions.planId))
        .where(and(eq(tenantPlanVersions.status, 'published'), eq(tenantPlans.status, 'active')))
        .orderBy(asc(tenantPlans.code), desc(tenantPlanVersions.publishedAt));

      return (rows as PlanVersionQueryRow[]).map(mapPublishedPlanVersionRow);
    },

    async findPublishedPlanVersionById(versionId: string) {
      const rows = await database
        .select({
          plan: tenantPlans,
          version: tenantPlanVersions,
        })
        .from(tenantPlanVersions)
        .innerJoin(tenantPlans, eq(tenantPlans.id, tenantPlanVersions.planId))
        .where(
          and(
            eq(tenantPlanVersions.id, versionId),
            eq(tenantPlanVersions.status, 'published'),
            eq(tenantPlans.status, 'active'),
          ),
        )
        .limit(1);

      return rows[0] ? mapPublishedPlanVersionRow(rows[0] as PlanVersionQueryRow) : null;
    },

    async createTenantWithPlanAuthorization(input) {
      await database.transaction(async (transactionDatabase) => {
        const tx = transactionDatabase as unknown as TenantDatabase;
        await tx.insert(tenants).values(input.tenant);
        await tx.insert(authUsers).values(input.authAccount);
        await tx.insert(tenantMembers).values(input.tenantMember);
        await tx.insert(tenantContacts).values(input.tenantContact);
        await tx.insert(tenantPlanAssignments).values(input.assignment);
        await tx.insert(tenantAuthorizationSnapshots).values(input.authorizationSnapshot);
        await tx.insert(auditEvents).values(mapAuditEventToInsert(input.auditEvent));
        await tx.insert(auditEvents).values(mapAuditEventToInsert(input.accountAuditEvent));
      });

      return mapTenantManagementRecordToDto({
        tenantId: input.tenant.id,
        tenantName: input.tenant.name,
        tenantStatus: input.tenant.status,
        createdAt: input.tenant.createdAt,
        updatedAt: input.tenant.updatedAt,
        planName: input.planVersion.planName,
        planCode: input.planVersion.planCode,
        planStatus: input.planVersion.planStatus,
        planVersionId: input.planVersion.versionId,
        planVersionCode: input.planVersion.versionCode,
        planDisplayName: input.planVersion.displayName,
        planDisplayPrice: input.planVersion.displayPrice,
        assignmentStatus: input.assignment.status,
        startedAt: input.assignment.startedAt,
        expiresAt: input.assignment.expiresAt,
        agentLimit: input.planVersion.agentLimit,
        seatLimit: input.planVersion.seatLimit,
        monthlyAiCallLimit: input.planVersion.monthlyAiCallLimit,
        knowledgeStorageGb: input.planVersion.knowledgeStorageGb,
        connectorEntitlements: readStringList(input.authorizationSnapshot.connectorJson, 'connectors'),
        serviceEntitlements: readStringList(input.authorizationSnapshot.serviceJson, 'services'),
        authorizationSnapshotId: input.authorizationSnapshot.id,
        authorizationSnapshotStatus: input.authorizationSnapshot.status,
        authorizationGeneratedAt: input.authorizationSnapshot.generatedAt,
        openingContact: readOpeningContact(input.authorizationSnapshot.snapshotJson),
        maxCustomers: null,
        maxAppointments: null,
        maxFollowUps: null,
        maxAiCalls: null,
        currentCustomers: null,
        currentAppointments: null,
        currentFollowUps: null,
        currentAiCalls: null,
        snapshotAt: null,
      });
    },
  };
}
