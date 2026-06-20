import { randomUUID } from 'node:crypto';

import { createAuditEvent } from '@/modules/audit/domain/audit-events';
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import type { AccessContext } from '@/modules/security/domain/access-control';
import type {
  CategoryStats,
  ImportJobStatus,
  KnowledgeTrainingStatus,
  PlatformKnowledgeTotals,
  TenantKnowledgeStatus,
} from '@/modules/open-platform/mock/platformKnowledge';
import {
  buildPlatformKnowledgeDirectories,
  normalizePageParams,
  parsePlatformKnowledgeDirectoryId,
  type PlatformKnowledgeDirectoryDto,
  type PlatformKnowledgeDirectoryMutationResponse,
  type PlatformKnowledgeFileDto,
  type PlatformKnowledgeFilesParams,
  type PlatformKnowledgeImportJobDto,
  type PlatformKnowledgeItemDto,
  type PlatformKnowledgeItemsParams,
  type PlatformKnowledgeListResponse,
  type PlatformKnowledgeOverviewParams,
  type PlatformKnowledgeOverviewResponse,
  type PlatformKnowledgeTenantDto,
  type PlatformKnowledgeTopQuestionDto,
} from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';
import type {
  PlatformKnowledgeManagementRepository,
  PlatformKnowledgeDirectoryCreateRepositoryInput,
  PlatformKnowledgeDirectoryCreateRepositoryResult,
  PlatformKnowledgeDirectoryArchiveRepositoryResult,
  PlatformKnowledgeDirectoryReorderRepositoryInput,
  PlatformKnowledgeDirectoryReorderRepositoryResult,
  PlatformKnowledgeDirectoryRenameRepositoryInput,
  PlatformKnowledgeDirectoryRenameRepositoryResult,
  PlatformKnowledgeRepositoryRecord,
  PlatformKnowledgeVisibilityRepositoryInput,
  PlatformKnowledgeVisibilityRepositoryResult,
} from '@/modules/open-platform/server/platform-knowledge-management-repository';
import type { KnowledgeQaAuditLogDto } from '@/modules/open-platform/server/platform-knowledge-qa-service';
import type {
  V1KnowledgeBaseRuntimeFoundationStatus,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-runtime-foundation-api-contract';

type PlatformKnowledgeItemsServiceInput = {
  repository: Pick<PlatformKnowledgeManagementRepository, 'listKnowledgeItems'>;
  params: PlatformKnowledgeItemsParams;
};

type PlatformKnowledgeOverviewServiceInput = {
  repository: Pick<
    PlatformKnowledgeManagementRepository,
    'listKnowledgeDirectorySources' | 'listKnowledgeOverviewFiles' | 'listKnowledgeOverviewItems' | 'listKnowledgeOverviewQaAudits'
  >;
  params: PlatformKnowledgeOverviewParams;
};

type PlatformKnowledgeOverviewFilesServiceInput = {
  repository: Pick<PlatformKnowledgeManagementRepository, 'listKnowledgeOverviewFiles'>;
  params: PlatformKnowledgeFilesParams;
};

type PlatformKnowledgeOverviewItemsServiceInput = {
  repository: Pick<PlatformKnowledgeManagementRepository, 'listKnowledgeOverviewItems'>;
  params: PlatformKnowledgeItemsParams;
};

type PlatformKnowledgeVisibilityServiceInput = {
  repository: Pick<
    PlatformKnowledgeManagementRepository,
    'bindInstitutionVisibility' | 'hasTenantInstitution' | 'unbindInstitutionVisibility'
  >;
  input: PlatformKnowledgeVisibilityRepositoryInput;
};

type PlatformKnowledgeDirectoryRepository = Pick<
  PlatformKnowledgeManagementRepository,
  'listKnowledgeDirectorySources' | 'listKnowledgeOverviewFiles' | 'listKnowledgeOverviewItems' | 'listKnowledgeOverviewQaAudits'
> & {
  createKnowledgeDirectory(
    input: PlatformKnowledgeDirectoryCreateRepositoryInput,
  ): Promise<PlatformKnowledgeDirectoryCreateRepositoryResult>;
  renameKnowledgeDirectory(
    input: PlatformKnowledgeDirectoryRenameRepositoryInput,
  ): Promise<PlatformKnowledgeDirectoryRenameRepositoryResult>;
  archiveKnowledgeDirectory(input: {
    tenantId: string;
    directoryId: string;
  }): Promise<PlatformKnowledgeDirectoryArchiveRepositoryResult>;
  reorderKnowledgeDirectories(
    input: PlatformKnowledgeDirectoryReorderRepositoryInput,
  ): Promise<PlatformKnowledgeDirectoryReorderRepositoryResult>;
};

type PlatformKnowledgeDirectoryAuditRepository = {
  record(event: TenantAuditEvent): Promise<void>;
};

type PlatformKnowledgeRenameDirectoryServiceInput = {
  repository: PlatformKnowledgeDirectoryRepository;
  auditRepository: PlatformKnowledgeDirectoryAuditRepository;
  accessContext: AccessContext;
  input: {
    tenantId?: string | null;
    directoryId: string;
    name?: string | null;
  };
};

type PlatformKnowledgeCreateDirectoryServiceInput = {
  repository: PlatformKnowledgeDirectoryRepository;
  auditRepository: PlatformKnowledgeDirectoryAuditRepository;
  accessContext: AccessContext;
  input: {
    tenantId?: string | null;
    name?: string | null;
    parentId?: string | null;
  };
};

type PlatformKnowledgeArchiveDirectoryServiceInput = {
  repository: PlatformKnowledgeDirectoryRepository;
  auditRepository: PlatformKnowledgeDirectoryAuditRepository;
  accessContext: AccessContext;
  params: {
    tenantId?: string | null;
    directoryId: string;
  };
};

type PlatformKnowledgeReorderDirectoryServiceInput = {
  repository: PlatformKnowledgeDirectoryRepository;
  auditRepository: PlatformKnowledgeDirectoryAuditRepository;
  accessContext: AccessContext;
  input: {
    tenantId?: string | null;
    directoryIds?: unknown;
  };
};

type PlatformKnowledgeDirectoryUnsupportedServiceInput = {
  input?: {
    tenantId?: string | null;
    directoryId?: string | null;
  };
};

const emptyState = {
  title: '暂无匹配的知识库运营数据',
  description: '请调整机构范围或文件名搜索条件后再查看。',
};

const zeroTotals: PlatformKnowledgeTotals = {
  tenantCount: 0,
  knowledgeCount: 0,
  categoryCount: 0,
  folderCount: 0,
  hitCount: 0,
  chunkCount: 0,
  averageHitCount: 0,
  trainedCount: 0,
  failedTrainingCount: 0,
  zeroHitCount: 0,
  importJobCount: 0,
  failedImportJobCount: 0,
  hitCoverageRate: 0,
  trainingCoverageRate: 0,
  importSuccessRate: 0,
  pendingOptimizationCount: 0,
  sourceFileCount: 0,
  totalFileSizeKb: 0,
  parsedFileCount: 0,
  failedFileCount: 0,
};

const directoryNameMaxLength = 64;
const invalidDirectoryNamePattern = /[\\/\u0000-\u001F]|\.\./u;

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function assertTenantId(tenantId: string | null | undefined): string {
  const normalized = normalizeOptionalString(tenantId);
  if (!normalized) {
    throw new Error('tenantId 是平台知识库真实数据查询的必填范围');
  }

  return normalized;
}

function normalizeStatus(value: string | null | undefined) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return undefined;

  const allowedStatuses = new Set<V1KnowledgeBaseRuntimeFoundationStatus>([
    'disabled',
    'denied',
    'empty',
    'pending',
    'ready',
    'failed',
  ]);

  return allowedStatuses.has(normalized as V1KnowledgeBaseRuntimeFoundationStatus)
    ? normalized as V1KnowledgeBaseRuntimeFoundationStatus
    : undefined;
}

