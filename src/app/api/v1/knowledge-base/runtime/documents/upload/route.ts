import { NextResponse } from 'next/server';
import { createV1KnowledgeBaseRuntimeFoundationRepository } from '@/modules/knowledge-base/server/v1-knowledge-base-runtime-foundation-repository';
import {
  uploadV1KnowledgeBaseRuntimeDocumentService,
  type V1KnowledgeBaseUploadParseChunkRuntimeInput,
  type V1KnowledgeBaseUploadParseChunkRuntimeRepository,
  type V1KnowledgeBaseUploadParseChunkRuntimeResponse,
} from '@/modules/knowledge-base/server/v1-knowledge-base-upload-parse-chunk-runtime';
import { getDatabase } from '@/server/db/client';

type UploadRouteDependencies = {
  repository?: V1KnowledgeBaseUploadParseChunkRuntimeRepository;
};

function defaultRepository(): V1KnowledgeBaseUploadParseChunkRuntimeRepository {
  return createV1KnowledgeBaseRuntimeFoundationRepository(getDatabase());
}

function validationFailedResponse() {
  return NextResponse.json(
    { status: 'validation_failed', readonly: true },
    { status: 400 },
  );
}

function statusCodeForResult(result: V1KnowledgeBaseUploadParseChunkRuntimeResponse): number {
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

async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const };
  }
}

export async function POST(request: Request, dependencies: UploadRouteDependencies = {}) {
  const body = await readJsonBody(request);
  if (!body.ok || !isUploadInput(body.value)) {
    return validationFailedResponse();
  }

  const result = await uploadV1KnowledgeBaseRuntimeDocumentService({
    repository: dependencies.repository ?? defaultRepository(),
    input: body.value,
  });

  return NextResponse.json(result, { status: statusCodeForResult(result) });
}
