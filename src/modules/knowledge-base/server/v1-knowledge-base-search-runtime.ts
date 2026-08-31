import { and, asc, eq } from 'drizzle-orm';
import {
  createMockDemoKnowledgeBaseEmbedding,
  type V1KnowledgeBaseEmbeddingVectorIndexRuntimeScope,
} from '@/modules/knowledge-base/server/v1-knowledge-base-embedding-vector-index-runtime';
import type { TenantDatabase } from '@/server/db/client';
import {
  knowledgeChunkEmbeddings,
  knowledgeChunks,
  knowledgeDocuments,
} from '@/server/db/schema';

export type V1KnowledgeBaseSearchRuntimeSourceKind =
  | 'mock'
  | 'seed'
  | 'demo'
  | 'institution_upload';
export type V1KnowledgeBaseSearchRuntimeScoreBand = 'high' | 'medium' | 'low';

export type V1KnowledgeBaseSearchRuntimeCandidate =
  V1KnowledgeBaseEmbeddingVectorIndexRuntimeScope & {
    chunkId: string;
    documentId: string;
    title: string;
    snippet: string;
    sourceKind: V1KnowledgeBaseSearchRuntimeSourceKind;
    chunkIndex: number;
    embeddingDimensions: number;
    embeddingVectorJson: number[];
    readonly: true;
  };

export type V1KnowledgeBaseSearchRuntimeResult = {
  resultId: string;
  chunkId: string;
  documentId: string;
  title: string;
  snippet: string;
  scoreBand: V1KnowledgeBaseSearchRuntimeScoreBand;
  sourceKind: V1KnowledgeBaseSearchRuntimeSourceKind;
  chunkIndex: number;
  readonly: true;
};

export type V1KnowledgeBaseSearchRuntimeInput =
  V1KnowledgeBaseEmbeddingVectorIndexRuntimeScope & {
    query: string;
    topK?: number;
  };

export type V1KnowledgeBaseSearchRuntimeResponse =
  | (V1KnowledgeBaseEmbeddingVectorIndexRuntimeScope & {
      status: 'ready' | 'empty';
      readonly: true;
      query: string;
      mode: 'demo_search_mock_embedding';
      resultCount: number;
      results: V1KnowledgeBaseSearchRuntimeResult[];
    })
  | {
      status: 'empty_query';
      readonly: true;
      query: '';
      resultCount: 0;
      results: [];
    }
  | {
      status: 'denied';
      readonly: true;
    }
  | {
      status: 'validation_failed';
      readonly: true;
    };

export type V1KnowledgeBaseSearchRuntimeRepository = {
  listSearchCandidates(
    scope: V1KnowledgeBaseEmbeddingVectorIndexRuntimeScope,
  ): Promise<V1KnowledgeBaseSearchRuntimeCandidate[]>;
};

export const v1KnowledgeBaseSearchRuntimeResponseFields = [
  'status',
  'readonly',
  'tenantId',
  'institutionId',
  'workspaceId',
  'query',
  'mode',
  'resultCount',
  'results',
  'resultId',
  'chunkId',
  'documentId',
  'title',
  'snippet',
  'scoreBand',
  'sourceKind',
  'chunkIndex',
] as const;

const defaultTopK = 5;
const searchMode = 'demo_search_mock_embedding' as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasScope(input: V1KnowledgeBaseEmbeddingVectorIndexRuntimeScope): boolean {
  return (
    isNonEmptyString(input.tenantId) &&
    isNonEmptyString(input.institutionId) &&
    isNonEmptyString(input.workspaceId)
  );
}

function matchesScope(
  row: V1KnowledgeBaseEmbeddingVectorIndexRuntimeScope,
  scope: V1KnowledgeBaseEmbeddingVectorIndexRuntimeScope,
): boolean {
  return (
    row.tenantId === scope.tenantId &&
    row.institutionId === scope.institutionId &&
    row.workspaceId === scope.workspaceId
  );
}

function dotProduct(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let score = 0;

  for (let index = 0; index < length; index += 1) {
    score += left[index] * right[index];
  }

  return score;
}

function vectorMagnitude(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

function cosineSimilarity(left: number[], right: number[]): number {
  const denominator = vectorMagnitude(left) * vectorMagnitude(right);
  if (denominator === 0) return 0;

  return dotProduct(left, right) / denominator;
}

function scoreBandFor(score: number): V1KnowledgeBaseSearchRuntimeScoreBand {
  if (score >= 1.2) return 'high';
  if (score >= 0.45) return 'medium';

  return 'low';
}

function queryTerms(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[\s,，。；;、/]+/u)
        .map((term) => term.trim())
        .filter((term) => term.length > 0),
    ),
  );
}

function lexicalScore(query: string, candidate: V1KnowledgeBaseSearchRuntimeCandidate): number {
  const searchableText = `${candidate.title} ${candidate.snippet} ${candidate.sourceKind}`.toLowerCase();

  return queryTerms(query).filter((term) => searchableText.includes(term)).length;
}

function resultIdFor(candidate: V1KnowledgeBaseSearchRuntimeCandidate): string {
  return `kb-search-result-${candidate.chunkId.replace(/^kb-chunk-/, '')}`;
}

