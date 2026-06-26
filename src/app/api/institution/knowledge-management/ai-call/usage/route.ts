import { NextResponse } from 'next/server';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';
import { createAiCallUsageRepository } from '@/modules/institution/server/institution-ai-call-usage-repository';
import { listInstitutionAiCallUsageService } from '@/modules/institution/server/institution-ai-call-service';

export async function GET(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return NextResponse.json({ code: 'unauthorized', error: '请先登录' }, { status: 401 });
  }
  if (accessContext.scope !== 'tenant' || !accessContext.tenantId || !accessContext.institutionId) {
    return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
  }

  try {
    const result = await listInstitutionAiCallUsageService({
      repository: createAiCallUsageRepository(getDatabase()),
      params: {
        tenantId: accessContext.tenantId,
        institutionId: accessContext.institutionId,
      },
    });

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        requestId: 'institution-ai-call-usage',
        readonly: true,
        dataSource: 'repository',
        records: [],
        emptyState: {
          title: 'AI 调用记录暂时不可用',
          description: '请稍后刷新重试。',
        },
      },
      { status: 200 },
    );
  }
}
