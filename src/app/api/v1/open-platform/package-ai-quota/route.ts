import { NextResponse } from 'next/server';

import {
  canAccessResource,
  type AccessContext,
} from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { listPlatformPackageAiQuotaReadonly } from '@/modules/open-platform/server/package-ai-quota-readonly';

function lowSensitiveError(status: number, errorCode: string) {
  return NextResponse.json({ ok: false, errorCode }, { status });
}

function canReadPackageAiQuota(context: AccessContext) {
  if (context.scope !== 'platform') return false;
  return canAccessResource({
    context,
    resource: 'tenant',
    action: 'read_detail',
  }).allowed;
}

function requirePackageAiQuotaAccess(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return { ok: false as const, response: lowSensitiveError(401, 'UNAUTHORIZED') };
  }
  if (!canReadPackageAiQuota(accessContext)) {
    return { ok: false as const, response: lowSensitiveError(403, 'FORBIDDEN') };
  }

  return { ok: true as const };
}

export async function GET(request: Request) {
  const access = requirePackageAiQuotaAccess(request);
  if (!access.ok) return access.response;

  try {
    const params = new URL(request.url).searchParams;
    const payload = listPlatformPackageAiQuotaReadonly({
      filters: {
        tenantId: params.get('tenantId'),
        packageCode: params.get('packageCode'),
        quotaStatus: params.get('quotaStatus'),
      },
    });
    return NextResponse.json(payload, { status: 200 });
  } catch {
    return lowSensitiveError(503, 'PACKAGE_AI_QUOTA_READONLY_UNAVAILABLE');
  }
}
