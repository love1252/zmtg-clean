import { createHash } from 'node:crypto';

import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { TenantDatabase } from '@/server/db/client';
import {
  knowledgeChunks,
  knowledgeDocumentFileParseChunkEmbeddings,
  knowledgeDocumentFileParseChunks,
  knowledgeDocumentFileParses,
  knowledgeDocumentFiles,
  knowledgeDocuments,
  knowledgeIndexJobs,
  knowledgeIndexingJobs,
  knowledgeQaAuditLogs,
  knowledgeSources,
  platformKnowledgeInstitutionVisibility,
  tenants,
} from '@/server/db/schema';
import type { KnowledgeIndexingJobRecord } from './platform-knowledge-indexing-job-service';
import type { PlatformKnowledgeFileRepositoryRecord } from './platform-knowledge-file-management-service';
import {
  PLATFORM_KNOWLEDGE_LIBRARY_WORKSPACE_ID,
  parsePlatformKnowledgeDirectoryId,
  type PlatformKnowledgeDirectorySourceDto,
  type PlatformKnowledgeFileDto,
} from './platformKnowledgeManagementApiContract';
import type {
  PlatformKnowledgeChunkEmbeddingSaveRecord,
  PlatformKnowledgeChunkEmbeddingSummary,
  PlatformKnowledgeEmbeddingCandidateRecord,
  PlatformKnowledgeVectorSearchCandidateRecord,
} from './platform-knowledge-embedding-vector-search-service';
import type { KnowledgeChunkSearchRepositoryRecord } from './platform-knowledge-keyword-search-service';
import type {
  KnowledgeQaAuditLogDto,
  KnowledgeQaAuditRecord,
} from './platform-knowledge-qa-service';
import type {
  PlatformKnowledgeFileParseChunkRecord,
  PlatformKnowledgeFileParseRecord,
  PlatformKnowledgeFileParseStatus,
} from './platform-knowledge-document-parsing-service';
import type {
  V1KnowledgeBaseRuntimeFoundationReadonlyStatus,
  V1KnowledgeBaseRuntimeFoundationSourceKind,
  V1KnowledgeBaseRuntimeFoundationStatus,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-runtime-foundation-api-contract';

type KnowledgeDocumentRow = typeof knowledgeDocuments.$inferSelect;
type KnowledgeSourceRow = typeof knowledgeSources.$inferSelect;
type KnowledgeChunkRow = typeof knowledgeChunks.$inferSelect;
type KnowledgeVisibilityRow = typeof platformKnowledgeInstitutionVisibility.$inferSelect;
type KnowledgeDocumentFileRow = typeof knowledgeDocumentFiles.$inferSelect;
type KnowledgeDocumentFileParseRow = typeof knowledgeDocumentFileParses.$inferSelect;
type KnowledgeDocumentFileParseChunkRow = typeof knowledgeDocumentFileParseChunks.$inferSelect;
type KnowledgeDocumentFileParseChunkEmbeddingRow =
  typeof knowledgeDocumentFileParseChunkEmbeddings.$inferSelect;
type KnowledgeIndexingJobRow = typeof knowledgeIndexingJobs.$inferSelect;
type KnowledgeQaAuditLogRow = typeof knowledgeQaAuditLogs.$inferSelect;
type TenantRow = typeof tenants.$inferSelect;

export type PlatformKnowledgeRepositoryRecord = {
  knowledgeId: string;
  tenantId: string;
  tenantName: string | null;
  institutionId: string;
  workspaceId: string;
  title: string;
  version: string;
  sourceKind: V1KnowledgeBaseRuntimeFoundationSourceKind;
  status: V1KnowledgeBaseRuntimeFoundationStatus;
  readonlyStatus: V1KnowledgeBaseRuntimeFoundationReadonlyStatus;
  category: string;
  descriptionPreview: string;
  chunkCount: number;
  visibleInstitutionIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type PlatformKnowledgeListRepositoryInput = {
  tenantId: string;
};

export type PlatformKnowledgeOverviewRepositoryInput = {
  tenantId?: string | null;
};

export type PlatformKnowledgeVisibilityRepositoryInput = {
  tenantId: string;
  knowledgeId: string;
  institutionId: string;
};

export type PlatformKnowledgeInstitutionScopeRepositoryInput = {
  tenantId: string;
  institutionId: string;
};

export type PlatformKnowledgeVisibilityRepositoryResult =
  | {
      status: 'bound' | 'unbound';
      tenantId: string;
      knowledgeId: string;
      visibleInstitutionIds: string[];
    }
  | { status: 'not_found' };

export type PlatformKnowledgeDirectoryRenameRepositoryInput = {
  tenantId: string;
  directoryId: string;
  nextName: string;
};

export type PlatformKnowledgeDirectoryRenameRepositoryResult =
  | {
      status: 'renamed';
      affectedSources: number;
      affectedDocuments: number;
      affectedChunks: number;
      affectedJobs: number;
    }
  | { status: 'not_found' };

export type PlatformKnowledgeDirectoryCreateRepositoryInput = {
  tenantId: string;
  name: string;
  parentId: string | null;
  libraryName: string;
  folderName: string | null;
};

export type PlatformKnowledgeDirectoryCreateRepositoryResult =
  | { status: 'created'; sourceId: string }
  | { status: 'not_found' };

export type PlatformKnowledgeDirectoryArchiveRepositoryResult =
  | { status: 'archived'; affectedSources: number }
  | { status: 'not_found' };

export type PlatformKnowledgeDirectoryReorderRepositoryInput = {
  tenantId: string;
  directoryIds: string[];
};

export type PlatformKnowledgeDirectoryReorderRepositoryResult =
  | { status: 'reordered'; affectedSources: number }
  | { status: 'not_found' };

function visibilityId(input: PlatformKnowledgeVisibilityRepositoryInput) {
  return `pkb-vis-${createHash('sha256')
    .update(`${input.tenantId}:${input.knowledgeId}:${input.institutionId}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function directorySourceId(input: {
  tenantId: string;
  libraryName: string;
  folderName: string | null;
}) {
  return `pkb-dir-src-${createHash('sha256')
    .update(`${input.tenantId}:${input.libraryName}:${input.folderName ?? PLATFORM_KNOWLEDGE_LIBRARY_WORKSPACE_ID}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function sourceCategory(sourceKind: V1KnowledgeBaseRuntimeFoundationSourceKind) {
  const labels: Record<V1KnowledgeBaseRuntimeFoundationSourceKind, string> = {
    demo: '演示知识',
    mock: '模拟知识',
    seed: '种子知识',
    institution_upload: '机构上传',
  };

  return labels[sourceKind];
}

function sourceDirectoryLabel(source: KnowledgeSourceRow | undefined, sourceKind: V1KnowledgeBaseRuntimeFoundationSourceKind) {
  const sourceLabel = source?.sourceLabel?.trim();

  return sourceLabel || sourceCategory(sourceKind);
}

function sourceDescription(row: {
  document: KnowledgeDocumentRow;
  source: KnowledgeSourceRow | undefined;
}) {
  const sourceLabel = row.source?.sourceLabel?.trim();
  if (sourceLabel) {
    return `${sourceLabel} · ${row.document.version}`;
  }

  return `${sourceCategory(row.document.sourceKind)} · ${row.document.version}`;
}

function mapRecords(input: {
  tenantId: string;
  tenantName: string | null;
  documents: KnowledgeDocumentRow[];
  sources: KnowledgeSourceRow[];
  chunks: KnowledgeChunkRow[];
  visibility: KnowledgeVisibilityRow[];
}): PlatformKnowledgeRepositoryRecord[] {
  const sourcesById = new Map(input.sources.map((source) => [source.id, source]));
  const chunkCountByDocumentId = new Map<string, number>();
  const visibleByDocumentId = new Map<string, string[]>();

  input.chunks.forEach((chunk) => {
    chunkCountByDocumentId.set(
      chunk.documentId,
      (chunkCountByDocumentId.get(chunk.documentId) ?? 0) + 1,
    );
  });
  input.visibility.forEach((visibility) => {
    const current = visibleByDocumentId.get(visibility.knowledgeDocumentId) ?? [];
    current.push(visibility.institutionId);
    visibleByDocumentId.set(visibility.knowledgeDocumentId, current);
  });

  return input.documents
    .filter((document) => document.tenantId === input.tenantId)
    .map((document) => {
      const source = sourcesById.get(document.sourceId);

      return {
        knowledgeId: document.id,
        tenantId: document.tenantId,
        tenantName: input.tenantName,
        institutionId: document.institutionId,
        workspaceId: document.workspaceId,
        title: document.title,
        version: document.version,
        sourceKind: document.sourceKind,
        status: document.status,
        readonlyStatus: document.readonlyStatus,
        category: sourceDirectoryLabel(source, document.sourceKind),
        descriptionPreview: sourceDescription({ document, source }),
        chunkCount: chunkCountByDocumentId.get(document.id) ?? 0,
        visibleInstitutionIds: visibleByDocumentId.get(document.id) ?? [],
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      };
    });
}

function normalizeParseStatus(status: string): PlatformKnowledgeFileParseStatus {
  if (status === 'processing' || status === 'succeeded' || status === 'failed') return status;
  return 'pending';
}

function normalizeOverviewParseStatus(status: string | undefined): PlatformKnowledgeFileDto['parseStatus'] {
  if (status === 'succeeded') return 'parsed';
  if (status === 'processing') return 'parsing';
  if (status === 'failed') return 'failed';
  return 'pending';
}

function overviewTaskStatus(
  status: PlatformKnowledgeFileDto['parseStatus'],
): PlatformKnowledgeFileDto['taskStatus'] {
  if (status === 'parsed') return 'completed';
  if (status === 'parsing') return 'running';
  if (status === 'failed') return 'failed';
  return 'pending';
}

function fileTypeLabel(input: { filename: string; mimeType: string }) {
  const lowerName = input.filename.toLowerCase();
  if (input.mimeType.includes('pdf') || lowerName.endsWith('.pdf')) return 'PDF';
  if (input.mimeType.includes('word') || lowerName.endsWith('.docx')) return 'Word';
  if (input.mimeType.includes('spreadsheet') || lowerName.endsWith('.xlsx')) return 'Excel';
  if (input.mimeType.includes('csv') || lowerName.endsWith('.csv')) return 'CSV';
  if (lowerName.endsWith('.md')) return 'Markdown';
  if (input.mimeType.includes('text') || lowerName.endsWith('.txt')) return 'TXT';
  if (input.mimeType.includes('image')) return '图片';
  return '文件';
}

function mapOverviewFileRow(input: {
  file: KnowledgeDocumentFileRow;
  parse: KnowledgeDocumentFileParseRow | undefined;
  document: KnowledgeDocumentRow | undefined;
  source: KnowledgeSourceRow | undefined;
  tenant: TenantRow | undefined;
}): PlatformKnowledgeFileDto {
  const parseStatus = normalizeOverviewParseStatus(input.parse?.parseStatus);
  const updatedAt = (input.parse?.updatedAt ?? input.file.updatedAt).toISOString();

  return {
    fileId: input.file.id,
    taskId: input.parse?.id ?? input.file.id,
    tenantId: input.file.tenantId,
    tenantName: input.tenant?.name ?? '未命名机构',
    knowledgeId: input.file.knowledgeDocumentId,
    fileName: input.file.originalFilename,
    mimeType: input.file.mimeType,
    fileType: fileTypeLabel({
      filename: input.file.originalFilename,
      mimeType: input.file.mimeType,
    }),
    fileSizeKb: Math.ceil(input.file.sizeBytes / 1024),
    category: input.document ? sourceDirectoryLabel(input.source, input.document.sourceKind) : '未分类',
    folder: input.source?.workspaceId ?? input.document?.workspaceId ?? '未归档',
    parseStatus,
    taskStatus: overviewTaskStatus(parseStatus),
    parsedChars: input.parse?.textLength ?? 0,
    safeErrorMessage: input.parse?.safeFailureMessage ?? null,
    failureReasonCode: input.parse?.failureReasonCode ?? null,
    ocrStatus: ocrStatusFromFailureReason(input.parse?.failureReasonCode),
    chunkCount: input.parse?.chunkCount ?? 0,
    createdAt: input.file.createdAt.toISOString(),
    updatedAt,
  };
}

function mapFileParseRow(row: KnowledgeDocumentFileParseRow): PlatformKnowledgeFileParseRecord {
  return {
    parseId: row.id,
    tenantId: row.tenantId,
    knowledgeId: row.knowledgeDocumentId,
    fileId: row.fileId,
    parseStatus: normalizeParseStatus(row.parseStatus),
    failureReasonCode: row.failureReasonCode,
    safeFailureMessage: row.safeFailureMessage,
    textContent: row.textContent,
    textLength: row.textLength,
    chunkCount: row.chunkCount,
    parserVersion: row.parserVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapFileParseChunkRow(row: KnowledgeDocumentFileParseChunkRow): PlatformKnowledgeFileParseChunkRecord {
  return {
    chunkId: row.id,
    tenantId: row.tenantId,
    knowledgeId: row.knowledgeDocumentId,
    fileId: row.fileId,
    chunkIndex: row.chunkIndex,
    textPreview: row.textPreview,
    charCount: row.charCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapFileParseChunkSearchRecord(input: {
  chunk: KnowledgeDocumentFileParseChunkRow;
  parse: KnowledgeDocumentFileParseRow | undefined;
  file: KnowledgeDocumentFileRow | undefined;
  document: KnowledgeDocumentRow | undefined;
}): KnowledgeChunkSearchRepositoryRecord | null {
  if (!input.file || !input.parse || !input.document) return null;

  return {
    tenantId: input.chunk.tenantId,
    knowledgeId: input.chunk.knowledgeDocumentId,
    knowledgeTitle: input.document.title,
    fileId: input.chunk.fileId,
    fileName: input.file.originalFilename,
    fileStatus: input.file.status === 'archived' ? 'archived' : 'active',
    parseStatus: normalizeParseStatus(input.parse.parseStatus),
    chunkId: input.chunk.id,
    chunkIndex: input.chunk.chunkIndex,
    textPreview: input.chunk.textPreview,
  };
}

function mapFileParseChunkEmbeddingCandidate(input: {
  chunk: KnowledgeDocumentFileParseChunkRow;
  parse: KnowledgeDocumentFileParseRow | undefined;
  file: KnowledgeDocumentFileRow | undefined;
  document: KnowledgeDocumentRow | undefined;
}): PlatformKnowledgeEmbeddingCandidateRecord | null {
  const searchRecord = mapFileParseChunkSearchRecord(input);
  return searchRecord;
}

function mapChunkEmbeddingSummary(
  row: KnowledgeDocumentFileParseChunkEmbeddingRow,
): PlatformKnowledgeChunkEmbeddingSummary {
  return {
    embeddingId: row.id,
    tenantId: row.tenantId,
    knowledgeId: row.knowledgeDocumentId,
    fileId: row.fileId,
    chunkId: row.chunkId,
    embeddingDimensions: row.embeddingDimensions,
    status: row.status === 'ready' ? 'ready' : 'failed',
    failureReasonCode: row.failureReasonCode,
  };
}

function mapVectorSearchCandidate(input: {
  candidate: PlatformKnowledgeEmbeddingCandidateRecord | undefined;
  embedding: KnowledgeDocumentFileParseChunkEmbeddingRow;
}): PlatformKnowledgeVectorSearchCandidateRecord | null {
  if (!input.candidate) return null;

  return {
    ...input.candidate,
    embeddingId: input.embedding.id,
    embeddingProvider: input.embedding.embeddingProvider,
    embeddingModel: input.embedding.embeddingModel,
    embeddingDimensions: input.embedding.embeddingDimensions,
    embeddingVectorJson: input.embedding.embeddingVectorJson,
    embeddingStatus: input.embedding.status === 'ready' ? 'ready' : 'failed',
  };
}

function normalizeQaActorScope(scope: string): KnowledgeQaAuditLogDto['actorScope'] {
  return scope === 'platform' ? 'platform' : 'institution';
}

function normalizeQaRetrievalMode(mode: string): KnowledgeQaAuditLogDto['retrievalMode'] {
  if (mode === 'keyword' || mode === 'vector' || mode === 'hybrid') return mode;
  return 'hybrid';
}

function mapQaAuditLogRow(row: KnowledgeQaAuditLogRow): KnowledgeQaAuditLogDto {
  return {
    auditId: row.id,
    tenantId: row.tenantId,
    institutionId: row.institutionId,
    actorScope: normalizeQaActorScope(row.actorScope),
    actorUserId: row.actorUserId,
    question: row.question,
    answerPreview: row.answerPreview,
    retrievalMode: normalizeQaRetrievalMode(row.retrievalMode),
    citationCount: row.citationCount,
    safeStatus: row.safeStatus,
    safeFailureMessage: row.safeFailureMessage,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapIndexingJobRow(row: KnowledgeIndexingJobRow): KnowledgeIndexingJobRecord {
  return {
    jobId: row.jobId,
    tenantId: row.tenantId,
    institutionId: row.institutionId,
    actorUserId: row.actorUserId,
    knowledgeId: row.knowledgeId,
    fileId: row.fileId,
    jobType: row.jobType,
    status: row.status,
    totalCount: row.totalCount,
    processedCount: row.processedCount,
    failedCount: row.failedCount,
    failureReasonCode: row.failureReasonCode,
    safeMessage: row.safeMessage,
    metadataJson: row.metadataJson ?? {},
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function ocrStatusFromFailureReason(value: string | null | undefined): PlatformKnowledgeFileDto['ocrStatus'] {
  if (!value?.startsWith('ocr_')) return 'pending';
  if (value === 'ocr_required') return 'ocr_required';
  if (value === 'ocr_unsupported_file_type') return 'unsupported';
  return 'failed';
}

function mapFileRow(
  row: KnowledgeDocumentFileRow,
  parse?: KnowledgeDocumentFileParseRow,
): PlatformKnowledgeFileRepositoryRecord {
  return {
    fileId: row.id,
    tenantId: row.tenantId,
    knowledgeId: row.knowledgeDocumentId,
    originalFilename: row.originalFilename,
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    status: row.status === 'archived' ? 'archived' : 'active',
    uploadedByUserId: row.uploadedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
    parseStatus: parse ? normalizeParseStatus(parse.parseStatus) : 'pending',
    failureReasonCode: parse?.failureReasonCode ?? null,
    safeFailureMessage: parse?.safeFailureMessage ?? null,
    textLength: parse?.textLength ?? 0,
    chunkCount: parse?.chunkCount ?? 0,
    parserVersion: parse?.parserVersion ?? null,
  };
}

export function createPlatformKnowledgeManagementRepository(database: TenantDatabase) {
  async function listEmbeddingCandidates(input: {
    tenantId: string;
    knowledgeId?: string;
    fileId?: string;
  }) {
    const chunkConditions = [
      eq(knowledgeDocumentFileParseChunks.tenantId, input.tenantId),
    ];
    if (input.knowledgeId) {
      chunkConditions.push(
        eq(knowledgeDocumentFileParseChunks.knowledgeDocumentId, input.knowledgeId),
      );
    }
    if (input.fileId) {
      chunkConditions.push(eq(knowledgeDocumentFileParseChunks.fileId, input.fileId));
    }

    const chunks = await database
      .select()
      .from(knowledgeDocumentFileParseChunks)
      .where(and(...chunkConditions))
      .orderBy(
        asc(knowledgeDocumentFileParseChunks.knowledgeDocumentId),
        asc(knowledgeDocumentFileParseChunks.fileId),
        asc(knowledgeDocumentFileParseChunks.chunkIndex),
      );
    if (chunks.length === 0) return [];

    const documents = await database
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.tenantId, input.tenantId));
    const files = await database
      .select()
      .from(knowledgeDocumentFiles)
      .where(eq(knowledgeDocumentFiles.tenantId, input.tenantId));
    const parses = await database
      .select()
      .from(knowledgeDocumentFileParses)
      .where(eq(knowledgeDocumentFileParses.tenantId, input.tenantId));
    const documentById = new Map(documents.map((document) => [document.id, document]));
    const fileById = new Map(files.map((file) => [file.id, file]));
    const parseByFileId = new Map(parses.map((parse) => [parse.fileId, parse]));

    return chunks.flatMap((chunk) => {
      const record = mapFileParseChunkEmbeddingCandidate({
        chunk,
        parse: parseByFileId.get(chunk.fileId),
        file: fileById.get(chunk.fileId),
        document: documentById.get(chunk.knowledgeDocumentId),
      });

      return record ? [record] : [];
    });
  }

  async function listVisibleInstitutionIds(input: { tenantId: string; knowledgeId: string }) {
    const rows = await database
      .select()
      .from(platformKnowledgeInstitutionVisibility)
      .where(
        and(
          eq(platformKnowledgeInstitutionVisibility.tenantId, input.tenantId),
          eq(platformKnowledgeInstitutionVisibility.knowledgeDocumentId, input.knowledgeId),
        ),
      );

    return rows.map((row) => row.institutionId);
  }

  async function findTenantKnowledgeDocument(input: { tenantId: string; knowledgeId: string }) {
    const rows = await database
      .select()
      .from(knowledgeDocuments)
      .where(
        and(
          eq(knowledgeDocuments.tenantId, input.tenantId),
          eq(knowledgeDocuments.id, input.knowledgeId),
        ),
      )
      .limit(1);

    return rows[0];
  }

  return {
    async listKnowledgeOverviewItems(
      input: PlatformKnowledgeOverviewRepositoryInput = {},
    ): Promise<PlatformKnowledgeRepositoryRecord[]> {
      const tenantId = input.tenantId?.trim() || null;
      const tenantRows = tenantId
        ? await database.select().from(tenants).where(eq(tenants.id, tenantId))
        : await database.select().from(tenants);
      const documents = tenantId
        ? await database
          .select()
          .from(knowledgeDocuments)
          .where(eq(knowledgeDocuments.tenantId, tenantId))
          .orderBy(desc(knowledgeDocuments.updatedAt), desc(knowledgeDocuments.id))
        : await database
          .select()
          .from(knowledgeDocuments)
          .orderBy(desc(knowledgeDocuments.updatedAt), desc(knowledgeDocuments.id));
      const sources = tenantId
        ? await database.select().from(knowledgeSources).where(eq(knowledgeSources.tenantId, tenantId))
        : await database.select().from(knowledgeSources);
      const chunks = tenantId
        ? await database.select().from(knowledgeChunks).where(eq(knowledgeChunks.tenantId, tenantId))
        : await database.select().from(knowledgeChunks);
      const visibility = tenantId
        ? await database
          .select()
          .from(platformKnowledgeInstitutionVisibility)
          .where(eq(platformKnowledgeInstitutionVisibility.tenantId, tenantId))
        : await database.select().from(platformKnowledgeInstitutionVisibility);

      return tenantRows.flatMap((tenant) =>
        mapRecords({
          tenantId: tenant.id,
          tenantName: tenant.name,
          documents,
          sources,
          chunks,
          visibility,
        }),
      );
    },

    async listKnowledgeOverviewFiles(
      input: PlatformKnowledgeOverviewRepositoryInput = {},
    ): Promise<PlatformKnowledgeFileDto[]> {
      const tenantId = input.tenantId?.trim() || null;
      const tenantRows = tenantId
        ? await database.select().from(tenants).where(eq(tenants.id, tenantId))
        : await database.select().from(tenants);
      const documents = tenantId
        ? await database.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.tenantId, tenantId))
        : await database.select().from(knowledgeDocuments);
      const sources = tenantId
        ? await database.select().from(knowledgeSources).where(eq(knowledgeSources.tenantId, tenantId))
        : await database.select().from(knowledgeSources);
      const files = tenantId
        ? await database
          .select()
          .from(knowledgeDocumentFiles)
          .where(eq(knowledgeDocumentFiles.tenantId, tenantId))
          .orderBy(desc(knowledgeDocumentFiles.updatedAt), desc(knowledgeDocumentFiles.id))
        : await database
          .select()
          .from(knowledgeDocumentFiles)
          .orderBy(desc(knowledgeDocumentFiles.updatedAt), desc(knowledgeDocumentFiles.id));
      const parses = tenantId
        ? await database
          .select()
          .from(knowledgeDocumentFileParses)
          .where(eq(knowledgeDocumentFileParses.tenantId, tenantId))
        : await database.select().from(knowledgeDocumentFileParses);
      const tenantById = new Map(tenantRows.map((tenant) => [tenant.id, tenant]));
      const documentById = new Map(documents.map((document) => [document.id, document]));
      const sourceById = new Map(sources.map((source) => [source.id, source]));
      const parseByFileId = new Map(parses.map((parse) => [parse.fileId, parse]));

      return files.map((file) => {
        const document = documentById.get(file.knowledgeDocumentId);
        return mapOverviewFileRow({
          file,
          parse: parseByFileId.get(file.id),
          document,
          source: document ? sourceById.get(document.sourceId) : undefined,
          tenant: tenantById.get(file.tenantId),
        });
      });
    },

    async listKnowledgeOverviewQaAudits(
      input: PlatformKnowledgeOverviewRepositoryInput = {},
    ): Promise<KnowledgeQaAuditLogDto[]> {
      const tenantId = input.tenantId?.trim() || null;
      const rows = tenantId
        ? await database
          .select()
          .from(knowledgeQaAuditLogs)
          .where(eq(knowledgeQaAuditLogs.tenantId, tenantId))
          .orderBy(desc(knowledgeQaAuditLogs.createdAt), desc(knowledgeQaAuditLogs.id))
          .limit(100)
        : await database
          .select()
          .from(knowledgeQaAuditLogs)
          .orderBy(desc(knowledgeQaAuditLogs.createdAt), desc(knowledgeQaAuditLogs.id))
          .limit(100);

      return rows.map(mapQaAuditLogRow);
    },

    async listKnowledgeDirectorySources(
      input: PlatformKnowledgeOverviewRepositoryInput = {},
    ): Promise<PlatformKnowledgeDirectorySourceDto[]> {
      const tenantId = input.tenantId?.trim() || null;
      const rows = tenantId
        ? await database
          .select()
          .from(knowledgeSources)
          .where(eq(knowledgeSources.tenantId, tenantId))
        : await database.select().from(knowledgeSources);

      return rows.map((source) => ({
        tenantId: source.tenantId,
        sourceLabel: source.sourceLabel,
        workspaceId: source.workspaceId,
        status: source.status,
        updatedAt: source.updatedAt,
      }));
    },

    async createKnowledgeDirectory(
      input: PlatformKnowledgeDirectoryCreateRepositoryInput,
    ): Promise<PlatformKnowledgeDirectoryCreateRepositoryResult> {
      const workspaceId = input.folderName ?? PLATFORM_KNOWLEDGE_LIBRARY_WORKSPACE_ID;
      const sourceId = directorySourceId({
        tenantId: input.tenantId,
        libraryName: input.libraryName,
        folderName: input.folderName,
      });
      const updatedAt = new Date();
      const existing = await database
        .select()
        .from(knowledgeSources)
        .where(
          and(
            eq(knowledgeSources.tenantId, input.tenantId),
            eq(knowledgeSources.id, sourceId),
          ),
        )
        .limit(1);

      if (existing[0]) {
        const restored = await database
          .update(knowledgeSources)
          .set({
            sourceLabel: input.libraryName,
            workspaceId,
            status: 'empty',
            readonlyStatus: 'readonly',
            updatedAt,
          })
          .where(
            and(
              eq(knowledgeSources.tenantId, input.tenantId),
              eq(knowledgeSources.id, sourceId),
            ),
          )
          .returning({ id: knowledgeSources.id });

        return restored[0] ? { status: 'created', sourceId: restored[0].id } : { status: 'not_found' };
      }

      const inserted = await database
        .insert(knowledgeSources)
        .values({
          id: sourceId,
          tenantId: input.tenantId,
          institutionId: 'platform-directory',
          workspaceId,
          sourceKind: 'mock',
          status: 'empty',
          readonlyStatus: 'readonly',
          sourceLabel: input.libraryName,
        })
        .returning({ id: knowledgeSources.id });

      return inserted[0] ? { status: 'created', sourceId: inserted[0].id } : { status: 'not_found' };
    },

    async archiveKnowledgeDirectory(input: {
      tenantId: string;
      directoryId: string;
    }): Promise<PlatformKnowledgeDirectoryArchiveRepositoryResult> {
      const parsed = parsePlatformKnowledgeDirectoryId(input.directoryId);
      if (!parsed.ok) return { status: 'not_found' };
      const archivedAt = new Date();
      const conditions = [
        eq(knowledgeSources.tenantId, input.tenantId),
      ];

      if (parsed.kind === 'knowledge_library') {
        conditions.push(
          eq(knowledgeSources.sourceLabel, parsed.libraryName),
          eq(knowledgeSources.workspaceId, PLATFORM_KNOWLEDGE_LIBRARY_WORKSPACE_ID),
        );
      } else {
        conditions.push(
          eq(knowledgeSources.sourceLabel, parsed.libraryName),
          eq(knowledgeSources.workspaceId, parsed.folderName),
        );
      }

      const updated = await database
        .update(knowledgeSources)
        .set({
          status: 'disabled',
          readonlyStatus: 'blocked',
          updatedAt: archivedAt,
        })
        .where(and(...conditions))
        .returning({ id: knowledgeSources.id });

      return updated.length > 0
        ? { status: 'archived', affectedSources: updated.length }
        : { status: 'not_found' };
    },

    async reorderKnowledgeDirectories(
      input: PlatformKnowledgeDirectoryReorderRepositoryInput,
    ): Promise<PlatformKnowledgeDirectoryReorderRepositoryResult> {
      let affectedSources = 0;
      const baseTime = Date.now();

      for (const [index, directoryId] of input.directoryIds.entries()) {
        const parsed = parsePlatformKnowledgeDirectoryId(directoryId);
        if (!parsed.ok) continue;

        const conditions = [
          eq(knowledgeSources.tenantId, input.tenantId),
        ];
        if (parsed.kind === 'knowledge_library') {
          conditions.push(eq(knowledgeSources.sourceLabel, parsed.libraryName));
        } else {
          conditions.push(
            eq(knowledgeSources.sourceLabel, parsed.libraryName),
            eq(knowledgeSources.workspaceId, parsed.folderName),
          );
        }

        const updated = await database
          .update(knowledgeSources)
          .set({
            updatedAt: new Date(baseTime + index),
          })
          .where(and(...conditions))
          .returning({ id: knowledgeSources.id });

        affectedSources += updated.length;
      }

      return affectedSources > 0
        ? { status: 'reordered', affectedSources }
        : { status: 'not_found' };
    },

    async listKnowledgeItems(
      input: PlatformKnowledgeListRepositoryInput,
    ): Promise<PlatformKnowledgeRepositoryRecord[]> {
      const tenantRows = await database
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);
      const documents = await database
        .select()
        .from(knowledgeDocuments)
        .where(eq(knowledgeDocuments.tenantId, input.tenantId))
        .orderBy(desc(knowledgeDocuments.updatedAt), desc(knowledgeDocuments.id));
      const sources = await database
        .select()
        .from(knowledgeSources)
        .where(eq(knowledgeSources.tenantId, input.tenantId));
      const chunks = await database
        .select()
        .from(knowledgeChunks)
        .where(eq(knowledgeChunks.tenantId, input.tenantId));
      const visibility = await database
        .select()
        .from(platformKnowledgeInstitutionVisibility)
        .where(eq(platformKnowledgeInstitutionVisibility.tenantId, input.tenantId));

      return mapRecords({
        tenantId: input.tenantId,
        tenantName: tenantRows[0]?.name ?? null,
        documents,
        sources,
        chunks,
        visibility,
      });
    },

    async findKnowledgeItem(input: { tenantId: string; knowledgeId: string }) {
      const records = await this.listKnowledgeItems({ tenantId: input.tenantId });
      return records.find((record) => record.knowledgeId === input.knowledgeId) ?? null;
    },

    async renameKnowledgeDirectory(
      input: PlatformKnowledgeDirectoryRenameRepositoryInput,
    ): Promise<PlatformKnowledgeDirectoryRenameRepositoryResult> {
      const parsed = parsePlatformKnowledgeDirectoryId(input.directoryId);
      if (!parsed.ok) return { status: 'not_found' };
      const updatedAt = new Date();

      if (parsed.kind === 'knowledge_library') {
        const updatedSources = await database
          .update(knowledgeSources)
          .set({
            sourceLabel: input.nextName,
            updatedAt,
          })
          .where(
            and(
              eq(knowledgeSources.tenantId, input.tenantId),
              eq(knowledgeSources.sourceLabel, parsed.libraryName),
            ),
          )
          .returning({ id: knowledgeSources.id });

        if (updatedSources.length === 0) return { status: 'not_found' };

        return {
          status: 'renamed',
          affectedSources: updatedSources.length,
          affectedDocuments: 0,
          affectedChunks: 0,
          affectedJobs: 0,
        };
      }

      const matchingSources = await database
        .select({ id: knowledgeSources.id })
        .from(knowledgeSources)
        .where(
          and(
            eq(knowledgeSources.tenantId, input.tenantId),
            eq(knowledgeSources.sourceLabel, parsed.libraryName),
            eq(knowledgeSources.workspaceId, parsed.folderName),
          ),
        );
      const sourceIds = matchingSources.map((source) => source.id);
      if (sourceIds.length === 0) return { status: 'not_found' };

      const updatedSources = await database
        .update(knowledgeSources)
        .set({
          workspaceId: input.nextName,
          updatedAt,
        })
        .where(
          and(
            eq(knowledgeSources.tenantId, input.tenantId),
            inArray(knowledgeSources.id, sourceIds),
          ),
        )
        .returning({ id: knowledgeSources.id });
      const updatedDocuments = await database
        .update(knowledgeDocuments)
        .set({
          workspaceId: input.nextName,
          updatedAt,
        })
        .where(
          and(
            eq(knowledgeDocuments.tenantId, input.tenantId),
            inArray(knowledgeDocuments.sourceId, sourceIds),
            eq(knowledgeDocuments.workspaceId, parsed.folderName),
          ),
        )
        .returning({ id: knowledgeDocuments.id });
      const documentIds = updatedDocuments.map((document) => document.id);
      const updatedChunks = documentIds.length > 0
        ? await database
          .update(knowledgeChunks)
          .set({
            workspaceId: input.nextName,
            updatedAt,
          })
          .where(
            and(
              eq(knowledgeChunks.tenantId, input.tenantId),
              inArray(knowledgeChunks.documentId, documentIds),
              eq(knowledgeChunks.workspaceId, parsed.folderName),
            ),
          )
          .returning({ id: knowledgeChunks.id })
        : [];
      const updatedJobs = documentIds.length > 0
        ? await database
          .update(knowledgeIndexJobs)
          .set({
            workspaceId: input.nextName,
            updatedAt,
          })
          .where(
            and(
              eq(knowledgeIndexJobs.tenantId, input.tenantId),
              inArray(knowledgeIndexJobs.documentId, documentIds),
              eq(knowledgeIndexJobs.workspaceId, parsed.folderName),
            ),
          )
          .returning({ id: knowledgeIndexJobs.id })
        : [];

      return {
        status: 'renamed',
        affectedSources: updatedSources.length,
        affectedDocuments: updatedDocuments.length,
        affectedChunks: updatedChunks.length,
        affectedJobs: updatedJobs.length,
      };
    },

    async listKnowledgeFiles(input: { tenantId: string; knowledgeId: string }) {
      const rows = await database
        .select()
        .from(knowledgeDocumentFiles)
        .where(
          and(
            eq(knowledgeDocumentFiles.tenantId, input.tenantId),
            eq(knowledgeDocumentFiles.knowledgeDocumentId, input.knowledgeId),
          ),
        )
        .orderBy(desc(knowledgeDocumentFiles.updatedAt), desc(knowledgeDocumentFiles.id));
      const parses = await database
        .select()
        .from(knowledgeDocumentFileParses)
        .where(
          and(
            eq(knowledgeDocumentFileParses.tenantId, input.tenantId),
            eq(knowledgeDocumentFileParses.knowledgeDocumentId, input.knowledgeId),
          ),
        );
      const parseByFileId = new Map(parses.map((parse) => [parse.fileId, parse]));

      return rows.map((row) => mapFileRow(row, parseByFileId.get(row.id)));
    },

    async findKnowledgeFile(input: { tenantId: string; knowledgeId: string; fileId: string }) {
      const rows = await database
        .select()
        .from(knowledgeDocumentFiles)
        .where(
          and(
            eq(knowledgeDocumentFiles.tenantId, input.tenantId),
            eq(knowledgeDocumentFiles.knowledgeDocumentId, input.knowledgeId),
            eq(knowledgeDocumentFiles.id, input.fileId),
          ),
        )
        .limit(1);
      if (!rows[0]) return null;
      const parses = await database
        .select()
        .from(knowledgeDocumentFileParses)
        .where(
          and(
            eq(knowledgeDocumentFileParses.tenantId, input.tenantId),
            eq(knowledgeDocumentFileParses.knowledgeDocumentId, input.knowledgeId),
            eq(knowledgeDocumentFileParses.fileId, input.fileId),
          ),
        )
        .limit(1);

      return mapFileRow(rows[0], parses[0]);
    },

    async createKnowledgeFile(input: PlatformKnowledgeFileRepositoryRecord) {
      const row = {
        id: input.fileId,
        tenantId: input.tenantId,
        knowledgeDocumentId: input.knowledgeId,
        originalFilename: input.originalFilename,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        sha256: input.sha256,
        status: input.status,
        uploadedByUserId: input.uploadedByUserId,
        archivedAt: input.archivedAt,
      };
      const inserted = await database
        .insert(knowledgeDocumentFiles)
        .values(row)
        .returning();

      return mapFileRow(inserted[0]);
    },

    async archiveKnowledgeFile(input: { tenantId: string; knowledgeId: string; fileId: string }) {
      const archivedAt = new Date();
      const updated = await database
        .update(knowledgeDocumentFiles)
        .set({
          status: 'archived',
          archivedAt,
          updatedAt: archivedAt,
        })
        .where(
          and(
            eq(knowledgeDocumentFiles.tenantId, input.tenantId),
            eq(knowledgeDocumentFiles.knowledgeDocumentId, input.knowledgeId),
            eq(knowledgeDocumentFiles.id, input.fileId),
          ),
        )
        .returning();

      return updated[0] ? mapFileRow(updated[0]) : null;
    },

    async findKnowledgeFileParse(input: { tenantId: string; knowledgeId: string; fileId: string }) {
      const rows = await database
        .select()
        .from(knowledgeDocumentFileParses)
        .where(
          and(
            eq(knowledgeDocumentFileParses.tenantId, input.tenantId),
            eq(knowledgeDocumentFileParses.knowledgeDocumentId, input.knowledgeId),
            eq(knowledgeDocumentFileParses.fileId, input.fileId),
          ),
        )
        .limit(1);

      return rows[0] ? mapFileParseRow(rows[0]) : null;
    },

    async saveKnowledgeFileParseResult(input: PlatformKnowledgeFileParseRecord) {
      const row = {
        id: input.parseId,
        tenantId: input.tenantId,
        knowledgeDocumentId: input.knowledgeId,
        fileId: input.fileId,
        parseStatus: input.parseStatus,
        failureReasonCode: input.failureReasonCode,
        safeFailureMessage: input.safeFailureMessage,
        textContent: input.textContent,
        textLength: input.textLength,
        chunkCount: input.chunkCount,
        parserVersion: input.parserVersion,
        updatedAt: input.updatedAt,
      };
      const updated = await database
        .insert(knowledgeDocumentFileParses)
        .values(row)
        .onConflictDoUpdate({
          target: [
            knowledgeDocumentFileParses.tenantId,
            knowledgeDocumentFileParses.fileId,
          ],
          set: {
            parseStatus: input.parseStatus,
            failureReasonCode: input.failureReasonCode,
            safeFailureMessage: input.safeFailureMessage,
            textContent: input.textContent,
            textLength: input.textLength,
            chunkCount: input.chunkCount,
            parserVersion: input.parserVersion,
            updatedAt: input.updatedAt,
          },
        })
        .returning();

      return mapFileParseRow(updated[0]);
    },

    async replaceKnowledgeFileParseChunks(input: {
      tenantId: string;
      knowledgeId: string;
      fileId: string;
      chunks: PlatformKnowledgeFileParseChunkRecord[];
    }) {
      await database
        .delete(knowledgeDocumentFileParseChunks)
        .where(
          and(
            eq(knowledgeDocumentFileParseChunks.tenantId, input.tenantId),
            eq(knowledgeDocumentFileParseChunks.knowledgeDocumentId, input.knowledgeId),
            eq(knowledgeDocumentFileParseChunks.fileId, input.fileId),
          ),
        );
      if (input.chunks.length === 0) return [];

      const inserted = await database
        .insert(knowledgeDocumentFileParseChunks)
        .values(input.chunks.map((chunk) => ({
          id: chunk.chunkId,
          tenantId: chunk.tenantId,
          knowledgeDocumentId: chunk.knowledgeId,
          fileId: chunk.fileId,
          chunkIndex: chunk.chunkIndex,
          textPreview: chunk.textPreview,
          charCount: chunk.charCount,
        })))
        .returning();

      return inserted.map(mapFileParseChunkRow);
    },

    async listKnowledgeFileParseChunks(input: {
      tenantId: string;
      knowledgeId: string;
      fileId: string;
    }) {
      const rows = await database
        .select()
        .from(knowledgeDocumentFileParseChunks)
        .where(
          and(
            eq(knowledgeDocumentFileParseChunks.tenantId, input.tenantId),
            eq(knowledgeDocumentFileParseChunks.knowledgeDocumentId, input.knowledgeId),
            eq(knowledgeDocumentFileParseChunks.fileId, input.fileId),
          ),
        )
        .orderBy(asc(knowledgeDocumentFileParseChunks.chunkIndex));

      return rows.map(mapFileParseChunkRow);
    },

    async searchKnowledgeFileParseChunks(input: {
      tenantId: string;
      keyword: string;
      knowledgeId?: string;
      fileId?: string;
    }): Promise<KnowledgeChunkSearchRepositoryRecord[]> {
      const normalizedKeyword = input.keyword.trim().toLowerCase();
      if (!normalizedKeyword) return [];

      const chunkConditions = [
        eq(knowledgeDocumentFileParseChunks.tenantId, input.tenantId),
      ];
      if (input.knowledgeId) {
        chunkConditions.push(
          eq(knowledgeDocumentFileParseChunks.knowledgeDocumentId, input.knowledgeId),
        );
      }
      if (input.fileId) {
        chunkConditions.push(eq(knowledgeDocumentFileParseChunks.fileId, input.fileId));
      }

      const rows = await database
        .select()
        .from(knowledgeDocumentFileParseChunks)
        .where(and(...chunkConditions))
        .orderBy(
          asc(knowledgeDocumentFileParseChunks.knowledgeDocumentId),
          asc(knowledgeDocumentFileParseChunks.fileId),
          asc(knowledgeDocumentFileParseChunks.chunkIndex),
        );
      const matchedChunks = rows.filter((row) =>
        row.textPreview.toLowerCase().includes(normalizedKeyword),
      );
      if (matchedChunks.length === 0) return [];

      const documents = await database
        .select()
        .from(knowledgeDocuments)
        .where(eq(knowledgeDocuments.tenantId, input.tenantId));
      const files = await database
        .select()
        .from(knowledgeDocumentFiles)
        .where(eq(knowledgeDocumentFiles.tenantId, input.tenantId));
      const parses = await database
        .select()
        .from(knowledgeDocumentFileParses)
        .where(eq(knowledgeDocumentFileParses.tenantId, input.tenantId));
      const documentById = new Map(documents.map((document) => [document.id, document]));
      const fileById = new Map(files.map((file) => [file.id, file]));
      const parseByFileId = new Map(parses.map((parse) => [parse.fileId, parse]));

      return matchedChunks.flatMap((chunk) => {
        const record = mapFileParseChunkSearchRecord({
          chunk,
          parse: parseByFileId.get(chunk.fileId),
          file: fileById.get(chunk.fileId),
          document: documentById.get(chunk.knowledgeDocumentId),
        });

        return record ? [record] : [];
      });
    },

    async listKnowledgeEmbeddingCandidates(input: {
      tenantId: string;
      knowledgeId?: string;
      fileId?: string;
    }): Promise<PlatformKnowledgeEmbeddingCandidateRecord[]> {
      return listEmbeddingCandidates(input);
    },

    async saveKnowledgeChunkEmbeddings(
      records: PlatformKnowledgeChunkEmbeddingSaveRecord[],
    ): Promise<PlatformKnowledgeChunkEmbeddingSummary[]> {
      if (records.length === 0) return [];

      const inserted = await database
        .insert(knowledgeDocumentFileParseChunkEmbeddings)
        .values(records.map((record) => ({
          id: `kb-file-embedding-${createHash('sha256')
            .update(`${record.tenantId}:${record.chunkId}`)
            .digest('hex')
            .slice(0, 40)}`,
          tenantId: record.tenantId,
          knowledgeDocumentId: record.knowledgeId,
          fileId: record.fileId,
          chunkId: record.chunkId,
          embeddingProvider: record.embeddingProvider,
          embeddingModel: record.embeddingModel,
          embeddingDimensions: record.embeddingDimensions,
          embeddingVectorJson: record.embeddingVectorJson,
          status: record.status,
          failureReasonCode: record.failureReasonCode ?? null,
        })))
        .onConflictDoUpdate({
          target: [
            knowledgeDocumentFileParseChunkEmbeddings.tenantId,
            knowledgeDocumentFileParseChunkEmbeddings.chunkId,
          ],
          set: {
            embeddingProvider: sql`excluded.embedding_provider`,
            embeddingModel: sql`excluded.embedding_model`,
            embeddingDimensions: sql`excluded.embedding_dimensions`,
            embeddingVectorJson: sql`excluded.embedding_vector_json`,
            status: sql`excluded.status`,
            failureReasonCode: sql`excluded.failure_reason_code`,
            updatedAt: new Date(),
          },
        })
        .returning();

      return inserted.map(mapChunkEmbeddingSummary);
    },

    async listKnowledgeVectorSearchCandidates(input: {
      tenantId: string;
      knowledgeId?: string;
      fileId?: string;
    }): Promise<PlatformKnowledgeVectorSearchCandidateRecord[]> {
      const candidateRecords = await listEmbeddingCandidates(input);
      if (candidateRecords.length === 0) return [];

      const embeddingConditions = [
        eq(knowledgeDocumentFileParseChunkEmbeddings.tenantId, input.tenantId),
      ];
      if (input.knowledgeId) {
        embeddingConditions.push(
          eq(knowledgeDocumentFileParseChunkEmbeddings.knowledgeDocumentId, input.knowledgeId),
        );
      }
      if (input.fileId) {
        embeddingConditions.push(eq(knowledgeDocumentFileParseChunkEmbeddings.fileId, input.fileId));
      }
      const embeddings = await database
        .select()
        .from(knowledgeDocumentFileParseChunkEmbeddings)
        .where(and(...embeddingConditions));
      const candidateByChunkId = new Map(
        candidateRecords.map((candidate) => [candidate.chunkId, candidate]),
      );

      return embeddings.flatMap((embedding) => {
        const record = mapVectorSearchCandidate({
          candidate: candidateByChunkId.get(embedding.chunkId),
          embedding,
        });

        return record ? [record] : [];
      });
    },

    async countKnowledgeQaAuditLogsForDay(input: {
      tenantId: string;
      institutionId: string | null;
      since: Date;
    }) {
      const conditions = [
        eq(knowledgeQaAuditLogs.tenantId, input.tenantId),
        gte(knowledgeQaAuditLogs.createdAt, input.since),
      ];
      if (input.institutionId) {
        conditions.push(eq(knowledgeQaAuditLogs.institutionId, input.institutionId));
      }

      const rows = await database
        .select({ value: sql<number>`count(*)` })
        .from(knowledgeQaAuditLogs)
        .where(and(...conditions));

      return Number(rows[0]?.value ?? 0);
    },

    async listKnowledgeQaAuditLogs(input: {
      tenantId: string;
      institutionId?: string;
      page: number;
      pageSize: number;
    }) {
      const conditions = [eq(knowledgeQaAuditLogs.tenantId, input.tenantId)];
      if (input.institutionId) {
        conditions.push(eq(knowledgeQaAuditLogs.institutionId, input.institutionId));
      }

      const totalRows = await database
        .select({ value: sql<number>`count(*)` })
        .from(knowledgeQaAuditLogs)
        .where(and(...conditions));
      const total = Number(totalRows[0]?.value ?? 0);
      const pageCount = Math.ceil(total / input.pageSize);
      const page = pageCount > 0 ? Math.min(input.page, pageCount) : input.page;
      const records = await database
        .select()
        .from(knowledgeQaAuditLogs)
        .where(and(...conditions))
        .orderBy(desc(knowledgeQaAuditLogs.createdAt), desc(knowledgeQaAuditLogs.id))
        .limit(input.pageSize)
        .offset((page - 1) * input.pageSize);

      return {
        records: records.map(mapQaAuditLogRow),
        pageInfo: {
          page,
          pageSize: input.pageSize,
          total,
          pageCount,
          hasPreviousPage: total > 0 && page > 1,
          hasNextPage: pageCount > 0 && page < pageCount,
        },
      };
    },

    async createKnowledgeQaAuditLog(record: KnowledgeQaAuditRecord) {
      const inserted = await database
        .insert(knowledgeQaAuditLogs)
        .values({
          id: record.auditId,
          tenantId: record.tenantId,
          institutionId: record.institutionId,
          actorScope: record.actorScope,
          actorUserId: record.actorUserId,
          question: record.question,
          answerPreview: record.answerPreview,
          retrievalMode: record.retrievalMode,
          citationCount: record.citationCount,
          safeStatus: record.safeStatus,
          safeFailureMessage: record.safeFailureMessage,
          createdAt: record.createdAt,
        })
        .returning({ auditId: knowledgeQaAuditLogs.id });

      return { auditId: inserted[0]?.auditId ?? record.auditId };
    },

    async createKnowledgeIndexingJob(record: KnowledgeIndexingJobRecord) {
      const inserted = await database
        .insert(knowledgeIndexingJobs)
        .values({
          jobId: record.jobId,
          tenantId: record.tenantId,
          institutionId: record.institutionId,
          actorUserId: record.actorUserId,
          knowledgeId: record.knowledgeId,
          fileId: record.fileId,
          jobType: record.jobType,
          status: record.status,
          totalCount: record.totalCount,
          processedCount: record.processedCount,
          failedCount: record.failedCount,
          failureReasonCode: record.failureReasonCode,
          safeMessage: record.safeMessage,
          metadataJson: record.metadataJson,
          startedAt: record.startedAt,
          finishedAt: record.finishedAt,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })
        .returning();

      return mapIndexingJobRow(inserted[0]);
    },

    async updateKnowledgeIndexingJob(input: {
      tenantId: string;
      jobId: string;
      patch: Partial<Pick<
        KnowledgeIndexingJobRecord,
        | 'status'
        | 'totalCount'
        | 'processedCount'
        | 'failedCount'
        | 'failureReasonCode'
        | 'safeMessage'
        | 'metadataJson'
        | 'startedAt'
        | 'finishedAt'
        | 'updatedAt'
      >>;
    }) {
      const updated = await database
        .update(knowledgeIndexingJobs)
        .set(input.patch)
        .where(
          and(
            eq(knowledgeIndexingJobs.tenantId, input.tenantId),
            eq(knowledgeIndexingJobs.jobId, input.jobId),
          ),
        )
        .returning();

      return updated[0] ? mapIndexingJobRow(updated[0]) : null;
    },

    async findKnowledgeIndexingJob(input: { tenantId: string; jobId: string }) {
      const rows = await database
        .select()
        .from(knowledgeIndexingJobs)
        .where(
          and(
            eq(knowledgeIndexingJobs.tenantId, input.tenantId),
            eq(knowledgeIndexingJobs.jobId, input.jobId),
          ),
        )
        .limit(1);

      return rows[0] ? mapIndexingJobRow(rows[0]) : null;
    },

    async listKnowledgeIndexingJobs(input: {
      tenantId: string;
      institutionId?: string | null;
      limit?: number;
    }) {
      const conditions = [eq(knowledgeIndexingJobs.tenantId, input.tenantId)];
      if (input.institutionId) {
        conditions.push(eq(knowledgeIndexingJobs.institutionId, input.institutionId));
      }

      const rows = await database
        .select()
        .from(knowledgeIndexingJobs)
        .where(and(...conditions))
        .orderBy(desc(knowledgeIndexingJobs.createdAt), desc(knowledgeIndexingJobs.jobId))
        .limit(input.limit ?? 20);

      return rows.map(mapIndexingJobRow);
    },

    async hasTenantInstitution(
      input: PlatformKnowledgeInstitutionScopeRepositoryInput,
    ): Promise<boolean> {
      const rows = await database
        .select({ id: knowledgeSources.id })
        .from(knowledgeSources)
        .where(
          and(
            eq(knowledgeSources.tenantId, input.tenantId),
            eq(knowledgeSources.institutionId, input.institutionId),
          ),
        )
        .limit(1);

      return rows.length > 0;
    },

    async bindInstitutionVisibility(
      input: PlatformKnowledgeVisibilityRepositoryInput,
    ): Promise<PlatformKnowledgeVisibilityRepositoryResult> {
      const document = await findTenantKnowledgeDocument(input);
      if (!document) return { status: 'not_found' };

      await database
        .insert(platformKnowledgeInstitutionVisibility)
        .values({
          id: visibilityId(input),
          tenantId: input.tenantId,
          knowledgeDocumentId: input.knowledgeId,
          institutionId: input.institutionId,
        })
        .onConflictDoNothing({
          target: [
            platformKnowledgeInstitutionVisibility.tenantId,
            platformKnowledgeInstitutionVisibility.knowledgeDocumentId,
            platformKnowledgeInstitutionVisibility.institutionId,
          ],
        });

      return {
        status: 'bound',
        tenantId: input.tenantId,
        knowledgeId: input.knowledgeId,
        visibleInstitutionIds: await listVisibleInstitutionIds(input),
      };
    },

    async unbindInstitutionVisibility(
      input: PlatformKnowledgeVisibilityRepositoryInput,
    ): Promise<PlatformKnowledgeVisibilityRepositoryResult> {
      const document = await findTenantKnowledgeDocument(input);
      if (!document) return { status: 'not_found' };

      await database
        .delete(platformKnowledgeInstitutionVisibility)
        .where(
          and(
            eq(platformKnowledgeInstitutionVisibility.tenantId, input.tenantId),
            eq(platformKnowledgeInstitutionVisibility.knowledgeDocumentId, input.knowledgeId),
            eq(platformKnowledgeInstitutionVisibility.institutionId, input.institutionId),
          ),
        );

      return {
        status: 'unbound',
        tenantId: input.tenantId,
        knowledgeId: input.knowledgeId,
        visibleInstitutionIds: await listVisibleInstitutionIds(input),
      };
    },

  };
}

export type PlatformKnowledgeManagementRepository = ReturnType<
  typeof createPlatformKnowledgeManagementRepository
>;
