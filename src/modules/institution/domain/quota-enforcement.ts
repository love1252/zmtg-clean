export const TENANT_QUOTA_RESOURCES = [
  'customers',
  'appointments',
  'knowledge_items',
  'knowledge_files',
  'knowledge_total_storage_mb',
  'knowledge_single_file_size_mb',
  'knowledge_parse_jobs_monthly',
  'knowledge_embedding_jobs_monthly',
  'knowledge_ocr_jobs_monthly',
  'knowledge_rag_answers_monthly',
  'knowledge_index_rebuild_jobs_monthly',
  'staff_seats',
  'ai_calls',
] as const;

export type TenantQuotaResource = (typeof TENANT_QUOTA_RESOURCES)[number];

export type TenantQuotaDenialReason =
  | 'quota_exceeded_customers'
  | 'quota_exceeded_appointments'
  | 'quota_exceeded_knowledge_items'
  | 'quota_exceeded_knowledge_files'
  | 'quota_exceeded_knowledge_total_storage_mb'
  | 'quota_exceeded_knowledge_single_file_size_mb'
  | 'quota_exceeded_knowledge_parse_jobs_monthly'
  | 'quota_exceeded_knowledge_embedding_jobs_monthly'
  | 'quota_exceeded_knowledge_ocr_jobs_monthly'
  | 'quota_exceeded_knowledge_rag_answers_monthly'
  | 'quota_exceeded_knowledge_index_rebuild_jobs_monthly'
  | 'quota_exceeded_staff_seats'
  | 'quota_exceeded_ai_calls'
  | 'missing_active_plan'
  | 'missing_quota_limit'
  | 'feature_disabled';

export type TenantQuotaDecision =
  | {
      allowed: true;
      current: number;
      limit: number;
      resource: TenantQuotaResource;
    }
  | {
      allowed: false;
      current: number | null;
      limit: number | null;
      reason: TenantQuotaDenialReason;
      resource: TenantQuotaResource;
    };

export type TenantQuotaLimits = {
  maxAppointments: number | null;
  maxCustomers: number | null;
  maxKnowledgeItems: number | null;
  maxKnowledgeFiles: number | null;
  maxKnowledgeTotalStorageMb: number | null;
  maxKnowledgeSingleFileSizeMb: number | null;
  maxKnowledgeParseJobsMonthly: number | null;
  maxKnowledgeEmbeddingJobsMonthly: number | null;
  maxKnowledgeOcrJobsMonthly: number | null;
  maxKnowledgeRagAnswersMonthly: number | null;
  maxKnowledgeIndexRebuildJobsMonthly: number | null;
  knowledgeOcrEnabled: boolean | null;
  maxStaffSeats: number | null;
  maxAiCalls: number | null;
};

const SERVER_TRUSTED_PLAN_QUOTA_LIMITS_BY_CODE = {
  'trial-care': {
    maxAppointments: 120,
    maxCustomers: 80,
    maxKnowledgeItems: 20,
    maxKnowledgeFiles: 20,
    maxKnowledgeTotalStorageMb: 200,
    maxKnowledgeSingleFileSizeMb: 2,
    maxKnowledgeParseJobsMonthly: 80,
    maxKnowledgeEmbeddingJobsMonthly: 40,
    maxKnowledgeOcrJobsMonthly: 10,
    maxKnowledgeRagAnswersMonthly: 100,
    maxKnowledgeIndexRebuildJobsMonthly: 5,
    knowledgeOcrEnabled: true,
    maxStaffSeats: 5,
    maxAiCalls: 100,
  },
  'starter-care': {
    maxAppointments: 400,
    maxCustomers: 1000,
    maxKnowledgeItems: 100,
    maxKnowledgeFiles: 100,
    maxKnowledgeTotalStorageMb: 1024,
    maxKnowledgeSingleFileSizeMb: 5,
    maxKnowledgeParseJobsMonthly: 300,
    maxKnowledgeEmbeddingJobsMonthly: 160,
    maxKnowledgeOcrJobsMonthly: 40,
    maxKnowledgeRagAnswersMonthly: 500,
    maxKnowledgeIndexRebuildJobsMonthly: 20,
    knowledgeOcrEnabled: true,
    maxStaffSeats: 20,
    maxAiCalls: 500,
  },
  'growth-care': {
    maxAppointments: 2000,
    maxCustomers: 5000,
    maxKnowledgeItems: 500,
    maxKnowledgeFiles: 500,
    maxKnowledgeTotalStorageMb: 5120,
    maxKnowledgeSingleFileSizeMb: 10,
    maxKnowledgeParseJobsMonthly: 1500,
    maxKnowledgeEmbeddingJobsMonthly: 800,
    maxKnowledgeOcrJobsMonthly: 200,
    maxKnowledgeRagAnswersMonthly: 2500,
    maxKnowledgeIndexRebuildJobsMonthly: 100,
    knowledgeOcrEnabled: true,
    maxStaffSeats: 100,
    maxAiCalls: 2500,
  },
} as const satisfies Record<string, TenantQuotaLimits>;