function formatPlatformKnowledgeDate(date: Date) {
  return date.toISOString();
}

function trainingStatusFromRuntimeStatus(
  status: V1KnowledgeBaseRuntimeFoundationStatus,
): KnowledgeTrainingStatus {
  if (status === 'ready') return 'trained';
  if (status === 'pending' || status === 'empty') return 'pending';
  if (status === 'failed') return 'failed';

  return 'failed';
}

function matchesKeyword(record: PlatformKnowledgeRepositoryRecord, keyword: string | undefined) {
  if (!keyword) return true;
  const normalized = keyword.toLowerCase();

  return [
    record.title,
    record.version,
    record.category,
    record.descriptionPreview,
    record.institutionId,
    record.workspaceId,
    ...record.visibleInstitutionIds,
  ].some((value) => value.toLowerCase().includes(normalized));
}

function matchesInstitution(
  record: PlatformKnowledgeRepositoryRecord,
  institutionId: string | undefined,
) {
  if (!institutionId) return true;

  return (
    record.institutionId === institutionId ||
    record.visibleInstitutionIds.includes(institutionId)
  );
}

function mapRecordToDto(record: PlatformKnowledgeRepositoryRecord): PlatformKnowledgeItemDto {
  return {
    knowledgeId: record.knowledgeId,
    tenantId: record.tenantId,
    tenantName: record.tenantName ?? '未命名机构',
    title: record.title,
    descriptionPreview: record.descriptionPreview,
    category: record.category,
    folder: record.workspaceId,
    type: 'document',
    hitCount: 0,
    chunkCount: record.chunkCount,
    tags: [],
    enabled: record.status === 'ready' || record.status === 'pending',
    updatedAt: formatPlatformKnowledgeDate(record.updatedAt),
    trainingStatus: trainingStatusFromRuntimeStatus(record.status),
    institutionId: record.institutionId,
    workspaceId: record.workspaceId,
    version: record.version,
    sourceKind: record.sourceKind,
    status: record.status,
    readonlyStatus: record.readonlyStatus,
    visibleInstitutionIds: record.visibleInstitutionIds,
    createdAt: formatPlatformKnowledgeDate(record.createdAt),
  };
}

