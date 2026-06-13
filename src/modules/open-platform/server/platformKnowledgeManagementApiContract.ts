import {
  filterKnowledgeFiles,
  filterKnowledgeItems,
  getPlatformKnowledgeMockData,
  getPlatformKnowledgeScope,
  normalizeTenantName,
  type CategoryStats,
  type ImportJob,
  type KnowledgeFileItem,
  type KnowledgeFileParseStatus,
  type KnowledgeItem,
  type KnowledgeTrainingStatus,
  type PlatformKnowledgeTotals,
  type TenantKnowledgeStats,
  type TopQuestion,
} from '@/modules/open-platform/mock/platformKnowledge';
import type {
  V1KnowledgeBaseRuntimeFoundationReadonlyStatus,
  V1KnowledgeBaseRuntimeFoundationSourceKind,
  V1KnowledgeBaseRuntimeFoundationStatus,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-runtime-foundation-api-contract';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const fileParseStatuses = new Set<KnowledgeFileParseStatus>(['parsed', 'failed', 'parsing', 'pending']);
const trainingStatuses = new Set<KnowledgeTrainingStatus>(['trained', 'training', 'pending', 'failed']);

export type PlatformKnowledgeOverviewResponse = {
  requestId: string;
  readonly: true;
  dataSource: 'mock' | 'repository';
  scope: {
    tenantId: string | null;
    scopeName: string;
  };
  allTotals: PlatformKnowledgeTotals;
  totals: PlatformKnowledgeTotals;
  tenants: PlatformKnowledgeTenantDto[];
  categoryStats: CategoryStats[];
  topQuestions: PlatformKnowledgeTopQuestionDto[];
  importJobs: PlatformKnowledgeImportJobDto[];
};

export type PlatformKnowledgeOverviewParams = {
  tenantId?: string | null;
};

export type PlatformKnowledgeTenantDto = Omit<TenantKnowledgeStats, 'tenantName'> & {
  tenantName: string;
};

export type PlatformKnowledgeFileDto = Omit<KnowledgeFileItem, 'tenantName' | 'isDownloadable'> & {
  tenantName: string;
};

export type PlatformKnowledgeItemDto = Omit<KnowledgeItem, 'tenantName' | 'summaryPreview'> & {
  tenantName: string;
  descriptionPreview: string;
  institutionId?: string;
  workspaceId?: string;
  version?: string;
  sourceKind?: V1KnowledgeBaseRuntimeFoundationSourceKind;
  status?: V1KnowledgeBaseRuntimeFoundationStatus;
  readonlyStatus?: V1KnowledgeBaseRuntimeFoundationReadonlyStatus;
  visibleInstitutionIds?: string[];
  createdAt?: string;
};

export type PlatformKnowledgeTopQuestionDto = Omit<TopQuestion, 'tenantName'> & {
  tenantName: string;
};

export type PlatformKnowledgeImportJobDto = Omit<ImportJob, 'tenantName'> & {
  tenantName: string;
};

export type PlatformKnowledgePageInfo = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type PlatformKnowledgeFilesParams = {
  tenantId?: string | null;
  keyword?: string | null;
  status?: string | null;
  page?: string | number | null;
  pageSize?: string | number | null;
};

export type PlatformKnowledgeItemsParams = {
  tenantId?: string | null;
  institutionId?: string | null;
  keyword?: string | null;
  category?: string | null;
  status?: string | null;
  trainingStatus?: string | null;
  page?: string | number | null;
  pageSize?: string | number | null;
};

export type PlatformKnowledgeListResponse<TRecord> = {
  requestId: string;
  readonly: true;
  dataSource: 'mock' | 'repository';
  records: TRecord[];
  pageInfo: PlatformKnowledgePageInfo;
  emptyState: {
    title: string;
    description: string;
  };
};

export type PlatformKnowledgeReadonlyApiError = {
  error: {
    code: 'readonly_contract_error';
    message: string;
  };
};

type PageParamsResult =
  | { ok: true; page: number; pageSize: number }
  | { ok: false; error: PlatformKnowledgeReadonlyApiError };

export function getPlatformKnowledgeOverviewResponse(
  params: PlatformKnowledgeOverviewParams = {},
): PlatformKnowledgeOverviewResponse {
  const data = getPlatformKnowledgeMockData();
  const scope = getPlatformKnowledgeScope(data, normalizeOptionalString(params.tenantId));

  return {
    requestId: 'open-platform-knowledge-management-overview',
    readonly: true,
    dataSource: 'mock',
    scope: {
      tenantId: scope.tenantId,
      scopeName: scope.scopeName,
    },
    allTotals: data.totals,
    totals: scope.totals,
    tenants: data.tenants.map(mapTenant),
    categoryStats: scope.categories,
    topQuestions: scope.topQuestions.map(mapTopQuestion),
    importJobs: scope.importJobs.map(mapImportJob),
  };
}

export function getPlatformKnowledgeFilesResponse(
  params: PlatformKnowledgeFilesParams = {},
): PlatformKnowledgeListResponse<PlatformKnowledgeFileDto> {
  const data = getPlatformKnowledgeMockData();
  const pageParams = normalizePageParams(params);
  if (!pageParams.ok) {
    throw new Error(pageParams.error.error.message);
  }

  const status = normalizeFileParseStatus(params.status);
  const records = filterKnowledgeFiles(data.files, {
    tenantId: normalizeOptionalString(params.tenantId),
    keyword: normalizeOptionalString(params.keyword),
    status,
  }).map(mapFile);

  return buildListResponse({
    requestId: 'open-platform-knowledge-management-files',
    records,
    page: pageParams.page,
    pageSize: pageParams.pageSize,
    emptyState: data.emptyState,
  });
}

export function getPlatformKnowledgeItemsResponse(
  params: PlatformKnowledgeItemsParams = {},
): PlatformKnowledgeListResponse<PlatformKnowledgeItemDto> {
  const data = getPlatformKnowledgeMockData();
  const pageParams = normalizePageParams(params);
  if (!pageParams.ok) {
    throw new Error(pageParams.error.error.message);
  }

  const trainingStatus = normalizeTrainingStatus(params.trainingStatus);
  const records = filterKnowledgeItems(data.knowledgeItems, {
    tenantId: normalizeOptionalString(params.tenantId),
    keyword: normalizeOptionalString(params.keyword),
    category: normalizeOptionalString(params.category),
    trainingStatus,
  }).map(mapItem);

  return buildListResponse({
    requestId: 'open-platform-knowledge-management-items',
    records,
    page: pageParams.page,
    pageSize: pageParams.pageSize,
    emptyState: data.emptyState,
  });
}

export function normalizePageParams(params: Pick<PlatformKnowledgeFilesParams, 'page' | 'pageSize'> = {}): PageParamsResult {
  const page = parsePositiveInteger(params.page, DEFAULT_PAGE) ?? DEFAULT_PAGE;
  const parsedPageSize = parsePositiveInteger(params.pageSize, DEFAULT_PAGE_SIZE);
  const pageSize = parsedPageSize === null || parsedPageSize > MAX_PAGE_SIZE ? DEFAULT_PAGE_SIZE : parsedPageSize;

  return { ok: true, page, pageSize };
}

export function buildReadonlyApiError(message: string): PlatformKnowledgeReadonlyApiError {
  return {
    error: {
      code: 'readonly_contract_error',
      message,
    },
  };
}

function buildListResponse<TRecord>({
  requestId,
  records,
  page,
  pageSize,
  emptyState,
}: {
  requestId: string;
  records: TRecord[];
  page: number;
  pageSize: number;
  emptyState: PlatformKnowledgeListResponse<TRecord>['emptyState'];
}): PlatformKnowledgeListResponse<TRecord> {
  const total = records.length;
  const pageCount = Math.ceil(total / pageSize);
  const safePage = pageCount > 0 ? Math.min(page, pageCount) : page;
  const start = (safePage - 1) * pageSize;

  return {
    requestId,
    readonly: true,
    dataSource: 'mock',
    records: records.slice(start, start + pageSize),
    pageInfo: {
      page: safePage,
      pageSize,
      total,
      pageCount,
      hasPreviousPage: page > 1 && total > 0,
      hasNextPage: page < pageCount,
    },
    emptyState,
  };
}

function mapTenant(tenant: TenantKnowledgeStats): PlatformKnowledgeTenantDto {
  return {
    ...tenant,
    tenantName: normalizeTenantName(tenant.tenantName),
  };
}

function mapFile(file: KnowledgeFileItem): PlatformKnowledgeFileDto {
  const { tenantName, isDownloadable: _isDownloadable, ...rest } = file;

  return {
    ...rest,
    tenantName: normalizeTenantName(tenantName),
  };
}

function mapItem(item: KnowledgeItem): PlatformKnowledgeItemDto {
  const { tenantName, summaryPreview, ...rest } = item;

  return {
    ...rest,
    tenantName: normalizeTenantName(tenantName),
    descriptionPreview: summaryPreview,
  };
}

function mapTopQuestion(question: TopQuestion): PlatformKnowledgeTopQuestionDto {
  return {
    ...question,
    tenantName: normalizeTenantName(question.tenantName),
  };
}

function mapImportJob(job: ImportJob): PlatformKnowledgeImportJobDto {
  return {
    ...job,
    tenantName: normalizeTenantName(job.tenantName),
  };
}

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function normalizeFileParseStatus(value: string | null | undefined) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return undefined;

  return fileParseStatuses.has(normalized as KnowledgeFileParseStatus)
    ? normalized as KnowledgeFileParseStatus
    : undefined;
}

function normalizeTrainingStatus(value: string | null | undefined) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return undefined;

  return trainingStatuses.has(normalized as KnowledgeTrainingStatus)
    ? normalized as KnowledgeTrainingStatus
    : undefined;
}

function parsePositiveInteger(value: string | number | null | undefined, fallback: number) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) return null;

  return parsed;
}
