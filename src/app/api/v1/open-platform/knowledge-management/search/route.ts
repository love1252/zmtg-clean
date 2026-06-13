import { NextResponse } from 'next/server';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { searchPlatformKnowledgeChunksService } from '@/modules/open-platform/server/platform-knowledge-keyword-search-service';
import { buildReadonlyApiError } from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

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
  return 200;
}

export async function GET(request: Request) {
  try {
    const access = requirePlatformAccess(request);
    if (!access.ok) return access.response;

    const params = new URL(request.url).searchParams;
    const result = await searchPlatformKnowledgeChunksService({
      repository: createPlatformKnowledgeManagementRepository(getDatabase()),
      params: {
        tenantId: params.get('tenantId'),
        keyword: params.get('keyword'),
        knowledgeId: params.get('knowledgeId'),
        fileId: params.get('fileId'),
        page: params.get('page'),
        pageSize: params.get('pageSize'),
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
      buildReadonlyApiError('知识库片段检索暂时无法处理'),
      { status: 400 },
    );
  }
}