function buildRepositoryListResponse<TRecord>(
  requestId: PlatformKnowledgeListResponse<TRecord>['requestId'],
  records: TRecord[],
  page: number,
  pageSize: number,
): PlatformKnowledgeListResponse<TRecord> {
  const total = records.length;
  const pageCount = Math.ceil(total / pageSize);
  const safePage = pageCount > 0 ? Math.min(page, pageCount) : page;
  const start = (safePage - 1) * pageSize;

  return {
    requestId,
    readonly: true,
    dataSource: 'repository',
    records: records.slice(start, start + pageSize),
    pageInfo: {
      page: safePage,
      pageSize,
      total,
      pageCount,
      hasPreviousPage: safePage > 1 && total > 0,
      hasNextPage: safePage < pageCount,
    },
    emptyState,
  };
}

function normalizeTenantId(tenantId: string | null | undefined) {
  return normalizeOptionalString(tenantId) ?? null;
}

function tenantStatusFromStats(input: {
  failedTrainingCount: number;
  hitCoverageRate: number;
  knowledgeCount: number;
}): TenantKnowledgeStatus {
  if (input.failedTrainingCount > 0) return 'abnormal';
  if (input.knowledgeCount > 0 && input.hitCoverageRate < 0.3) return 'low_activity';
  return 'active';
}

function hitCountForTenant(audits: KnowledgeQaAuditLogDto[], tenantId: string) {
  return audits.filter((audit) => audit.tenantId === tenantId).length;
}

function buildTotals(
  items: PlatformKnowledgeRepositoryRecord[],
  files: PlatformKnowledgeFileDto[],
  audits: KnowledgeQaAuditLogDto[],
): PlatformKnowledgeTotals {
  if (items.length === 0 && files.length === 0) return { ...zeroTotals };

  const tenantIds = new Set([
    ...items.map((item) => item.tenantId),
    ...files.map((file) => file.tenantId),
  ]);
  const categories = new Set(items.map((item) => item.category));
  const folders = new Set(items.map((item) => item.workspaceId));
  const trainedCount = items.filter((item) => item.status === 'ready').length;
  const failedTrainingCount = items.filter((item) => item.status === 'failed' || item.status === 'disabled').length;
  const hitCount = audits.length;
  const estimatedHitKnowledgeCount = Math.min(hitCount, items.length);
  const zeroHitCount = Math.max(items.length - estimatedHitKnowledgeCount, 0);
  const parsedFileCount = files.filter((file) => file.parseStatus === 'parsed').length;
  const failedFileCount = files.filter((file) => file.parseStatus === 'failed').length;
  const importJobCount = files.length;
  const failedImportJobCount = failedFileCount;

  return {
    tenantCount: tenantIds.size,
    knowledgeCount: items.length,
    categoryCount: categories.size,
    folderCount: folders.size,
    hitCount,
    chunkCount: items.reduce((sum, item) => sum + item.chunkCount, 0),
    averageHitCount: items.length > 0 ? Number((hitCount / items.length).toFixed(1)) : 0,
    trainedCount,
    failedTrainingCount,
    zeroHitCount,
    importJobCount,
    failedImportJobCount,
    hitCoverageRate: items.length > 0 ? estimatedHitKnowledgeCount / items.length : 0,
    trainingCoverageRate: items.length > 0 ? trainedCount / items.length : 0,
    importSuccessRate: importJobCount > 0 ? parsedFileCount / importJobCount : 0,
    pendingOptimizationCount: zeroHitCount + failedTrainingCount + failedFileCount,
    sourceFileCount: files.length,
    totalFileSizeKb: files.reduce((sum, file) => sum + file.fileSizeKb, 0),
    parsedFileCount,
    failedFileCount,
  };
}

function buildTenantStats(
  items: PlatformKnowledgeRepositoryRecord[],
  files: PlatformKnowledgeFileDto[],
  audits: KnowledgeQaAuditLogDto[],
): PlatformKnowledgeTenantDto[] {
  const tenantIds = Array.from(new Set([
    ...items.map((item) => item.tenantId),
    ...files.map((file) => file.tenantId),
  ]));

  return tenantIds.map((tenantId) => {
    const tenantItems = items.filter((item) => item.tenantId === tenantId);
    const tenantFiles = files.filter((file) => file.tenantId === tenantId);
    const tenantAudits = audits.filter((audit) => audit.tenantId === tenantId);
    const totals = buildTotals(tenantItems, tenantFiles, tenantAudits);
    const tenantName =
      tenantItems[0]?.tenantName ??
      tenantFiles[0]?.tenantName ??
      '未命名机构';

    return {
      tenantId,
      tenantName,
      status: tenantStatusFromStats({
        failedTrainingCount: totals.failedTrainingCount,
        hitCoverageRate: totals.hitCoverageRate,
        knowledgeCount: totals.knowledgeCount,
      }),
      knowledgeCount: totals.knowledgeCount,
      folderCount: totals.folderCount,
      hitCount: totals.hitCount,
      trainedCount: totals.trainedCount,
      failedTrainingCount: totals.failedTrainingCount,
      zeroHitCount: totals.zeroHitCount,
      chunkCount: totals.chunkCount,
      averageHitCount: totals.averageHitCount,
      hitCoverageRate: totals.hitCoverageRate,
      trainingCoverageRate: totals.trainingCoverageRate,
      importSuccessRate: totals.importSuccessRate,
    };
  });
}

