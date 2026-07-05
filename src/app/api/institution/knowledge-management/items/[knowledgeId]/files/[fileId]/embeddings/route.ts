import { NextResponse } from 'next/server';
import {
  createAndRunGenerateEmbeddingsJob,
  createAndRunRebuildEmbeddingsJob,
} from '@/modules/open-platform/server/platform-knowledge-indexing-job-service';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

function statusCodeForResult(status: string) {
  if (status === 'validation_failed') return 400;
  if (status === 'not_found') return 404;
  if (status === 'forbidden') return 403;
  if (status === 'failed') return 503;
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

export async function POST(
  request: Request,
  context: { params: Promise<{ knowledgeId: string; fileId: string }> },
) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return NextResponse.json({ code: 'unauthorized', error: '请先登录' }, { status: 401 });
  }
  if (accessContext.scope !== 'tenant' || !accessContext.tenantId || !accessContext.institutionId) {
    return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
  }

  try {
    const [{ knowledgeId, fileId }, body] = await Promise.all([context.params, readBody(request)]);
    const repository = createPlatformKnowledgeManagementRepository(getDatabase());
    const taskInput = {
      tenantId: accessContext.tenantId,
      institutionId: accessContext.institutionId,
      actorUserId: accessContext.userId,
      knowledgeId,
      fileId,
    };
    const rebuild = body.rebuild === true || body.rebuild === 'true' || body.rebuild === 1 || body.rebuild === '1';
    const result = rebuild
      ? await createAndRunRebuildEmbeddingsJob({ repository, input: taskInput })
      : await createAndRunGenerateEmbeddingsJob({ repository, input: taskInput });

    const resultStatus = 'status' in result && typeof result.status === 'string'
      ? result.status
      : null;
    return NextResponse.json('job' in result ? result.job : result, {
      status: resultStatus ? statusCodeForResult(resultStatus) : 200,
    });
  } catch {
    return NextResponse.json(
      { code: 'service_unavailable', error: '知识库向量索引暂时无法生成' },
      { status: 503 },
    );
  }
}
