import { createHash } from 'node:crypto';

import { and, desc, eq } from 'drizzle-orm';
import type { TenantDatabase } from '@/server/db/client';
import {
  knowledgeChunks,
  knowledgeDocumentFiles,
  knowledgeDocuments,
  knowledgeSources,
  platformKnowledgeInstitutionVisibility,
  tenants,
} from '@/server/db/schema';
import type { PlatformKnowledgeFileRepositoryRecord } from './platform-knowledge-file-management-service';
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

function visibilityId(input: PlatformKnowledgeVisibilityRepositoryInput) {
  return `pkb-vis-${createHash('sha256')
    .update(`${input.tenantId}:${input.knowledgeId}:${input.institutionId}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function sourceCategory(sourceKind: V1KnowledgeBaseRuntimeFoundationSourceKind) {
  const labels: Record<V1KnowledgeBaseRuntimeFoundationSourceKind, string> = {
    demo: '演示知识',
    mock: '模拟知识',
    seed: '种子知识',
  };

  return labels[sourceKind];
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
        category: sourceCategory(document.sourceKind),
        descriptionPreview: sourceDescription({ document, source }),
        chunkCount: chunkCountByDocumentId.get(document.id) ?? 0,
        visibleInstitutionIds: visibleByDocumentId.get(document.id) ?? [],
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      };
    });
}

function mapFileRow(row: KnowledgeDocumentFileRow): PlatformKnowledgeFileRepositoryRecord {
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
  };
}

export function createPlatformKnowledgeManagementRepository(database: TenantDatabase) {
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

      return rows.map(mapFileRow);
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

      return rows[0] ? mapFileRow(rows[0]) : null;
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
