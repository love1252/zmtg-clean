import { NextResponse } from 'next/server';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { createPlatformKnowledgeDirectoryService } from '@/modules/open-platform/server/platform-knowledge-management-service';
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

export async function POST(request: Request) {
  try {
    const access = requirePlatformAccess(request);
    if (!access.ok) return access.response;

    const body = await request.json().catch(() => ({}));
    const database = getDatabase();
    const result = await createPlatformKnowledgeDirectoryService({
      repository: createPlatformKnowledgeManagementRepository(database),
      auditRepository: createAuditEventRepository(database),
      accessContext: access.accessContext,
      input: {
        tenantId: typeof body.tenantId === 'string' ? body.tenantId : null,
        name: typeof body.name === 'string' ? body.name : null,
        parentId: typeof body.parentId === 'string' ? body.parentId : null,
      },
    });

    return NextResponse.json(result, { status: result.status === 'created' ? 201 : 400 });
  } catch {
    return NextResponse.json(buildReadonlyApiError('知识库目录暂时无法处理'), { status: 400 });
  }
}
