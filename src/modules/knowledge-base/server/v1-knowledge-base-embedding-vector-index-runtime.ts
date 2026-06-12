import { and, asc, eq } from 'drizzle-orm';
import type {
  V1KnowledgeBaseRuntimeFoundationStatus,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-runtime-foundation-api-contract';
import type { TenantDatabase } from '@/server/db/client';
import {
  knowledgeChunkEmbeddings,
  knowledgeChunks,
  knowledgeIndexJobs,
} from '@/server/db/schema';

type KnowledgeChunkEmbeddingRow = typeof knowledgeChunkEmbeddings.$inferSelect;
type KnowledgeIndexJobRow = typeof knowledgeIndexJobs.$inferSelect;

export type V1KnowledgeBaseEmbeddingVectorIndexRuntimeScope = {
  tenantId: string;
  institutionId: string;
  workspaceId: string;
};

export type V1KnowledgeBaseEmbeddingVectorIndexRuntimeChunk =
  V1KnowledgeBaseEmbeddingVectorIndexRuntimeScope & {
    chunkId: string;
    documentId: string;
    chunkText: string;
    chunkIndex: number;
  };

export type V1KnowledgeBaseEmbeddingVectorIndexRuntimeEmbeddingInput =
  V1KnowledgeBaseEmbeddingVectorIndexRuntimeScope & {
    id: string;
    chunkId: string;
    embeddingProvider: 'mock_demo_embedding';
    embeddingModel: 'mock-demo-embedding-v1';
    embeddingDimensions: number;
    embeddingVectorJson: number[];
    status: 'ready';
  };

export type V1KnowledgeBaseEmbeddingVectorIndexRuntimeEmbeddingSummary = {
  embeddingId: string;
  chunkId: string;
  embeddingProvider: 'mock_demo_embedding';
  embeddingDimensions: number;
  status: V1KnowledgeBaseRuntimeFoundationStatus;
  readonly: true;
};

export type V1KnowledgeBaseEmbeddingVectorIndexRuntimeJobSummary =
  V1KnowledgeBaseEmbeddingVectorIndexRuntimeScope & {
    jobId: string;
    documentId: string;
    status: V1KnowledgeBaseRuntimeFoundationStatus;
    embeddingCount: number;
    readonly: true;
  };

export type V1KnowledgeBaseEmbeddingVectorIndexRuntimeRunInput =
  V1KnowledgeBaseEmbeddingVectorIndexRuntimeScope & {
    jobId: string;
  };

export type V1KnowledgeBaseEmbeddingVectorIndexRuntimeRunResult =
  | (V1KnowledgeBaseEmbeddingVectorIndexRuntimeScope & {
      status: 'ready';
      readonly: true;
      job: V1KnowledgeBaseEmbeddingVectorIndexRuntimeJobSummary;
      embeddings: V1KnowledgeBaseEmbeddingVectorIndexRuntimeEmbeddingSummary[];
      embeddingCount: number;
    })
  | {
      status: 'empty';
      readonly: true;
      embeddingCount: 0;
    }
  | {
      status: 'failed';
      readonly: true;
      failureReason: '知识库 demo embedding 索引生成失败';
    }
  | {
      status: 'scope_mismatch';
      readonly: true;
    }
  | {
      status: 'validation_failed';
      readonly: true;
    };

export type V1KnowledgeBaseEmbeddingVectorIndexRuntimeListResult =
  V1KnowledgeBaseEmbeddingVectorIndexRuntimeScope & {
    status: 'ready' | 'empty';
    readonly: true;
    jobs: V1KnowledgeBaseEmbeddingVectorIndexRuntimeJobSummary[];
  };

export type V1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository = {
  listPendingChunksForIndexJob(
    input: V1KnowledgeBaseEmbeddingVectorIndexRuntimeRunInput,
  ): Promise<V1KnowledgeBaseEmbeddingVectorIndexRuntimeChunk[]>;
  createChunkEmbedding(
    input: V1KnowledgeBaseEmbeddingVectorIndexRuntimeEmbeddingInput,
  ): Promise<
    | {
        status: 'created';
        record: V1KnowledgeBaseEmbeddingVectorIndexRuntimeEmbeddingSummary;
      }
    | { status: 'failed' }
  >;
  updateIndexJobStatus(input: {
    jobId: string;
    tenantId: string;
    institutionId: string;
    workspaceId: string;
    status: Extract<V1KnowledgeBaseRuntimeFoundationStatus, 'ready' | 'failed' | 'empty'>;
  }): Promise<{ status: 'updated' | 'not_found' }>;
  listIndexJobSummaries(
    scope: V1KnowledgeBaseEmbeddingVectorIndexRuntimeScope,
  ): Promise<V1KnowledgeBaseEmbeddingVectorIndexRuntimeJobSummary[]>;
};

export const v1KnowledgeBaseEmbeddingVectorIndexRuntimeResponseFields = [
  'status',
  'readonly',
  'tenantId',
  'institutionId',
  'workspaceId',
  'job',
  'jobs',
  'jobId',
  'documentId',
  'embeddingCount',
  'embeddings',
  'embeddingId',
  'chunkId',
  'embeddingProvider',
  'embeddingDimensions',
  'failureReason',
] as const;

const embeddingProvider = 'mock_demo_embedding' as const;
const embeddingModel = 'mock-demo-embedding-v1' as const;
const defaultDimensions = 8;
const failedReason = '知识库 demo embedding 索引生成失败' as const;

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

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function normalizeVectorValue(value: number): number {
  return Number((((value % 2000) - 1000) / 1000).toFixed(3));
}

function embeddingIdForChunk(chunkId: string): string {
  return `kb-embedding-${stableHash(chunkId).toString(36)}`;
}

export function createMockDemoKnowledgeBaseEmbedding(
  chunkText: string,
  dimensions = defaultDimensions,
): {
  provider: typeof embeddingProvider;
  model: typeof embeddingModel;
  dimensions: number;
  vector: number[];
} {
  const vector = Array.from({ length: dimensions }, (_, index) =>
    normalizeVectorValue(stableHash(`${index}:${chunkText}`)),
  );

  return {
    provider: embeddingProvider,
    model: embeddingModel,
    dimensions,
    vector,
  };
}

function mapEmbeddingRowToSummary(
  row: KnowledgeChunkEmbeddingRow,
): V1KnowledgeBaseEmbeddingVectorIndexRuntimeEmbeddingSummary {
  return {
    embeddingId: row.id,
    chunkId: row.chunkId,
    embeddingProvider: 'mock_demo_embedding',
    embeddingDimensions: row.embeddingDimensions,
    status: row.status,
    readonly: true,
  };
}

function mapJobRowToSummary(input: {
  row: KnowledgeIndexJobRow;
  embeddingCount: number;
}): V1KnowledgeBaseEmbeddingVectorIndexRuntimeJobSummary {
  return {
    jobId: input.row.id,
    documentId: input.row.documentId,
    tenantId: input.row.tenantId,
    institutionId: input.row.institutionId,
    workspaceId: input.row.workspaceId,
    status: input.row.status,
    embeddingCount: input.embeddingCount,
    readonly: true,
  };
}

async function markJob(
  repository: V1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository,
  input: V1KnowledgeBaseEmbeddingVectorIndexRuntimeRunInput,
  status: Extract<V1KnowledgeBaseRuntimeFoundationStatus, 'ready' | 'failed' | 'empty'>,
) {
  await repository.updateIndexJobStatus({
    ...input,
    status,
  });
}

export async function runV1KnowledgeBaseEmbeddingVectorIndexJob(input: {
  repository: V1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository;
  input: V1KnowledgeBaseEmbeddingVectorIndexRuntimeRunInput;
}): Promise<V1KnowledgeBaseEmbeddingVectorIndexRuntimeRunResult> {
  if (!hasScope(input.input) || !isNonEmptyString(input.input.jobId)) {
    return { status: 'validation_failed', readonly: true };
  }

  const chunks = await input.repository.listPendingChunksForIndexJob(input.input);
  if (!chunks.every((chunk) => matchesScope(chunk, input.input))) {
    return { status: 'scope_mismatch', readonly: true };
  }

  if (chunks.length === 0) {
    await markJob(input.repository, input.input, 'empty');
    return { status: 'empty', readonly: true, embeddingCount: 0 };
  }

  const embeddings: V1KnowledgeBaseEmbeddingVectorIndexRuntimeEmbeddingSummary[] = [];

  for (const chunk of chunks) {
    const embedding = createMockDemoKnowledgeBaseEmbedding(chunk.chunkText, defaultDimensions);
    const result = await input.repository.createChunkEmbedding({
      id: embeddingIdForChunk(chunk.chunkId),
      tenantId: chunk.tenantId,
      institutionId: chunk.institutionId,
      workspaceId: chunk.workspaceId,
      chunkId: chunk.chunkId,
      embeddingProvider: embedding.provider,
      embeddingModel: embedding.model,
      embeddingDimensions: embedding.dimensions,
      embeddingVectorJson: embedding.vector,
      status: 'ready',
    });

    if (result.status !== 'created') {
      await markJob(input.repository, input.input, 'failed');
      return {
        status: 'failed',
        readonly: true,
        failureReason: failedReason,
      };
    }

    embeddings.push({
      embeddingId: result.record.embeddingId,
      chunkId: result.record.chunkId,
      embeddingProvider: result.record.embeddingProvider,
      embeddingDimensions: result.record.embeddingDimensions,
      status: result.record.status,
      readonly: true,
    });
  }

  await markJob(input.repository, input.input, 'ready');

  return {
    status: 'ready',
    readonly: true,
    tenantId: input.input.tenantId,
    institutionId: input.input.institutionId,
    workspaceId: input.input.workspaceId,
    job: {
      jobId: input.input.jobId,
      documentId: chunks[0]?.documentId ?? 'not_available',
      tenantId: input.input.tenantId,
      institutionId: input.input.institutionId,
      workspaceId: input.input.workspaceId,
      status: 'ready',
      embeddingCount: embeddings.length,
      readonly: true,
    },
    embeddings,
    embeddingCount: embeddings.length,
  };
}

export async function listV1KnowledgeBaseEmbeddingVectorIndexJobs(input: {
  repository: Pick<V1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository, 'listIndexJobSummaries'>;
  scope: V1KnowledgeBaseEmbeddingVectorIndexRuntimeScope;
}): Promise<V1KnowledgeBaseEmbeddingVectorIndexRuntimeListResult> {
  const jobs = await input.repository.listIndexJobSummaries(input.scope);

  return {
    ...input.scope,
    status: jobs.length === 0 ? 'empty' : 'ready',
    readonly: true,
    jobs,
  };
}

export function createV1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository(
  database: TenantDatabase,
): V1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository {
  return {
    async listPendingChunksForIndexJob(input) {
      const rows = await database
        .select()
        .from(knowledgeChunks)
        .where(
          and(
            eq(knowledgeChunks.tenantId, input.tenantId),
            eq(knowledgeChunks.institutionId, input.institutionId),
            eq(knowledgeChunks.workspaceId, input.workspaceId),
          ),
        )
        .orderBy(asc(knowledgeChunks.chunkIndex), asc(knowledgeChunks.id));

      return rows
        .filter((row) => matchesScope(row, input))
        .map((row) => ({
          chunkId: row.id,
          documentId: row.documentId,
          tenantId: row.tenantId,
          institutionId: row.institutionId,
          workspaceId: row.workspaceId,
          chunkText: row.chunkLabel,
          chunkIndex: row.chunkIndex,
        }));
    },

    async createChunkEmbedding(input) {
      const [row] = await database
        .insert(knowledgeChunkEmbeddings)
        .values({
          id: input.id,
          chunkId: input.chunkId,
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          workspaceId: input.workspaceId,
          embeddingProvider: input.embeddingProvider,
          embeddingModel: input.embeddingModel,
          embeddingDimensions: input.embeddingDimensions,
          embeddingVectorJson: [...input.embeddingVectorJson],
          status: input.status,
        })
        .returning();

      return row
        ? { status: 'created', record: mapEmbeddingRowToSummary(row) }
        : { status: 'failed' };
    },

    async updateIndexJobStatus(input) {
      const [row] = await database
        .update(knowledgeIndexJobs)
        .set({
          status: input.status,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(knowledgeIndexJobs.id, input.jobId),
            eq(knowledgeIndexJobs.tenantId, input.tenantId),
            eq(knowledgeIndexJobs.institutionId, input.institutionId),
            eq(knowledgeIndexJobs.workspaceId, input.workspaceId),
          ),
        )
        .returning();

      return row ? { status: 'updated' } : { status: 'not_found' };
    },

    async listIndexJobSummaries(scope) {
      const jobs = await database
        .select()
        .from(knowledgeIndexJobs)
        .where(
          and(
            eq(knowledgeIndexJobs.tenantId, scope.tenantId),
            eq(knowledgeIndexJobs.institutionId, scope.institutionId),
            eq(knowledgeIndexJobs.workspaceId, scope.workspaceId),
          ),
        )
        .orderBy(asc(knowledgeIndexJobs.id));
      const embeddings = await database
        .select()
        .from(knowledgeChunkEmbeddings)
        .where(
          and(
            eq(knowledgeChunkEmbeddings.tenantId, scope.tenantId),
            eq(knowledgeChunkEmbeddings.institutionId, scope.institutionId),
            eq(knowledgeChunkEmbeddings.workspaceId, scope.workspaceId),
          ),
        );

      return jobs
        .filter((row) => matchesScope(row, scope))
        .map((row) =>
          mapJobRowToSummary({
            row,
            embeddingCount: embeddings.filter(
              (embedding) =>
                embedding.tenantId === row.tenantId &&
                embedding.workspaceId === row.workspaceId,
            ).length,
          }),
        );
    },
  };
}