function buildCategoryStats(
  items: PlatformKnowledgeRepositoryRecord[],
  audits: KnowledgeQaAuditLogDto[],
): CategoryStats[] {
  const categories = Array.from(new Set(items.map((item) => item.category)));

  return categories
    .map((category) => {
      const categoryItems = items.filter((item) => item.category === category);
      const hitCount = categoryItems.reduce((sum, item) => sum + hitCountForTenant(audits, item.tenantId), 0);
      const trainedCount = categoryItems.filter((item) => item.status === 'ready').length;
      const estimatedHitKnowledgeCount = Math.min(hitCount, categoryItems.length);

      return {
        categoryCode: category,
        categoryName: category,
        knowledgeCount: categoryItems.length,
        hitCount,
        trainedCount,
        zeroHitCount: Math.max(categoryItems.length - estimatedHitKnowledgeCount, 0),
        chunkCount: categoryItems.reduce((sum, item) => sum + item.chunkCount, 0),
        averageHitCount: categoryItems.length > 0 ? Number((hitCount / categoryItems.length).toFixed(1)) : 0,
        hitCoverageRate: categoryItems.length > 0 ? estimatedHitKnowledgeCount / categoryItems.length : 0,
        trainingCoverageRate: categoryItems.length > 0 ? trainedCount / categoryItems.length : 0,
      };
    })
    .sort((a, b) => b.hitCount - a.hitCount || b.knowledgeCount - a.knowledgeCount);
}

function buildTopQuestions(
  audits: KnowledgeQaAuditLogDto[],
  items: PlatformKnowledgeRepositoryRecord[],
): PlatformKnowledgeTopQuestionDto[] {
  const tenantNameById = new Map(items.map((item) => [item.tenantId, item.tenantName ?? '未命名机构']));
  const byQuestion = new Map<string, {
    tenantId: string;
    questionTitle: string;
    hitCount: number;
    updatedAt: string;
  }>();

  audits.forEach((audit) => {
    const current = byQuestion.get(`${audit.tenantId}:${audit.question}`);
    if (current) {
      current.hitCount += 1;
      if (audit.createdAt > current.updatedAt) current.updatedAt = audit.createdAt;
      return;
    }

    byQuestion.set(`${audit.tenantId}:${audit.question}`, {
      tenantId: audit.tenantId,
      questionTitle: audit.question,
      hitCount: 1,
      updatedAt: audit.createdAt,
    });
  });

  return Array.from(byQuestion.entries())
    .map(([key, question]) => ({
      knowledgeId: `qa-${key}`,
      tenantId: question.tenantId,
      tenantName: tenantNameById.get(question.tenantId) ?? '未命名机构',
      questionTitle: question.questionTitle,
      category: '问答审计',
      folder: '低敏问答记录',
      hitCount: question.hitCount,
      updatedAt: question.updatedAt,
    }))
    .sort((a, b) => b.hitCount - a.hitCount)
    .slice(0, 10);
}

function parseStatusToJobStatus(status: PlatformKnowledgeFileDto['parseStatus']): ImportJobStatus {
  if (status === 'parsed') return 'completed';
  if (status === 'failed') return 'failed';
  if (status === 'parsing') return 'running';
  return 'running';
}

function buildImportJobs(files: PlatformKnowledgeFileDto[]): PlatformKnowledgeImportJobDto[] {
  return files.slice(0, 12).map((file) => ({
    taskId: file.taskId,
    tenantId: file.tenantId,
    tenantName: file.tenantName,
    title: file.fileName,
    status: parseStatusToJobStatus(file.parseStatus),
    totalCount: 1,
    successCount: file.parseStatus === 'parsed' ? 1 : 0,
    failedCount: file.parseStatus === 'failed' ? 1 : 0,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  }));
}

function matchesFileKeyword(record: PlatformKnowledgeFileDto, keyword: string | undefined) {
  if (!keyword) return true;
  const normalized = keyword.toLowerCase();

  return [
    record.fileName,
    record.fileType,
    record.category,
    record.folder,
    record.tenantName,
  ].some((value) => value.toLowerCase().includes(normalized));
}

function normalizeFileParseStatus(value: string | null | undefined) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return undefined;
  if (normalized === 'parsed' || normalized === 'failed' || normalized === 'parsing' || normalized === 'pending') {
    return normalized;
  }
  return undefined;
}

