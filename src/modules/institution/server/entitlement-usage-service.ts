import {
  getTenantPlanQuotaLimitsByCode,
} from '@/modules/institution/domain/quota-enforcement';
import { createTenantQuotaEnforcementRepository } from '@/modules/institution/server/tenant-quota-enforcement';
import {
  buildEntitlementUsageView,
  type TenantEntitlementUsageView,
} from '@/modules/institution/domain/entitlement-usage-view';
import type { TenantDatabase } from '@/server/db/client';

export async function getTenantEntitlementUsageService(input: {
  database: TenantDatabase;
  tenantId: string;
  institutionId?: string | null;
}): Promise<TenantEntitlementUsageView> {
  const repository = createTenantQuotaEnforcementRepository(input.database);
  const activeQuota = await repository.findActiveQuotaLimitByTenant(input.tenantId);

  if (!activeQuota) {
    return buildEntitlementUsageView({
      tenantId: input.tenantId,
      institutionId: input.institutionId ?? null,
      planCode: null,
      planName: null,
      usages: {
        customers: null,
        staffSeats: null,
        knowledgeFiles: null,
        aiCallsThisMonth: null,
      },
      limits: {
        maxCustomers: null,
        maxStaffSeats: null,
        maxKnowledgeFiles: null,
        maxAiCalls: null,
      },
    });
  }

  const planCode = activeQuota.planCode;
  const fallbackLimits = getTenantPlanQuotaLimitsByCode(planCode);

  const [customers, staffSeats, knowledgeFiles, aiCallsThisMonth] = await Promise.all([
    repository.countCustomersByTenant(input.tenantId),
    repository.countActiveStaffSeatsByTenant(input.tenantId),
    repository.countKnowledgeFilesByTenant(input.tenantId),
    repository.countAiCallsByTenantThisMonth(input.tenantId),
  ]);

  return buildEntitlementUsageView({
    tenantId: input.tenantId,
    institutionId: input.institutionId ?? null,
    planCode,
    planName: activeQuota.planName ?? planCode,
    usages: {
      customers,
      staffSeats,
      knowledgeFiles,
      aiCallsThisMonth,
    },
    limits: {
      maxCustomers: activeQuota.limits.maxCustomers,
      maxStaffSeats: activeQuota.limits.maxStaffSeats,
      maxKnowledgeFiles: activeQuota.limits.maxKnowledgeFiles,
      maxAiCalls: activeQuota.limits.maxAiCalls,
    },
  });
}
