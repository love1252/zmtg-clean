import type {
  KnowledgeTrainingStatus,
} from '@/modules/open-platform/mock/platformKnowledge';
import {
  normalizePageParams,
  type PlatformKnowledgeItemDto,
  type PlatformKnowledgeItemsParams,
  type PlatformKnowledgeListResponse,
} from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';
import type {
  PlatformKnowledgeManagementRepository,
  PlatformKnowledgeRepositoryRecord,
  PlatformKnowledgeVisibilityRepositoryInput,
  PlatformKnowledgeVisibilityRepositoryResult,
} from '@/modules/open-platform/server/platform-knowledge-management-repository';
import type {
  V1KnowledgeBaseRuntimeFoundationStatus,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-runtime-foundation-api-contract';

type PlatformKnowledgeItemsServiceInput = {
  repository: Pick<PlatformKnowledgeManagementRepository, 'listKnowledgeItems'>;
  params: PlatformKnowledgeItemsParams;
};

type PlatformKnowledgeVisibilityServiceInput = {
  repository: Pick<
    PlatformKnowledgeManagementRepository,
    'bindInstitutionVisibility' | 'hasTenantInstitution' | 'unbindInstitutionVisibility'
  >;
  input: PlatformKnowledgeVisibilityRepositoryInput;
};

const emptyState = {
  title: '暂无匹配的知识库运营数据',
  description: '请调整机构范围或文件名搜索条件后再查看。',
};

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

function buildRepositoryListResponse(
  records: PlatformKnowledgeItemDto[],
  page: number,
  pageSize: number,
): PlatformKnowledgeListResponse<PlatformKnowledgeItemDto> {
  const total = records.length;
  const pageCount = Math.ceil(total / pageSize);
  const safePage = pageCount > 0 ? Math.min(page, pageCount) : page;
  const start = (safePage - 1) * pageSize;

  return {
    requestId: 'open-platform-knowledge-management-items',
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

  return buildRepositoryListResponse(filtered, pageParams.page, pageParams.pageSize);
}

function hasVisibilityScope(input: PlatformKnowledgeVisibilityRepositoryInput) {
  // 7-1 只持久化平台端知识库可见范围关系。
  // 当前 schema 没有可复用的机构 / 组织归属表。
  // tenant + institution 存在性校验应在 7-2 机构端接入现有机构上下文时补齐。
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
