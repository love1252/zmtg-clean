import type { TenantQuotaResource } from '@/modules/institution/domain/quota-enforcement';

export type EntitlementUsageStatus =
  | 'normal'
  | 'near_limit'
  | 'exceeded'
  | 'not_configured'
  | 'no_active_plan';

export type EntitlementUsageItem = {
  resource: TenantQuotaResource;
  label: string;
  used: number | null;
  limit: number | null;
  remaining: number | null;
  status: EntitlementUsageStatus;
};

export type TenantEntitlementUsageView = {
  tenantId: string;
  institutionId: string | null;
  planCode: string | null;
  planName: string | null;
  items: EntitlementUsageItem[];
  readable: boolean;
  source: 'trusted_constants' | 'snapshot' | 'mixed';
};

function computeStatus(used: number | null, limit: number | null): EntitlementUsageStatus {
  if (limit === null || limit === undefined) return 'not_configured';
  if (used === null || used === undefined) return 'normal';
  if (used >= limit) return 'exceeded';
  if (limit > 0 && used / limit >= 0.8) return 'near_limit';
  return 'normal';
}

function computeRemaining(used: number | null, limit: number | null): number | null {
  if (limit === null || limit === undefined || used === null || used === undefined) return null;
  return Math.max(0, limit - used);
}

export function buildEntitlementUsageView(input: {
  tenantId: string;
  institutionId?: string | null;
  planCode: string | null;
  planName: string | null;
  usages: {
    customers: number | null;
    staffSeats: number | null;
    knowledgeFiles: number | null;
    aiCallsThisMonth: number | null;
  };
  limits: {
    maxCustomers: number | null;
    maxStaffSeats: number | null;
    maxKnowledgeFiles: number | null;
    maxAiCalls: number | null;
  };
}): TenantEntitlementUsageView {
  const hasActivePlan = input.planCode !== null;
  const hasLimits = [input.limits.maxCustomers, input.limits.maxStaffSeats, input.limits.maxKnowledgeFiles, input.limits.maxAiCalls].some(
    (v) => typeof v === 'number',
  );

  const status: EntitlementUsageStatus = !hasActivePlan
    ? 'no_active_plan'
    : !hasLimits
      ? 'not_configured'
      : 'normal';

  const items: EntitlementUsageItem[] = [
    {
      resource: 'customers',
      label: '客户数',
      used: input.usages.customers,
      limit: input.limits.maxCustomers,
      remaining: computeRemaining(input.usages.customers, input.limits.maxCustomers),
      status: hasActivePlan
        ? computeStatus(input.usages.customers, input.limits.maxCustomers)
        : 'no_active_plan',
    },
    {
      resource: 'staff_seats',
      label: '员工席位',
      used: input.usages.staffSeats,
      limit: input.limits.maxStaffSeats,
      remaining: computeRemaining(input.usages.staffSeats, input.limits.maxStaffSeats),
      status: hasActivePlan
        ? computeStatus(input.usages.staffSeats, input.limits.maxStaffSeats)
        : 'no_active_plan',
    },
    {
      resource: 'knowledge_files',
      label: '知识库文件',
      used: input.usages.knowledgeFiles,
      limit: input.limits.maxKnowledgeFiles,
      remaining: computeRemaining(input.usages.knowledgeFiles, input.limits.maxKnowledgeFiles),
      status: hasActivePlan
        ? computeStatus(input.usages.knowledgeFiles, input.limits.maxKnowledgeFiles)
        : 'no_active_plan',
    },
    {
      resource: 'ai_calls',
      label: 'AI 调用（本月）',
      used: input.usages.aiCallsThisMonth,
      limit: input.limits.maxAiCalls,
      remaining: computeRemaining(input.usages.aiCallsThisMonth, input.limits.maxAiCalls),
      status: hasActivePlan
        ? computeStatus(input.usages.aiCallsThisMonth, input.limits.maxAiCalls)
        : 'no_active_plan',
    },
  ];

  return {
    tenantId: input.tenantId,
    institutionId: input.institutionId ?? null,
    planCode: input.planCode,
    planName: input.planName,
    items,
    readable: true,
    source: 'mixed',
    ...(status !== 'normal' ? {} : {}),
  };
}
