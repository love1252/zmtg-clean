import { NextResponse } from 'next/server';

import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { createTenantPlanBindingRepository } from '@/modules/open-platform/server/tenant-plan-binding-repository';
import { listTenantPlanOptionsService } from '@/modules/open-platform/server/tenant-plan-binding-service';
import { getDatabase } from '@/server/db/client';

function lowSensitiveError(status: number, errorCode: string) {
  return NextResponse.json({ ok: false, errorCode }, { status });
}

function canReadTenantPlanOptions(context: AccessContext) {
  if (context.scope !== 'platform') return false;
  return canAccessResource({
    context,
    resource: 'tenant',
    action: 'read_detail',
  }).allowed;
}

export async function GET(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return lowSensitiveError(401, 'UNAUTHORIZED');
  if (!canReadTenantPlanOptions(context)) return lowSensitiveError(403, 'FORBIDDEN');

  try {
    const repository = createTenantPlanBindingRepository(getDatabase());
    const payload = await listTenantPlanOptionsService({ repository });
    return NextResponse.json(payload, { status: 200 });
  } catch {
    return lowSensitiveError(503, 'TENANT_PLAN_BINDING_UNAVAILABLE');
  }
}
