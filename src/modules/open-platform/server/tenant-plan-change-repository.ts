import { and, eq } from 'drizzle-orm';

import { mapAuditEventToInsert } from '@/modules/audit/server/audit-event-repository';
import { mapTenantManagementRecordToDto } from '@/modules/open-platform/domain/tenant-management';
import type { TenantPlanPublishedVersionRecord } from '@/modules/open-platform/domain/tenant-plan-binding';
import type {
  TenantCurrentPlanStateRecord,
  TenantPlanChangeApplyInput,
  TenantPlanChangeRepository,
} from '@/modules/open-platform/server/tenant-plan-change-service';
import type { TenantDatabase } from '@/server/db/client';
import {
  auditEvents,
  tenantAuthorizationSnapshots,
  tenantPlanAssignments,
  tenantPlanChangeRecords,
  tenantPlanVersions,
  tenantPlans,
  tenants,
} from '@/server/db/schema';

type TenantRow = typeof tenants.$inferSelect;
type AssignmentRow = typeof tenantPlanAssignments.$inferSelect;
type PlanRow = typeof tenantPlans.$inferSelect;
type VersionRow = typeof tenantPlanVersions.$inferSelect;
type AuthorizationSnapshotRow = typeof tenantAuthorizationSnapshots.$inferSelect;

type CurrentPlanQueryRow = {
  tenant: TenantRow;
  assignment: AssignmentRow;
  plan: PlanRow;
  planVersion: VersionRow;
  authorizationSnapshot: AuthorizationSnapshotRow;
};

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

function mapCurrentPlanStateRow(row: CurrentPlanQueryRow): TenantCurrentPlanStateRecord {
  return {
    tenant: {
      id: row.tenant.id,
      name: row.tenant.name,
      status: row.tenant.status,
      createdAt: row.tenant.createdAt,
      updatedAt: row.tenant.updatedAt,
    },
    assignment: {
      id: row.assignment.id,
      tenantId: row.assignment.tenantId,
      planId: row.assignment.planId,
      planVersionId: row.assignment.planVersionId,
      status: row.assignment.status,
      startedAt: row.assignment.startedAt,
      expiresAt: row.assignment.expiresAt,
      createdAt: row.assignment.createdAt,
      updatedAt: row.assignment.updatedAt,
    },
    planVersion: mapPublishedPlanVersionRow({
      plan: row.plan,
      version: row.planVersion,
    }),
    authorizationSnapshot: {
      id: row.authorizationSnapshot.id,
      tenantId: row.authorizationSnapshot.tenantId,
      planAssignmentId: row.authorizationSnapshot.planAssignmentId,
      planVersionId: row.authorizationSnapshot.planVersionId,
      status: row.authorizationSnapshot.status,
      generatedAt: row.authorizationSnapshot.generatedAt,
    },
  };
}

function mapChangedTenantToDto(input: TenantPlanChangeApplyInput) {
  return mapTenantManagementRecordToDto({
    tenantId: input.tenant.id,
    tenantName: input.tenant.name,
    tenantStatus: input.tenant.status,
    createdAt: input.tenant.createdAt,
    updatedAt: input.appliedAt,
    planName: input.toPlanVersion.planName,
    planCode: input.toPlanVersion.planCode,
    planStatus: input.toPlanVersion.planStatus,
    planVersionId: input.toPlanVersion.versionId,
    planVersionCode: input.toPlanVersion.versionCode,
    planDisplayName: input.toPlanVersion.displayName,
    planDisplayPrice: input.toPlanVersion.displayPrice,
    assignmentStatus: input.newAssignment.status,
    startedAt: input.newAssignment.startedAt,
    expiresAt: input.newAssignment.expiresAt,
    agentLimit: input.toPlanVersion.agentLimit,
    seatLimit: input.toPlanVersion.seatLimit,
    monthlyAiCallLimit: input.toPlanVersion.monthlyAiCallLimit,
    knowledgeStorageGb: input.toPlanVersion.knowledgeStorageGb,
    connectorEntitlements: readStringList(input.newAuthorizationSnapshot.connectorJson, 'connectors'),
    serviceEntitlements: readStringList(input.newAuthorizationSnapshot.serviceJson, 'services'),
    authorizationSnapshotId: input.newAuthorizationSnapshot.id,
    authorizationSnapshotStatus: input.newAuthorizationSnapshot.status,
    authorizationGeneratedAt: input.newAuthorizationSnapshot.generatedAt,
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
}

export function createTenantPlanChangeRepository(database: TenantDatabase): TenantPlanChangeRepository {
  return {
    async findCurrentTenantPlanState(tenantId: string) {
      const rows = await database
        .select({
          tenant: tenants,
          assignment: tenantPlanAssignments,
          plan: tenantPlans,
          planVersion: tenantPlanVersions,
          authorizationSnapshot: tenantAuthorizationSnapshots,
        })
        .from(tenants)
        .innerJoin(
          tenantPlanAssignments,
          and(
            eq(tenantPlanAssignments.tenantId, tenants.id),
            eq(tenantPlanAssignments.status, 'active'),
          ),
        )
        .innerJoin(tenantPlans, eq(tenantPlans.id, tenantPlanAssignments.planId))
        .innerJoin(tenantPlanVersions, eq(tenantPlanVersions.id, tenantPlanAssignments.planVersionId))
        .leftJoin(
          tenantAuthorizationSnapshots,
          and(
            eq(tenantAuthorizationSnapshots.tenantId, tenants.id),
            eq(tenantAuthorizationSnapshots.status, 'active'),
          ),
        )
        .where(eq(tenants.id, tenantId))
        .limit(1);

      const row = rows[0] as CurrentPlanQueryRow | undefined;
      if (!row?.authorizationSnapshot) return null;

      return mapCurrentPlanStateRow(row);
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

    async applyTenantPlanChange(input: TenantPlanChangeApplyInput) {
      await database.transaction(async (transactionDatabase) => {
        const tx = transactionDatabase as unknown as TenantDatabase;
        await tx
          .update(tenantPlanAssignments)
          .set({
            status: 'expired',
            expiresAt: input.appliedAt,
            updatedAt: input.appliedAt,
          })
          .where(eq(tenantPlanAssignments.id, input.currentAssignment.id));
        await tx
          .update(tenantAuthorizationSnapshots)
          .set({
            status: 'superseded',
            supersededAt: input.appliedAt,
          })
          .where(eq(tenantAuthorizationSnapshots.id, input.currentAuthorizationSnapshot.id));
        await tx.insert(tenantPlanAssignments).values(input.newAssignment);
        await tx.insert(tenantAuthorizationSnapshots).values(input.newAuthorizationSnapshot);
        await tx.insert(tenantPlanChangeRecords).values(input.changeRecord);
        await tx.insert(auditEvents).values(mapAuditEventToInsert(input.auditEvent));
      });

      return {
        status: 'plan_changed' as const,
        changeRecordId: input.changeRecord.id,
        auditEventId: input.auditEvent.eventId,
        tenant: mapChangedTenantToDto(input),
      };
    },
  };
}