type ServerTrustedPlanCode = keyof typeof SERVER_TRUSTED_PLAN_QUOTA_LIMITS_BY_CODE;

function isUsableQuotaLimit(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function getTenantPlanQuotaLimitsByCode(planCode: string): TenantQuotaLimits | null {
  if (!Object.prototype.hasOwnProperty.call(SERVER_TRUSTED_PLAN_QUOTA_LIMITS_BY_CODE, planCode)) {
    return null;
  }

  return SERVER_TRUSTED_PLAN_QUOTA_LIMITS_BY_CODE[planCode as ServerTrustedPlanCode];
}

export function getTenantQuotaLimitForResource(input: {
  limits: TenantQuotaLimits;
  resource: TenantQuotaResource;
}): number | null {
  let limit: number | null;

  switch (input.resource) {
    case 'customers':
      limit = input.limits.maxCustomers;
      break;
    case 'appointments':
      limit = input.limits.maxAppointments;
      break;
    case 'knowledge_items':
      limit = input.limits.maxKnowledgeItems;
      break;
    case 'knowledge_files':
      limit = input.limits.maxKnowledgeFiles;
      break;
    case 'knowledge_total_storage_mb':
      limit = input.limits.maxKnowledgeTotalStorageMb;
      break;
    case 'knowledge_single_file_size_mb':
      limit = input.limits.maxKnowledgeSingleFileSizeMb;
      break;
    case 'knowledge_parse_jobs_monthly':
      limit = input.limits.maxKnowledgeParseJobsMonthly;
      break;
    case 'knowledge_embedding_jobs_monthly':
      limit = input.limits.maxKnowledgeEmbeddingJobsMonthly;
      break;
    case 'knowledge_ocr_jobs_monthly':
      limit = input.limits.maxKnowledgeOcrJobsMonthly;
      break;
    case 'knowledge_rag_answers_monthly':
      limit = input.limits.maxKnowledgeRagAnswersMonthly;
      break;
    case 'knowledge_index_rebuild_jobs_monthly':
      limit = input.limits.maxKnowledgeIndexRebuildJobsMonthly;
      break;
    case 'staff_seats':
      limit = input.limits.maxStaffSeats;
      break;
    case 'ai_calls':
      limit = input.limits.maxAiCalls;
      break;
    default:
      limit = null;
  }

  return isUsableQuotaLimit(limit) ? limit : null;
}

export function getTenantQuotaExceededReason(
  resource: TenantQuotaResource,
): Extract<
  TenantQuotaDenialReason,
  | 'quota_exceeded_customers'
  | 'quota_exceeded_appointments'
  | 'quota_exceeded_knowledge_items'
  | 'quota_exceeded_knowledge_files'
  | 'quota_exceeded_knowledge_total_storage_mb'
  | 'quota_exceeded_knowledge_single_file_size_mb'
  | 'quota_exceeded_knowledge_parse_jobs_monthly'
  | 'quota_exceeded_knowledge_embedding_jobs_monthly'
  | 'quota_exceeded_knowledge_ocr_jobs_monthly'
  | 'quota_exceeded_knowledge_rag_answers_monthly'
  | 'quota_exceeded_knowledge_index_rebuild_jobs_monthly'
  | 'quota_exceeded_staff_seats'
  | 'quota_exceeded_ai_calls'
> {
  switch (resource) {
    case 'customers':
      return 'quota_exceeded_customers';
    case 'appointments':
      return 'quota_exceeded_appointments';
    case 'knowledge_items':
      return 'quota_exceeded_knowledge_items';
    case 'knowledge_files':
      return 'quota_exceeded_knowledge_files';
    case 'knowledge_total_storage_mb':
      return 'quota_exceeded_knowledge_total_storage_mb';
    case 'knowledge_single_file_size_mb':
      return 'quota_exceeded_knowledge_single_file_size_mb';
    case 'knowledge_parse_jobs_monthly':
      return 'quota_exceeded_knowledge_parse_jobs_monthly';
    case 'knowledge_embedding_jobs_monthly':
      return 'quota_exceeded_knowledge_embedding_jobs_monthly';
    case 'knowledge_ocr_jobs_monthly':
      return 'quota_exceeded_knowledge_ocr_jobs_monthly';
    case 'knowledge_rag_answers_monthly':
      return 'quota_exceeded_knowledge_rag_answers_monthly';
    case 'knowledge_index_rebuild_jobs_monthly':
      return 'quota_exceeded_knowledge_index_rebuild_jobs_monthly';
    case 'staff_seats':
      return 'quota_exceeded_staff_seats';
    case 'ai_calls':
      return 'quota_exceeded_ai_calls';
  }
}

export function evaluateTenantQuotaForCreate(input: {
  current: number | null;
  hasActivePlan: boolean;
  limit: number | null;
  resource: TenantQuotaResource;
}): TenantQuotaDecision {
  return evaluateTenantQuotaForUsage({ ...input, quantity: 1 });
}

export function evaluateTenantQuotaForUsage(input: {
  current: number | null;
  hasActivePlan: boolean;
  limit: number | null;
  quantity: number;
  resource: TenantQuotaResource;
}): TenantQuotaDecision {
  if (!input.hasActivePlan) {
    return {
      allowed: false,
      current: null,
      limit: null,
      reason: 'missing_active_plan',
      resource: input.resource,
    };
  }

  if (!isUsableQuotaLimit(input.limit)) {
    return {
      allowed: false,
      current: null,
      limit: null,
      reason: 'missing_quota_limit',
      resource: input.resource,
    };
  }

  const current = Math.max(0, Math.trunc(input.current ?? 0));
  const quantity = Math.max(1, Math.trunc(input.quantity));

  if (current + quantity > input.limit) {
    return {
      allowed: false,
      current,
      limit: input.limit,
      reason: getTenantQuotaExceededReason(input.resource),
      resource: input.resource,
    };
  }

  return {
    allowed: true,
    current,
    limit: input.limit,
    resource: input.resource,
  };
}

export function evaluateTenantFeatureEnabled(input: {
  enabled: boolean | null;
  hasActivePlan: boolean;
  resource: TenantQuotaResource;
}): TenantQuotaDecision {
  if (!input.hasActivePlan) {
    return {
      allowed: false,
      current: null,
      limit: null,
      reason: 'missing_active_plan',
      resource: input.resource,
    };
  }

  if (input.enabled !== true) {
    return {
      allowed: false,
      current: null,
      limit: null,
      reason: 'feature_disabled',
      resource: input.resource,
    };
  }

  return {
    allowed: true,
    current: 0,
    limit: 1,
    resource: input.resource,
  };
}