function directoryMutationResponse(
  status: PlatformKnowledgeDirectoryMutationResponse['status'],
  message: string,
): PlatformKnowledgeDirectoryMutationResponse {
  return {
    requestId: 'open-platform-knowledge-directory-management',
    readonly: false,
    status,
    message,
  };
}

function validateDirectoryName(name: string | undefined) {
  if (!name) return '目录名称不能为空';
  if (name.length > directoryNameMaxLength) return `目录名称不能超过 ${directoryNameMaxLength} 个字符`;
  if (invalidDirectoryNamePattern.test(name)) return '目录名称不能包含路径或控制字符';

  return null;
}

function createKnowledgeDirectoryAuditId(action: string, tenantId: string, directoryId: string) {
  return `pkb-dir-${action}-${tenantId}-${randomUUID().slice(0, 18)}`;
}

function encodeDirectoryPart(value: string) {
  return encodeURIComponent(value);
}

function renamedDirectoryId(directory: PlatformKnowledgeDirectoryDto, nextName: string) {
  if (directory.kind === 'knowledge_library') return `directory:library:${encodeDirectoryPart(nextName)}`;
  if (directory.kind === 'folder') {
    const parsedParent = directory.parentId ? parsePlatformKnowledgeDirectoryId(directory.parentId) : { ok: false as const };
    const libraryName = parsedParent.ok && parsedParent.kind === 'knowledge_library'
      ? parsedParent.libraryName
      : '未分类';
    return `directory:folder:${encodeDirectoryPart(libraryName)}:${encodeDirectoryPart(nextName)}`;
  }

  return directory.directoryId;
}

function createdLibraryDirectory(name: string): PlatformKnowledgeDirectoryDto {
  return {
    directoryId: `directory:library:${encodeDirectoryPart(name)}`,
    parentId: null,
    kind: 'knowledge_library',
    name,
    depth: 0,
    sortOrder: 100,
    knowledgeCount: 0,
    fileCount: 0,
    canRename: true,
    canCreateChild: true,
    canArchive: true,
    archiveBlockedReason: null,
    status: 'active',
  };
}

function createdFolderDirectory(input: {
  parentId: string;
  libraryName: string;
  folderName: string;
}): PlatformKnowledgeDirectoryDto {
  return {
    directoryId: `directory:folder:${encodeDirectoryPart(input.libraryName)}:${encodeDirectoryPart(input.folderName)}`,
    parentId: input.parentId,
    kind: 'folder',
    name: input.folderName,
    depth: 1,
    sortOrder: 101,
    knowledgeCount: 0,
    fileCount: 0,
    canRename: true,
    canCreateChild: false,
    canArchive: true,
    archiveBlockedReason: null,
    status: 'active',
  };
}

export async function listPlatformKnowledgeItemsService(
  input: PlatformKnowledgeItemsServiceInput,
): Promise<PlatformKnowledgeListResponse<PlatformKnowledgeItemDto>> {
  const tenantId = assertTenantId(input.params.tenantId);
  const pageParams = normalizePageParams(input.params);
  if (!pageParams.ok) {
    throw new Error(pageParams.error.error.message);
  }

  const keyword = normalizeOptionalString(input.params.keyword);
  const category = normalizeOptionalString(input.params.category);
  const institutionId = normalizeOptionalString(input.params.institutionId);
  const status = normalizeStatus(input.params.status);
  const trainingStatus = normalizeOptionalString(input.params.trainingStatus);
  const records = await input.repository.listKnowledgeItems({ tenantId });
  const filtered = records
    .filter((record) => record.tenantId === tenantId)
    .filter((record) => matchesKeyword(record, keyword))
    .filter((record) => !category || record.category === category)
    .filter((record) => matchesInstitution(record, institutionId))
    .filter((record) => !status || record.status === status)
    .map(mapRecordToDto)
    .filter((record) => !trainingStatus || record.trainingStatus === trainingStatus);

  return buildRepositoryListResponse(
    'open-platform-knowledge-management-items',
    filtered,
    pageParams.page,
    pageParams.pageSize,
  );
}

