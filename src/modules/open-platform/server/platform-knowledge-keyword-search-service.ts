import { isKnowledgeVisibleToInstitution } from '@/modules/open-platform/server/platform-knowledge-file-management-service';
import type {
  PlatformKnowledgeManagementRepository,
  PlatformKnowledgeRepositoryRecord,
} from '@/modules/open-platform/server/platform-knowledge-management-repository';

export type KnowledgeChunkSearchRepositoryRecord = {
  tenantId: string;
  knowledgeId: string;
  knowledgeTitle: string;
  fileId: string;
  fileName: string;
  fileStatus: 'active' | 'archived';
  parseStatus: 'pending' | 'processing' | 'succeeded' | 'failed';
  chunkId: string;
  chunkIndex: number;
  textPreview: string;
};

export type KnowledgeChunkSearchResultDto = {
  knowledgeId: string;
  knowledgeTitle: string;
  fileId: string;
  fileName: string;
  chunkId: string;
  chunkIndex: number;
  textPreview: string;
  matchReason: string;
};

export type KnowledgeChunkSearchResponse = {
  requestId: 'platform-knowledge-keyword-search' | 'institution-knowledge-keyword-search';
  readonly: true;
  dataSource: 'repository';
  records: KnowledgeChunkSearchResultDto[];
  pageInfo: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  emptyState: {
    title: string;
    description: string;
  };
};

type SearchRepository = Pick<
  PlatformKnowledgeManagementRepository,
  'listKnowledgeItems' | 'searchKnowledgeFileParseChunks'
>;

type SearchParams = {
  tenantId?: string | number | null;
  institutionId?: string | number | null;
  keyword?: string | number | null;
  knowledgeId?: string | number | null;
  fileId?: string | number | null;
  page?: string | number | null;
  pageSize?: string | number | null;
};

