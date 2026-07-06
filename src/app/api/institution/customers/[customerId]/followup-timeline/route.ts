import { NextResponse } from 'next/server';
import { listCustomerFollowUpTimelineEvents } from '@/modules/institution/server/followup-customer-timeline-service';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

async function getCustomerId(context: RouteContext) {
  const params = await context.params;
  return params.customerId.trim();
}

export async function GET(request: Request, context: RouteContext) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const customerId = await getCustomerId(context);
  if (!customerId) {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }

  try {
    const repository = createTenantBusinessRepository(getDatabase());
    const result = await listCustomerFollowUpTimelineEvents({
      context: accessContext,
      customerId,
      tenantBusinessRepository: repository,
    });

    if (result.kind === 'forbidden') {
      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    if (result.kind === 'not_found') {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }

    return NextResponse.json({ records: result.events });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
