import { NextResponse } from 'next/server';

import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import {
  getInstitutionAiServiceUsage,
  resolveInstitutionAiServiceUsagePeriod,
} from '@/modules/institution/server/institution-ai-service-usage';
import { getDatabase } from '@/server/db/client';

export async function GET(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return NextResponse.json({ code: 'unauthorized', error: '请先登录' }, { status: 401 });
  }
  if (accessContext.scope !== 'tenant' || !accessContext.tenantId || !accessContext.institutionId) {
    return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
  }

  const url = new URL(request.url);
  const periodResult = resolveInstitutionAiServiceUsagePeriod(url.searchParams);
  if (!periodResult.ok) {
    return NextResponse.json(
      { code: periodResult.code, error: periodResult.error },
      { status: 400 },
    );
  }

  try {
    const view = await getInstitutionAiServiceUsage({
      database: getDatabase(),
      tenantId: accessContext.tenantId,
      institutionId: accessContext.institutionId,
      period: periodResult.period,
      dateFrom: periodResult.dateFrom,
      dateTo: periodResult.dateTo,
    });

    return NextResponse.json(view, { status: 200 });
  } catch {
    return NextResponse.json(
      { code: 'service_unavailable', error: 'AI 服务使用数据暂时不可用' },
      { status: 503 },
    );
  }
}
