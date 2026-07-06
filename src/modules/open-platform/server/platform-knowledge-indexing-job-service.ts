import { randomUUID } from 'node:crypto';
import {
  checkTenantKnowledgeOcrFeature,
  checkTenantQuotaForCreate,
} from '@/modules/institution/server/tenant-quota-enforcement';
import {
  createKnowledgeQuotaUsageRepository,
  recordKnowledgeQuotaDecision,
  recordKnowledgeQuotaOutcome,
  type KnowledgeQuotaUsageAction,
} from '@/modules/institution/server/knowledge-quota-usage-service';
import type { TenantQuotaResource } from '@/modules/institution/domain/quota-enforcement';
import type { TenantDatabase } from '@/server/db/client';
import { isKnowledgeVisibleToInstitution } from '@/modules/open-platform/server/platform-knowledge-file-management-service';
import {
  generatePlatformKnowledgeChunkEmbeddingsService,
  type PlatformKnowledgeEmbeddingProvider,
} from '@/modules/open-platform/server/platform-knowledge-embedding-vector-search-service';
import {
  parsePlatformKnowledgeDocumentFileService,
  type PlatformKnowledgeDocumentParsingRepository,
} from '@/modules/open-platform/server/platform-knowledge-document-parsing-service';
import type { PlatformKnowledgeOcrProvider } from '@/modules/open-platform/server/platform-knowledge-ocr-provider';
import type { PlatformKnowledgeFileStorage } from '@/modules/open-platform/server/platform-knowledge-file-management-service';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';

type JsonRecord = Record<string, unknown>;

export type KnowledgeIndexingJobType =
  | 'parse_file'
  | 'ocr_file'
  | 'generate_embeddings'
  | 'rebuild_embeddings'
  | 'rebuild_knowledge_index';

export type KnowledgeIndexingJobStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type KnowledgeIndexingJobRecord = {
  jobId: string;
  tenantId: string;
  institutionId: string | null;
  actorUserId: string | null;
  knowledgeId: string | null;
  fileId: string | null;
  jobType: KnowledgeIndexingJobType;
  status: KnowledgeIndexingJobStatus;
  totalCount: number;
  processedCount: number;
  failedCount: number;
  failureReasonCode: string | null;
  safeMessage: string | null;
  metadataJson: JsonRecord;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type KnowledgeIndexingJobDto = {
  jobId: string;
  jobType: KnowledgeIndexingJobType;
  status: KnowledgeIndexingJobStatus;
  knowledgeId: string | null;
  fileId: string | null;
  totalCount: number;
  processedCount: number;
  failedCount: number;
  failureReasonCode: string | null;
  safeMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
};

export type KnowledgeIndexingJobRepository = {
  createKnowledgeIndexingJob(record: KnowledgeIndexingJobRecord): Promise<KnowledgeIndexingJobRecord>;
  updateKnowledgeIndexingJob(input: {
    tenantId: string;
    jobId: string;
    patch: Partial<Pick<
      KnowledgeIndexingJobRecord,
      | 'status'
      | 'totalCount'
      | 'processedCount'
      | 'failedCount'
      | 'failureReasonCode'
      | 'safeMessage'
      | 'metadataJson'
      | 'startedAt'
      | 'finishedAt'
      | 'updatedAt'
    >>;
  }): Promise<KnowledgeIndexingJobRecord | null>;
  findKnowledgeIndexingJob(input: {
    tenantId: string;
    jobId: string;
  }): Promise<KnowledgeIndexingJobRecord | null>;
  listKnowledgeIndexingJobs(input: {
    tenantId: string;
    institutionId?: string | null;
    limit?: number;
  }): Promise<KnowledgeIndexingJobRecord[]>;
};

type KnowledgeVisibilityRepository = {
  findKnowledgeItem(input: { tenantId: string; knowledgeId: string }): Promise<PlatformKnowledgeRepositoryRecord | null>;
  findKnowledgeFile?: PlatformKnowledgeDocumentParsingRepository['findKnowledgeFile'];
};

type ParseJobRepository = KnowledgeIndexingJobRepository & PlatformKnowledgeDocumentParsingRepository;
type EmbeddingJobRepository = KnowledgeIndexingJobRepository &
  KnowledgeVisibilityRepository &
  Parameters<typeof generatePlatformKnowledgeChunkEmbeddingsService>[0]['repository'] & {
    listKnowledgeFiles?: (input: { tenantId: string; knowledgeId: string }) => Promise<Array<{ fileId: string; status: string }>>;
  };

type CreateJobInput = {
  repository: KnowledgeIndexingJobRepository;
  input: {
    tenantId?: string | null;
    institutionId?: string | null;
    actorUserId?: string | null;
    knowledgeId?: string | null;
    fileId?: string | null;
    jobType: KnowledgeIndexingJobType;
    metadataJson?: JsonRecord | null;
  };
};

type RunJobInput = {
  repository: KnowledgeIndexingJobRepository;
  tenantId?: string | null;
  jobId?: string | null;
  runner: (job: KnowledgeIndexingJobRecord) => Promise<JobRunOutcome>;
};

type JobRunOutcome = {
  status: 'succeeded' | 'failed';
  totalCount: number;
  processedCount: number;
  failedCount: number;
  failureReasonCode: string | null;
  safeMessage: string | null;
  metadataJson?: JsonRecord;
};

const safeGenericFailureMessage = '知识库索引任务执行失败，请稍后重试';

function normalizeString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function nowDate() {
  return new Date();
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function sanitizeMetadata(value: JsonRecord | null | undefined): JsonRecord {
  if (!value) return {};
  const safe: JsonRecord = {};
  const scope = value.scope;
  if (scope && typeof scope === 'object' && !Array.isArray(scope)) {
    const scopeRecord = scope as JsonRecord;
    safe.scope = {
      tenantScoped: scopeRecord.tenantScoped === true,
      institutionScoped: scopeRecord.institutionScoped === true,
      hasKnowledgeId: scopeRecord.hasKnowledgeId === true,
      hasFileId: scopeRecord.hasFileId === true,
    };
  }
  const counts = value.counts;
  if (counts && typeof counts === 'object' && !Array.isArray(counts)) {
    const countRecord = counts as JsonRecord;
    safe.counts = {
      total: finiteNumber(countRecord.total),
      processed: finiteNumber(countRecord.processed),
      failed: finiteNumber(countRecord.failed),
      skipped: finiteNumber(countRecord.skipped),
    };
  }
  const mode = typeof value.mode === 'string' ? value.mode : null;
  if (mode && ['create', 'rebuild', 'parse', 'generate', 'ocr'].includes(mode)) safe.mode = mode;
  const parserType = typeof value.parserType === 'string' ? value.parserType : null;
  if (parserType && ['text', 'markdown', 'csv', 'pdf', 'docx', 'xlsx', 'image'].includes(parserType)) safe.parserType = parserType;
  const ocrStatus = typeof value.ocrStatus === 'string' ? value.ocrStatus : null;
  if (ocrStatus && ['succeeded', 'failed', 'unsupported', 'ocr_required'].includes(ocrStatus)) safe.ocrStatus = ocrStatus;
  if (Array.isArray(value.warningCodes)) {
    safe.warningCodes = value.warningCodes.filter((code) =>
      typeof code === 'string' && [
        'parse_text_truncated',
        'parse_row_limit_exceeded',
        'ocr_text_truncated',
        'ocr_low_confidence',
        'ocr_dry_run_result',
      ].includes(code),
    );
  }
  return safe;
}

function baseMetadata(input: {
  tenantId: string;
  institutionId: string | null;
  knowledgeId: string | null;
  fileId: string | null;
  mode: 'create' | 'rebuild' | 'parse' | 'generate' | 'ocr';
  counts?: { total?: number; processed?: number; failed?: number; skipped?: number };
}) {
  return sanitizeMetadata({
    scope: {
      tenantScoped: Boolean(input.tenantId),
      institutionScoped: Boolean(input.institutionId),
      hasKnowledgeId: Boolean(input.knowledgeId),
      hasFileId: Boolean(input.fileId),
    },
    mode: input.mode,
    counts: input.counts ?? {},
  });
}

export function toKnowledgeIndexingJobDto(record: KnowledgeIndexingJobRecord): KnowledgeIndexingJobDto {
  return {
    jobId: record.jobId,
    jobType: record.jobType,
    status: record.status,
    knowledgeId: record.knowledgeId,
    fileId: record.fileId,
    totalCount: record.totalCount,
    processedCount: record.processedCount,
    failedCount: record.failedCount,
    failureReasonCode: record.failureReasonCode,
    safeMessage: record.safeMessage,
    createdAt: record.createdAt.toISOString(),
    startedAt: record.startedAt?.toISOString() ?? null,
    finishedAt: record.finishedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function createKnowledgeIndexingJob(input: CreateJobInput) {
  const tenantId = normalizeString(input.input.tenantId);
  if (!tenantId) return { status: 'validation_failed' as const, message: '缺少知识库索引任务租户范围' };

  const institutionId = normalizeString(input.input.institutionId);
  const knowledgeId = normalizeString(input.input.knowledgeId);
  const fileId = normalizeString(input.input.fileId);
  const now = nowDate();
  const job = await input.repository.createKnowledgeIndexingJob({
    jobId: `kb-index-job-${randomUUID()}`,
    tenantId,
    institutionId,
    actorUserId: normalizeString(input.input.actorUserId),
    knowledgeId,
    fileId,
    jobType: input.input.jobType,
    status: 'pending',
    totalCount: 0,
    processedCount: 0,
    failedCount: 0,
    failureReasonCode: null,
    safeMessage: null,
    metadataJson: sanitizeMetadata(input.input.metadataJson),
    startedAt: null,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  return { status: 'created' as const, job: toKnowledgeIndexingJobDto(job), record: job };
}

export async function runKnowledgeIndexingJob(input: RunJobInput) {
  const tenantId = normalizeString(input.tenantId);
  const jobId = normalizeString(input.jobId);
  if (!tenantId || !jobId) return { status: 'validation_failed' as const, message: '缺少知识库索引任务范围' };

  const job = await input.repository.findKnowledgeIndexingJob({ tenantId, jobId });
  if (!job) return { status: 'not_found' as const };
  if (job.status === 'cancelled') return { status: 'cancelled' as const, job: toKnowledgeIndexingJobDto(job) };
  if (job.status !== 'pending') return { status: job.status, job: toKnowledgeIndexingJobDto(job) };

  const startedAt = nowDate();
  const running = await input.repository.updateKnowledgeIndexingJob({
    tenantId,
    jobId,
    patch: {
      status: 'running',
      startedAt,
      updatedAt: startedAt,
      safeMessage: '知识库索引任务正在执行',
    },
  });
  if (!running) return { status: 'not_found' as const };

  try {
    const outcome = await input.runner(running);
    const finishedAt = nowDate();
    const updated = await input.repository.updateKnowledgeIndexingJob({
      tenantId,
      jobId,
      patch: {
        status: outcome.status,
        totalCount: outcome.totalCount,
        processedCount: outcome.processedCount,
        failedCount: outcome.failedCount,
        failureReasonCode: outcome.failureReasonCode,
        safeMessage: outcome.safeMessage,
        metadataJson: sanitizeMetadata(outcome.metadataJson),
        finishedAt,
        updatedAt: finishedAt,
      },
    });
    return { status: outcome.status, job: updated ? toKnowledgeIndexingJobDto(updated) : toKnowledgeIndexingJobDto(running) };
  } catch {
    const finishedAt = nowDate();
    const updated = await input.repository.updateKnowledgeIndexingJob({
      tenantId,
      jobId,
      patch: {
        status: 'failed',
        totalCount: running.totalCount || 1,
        processedCount: running.processedCount,
        failedCount: Math.max(1, running.failedCount),
        failureReasonCode: 'job_execution_failed',
        safeMessage: safeGenericFailureMessage,
        metadataJson: baseMetadata({
          tenantId,
          institutionId: running.institutionId,
          knowledgeId: running.knowledgeId,
          fileId: running.fileId,
          mode: running.jobType === 'parse_file' || running.jobType === 'ocr_file' ? 'parse' : 'generate',
          counts: { total: running.totalCount || 1, processed: running.processedCount, failed: 1 },
        }),
        finishedAt,
        updatedAt: finishedAt,
      },
    });
    return { status: 'failed' as const, job: updated ? toKnowledgeIndexingJobDto(updated) : toKnowledgeIndexingJobDto(running) };
  }
}

export async function listInstitutionKnowledgeIndexingJobs(input: {
  repository: KnowledgeIndexingJobRepository;
  input: { tenantId?: string | null; institutionId?: string | null; limit?: number | null };
}) {
  const tenantId = normalizeString(input.input.tenantId);
  const institutionId = normalizeString(input.input.institutionId);
  if (!tenantId || !institutionId) return { status: 'validation_failed' as const, message: '缺少机构任务范围' };

  const records = await input.repository.listKnowledgeIndexingJobs({
    tenantId,
    institutionId,
    limit: input.input.limit ?? 20,
  });
  return {
    status: 'succeeded' as const,
    records: records
      .filter((record) => record.tenantId === tenantId && record.institutionId === institutionId)
      .map(toKnowledgeIndexingJobDto),
  };
}

export async function getKnowledgeIndexingJob(input: {
  repository: KnowledgeIndexingJobRepository;
  input: { tenantId?: string | null; institutionId?: string | null; jobId?: string | null };
}) {
  const tenantId = normalizeString(input.input.tenantId);
  const institutionId = normalizeString(input.input.institutionId);
  const jobId = normalizeString(input.input.jobId);
  if (!tenantId || !jobId) return { status: 'validation_failed' as const, message: '缺少任务范围' };

  const job = await input.repository.findKnowledgeIndexingJob({ tenantId, jobId });
  if (!job) return { status: 'not_found' as const };
  if (institutionId && job.institutionId !== institutionId) return { status: 'not_found' as const };
  return { status: 'succeeded' as const, job: toKnowledgeIndexingJobDto(job) };
}

export async function cancelKnowledgeIndexingJob(input: {
  repository: KnowledgeIndexingJobRepository;
  input: { tenantId?: string | null; institutionId?: string | null; jobId?: string | null };
}) {
  const found = await getKnowledgeIndexingJob(input);
  if (found.status !== 'succeeded') return found;
  if (found.job.status !== 'pending') {
    return {
      status: found.job.status === 'running' ? 'running_not_cancelled' as const : 'not_cancellable' as const,
      job: found.job,
      message: found.job.status === 'running' ? '运行中的任务不做强制取消' : '当前任务状态不可取消',
    };
  }

  const updatedAt = nowDate();
  const updated = await input.repository.updateKnowledgeIndexingJob({
    tenantId: normalizeString(input.input.tenantId) ?? '',
    jobId: found.job.jobId,
    patch: {
      status: 'cancelled',
      safeMessage: '任务已取消',
      finishedAt: updatedAt,
      updatedAt,
    },
  });
  if (updated) return { status: 'cancelled' as const, job: toKnowledgeIndexingJobDto(updated) };
  return { status: 'not_found' as const };
}

async function ensureInstitutionCanAccessKnowledge(input: {
  repository: KnowledgeVisibilityRepository;
  tenantId: string;
  institutionId: string;
  knowledgeId: string;
  fileId?: string | null;
}) {
  const knowledge = await input.repository.findKnowledgeItem({
    tenantId: input.tenantId,
    knowledgeId: input.knowledgeId,
  });
  if (!knowledge) return { status: 'not_found' as const };
  if (!isKnowledgeVisibleToInstitution(knowledge, input.institutionId)) return { status: 'forbidden' as const };
  const fileId = normalizeString(input.fileId);
  if (fileId && input.repository.findKnowledgeFile) {
    const file = await input.repository.findKnowledgeFile({
      tenantId: input.tenantId,
      knowledgeId: input.knowledgeId,
      fileId,
    });
    if (!file || file.status !== 'active') return { status: 'not_found' as const };
  }
  return { status: 'visible' as const };
}

function outcomeFromParseResult(input: {
  tenantId: string;
  institutionId: string | null;
  knowledgeId: string | null;
  fileId: string | null;
  result: Awaited<ReturnType<typeof parsePlatformKnowledgeDocumentFileService>>;
}): JobRunOutcome {
  if (input.result.status === 'succeeded') {
    return {
      status: 'succeeded',
      totalCount: 1,
      processedCount: 1,
      failedCount: 0,
      failureReasonCode: input.result.parse.failureReasonCode,
      safeMessage: input.result.parse.safeFailureMessage ?? '文件解析任务已完成',
      metadataJson: sanitizeMetadata({
        ...baseMetadata({ ...input, mode: 'parse', counts: { total: 1, processed: 1, failed: 0 } }),
        parserType: 'parserType' in input.result ? input.result.parserType : undefined,
        warningCodes: 'warningCodes' in input.result ? input.result.warningCodes : [],
        ocrStatus: 'ocrStatus' in input.result ? input.result.ocrStatus : undefined,
      }),
    };
  }
  const parse = 'parse' in input.result ? input.result.parse : null;
  return {
    status: 'failed',
    totalCount: 1,
    processedCount: 0,
    failedCount: 1,
    failureReasonCode: parse?.failureReasonCode ?? input.result.status,
    safeMessage: parse?.safeFailureMessage ?? (('message' in input.result ? input.result.message : null) ?? safeGenericFailureMessage),
    metadataJson: baseMetadata({ ...input, mode: 'parse', counts: { total: 1, processed: 0, failed: 1 } }),
  };
}

function outcomeFromEmbeddingResult(input: {
  tenantId: string;
  institutionId: string | null;
  knowledgeId: string | null;
  fileId: string | null;
  mode: 'generate' | 'rebuild';
  result: Awaited<ReturnType<typeof generatePlatformKnowledgeChunkEmbeddingsService>>;
}): JobRunOutcome {
  const embeddingCount = 'embeddingCount' in input.result ? input.result.embeddingCount : 0;
  const skippedCount = 'skippedCount' in input.result ? input.result.skippedCount : 0;
  const totalCount = embeddingCount + skippedCount;
  if (input.result.status === 'succeeded' || input.result.status === 'empty') {
    return {
      status: 'succeeded',
      totalCount,
      processedCount: totalCount,
      failedCount: 0,
      failureReasonCode: null,
      safeMessage: 'message' in input.result && input.result.message ? input.result.message : '向量索引任务已完成',
      metadataJson: baseMetadata({ ...input, counts: { total: totalCount, processed: totalCount, failed: 0, skipped: skippedCount } }),
    };
  }
  return {
    status: 'failed',
    totalCount: Math.max(1, totalCount),
    processedCount: 0,
    failedCount: 1,
    failureReasonCode: ('errorCode' in input.result ? input.result.errorCode : input.result.status) ?? 'embedding_job_failed',
    safeMessage: (('message' in input.result ? input.result.message : null) ?? safeGenericFailureMessage),
    metadataJson: baseMetadata({ ...input, counts: { total: Math.max(1, totalCount), processed: 0, failed: 1, skipped: skippedCount } }),
  };
}

function quotaResourceForJobType(jobType: KnowledgeIndexingJobType): TenantQuotaResource {
  switch (jobType) {
    case 'parse_file':
      return 'knowledge_parse_jobs_monthly';
    case 'ocr_file':
      return 'knowledge_ocr_jobs_monthly';
    case 'generate_embeddings':
    case 'rebuild_embeddings':
      return 'knowledge_embedding_jobs_monthly';
    case 'rebuild_knowledge_index':
      return 'knowledge_index_rebuild_jobs_monthly';
  }
}

function quotaActionForJobType(jobType: KnowledgeIndexingJobType): KnowledgeQuotaUsageAction {
  switch (jobType) {
    case 'parse_file':
      return 'parse_file';
    case 'ocr_file':
      return 'ocr_file';
    case 'generate_embeddings':
      return 'generate_embeddings';
    case 'rebuild_embeddings':
      return 'rebuild_embeddings';
    case 'rebuild_knowledge_index':
      return 'rebuild_knowledge_index';
  }
}

async function enforceKnowledgeJobQuota(input: {
  database?: TenantDatabase;
  tenantId: string;
  institutionId: string | null;
  actorUserId: string | null;
  jobType: KnowledgeIndexingJobType;
}) {
  if (!input.database) return { status: 'allowed' as const };
  const quotaRepository = createKnowledgeQuotaUsageRepository(input.database);
  const resourceKey = quotaResourceForJobType(input.jobType);
  const action = quotaActionForJobType(input.jobType);
  if (input.jobType === 'ocr_file') {
    const featureDecision = await checkTenantKnowledgeOcrFeature({
      database: input.database,
      tenantId: input.tenantId,
    });
    await recordKnowledgeQuotaDecision({
      repository: quotaRepository,
      tenantId: input.tenantId,
      institutionId: input.institutionId,
      actorUserId: input.actorUserId,
      resourceKey,
      action,
      decision: featureDecision,
      quantity: 1,
    });
    if (!featureDecision.allowed) {
      return { status: 'rejected' as const, message: 'OCR 能力未包含在当前套餐中，请联系平台管理员调整套餐' };
    }
  }

  const decision = await checkTenantQuotaForCreate({
    database: input.database,
    tenantId: input.tenantId,
    resource: resourceKey,
  });
  await recordKnowledgeQuotaDecision({
    repository: quotaRepository,
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    actorUserId: input.actorUserId,
    resourceKey,
    action,
    decision,
    quantity: 1,
  });
  if (!decision.allowed) {
    return { status: 'rejected' as const, message: '知识库任务额度已达到当前套餐上限，请联系平台管理员调整套餐' };
  }

  return { status: 'allowed' as const, quotaRepository, resourceKey, action };
}

async function recordJobQuotaOutcome(input: {
  database?: TenantDatabase;
  tenantId: string;
  institutionId: string | null;
  actorUserId: string | null;
  jobType: KnowledgeIndexingJobType;
  status: 'succeeded' | 'failed';
}) {
  if (!input.database) return;
  await recordKnowledgeQuotaOutcome({
    repository: createKnowledgeQuotaUsageRepository(input.database),
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    actorUserId: input.actorUserId,
    resourceKey: quotaResourceForJobType(input.jobType),
    action: quotaActionForJobType(input.jobType),
    status: input.status,
    quantity: 1,
  });
}

async function createAndRunJob(input: {
  database?: TenantDatabase;
  repository: KnowledgeIndexingJobRepository;
  tenantId: string;
  institutionId: string | null;
  actorUserId: string | null;
  knowledgeId: string | null;
  fileId: string | null;
  jobType: KnowledgeIndexingJobType;
  metadataJson: JsonRecord;
  runner: (job: KnowledgeIndexingJobRecord) => Promise<JobRunOutcome>;
}) {
  const quota = await enforceKnowledgeJobQuota({
    database: input.database,
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    actorUserId: input.actorUserId,
    jobType: input.jobType,
  });
  if (quota.status === 'rejected') {
    return { status: 'quota_exceeded' as const, message: quota.message };
  }

  const created = await createKnowledgeIndexingJob({
    repository: input.repository,
    input: {
      tenantId: input.tenantId,
      institutionId: input.institutionId,
      actorUserId: input.actorUserId,
      knowledgeId: input.knowledgeId,
      fileId: input.fileId,
      jobType: input.jobType,
      metadataJson: input.metadataJson,
    },
  });
  if (created.status !== 'created') return created;
  const result = await runKnowledgeIndexingJob({
    repository: input.repository,
    tenantId: input.tenantId,
    jobId: created.record.jobId,
    runner: input.runner,
  });
  if (result.status === 'succeeded' || result.status === 'failed') {
    await recordJobQuotaOutcome({
      database: input.database,
      tenantId: input.tenantId,
      institutionId: input.institutionId,
      actorUserId: input.actorUserId,
      jobType: input.jobType,
      status: result.status,
    });
  }
  return result;
}

export async function createAndRunParseFileJob(input: {
  database?: TenantDatabase;
  repository: ParseJobRepository;
  storage: Pick<PlatformKnowledgeFileStorage, 'read'>;
  input: { tenantId?: string | null; institutionId?: string | null; actorUserId?: string | null; knowledgeId?: string | null; fileId?: string | null };
}) {
  return createAndRunParseLikeJob({ ...input, jobType: 'parse_file', mode: 'parse' });
}

export async function createAndRunOcrFileJob(input: {
  database?: TenantDatabase;
  repository: ParseJobRepository;
  storage: Pick<PlatformKnowledgeFileStorage, 'read'>;
  ocrProvider?: PlatformKnowledgeOcrProvider;
  input: { tenantId?: string | null; institutionId?: string | null; actorUserId?: string | null; knowledgeId?: string | null; fileId?: string | null };
}) {
  return createAndRunParseLikeJob({ ...input, jobType: 'ocr_file', mode: 'ocr' });
}

async function createAndRunParseLikeJob(input: {
  database?: TenantDatabase;
  repository: ParseJobRepository;
  storage: Pick<PlatformKnowledgeFileStorage, 'read'>;
  ocrProvider?: PlatformKnowledgeOcrProvider;
  input: { tenantId?: string | null; institutionId?: string | null; actorUserId?: string | null; knowledgeId?: string | null; fileId?: string | null };
  jobType: 'parse_file' | 'ocr_file';
  mode: 'parse' | 'ocr';
}) {
  const tenantId = normalizeString(input.input.tenantId);
  const institutionId = normalizeString(input.input.institutionId);
  const knowledgeId = normalizeString(input.input.knowledgeId);
  const fileId = normalizeString(input.input.fileId);
  if (!tenantId || !institutionId || !knowledgeId || !fileId) return { status: 'validation_failed' as const, message: '缺少文件解析任务范围' };
  const visible = await ensureInstitutionCanAccessKnowledge({ repository: input.repository, tenantId, institutionId, knowledgeId, fileId });
  if (visible.status !== 'visible') return { status: visible.status };

  return createAndRunJob({
    database: input.database,
    repository: input.repository,
    tenantId,
    institutionId,
    actorUserId: normalizeString(input.input.actorUserId),
    knowledgeId,
    fileId,
    jobType: input.jobType,
    metadataJson: baseMetadata({ tenantId, institutionId, knowledgeId, fileId, mode: input.mode }),
    runner: async () => outcomeFromParseResult({
      tenantId,
      institutionId,
      knowledgeId,
      fileId,
      result: await parsePlatformKnowledgeDocumentFileService({
        database: input.database,
        repository: input.repository,
        storage: input.storage,
        ocrProvider: input.ocrProvider,
        actorUserId: normalizeString(input.input.actorUserId),
        ocrQuotaAlreadyChecked: input.jobType === 'ocr_file',
        input: { tenantId, knowledgeId, fileId },
      }),
    }),
  });
}

export async function createAndRunGenerateEmbeddingsJob(input: {
  database?: TenantDatabase;
  repository: EmbeddingJobRepository;
  input: { tenantId?: string | null; institutionId?: string | null; actorUserId?: string | null; knowledgeId?: string | null; fileId?: string | null };
  provider?: PlatformKnowledgeEmbeddingProvider;
}) {
  return createAndRunEmbeddingJob({ ...input, jobType: 'generate_embeddings', rebuild: false });
}

export async function createAndRunRebuildEmbeddingsJob(input: {
  database?: TenantDatabase;
  repository: EmbeddingJobRepository;
  input: { tenantId?: string | null; institutionId?: string | null; actorUserId?: string | null; knowledgeId?: string | null; fileId?: string | null };
  provider?: PlatformKnowledgeEmbeddingProvider;
}) {
  return createAndRunEmbeddingJob({ ...input, jobType: 'rebuild_embeddings', rebuild: true });
}

export async function createAndRunRebuildKnowledgeIndexJob(input: {
  database?: TenantDatabase;
  repository: EmbeddingJobRepository;
  storage: Pick<PlatformKnowledgeFileStorage, 'read'>;
  input: { tenantId?: string | null; institutionId?: string | null; actorUserId?: string | null; knowledgeId?: string | null };
  provider?: PlatformKnowledgeEmbeddingProvider;
  ocrProvider?: PlatformKnowledgeOcrProvider;
}) {
  return createAndRunEmbeddingJob({ ...input, jobType: 'rebuild_knowledge_index', rebuild: true });
}

async function createAndRunEmbeddingJob(input: {
  database?: TenantDatabase;
  repository: EmbeddingJobRepository;
  input: { tenantId?: string | null; institutionId?: string | null; actorUserId?: string | null; knowledgeId?: string | null; fileId?: string | null };
  provider?: PlatformKnowledgeEmbeddingProvider;
  ocrProvider?: PlatformKnowledgeOcrProvider;
  storage?: Pick<PlatformKnowledgeFileStorage, 'read'>;
  jobType: 'generate_embeddings' | 'rebuild_embeddings' | 'rebuild_knowledge_index';
  rebuild: boolean;
}) {
  const tenantId = normalizeString(input.input.tenantId);
  const institutionId = normalizeString(input.input.institutionId);
  const knowledgeId = normalizeString(input.input.knowledgeId);
  const fileId = normalizeString(input.input.fileId);
  if (!tenantId || !institutionId) return { status: 'validation_failed' as const, message: '缺少向量索引任务范围' };
  if (!knowledgeId) return { status: 'validation_failed' as const, message: '缺少知识条目范围' };
  const visible = await ensureInstitutionCanAccessKnowledge({ repository: input.repository, tenantId, institutionId, knowledgeId, fileId });
  if (visible.status !== 'visible') return { status: visible.status };

  const mode = input.rebuild ? 'rebuild' : 'generate';
  return createAndRunJob({
    database: input.database,
    repository: input.repository,
    tenantId,
    institutionId,
    actorUserId: normalizeString(input.input.actorUserId),
    knowledgeId,
    fileId,
    jobType: input.jobType,
    metadataJson: baseMetadata({ tenantId, institutionId, knowledgeId, fileId, mode }),
    runner: async () => {
      if (input.jobType === 'rebuild_knowledge_index') {
        if (!input.storage || !input.repository.listKnowledgeFiles) throw new Error('missing parse storage');
        const parseRepository = input.repository as unknown as PlatformKnowledgeDocumentParsingRepository;
        const files = (await input.repository.listKnowledgeFiles({ tenantId, knowledgeId }))
          .filter((file) => file.status === 'active');
        let parsed = 0;
        let failed = 0;
        for (const file of files) {
          const parseResult = await parsePlatformKnowledgeDocumentFileService({
            database: input.database,
            repository: parseRepository,
            storage: input.storage,
            ocrProvider: input.ocrProvider,
            actorUserId: normalizeString(input.input.actorUserId),
            input: { tenantId, knowledgeId, fileId: file.fileId },
          });
          if (parseResult.status === 'succeeded') parsed += 1;
          else failed += 1;
        }
        if (failed > 0) {
          return {
            status: 'failed',
            totalCount: files.length,
            processedCount: parsed,
            failedCount: failed,
            failureReasonCode: 'parse_service_failed',
            safeMessage: '知识库重建解析存在失败文件，请查看文件解析状态',
            metadataJson: baseMetadata({ tenantId, institutionId, knowledgeId, fileId, mode, counts: { total: files.length, processed: parsed, failed } }),
          } satisfies JobRunOutcome;
        }
      }

      return outcomeFromEmbeddingResult({
        tenantId,
        institutionId,
        knowledgeId,
        fileId,
        mode,
        result: await generatePlatformKnowledgeChunkEmbeddingsService({
          repository: input.repository,
          provider: input.provider,
          params: {
            tenantId,
            institutionId,
            knowledgeId,
            fileId,
            rebuild: input.rebuild,
          },
        }),
      });
    },
  });
}
