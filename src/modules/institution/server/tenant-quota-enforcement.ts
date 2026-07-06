import { and, count, desc, eq, inArray, sql, sum } from 'drizzle-orm';
import {
  evaluateTenantFeatureEnabled,
  evaluateTenantQuotaForUsage,
  getTenantPlanQuotaLimitsByCode,
  getTenantQuotaLimitForResource,
  type TenantQuotaDecision,
  type TenantQuotaLimits,
  type TenantQuotaResource,
} from '@/modules/institution/domain/quota-enforcement';
import type { KnowledgeIndexingJobType } from '@/modules/open-platform/server/platform-knowledge-indexing-job-service';
import type { TenantDatabase } from '@/server/db/client';
import {
  aiCallUsageRecords,
  appointments,
  authUsers,
  customers,
  knowledgeDocumentFiles,
  knowledgeDocuments,
  knowledgeIndexingJobs,
  tenantMembers,
  tenantPlanAssignments,
  tenantPlans,
  tenantPlanVersions,
  tenantQuotaSnapshots,
} from '@/server/db/schema';

type TenantPlanRow = typeof tenantPlans.$inferSelect;
type TenantPlanAssignmentRow = typeof tenantPlanAssignments.$inferSelect;
type TenantPlanVersionRow = typeof tenantPlanVersions.$inferSelect;
type TenantQuotaSnapshotRow = typeof tenantQuotaSnapshots.$inferSelect;

type TenantQuotaLimitQueryRow = {
  assignment: TenantPlanAssignmentRow;
  plan: TenantPlanRow;
  planVersion: TenantPlanVersionRow | null;
  quotaSnapshot: TenantQuotaSnapshotRow | null;
};

export type ActiveTenantQuotaLimitRecord = {
  limits: TenantQuotaLimits;
  planAssignmentId: string;
  planCode: string;
  planName: string;
  quotaSnapshotId: string | null;
  tenantId: string;
};

function readJsonNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return null;
  return value;
}

function readJsonBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function readQuotaEntitlements(json: unknown): Partial<TenantQuotaLimits> {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return {};
  const record = json as Record<string, unknown>;
  return {
    maxKnowledgeItems: readJsonNumber(record.knowledgeItemsLimit),
    maxKnowledgeFiles: readJsonNumber(record.knowledgeFilesLimit),
    maxKnowledgeTotalStorageMb: readJsonNumber(record.knowledgeTotalStorageMb),
    maxKnowledgeSingleFileSizeMb: readJsonNumber(record.knowledgeSingleFileSizeMb),
    maxKnowledgeParseJobsMonthly: readJsonNumber(record.knowledgeParseJobsMonthly),
    maxKnowledgeEmbeddingJobsMonthly: readJsonNumber(record.knowledgeEmbeddingJobsMonthly),
    maxKnowledgeOcrJobsMonthly: readJsonNumber(record.knowledgeOcrJobsMonthly),
    maxKnowledgeRagAnswersMonthly: readJsonNumber(record.knowledgeRagAnswersMonthly),
    maxKnowledgeIndexRebuildJobsMonthly: readJsonNumber(record.knowledgeIndexRebuildJobsMonthly),
    knowledgeOcrEnabled: readJsonBoolean(record.knowledgeOcrEnabled),
  };
}

function resolveLimit(
  snapshotValue: number | null | undefined,
  versionValue: number | null | undefined,
  fallbackValue: number | null | undefined,
) {
  return snapshotValue ?? versionValue ?? fallbackValue ?? null;
}

function resolveKnowledgeLimit(
  versionValue: number | null | undefined,
  fallbackValue: number | null | undefined,
) {
  return versionValue ?? fallbackValue ?? null;
}

