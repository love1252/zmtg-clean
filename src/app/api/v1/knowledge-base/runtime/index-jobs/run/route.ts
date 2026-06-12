import { NextResponse } from 'next/server';
import {
  createV1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository,
  runV1KnowledgeBaseEmbeddingVectorIndexJob,
  type V1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository,
  type V1KnowledgeBaseEmbeddingVectorIndexRuntimeRunInput,
  type V1KnowledgeBaseEmbeddingVectorIndexRuntimeRunResult,
} from '@/modules/knowledge-base/server/v1-knowledge-base-embedding-vector-index-runtime';
import { getDatabase } from '@/server/db/client';

type RunRouteDependencies = {
  repository?: V1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository;
};

function defaultRepository(): V1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository {
  return createV1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository(getDatabase());
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

function statusCodeForResult(result: V1KnowledgeBaseEmbeddingVectorIndexRuntimeRunResult) {
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

export async function POST(request: Request, dependencies: RunRouteDependencies = {}) {
  const body = await readJsonBody(request);
  if (!body.ok || !isRunInput(body.value)) {
    return NextResponse.json({ status: 'validation_failed', readonly: true }, { status: 400 });
  }

  const result = await runV1KnowledgeBaseEmbeddingVectorIndexJob({
    repository: dependencies.repository ?? defaultRepository(),
    input: body.value,
  });

  return NextResponse.json(result, { status: statusCodeForResult(result) });
}
