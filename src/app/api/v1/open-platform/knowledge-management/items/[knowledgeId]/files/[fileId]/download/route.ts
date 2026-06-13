import { NextResponse } from 'next/server';
import { getDatabase } from '@/server/db/client';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { downloadPlatformKnowledgeFileService } from '@/modules/open-platform/server/platform-knowledge-file-management-service';
import { createLocalPlatformKnowledgeFileStorage } from '@/modules/open-platform/server/platform-knowledge-file-storage';
import { buildReadonlyApiError } from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

type DownloadRouteContext = {
  params: Promise<{ knowledgeId: string; fileId: string }> | { knowledgeId: string; fileId: string };
};

async function readParams(context: DownloadRouteContext) {
  return Promise.resolve(context.params);
}

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

  return { ok: true as const, accessContext };
}

export async function GET(request: Request, context: DownloadRouteContext) {
  try {
    const access = requirePlatformAccess(request);
    if (!access.ok) return access.response;

    const params = await readParams(context);
    const searchParams = new URL(request.url).searchParams;
    const result = await downloadPlatformKnowledgeFileService({
      repository: createPlatformKnowledgeManagementRepository(getDatabase()),
      storage: createLocalPlatformKnowledgeFileStorage(),
      input: {
        tenantId: searchParams.get('tenantId'),
        knowledgeId: params.knowledgeId,
        fileId: params.fileId,
      },
    });
    if (result.status !== 'ready') {
      return NextResponse.json(result, { status: result.status === 'not_found' ? 404 : 400 });
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
      buildReadonlyApiError('知识库文件暂时无法处理'),
      { status: 400 },
    );
  }
}
