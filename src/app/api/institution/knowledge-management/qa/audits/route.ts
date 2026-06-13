import { NextResponse } from 'next/server';
import { listInstitutionKnowledgeQaAuditsService } from '@/modules/open-platform/server/platform-knowledge-qa-service';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

function statusCodeForResult(status: string) {
  if (status === 'validation_failed') return 400;
  return 200;
}

export async function GET(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return NextResponse.json({ code: 'unauthorized', error: '请先登录' }, { status: 401 });
  }
  if (accessContext.scope !== 'tenant' || !accessContext.tenantId || !accessContext.institutionId) {
    return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
  }

  try {
    const params = new URL(request.url).searchParams;
    const result = await listInstitutionKnowledgeQaAuditsService({
      repository: createPlatformKnowledgeManagementRepository(getDatabase()),
      params: {
        tenantId: accessContext.tenantId,
        institutionId: accessContext.institutionId,
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
      { code: 'service_unavailable', error: '知识库问答审计暂时不可用' },
      { status: 503 },
    );
  }
}
