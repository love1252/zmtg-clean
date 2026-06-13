import { NextResponse } from 'next/server';
import { getDatabase } from '@/server/db/client';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { listInstitutionKnowledgeFilesService } from '@/modules/institution/server/institution-knowledge-file-management-service';

type FilesRouteContext = {
  params: Promise<{ knowledgeId: string }> | { knowledgeId: string };
};

async function readParams(context: FilesRouteContext) {
  return Promise.resolve(context.params);
}

export async function GET(request: Request, context: FilesRouteContext) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return NextResponse.json({ code: 'unauthorized', error: '请先登录' }, { status: 401 });
  }
  if (!accessContext.tenantId || !accessContext.institutionId) {
    return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
  }

  try {
    const params = await readParams(context);
    const searchParams = new URL(request.url).searchParams;
    const result = await listInstitutionKnowledgeFilesService({
      repository: createPlatformKnowledgeManagementRepository(getDatabase()),
      params: {
        tenantId: accessContext.tenantId,
        institutionId: accessContext.institutionId,
        knowledgeId: params.knowledgeId,
        page: searchParams.get('page'),
        pageSize: searchParams.get('pageSize'),
      },
    });

    if ('status' in result) {
      if (result.status === 'forbidden') {
        return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
      }
      if (result.status === 'not_found') {
        return NextResponse.json({ code: 'not_found', error: '记录不存在' }, { status: 404 });
      }
      return NextResponse.json({ code: 'validation_error', error: '请求参数不正确' }, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      { code: 'service_unavailable', error: '知识库文件暂时不可用' },
      { status: 503 },
    );
  }
}
