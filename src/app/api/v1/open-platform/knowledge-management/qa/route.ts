import { NextResponse } from 'next/server';
import { composePlatformKnowledgeQaService } from '@/modules/open-platform/server/platform-knowledge-qa-service';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
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

  return { ok: true as const, actorUserId: accessContext.userId };
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
    const result = await composePlatformKnowledgeQaService({
      repository: createPlatformKnowledgeManagementRepository(getDatabase()),
      actorUserId: access.actorUserId,
      params: {
        tenantId: typeof body.tenantId === 'string' ? body.tenantId : null,
        question: typeof body.question === 'string' ? body.question : null,
        knowledgeId: typeof body.knowledgeId === 'string' ? body.knowledgeId : null,
        fileId: typeof body.fileId === 'string' ? body.fileId : null,
        retrievalMode: typeof body.retrievalMode === 'string' ? body.retrievalMode : null,
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
      { code: 'service_unavailable', error: '知识库问答暂时无法处理' },
      { status: 400 },
    );
  }
}
