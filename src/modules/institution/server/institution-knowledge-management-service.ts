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
import type { InstitutionKnowledgeWriteRepository } from './institution-knowledge-write-repository';

type InstitutionKnowledgeItemsServiceInput = {
  repository: Pick<PlatformKnowledgeManagementRepository, 'listKnowledgeItems'>;
  params: InstitutionKnowledgeItemsParams;
};

type InstitutionKnowledgeWriteInput = {
  tenantId?: string | null;
  institutionId?: string | null;
  knowledgeId?: string | null;
  title?: string | null;
  category?: string | null;
  description?: string | null;
};

export type InstitutionKnowledgeWriteResult =
  | { status: 'created' | 'updated' | 'archived'; record: InstitutionKnowledgeItemDto }
  | { status: 'validation_failed' | 'forbidden' | 'not_found'; message: string };

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

function validateScope(value: string | null | undefined, label: string) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return {
      ok: false as const,
      error: { status: 'validation_failed' as const, message: `${label} 是机构知识管理的必填范围` },
    };
  }

  return { ok: true as const, value: normalized };
}

function validateTextField(input: {
  value: string | null | undefined;
  label: string;
  maxLength: number;
  required?: boolean;
}) {
  const normalized = normalizeOptionalString(input.value);
  if (!normalized) {
    if (input.required) {
      return {
        ok: false as const,
        error: { status: 'validation_failed' as const, message: `${input.label}不能为空` },
      };
    }
    return { ok: true as const, value: '' };
  }
  if (normalized.length > input.maxLength) {
    return {
      ok: false as const,
      error: { status: 'validation_failed' as const, message: `${input.label}最多 ${input.maxLength} 个字符` },
    };
  }

  return { ok: true as const, value: normalized };
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

function mapVisibleRecordOrForbidden(input: {
  record: PlatformKnowledgeRepositoryRecord;
  institutionId: string;
}): InstitutionKnowledgeItemDto | null {
  const visibility = visibleToInstitution(input.record, input.institutionId);
  return visibility ? mapRecordToDto(input.record, visibility) : null;
}

function blockedResult(status: 'validation_failed' | 'forbidden' | 'not_found', message: string) {
  return { status, message };
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

export async function createInstitutionKnowledgeItemService(input: {
  repository: InstitutionKnowledgeWriteRepository;
  input: InstitutionKnowledgeWriteInput;
}): Promise<InstitutionKnowledgeWriteResult> {
  const tenant = validateScope(input.input.tenantId, 'tenantId');
  if (!tenant.ok) return tenant.error;
  const institution = validateScope(input.input.institutionId, 'institutionId');
  if (!institution.ok) return institution.error;
  const title = validateTextField({ value: input.input.title, label: '标题', maxLength: 200, required: true });
  if (!title.ok) return title.error;
  const category = validateTextField({ value: input.input.category, label: '分类 / 目录口径', maxLength: 160 });
  if (!category.ok) return category.error;
  const description = validateTextField({ value: input.input.description, label: '摘要 / 描述', maxLength: 64 });
  if (!description.ok) return description.error;

  const source = await input.repository.createInstitutionKnowledgeSource({
    tenantId: tenant.value,
    institutionId: institution.value,
    sourceLabel: category.value || '未分类',
  });
  const created = await input.repository.createInstitutionKnowledgeDocument({
    tenantId: tenant.value,
    institutionId: institution.value,
    sourceId: source.sourceId,
    title: title.value,
    description: description.value || 'v1',
  });
  const record = await input.repository.findKnowledgeItem({
    tenantId: tenant.value,
    knowledgeId: created.documentId,
  });
  if (!record) return blockedResult('not_found', '知识条目创建后暂时不可读取');
  const dto = mapVisibleRecordOrForbidden({ record, institutionId: institution.value });
  if (!dto) return blockedResult('forbidden', '没有访问权限');

  return { status: 'created', record: dto };
}

export async function updateInstitutionKnowledgeItemService(input: {
  repository: InstitutionKnowledgeWriteRepository;
  input: InstitutionKnowledgeWriteInput;
}): Promise<InstitutionKnowledgeWriteResult> {
  const tenant = validateScope(input.input.tenantId, 'tenantId');
  if (!tenant.ok) return tenant.error;
  const institution = validateScope(input.input.institutionId, 'institutionId');
  if (!institution.ok) return institution.error;
  const knowledge = validateScope(input.input.knowledgeId, 'knowledgeId');
  if (!knowledge.ok) return knowledge.error;
  const title = validateTextField({ value: input.input.title, label: '标题', maxLength: 200, required: true });
  if (!title.ok) return title.error;
  const category = validateTextField({ value: input.input.category, label: '分类 / 目录口径', maxLength: 160 });
  if (!category.ok) return category.error;
  const description = validateTextField({ value: input.input.description, label: '摘要 / 描述', maxLength: 64 });
  if (!description.ok) return description.error;

  const current = await input.repository.findKnowledgeItem({ tenantId: tenant.value, knowledgeId: knowledge.value });
  if (!current) return blockedResult('not_found', '知识条目不存在');
  if (current.tenantId !== tenant.value || current.institutionId !== institution.value) {
    return blockedResult('forbidden', '没有访问权限');
  }

  const result = await input.repository.updateInstitutionKnowledgeDocument({
    tenantId: tenant.value,
    institutionId: institution.value,
    knowledgeId: knowledge.value,
    title: title.value,
    category: category.value || '未分类',
    description: description.value || 'v1',
  });
  if (result.status === 'not_found') return blockedResult('not_found', '知识条目不存在');
  const dto = mapVisibleRecordOrForbidden({ record: result.record, institutionId: institution.value });
  if (!dto) return blockedResult('forbidden', '没有访问权限');

  return { status: 'updated', record: dto };
}

export async function archiveInstitutionKnowledgeItemService(input: {
  repository: InstitutionKnowledgeWriteRepository;
  input: InstitutionKnowledgeWriteInput;
}): Promise<InstitutionKnowledgeWriteResult> {
  const tenant = validateScope(input.input.tenantId, 'tenantId');
  if (!tenant.ok) return tenant.error;
  const institution = validateScope(input.input.institutionId, 'institutionId');
  if (!institution.ok) return institution.error;
  const knowledge = validateScope(input.input.knowledgeId, 'knowledgeId');
  if (!knowledge.ok) return knowledge.error;

  const current = await input.repository.findKnowledgeItem({ tenantId: tenant.value, knowledgeId: knowledge.value });
  if (!current) return blockedResult('not_found', '知识条目不存在');
  if (current.tenantId !== tenant.value || current.institutionId !== institution.value) {
    return blockedResult('forbidden', '没有访问权限');
  }

  const result = await input.repository.archiveInstitutionKnowledgeDocument({
    tenantId: tenant.value,
    institutionId: institution.value,
    knowledgeId: knowledge.value,
  });
  if (result.status === 'not_found') return blockedResult('not_found', '知识条目不存在');
  const dto = mapVisibleRecordOrForbidden({ record: result.record, institutionId: institution.value });
  if (!dto) return blockedResult('forbidden', '没有访问权限');

  return { status: 'archived', record: dto };
}
