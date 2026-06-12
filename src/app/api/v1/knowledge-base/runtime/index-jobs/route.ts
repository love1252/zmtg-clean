import { NextResponse } from 'next/server';
import {
  createV1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository,
  listV1KnowledgeBaseEmbeddingVectorIndexJobs,
  type V1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository,
} from '@/modules/knowledge-base/server/v1-knowledge-base-embedding-vector-index-runtime';
import { getDatabase } from '@/server/db/client';

type IndexJobsRouteDependencies = {
  repository?: Pick<V1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository, 'listIndexJobSummaries'>;
};

const defaultScope = {
  tenantId: 'demo-tenant-a',
  institutionId: 'demo-inst-a',
  workspaceId: 'demo-workspace-a',
};

function defaultRepository(): Pick<
  V1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository,
  'listIndexJobSummaries'
> {
  return createV1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository(getDatabase());
}

function scopeFromRequest(request: Request) {
  const url = new URL(request.url);

  return {
    tenantId: url.searchParams.get('tenantId') ?? defaultScope.tenantId,
    institutionId: url.searchParams.get('institutionId') ?? defaultScope.institutionId,
    workspaceId: url.searchParams.get('workspaceId') ?? defaultScope.workspaceId,
  };
}

export async function GET(request: Request, dependencies: IndexJobsRouteDependencies = {}) {
  const result = await listV1KnowledgeBaseEmbeddingVectorIndexJobs({
    repository: dependencies.repository ?? defaultRepository(),
    scope: scopeFromRequest(request),
  });

  return NextResponse.json(result, { status: 200 });
}
