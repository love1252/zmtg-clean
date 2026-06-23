import { and, asc, desc, eq } from 'drizzle-orm';
import {
  mapTenantManagementRecordToDto,
  type TenantManagementListItem,
  type TenantManagementRecord,
} from '@/modules/open-platform/domain/tenant-management';
import type { TenantDatabase } from '@/server/db/client';
import {
  tenantAuthorizationSnapshots,
  tenantPlanAssignments,
  tenantPlanVersions,
  tenantPlans,
  tenantQuotaSnapshots,
  tenants,
} from '@/server/db/schema';

type TenantRow = typeof tenants.$inferSelect;
type TenantPlanRow = typeof tenantPlans.$inferSelect;
type TenantPlanAssignmentRow = typeof tenantPlanAssignments.$inferSelect;
type TenantPlanVersionRow = typeof tenantPlanVersions.$inferSelect;
type TenantAuthorizationSnapshotRow = typeof tenantAuthorizationSnapshots.$inferSelect;
type TenantQuotaSnapshotRow = typeof tenantQuotaSnapshots.$inferSelect;

type TenantManagementQueryRow = {
  tenant: TenantRow;
  plan: TenantPlanRow | null;
  assignment: TenantPlanAssignmentRow | null;
  planVersion: TenantPlanVersionRow | null;
  authorizationSnapshot: TenantAuthorizationSnapshotRow | null;
  quotaSnapshot: TenantQuotaSnapshotRow | null;
};

function readStringList(json: unknown, key: string) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return [];
  const value = (json as Record<string, unknown>)[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function mapTenantManagementQueryRowToRecord(
  row: TenantManagementQueryRow,
): TenantManagementRecord {
  const snapshotConnectors = readStringList(row.authorizationSnapshot?.connectorJson, 'connectors');
  const versionConnectors = readStringList(row.planVersion?.connectorEntitlementsJson, 'connectors');
  const snapshotServices = readStringList(row.authorizationSnapshot?.serviceJson, 'services');
  const versionServices = readStringList(row.planVersion?.serviceEntitlementsJson, 'services');
  const connectorEntitlements = snapshotConnectors.length > 0 ? snapshotConnectors : versionConnectors;
  const serviceEntitlements = snapshotServices.length > 0 ? snapshotServices : versionServices;

  return {
    tenantId: row.tenant.id,
    tenantName: row.tenant.name,
    tenantStatus: row.tenant.status,
    createdAt: row.tenant.createdAt,
    updatedAt: row.tenant.updatedAt,
    planName: row.plan?.name ?? null,
    planCode: row.plan?.code ?? null,
    planStatus: row.plan?.status ?? null,
    planVersionId: row.planVersion?.id ?? null,
    planVersionCode: row.planVersion?.versionCode ?? null,
    planDisplayName: row.planVersion?.displayName ?? null,
    planDisplayPrice: row.planVersion?.displayPrice ?? null,
    assignmentStatus: row.assignment?.status ?? null,
    startedAt: row.assignment?.startedAt ?? null,
    expiresAt: row.assignment?.expiresAt ?? null,
    agentLimit: row.planVersion?.agentLimit ?? null,
    seatLimit: row.planVersion?.seatLimit ?? null,
    monthlyAiCallLimit: row.planVersion?.monthlyAiCallLimit ?? null,
    knowledgeStorageGb: row.planVersion?.knowledgeStorageGb ?? null,
    connectorEntitlements,
    serviceEntitlements,
    authorizationSnapshotId: row.authorizationSnapshot?.id ?? null,
    authorizationSnapshotStatus: row.authorizationSnapshot?.status ?? null,
    authorizationGeneratedAt: row.authorizationSnapshot?.generatedAt ?? null,
    maxCustomers: row.quotaSnapshot?.maxCustomers ?? null,
    maxAppointments: row.quotaSnapshot?.maxAppointments ?? null,
    maxFollowUps: row.quotaSnapshot?.maxFollowUps ?? null,
    maxAiCalls: row.quotaSnapshot?.maxAiCalls ?? null,
    currentCustomers: row.quotaSnapshot?.currentCustomers ?? null,
    currentAppointments: row.quotaSnapshot?.currentAppointments ?? null,
    currentFollowUps: row.quotaSnapshot?.currentFollowUps ?? null,
    currentAiCalls: row.quotaSnapshot?.currentAiCalls ?? null,
    snapshotAt: row.quotaSnapshot?.snapshotAt ?? null,
  };
}

function dedupeTenantRows(rows: TenantManagementQueryRow[]) {
  const seenTenantIds = new Set<string>();
  return rows.filter((row) => {
    if (seenTenantIds.has(row.tenant.id)) return false;
    seenTenantIds.add(row.tenant.id);
    return true;
  });
}

export function createTenantManagementRepository(database: TenantDatabase) {
  return {
    async listTenantManagementRecords(): Promise<TenantManagementListItem[]> {
      const rows = await database
        .select({
          tenant: tenants,
          plan: tenantPlans,
          assignment: tenantPlanAssignments,
          quotaSnapshot: tenantQuotaSnapshots,
        })
        .from(tenants)
        .leftJoin(tenantPlanAssignments, eq(tenantPlanAssignments.tenantId, tenants.id))
        .leftJoin(tenantPlans, eq(tenantPlans.id, tenantPlanAssignments.planId))
        .leftJoin(tenantPlanVersions, eq(tenantPlanVersions.id, tenantPlanAssignments.planVersionId))
        .leftJoin(
          tenantAuthorizationSnapshots,
          and(
            eq(tenantAuthorizationSnapshots.tenantId, tenants.id),
            eq(tenantAuthorizationSnapshots.status, 'active'),
          ),
        )
        .leftJoin(
          tenantQuotaSnapshots,
          eq(tenantQuotaSnapshots.planAssignmentId, tenantPlanAssignments.id),
        )
        .orderBy(
          asc(tenants.id),
          desc(tenantAuthorizationSnapshots.generatedAt),
          desc(tenantQuotaSnapshots.snapshotAt),
        );

      return dedupeTenantRows(rows as TenantManagementQueryRow[])
        .map(mapTenantManagementQueryRowToRecord)
        .map(mapTenantManagementRecordToDto);
    },
  };
}

export type TenantManagementRepository = ReturnType<typeof createTenantManagementRepository>;
