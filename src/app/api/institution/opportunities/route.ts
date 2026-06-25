import { NextResponse } from 'next/server';
import { generateOpportunityPools } from '@/modules/institution/server/opportunity-pool-service';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { canAccessResource } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

export async function GET(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const decision = canAccessResource({
    context: accessContext,
    resource: 'customer',
    action: 'read_own_tenant',
    targetTenantId: accessContext.tenantId,
  });

  if (!decision.allowed || !accessContext.tenantId) {
    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  try {
    const db = getDatabase();
    const repository = createTenantBusinessRepository(db);
    const customers = await repository.listCustomersByTenant(accessContext.tenantId);
    const response = generateOpportunityPools({
      customers,
      generatedAt: new Date().toISOString(),
    });

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
