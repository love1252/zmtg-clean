import { NextResponse } from 'next/server';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

function unauthorizedResponse() {
  return NextResponse.json({ code: 'unauthorized', error: '请先登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
}

function institutionAiModelGovernanceForbiddenResponse() {
  return NextResponse.json(
    {
      code: 'INSTITUTION_AI_MODEL_GOVERNANCE_FORBIDDEN',
      error: '机构端不能查看或配置 AI 模型，AI 服务由平台统一管理',
    },
    { status: 403 },
  );
}

export async function GET(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return unauthorizedResponse();
  }

  if (accessContext.scope !== 'tenant' || !accessContext.tenantId) {
    return forbiddenResponse();
  }

  return institutionAiModelGovernanceForbiddenResponse();
}
