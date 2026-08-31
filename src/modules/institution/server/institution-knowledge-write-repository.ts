import { and, eq } from 'drizzle-orm';
import type { TenantDatabase } from '@/server/db/client';
import {
  knowledgeChunks,
  knowledgeDocuments,
  knowledgeSources,
  platformKnowledgeInstitutionVisibility,
  tenants,
} from '@/server/db/schema';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';

function sourceCategory(sourceKind: PlatformKnowledgeRepositoryRecord['sourceKind']) {
  const labels: Record<PlatformKnowledgeRepositoryRecord['sourceKind'], string> = {
    demo: '演示知识',
    mock: '模拟知识',
    seed: '种子知识',
    institution_upload: '机构上传',
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

    async createInstitutionKnowledgeSource(_input: { tenantId: string; institutionId: string; sourceLabel: string }): Promise<{ sourceId: string }> { throw new Error('legacy_institution_knowledge_content_writer_disabled'); },

    async createInstitutionKnowledgeDocument(_input: { tenantId: string; institutionId: string; sourceId: string; title: string; description?: string | null }): Promise<{ documentId: string }> { throw new Error('legacy_institution_knowledge_content_writer_disabled'); },

    async updateInstitutionKnowledgeDocument(_input: { tenantId: string; institutionId: string; knowledgeId: string; title: string; category: string; description: string }): Promise<{ status: 'updated'; record: PlatformKnowledgeRepositoryRecord } | { status: 'not_found' }> { throw new Error('legacy_institution_knowledge_content_writer_disabled'); },

    async archiveInstitutionKnowledgeDocument(_input: { tenantId: string; institutionId: string; knowledgeId: string }): Promise<{ status: 'archived'; record: PlatformKnowledgeRepositoryRecord } | { status: 'not_found' }> { throw new Error('legacy_institution_knowledge_content_writer_disabled'); },
  };
}

export type InstitutionKnowledgeWriteRepository = ReturnType<
  typeof createInstitutionKnowledgeWriteRepository
>;
