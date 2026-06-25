import { NextResponse } from 'next/server';

import { createPlanCatalogRepository } from '@/modules/open-platform/server/plan-catalog-repository';
import {
  canAccessResource,
  type AccessContext,
} from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

type AccessMode = 'read' | 'manage';

export function lowSensitivePlanCatalogError(status: number, errorCode: string) {
  return NextResponse.json({ ok: false, errorCode }, { status });
}

export function getPlanCatalogRepository() {
  return createPlanCatalogRepository(getDatabase());
}

function canUsePlanCatalog(context: AccessContext, mode: AccessMode) {
  if (context.scope !== 'platform') return false;
  return canAccessResource({
    context,
    resource: 'tenant',
    action: mode === 'read' ? 'read_detail' : 'manage_status',
  }).allowed;
}

export function requirePlanCatalogAccess(request: Request, mode: AccessMode) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return {
      ok: false as const,
      response: lowSensitivePlanCatalogError(401, 'UNAUTHORIZED'),
    };
  }
  if (!canUsePlanCatalog(accessContext, mode)) {
    return {
      ok: false as const,
      response: lowSensitivePlanCatalogError(403, 'FORBIDDEN'),
    };
  }

  return { ok: true as const, accessContext };
}

export async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function planCatalogMutationResponse(
  result:
    | { status: 'validation_error'; errors: string[] }
    | { status: 'not_found'; errorCode: string }
    | { status: 'invalid_transition'; errorCode: string }
    | { status: 'draft_created' | 'draft_saved' | 'published' | 'retired'; version: unknown },
) {
  if (result.status === 'validation_error') {
    return NextResponse.json(result, { status: 400 });
  }
  if (result.status === 'not_found') {
    return lowSensitivePlanCatalogError(404, result.errorCode);
  }
  if (result.status === 'invalid_transition') {
    return lowSensitivePlanCatalogError(409, result.errorCode);
  }

  return NextResponse.json(result, { status: 200 });
}
