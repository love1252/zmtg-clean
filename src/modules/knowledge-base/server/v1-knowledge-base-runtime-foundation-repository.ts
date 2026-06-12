import { and, asc, eq } from 'drizzle-orm';
import type {
  V1KnowledgeBaseRuntimeFoundationChunkSummary,
  V1KnowledgeBaseRuntimeFoundationDocumentSummary,
  V1KnowledgeBaseRuntimeFoundationIndexJobSummary,
  V1KnowledgeBaseRuntimeFoundationReadonlyStatus,
  V1KnowledgeBaseRuntimeFoundationReadonlySummary,
  V1KnowledgeBaseRuntimeFoundationSourceKind,
  V1KnowledgeBaseRuntimeFoundationSourceSummary,
  V1KnowledgeBaseRuntimeFoundationStatus,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-runtime-foundation-api-contract';
import type { TenantDatabase } from '@/server/db/client';
import {
  knowledgeChunks,
  knowledgeDocuments,
  knowledgeIndexJobs,
  knowledgeSources,
} from '@/server/db/schema';

type KnowledgeSourceRow = typeof knowledgeSources.$inferSelect;
type KnowledgeDocumentRow = typeof knowledgeDocuments.$inferSelect;
type KnowledgeChunkRow = typeof knowledgeChunks.$inferSelect;
type KnowledgeIndexJobRow = typeof knowledgeIndexJobs.$inferSelect;

export type {
  V1KnowledgeBaseRuntimeFoundationReadonlySummary,
  V1KnowledgeBaseRuntimeFoundationStatus,
};

export type V1KnowledgeBaseRuntimeFoundationScope = {
  tenantId: string;
  institutionId: string;
  workspaceId: string;
};

export type V1KnowledgeBaseRuntimeFoundationCreateSourceInput =
  V1KnowledgeBaseRuntimeFoundationScope & {
    id: string;
    sourceKind: V1KnowledgeBaseRuntimeFoundationSourceKind;
    sourceLabel: string;
  };

export type V1KnowledgeBaseRuntimeFoundationCreateDocumentInput =
  V1KnowledgeBaseRuntimeFoundationScope & {
    id: string;
    sourceId: string;
    sourceKind: V1KnowledgeBaseRuntimeFoundationSourceKind;
    title: string;
    version: string;
  };

export type V1KnowledgeBaseRuntimeFoundationCreateChunkInput =
  V1KnowledgeBaseRuntimeFoundationScope & {
    id: string;
    documentId: string;
    sourceKind: V1KnowledgeBaseRuntimeFoundationSourceKind;
    chunkLabel: string;
    chunkIndex: number;
  };

export type V1KnowledgeBaseRuntimeFoundationCreateIndexJobInput =
  V1KnowledgeBaseRuntimeFoundationScope & {
    id: string;
    documentId: string;
    sourceKind: V1KnowledgeBaseRuntimeFoundationSourceKind;
    jobKind: string;
  };

export type V1KnowledgeBaseRuntimeFoundationCreateResult<Record> =
  | { status: 'created'; record: Record }
  | { status: 'rejected_non_demo_input' }
  | { status: 'validation_failed' };

const readonlyStatus = 'readonly' satisfies V1KnowledgeBaseRuntimeFoundationReadonlyStatus;
const readyStatus = 'ready' satisfies V1KnowledgeBaseRuntimeFoundationStatus;

function isAllowedSourceKind(
  sourceKind: unknown,
): sourceKind is V1KnowledgeBaseRuntimeFoundationSourceKind {
  return sourceKind === 'mock' || sourceKind === 'seed' || sourceKind === 'demo';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasValidScope(input: V1KnowledgeBaseRuntimeFoundationScope): boolean {
  return (
    isNonEmptyString(input.tenantId) &&
    isNonEmptyString(input.institutionId) &&
    isNonEmptyString(input.workspaceId)
  );
}

function rejectUnsafeInput(input: {
  sourceKind: unknown;
} & V1KnowledgeBaseRuntimeFoundationScope): 'rejected_non_demo_input' | 'validation_failed' | null {
  if (!isAllowedSourceKind(input.sourceKind)) {
    return 'rejected_non_demo_input';
  }

  if (!hasValidScope(input)) {
    return 'validation_failed';
  }

  return null;
}

function matchesScope(
  row: V1KnowledgeBaseRuntimeFoundationScope,
  scope: V1KnowledgeBaseRuntimeFoundationScope,
): boolean {
  return (
    row.tenantId === scope.tenantId &&
    row.institutionId === scope.institutionId &&
    row.workspaceId === scope.workspaceId
  );
}

function mapSourceRowToSummary(
  row: KnowledgeSourceRow,
): V1KnowledgeBaseRuntimeFoundationSourceSummary {
  return {
    sourceId: row.id,
    sourceKind: row.sourceKind,
    status: row.status,
    readonlyStatus: row.readonlyStatus,
    label: row.sourceLabel,
    readonly: true,
  };
}

function mapDocumentRowToSummary(
  row: KnowledgeDocumentRow,
): V1KnowledgeBaseRuntimeFoundationDocumentSummary {
  return {
    documentId: row.id,
    sourceId: row.sourceId,
    sourceKind: row.sourceKind,
    status: row.status,
    readonlyStatus: row.readonlyStatus,
    title: row.title,
    version: row.version,
    readonly: true,
  };
}

function mapChunkRowToSummary(row: KnowledgeChunkRow): V1KnowledgeBaseRuntimeFoundationChunkSummary {
  return {
    chunkId: row.id,
    documentId: row.documentId,
    sourceKind: row.sourceKind,
    status: row.status,
    readonlyStatus: row.readonlyStatus,
    label: row.chunkLabel,
    chunkIndex: row.chunkIndex,
    readonly: true,
  };
}

function mapIndexJobRowToSummary(
  row: KnowledgeIndexJobRow,
): V1KnowledgeBaseRuntimeFoundationIndexJobSummary {
  return {
    jobId: row.id,
    documentId: row.documentId,
    sourceKind: row.sourceKind,
    status: row.status,
    readonlyStatus: row.readonlyStatus,
    jobKind: row.jobKind,
    readonly: true,
  };
}

function readonlyActionsForSummary(input: {
  sourceCount: number;
  documentCount: number;
  chunkCount: number;
  indexJobCount: number;
}): string[] {
  if (
    input.sourceCount === 0 &&
    input.documentCount === 0 &&
    input.chunkCount === 0 &&
    input.indexJobCount === 0
  ) {
    return ['review_knowledge_base_foundation_readonly'];
  }

  return ['review_knowledge_base_foundation_readonly'];
}

export function mapKnowledgeBaseRuntimeFoundationRowsToReadonlySummary(input: {
  scope: V1KnowledgeBaseRuntimeFoundationScope;
  sources: readonly KnowledgeSourceRow[];
  documents: readonly KnowledgeDocumentRow[];
  chunks: readonly KnowledgeChunkRow[];
  indexJobs: readonly KnowledgeIndexJobRow[];
}): V1KnowledgeBaseRuntimeFoundationReadonlySummary {
  const sources = input.sources.filter((row) => matchesScope(row, input.scope));
  const documents = input.documents.filter((row) => matchesScope(row, input.scope));
  const chunks = input.chunks.filter((row) => matchesScope(row, input.scope));
  const indexJobs = input.indexJobs.filter((row) => matchesScope(row, input.scope));
  const sourceCount = sources.length;
  const documentCount = documents.length;
  const chunkCount = chunks.length;
  const indexJobCount = indexJobs.length;
  const status =
    sourceCount === 0 && documentCount === 0 && chunkCount === 0 && indexJobCount === 0
      ? 'empty'
      : 'ready';

  return {
    status,
    readonly: true,
    tenantId: input.scope.tenantId,
    institutionId: input.scope.institutionId,
    workspaceId: input.scope.workspaceId,
    sourceCount,
    documentCount,
    chunkCount,
    indexJobCount,
    sourceSummaries: sources.map(mapSourceRowToSummary),
    documentSummaries: documents.map(mapDocumentRowToSummary),
    chunkSummaries: chunks.map(mapChunkRowToSummary),
    indexJobSummaries: indexJobs.map(mapIndexJobRowToSummary),
    riskFlags: status === 'empty' ? ['knowledge_base_foundation_empty'] : [],
    recommendedReadonlyActions: readonlyActionsForSummary({
      sourceCount,
      documentCount,
      chunkCount,
      indexJobCount,
    }),
  };
}

export function createV1KnowledgeBaseRuntimeFoundationRepository(database: TenantDatabase) {
  return {
    async createDemoSource(
      input: V1KnowledgeBaseRuntimeFoundationCreateSourceInput,
    ): Promise<
      V1KnowledgeBaseRuntimeFoundationCreateResult<V1KnowledgeBaseRuntimeFoundationSourceSummary>
    > {
      const rejectedStatus = rejectUnsafeInput(input);
      if (rejectedStatus) return { status: rejectedStatus };

      if (!isNonEmptyString(input.id) || !isNonEmptyString(input.sourceLabel)) {
        return { status: 'validation_failed' };
      }

      const [row] = await database
        .insert(knowledgeSources)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          workspaceId: input.workspaceId,
          sourceKind: input.sourceKind,
          status: readyStatus,
          readonlyStatus,
          sourceLabel: input.sourceLabel,
        })
        .returning();

      return row
        ? { status: 'created', record: mapSourceRowToSummary(row) }
        : { status: 'validation_failed' };
    },

    async createDemoDocument(
      input: V1KnowledgeBaseRuntimeFoundationCreateDocumentInput,
    ): Promise<
      V1KnowledgeBaseRuntimeFoundationCreateResult<V1KnowledgeBaseRuntimeFoundationDocumentSummary>
    > {
      const rejectedStatus = rejectUnsafeInput(input);
      if (rejectedStatus) return { status: rejectedStatus };

      if (
        !isNonEmptyString(input.id) ||
        !isNonEmptyString(input.sourceId) ||
        !isNonEmptyString(input.title) ||
        !isNonEmptyString(input.version)
      ) {
        return { status: 'validation_failed' };
      }

      const [row] = await database
        .insert(knowledgeDocuments)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          workspaceId: input.workspaceId,
          sourceId: input.sourceId,
          sourceKind: input.sourceKind,
          status: readyStatus,
          readonlyStatus,
          title: input.title,
          version: input.version,
        })
        .returning();

      return row
        ? { status: 'created', record: mapDocumentRowToSummary(row) }
        : { status: 'validation_failed' };
    },

    async createDemoChunk(
      input: V1KnowledgeBaseRuntimeFoundationCreateChunkInput,
    ): Promise<
      V1KnowledgeBaseRuntimeFoundationCreateResult<V1KnowledgeBaseRuntimeFoundationChunkSummary>
    > {
      const rejectedStatus = rejectUnsafeInput(input);
      if (rejectedStatus) return { status: rejectedStatus };

      if (
        !isNonEmptyString(input.id) ||
        !isNonEmptyString(input.documentId) ||
        !isNonEmptyString(input.chunkLabel) ||
        !Number.isSafeInteger(input.chunkIndex) ||
        input.chunkIndex < 0
      ) {
        return { status: 'validation_failed' };
      }

      const [row] = await database
        .insert(knowledgeChunks)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          workspaceId: input.workspaceId,
          documentId: input.documentId,
          sourceKind: input.sourceKind,
          status: readyStatus,
          readonlyStatus,
          chunkLabel: input.chunkLabel,
          chunkIndex: input.chunkIndex,
        })
        .returning();

      return row
        ? { status: 'created', record: mapChunkRowToSummary(row) }
        : { status: 'validation_failed' };
    },

    async createDemoIndexJob(
      input: V1KnowledgeBaseRuntimeFoundationCreateIndexJobInput,
    ): Promise<
      V1KnowledgeBaseRuntimeFoundationCreateResult<V1KnowledgeBaseRuntimeFoundationIndexJobSummary>
    > {
      const rejectedStatus = rejectUnsafeInput(input);
      if (rejectedStatus) return { status: rejectedStatus };

      if (
        !isNonEmptyString(input.id) ||
        !isNonEmptyString(input.documentId) ||
        !isNonEmptyString(input.jobKind)
      ) {
        return { status: 'validation_failed' };
      }

      const [row] = await database
        .insert(knowledgeIndexJobs)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          workspaceId: input.workspaceId,
          documentId: input.documentId,
          sourceKind: input.sourceKind,
          status: readyStatus,
          readonlyStatus,
          jobKind: input.jobKind,
        })
        .returning();

      return row
        ? { status: 'created', record: mapIndexJobRowToSummary(row) }
        : { status: 'validation_failed' };
    },

    async listReadonlySummaries(
      scope: V1KnowledgeBaseRuntimeFoundationScope,
    ): Promise<V1KnowledgeBaseRuntimeFoundationReadonlySummary> {
      const sources = await database
        .select()
        .from(knowledgeSources)
        .where(
          and(
            eq(knowledgeSources.tenantId, scope.tenantId),
            eq(knowledgeSources.institutionId, scope.institutionId),
            eq(knowledgeSources.workspaceId, scope.workspaceId),
          ),
        )
        .orderBy(asc(knowledgeSources.id));
      const documents = await database
        .select()
        .from(knowledgeDocuments)
        .where(
          and(
            eq(knowledgeDocuments.tenantId, scope.tenantId),
            eq(knowledgeDocuments.institutionId, scope.institutionId),
            eq(knowledgeDocuments.workspaceId, scope.workspaceId),
          ),
        )
        .orderBy(asc(knowledgeDocuments.id));
      const chunks = await database
        .select()
        .from(knowledgeChunks)
        .where(
          and(
            eq(knowledgeChunks.tenantId, scope.tenantId),
            eq(knowledgeChunks.institutionId, scope.institutionId),
            eq(knowledgeChunks.workspaceId, scope.workspaceId),
          ),
        )
        .orderBy(asc(knowledgeChunks.id));
      const indexJobs = await database
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

      return mapKnowledgeBaseRuntimeFoundationRowsToReadonlySummary({
        scope,
        sources,
        documents,
        chunks,
        indexJobs,
      });
    },
  };
}

export type V1KnowledgeBaseRuntimeFoundationRepository = ReturnType<
  typeof createV1KnowledgeBaseRuntimeFoundationRepository
>;
