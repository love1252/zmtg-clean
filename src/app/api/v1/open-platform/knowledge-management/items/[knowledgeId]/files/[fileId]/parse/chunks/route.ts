import { NextResponse } from 'next/server';
import { getDatabase } from '@/server/db/client';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { listPlatformKnowledgeDocumentFileChunksService } from '@/modules/open-platform/server/platform-knowledge-document-parsing-service';
import { buildReadonlyApiError } from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

type ChunksRouteContext = {
  params: Promise<{ knowledgeId: string; fileId: string }>;
};

async function readParams(context: ChunksRouteContext) {
  return context.params;
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

export async function GET(request: Request, context: ChunksRouteContext) {
  try {
    const access = requirePlatformAccess(request);
    if (!access.ok) return access.response;

    const params = await readParams(context);
    const searchParams = new URL(request.url).searchParams;
    const result = await listPlatformKnowledgeDocumentFileChunksService({
      repository: createPlatformKnowledgeManagementRepository(getDatabase()),
      input: {
        tenantId: searchParams.get('tenantId'),
        knowledgeId: params.knowledgeId,
        fileId: params.fileId,
      },
    });

    const resultStatus = 'status' in result && typeof result.status === 'string'
      ? result.status
      : null;
    return NextResponse.json(result, {
      status: resultStatus ? statusCodeForResult(resultStatus) : 200,
    });
  } catch {
    return NextResponse.json(
      buildReadonlyApiError('知识库文件解析暂时无法处理'),
      { status: 400 },
    );
  }
}
