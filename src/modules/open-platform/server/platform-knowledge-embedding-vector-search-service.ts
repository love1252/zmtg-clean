import { createHash } from 'node:crypto';
import { isKnowledgeVisibleToInstitution } from '@/modules/open-platform/server/platform-knowledge-file-management-service';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';

export const PLATFORM_KNOWLEDGE_MOCK_EMBEDDING_PROVIDER = 'mock_local_embedding';
export const PLATFORM_KNOWLEDGE_MOCK_EMBEDDING_MODEL = 'mock-local-embedding-v1';
export const PLATFORM_KNOWLEDGE_MOCK_EMBEDDING_DIMENSIONS = 8;

export type PlatformKnowledgeEmbeddingErrorCode =
  | 'provider_disabled'
  | 'missing_config'
  | 'http_failure'
  | 'malformed_response'
  | 'timeout'
  | 'provider_failure';

export type PlatformKnowledgeEmbeddingProviderResult =
  | {
      status: 'success';
      vectors: number[][];
      dimensions: number;
      provider: string;
      model: string;
    }
  | {
      status: 'failed';
      errorCode: PlatformKnowledgeEmbeddingErrorCode;
      safeMessage: string;
    };

export type PlatformKnowledgeEmbeddingProvider = {
  provider?: string;
  model?: string;
  dimensions?: number;
  embed(input: {
    texts: string[];
    timeoutMs?: number;
  }): Promise<PlatformKnowledgeEmbeddingProviderResult>;
};

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
  status: 'ready' | 'failed';
  failureReasonCode?: string | null;
};

export type PlatformKnowledgeChunkEmbeddingSummary = Omit<
  PlatformKnowledgeChunkEmbeddingSaveRecord,
  'embeddingVectorJson' | 'embeddingProvider' | 'embeddingModel'
