import { NextResponse } from 'next/server';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { reorderPlatformKnowledgeDirectoriesService } from '@/modules/open-platform/server/platform-knowledge-management-service';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { buildReadonlyApiError } from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';
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

  return { ok: true as const, accessContext };
}

export async function PATCH(request: Request) {
  try {
    const access = requirePlatformAccess(request);
    if (!access.ok) return access.response;

    const body = await request.json().catch(() => ({}));
    const database = getDatabase();
    const result = await reorderPlatformKnowledgeDirectoriesService({
      repository: createPlatformKnowledgeManagementRepository(database),
      auditRepository: createAuditEventRepository(database),
      accessContext: access.accessContext,
      input: {
        tenantId: typeof body.tenantId === 'string' ? body.tenantId : null,
        directoryIds: body.directoryIds,
      },
    });
    const statusCode = result.status === 'reordered'
      ? 200
      : result.status === 'not_found'
        ? 404
        : 400;

    return NextResponse.json(result, { status: statusCode });
  } catch {
    return NextResponse.json(buildReadonlyApiError('知识库目录暂时无法处理'), { status: 400 });
  }
}
