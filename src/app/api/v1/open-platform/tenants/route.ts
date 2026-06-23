import { NextResponse } from 'next/server';

import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { createTenantPlanBindingRepository } from '@/modules/open-platform/server/tenant-plan-binding-repository';
import { createTenantWithPlanService } from '@/modules/open-platform/server/tenant-plan-binding-service';
import { getDatabase } from '@/server/db/client';

function lowSensitiveError(status: number, errorCode: string) {
  return NextResponse.json({ ok: false, errorCode }, { status });
}

function canCreateTenantWithPlan(context: AccessContext) {
  if (context.scope !== 'platform') return false;
  return canAccessResource({
    context,
    resource: 'tenant',
    action: 'manage_status',
  }).allowed;
}

async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return lowSensitiveError(401, 'UNAUTHORIZED');
  if (!canCreateTenantWithPlan(context)) return lowSensitiveError(403, 'FORBIDDEN');

  try {
    const payload = await readJsonBody(request);
    const repository = createTenantPlanBindingRepository(getDatabase());
    const result = await createTenantWithPlanService({
      repository,
      actorId: context.userId,
      payload,
    });

    if (result.status === 'validation_error') {
      return NextResponse.json({ ok: false, ...result }, { status: 400 });
    }
    if (result.status === 'not_found') {
      return lowSensitiveError(404, result.errorCode);
    }

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch {
    return lowSensitiveError(503, 'TENANT_PLAN_BINDING_UNAVAILABLE');
  }
}
