import { NextResponse } from 'next/server';
import { listInstitutionKnowledgeItemsService } from '@/modules/institution/server/institution-knowledge-management-service';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

function unauthorizedResponse() {
  return NextResponse.json({ code: 'unauthorized', error: '请先登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
}

function serviceUnavailableResponse() {
  return NextResponse.json(
    { code: 'service_unavailable', error: '知识库只读数据暂时不可用' },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return unauthorizedResponse();
  }

  if (accessContext.scope !== 'tenant' || !accessContext.tenantId || !accessContext.institutionId) {
    return forbiddenResponse();
  }

  try {
    const searchParams = new URL(request.url).searchParams;
    const repository = createPlatformKnowledgeManagementRepository(getDatabase());
    const response = await listInstitutionKnowledgeItemsService({
      repository,
      params: {
        tenantId: accessContext.tenantId,
        institutionId: accessContext.institutionId,
        keyword: searchParams.get('keyword'),
        page: searchParams.get('page'),
        pageSize: searchParams.get('pageSize'),
      },
    });

    return NextResponse.json(response);
  } catch {
    return serviceUnavailableResponse();
  }
}
