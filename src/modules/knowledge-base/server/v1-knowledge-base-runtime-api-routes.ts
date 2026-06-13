import { NextResponse } from 'next/server';
import { buildV1KnowledgeBaseRuntimeFoundationApiResponse } from '@/modules/knowledge-base/domain/v1-knowledge-base-runtime-foundation-api-contract';
import { createV1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository, listV1KnowledgeBaseEmbeddingVectorIndexJobs, runV1KnowledgeBaseEmbeddingVectorIndexJob, type V1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository, type V1KnowledgeBaseEmbeddingVectorIndexRuntimeRunInput, type V1KnowledgeBaseEmbeddingVectorIndexRuntimeRunResult } from '@/modules/knowledge-base/server/v1-knowledge-base-embedding-vector-index-runtime';
import { createV1KnowledgeBaseRuntimeFoundationRepository } from '@/modules/knowledge-base/server/v1-knowledge-base-runtime-foundation-repository';
import { createV1KnowledgeBaseSearchRuntimeRepository, searchV1KnowledgeBaseRuntime, type V1KnowledgeBaseSearchRuntimeRepository } from '@/modules/knowledge-base/server/v1-knowledge-base-search-runtime';
import { uploadV1KnowledgeBaseRuntimeDocumentService, type V1KnowledgeBaseUploadParseChunkRuntimeInput, type V1KnowledgeBaseUploadParseChunkRuntimeRepository, type V1KnowledgeBaseUploadParseChunkRuntimeResponse } from '@/modules/knowledge-base/server/v1-knowledge-base-upload-parse-chunk-runtime';
import { getDatabase } from '@/server/db/client';

export type DocumentsRouteDependencies = {
  repository?: Pick<V1KnowledgeBaseUploadParseChunkRuntimeRepository, 'listReadonlySummaries'>;
};

export type UploadRouteDependencies = {
  repository?: V1KnowledgeBaseUploadParseChunkRuntimeRepository;
};

export type SearchRouteDependencies = {
  repository?: V1KnowledgeBaseSearchRuntimeRepository;
};

export type IndexJobsRouteDependencies = {
  repository?: Pick<V1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository, 'listIndexJobSummaries'>;
};

export type RunRouteDependencies = {
  repository?: V1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository;
};

const defaultScope = {
  tenantId: 'demo-tenant-a',
  institutionId: 'demo-inst-a',
  workspaceId: 'demo-workspace-a',
};

function defaultFoundationRepository(): V1KnowledgeBaseUploadParseChunkRuntimeRepository {
  return createV1KnowledgeBaseRuntimeFoundationRepository(getDatabase());
}

function defaultSearchRepository(): V1KnowledgeBaseSearchRuntimeRepository {
  return createV1KnowledgeBaseSearchRuntimeRepository(getDatabase());
}

function defaultIndexRepository(): V1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository {
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

function searchInputFromRequest(request: Request) {
  const url = new URL(request.url);

  return {
    ...scopeFromRequest(request),
    query: url.searchParams.get('q') ?? '',
  };
}

function uploadValidationFailedResponse() {
  return NextResponse.json(
    { status: 'validation_failed', readonly: true },
    { status: 400 },
  );
}

function uploadStatusCodeForResult(result: V1KnowledgeBaseUploadParseChunkRuntimeResponse): number {
  if (result.status === 'created') return 201;
  if (result.status === 'unsupported_file_type') return 415;
  if (result.status === 'oversized_file') return 413;
  if (result.status === 'rejected_non_demo_input') return 400;

  return 400;
}

function isUploadInput(value: unknown): value is V1KnowledgeBaseUploadParseChunkRuntimeInput {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.tenantId === 'string' &&
    typeof candidate.institutionId === 'string' &&
    typeof candidate.workspaceId === 'string' &&
    typeof candidate.sourceKind === 'string' &&
    typeof candidate.fileName === 'string' &&
    typeof candidate.mimeType === 'string' &&
    typeof candidate.content === 'string'
  );
}

function isRunInput(value: unknown): value is V1KnowledgeBaseEmbeddingVectorIndexRuntimeRunInput {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.tenantId === 'string' &&
    typeof candidate.institutionId === 'string' &&
    typeof candidate.workspaceId === 'string' &&
    typeof candidate.jobId === 'string'
  );
}

function indexRunStatusCodeForResult(result: V1KnowledgeBaseEmbeddingVectorIndexRuntimeRunResult) {
  if (result.status === 'ready') return 200;
  if (result.status === 'empty') return 200;
  if (result.status === 'scope_mismatch') return 403;
  if (result.status === 'failed') return 500;

  return 400;
}

async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const };
  }
}

export async function handleDocumentsGET(
  request: Request,
  dependencies: DocumentsRouteDependencies = {},
) {
  const repository = dependencies.repository ?? defaultFoundationRepository();
  const summary = await repository.listReadonlySummaries(scopeFromRequest(request));
  const response = buildV1KnowledgeBaseRuntimeFoundationApiResponse({
    requestId: 'knowledge-base-runtime-documents-route-request',
    summary,
  });

  return NextResponse.json(response, { status: 200 });
}

export async function handleUploadPOST(
  request: Request,
  dependencies: UploadRouteDependencies = {},
) {
  const body = await readJsonBody(request);
  if (!body.ok || !isUploadInput(body.value)) {
    return uploadValidationFailedResponse();
  }

  const result = await uploadV1KnowledgeBaseRuntimeDocumentService({
    repository: dependencies.repository ?? defaultFoundationRepository(),
    input: body.value,
  });

  return NextResponse.json(result, { status: uploadStatusCodeForResult(result) });
}

export async function handleSearchGET(
  request: Request,
  dependencies: SearchRouteDependencies = {},
) {
  const result = await searchV1KnowledgeBaseRuntime({
    repository: dependencies.repository ?? defaultSearchRepository(),
    input: searchInputFromRequest(request),
  });

  return NextResponse.json(result, {
    status: result.status === 'denied' ? 403 : 200,
  });
}

export async function handleIndexJobsGET(
  request: Request,
  dependencies: IndexJobsRouteDependencies = {},
) {
  const result = await listV1KnowledgeBaseEmbeddingVectorIndexJobs({
    repository: dependencies.repository ?? defaultIndexRepository(),
    scope: scopeFromRequest(request),
  });

  return NextResponse.json(result, { status: 200 });
}

export async function handleIndexJobRunPOST(
  request: Request,
  dependencies: RunRouteDependencies = {},
) {
  const body = await readJsonBody(request);
  if (!body.ok || !isRunInput(body.value)) {
    return NextResponse.json({ status: 'validation_failed', readonly: true }, { status: 400 });
  }

  const result = await runV1KnowledgeBaseEmbeddingVectorIndexJob({
    repository: dependencies.repository ?? defaultIndexRepository(),
    input: body.value,
  });

  return NextResponse.json(result, { status: indexRunStatusCodeForResult(result) });
}