export async function getPlatformKnowledgeOverviewService(
  input: PlatformKnowledgeOverviewServiceInput,
): Promise<PlatformKnowledgeOverviewResponse> {
  const tenantId = normalizeTenantId(input.params.tenantId);
  const [allItems, allFiles, allAudits, allDirectorySources] = await Promise.all([
    input.repository.listKnowledgeOverviewItems({ tenantId: null }),
    input.repository.listKnowledgeOverviewFiles({ tenantId: null }),
    input.repository.listKnowledgeOverviewQaAudits({ tenantId: null }),
    input.repository.listKnowledgeDirectorySources({ tenantId: null }),
  ]);
  const scopedItems = tenantId ? allItems.filter((item) => item.tenantId === tenantId) : allItems;
  const scopedFiles = tenantId ? allFiles.filter((file) => file.tenantId === tenantId) : allFiles;
  const scopedAudits = tenantId ? allAudits.filter((audit) => audit.tenantId === tenantId) : allAudits;
  const scopedDirectorySources = tenantId
    ? allDirectorySources.filter((source) => source.tenantId === tenantId)
    : allDirectorySources;
  const tenants = buildTenantStats(allItems, allFiles, allAudits);
  const scopedTenant = tenantId ? tenants.find((tenant) => tenant.tenantId === tenantId) : null;

  return {
    requestId: 'open-platform-knowledge-management-overview',
    readonly: true,
    dataSource: 'repository',
    scope: {
      tenantId,
      scopeName: scopedTenant?.tenantName ?? '全部机构',
    },
    allTotals: buildTotals(allItems, allFiles, allAudits),
    totals: buildTotals(scopedItems, scopedFiles, scopedAudits),
    tenants,
    categoryStats: buildCategoryStats(scopedItems, scopedAudits),
    directories: buildPlatformKnowledgeDirectories({
      items: scopedItems.map((item) => ({
        category: item.category,
        folder: item.workspaceId,
      })),
      files: scopedFiles,
      sources: scopedDirectorySources,
    }),
    topQuestions: buildTopQuestions(scopedAudits, scopedItems),
    importJobs: buildImportJobs(scopedFiles),
  };
}

export async function createPlatformKnowledgeDirectoryService(
  input: PlatformKnowledgeCreateDirectoryServiceInput,
): Promise<PlatformKnowledgeDirectoryMutationResponse> {
  const tenantId = normalizeOptionalString(input.input.tenantId);
  const nextName = normalizeOptionalString(input.input.name);
  const parentId = normalizeOptionalString(input.input.parentId) ?? null;

  if (!tenantId) {
    return directoryMutationResponse('validation_failed', '请选择具体机构后再新增目录');
  }
  const nameValidationMessage = validateDirectoryName(nextName);
  if (nameValidationMessage) {
    return directoryMutationResponse('validation_failed', nameValidationMessage);
  }
  const safeNextName = nextName ?? '';

  const overview = await getPlatformKnowledgeOverviewService({
    repository: input.repository,
    params: { tenantId },
  });
  const parentDirectory = parentId
    ? overview.directories.find((directory) => directory.directoryId === parentId)
    : null;
  if (parentId && (!parentDirectory || parentDirectory.kind !== 'knowledge_library')) {
    return directoryMutationResponse('validation_failed', '只能在一级知识库下新增子目录');
  }

  const duplicateDirectory = overview.directories.find((directory) =>
    directory.parentId === parentId &&
    directory.name === safeNextName,
  );
  if (duplicateDirectory) {
    return directoryMutationResponse('validation_failed', '同级目录名称已存在');
  }

  const libraryName = parentDirectory?.name ?? safeNextName;
  const folderName = parentDirectory ? safeNextName : null;
  const result = await input.repository.createKnowledgeDirectory({
    tenantId,
    name: safeNextName,
    parentId,
    libraryName,
    folderName,
  });
  if (result.status === 'not_found') {
    return directoryMutationResponse('not_found', '目录暂时无法创建');
  }

  const directory = parentDirectory
    ? createdFolderDirectory({
      parentId: parentDirectory.directoryId,
      libraryName,
      folderName: safeNextName,
    })
    : createdLibraryDirectory(safeNextName);

  await input.auditRepository.record(
    createAuditEvent({
      eventId: createKnowledgeDirectoryAuditId('create', tenantId, directory.directoryId),
      context: {
        ...input.accessContext,
        tenantId,
      },
      resource: 'knowledge_management',
      resourceId: directory.directoryId,
      action: 'create',
      result: 'allowed',
      reason: 'allowed_by_policy',
      occurredAt: new Date().toISOString(),
    }),
  );

  return {
    ...directoryMutationResponse('created', '目录已创建'),
    directory,
    affected: {
      sources: 1,
      documents: 0,
      chunks: 0,
      jobs: 0,
    },
  };
}