function mapQuotaLimitQueryRowToRecord(
  row: TenantQuotaLimitQueryRow,
): ActiveTenantQuotaLimitRecord | null {
  const fallbackLimits = getTenantPlanQuotaLimitsByCode(row.plan.code);
  const versionLimits = readQuotaEntitlements(row.planVersion?.quotaEntitlementsJson);
  const versionStorageMb = row.planVersion?.knowledgeStorageGb === null || row.planVersion?.knowledgeStorageGb === undefined
    ? null
    : row.planVersion.knowledgeStorageGb * 1024;
  const limits = {
    maxAppointments: resolveLimit(row.quotaSnapshot?.maxAppointments, null, fallbackLimits?.maxAppointments),
    maxCustomers: resolveLimit(row.quotaSnapshot?.maxCustomers, null, fallbackLimits?.maxCustomers),
    maxKnowledgeItems: resolveKnowledgeLimit(versionLimits.maxKnowledgeItems, fallbackLimits?.maxKnowledgeItems),
    maxKnowledgeFiles: resolveKnowledgeLimit(versionLimits.maxKnowledgeFiles, fallbackLimits?.maxKnowledgeFiles),
    maxKnowledgeTotalStorageMb: resolveKnowledgeLimit(
      versionLimits.maxKnowledgeTotalStorageMb ?? versionStorageMb,
      fallbackLimits?.maxKnowledgeTotalStorageMb,
    ),
    maxKnowledgeSingleFileSizeMb: resolveKnowledgeLimit(
      versionLimits.maxKnowledgeSingleFileSizeMb,
      fallbackLimits?.maxKnowledgeSingleFileSizeMb,
    ),
    maxKnowledgeParseJobsMonthly: resolveKnowledgeLimit(
      versionLimits.maxKnowledgeParseJobsMonthly,
      fallbackLimits?.maxKnowledgeParseJobsMonthly,
    ),
    maxKnowledgeEmbeddingJobsMonthly: resolveKnowledgeLimit(
      versionLimits.maxKnowledgeEmbeddingJobsMonthly,
      fallbackLimits?.maxKnowledgeEmbeddingJobsMonthly,
    ),
    maxKnowledgeOcrJobsMonthly: resolveKnowledgeLimit(
      versionLimits.maxKnowledgeOcrJobsMonthly,
      fallbackLimits?.maxKnowledgeOcrJobsMonthly,
    ),
    maxKnowledgeRagAnswersMonthly: resolveKnowledgeLimit(
      versionLimits.maxKnowledgeRagAnswersMonthly ?? row.planVersion?.monthlyAiCallLimit,
      fallbackLimits?.maxKnowledgeRagAnswersMonthly,
    ),
    maxKnowledgeIndexRebuildJobsMonthly: resolveKnowledgeLimit(
      versionLimits.maxKnowledgeIndexRebuildJobsMonthly,
      fallbackLimits?.maxKnowledgeIndexRebuildJobsMonthly,
    ),
    knowledgeOcrEnabled: versionLimits.knowledgeOcrEnabled ?? fallbackLimits?.knowledgeOcrEnabled ?? null,
    maxStaffSeats: resolveLimit(null, row.planVersion?.seatLimit, fallbackLimits?.maxStaffSeats),
    maxAiCalls: resolveLimit(row.quotaSnapshot?.maxAiCalls, row.planVersion?.monthlyAiCallLimit, fallbackLimits?.maxAiCalls),
  };

  return {
    limits,
    planAssignmentId: row.assignment.id,
    planCode: row.plan.code,
    planName: row.plan.name,
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

function normalizeSum(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'bigint'
        ? Number(value)
        : typeof value === 'string'
          ? Number.parseFloat(value)
          : 0;

  return Number.isFinite(parsed) ? parsed : 0;
}

function monthlyUsageStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function storageMbFromBytes(bytes: number) {
  if (bytes <= 0) return 0;
  return Math.ceil(bytes / 1024 / 1024);
}

export const KNOWLEDGE_EMBEDDING_JOB_TYPES: KnowledgeIndexingJobType[] = ['generate_embeddings', 'rebuild_embeddings'];

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

    async countKnowledgeItemsByTenant(tenantId: string): Promise<number> {
      const [row] = await database
        .select({ value: count() })
        .from(knowledgeDocuments)
        .where(
          and(
            eq(knowledgeDocuments.tenantId, tenantId),
            eq(knowledgeDocuments.status, 'ready'),
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

    async sumKnowledgeFileStorageMbByTenant(tenantId: string): Promise<number> {
      const [row] = await database
        .select({ value: sum(knowledgeDocumentFiles.sizeBytes) })
        .from(knowledgeDocumentFiles)
        .where(
          and(
            eq(knowledgeDocumentFiles.tenantId, tenantId),
            eq(knowledgeDocumentFiles.status, 'active'),
          ),
        );

      return storageMbFromBytes(normalizeSum(row?.value));
    },

    async countKnowledgeIndexingJobsByTenantThisMonth(input: {
      tenantId: string;
      jobTypes: KnowledgeIndexingJobType[];
    }): Promise<number> {
      if (input.jobTypes.length <= 0) return 0;
      const [row] = await database
        .select({ value: count() })
        .from(knowledgeIndexingJobs)
        .where(
          and(
            eq(knowledgeIndexingJobs.tenantId, input.tenantId),
            inArray(knowledgeIndexingJobs.jobType, input.jobTypes),
            sql`${knowledgeIndexingJobs.createdAt} >= ${monthlyUsageStartIso()}`,
          ),
        );

      return normalizeCount(row?.value);
    },

    async countKnowledgeRagAnswersByTenantThisMonth(tenantId: string): Promise<number> {
      const [row] = await database
        .select({ value: count() })
        .from(aiCallUsageRecords)
        .where(
          and(
            eq(aiCallUsageRecords.tenantId, tenantId),
            eq(aiCallUsageRecords.status, 'succeeded'),
            eq(aiCallUsageRecords.serviceCategory, 'knowledge_base_qa'),
            eq(aiCallUsageRecords.serviceAction, 'rag_answer'),
            sql`${aiCallUsageRecords.createdAt} >= ${monthlyUsageStartIso()}`,
          ),
        );

      return normalizeCount(row?.value);
    },

    async countAiCallsByTenantThisMonth(tenantId: string): Promise<number> {
      const [row] = await database
        .select({ value: count() })
        .from(aiCallUsageRecords)
        .where(
          and(
            eq(aiCallUsageRecords.tenantId, tenantId),
            sql`${aiCallUsageRecords.createdAt} >= ${monthlyUsageStartIso()}`,
            sql`${aiCallUsageRecords.status} = 'succeeded'`,
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
          planVersion: tenantPlanVersions,
          quotaSnapshot: tenantQuotaSnapshots,
        })
        .from(tenantPlanAssignments)
        .innerJoin(tenantPlans, eq(tenantPlans.id, tenantPlanAssignments.planId))
        .leftJoin(tenantPlanVersions, eq(tenantPlanVersions.id, tenantPlanAssignments.planVersionId))
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
        .orderBy(desc(tenantQuotaSnapshots.snapshotAt), desc(tenantPlanAssignments.updatedAt))
        .limit(1);

      const [row] = rows as TenantQuotaLimitQueryRow[];

      return row ? mapQuotaLimitQueryRowToRecord(row) : null;
    },
  };
}

export type TenantQuotaEnforcementRepository = ReturnType<
  typeof createTenantQuotaEnforcementRepository
>;

function resolveKnowledgeJobTypes(resource: TenantQuotaResource): KnowledgeIndexingJobType[] {
  switch (resource) {
    case 'knowledge_parse_jobs_monthly':
      return ['parse_file'];
    case 'knowledge_embedding_jobs_monthly':
      return KNOWLEDGE_EMBEDDING_JOB_TYPES;
    case 'knowledge_ocr_jobs_monthly':
      return ['ocr_file'];
    case 'knowledge_index_rebuild_jobs_monthly':
      return ['rebuild_knowledge_index'];
    default:
      return [];
  }
}

async function getCurrentUsageForResource(input: {
  repository: TenantQuotaEnforcementRepository;
  resource: TenantQuotaResource;
  tenantId: string;
}) {
  switch (input.resource) {
    case 'customers':
      return input.repository.countCustomersByTenant(input.tenantId);
    case 'appointments':
      return input.repository.countAppointmentsByTenant(input.tenantId);
    case 'knowledge_items':
      return input.repository.countKnowledgeItemsByTenant(input.tenantId);
    case 'knowledge_files':
      return input.repository.countKnowledgeFilesByTenant(input.tenantId);
    case 'knowledge_total_storage_mb':
      return input.repository.sumKnowledgeFileStorageMbByTenant(input.tenantId);
    case 'knowledge_single_file_size_mb':
      return 0;
    case 'knowledge_parse_jobs_monthly':
    case 'knowledge_embedding_jobs_monthly':
    case 'knowledge_ocr_jobs_monthly':
    case 'knowledge_index_rebuild_jobs_monthly':
      return input.repository.countKnowledgeIndexingJobsByTenantThisMonth({
        tenantId: input.tenantId,
        jobTypes: resolveKnowledgeJobTypes(input.resource),
      });
    case 'knowledge_rag_answers_monthly':
      return input.repository.countKnowledgeRagAnswersByTenantThisMonth(input.tenantId);
    case 'staff_seats':
      return input.repository.countActiveStaffSeatsByTenant(input.tenantId);
    case 'ai_calls':
      return input.repository.countAiCallsByTenantThisMonth(input.tenantId);
  }
}

export async function checkTenantQuotaForCreate(input: {
  database: TenantDatabase;
  resource: TenantQuotaResource;
  tenantId: string;
}): Promise<TenantQuotaDecision> {
  return checkTenantQuotaForUsage({ ...input, quantity: 1 });
}

export async function checkTenantQuotaForUsage(input: {
  database: TenantDatabase;
  quantity: number;
  resource: TenantQuotaResource;
  tenantId: string;
}): Promise<TenantQuotaDecision> {
  const repository = createTenantQuotaEnforcementRepository(input.database);
  const activeQuotaLimit = await repository.findActiveQuotaLimitByTenant(input.tenantId);

  if (!activeQuotaLimit) {
    return evaluateTenantQuotaForUsage({
      current: null,
      hasActivePlan: false,
      limit: null,
      quantity: input.quantity,
      resource: input.resource,
    });
  }

  const limit = getTenantQuotaLimitForResource({
    limits: activeQuotaLimit.limits,
    resource: input.resource,
  });

  if (limit === null) {
    return evaluateTenantQuotaForUsage({
      current: null,
      hasActivePlan: true,
      limit,
      quantity: input.quantity,
      resource: input.resource,
    });
  }

  const current = await getCurrentUsageForResource({
    repository,
    resource: input.resource,
    tenantId: input.tenantId,
  });

  return evaluateTenantQuotaForUsage({
    current,
    hasActivePlan: true,
    limit,
    quantity: input.quantity,
    resource: input.resource,
  });
}

export async function checkTenantKnowledgeOcrFeature(input: {
  database: TenantDatabase;
  tenantId: string;
}): Promise<TenantQuotaDecision> {
  const repository = createTenantQuotaEnforcementRepository(input.database);
  const activeQuotaLimit = await repository.findActiveQuotaLimitByTenant(input.tenantId);

  return evaluateTenantFeatureEnabled({
    enabled: activeQuotaLimit?.limits.knowledgeOcrEnabled ?? null,
    hasActivePlan: Boolean(activeQuotaLimit),
    resource: 'knowledge_ocr_jobs_monthly',
  });
}
