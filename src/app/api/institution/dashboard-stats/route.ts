import { NextResponse } from 'next/server';
import { generateOpportunityPools } from '@/modules/institution/server/opportunity-pool-service';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { canAccessResource } from '@/modules/security/domain/access-control';
import { deriveSafetySwitchViewModel, type SafetySwitchViewModel } from '@/modules/security/domain/safety-switch';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

export type InstitutionDashboardStatsResponse = {
  customerCount: number;
  pendingFollowUpCount: number;
  completedFollowUpCount: number;
  opportunityCount: number;
  safetySwitch: SafetySwitchViewModel;
};

export async function GET(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const decision = canAccessResource({
    context: accessContext,
    resource: 'dashboard',
    action: 'read',
    targetTenantId: accessContext.tenantId,
  });

  if (!decision.allowed || !accessContext.tenantId) {
    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  try {
    const db = getDatabase();
    const repository = createTenantBusinessRepository(db);
    const tenantId = accessContext.tenantId;

    const [customers, followUpTasks] = await Promise.all([
      repository.listCustomersByTenant(tenantId),
      repository.listFollowUpTasksByTenant(tenantId),
    ]);

    const opportunityPools = generateOpportunityPools({
      customers,
      generatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      customerCount: customers.length,
      pendingFollowUpCount: followUpTasks.filter(
        (t) => t.status === 'due' || t.status === 'in_progress' || t.status === 'escalated',
      ).length,
      completedFollowUpCount: followUpTasks.filter(
        (t) => t.status === 'completed',
      ).length,
      opportunityCount: opportunityPools.totalCount,
      safetySwitch: deriveSafetySwitchViewModel(),
    } satisfies InstitutionDashboardStatsResponse);
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