export async function renamePlatformKnowledgeDirectoryService(
  input: PlatformKnowledgeRenameDirectoryServiceInput,
): Promise<PlatformKnowledgeDirectoryMutationResponse> {
  const tenantId = normalizeOptionalString(input.input.tenantId);
  const nextName = normalizeOptionalString(input.input.name);
  const parsedDirectoryId = parsePlatformKnowledgeDirectoryId(input.input.directoryId);

  if (!tenantId) {
    return directoryMutationResponse('validation_failed', '请选择具体机构后再编辑目录');
  }
  if (!parsedDirectoryId.ok) {
    return directoryMutationResponse('validation_failed', '目录标识无效');
  }
  const nameValidationMessage = validateDirectoryName(nextName);
  if (nameValidationMessage) {
    return directoryMutationResponse('validation_failed', nameValidationMessage);
  }
  const safeNextName = nextName ?? '';

  const overview = await getPlatformKnowledgeOverviewService({
    repository: input.repository,
    params: { tenantId },
  });
  const currentDirectory = overview.directories.find(
    (directory) => directory.directoryId === input.input.directoryId,
  );
  if (!currentDirectory || !currentDirectory.canRename) {
    return directoryMutationResponse('not_found', '未找到可重命名的目录');
  }
  const duplicateDirectory = overview.directories.find((directory) =>
    directory.directoryId !== currentDirectory.directoryId &&
    directory.parentId === currentDirectory.parentId &&
    directory.name === nextName,
  );
  if (duplicateDirectory) {
    return directoryMutationResponse('validation_failed', '同级目录名称已存在');
  }

  const result = await input.repository.renameKnowledgeDirectory({
    tenantId,
    directoryId: input.input.directoryId,
    nextName: safeNextName,
  });
  if (result.status === 'not_found') {
    return directoryMutationResponse('not_found', '未找到可重命名的目录');
  }

  await input.auditRepository.record(
    createAuditEvent({
      eventId: createKnowledgeDirectoryAuditId('rename', tenantId, input.input.directoryId),
      context: {
        ...input.accessContext,
        tenantId,
      },
      resource: 'knowledge_management',
      resourceId: input.input.directoryId,
      action: 'update',
      result: 'allowed',
      reason: 'allowed_by_policy',
      occurredAt: new Date().toISOString(),
    }),
  );

  return {
    ...directoryMutationResponse('renamed', '目录名称已保存'),
    directory: {
      ...currentDirectory,
      directoryId: renamedDirectoryId(currentDirectory, safeNextName),
      name: safeNextName,
    },
    affected: {
      sources: result.affectedSources,
      documents: result.affectedDocuments,
      chunks: result.affectedChunks,
      jobs: result.affectedJobs,
    },
  };
}

export function createPlatformKnowledgeDirectoryUnsupportedResponse(
  message: string,
  _input: PlatformKnowledgeDirectoryUnsupportedServiceInput = {},
): PlatformKnowledgeDirectoryMutationResponse {
  return directoryMutationResponse('not_supported_without_directory_store', message);
}

export async function reorderPlatformKnowledgeDirectoriesService(
  input: PlatformKnowledgeReorderDirectoryServiceInput,
): Promise<PlatformKnowledgeDirectoryMutationResponse> {
  const tenantId = normalizeOptionalString(input.input.tenantId);
  if (!tenantId) {
    return directoryMutationResponse('validation_failed', '请选择具体机构后再调整目录排序');
  }
  if (!Array.isArray(input.input.directoryIds) || input.input.directoryIds.length === 0) {
    return directoryMutationResponse('validation_failed', '请提供需要排序的目录');
  }

  const directoryIds = input.input.directoryIds
    .filter((directoryId): directoryId is string => typeof directoryId === 'string')
    .map((directoryId) => directoryId.trim())
    .filter(Boolean);
  if (directoryIds.length === 0) {
    return directoryMutationResponse('validation_failed', '请提供需要排序的目录');
  }
  const hasInvalidDirectoryId = directoryIds.some((directoryId) => {
    if (directoryId === 'directory:all-knowledge') return false;

    return !parsePlatformKnowledgeDirectoryId(directoryId).ok;
  });
  if (hasInvalidDirectoryId) {
    return directoryMutationResponse('validation_failed', '目录排序参数无效');
  }

  const result = await input.repository.reorderKnowledgeDirectories({
    tenantId,
    directoryIds,
  });
  if (result.status === 'not_found') {
    return directoryMutationResponse('not_found', '未找到可排序的目录');
  }

  await input.auditRepository.record(
    createAuditEvent({
      eventId: createKnowledgeDirectoryAuditId('reorder', tenantId, 'knowledge-directory-order'),
      context: {
        ...input.accessContext,
        tenantId,
      },
      resource: 'knowledge_management',
      resourceId: 'knowledge-directory-order',
      action: 'update',
      result: 'allowed',
      reason: 'allowed_by_policy',
      occurredAt: new Date().toISOString(),
    }),
  );

  return {
    ...directoryMutationResponse('reordered', '目录排序已保存'),
    affected: {
      sources: result.affectedSources,
      documents: 0,
      chunks: 0,
      jobs: 0,
    },
  };
}

export async function archivePlatformKnowledgeDirectoryService(
  input: PlatformKnowledgeArchiveDirectoryServiceInput,
): Promise<PlatformKnowledgeDirectoryMutationResponse> {
  const tenantId = normalizeOptionalString(input.params.tenantId);
  if (!tenantId) {
    return directoryMutationResponse('validation_failed', '请选择具体机构后再归档目录');
  }

  const overview = await getPlatformKnowledgeOverviewService({
    repository: input.repository,
    params: { tenantId },
  });
  const directory = overview.directories.find(
    (candidate) => candidate.directoryId === input.params.directoryId,
  );
  if (!directory) {
    return directoryMutationResponse('not_found', '未找到可归档的目录');
  }
  if (!directory.canArchive) {
    return {
      ...directoryMutationResponse(
        'blocked',
        '目录下仍有知识条目或文件，请先迁移后再归档',
      ),
      directory,
    };
  }

  const result = await input.repository.archiveKnowledgeDirectory({
    tenantId,
    directoryId: input.params.directoryId,
  });
  if (result.status === 'not_found') {
    return directoryMutationResponse('not_found', '未找到可归档的目录');
  }

  await input.auditRepository.record(
    createAuditEvent({
      eventId: createKnowledgeDirectoryAuditId('archive', tenantId, input.params.directoryId),
      context: {
        ...input.accessContext,
        tenantId,
      },
      resource: 'knowledge_management',
      resourceId: input.params.directoryId,
      action: 'update',
      result: 'allowed',
      reason: 'allowed_by_policy',
      occurredAt: new Date().toISOString(),
    }),
  );

  return {
    ...directoryMutationResponse('archived', '目录已归档'),
    directory: {
      ...directory,
      status: 'archived',
      canArchive: false,
      archiveBlockedReason: '目录已归档',
    },
    affected: {
      sources: result.affectedSources,
      documents: 0,
      chunks: 0,
      jobs: 0,
    },
  };
}

