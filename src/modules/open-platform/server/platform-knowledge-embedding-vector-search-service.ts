import { createHash } from 'node:crypto';
import { isKnowledgeVisibleToInstitution } from '@/modules/open-platform/server/platform-knowledge-file-management-service';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';

export const PLATFORM_KNOWLEDGE_MOCK_EMBEDDING_PROVIDER = 'mock_local_embedding';
export const PLATFORM_KNOWLEDGE_MOCK_EMBEDDING_MODEL = 'mock-local-embedding-v1';
export const PLATFORM_KNOWLEDGE_MOCK_EMBEDDING_DIMENSIONS = 8;

export type PlatformKnowledgeEmbeddingCandidateRecord = {
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

export type PlatformKnowledgeChunkEmbeddingSaveRecord = {
  tenantId: string;
  knowledgeId: string;
  fileId: string;
  chunkId: string;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimensions: number;
  embeddingVectorJson: number[];
  status: 'ready';
};

export type PlatformKnowledgeChunkEmbeddingSummary = Omit<
  PlatformKnowledgeChunkEmbeddingSaveRecord,
  'embeddingVectorJson'
> & {
  embeddingId: string;
};

export type PlatformKnowledgeVectorSearchCandidateRecord =
  PlatformKnowledgeEmbeddingCandidateRecord & {
    embeddingId: string;
    embeddingProvider: string;
    embeddingModel: string;
    embeddingDimensions: number;
    embeddingVectorJson: number[];
    embeddingStatus: 'ready' | 'pending' | 'failed';
  };

export type PlatformKnowledgeVectorSearchResultDto = {
  knowledgeId: string;
  knowledgeTitle: string;
  fileId: string;
  fileName: string;
  chunkId: string;
  chunkIndex: number;
  textPreview: string;
  score: number;
  matchReason: string;
};

export type PlatformKnowledgeVectorSearchResponse = {
  requestId: 'platform-knowledge-vector-search' | 'institution-knowledge-vector-search';
  readonly: true;
  dataSource: 'repository';
  records: PlatformKnowledgeVectorSearchResultDto[];
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

type EmbeddingRepository = {
  listKnowledgeItems(input: { tenantId: string }): Promise<PlatformKnowledgeRepositoryRecord[]>;
  listKnowledgeEmbeddingCandidates(input: {
    tenantId: string;
    knowledgeId?: string;
    fileId?: string;
  }): Promise<PlatformKnowledgeEmbeddingCandidateRecord[]>;
  saveKnowledgeChunkEmbeddings(
    records: PlatformKnowledgeChunkEmbeddingSaveRecord[],
  ): Promise<PlatformKnowledgeChunkEmbeddingSummary[]>;
  listKnowledgeVectorSearchCandidates(input: {
    tenantId: string;
    knowledgeId?: string;
    fileId?: string;
  }): Promise<PlatformKnowledgeVectorSearchCandidateRecord[]>;
};

type VectorSearchParams = {
  tenantId?: string | number | null;
  institutionId?: string | number | null;
  query?: string | number | null;
  knowledgeId?: string | number | null;
  fileId?: string | number | null;
  page?: string | number | null;
  pageSize?: string | number | null;
};

type EmbeddingGenerateParams = Omit<VectorSearchParams, 'query' | 'institutionId'>;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const emptyState = {
  title: '暂无相似片段',
  description: '当前范围没有命中语义相似的已解析知识片段。',
};

function normalizeOptionalString(value: string | number | null | undefined) {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : undefined;
}

function normalizeScope(value: string | number | null | undefined, label: string) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return {
      ok: false as const,
      error: {
        status: 'validation_failed' as const,
        message: `${label} 是知识库向量操作的必填范围`,
      },
    };
  }

  return { ok: true as const, value: normalized };
}

function normalizeQuery(value: string | number | null | undefined) {
  const query = normalizeOptionalString(value);
  if (!query) {
    return {
      ok: false as const,
      error: {
        status: 'validation_failed' as const,
        message: '请输入语义检索内容',
      },
    };
  }

  return { ok: true as const, query };
}