type SearchServiceInput = {
  repository: SearchRepository;
  params: SearchParams;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const KEYWORD_MIN_LENGTH = 1;
const KEYWORD_MAX_LENGTH = 80;
const SNIPPET_MAX_CHARS = 300;
const emptyState = {
  title: '暂无匹配片段',
  description: '当前范围没有命中关键词的已解析知识片段。',
};

function normalizeOptionalString(value: string | number | null | undefined) {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : undefined;
}

function normalizeKeyword(value: string | number | null | undefined) {
  const keyword = normalizeOptionalString(value);
  if (!keyword) {
    return {
      ok: false as const,
      error: {
        status: 'validation_failed' as const,
        message: '请输入关键词后再检索知识片段',
      },
    };
  }

  if (keyword.length < KEYWORD_MIN_LENGTH) {
    return {
      ok: false as const,
      error: {
        status: 'validation_failed' as const,
        message: '关键词不能为空，请输入 1~80 个字符后再检索',
      },
    };
  }

  if (keyword.length > KEYWORD_MAX_LENGTH) {
    return {
      ok: false as const,
      error: {
        status: 'validation_failed' as const,
        message: `关键词过长，最多支持 ${KEYWORD_MAX_LENGTH} 个字符`,
      },
    };
  }

  return { ok: true as const, keyword };
}

function normalizeScope(value: string | number | null | undefined, label: string) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return {
      ok: false as const,
      error: {
        status: 'validation_failed' as const,
        message: `${label} 是知识片段检索的必填范围`,
      },
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

function normalizePageParams(params: SearchParams) {
  const page = parsePositiveInteger(params.page, DEFAULT_PAGE);
  const parsedPageSize = parsePositiveInteger(params.pageSize, DEFAULT_PAGE_SIZE);
  const pageSize = parsedPageSize > MAX_PAGE_SIZE ? DEFAULT_PAGE_SIZE : parsedPageSize;

  return { page, pageSize };
}

function isSearchableChunk(record: KnowledgeChunkSearchRepositoryRecord) {
  return record.fileStatus === 'active' && record.parseStatus === 'succeeded';
}

function buildMatchReason(keyword: string) {
  return `片段包含关键词“${keyword}”`;
}

function truncateSnippet(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  // Try to break at a sentence-ending punctuation or space
  const truncated = text.slice(0, maxChars);
  const lastPeriod = Math.max(
    truncated.lastIndexOf('。'),
    truncated.lastIndexOf('！'),
    truncated.lastIndexOf('？'),
    truncated.lastIndexOf('\n'),
  );
  if (lastPeriod > maxChars * 0.6) {
    return truncated.slice(0, lastPeriod + 1);
  }
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.8) {
    return `${truncated.slice(0, lastSpace)}…`;
  }
  return `${truncated}…`;
}

function mapChunkToDto(
  record: KnowledgeChunkSearchRepositoryRecord,
  keyword: string,
): KnowledgeChunkSearchResultDto {
  return {
    knowledgeId: record.knowledgeId,
    knowledgeTitle: record.knowledgeTitle,
    fileId: record.fileId,
    fileName: record.fileName,
    chunkId: record.chunkId,
    chunkIndex: record.chunkIndex,
    textPreview: truncateSnippet(record.textPreview, SNIPPET_MAX_CHARS),
    matchReason: buildMatchReason(keyword),
  };
}

function buildSearchResponse(input: {
  requestId: KnowledgeChunkSearchResponse['requestId'];
  records: KnowledgeChunkSearchResultDto[];
  page: number;
  pageSize: number;
}): KnowledgeChunkSearchResponse {
  const total = input.records.length;
  const pageCount = Math.ceil(total / input.pageSize);
  const safePage = pageCount > 0 ? Math.min(input.page, pageCount) : input.page;
  const start = (safePage - 1) * input.pageSize;

  return {
    requestId: input.requestId,
    readonly: true,
    dataSource: 'repository',
    records: input.records.slice(start, start + input.pageSize),
    pageInfo: {
      page: safePage,
      pageSize: input.pageSize,
      total,
      pageCount,
      hasPreviousPage: safePage > 1 && total > 0,
      hasNextPage: safePage < pageCount,
    },
    emptyState,
  };
}

function knowledgeById(records: PlatformKnowledgeRepositoryRecord[]) {
  return new Map(records.map((record) => [record.knowledgeId, record]));
}

async function searchTenantChunks(input: SearchServiceInput & {
  tenantId: string;
  keyword: string;
}) {
  const knowledgeId = normalizeOptionalString(input.params.knowledgeId);
  const fileId = normalizeOptionalString(input.params.fileId);

  const [knowledgeItems, chunks] = await Promise.all([
    input.repository.listKnowledgeItems({ tenantId: input.tenantId }),
    input.repository.searchKnowledgeFileParseChunks({
      tenantId: input.tenantId,
      keyword: input.keyword,
      knowledgeId,
      fileId,
    }),
  ]);

  const visibleKnowledge = knowledgeById(
    knowledgeItems.filter((record) => record.tenantId === input.tenantId),
  );

  return chunks
    .filter((chunk) => chunk.tenantId === input.tenantId)
    .filter(isSearchableChunk)
    .filter((chunk) => visibleKnowledge.has(chunk.knowledgeId))
    .sort((left, right) =>
      left.knowledgeId.localeCompare(right.knowledgeId) ||
      left.fileId.localeCompare(right.fileId) ||
      left.chunkIndex - right.chunkIndex ||
      left.chunkId.localeCompare(right.chunkId),
    )
    .map((chunk) => ({ chunk, knowledge: visibleKnowledge.get(chunk.knowledgeId) }));
}

export async function searchPlatformKnowledgeChunksService(input: SearchServiceInput) {
  const tenant = normalizeScope(input.params.tenantId, 'tenantId');
  if (!tenant.ok) return tenant.error;

  const keyword = normalizeKeyword(input.params.keyword);
  if (!keyword.ok) return keyword.error;

  const pageParams = normalizePageParams(input.params);
  const records = await searchTenantChunks({
    ...input,
    tenantId: tenant.value,
    keyword: keyword.keyword,
  });

  return buildSearchResponse({
    requestId: 'platform-knowledge-keyword-search',
    records: records.map(({ chunk }) => mapChunkToDto(chunk, keyword.keyword)),
    page: pageParams.page,
    pageSize: pageParams.pageSize,
  });
}

export async function searchInstitutionKnowledgeChunksService(input: SearchServiceInput) {
  const tenant = normalizeScope(input.params.tenantId, 'tenantId');
  if (!tenant.ok) return tenant.error;

  const institution = normalizeScope(input.params.institutionId, 'institutionId');
  if (!institution.ok) return institution.error;

  const keyword = normalizeKeyword(input.params.keyword);
  if (!keyword.ok) return keyword.error;

  const pageParams = normalizePageParams(input.params);
  const records = await searchTenantChunks({
    ...input,
    tenantId: tenant.value,
    keyword: keyword.keyword,
  });

  return buildSearchResponse({
    requestId: 'institution-knowledge-keyword-search',
    records: records
      .filter(({ knowledge }) =>
        knowledge ? isKnowledgeVisibleToInstitution(knowledge, institution.value) : false,
      )
      .map(({ chunk }) => mapChunkToDto(chunk, keyword.keyword)),
    page: pageParams.page,
    pageSize: pageParams.pageSize,
  });
}
