import { NextResponse } from 'next/server';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  archivePlatformKnowledgeDirectoryService,
  renamePlatformKnowledgeDirectoryService,
} from '@/modules/open-platform/server/platform-knowledge-management-service';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { buildReadonlyApiError } from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

type DirectoryRouteContext = {
  params: Promise<{ directoryId: string }>;
};

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

function statusCodeForDirectoryResult(status: string) {
  if (status === 'created') return 201;
  if (status === 'renamed') return 200;
  if (status === 'archived') return 200;
  if (status === 'not_found') return 404;
  if (status === 'validation_failed') return 400;
  return 409;
}

async function readParams(context: DirectoryRouteContext | { params: { directoryId: string } }) {
  return Promise.resolve(context.params);
}

export async function PATCH(request: Request, context: DirectoryRouteContext) {
  try {
    const access = requirePlatformAccess(request);
    if (!access.ok) return access.response;

    const [params, body] = await Promise.all([
      readParams(context),
      request.json().catch(() => ({})),
    ]);
    const repository = createPlatformKnowledgeManagementRepository(getDatabase());
    const result = await renamePlatformKnowledgeDirectoryService({
      repository,
      auditRepository: createAuditEventRepository(getDatabase()),
      accessContext: access.accessContext,
      input: {
        tenantId: typeof body.tenantId === 'string' ? body.tenantId : null,
        directoryId: params.directoryId,
        name: typeof body.name === 'string' ? body.name : null,
      },
    });

    return NextResponse.json(result, { status: statusCodeForDirectoryResult(result.status) });
  } catch {
    return NextResponse.json(buildReadonlyApiError('知识库目录暂时无法处理'), { status: 400 });
  }
}

export async function DELETE(request: Request, context: DirectoryRouteContext) {
  try {
    const access = requirePlatformAccess(request);
    if (!access.ok) return access.response;

    const params = await readParams(context);
    const searchParams = new URL(request.url).searchParams;
    const database = getDatabase();
    const result = await archivePlatformKnowledgeDirectoryService({
      repository: createPlatformKnowledgeManagementRepository(database),
      auditRepository: createAuditEventRepository(database),
      accessContext: access.accessContext,
      params: {
        tenantId: searchParams.get('tenantId'),
        directoryId: params.directoryId,
      },
    });

    return NextResponse.json(result, { status: statusCodeForDirectoryResult(result.status) });
  } catch {
    return NextResponse.json(buildReadonlyApiError('知识库目录暂时无法处理'), { status: 400 });
  }
}
