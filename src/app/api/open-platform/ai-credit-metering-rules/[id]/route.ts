import { NextResponse } from 'next/server';

import {
  createPlatformAiCreditMeteringRulesRepository,
  patchPlatformAiCreditMeteringRule,
} from '@/modules/open-platform/server/ai-credit-metering-rules-management';
import {
  canAccessResource,
  type AccessContext,
} from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function lowSensitiveError(status: number, errorCode: string) {
  return NextResponse.json({ ok: false, errorCode }, { status });
}

function canManageAiCreditMeteringRules(context: AccessContext) {
  if (context.scope !== 'platform') return false;

  return canAccessResource({
    context,
    resource: 'tenant',
    action: 'manage_status',
  }).allowed;
}

function requirePlatformRuleManagementAccess(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return { ok: false as const, response: lowSensitiveError(401, 'UNAUTHORIZED') };
  }
  if (!canManageAiCreditMeteringRules(accessContext)) {
    return { ok: false as const, response: lowSensitiveError(403, 'FORBIDDEN') };
  }

  return { ok: true as const };
}

async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = requirePlatformRuleManagementAccess(request);
  if (!access.ok) return access.response;

  const [params, payload] = await Promise.all([context.params, readJsonBody(request)]);
  if (!payload) return lowSensitiveError(400, 'VALIDATION_FAILED');

  try {
    const result = await patchPlatformAiCreditMeteringRule({
      repository: createPlatformAiCreditMeteringRulesRepository(getDatabase()),
      id: params.id,
      payload: payload as Record<string, unknown>,
    });

    if (result.status === 'validation_failed') {
      return NextResponse.json({ ok: false, errorCode: 'VALIDATION_FAILED', errors: result.errors }, { status: 400 });
    }
    if (result.status === 'not_found') {
      return lowSensitiveError(404, result.errorCode);
    }

    return NextResponse.json({ record: result.record }, { status: 200 });
  } catch {
    return lowSensitiveError(503, 'METERING_RULES_UNAVAILABLE');
  }
}
