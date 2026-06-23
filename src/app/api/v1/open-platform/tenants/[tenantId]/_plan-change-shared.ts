import { NextResponse } from 'next/server';

import { createTenantPlanChangeRepository } from '@/modules/open-platform/server/tenant-plan-change-repository';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

export type TenantPlanChangeRouteContext = {
  params: Promise<{ tenantId: string }>;
};

export function lowSensitiveTenantPlanChangeError(status: number, errorCode: string) {
  return NextResponse.json({ ok: false, errorCode }, { status });
}

function canManageTenantPlanChange(context: AccessContext) {
  if (context.scope !== 'platform') return false;
  return canAccessResource({
    context,
    resource: 'tenant',
    action: 'manage_status',
  }).allowed;
}

export function requireTenantPlanChangeAccess(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return {
      ok: false as const,
      response: lowSensitiveTenantPlanChangeError(401, 'UNAUTHORIZED'),
    };
  }
  if (!canManageTenantPlanChange(accessContext)) {
    return {
      ok: false as const,
      response: lowSensitiveTenantPlanChangeError(403, 'FORBIDDEN'),
    };
  }

  return { ok: true as const, accessContext };
}

export function getTenantPlanChangeRepository() {
  return createTenantPlanChangeRepository(getDatabase());
}

export async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function tenantPlanChangeMutationResponse(
  result:
    | { status: 'validation_error'; errors: string[] }
    | { status: 'not_found'; errorCode: string }
    | { status: 'invalid_transition'; errorCode: string }
    | { status: 'preview_ready'; preview: unknown }
    | {
        status: 'plan_changed';
        changeRecordId: string;
        auditEventId: string;
        tenant: unknown;
      },
) {
  if (result.status === 'validation_error') {
    return NextResponse.json({ ok: false, ...result }, { status: 400 });
  }
  if (result.status === 'not_found') {
    return lowSensitiveTenantPlanChangeError(404, result.errorCode);
  }
  if (result.status === 'invalid_transition') {
    return lowSensitiveTenantPlanChangeError(409, result.errorCode);
  }

  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}
