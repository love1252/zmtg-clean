import { createHash } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import type { TenantDatabase } from '@/server/db/client';
import {
  knowledgeChunks,
  knowledgeDocumentFiles,
  knowledgeDocuments,
  knowledgeSources,
  platformKnowledgeInstitutionVisibility,
  tenants,
} from '@/server/db/schema';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';

function institutionWriteId(prefix: string, parts: string[]) {
  return `${prefix}-${createHash('sha256')
    .update([...parts, String(Date.now())].join(':'))
    .digest('hex')
    .slice(0, 40)}`;
}

function sourceCategory(sourceKind: PlatformKnowledgeRepositoryRecord['sourceKind']) {
  const labels: Record<PlatformKnowledgeRepositoryRecord['sourceKind'], string> = {
    demo: '演示知识',
    mock: '模拟知识',
    seed: '种子知识',
  };

  return labels[sourceKind];
}

function sourceDirectoryLabel(input: {
  sourceLabel?: string | null;
  sourceKind: PlatformKnowledgeRepositoryRecord['sourceKind'];
}) {
  const sourceLabel = input.sourceLabel?.trim();
  return sourceLabel || sourceCategory(input.sourceKind);
}

function sourceDescription(input: {
  sourceLabel?: string | null;
  version: string;
  sourceKind: PlatformKnowledgeRepositoryRecord['sourceKind'];
}) {
  const sourceLabel = input.sourceLabel?.trim();
  if (sourceLabel) return `${sourceLabel} · ${input.version}`;
  return `${sourceCategory(input.sourceKind)} · ${input.version}`;
}

