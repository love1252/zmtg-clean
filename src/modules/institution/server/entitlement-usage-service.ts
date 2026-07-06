import {
  KNOWLEDGE_EMBEDDING_JOB_TYPES,
  createTenantQuotaEnforcementRepository,
} from '@/modules/institution/server/tenant-quota-enforcement';
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
        knowledgeItems: null,
        knowledgeFiles: null,
        knowledgeTotalStorageMb: null,
        knowledgeSingleFileSizeMb: null,
        knowledgeParseJobsThisMonth: null,
        knowledgeEmbeddingJobsThisMonth: null,
        knowledgeOcrJobsThisMonth: null,
        knowledgeRagAnswersThisMonth: null,
        knowledgeIndexRebuildJobsThisMonth: null,
        aiCallsThisMonth: null,
      },
      limits: {
        maxCustomers: null,
        maxStaffSeats: null,
        maxKnowledgeItems: null,
        maxKnowledgeFiles: null,
        maxKnowledgeTotalStorageMb: null,
        maxKnowledgeSingleFileSizeMb: null,
        maxKnowledgeParseJobsMonthly: null,
        maxKnowledgeEmbeddingJobsMonthly: null,
        maxKnowledgeOcrJobsMonthly: null,
        maxKnowledgeRagAnswersMonthly: null,
        maxKnowledgeIndexRebuildJobsMonthly: null,
        maxAiCalls: null,
      },
    });
  }

  const planCode = activeQuota.planCode;

  const [
    customers,
    staffSeats,
    knowledgeItems,
    knowledgeFiles,
    knowledgeTotalStorageMb,
    knowledgeParseJobsThisMonth,
    knowledgeEmbeddingJobsThisMonth,
    knowledgeOcrJobsThisMonth,
    knowledgeRagAnswersThisMonth,
    knowledgeIndexRebuildJobsThisMonth,
    aiCallsThisMonth,
  ] = await Promise.all([
    repository.countCustomersByTenant(input.tenantId),
    repository.countActiveStaffSeatsByTenant(input.tenantId),
    repository.countKnowledgeItemsByTenant(input.tenantId),
    repository.countKnowledgeFilesByTenant(input.tenantId),
    repository.sumKnowledgeFileStorageMbByTenant(input.tenantId),
    repository.countKnowledgeIndexingJobsByTenantThisMonth({ tenantId: input.tenantId, jobTypes: ['parse_file'] }),
    repository.countKnowledgeIndexingJobsByTenantThisMonth({ tenantId: input.tenantId, jobTypes: KNOWLEDGE_EMBEDDING_JOB_TYPES }),
    repository.countKnowledgeIndexingJobsByTenantThisMonth({ tenantId: input.tenantId, jobTypes: ['ocr_file'] }),
    repository.countKnowledgeRagAnswersByTenantThisMonth(input.tenantId),
    repository.countKnowledgeIndexingJobsByTenantThisMonth({ tenantId: input.tenantId, jobTypes: ['rebuild_knowledge_index'] }),
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
      knowledgeItems,
      knowledgeFiles,
      knowledgeTotalStorageMb,
      knowledgeSingleFileSizeMb: 0,
      knowledgeParseJobsThisMonth,
      knowledgeEmbeddingJobsThisMonth,
      knowledgeOcrJobsThisMonth,
      knowledgeRagAnswersThisMonth,
      knowledgeIndexRebuildJobsThisMonth,
      aiCallsThisMonth,
    },
    limits: {
      maxCustomers: activeQuota.limits.maxCustomers,
      maxStaffSeats: activeQuota.limits.maxStaffSeats,
      maxKnowledgeItems: activeQuota.limits.maxKnowledgeItems,
      maxKnowledgeFiles: activeQuota.limits.maxKnowledgeFiles,
      maxKnowledgeTotalStorageMb: activeQuota.limits.maxKnowledgeTotalStorageMb,
      maxKnowledgeSingleFileSizeMb: activeQuota.limits.maxKnowledgeSingleFileSizeMb,
      maxKnowledgeParseJobsMonthly: activeQuota.limits.maxKnowledgeParseJobsMonthly,
      maxKnowledgeEmbeddingJobsMonthly: activeQuota.limits.maxKnowledgeEmbeddingJobsMonthly,
      maxKnowledgeOcrJobsMonthly: activeQuota.limits.maxKnowledgeOcrJobsMonthly,
      maxKnowledgeRagAnswersMonthly: activeQuota.limits.maxKnowledgeRagAnswersMonthly,
      maxKnowledgeIndexRebuildJobsMonthly: activeQuota.limits.maxKnowledgeIndexRebuildJobsMonthly,
      maxAiCalls: activeQuota.limits.maxAiCalls,
    },
  });
}
