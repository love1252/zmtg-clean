import { NextResponse } from 'next/server';
import { readWeComCustomerMappingCandidates } from '@/modules/institution/view-models/wecom-customer-mapping-candidates-reader';
import {
  createWeComCustomerMappingCandidatesFailClosedRawView,
  parseWeComCustomerMappingCandidatesReadonlyResponse,
  parseWeComCustomerMappingCandidatesResponse,
} from '@/modules/institution/view-models/wecom-customer-mapping-candidates';
import { canAccessResource } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

export async function GET(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const decision = canAccessResource({
    context,
    resource: 'customer',
    action: 'read',
    targetTenantId: context.tenantId,
  });
  if (!decision.allowed || context.scope !== 'tenant' || !context.tenantId || !context.institutionId) {
    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  const candidateView = readWeComCustomerMappingCandidates(context.tenantId);
  const parsed = parseWeComCustomerMappingCandidatesReadonlyResponse(candidateView);
  const responseBody = parsed ?? parseWeComCustomerMappingCandidatesResponse(
    createWeComCustomerMappingCandidatesFailClosedRawView({
      tenantId: context.tenantId,
      reason: 'response_contract_invalid',
    }),
    context.tenantId,
  );

  return NextResponse.json(responseBody, {
    headers: { 'cache-control': 'no-store' },
  });
}
