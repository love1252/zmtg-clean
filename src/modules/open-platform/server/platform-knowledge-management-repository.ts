import { createHash } from 'node:crypto';

import { and, desc, eq } from 'drizzle-orm';
import type { TenantDatabase } from '@/server/db/client';
import {
  knowledgeChunks,
  knowledgeDocuments,
  knowledgeSources,
  platformKnowledgeInstitutionVisibility,
  tenants,
} from '@/server/db/schema';
import type {
  V1KnowledgeBaseRuntimeFoundationReadonlyStatus,
  V1KnowledgeBaseRuntimeFoundationSourceKind,
  V1KnowledgeBaseRuntimeFoundationStatus,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-runtime-foundation-api-contract';

type KnowledgeDocumentRow = typeof knowledgeDocuments.$inferSelect;
type KnowledgeSourceRow = typeof knowledgeSources.$inferSelect;
type KnowledgeChunkRow = typeof knowledgeChunks.$inferSelect;
type KnowledgeVisibilityRow = typeof platformKnowledgeInstitutionVisibility.$inferSelect;

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
