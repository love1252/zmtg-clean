import { NextResponse } from 'next/server';
import { getDatabase } from '@/server/db/client';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { getInstitutionKnowledgeDocumentFileParseStatusService } from '@/modules/institution/server/institution-knowledge-file-parsing-service';

type ParseRouteContext = {
  params: Promise<{ knowledgeId: string; fileId: string }>;
};

async function readParams(context: ParseRouteContext) {
  return context.params;
}

function statusCodeForResult(status: string) {
  if (status === 'validation_failed') return 400;
  if (status === 'forbidden') return 403;
  if (status === 'not_found') return 404;
  return 200;
}

function errorPayloadForStatus(status: string) {
  if (status === 'forbidden') return { code: 'forbidden', error: '没有访问权限' };
  if (status === 'not_found') return { code: 'not_found', error: '记录不存在' };
  return { code: 'validation_error', error: '请求参数不正确' };
}

export async function GET(request: Request, context: ParseRouteContext) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return NextResponse.json({ code: 'unauthorized', error: '请先登录' }, { status: 401 });
  }
  if (!accessContext.tenantId || !accessContext.institutionId) {
    return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
  }

  try {
    const params = await readParams(context);
    const result = await getInstitutionKnowledgeDocumentFileParseStatusService({
      repository: createPlatformKnowledgeManagementRepository(getDatabase()),
      input: {
        tenantId: accessContext.tenantId,
        institutionId: accessContext.institutionId,
        knowledgeId: params.knowledgeId,
        fileId: params.fileId,
      },
    });

    if (result.status === 'validation_failed' || result.status === 'forbidden' || result.status === 'not_found') {
      return NextResponse.json(errorPayloadForStatus(result.status), {
        status: statusCodeForResult(result.status),
      });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      { code: 'service_unavailable', error: '知识库文件解析暂时不可用' },
      { status: 503 },
    );
  }
}
