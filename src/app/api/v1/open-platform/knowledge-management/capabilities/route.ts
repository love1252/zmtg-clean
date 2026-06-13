import { NextResponse } from 'next/server';
import { getKnowledgeBaseProductionCapabilityStatus } from '@/modules/open-platform/server/platform-knowledge-production-governance-policy';
import { buildReadonlyApiError } from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

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

  return { ok: true as const };
}

export async function GET(request: Request) {
  try {
    const access = requirePlatformAccess(request);
    if (!access.ok) return access.response;

    return NextResponse.json(getKnowledgeBaseProductionCapabilityStatus());
  } catch {
    return NextResponse.json(
      buildReadonlyApiError('知识库生产能力状态暂时无法查询'),
      { status: 400 },
    );
  }
}