> & {
  embeddingId: string;
  embeddingProvider?: string;
  embeddingModel?: string;
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

export type PlatformKnowledgeRetrievalMode = 'keyword' | 'vector' | 'hybrid';

export type PlatformKnowledgeRetrievalResultDto = {
  knowledgeId: string;
  knowledgeTitle: string;
  fileId: string;
  fileName: string;
  chunkId: string;
  chunkIndex: number;
  textPreview: string;
  retrievalMode: PlatformKnowledgeRetrievalMode;
  keywordScore?: number;
  vectorScore?: number;
  rerankScore?: number;
  matchReason: string;
};

export type PlatformKnowledgeVectorSearchResultDto = PlatformKnowledgeRetrievalResultDto & {
  score: number;
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

export type PlatformKnowledgeHybridSearchResponse = {
  requestId: 'platform-knowledge-hybrid-search' | 'institution-knowledge-hybrid-search';
  readonly: true;
  dataSource: 'repository';
  records: PlatformKnowledgeRetrievalResultDto[];
  pageInfo: PlatformKnowledgeVectorSearchResponse['pageInfo'];
  emptyState: PlatformKnowledgeVectorSearchResponse['emptyState'];
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

type HybridRetrievalRepository = Pick<EmbeddingRepository, 'listKnowledgeItems'> & {
  searchKnowledgeFileParseChunks(input: {
    tenantId: string;
    keyword: string;
    knowledgeId?: string;
    fileId?: string;
  }): Promise<PlatformKnowledgeEmbeddingCandidateRecord[]>;
  listKnowledgeVectorSearchCandidates?: EmbeddingRepository['listKnowledgeVectorSearchCandidates'];
};

type VectorSearchParams = {
  tenantId?: string | number | null;
  institutionId?: string | number | null;
  query?: string | number | null;
  keyword?: string | number | null;
  mode?: string | number | null;
  retrievalMode?: string | number | null;
  knowledgeId?: string | number | null;
  fileId?: string | number | null;
  page?: string | number | null;
  pageSize?: string | number | null;
  topK?: string | number | null;
  rebuild?: boolean | string | number | null;
};

type EmbeddingGenerateParams = Omit<VectorSearchParams, 'query' | 'institutionId'>;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const DEFAULT_TOP_K = 5;
const ALLOWED_TOP_K = [3, 5, 10] as const;
const SNIPPET_MAX_CHARS = 300;
const embeddingUnavailableMessage = '知识库向量索引暂时不可用，请稍后重试';
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

function normalizeTopK(params: VectorSearchParams) {
  const candidate = params.topK ?? params.pageSize;
  if (candidate === null || candidate === undefined || candidate === '') return DEFAULT_TOP_K;
  const parsed = Number(candidate);
  return ALLOWED_TOP_K.some((allowed) => allowed === parsed) ? parsed : DEFAULT_TOP_K;
}

function normalizeRetrievalMode(value: string | number | null | undefined): PlatformKnowledgeRetrievalMode {
  if (value === 'keyword' || value === 'vector' || value === 'hybrid') return value;
  return 'hybrid';
}

function normalizeRebuild(value: boolean | string | number | null | undefined) {
  return value === true || value === 'true' || value === 1 || value === '1';
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

export function createMockKnowledgeEmbeddingProvider(
  dimensions = PLATFORM_KNOWLEDGE_MOCK_EMBEDDING_DIMENSIONS,
): PlatformKnowledgeEmbeddingProvider {
  return {
    provider: PLATFORM_KNOWLEDGE_MOCK_EMBEDDING_PROVIDER,
    model: PLATFORM_KNOWLEDGE_MOCK_EMBEDDING_MODEL,
    dimensions,
    async embed(input) {
      const vectors = input.texts.map((text) =>
        createDeterministicMockKnowledgeEmbedding(text, dimensions).vector,
      );
      return {
        status: 'success',
        vectors,
        dimensions,
        provider: PLATFORM_KNOWLEDGE_MOCK_EMBEDDING_PROVIDER,
        model: PLATFORM_KNOWLEDGE_MOCK_EMBEDDING_MODEL,
      };
    },
  };
}

export function createDryRunKnowledgeEmbeddingProvider() {
  return createMockKnowledgeEmbeddingProvider();
}

export function createOpenAiCompatibleKnowledgeEmbeddingProvider(input: {
  enabled?: boolean;
  apiKey?: string | null;
  baseUrl?: string | null;
  model?: string | null;
  dimensions?: number | null;
  fetchImpl: typeof fetch;
}): PlatformKnowledgeEmbeddingProvider {
  return {
    provider: 'openai_compatible',
    model: input.model?.trim() || undefined,
    dimensions: input.dimensions ?? undefined,
    async embed(request) {
      if (input.enabled === false) {
        return { status: 'failed', errorCode: 'provider_disabled', safeMessage: 'embedding provider 未启用' };
      }
      const apiKey = input.apiKey?.trim();
      const baseUrl = input.baseUrl?.trim();
      const model = input.model?.trim();
      if (!apiKey || !baseUrl || !model) {
        return { status: 'failed', errorCode: 'missing_config', safeMessage: 'embedding provider 配置不完整' };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? 8_000);
      try {
        const response = await input.fetchImpl(`${baseUrl.replace(/\/$/, '')}/embeddings`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ input: request.texts, model }),
          signal: controller.signal,
        });
        if (!response.ok) {
          return { status: 'failed', errorCode: 'http_failure', safeMessage: embeddingUnavailableMessage };
        }
        const payload = await response.json().catch(() => null);
        const vectors = Array.isArray(payload?.data)
          ? payload.data.map((item: { embedding?: unknown }) => item.embedding)
          : null;
        if (!vectors || vectors.length !== request.texts.length || !vectors.every(isNumericVector)) {
          return { status: 'failed', errorCode: 'malformed_response', safeMessage: embeddingUnavailableMessage };
        }
        const dimensions = input.dimensions ?? vectors[0].length;
        if (!vectors.every((vector: number[]) => vector.length === dimensions)) {
          return { status: 'failed', errorCode: 'malformed_response', safeMessage: embeddingUnavailableMessage };
        }

        return {
          status: 'success',
          vectors: vectors.map((vector: number[]) => vector.map((value) => Number(value))),
          dimensions,
          provider: 'openai_compatible',
          model,
        };
      } catch (error) {
        const name = error instanceof Error ? error.name : '';
        return {
          status: 'failed',
          errorCode: name === 'AbortError' ? 'timeout' : 'provider_failure',
          safeMessage: embeddingUnavailableMessage,
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function isNumericVector(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => Number.isFinite(item));
}

function isEmbeddableCandidate(record: PlatformKnowledgeEmbeddingCandidateRecord) {
  return record.tenantId && record.fileStatus === 'active' && record.parseStatus === 'succeeded';
}

function vectorMagnitude(vector: number[]) {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

export function cosineSimilarity(left: number[], right: number[]) {
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

function truncateSnippet(text: string) {
  const normalized = text.trim();
  return normalized.length <= SNIPPET_MAX_CHARS
    ? normalized
    : `${normalized.slice(0, SNIPPET_MAX_CHARS - 1)}…`;
}

function buildPagedResponse<TRecord>(input: {
  records: TRecord[];
  page: number;
  pageSize: number;
}) {
  const total = input.records.length;
  const pageCount = Math.ceil(total / input.pageSize);
  const safePage = pageCount > 0 ? Math.min(input.page, pageCount) : input.page;
  const start = (safePage - 1) * input.pageSize;

  return {
    records: input.records.slice(start, start + input.pageSize),
    pageInfo: {
      page: safePage,
      pageSize: input.pageSize,
      total,
      pageCount,
      hasPreviousPage: safePage > 1 && total > 0,
      hasNextPage: safePage < pageCount,
    },
  };
}

function buildVectorResponse(input: {
  requestId: PlatformKnowledgeVectorSearchResponse['requestId'];
  records: PlatformKnowledgeVectorSearchResultDto[];
  page: number;
  pageSize: number;
}): PlatformKnowledgeVectorSearchResponse {
  const paged = buildPagedResponse({ records: input.records, page: input.page, pageSize: input.pageSize });
  return {
    requestId: input.requestId,
    readonly: true,
    dataSource: 'repository',
    records: paged.records,
    pageInfo: paged.pageInfo,
    emptyState,
  };
}

function buildHybridResponse(input: {
  requestId: PlatformKnowledgeHybridSearchResponse['requestId'];
  records: PlatformKnowledgeRetrievalResultDto[];
  page: number;
  pageSize: number;
}): PlatformKnowledgeHybridSearchResponse {
  const paged = buildPagedResponse({ records: input.records, page: input.page, pageSize: input.pageSize });
  return {
    requestId: input.requestId,
    readonly: true,
    dataSource: 'repository',
    records: paged.records,
    pageInfo: paged.pageInfo,
    emptyState: {
      title: '暂无检索命中',
      description: '当前范围没有命中已解析知识片段。',
    },
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
    textPreview: truncateSnippet(record.textPreview),
    retrievalMode: 'vector' as const,
    score,
    vectorScore: score,
    rerankScore: score,
    matchReason: `向量相似度 ${score.toFixed(3)}`,
  };
}

function publicEmbeddingSummary(summary: PlatformKnowledgeChunkEmbeddingSummary) {
  return {
    embeddingId: summary.embeddingId,
    tenantId: summary.tenantId,
    knowledgeId: summary.knowledgeId,
    fileId: summary.fileId,
    chunkId: summary.chunkId,
    embeddingDimensions: summary.embeddingDimensions,
    status: summary.status,
    failureReasonCode: summary.failureReasonCode ?? null,
  };
}

function hasMatchingEmbedding(input: {
  existing: PlatformKnowledgeVectorSearchCandidateRecord[];
  candidate: PlatformKnowledgeEmbeddingCandidateRecord;
  provider: string;
  model: string;
  dimensions: number;
}) {
  return input.existing.some((record) =>
    record.chunkId === input.candidate.chunkId &&
    record.embeddingStatus === 'ready' &&
    record.embeddingProvider === input.provider &&
    record.embeddingModel === input.model &&
    record.embeddingDimensions === input.dimensions
  );
}

export async function generatePlatformKnowledgeChunkEmbeddingsService(input: {
  repository: EmbeddingRepository;
  params: EmbeddingGenerateParams;
  provider?: PlatformKnowledgeEmbeddingProvider;
}) {
  const tenant = normalizeScope(input.params.tenantId, 'tenantId');
  if (!tenant.ok) return tenant.error;

  const knowledgeId = normalizeOptionalString(input.params.knowledgeId);
  const fileId = normalizeOptionalString(input.params.fileId);
  const rebuild = normalizeRebuild(input.params.rebuild);
  const provider = input.provider ?? createMockKnowledgeEmbeddingProvider();
  const providerId = provider.provider ?? PLATFORM_KNOWLEDGE_MOCK_EMBEDDING_PROVIDER;
  const providerModel = provider.model ?? PLATFORM_KNOWLEDGE_MOCK_EMBEDDING_MODEL;
  const providerDimensions = provider.dimensions ?? PLATFORM_KNOWLEDGE_MOCK_EMBEDDING_DIMENSIONS;
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
      skippedCount: 0,
      message: '当前范围暂无可生成向量索引的已解析片段',
    };
  }

  const existing = rebuild
    ? []
    : await input.repository.listKnowledgeVectorSearchCandidates({
      tenantId: tenant.value,
      knowledgeId,
      fileId,
    });
  const pending = embeddable.filter((candidate) =>
    !hasMatchingEmbedding({
      existing,
      candidate,
      provider: providerId,
      model: providerModel,
      dimensions: providerDimensions,
    }),
  );

  if (pending.length === 0) {
    return {
      status: 'succeeded' as const,
      embeddingCount: 0,
      skippedCount: embeddable.length,
      embeddings: [],
    };
  }

  const embedding = await provider.embed({ texts: pending.map((candidate) => candidate.textPreview) });
  if (embedding.status === 'failed') {
    return {
      status: 'failed' as const,
      embeddingCount: 0,
      skippedCount: embeddable.length - pending.length,
      errorCode: embedding.errorCode,
      message: embedding.safeMessage,
    };
  }

  const saved = await input.repository.saveKnowledgeChunkEmbeddings(
    pending.map((candidate, index) => ({
      tenantId: candidate.tenantId,
      knowledgeId: candidate.knowledgeId,
      fileId: candidate.fileId,
      chunkId: candidate.chunkId,
      embeddingProvider: embedding.provider,
      embeddingModel: embedding.model,
      embeddingDimensions: embedding.dimensions,
      embeddingVectorJson: embedding.vectors[index],
      status: 'ready' as const,
      failureReasonCode: null,
    })),
  );

  return {
    status: 'succeeded' as const,
    embeddingCount: saved.length,
    skippedCount: embeddable.length - pending.length,
    embeddings: saved.map(publicEmbeddingSummary),
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

function keywordOverlapScore(input: { query: string; text: string }) {
  const query = input.query.normalize('NFKC').replace(/[\s，,。！？!?、：:；;]/g, '').toLowerCase();
  const text = input.text.normalize('NFKC').toLowerCase();
  if (!query) return 0;
  if (text.includes(query)) return 1;
  const uniqueChars = [...new Set([...query])];
  const hits = uniqueChars.filter((char) => text.includes(char)).length;
  return Number((hits / uniqueChars.length).toFixed(6));
}

function normalizedVectorScore(score: number | undefined) {
  if (score === undefined) return 0;
  return Math.max(0, Math.min(1, (score + 1) / 2));
}

function deterministicRerankScore(input: {
  keywordScore?: number;
  vectorScore?: number;
  chunkIndex: number;
}) {
  const orderScore = 1 / (1 + Math.max(0, input.chunkIndex));
  const score = (input.keywordScore ?? 0) * 0.45 + normalizedVectorScore(input.vectorScore) * 0.45 + orderScore * 0.1;
  return Number(score.toFixed(6));
}

function mergeRetrievalCandidate(input: {
  current?: PlatformKnowledgeRetrievalResultDto;
  next: PlatformKnowledgeRetrievalResultDto;
}) {
  if (!input.current) return input.next;
  const keywordScore = Math.max(input.current.keywordScore ?? 0, input.next.keywordScore ?? 0) || undefined;
  const vectorScore = Math.max(input.current.vectorScore ?? -Infinity, input.next.vectorScore ?? -Infinity);
  const hasVector = Number.isFinite(vectorScore);
  const retrievalMode: PlatformKnowledgeRetrievalMode = keywordScore && hasVector
    ? 'hybrid'
    : keywordScore
      ? 'keyword'
      : 'vector';
  const matchParts = [
    keywordScore ? `关键词匹配 ${keywordScore.toFixed(3)}` : null,
    hasVector ? `向量相似度 ${vectorScore.toFixed(3)}` : null,
  ].filter(Boolean);

  return {
    ...input.current,
    retrievalMode,
    keywordScore,
    vectorScore: hasVector ? vectorScore : undefined,
    matchReason: `${matchParts.join('；')}；deterministic rerank`,
  } satisfies PlatformKnowledgeRetrievalResultDto;
}

async function recallHybridRecords(input: {
  repository: HybridRetrievalRepository;
  tenantId: string;
  institutionId?: string;
  query: string;
  keyword: string;
  mode: PlatformKnowledgeRetrievalMode;
  knowledgeId?: string;
  fileId?: string;
  topK: number;
}) {
  const knowledgeItems = await input.repository.listKnowledgeItems({ tenantId: input.tenantId });
  const visibleKnowledge = knowledgeById(
    knowledgeItems
      .filter((record) => record.tenantId === input.tenantId)
      .filter((record) =>
        input.institutionId ? isKnowledgeVisibleToInstitution(record, input.institutionId) : true,
      ),
  );
  const byChunkId = new Map<string, PlatformKnowledgeRetrievalResultDto>();

  if (input.mode === 'keyword' || input.mode === 'hybrid') {
    const chunks = await input.repository.searchKnowledgeFileParseChunks({
      tenantId: input.tenantId,
      keyword: input.keyword,
      knowledgeId: input.knowledgeId,
      fileId: input.fileId,
    });
    chunks
      .filter((chunk) => chunk.tenantId === input.tenantId)
      .filter(isEmbeddableCandidate)
      .filter((chunk) => visibleKnowledge.has(chunk.knowledgeId))
      .forEach((chunk) => {
        const keywordScore = keywordOverlapScore({ query: input.query, text: chunk.textPreview });
        const next: PlatformKnowledgeRetrievalResultDto = {
          knowledgeId: chunk.knowledgeId,
          knowledgeTitle: chunk.knowledgeTitle,
          fileId: chunk.fileId,
          fileName: chunk.fileName,
          chunkId: chunk.chunkId,
          chunkIndex: chunk.chunkIndex,
          textPreview: truncateSnippet(chunk.textPreview),
          retrievalMode: 'keyword',
          keywordScore,
          matchReason: `关键词匹配 ${keywordScore.toFixed(3)}`,
        };
        byChunkId.set(chunk.chunkId, mergeRetrievalCandidate({ current: byChunkId.get(chunk.chunkId), next }));
      });
  }

  if ((input.mode === 'vector' || input.mode === 'hybrid') && input.repository.listKnowledgeVectorSearchCandidates) {
    const queryEmbedding = createDeterministicMockKnowledgeEmbedding(input.query);
    const candidates = await input.repository.listKnowledgeVectorSearchCandidates({
      tenantId: input.tenantId,
      knowledgeId: input.knowledgeId,
      fileId: input.fileId,
    });
    candidates
      .filter((candidate) => candidate.tenantId === input.tenantId)
      .filter(isEmbeddableCandidate)
      .filter((candidate) => candidate.embeddingStatus === 'ready')
      .filter((candidate) => visibleKnowledge.has(candidate.knowledgeId))
      .forEach((candidate) => {
        const vectorScore = Number(cosineSimilarity(queryEmbedding.vector, candidate.embeddingVectorJson).toFixed(6));
        const next: PlatformKnowledgeRetrievalResultDto = {
          knowledgeId: candidate.knowledgeId,
          knowledgeTitle: candidate.knowledgeTitle,
          fileId: candidate.fileId,
          fileName: candidate.fileName,
          chunkId: candidate.chunkId,
          chunkIndex: candidate.chunkIndex,
          textPreview: truncateSnippet(candidate.textPreview),
          retrievalMode: 'vector',
          vectorScore,
          matchReason: `向量相似度 ${vectorScore.toFixed(3)}`,
        };
        byChunkId.set(candidate.chunkId, mergeRetrievalCandidate({ current: byChunkId.get(candidate.chunkId), next }));
      });
  }

  return Array.from(byChunkId.values())
    .map((record) => ({
      ...record,
      rerankScore: deterministicRerankScore({
        keywordScore: record.keywordScore,
        vectorScore: record.vectorScore,
        chunkIndex: record.chunkIndex,
      }),
      matchReason: record.matchReason.includes('deterministic rerank')
        ? record.matchReason
        : `${record.matchReason}；deterministic rerank`,
    }))
    .sort((left, right) =>
      (right.rerankScore ?? 0) - (left.rerankScore ?? 0) ||
      left.knowledgeId.localeCompare(right.knowledgeId) ||
      left.fileId.localeCompare(right.fileId) ||
      left.chunkIndex - right.chunkIndex ||
      left.chunkId.localeCompare(right.chunkId),
    )
    .slice(0, input.topK);
}

export async function searchPlatformKnowledgeRetrievalChunksService(input: {
  repository: HybridRetrievalRepository;
  params: VectorSearchParams;
}) {
  const tenant = normalizeScope(input.params.tenantId, 'tenantId');
  if (!tenant.ok) return tenant.error;

  const query = normalizeQuery(input.params.query ?? input.params.keyword);
  if (!query.ok) return query.error;

  const pageParams = normalizePageParams(input.params);
  const mode = normalizeRetrievalMode(input.params.mode ?? input.params.retrievalMode);
  const records = await recallHybridRecords({
    repository: input.repository,
    tenantId: tenant.value,
    query: query.query,
    keyword: normalizeOptionalString(input.params.keyword) ?? query.query,
    mode,
    knowledgeId: normalizeOptionalString(input.params.knowledgeId),
    fileId: normalizeOptionalString(input.params.fileId),
    topK: normalizeTopK(input.params),
  });

  return buildHybridResponse({
    requestId: 'platform-knowledge-hybrid-search',
    records,
    page: pageParams.page,
    pageSize: pageParams.pageSize,
  });
}

export async function searchInstitutionKnowledgeRetrievalChunksService(input: {
  repository: HybridRetrievalRepository;
  params: VectorSearchParams;
}) {
  const tenant = normalizeScope(input.params.tenantId, 'tenantId');
  if (!tenant.ok) return tenant.error;

  const institution = normalizeScope(input.params.institutionId, 'institutionId');
  if (!institution.ok) return institution.error;

  const query = normalizeQuery(input.params.query ?? input.params.keyword);
  if (!query.ok) return query.error;

  const pageParams = normalizePageParams(input.params);
  const mode = normalizeRetrievalMode(input.params.mode ?? input.params.retrievalMode);
  const records = await recallHybridRecords({
    repository: input.repository,
    tenantId: tenant.value,
    institutionId: institution.value,
    query: query.query,
    keyword: normalizeOptionalString(input.params.keyword) ?? query.query,
    mode,
    knowledgeId: normalizeOptionalString(input.params.knowledgeId),
    fileId: normalizeOptionalString(input.params.fileId),
    topK: normalizeTopK(input.params),
  });

  return buildHybridResponse({
    requestId: 'institution-knowledge-hybrid-search',
    records,
    page: pageParams.page,
    pageSize: pageParams.pageSize,
  });
}
