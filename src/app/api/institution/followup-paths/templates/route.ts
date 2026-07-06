import { NextResponse } from 'next/server';
import { listFollowUpPathTemplates } from '@/modules/institution/server/followup-path-enrollment-service';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { canAccessResource } from '@/modules/security/domain/access-control';

export async function GET(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const decision = canAccessResource({
    context,
    resource: 'follow_up',
    action: 'read_own_tenant',
    targetTenantId: context.tenantId,
  });

  if (!decision.allowed || !context.tenantId) {
    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  return NextResponse.json({ records: listFollowUpPathTemplates() });
}
