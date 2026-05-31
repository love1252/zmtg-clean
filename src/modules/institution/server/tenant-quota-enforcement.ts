import { and, count, desc, eq } from 'drizzle-orm';
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
  appointments,
  customers,
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

  const current =
    input.resource === 'customers'
      ? await repository.countCustomersByTenant(input.tenantId)
      : await repository.countAppointmentsByTenant(input.tenantId);

  return evaluateTenantQuotaForCreate({
    current,
    hasActivePlan: true,
    limit,
    resource: input.resource,
  });
}