function parsePositiveInteger(value: string | number | null | undefined, fallback: number) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizePageParams(params: VectorSearchParams) {
  const page = parsePositiveInteger(params.page, DEFAULT_PAGE);
  const parsedPageSize = parsePositiveInteger(params.pageSize, DEFAULT_PAGE_SIZE);
  const pageSize = parsedPageSize > MAX_PAGE_SIZE ? DEFAULT_PAGE_SIZE : parsedPageSize;

  return { page, pageSize };
}

function embeddingId(input: { tenantId: string; chunkId: string }) {
  return `kb-file-embedding-${createHash('sha256')
    .update(`${input.tenantId}:${input.chunkId}`)
    .digest('hex')
    .slice(0, 40)}`;
}

export function createDeterministicMockKnowledgeEmbedding(
  text: string,
  dimensions = PLATFORM_KNOWLEDGE_MOCK_EMBEDDING_DIMENSIONS,
) {
  const normalizedText = text.normalize('NFKC').trim();
  const vector = Array.from({ length: dimensions }, (_, index) => {
    const digest = createHash('sha256')
      .update(`${index}:${normalizedText}`)
      .digest();
    const raw = digest.readUInt32BE(0) / 0xffffffff;
    return Number((raw * 2 - 1).toFixed(6));
  });

  return {
    provider: PLATFORM_KNOWLEDGE_MOCK_EMBEDDING_PROVIDER,
    model: PLATFORM_KNOWLEDGE_MOCK_EMBEDDING_MODEL,
    dimensions,
    vector,
  };
}

function isEmbeddableCandidate(record: PlatformKnowledgeEmbeddingCandidateRecord) {
  return record.tenantId && record.fileStatus === 'active' && record.parseStatus === 'succeeded';
}

function vectorMagnitude(vector: number[]) {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

function cosineSimilarity(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  if (length === 0) return 0;
  const denominator = vectorMagnitude(left) * vectorMagnitude(right);
  if (denominator === 0) return 0;
  let dot = 0;
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
  }

  return dot / denominator;
}

function knowledgeById(records: PlatformKnowledgeRepositoryRecord[]) {
  return new Map(records.map((record) => [record.knowledgeId, record]));
}

