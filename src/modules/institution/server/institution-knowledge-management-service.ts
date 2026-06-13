import type {
  InstitutionKnowledgeItemDto,
  InstitutionKnowledgeItemsParams,
  InstitutionKnowledgeListResponse,
  InstitutionKnowledgeVisibility,
} from '@/modules/institution/domain/institution-knowledge-management';
import type {
  PlatformKnowledgeManagementRepository,
  PlatformKnowledgeRepositoryRecord,
} from '@/modules/open-platform/server/platform-knowledge-management-repository';

type InstitutionKnowledgeItemsServiceInput = {
  repository: Pick<PlatformKnowledgeManagementRepository, 'listKnowledgeItems'>;
  params: InstitutionKnowledgeItemsParams;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

const emptyState = {
  title: '暂无授权可见知识库',
  description: '当前机构暂未获得平台授权的知识库，或搜索条件没有匹配结果。',
};

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function assertScope(value: string | null | undefined, label: string) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new Error(`${label} 是机构知识库只读查询的必填范围`);
  }

  return normalized;
}

function parsePositiveInteger(value: string | number | null | undefined, fallback: number) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizePageParams(params: Pick<InstitutionKnowledgeItemsParams, 'page' | 'pageSize'>) {
  const page = parsePositiveInteger(params.page, DEFAULT_PAGE);
  const parsedPageSize = parsePositiveInteger(params.pageSize, DEFAULT_PAGE_SIZE);
  const pageSize = parsedPageSize > MAX_PAGE_SIZE ? DEFAULT_PAGE_SIZE : parsedPageSize;

  return { page, pageSize };
}

function visibleToInstitution(
  record: PlatformKnowledgeRepositoryRecord,
  institutionId: string,
): InstitutionKnowledgeVisibility | null {
  if (record.institutionId === institutionId) return 'owned';
  if (record.visibleInstitutionIds.includes(institutionId)) return 'platform_authorized';
  return null;
}

function matchesKeyword(record: PlatformKnowledgeRepositoryRecord, keyword: string | undefined) {
  if (!keyword) return true;

  const normalized = keyword.toLowerCase();
  return [
    record.title,
    record.category,
    record.descriptionPreview,
    record.status,
    record.sourceKind,
  ].some((value) => value.toLowerCase().includes(normalized));
}

function mapRecordToDto(
  record: PlatformKnowledgeRepositoryRecord,
  visibility: InstitutionKnowledgeVisibility,
): InstitutionKnowledgeItemDto {
  return {
    knowledgeId: record.knowledgeId,
    title: record.title,
    category: record.category,
    status: record.status,
    readonlyStatus: record.readonlyStatus,
    sourceKind: record.sourceKind,
    descriptionPreview: record.descriptionPreview,
    chunkCount: record.chunkCount,
    visibility,
    updatedAt: record.updatedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
  };
}

function buildListResponse(
  records: InstitutionKnowledgeItemDto[],
  page: number,
  pageSize: number,
): InstitutionKnowledgeListResponse {
  const total = records.length;
  const pageCount = Math.ceil(total / pageSize);
  const safePage = pageCount > 0 ? Math.min(page, pageCount) : page;
  const start = (safePage - 1) * pageSize;

  return {
    requestId: 'institution-knowledge-management-items',
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

export async function listInstitutionKnowledgeItemsService(
  input: InstitutionKnowledgeItemsServiceInput,
): Promise<InstitutionKnowledgeListResponse> {
  const tenantId = assertScope(input.params.tenantId, 'tenantId');
  const institutionId = assertScope(input.params.institutionId, 'institutionId');
  const keyword = normalizeOptionalString(input.params.keyword);
  const pageParams = normalizePageParams(input.params);

  const records = await input.repository.listKnowledgeItems({ tenantId });
  const filtered = records
    .filter((record) => record.tenantId === tenantId)
    .map((record) => ({ record, visibility: visibleToInstitution(record, institutionId) }))
    .filter(
      (entry): entry is {
        record: PlatformKnowledgeRepositoryRecord;
        visibility: InstitutionKnowledgeVisibility;
      } => entry.visibility !== null,
    )
    .filter(({ record }) => matchesKeyword(record, keyword))
    .map(({ record, visibility }) => mapRecordToDto(record, visibility));

  return buildListResponse(filtered, pageParams.page, pageParams.pageSize);
}
