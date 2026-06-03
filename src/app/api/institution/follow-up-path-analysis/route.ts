import { NextResponse } from 'next/server';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { getFollowUpPathAnalysisForTenant } from '@/modules/institution/server/followup-path-analysis-service';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { createTreatmentSummaryRepository } from '@/modules/institution/server/treatment-summary-repository';
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
    resource: 'follow_up',
    action: 'read_own_tenant',
    targetTenantId: accessContext.tenantId,
  });

  if (!decision.allowed || !accessContext.tenantId) {
    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  try {
    const db = getDatabase();
    const response = await getFollowUpPathAnalysisForTenant({
      tenantId: accessContext.tenantId,
      analysisAt: new Date().toISOString(),
      auditRepository: createAuditEventRepository(db),
      tenantBusinessRepository: createTenantBusinessRepository(db),
      treatmentSummaryRepository: createTreatmentSummaryRepository(db),
    });

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
