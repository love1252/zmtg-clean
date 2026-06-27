import { and, count, desc, eq, sql } from 'drizzle-orm';
import {
  evaluateTenantQuotaForCreate,
  getTenantPlanQuotaLimitsByCode,
  getTenantQuotaLimitForResource,
  type TenantQuotaDecision,
  type TenantQuotaLimits,
  type TenantQuotaResource,
} from '@/modules/institution/domain/quota-enforcement';
import type { TenantDatabase } from '@/server/db/client';
import {
  aiCallUsageRecords,
  appointments,
  authUsers,
  customers,
  knowledgeDocumentFiles,
  tenantMembers,
  tenantPlanAssignments,
  tenantPlans,
  tenantQuotaSnapshots,
} from '@/server/db/schema';

type TenantPlanRow = typeof tenantPlans.$inferSelect;
type TenantPlanAssignmentRow = typeof tenantPlanAssignments.$inferSelect;
type TenantQuotaSnapshotRow = typeof tenantQuotaSnapshots.$inferSelect;

type TenantQuotaLimitQueryRow = {
  assignment: TenantPlanAssignmentRow;
  plan: TenantPlanRow;
  quotaSnapshot: TenantQuotaSnapshotRow | null;
};

export type ActiveTenantQuotaLimitRecord = {
  limits: TenantQuotaLimits;
  planAssignmentId: string;
  planCode: string;
  quotaSnapshotId: string | null;
  tenantId: string;
};

function mapQuotaLimitQueryRowToRecord(
  row: TenantQuotaLimitQueryRow,
): ActiveTenantQuotaLimitRecord | null {
  const fallbackLimits = getTenantPlanQuotaLimitsByCode(row.plan.code);
  const limits = {
    maxAppointments: row.quotaSnapshot?.maxAppointments ?? fallbackLimits?.maxAppointments ?? null,
    maxCustomers: row.quotaSnapshot?.maxCustomers ?? fallbackLimits?.maxCustomers ?? null,
    maxKnowledgeFiles: fallbackLimits?.maxKnowledgeFiles ?? null,
    maxStaffSeats: fallbackLimits?.maxStaffSeats ?? null,
    maxAiCalls: row.quotaSnapshot?.maxAiCalls ?? fallbackLimits?.maxAiCalls ?? null,
  };

  return {
    limits,
    planAssignmentId: row.assignment.id,
    planCode: row.plan.code,
    quotaSnapshotId: row.quotaSnapshot?.id ?? null,
    tenantId: row.assignment.tenantId,
  };
}

function normalizeCount(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'bigint'
        ? Number(value)
        : typeof value === 'string'
          ? Number.parseInt(value, 10)
          : 0;

  return Number.isFinite(parsed) ? parsed : 0;
}

export function createTenantQuotaEnforcementRepository(database: TenantDatabase) {
  return {
    async countAppointmentsByTenant(tenantId: string): Promise<number> {
      const [row] = await database
        .select({ value: count() })
        .from(appointments)
        .where(eq(appointments.tenantId, tenantId));

      return normalizeCount(row?.value);
    },

    async countCustomersByTenant(tenantId: string): Promise<number> {
      const [row] = await database
        .select({ value: count() })
        .from(customers)
        .where(eq(customers.tenantId, tenantId));

      return normalizeCount(row?.value);
    },

    async countActiveStaffSeatsByTenant(tenantId: string): Promise<number> {
      const [row] = await database
        .select({ value: count() })
        .from(tenantMembers)
        .innerJoin(authUsers, eq(authUsers.id, tenantMembers.userId))
        .where(
          and(
            eq(tenantMembers.tenantId, tenantId),
            eq(tenantMembers.role, 'tenant_admin'),
            eq(authUsers.status, 'active'),
          ),
        );

      return normalizeCount(row?.value);
    },

    async countKnowledgeFilesByTenant(tenantId: string): Promise<number> {
      const [row] = await database
        .select({ value: count() })
        .from(knowledgeDocumentFiles)
        .where(
          and(
            eq(knowledgeDocumentFiles.tenantId, tenantId),
            eq(knowledgeDocumentFiles.status, 'active'),
          ),
        );

      return normalizeCount(row?.value);
    },

    async countAiCallsByTenantThisMonth(tenantId: string): Promise<number> {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const [row] = await database
        .select({ value: count() })
        .from(aiCallUsageRecords)
        .where(
          and(
            eq(aiCallUsageRecords.tenantId, tenantId),
            sql`${aiCallUsageRecords.createdAt} >= ${monthStart}`,
          ),
        );

      return normalizeCount(row?.value);
    },

    async findActiveQuotaLimitByTenant(
      tenantId: string,
    ): Promise<ActiveTenantQuotaLimitRecord | null> {
      const rows = await database
        .select({
          assignment: tenantPlanAssignments,
          plan: tenantPlans,
          quotaSnapshot: tenantQuotaSnapshots,
        })
        .from(tenantPlanAssignments)
        .innerJoin(tenantPlans, eq(tenantPlans.id, tenantPlanAssignments.planId))
        .leftJoin(
          tenantQuotaSnapshots,
          eq(tenantQuotaSnapshots.planAssignmentId, tenantPlanAssignments.id),
        )
        .where(
          and(
            eq(tenantPlanAssignments.tenantId, tenantId),
            eq(tenantPlanAssignments.status, 'active'),
            eq(tenantPlans.status, 'active'),
          ),
        )
        .orderBy(desc(tenantQuotaSnapshots.snapshotAt))
        .limit(1);

      const [row] = rows as TenantQuotaLimitQueryRow[];

      return row ? mapQuotaLimitQueryRowToRecord(row) : null;
    },
  };
}

export type TenantQuotaEnforcementRepository = ReturnType<
  typeof createTenantQuotaEnforcementRepository
>;

export async function checkTenantQuotaForCreate(input: {
  database: TenantDatabase;
  resource: TenantQuotaResource;
  tenantId: string;
}): Promise<TenantQuotaDecision> {
  const repository = createTenantQuotaEnforcementRepository(input.database);
  const activeQuotaLimit = await repository.findActiveQuotaLimitByTenant(input.tenantId);

  if (!activeQuotaLimit) {
    return evaluateTenantQuotaForCreate({
      current: null,
      hasActivePlan: false,
      limit: null,
      resource: input.resource,
    });
  }

  const limit = getTenantQuotaLimitForResource({
    limits: activeQuotaLimit.limits,
    resource: input.resource,
  });

  if (limit === null) {
    return evaluateTenantQuotaForCreate({
      current: null,
      hasActivePlan: true,
      limit,
      resource: input.resource,
    });
  }

  let current: number;

  switch (input.resource) {
    case 'customers':
      current = await repository.countCustomersByTenant(input.tenantId);
      break;
    case 'appointments':
      current = await repository.countAppointmentsByTenant(input.tenantId);
      break;
    case 'knowledge_files':
      current = await repository.countKnowledgeFilesByTenant(input.tenantId);
      break;
    case 'staff_seats':
      current = await repository.countActiveStaffSeatsByTenant(input.tenantId);
      break;
    case 'ai_calls':
      current = await repository.countAiCallsByTenantThisMonth(input.tenantId);
      break;
    default:
      current = 0;
  }

  return evaluateTenantQuotaForCreate({
    current,
    hasActivePlan: true,
    limit,
    resource: input.resource,
  });
}