export async function listPlatformKnowledgeOverviewFilesService(
  input: PlatformKnowledgeOverviewFilesServiceInput,
): Promise<PlatformKnowledgeListResponse<PlatformKnowledgeFileDto>> {
  const pageParams = normalizePageParams(input.params);
  if (!pageParams.ok) {
    throw new Error(pageParams.error.error.message);
  }

  const tenantId = normalizeTenantId(input.params.tenantId);
  const keyword = normalizeOptionalString(input.params.keyword);
  const status = normalizeFileParseStatus(input.params.status);
  const records = await input.repository.listKnowledgeOverviewFiles({ tenantId });
  const filtered = records
    .filter((record) => !tenantId || record.tenantId === tenantId)
    .filter((record) => matchesFileKeyword(record, keyword))
    .filter((record) => !status || record.parseStatus === status);

  return buildRepositoryListResponse(
    'open-platform-knowledge-management-files',
    filtered,
    pageParams.page,
    pageParams.pageSize,
  );
}

export async function listPlatformKnowledgeOverviewItemsService(
  input: PlatformKnowledgeOverviewItemsServiceInput,
): Promise<PlatformKnowledgeListResponse<PlatformKnowledgeItemDto>> {
  const pageParams = normalizePageParams(input.params);
  if (!pageParams.ok) {
    throw new Error(pageParams.error.error.message);
  }

  const tenantId = normalizeTenantId(input.params.tenantId);
  const keyword = normalizeOptionalString(input.params.keyword);
  const category = normalizeOptionalString(input.params.category);
  const status = normalizeStatus(input.params.status);
  const trainingStatus = normalizeOptionalString(input.params.trainingStatus);
  const records = await input.repository.listKnowledgeOverviewItems({ tenantId });
  const filtered = records
    .filter((record) => !tenantId || record.tenantId === tenantId)
    .filter((record) => matchesKeyword(record, keyword))
    .filter((record) => !category || record.category === category)
    .filter((record) => !status || record.status === status)
    .map(mapRecordToDto)
    .filter((record) => !trainingStatus || record.trainingStatus === trainingStatus);

  return buildRepositoryListResponse(
    'open-platform-knowledge-management-items',
    filtered,
    pageParams.page,
    pageParams.pageSize,
  );
}

function hasVisibilityScope(input: PlatformKnowledgeVisibilityRepositoryInput) {
  // 当前平台知识库 visibility 只接受非空 tenantId、knowledgeId、institutionId；
  // institution 归属由 hasTenantInstitution 基于 knowledge_sources(tenant_id, institution_id)
  // 在绑定 / 解绑前校验。
  return (
    normalizeOptionalString(input.tenantId) &&
    normalizeOptionalString(input.knowledgeId) &&
    normalizeOptionalString(input.institutionId)
  );
}

export async function bindPlatformKnowledgeInstitutionVisibilityService(
  input: PlatformKnowledgeVisibilityServiceInput,
): Promise<PlatformKnowledgeVisibilityRepositoryResult | { status: 'validation_failed' }> {
  if (!hasVisibilityScope(input.input)) {
    return { status: 'validation_failed' };
  }

  const institutionBelongsToTenant = await input.repository.hasTenantInstitution({
    tenantId: input.input.tenantId,
    institutionId: input.input.institutionId,
  });
  if (!institutionBelongsToTenant) {
    return { status: 'validation_failed' };
  }

  return input.repository.bindInstitutionVisibility(input.input);
}

export async function unbindPlatformKnowledgeInstitutionVisibilityService(
  input: PlatformKnowledgeVisibilityServiceInput,
): Promise<PlatformKnowledgeVisibilityRepositoryResult | { status: 'validation_failed' }> {
  if (!hasVisibilityScope(input.input)) {
    return { status: 'validation_failed' };
  }

  const institutionBelongsToTenant = await input.repository.hasTenantInstitution({
    tenantId: input.input.tenantId,
    institutionId: input.input.institutionId,
  });
  if (!institutionBelongsToTenant) {
    return { status: 'validation_failed' };
  }

  return input.repository.unbindInstitutionVisibility(input.input);
}
