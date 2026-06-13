import { NextResponse } from 'next/server';
import { getDatabase } from '@/server/db/client';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { archivePlatformKnowledgeFileService } from '@/modules/open-platform/server/platform-knowledge-file-management-service';
import { buildReadonlyApiError } from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

type FileRouteContext = {
  params: Promise<{ knowledgeId: string; fileId: string }> | { knowledgeId: string; fileId: string };
};

async function readParams(context: FileRouteContext) {
  return Promise.resolve(context.params);
}

function statusCodeForResult(status: string) {
  if (status === 'validation_failed') return 400;
  if (status === 'not_found') return 404;
  return 200;
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

async function readTenantId(request: Request) {
  const searchTenantId = new URL(request.url).searchParams.get('tenantId');
  if (searchTenantId) return searchTenantId;

  const body = await request.json().catch(() => ({}));
  return typeof body.tenantId === 'string' ? body.tenantId : '';
}

export async function DELETE(request: Request, context: FileRouteContext) {
  try {
    const access = requirePlatformAccess(request);
    if (!access.ok) return access.response;

    const params = await readParams(context);
    const result = await archivePlatformKnowledgeFileService({
      repository: createPlatformKnowledgeManagementRepository(getDatabase()),
      input: {
        tenantId: await readTenantId(request),
        knowledgeId: params.knowledgeId,
        fileId: params.fileId,
      },
    });

    return NextResponse.json(result, { status: statusCodeForResult(result.status) });
  } catch {
    return NextResponse.json(
      buildReadonlyApiError('知识库文件暂时无法处理'),
      { status: 400 },
    );
  }
}
