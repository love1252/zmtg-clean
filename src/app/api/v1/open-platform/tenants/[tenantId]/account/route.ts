import { NextResponse } from 'next/server';

import { manageTenantAccountService } from '@/modules/open-platform/server/tenant-account-management-service';
import { createTenantAccountManagementRepository } from '@/modules/open-platform/server/tenant-account-management-repository';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

type TenantAccountRouteContext = {
  params: Promise<{ tenantId: string }>;
};

function lowSensitiveTenantAccountError(status: number, errorCode: string) {
  return NextResponse.json({ ok: false, errorCode }, { status });
}

function canManageTenantAccount(context: AccessContext) {
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

function tenantAccountMutationResponse(
  result:
    | { status: 'validation_error'; errors: string[] }
    | { status: 'not_found'; errorCode: string }
    | {
        status: 'account_updated';
        action: string;
        auditEventId: string;
        account: unknown;
      },
) {
  if (result.status === 'validation_error') {
    return NextResponse.json({ ok: false, ...result }, { status: 400 });
  }
  if (result.status === 'not_found') {
    return lowSensitiveTenantAccountError(404, result.errorCode);
  }

  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}

export async function PATCH(request: Request, context: TenantAccountRouteContext) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) return lowSensitiveTenantAccountError(401, 'UNAUTHORIZED');
  if (!canManageTenantAccount(accessContext)) {
    return lowSensitiveTenantAccountError(403, 'FORBIDDEN');
  }

  const [params, payload] = await Promise.all([context.params, readJsonBody(request)]);

  try {
    const repository = createTenantAccountManagementRepository(getDatabase());
    const result = await manageTenantAccountService({
      repository,
      actorId: accessContext.userId,
      actorRole: accessContext.role,
      tenantId: params.tenantId,
      payload,
    });

    return tenantAccountMutationResponse(result);
  } catch {
    return lowSensitiveTenantAccountError(503, 'TENANT_ACCOUNT_MANAGEMENT_UNAVAILABLE');
  }
}
