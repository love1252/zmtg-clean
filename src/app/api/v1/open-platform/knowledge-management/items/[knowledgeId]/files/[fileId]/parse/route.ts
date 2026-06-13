import { NextResponse } from 'next/server';
import { getDatabase } from '@/server/db/client';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { createLocalPlatformKnowledgeFileStorage } from '@/modules/open-platform/server/platform-knowledge-file-storage';
import {
  getPlatformKnowledgeDocumentFileParseStatusService,
  parsePlatformKnowledgeDocumentFileService,
} from '@/modules/open-platform/server/platform-knowledge-document-parsing-service';
import { buildReadonlyApiError } from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

type ParseRouteContext = {
  params: Promise<{ knowledgeId: string; fileId: string }> | { knowledgeId: string; fileId: string };
};

async function readParams(context: ParseRouteContext) {
  return Promise.resolve(context.params);
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

  return { ok: true as const };
}

function statusCodeForResult(status: string) {
  if (status === 'validation_failed') return 400;
  if (status === 'not_found') return 404;
  return 200;
}

async function readTenantId(request: Request) {
  const searchTenantId = new URL(request.url).searchParams.get('tenantId');
  if (searchTenantId) return searchTenantId;

  const body = await request.json().catch(() => ({}));
  return typeof body.tenantId === 'string' ? body.tenantId : '';
}

export async function GET(request: Request, context: ParseRouteContext) {
  try {
    const access = requirePlatformAccess(request);
    if (!access.ok) return access.response;

    const params = await readParams(context);
    const searchParams = new URL(request.url).searchParams;
    const result = await getPlatformKnowledgeDocumentFileParseStatusService({
      repository: createPlatformKnowledgeManagementRepository(getDatabase()),
      input: {
        tenantId: searchParams.get('tenantId'),
        knowledgeId: params.knowledgeId,
        fileId: params.fileId,
      },
    });

    return NextResponse.json(result, { status: statusCodeForResult(result.status) });
  } catch {
    return NextResponse.json(
      buildReadonlyApiError('知识库文件解析暂时无法处理'),
      { status: 400 },
    );
  }
}

export async function POST(request: Request, context: ParseRouteContext) {
  try {
    const access = requirePlatformAccess(request);
    if (!access.ok) return access.response;

    const params = await readParams(context);
    const result = await parsePlatformKnowledgeDocumentFileService({
      repository: createPlatformKnowledgeManagementRepository(getDatabase()),
      storage: createLocalPlatformKnowledgeFileStorage(),
      input: {
        tenantId: await readTenantId(request),
        knowledgeId: params.knowledgeId,
        fileId: params.fileId,
      },
    });

    return NextResponse.json(result, { status: statusCodeForResult(result.status) });
  } catch {
    return NextResponse.json(
      buildReadonlyApiError('知识库文件解析暂时无法处理'),
      { status: 400 },
    );
  }
}