function clampTopK(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultTopK;

  return Math.min(Math.max(Math.floor(value), 1), 10);
}

function safeString(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export async function searchV1KnowledgeBaseRuntime(input: {
  repository: V1KnowledgeBaseSearchRuntimeRepository;
  input: V1KnowledgeBaseSearchRuntimeInput;
}): Promise<V1KnowledgeBaseSearchRuntimeResponse> {
  const query = input.input.query.trim();
  if (query.length === 0) {
    return {
      status: 'empty_query',
      readonly: true,
      query: '',
      resultCount: 0,
      results: [],
    };
  }

  if (!hasScope(input.input)) {
    return { status: 'validation_failed', readonly: true };
  }

  const scope = {
    tenantId: input.input.tenantId,
    institutionId: input.input.institutionId,
    workspaceId: input.input.workspaceId,
  };
  const candidates = await input.repository.listSearchCandidates(scope);
  if (!candidates.every((candidate) => matchesScope(candidate, input.input))) {
    return { status: 'denied', readonly: true };
  }

  if (candidates.length === 0) {
    return {
      status: 'empty',
      readonly: true,
      tenantId: input.input.tenantId,
      institutionId: input.input.institutionId,
      workspaceId: input.input.workspaceId,
      query,
      mode: searchMode,
      resultCount: 0,
      results: [],
    };
  }

  const dimensions = candidates[0]?.embeddingDimensions ?? 8;
  const queryEmbedding = createMockDemoKnowledgeBaseEmbedding(query, dimensions);
  const results = candidates
    .map((candidate) => ({
      candidate,
      score:
        cosineSimilarity(queryEmbedding.vector, candidate.embeddingVectorJson) +
        lexicalScore(query, candidate),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (left.candidate.chunkIndex !== right.candidate.chunkIndex) {
        return left.candidate.chunkIndex - right.candidate.chunkIndex;
      }

      return left.candidate.chunkId.localeCompare(right.candidate.chunkId);
    })
    .slice(0, clampTopK(input.input.topK))
    .map(({ candidate, score }) => ({
      resultId: resultIdFor(candidate),
      chunkId: candidate.chunkId,
      documentId: candidate.documentId,
      title: safeString(candidate.title, '知识库只读搜索结果'),
      snippet: safeString(candidate.snippet, `chunk:${candidate.chunkIndex}`),
      scoreBand: scoreBandFor(score),
      sourceKind: candidate.sourceKind,
      chunkIndex: candidate.chunkIndex,
      readonly: true as const,
    }));

  return {
    status: 'ready',
    readonly: true,
    tenantId: input.input.tenantId,
    institutionId: input.input.institutionId,
    workspaceId: input.input.workspaceId,
    query,
    mode: searchMode,
    resultCount: results.length,
    results,
  };
}

export function createV1KnowledgeBaseSearchRuntimeRepository(
  database: TenantDatabase,
): V1KnowledgeBaseSearchRuntimeRepository {
  return {
    async listSearchCandidates(scope) {
      const [embeddings, chunks, documents] = await Promise.all([
        database
          .select()
          .from(knowledgeChunkEmbeddings)
          .where(
            and(
              eq(knowledgeChunkEmbeddings.tenantId, scope.tenantId),
              eq(knowledgeChunkEmbeddings.institutionId, scope.institutionId),
              eq(knowledgeChunkEmbeddings.workspaceId, scope.workspaceId),
              eq(knowledgeChunkEmbeddings.status, 'ready'),
            ),
          )
          .orderBy(asc(knowledgeChunkEmbeddings.chunkId)),
        database
          .select()
          .from(knowledgeChunks)
          .where(
            and(
              eq(knowledgeChunks.tenantId, scope.tenantId),
              eq(knowledgeChunks.institutionId, scope.institutionId),
              eq(knowledgeChunks.workspaceId, scope.workspaceId),
              eq(knowledgeChunks.status, 'ready'),
            ),
          ),
        database
          .select()
          .from(knowledgeDocuments)
          .where(
            and(
              eq(knowledgeDocuments.tenantId, scope.tenantId),
              eq(knowledgeDocuments.institutionId, scope.institutionId),
              eq(knowledgeDocuments.workspaceId, scope.workspaceId),
              eq(knowledgeDocuments.status, 'ready'),
            ),
          ),
      ]);
      const chunksById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
      const documentsById = new Map(documents.map((document) => [document.id, document]));

      return embeddings.flatMap((embedding) => {
        const chunk = chunksById.get(embedding.chunkId);
        if (!chunk || !matchesScope(chunk, scope)) return [];

        const document = documentsById.get(chunk.documentId);

        return [
          {
            tenantId: embedding.tenantId,
            institutionId: embedding.institutionId,
            workspaceId: embedding.workspaceId,
            chunkId: embedding.chunkId,
            documentId: chunk.documentId,
            title: document?.title ?? '知识库 demo 搜索结果',
            snippet: chunk.chunkLabel,
            sourceKind: chunk.sourceKind,
            chunkIndex: chunk.chunkIndex,
            embeddingDimensions: embedding.embeddingDimensions,
            embeddingVectorJson: embedding.embeddingVectorJson,
            readonly: true as const,
          },
        ];
      });
    },
  };
}
