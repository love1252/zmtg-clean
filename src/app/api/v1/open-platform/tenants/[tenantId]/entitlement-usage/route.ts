import { NextResponse } from 'next/server';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { canAccessResource } from '@/modules/security/domain/access-control';
import { getDatabase } from '@/server/db/client';
import { getTenantEntitlementUsageService } from '@/modules/institution/server/entitlement-usage-service';

export async function GET(
  request: Request,
  context: { params: Promise<{ tenantId: string }> },
) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return NextResponse.json({ code: 'unauthorized', error: '请先登录' }, { status: 401 });
  }

  if (accessContext.scope !== 'platform') {
    return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
  }

  const params = await context.params;
  const canAccess = canAccessResource({
    context: accessContext,
    resource: 'tenant',
    action: 'manage_status',
    targetTenantId: params.tenantId,
  });

  if (!canAccess.allowed) {
    return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
  }

  try {
    const view = await getTenantEntitlementUsageService({
      database: getDatabase(),
      tenantId: params.tenantId,
    });

    return NextResponse.json(view, { status: 200 });
  } catch {
    return NextResponse.json(
      { code: 'service_unavailable', error: '套餐权益数据暂时不可用' },
      { status: 503 },
    );
  }
}
