import { NextResponse } from 'next/server';
import {
  createV1KnowledgeBaseSearchRuntimeRepository,
  searchV1KnowledgeBaseRuntime,
  type V1KnowledgeBaseSearchRuntimeRepository,
} from '@/modules/knowledge-base/server/v1-knowledge-base-search-runtime';
import { getDatabase } from '@/server/db/client';

type SearchRouteDependencies = {
  repository?: V1KnowledgeBaseSearchRuntimeRepository;
};

const defaultScope = {
  tenantId: 'demo-tenant-a',
  institutionId: 'demo-inst-a',
  workspaceId: 'demo-workspace-a',
};

function defaultRepository(): V1KnowledgeBaseSearchRuntimeRepository {
  return createV1KnowledgeBaseSearchRuntimeRepository(getDatabase());
}

function searchInputFromRequest(request: Request) {
  const url = new URL(request.url);

  return {
    tenantId: url.searchParams.get('tenantId') ?? defaultScope.tenantId,
    institutionId: url.searchParams.get('institutionId') ?? defaultScope.institutionId,
    workspaceId: url.searchParams.get('workspaceId') ?? defaultScope.workspaceId,
    query: url.searchParams.get('q') ?? '',
  };
}

export async function GET(request: Request, dependencies: SearchRouteDependencies = {}) {
  const result = await searchV1KnowledgeBaseRuntime({
    repository: dependencies.repository ?? defaultRepository(),
    input: searchInputFromRequest(request),
  });

  return NextResponse.json(result, {
    status: result.status === 'denied' ? 403 : 200,
  });
}
