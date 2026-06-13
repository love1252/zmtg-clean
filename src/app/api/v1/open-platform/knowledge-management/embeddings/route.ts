import { NextResponse } from 'next/server';
import { generatePlatformKnowledgeChunkEmbeddingsService } from '@/modules/open-platform/server/platform-knowledge-embedding-vector-search-service';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
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

async function readBody(request: Request) {
  try {
    const body = await request.json();
    return Object.prototype.toString.call(body) === '[object Object]'
      ? body as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  try {
    const access = requirePlatformAccess(request);
    if (!access.ok) return access.response;

    const body = await readBody(request);
    const result = await generatePlatformKnowledgeChunkEmbeddingsService({
      repository: createPlatformKnowledgeManagementRepository(getDatabase()),
      params: {
        tenantId: typeof body.tenantId === 'string' ? body.tenantId : null,
        knowledgeId: typeof body.knowledgeId === 'string' ? body.knowledgeId : null,
        fileId: typeof body.fileId === 'string' ? body.fileId : null,
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
      buildReadonlyApiError('知识库向量索引暂时无法生成'),
      { status: 400 },
    );
  }
}