export function createInstitutionKnowledgeWriteRepository(database: TenantDatabase) {
  async function findKnowledgeItem(input: {
    tenantId: string;
    knowledgeId: string;
  }): Promise<PlatformKnowledgeRepositoryRecord | null> {
    const documents = await database
      .select()
      .from(knowledgeDocuments)
      .where(
        and(
          eq(knowledgeDocuments.tenantId, input.tenantId),
          eq(knowledgeDocuments.id, input.knowledgeId),
        ),
      )
      .limit(1);
    const document = documents[0];
    if (!document) return null;

    const tenantRows = await database
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, input.tenantId))
      .limit(1);
    const sourceRows = await database
      .select()
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.tenantId, input.tenantId),
          eq(knowledgeSources.id, document.sourceId),
        ),
      )
      .limit(1);
    const chunkRows = await database
      .select({ id: knowledgeChunks.id })
      .from(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.tenantId, input.tenantId),
          eq(knowledgeChunks.documentId, input.knowledgeId),
        ),
      );
    const visibilityRows = await database
      .select({ institutionId: platformKnowledgeInstitutionVisibility.institutionId })
      .from(platformKnowledgeInstitutionVisibility)
      .where(
        and(
          eq(platformKnowledgeInstitutionVisibility.tenantId, input.tenantId),
          eq(platformKnowledgeInstitutionVisibility.knowledgeDocumentId, input.knowledgeId),
        ),
      );
    const source = sourceRows[0];

    return {
      knowledgeId: document.id,
      tenantId: document.tenantId,
      tenantName: tenantRows[0]?.name ?? null,
      institutionId: document.institutionId,
      workspaceId: document.workspaceId,
      title: document.title,
      version: document.version,
      sourceKind: document.sourceKind,
      status: document.status,
      readonlyStatus: document.readonlyStatus,
      category: sourceDirectoryLabel({
        sourceLabel: source?.sourceLabel,
        sourceKind: document.sourceKind,
      }),
      descriptionPreview: sourceDescription({
        sourceLabel: source?.sourceLabel,
        version: document.version,
        sourceKind: document.sourceKind,
      }),
      chunkCount: chunkRows.length,
      visibleInstitutionIds: visibilityRows.map((row) => row.institutionId),
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  return {
    findKnowledgeItem,

    async createInstitutionKnowledgeSource(input: {
      tenantId: string;
      institutionId: string;
      sourceLabel: string;
    }) {
      const sourceId = institutionWriteId('inst-src', [
        input.tenantId,
        input.institutionId,
        input.sourceLabel,
      ]);
      await database.insert(knowledgeSources).values({
        id: sourceId,
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        workspaceId: input.institutionId,
        sourceKind: 'seed',
        status: 'ready',
        readonlyStatus: 'readonly',
        sourceLabel: input.sourceLabel,
      });

      return { sourceId };
    },

    async createInstitutionKnowledgeDocument(input: {
      tenantId: string;
      institutionId: string;
      sourceId: string;
      title: string;
      description?: string | null;
    }) {
      const documentId = institutionWriteId('inst-doc', [
        input.tenantId,
        input.institutionId,
        input.title,
      ]);
      await database.insert(knowledgeDocuments).values({
        id: documentId,
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        workspaceId: input.institutionId,
        sourceId: input.sourceId,
        sourceKind: 'seed',
        status: 'ready',
        readonlyStatus: 'readonly',
        title: input.title,
        version: input.description?.trim() || 'v1',
      });
      await database.insert(platformKnowledgeInstitutionVisibility).values({
        id: institutionWriteId('inst-vis', [input.tenantId, documentId, input.institutionId]),
        tenantId: input.tenantId,
        knowledgeDocumentId: documentId,
        institutionId: input.institutionId,
      }).onConflictDoNothing();

      return { documentId };
    },

    async updateInstitutionKnowledgeDocument(input: {
      tenantId: string;
      institutionId: string;
      knowledgeId: string;
      title: string;
      category: string;
      description: string;
    }) {
      const documents = await database
        .select()
        .from(knowledgeDocuments)
        .where(
          and(
            eq(knowledgeDocuments.tenantId, input.tenantId),
            eq(knowledgeDocuments.id, input.knowledgeId),
          ),
        )
        .limit(1);
      const document = documents[0];
      if (!document || document.institutionId !== input.institutionId) {
        return { status: 'not_found' as const };
      }
      const updatedAt = new Date();

      await database
        .update(knowledgeSources)
        .set({ sourceLabel: input.category, updatedAt })
        .where(
          and(
            eq(knowledgeSources.tenantId, input.tenantId),
            eq(knowledgeSources.id, document.sourceId),
            eq(knowledgeSources.institutionId, input.institutionId),
          ),
        );
      await database
        .update(knowledgeDocuments)
        .set({ title: input.title, version: input.description, updatedAt })
        .where(
          and(
            eq(knowledgeDocuments.tenantId, input.tenantId),
            eq(knowledgeDocuments.id, input.knowledgeId),
            eq(knowledgeDocuments.institutionId, input.institutionId),
          ),
        );

      const record = await findKnowledgeItem({ tenantId: input.tenantId, knowledgeId: input.knowledgeId });
      return record ? { status: 'updated' as const, record } : { status: 'not_found' as const };
    },

    async archiveInstitutionKnowledgeDocument(input: {
      tenantId: string;
      institutionId: string;
      knowledgeId: string;
    }) {
      const documents = await database
        .select()
        .from(knowledgeDocuments)
        .where(
          and(
            eq(knowledgeDocuments.tenantId, input.tenantId),
            eq(knowledgeDocuments.id, input.knowledgeId),
          ),
        )
        .limit(1);
      const document = documents[0];
      if (!document || document.institutionId !== input.institutionId) {
        return { status: 'not_found' as const };
      }
      const archivedAt = new Date();

      await database
        .update(knowledgeDocuments)
        .set({ status: 'disabled', readonlyStatus: 'blocked', updatedAt: archivedAt })
        .where(
          and(
            eq(knowledgeDocuments.tenantId, input.tenantId),
            eq(knowledgeDocuments.id, input.knowledgeId),
            eq(knowledgeDocuments.institutionId, input.institutionId),
          ),
        );
      await database
        .update(knowledgeSources)
        .set({ status: 'disabled', readonlyStatus: 'blocked', updatedAt: archivedAt })
        .where(
          and(
            eq(knowledgeSources.tenantId, input.tenantId),
            eq(knowledgeSources.id, document.sourceId),
            eq(knowledgeSources.institutionId, input.institutionId),
          ),
        );
      await database
        .update(knowledgeDocumentFiles)
        .set({ status: 'archived', archivedAt, updatedAt: archivedAt })
        .where(
          and(
            eq(knowledgeDocumentFiles.tenantId, input.tenantId),
            eq(knowledgeDocumentFiles.knowledgeDocumentId, input.knowledgeId),
          ),
        );

      const record = await findKnowledgeItem({ tenantId: input.tenantId, knowledgeId: input.knowledgeId });
      return record ? { status: 'archived' as const, record } : { status: 'not_found' as const };
    },
  };
}

export type InstitutionKnowledgeWriteRepository = ReturnType<
  typeof createInstitutionKnowledgeWriteRepository
>;
