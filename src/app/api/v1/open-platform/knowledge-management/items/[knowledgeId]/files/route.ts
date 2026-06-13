import { NextResponse } from 'next/server';
import { getDatabase } from '@/server/db/client';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import {
  listPlatformKnowledgeFilesService,
  uploadPlatformKnowledgeFileService,
  type PlatformKnowledgeUploadFileLike,
} from '@/modules/open-platform/server/platform-knowledge-file-management-service';
import { createLocalPlatformKnowledgeFileStorage } from '@/modules/open-platform/server/platform-knowledge-file-storage';
import { buildReadonlyApiError } from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';

type FilesRouteContext = {
  params: Promise<{ knowledgeId: string }> | { knowledgeId: string };
};

async function readParams(context: FilesRouteContext) {
  return Promise.resolve(context.params);
}

function statusCodeForResult(status: string) {
  if (status === 'validation_failed') return 400;
  if (status === 'not_found') return 404;
  return 200;
}

function requirePlatformAccess(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return {
      ok: false as const,
      response: NextResponse.json({ code: 'unauthorized', error: '请先登录' }, { status: 401 }),
    };
  }
  if (accessContext.scope !== 'platform') {
    return {
      ok: false as const,
      response: NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 }),
    };
  }

  return { ok: true as const, accessContext };
}

export async function GET(request: Request, context: FilesRouteContext) {
  try {
    const access = requirePlatformAccess(request);
    if (!access.ok) return access.response;

    const params = await readParams(context);
    const searchParams = new URL(request.url).searchParams;
    const result = await listPlatformKnowledgeFilesService({
      repository: createPlatformKnowledgeManagementRepository(getDatabase()),
      params: {
        tenantId: searchParams.get('tenantId'),
        knowledgeId: params.knowledgeId,
        status: searchParams.get('status'),
        page: searchParams.get('page'),
        pageSize: searchParams.get('pageSize'),
      },
    });

    if ('status' in result) {
      return NextResponse.json(result, { status: statusCodeForResult(result.status) });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      buildReadonlyApiError('知识库文件暂时无法处理'),
      { status: 400 },
    );
  }
}

export async function POST(request: Request, context: FilesRouteContext) {
  try {
    const access = requirePlatformAccess(request);
    if (!access.ok) return access.response;

    const params = await readParams(context);
    const contentType = request.headers.get('content-type') ?? '';
    const input = contentType.includes('application/json')
      ? await readJsonUploadInput(request, params.knowledgeId, access.accessContext.userId)
      : await readMultipartUploadInput(request, params.knowledgeId, access.accessContext.userId);
    const result = await uploadPlatformKnowledgeFileService({
      repository: createPlatformKnowledgeManagementRepository(getDatabase()),
      storage: createLocalPlatformKnowledgeFileStorage(),
      input,
    });

    return NextResponse.json(result, {
      status: result.status === 'uploaded' ? 201 : statusCodeForResult(result.status),
    });
  } catch {
    return NextResponse.json(
      buildReadonlyApiError('知识库文件暂时无法处理'),
      { status: 400 },
    );
  }
}

async function readMultipartUploadInput(request: Request, knowledgeId: string, uploadedByUserId: string) {
  const formData = await request.formData();
  const file = formData.get('file');

  return {
    tenantId: typeof formData.get('tenantId') === 'string' ? formData.get('tenantId') as string : '',
    knowledgeId,
    uploadedByUserId,
    file:
      file && typeof file === 'object' && 'arrayBuffer' in file
        ? file as PlatformKnowledgeUploadFileLike
        : null,
  };
}

async function readJsonUploadInput(request: Request, knowledgeId: string, uploadedByUserId: string) {
  const body = await request.json().catch(() => ({}));
  const content =
    typeof body.contentBase64 === 'string'
      ? Uint8Array.from(Buffer.from(body.contentBase64, 'base64'))
      : new Uint8Array();
  const file = {
    name: typeof body.fileName === 'string' ? body.fileName : '',
    type: typeof body.mimeType === 'string' ? body.mimeType : '',
    size: content.byteLength,
    arrayBuffer: async () =>
      content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength),
  } satisfies PlatformKnowledgeUploadFileLike;

  return {
    tenantId: typeof body.tenantId === 'string' ? body.tenantId : '',
    knowledgeId,
    uploadedByUserId,
    file,
  };
}
