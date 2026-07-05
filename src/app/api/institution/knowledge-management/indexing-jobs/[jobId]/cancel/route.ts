import { NextResponse } from 'next/server';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { cancelKnowledgeIndexingJob } from '@/modules/open-platform/server/platform-knowledge-indexing-job-service';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

function requireInstitutionAccess(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return {
      ok: false as const,
      response: NextResponse.json({ code: 'unauthorized', error: '请先登录' }, { status: 401 }),
    };
  }
  if (accessContext.scope !== 'tenant' || !accessContext.tenantId || !accessContext.institutionId) {
    return {
      ok: false as const,
      response: NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 }),
    };
  }

  return { ok: true as const, accessContext };
}

export async function POST(request: Request, context: RouteContext) {
  const access = requireInstitutionAccess(request);
  if (!access.ok) return access.response;

  try {
    const { jobId } = await context.params;
    const result = await cancelKnowledgeIndexingJob({
      repository: createPlatformKnowledgeManagementRepository(getDatabase()),
      input: {
        tenantId: access.accessContext.tenantId,
        institutionId: access.accessContext.institutionId,
        jobId,
      },
    });
    if (result.status === 'not_found') {
      return NextResponse.json({ code: 'not_found', error: '记录不存在' }, { status: 404 });
    }
    if (result.status === 'validation_failed') {
      return NextResponse.json({ code: 'validation_error', error: result.message }, { status: 400 });
    }

    return NextResponse.json(
      'job' in result ? { ...result.job, message: 'message' in result ? result.message : undefined } : result,
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { code: 'service_unavailable', error: '知识库索引任务暂时不可用' },
      { status: 503 },
    );
  }
}
