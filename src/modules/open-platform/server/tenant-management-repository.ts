import { asc, desc, eq } from 'drizzle-orm';
import {
  mapTenantManagementRecordToDto,
  type TenantManagementListItem,
  type TenantManagementRecord,
} from '@/modules/open-platform/domain/tenant-management';
import type { TenantDatabase } from '@/server/db/client';
import {
  tenantPlanAssignments,
  tenantPlans,
  tenantQuotaSnapshots,
  tenants,
} from '@/server/db/schema';

type TenantRow = typeof tenants.$inferSelect;
type TenantPlanRow = typeof tenantPlans.$inferSelect;
type TenantPlanAssignmentRow = typeof tenantPlanAssignments.$inferSelect;
type TenantQuotaSnapshotRow = typeof tenantQuotaSnapshots.$inferSelect;

type TenantManagementQueryRow = {
  tenant: TenantRow;
  plan: TenantPlanRow | null;
  assignment: TenantPlanAssignmentRow | null;
  quotaSnapshot: TenantQuotaSnapshotRow | null;
};

function mapTenantManagementQueryRowToRecord(
  row: TenantManagementQueryRow,
): TenantManagementRecord {
  return {
    tenantId: row.tenant.id,
    tenantName: row.tenant.name,
    tenantStatus: row.tenant.status,
    createdAt: row.tenant.createdAt,
    updatedAt: row.tenant.updatedAt,
    planName: row.plan?.name ?? null,
    planCode: row.plan?.code ?? null,
    planStatus: row.plan?.status ?? null,
    assignmentStatus: row.assignment?.status ?? null,
    startedAt: row.assignment?.startedAt ?? null,
    expiresAt: row.assignment?.expiresAt ?? null,
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
        .leftJoin(
          tenantQuotaSnapshots,
          eq(tenantQuotaSnapshots.planAssignmentId, tenantPlanAssignments.id),
        )
        .orderBy(asc(tenants.id), desc(tenantQuotaSnapshots.snapshotAt));

      return dedupeTenantRows(rows as TenantManagementQueryRow[])
        .map(mapTenantManagementQueryRowToRecord)
        .map(mapTenantManagementRecordToDto);
    },
  };
}

export type TenantManagementRepository = ReturnType<typeof createTenantManagementRepository>;
