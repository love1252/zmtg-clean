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
    knowledgeItems: number | null;
    knowledgeFiles: number | null;
    knowledgeTotalStorageMb: number | null;
    knowledgeSingleFileSizeMb: number | null;
    knowledgeParseJobsThisMonth: number | null;
    knowledgeEmbeddingJobsThisMonth: number | null;
    knowledgeOcrJobsThisMonth: number | null;
    knowledgeRagAnswersThisMonth: number | null;
    knowledgeIndexRebuildJobsThisMonth: number | null;
    aiCallsThisMonth: number | null;
  };
  limits: {
    maxCustomers: number | null;
    maxStaffSeats: number | null;
    maxKnowledgeItems: number | null;
    maxKnowledgeFiles: number | null;
    maxKnowledgeTotalStorageMb: number | null;
    maxKnowledgeSingleFileSizeMb: number | null;
    maxKnowledgeParseJobsMonthly: number | null;
    maxKnowledgeEmbeddingJobsMonthly: number | null;
    maxKnowledgeOcrJobsMonthly: number | null;
    maxKnowledgeRagAnswersMonthly: number | null;
    maxKnowledgeIndexRebuildJobsMonthly: number | null;
    maxAiCalls: number | null;
  };
}): TenantEntitlementUsageView {
  const hasActivePlan = input.planCode !== null;
  const hasLimits = Object.values(input.limits).some(
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
      resource: 'knowledge_items',
      label: '知识库条目',
      used: input.usages.knowledgeItems,
      limit: input.limits.maxKnowledgeItems,
      remaining: computeRemaining(input.usages.knowledgeItems, input.limits.maxKnowledgeItems),
      status: hasActivePlan
        ? computeStatus(input.usages.knowledgeItems, input.limits.maxKnowledgeItems)
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
      resource: 'knowledge_total_storage_mb',
      label: '知识库容量（MB）',
      used: input.usages.knowledgeTotalStorageMb,
      limit: input.limits.maxKnowledgeTotalStorageMb,
      remaining: computeRemaining(input.usages.knowledgeTotalStorageMb, input.limits.maxKnowledgeTotalStorageMb),
      status: hasActivePlan
        ? computeStatus(input.usages.knowledgeTotalStorageMb, input.limits.maxKnowledgeTotalStorageMb)
        : 'no_active_plan',
    },
    {
      resource: 'knowledge_single_file_size_mb',
      label: '单文件大小（MB）',
      used: input.usages.knowledgeSingleFileSizeMb,
      limit: input.limits.maxKnowledgeSingleFileSizeMb,
      remaining: computeRemaining(input.usages.knowledgeSingleFileSizeMb, input.limits.maxKnowledgeSingleFileSizeMb),
      status: hasActivePlan
        ? computeStatus(input.usages.knowledgeSingleFileSizeMb, input.limits.maxKnowledgeSingleFileSizeMb)
        : 'no_active_plan',
    },
    {
      resource: 'knowledge_parse_jobs_monthly',
      label: '解析任务（本月）',
      used: input.usages.knowledgeParseJobsThisMonth,
      limit: input.limits.maxKnowledgeParseJobsMonthly,
      remaining: computeRemaining(input.usages.knowledgeParseJobsThisMonth, input.limits.maxKnowledgeParseJobsMonthly),
      status: hasActivePlan
        ? computeStatus(input.usages.knowledgeParseJobsThisMonth, input.limits.maxKnowledgeParseJobsMonthly)
        : 'no_active_plan',
    },
    {
      resource: 'knowledge_embedding_jobs_monthly',
      label: '向量任务（本月）',
      used: input.usages.knowledgeEmbeddingJobsThisMonth,
      limit: input.limits.maxKnowledgeEmbeddingJobsMonthly,
      remaining: computeRemaining(input.usages.knowledgeEmbeddingJobsThisMonth, input.limits.maxKnowledgeEmbeddingJobsMonthly),
      status: hasActivePlan
        ? computeStatus(input.usages.knowledgeEmbeddingJobsThisMonth, input.limits.maxKnowledgeEmbeddingJobsMonthly)
        : 'no_active_plan',
    },
    {
      resource: 'knowledge_ocr_jobs_monthly',
      label: 'OCR 任务（本月）',
      used: input.usages.knowledgeOcrJobsThisMonth,
      limit: input.limits.maxKnowledgeOcrJobsMonthly,
      remaining: computeRemaining(input.usages.knowledgeOcrJobsThisMonth, input.limits.maxKnowledgeOcrJobsMonthly),
      status: hasActivePlan
        ? computeStatus(input.usages.knowledgeOcrJobsThisMonth, input.limits.maxKnowledgeOcrJobsMonthly)
        : 'no_active_plan',
    },
    {
      resource: 'knowledge_rag_answers_monthly',
      label: '知识库问答（本月）',
      used: input.usages.knowledgeRagAnswersThisMonth,
      limit: input.limits.maxKnowledgeRagAnswersMonthly,
      remaining: computeRemaining(input.usages.knowledgeRagAnswersThisMonth, input.limits.maxKnowledgeRagAnswersMonthly),
      status: hasActivePlan
        ? computeStatus(input.usages.knowledgeRagAnswersThisMonth, input.limits.maxKnowledgeRagAnswersMonthly)
        : 'no_active_plan',
    },
    {
      resource: 'knowledge_index_rebuild_jobs_monthly',
      label: '索引重建（本月）',
      used: input.usages.knowledgeIndexRebuildJobsThisMonth,
      limit: input.limits.maxKnowledgeIndexRebuildJobsMonthly,
      remaining: computeRemaining(input.usages.knowledgeIndexRebuildJobsThisMonth, input.limits.maxKnowledgeIndexRebuildJobsMonthly),
      status: hasActivePlan
        ? computeStatus(input.usages.knowledgeIndexRebuildJobsThisMonth, input.limits.maxKnowledgeIndexRebuildJobsMonthly)
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
