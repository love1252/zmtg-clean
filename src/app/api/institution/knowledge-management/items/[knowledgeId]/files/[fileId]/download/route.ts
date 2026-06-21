import { NextResponse } from 'next/server';
import { getDatabase } from '@/server/db/client';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { createLocalPlatformKnowledgeFileStorage } from '@/modules/open-platform/server/platform-knowledge-file-storage';
import { downloadInstitutionKnowledgeFileService } from '@/modules/institution/server/institution-knowledge-file-management-service';

type DownloadRouteContext = {
  params: Promise<{ knowledgeId: string; fileId: string }>;
};

async function readParams(context: DownloadRouteContext) {
  return context.params;
}

export async function GET(request: Request, context: DownloadRouteContext) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return NextResponse.json({ code: 'unauthorized', error: '请先登录' }, { status: 401 });
  }
  if (!accessContext.tenantId || !accessContext.institutionId) {
    return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
  }

  try {
    const params = await readParams(context);
    const result = await downloadInstitutionKnowledgeFileService({
      repository: createPlatformKnowledgeManagementRepository(getDatabase()),
      storage: createLocalPlatformKnowledgeFileStorage(),
      input: {
        tenantId: accessContext.tenantId,
        institutionId: accessContext.institutionId,
        knowledgeId: params.knowledgeId,
        fileId: params.fileId,
      },
    });

    if (result.status !== 'ready') {
      if (result.status === 'forbidden') {
        return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
      }
      if (result.status === 'not_found') {
        return NextResponse.json({ code: 'not_found', error: '记录不存在' }, { status: 404 });
      }
      return NextResponse.json({ code: 'validation_error', error: '请求参数不正确' }, { status: 400 });
    }

    return new Response(result.content.slice().buffer, {
      status: 200,
      headers: {
        'content-type': result.mimeType,
        'content-length': String(result.sizeBytes),
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
        'x-content-type-options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json(
      { code: 'service_unavailable', error: '知识库文件暂时不可用' },
      { status: 503 },
    );
  }
}
