import { NextResponse } from 'next/server';

import { INSTITUTION_KNOWLEDGE_FILE_MAX_BYTES } from '@/modules/institution/server/institution-knowledge-upload-service';
import { validateSameOriginMutationRequest } from '@/modules/security/server/mutation-request-security';
import {
  confirmCurrentInstitutionKnowledgeUploadV1,
  publishCurrentInstitutionKnowledgeUploadV1,
  readCurrentInstitutionKnowledgeUploadV1,
  uploadCurrentInstitutionKnowledgeV1,
  type InstitutionKnowledgeUploadResultV1,
} from '@/server/orchestration/institution-knowledge-upload-runtime';

const NO_STORE_HEADERS = Object.freeze({ 'cache-control': 'no-store' } as const);
const MULTIPART_OVERHEAD_BYTES = 256 * 1024;

function response(result: InstitutionKnowledgeUploadResultV1, readyStatus = 200) {
  const status = result.kind === 'ready'
    ? readyStatus
    : result.kind === 'invalid'
      ? 400
      : result.kind === 'forbidden'
        ? 403
        : result.kind === 'conflict' || result.kind === 'quota_denied'
          ? 409
          : 503;
  return NextResponse.json(result, { status, headers: NO_STORE_HEADERS });
}

function csrfFailure() {
  return NextResponse.json(
    { kind: 'forbidden', code: 'csrf_validation_failed' },
    { status: 403, headers: NO_STORE_HEADERS },
  );
}

async function safeRuntimeResponse(
  operation: () => Promise<InstitutionKnowledgeUploadResultV1>,
  readyStatus = 200,
) {
  try {
    return response(await operation(), readyStatus);
  } catch {
    return response(Object.freeze({
      kind: 'unavailable',
      code: 'institution_knowledge_upload_runtime_unavailable',
    }));
  }
}

async function readUploadFile(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  const contentLength = request.headers.get('content-length');
  if (
    !contentType.toLowerCase().startsWith('multipart/form-data;')
    || (contentLength !== null && (
      !/^\d+$/u.test(contentLength)
      || Number(contentLength) > INSTITUTION_KNOWLEDGE_FILE_MAX_BYTES + MULTIPART_OVERHEAD_BYTES
    ))
  ) return null;
  try {
    const formData = await request.formData();
    if ([...formData.keys()].some((key) => key !== 'file')) return null;
    const file = formData.get('file');
    if (
      !file
      || typeof file !== 'object'
      || typeof Reflect.get(file, 'name') !== 'string'
      || typeof Reflect.get(file, 'type') !== 'string'
      || typeof Reflect.get(file, 'size') !== 'number'
      || typeof Reflect.get(file, 'arrayBuffer') !== 'function'
    ) return null;
    const size = Reflect.get(file, 'size') as number;
    if (size <= 0 || size > INSTITUTION_KNOWLEDGE_FILE_MAX_BYTES) return null;
    const content = new Uint8Array(
      await (Reflect.get(file, 'arrayBuffer') as () => Promise<ArrayBuffer>).call(file),
    );
    return Object.freeze({
      fileName: Reflect.get(file, 'name') as string,
      mimeType: Reflect.get(file, 'type') as string,
      content,
    });
  } catch {
    return null;
  }
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!validateSameOriginMutationRequest(request).ok) return csrfFailure();
  const file = await readUploadFile(request);
  if (!file) {
    return response(Object.freeze({
      kind: 'invalid',
      code: 'invalid_knowledge_upload_file',
      message: '请选择 2 MB 以内的支持文件',
    }));
  }
  return safeRuntimeResponse(() => uploadCurrentInstitutionKnowledgeV1(file), 201);
}

export async function GET(request: Request) {
  let uploadId = '';
  try {
    uploadId = new URL(request.url).searchParams.get('uploadId') ?? '';
  } catch {
    // Invalid URLs are handled by the runtime validator.
  }
  return safeRuntimeResponse(() => readCurrentInstitutionKnowledgeUploadV1(uploadId));
}

export async function PATCH(request: Request) {
  if (!validateSameOriginMutationRequest(request).ok) return csrfFailure();
  const body = await readJson(request);
  return safeRuntimeResponse(() => confirmCurrentInstitutionKnowledgeUploadV1({
    uploadId: typeof body?.uploadId === 'string' ? body.uploadId : '',
    expectedRevision: typeof body?.expectedRevision === 'number' ? body.expectedRevision : 0,
    title: typeof body?.title === 'string' ? body.title : '',
    category: typeof body?.category === 'string' ? body.category : '',
  }));
}

export async function PUT(request: Request) {
  if (!validateSameOriginMutationRequest(request).ok) return csrfFailure();
  const body = await readJson(request);
  return safeRuntimeResponse(() => publishCurrentInstitutionKnowledgeUploadV1({
    uploadId: typeof body?.uploadId === 'string' ? body.uploadId : '',
    expectedRevision: typeof body?.expectedRevision === 'number' ? body.expectedRevision : 0,
  }));
}
