import { NextResponse } from 'next/server';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';
import { getTenantEntitlementUsageService } from '@/modules/institution/server/entitlement-usage-service';

export async function GET(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return NextResponse.json({ code: 'unauthorized', error: '请先登录' }, { status: 401 });
  }

  if (accessContext.scope !== 'tenant' || !accessContext.tenantId) {
    return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
  }

  try {
    const view = await getTenantEntitlementUsageService({
      database: getDatabase(),
      tenantId: accessContext.tenantId,
      institutionId: accessContext.institutionId,
    });

    return NextResponse.json(view, { status: 200 });
  } catch {
    return NextResponse.json(
      { code: 'service_unavailable', error: '套餐权益数据暂时不可用' },
      { status: 503 },
    );
  }
}
