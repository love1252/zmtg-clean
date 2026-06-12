import { NextResponse } from 'next/server';
import { buildV1KnowledgeBaseRuntimeFoundationApiResponse } from '@/modules/knowledge-base/domain/v1-knowledge-base-runtime-foundation-api-contract';
import { createV1KnowledgeBaseRuntimeFoundationRepository } from '@/modules/knowledge-base/server/v1-knowledge-base-runtime-foundation-repository';
import type { V1KnowledgeBaseUploadParseChunkRuntimeRepository } from '@/modules/knowledge-base/server/v1-knowledge-base-upload-parse-chunk-runtime';
import { getDatabase } from '@/server/db/client';

type DocumentsRouteDependencies = {
  repository?: Pick<V1KnowledgeBaseUploadParseChunkRuntimeRepository, 'listReadonlySummaries'>;
};

const defaultScope = {
  tenantId: 'demo-tenant-a',
  institutionId: 'demo-inst-a',
  workspaceId: 'demo-workspace-a',
};

function defaultRepository(): Pick<
  V1KnowledgeBaseUploadParseChunkRuntimeRepository,
  'listReadonlySummaries'
> {
  return createV1KnowledgeBaseRuntimeFoundationRepository(getDatabase());
}

function scopeFromRequest(request: Request) {
  const url = new URL(request.url);

  return {
    tenantId: url.searchParams.get('tenantId') ?? defaultScope.tenantId,
    institutionId: url.searchParams.get('institutionId') ?? defaultScope.institutionId,
    workspaceId: url.searchParams.get('workspaceId') ?? defaultScope.workspaceId,
  };
}

export async function GET(request: Request, dependencies: DocumentsRouteDependencies = {}) {
  const repository = dependencies.repository ?? defaultRepository();
  const summary = await repository.listReadonlySummaries(scopeFromRequest(request));
  const response = buildV1KnowledgeBaseRuntimeFoundationApiResponse({
    requestId: 'knowledge-base-runtime-documents-route-request',
    summary,
  });

  return NextResponse.json(response, { status: 200 });
}
