import { NextResponse } from 'next/server';

import {
  createPlatformAiUsageCreditsRepository,
  listPlatformAiUsageCredits,
} from '@/modules/open-platform/server/ai-usage-credits';
import {
  canAccessResource,
  type AccessContext,
} from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

function lowSensitiveError(status: number, errorCode: string, errors?: string[]) {
  return NextResponse.json({ ok: false, errorCode, ...(errors ? { errors } : {}) }, { status });
}

function canReadPlatformAiUsageCredits(context: AccessContext) {
  if (context.scope !== 'platform') return false;

  return canAccessResource({
    context,
    resource: 'tenant',
    action: 'read_aggregate',
  }).allowed;
}

function requirePlatformAiUsageCreditsAccess(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return { ok: false as const, response: lowSensitiveError(401, 'UNAUTHORIZED') };
  }
  if (!canReadPlatformAiUsageCredits(accessContext)) {
    return { ok: false as const, response: lowSensitiveError(403, 'FORBIDDEN') };
  }

  return { ok: true as const };
}

function getRepository() {
  return createPlatformAiUsageCreditsRepository(getDatabase());
}

export async function GET(request: Request) {
  const access = requirePlatformAiUsageCreditsAccess(request);
  if (!access.ok) return access.response;

  const params = new URL(request.url).searchParams;
  try {
    const result = await listPlatformAiUsageCredits({
      repository: getRepository(),
      filters: {
        tenantId: params.get('tenantId'),
        status: params.get('status'),
        meteringStatus: params.get('meteringStatus'),
        provider: params.get('provider'),
        model: params.get('model'),
        dateFrom: params.get('dateFrom'),
        dateTo: params.get('dateTo'),
        limit: params.get('limit'),
      },
    });

    if (result.status === 'validation_failed') {
      return lowSensitiveError(400, 'VALIDATION_FAILED', result.errors);
    }

    return NextResponse.json(result.response, { status: 200 });
  } catch {
    return lowSensitiveError(503, 'AI_USAGE_CREDITS_UNAVAILABLE');
  }
}