function buildVectorResponse(input: {
  requestId: PlatformKnowledgeVectorSearchResponse['requestId'];
  records: PlatformKnowledgeVectorSearchResultDto[];
  page: number;
  pageSize: number;
}): PlatformKnowledgeVectorSearchResponse {
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

function mapVectorResult(record: PlatformKnowledgeVectorSearchCandidateRecord, score: number) {
  return {
    knowledgeId: record.knowledgeId,
    knowledgeTitle: record.knowledgeTitle,
    fileId: record.fileId,
    fileName: record.fileName,
    chunkId: record.chunkId,
    chunkIndex: record.chunkIndex,
    textPreview: record.textPreview,
    score,
    matchReason: `mock embedding 相似度 ${score.toFixed(3)}`,
  };
}

export async function generatePlatformKnowledgeChunkEmbeddingsService(input: {
  repository: EmbeddingRepository;
  params: EmbeddingGenerateParams;
}) {
  const tenant = normalizeScope(input.params.tenantId, 'tenantId');
  if (!tenant.ok) return tenant.error;

  const knowledgeId = normalizeOptionalString(input.params.knowledgeId);
  const fileId = normalizeOptionalString(input.params.fileId);
  const candidates = await input.repository.listKnowledgeEmbeddingCandidates({
    tenantId: tenant.value,
    knowledgeId,
    fileId,
  });
  const embeddable = candidates
    .filter((candidate) => candidate.tenantId === tenant.value)
    .filter(isEmbeddableCandidate)
    .sort((left, right) =>
      left.knowledgeId.localeCompare(right.knowledgeId) ||
      left.fileId.localeCompare(right.fileId) ||
      left.chunkIndex - right.chunkIndex ||
      left.chunkId.localeCompare(right.chunkId),
    );

  if (embeddable.length === 0) {
    return {
      status: 'empty' as const,
      embeddingCount: 0,
      message: '当前范围暂无可生成向量索引的已解析片段',
    };
  }

  const saved = await input.repository.saveKnowledgeChunkEmbeddings(
    embeddable.map((candidate) => {
      const embedding = createDeterministicMockKnowledgeEmbedding(candidate.textPreview);
      return {
        tenantId: candidate.tenantId,
        knowledgeId: candidate.knowledgeId,
        fileId: candidate.fileId,
        chunkId: candidate.chunkId,
        embeddingProvider: embedding.provider,
        embeddingModel: embedding.model,
        embeddingDimensions: embedding.dimensions,
        embeddingVectorJson: embedding.vector,
        status: 'ready' as const,
      };
    }),
  );

  return {
    status: 'succeeded' as const,
    embeddingCount: saved.length,
    embeddings: saved,
  };
}

async function getVectorCandidates(input: {
  repository: EmbeddingRepository;
  tenantId: string;
  query: string;
  knowledgeId?: string;
  fileId?: string;
}) {
  const [knowledgeItems, candidates] = await Promise.all([
    input.repository.listKnowledgeItems({ tenantId: input.tenantId }),
    input.repository.listKnowledgeVectorSearchCandidates({
      tenantId: input.tenantId,
      knowledgeId: input.knowledgeId,
      fileId: input.fileId,
    }),
  ]);
  const visibleKnowledge = knowledgeById(
    knowledgeItems.filter((record) => record.tenantId === input.tenantId),
  );
  const queryEmbedding = createDeterministicMockKnowledgeEmbedding(input.query);

  return candidates
    .filter((candidate) => candidate.tenantId === input.tenantId)
    .filter(isEmbeddableCandidate)
    .filter((candidate) => candidate.embeddingStatus === 'ready')
    .filter((candidate) => visibleKnowledge.has(candidate.knowledgeId))
    .map((candidate) => ({
      candidate,
      knowledge: visibleKnowledge.get(candidate.knowledgeId),
      score: Number(
        cosineSimilarity(queryEmbedding.vector, candidate.embeddingVectorJson).toFixed(6),
      ),
    }))
    .sort((left, right) =>
      right.score - left.score ||
      left.candidate.knowledgeId.localeCompare(right.candidate.knowledgeId) ||
      left.candidate.fileId.localeCompare(right.candidate.fileId) ||
      left.candidate.chunkIndex - right.candidate.chunkIndex,
    );
}

export async function searchPlatformKnowledgeVectorChunksService(input: {
  repository: EmbeddingRepository;
  params: VectorSearchParams;
}) {
  const tenant = normalizeScope(input.params.tenantId, 'tenantId');
  if (!tenant.ok) return tenant.error;

  const query = normalizeQuery(input.params.query);
  if (!query.ok) return query.error;

  const pageParams = normalizePageParams(input.params);
  const candidates = await getVectorCandidates({
    repository: input.repository,
    tenantId: tenant.value,
    query: query.query,
    knowledgeId: normalizeOptionalString(input.params.knowledgeId),
    fileId: normalizeOptionalString(input.params.fileId),
  });

  return buildVectorResponse({
    requestId: 'platform-knowledge-vector-search',
    records: candidates.map(({ candidate, score }) => mapVectorResult(candidate, score)),
    page: pageParams.page,
    pageSize: pageParams.pageSize,
  });
}

export async function searchInstitutionKnowledgeVectorChunksService(input: {
  repository: EmbeddingRepository;
  params: VectorSearchParams;
}) {
  const tenant = normalizeScope(input.params.tenantId, 'tenantId');
  if (!tenant.ok) return tenant.error;

  const institution = normalizeScope(input.params.institutionId, 'institutionId');
  if (!institution.ok) return institution.error;

  const query = normalizeQuery(input.params.query);
  if (!query.ok) return query.error;

  const pageParams = normalizePageParams(input.params);
  const candidates = await getVectorCandidates({
    repository: input.repository,
    tenantId: tenant.value,
    query: query.query,
    knowledgeId: normalizeOptionalString(input.params.knowledgeId),
    fileId: normalizeOptionalString(input.params.fileId),
  });

  return buildVectorResponse({
    requestId: 'institution-knowledge-vector-search',
    records: candidates
      .filter(({ knowledge }) =>
        knowledge ? isKnowledgeVisibleToInstitution(knowledge, institution.value) : false,
      )
      .map(({ candidate, score }) => mapVectorResult(candidate, score)),
    page: pageParams.page,
    pageSize: pageParams.pageSize,
  });
}
