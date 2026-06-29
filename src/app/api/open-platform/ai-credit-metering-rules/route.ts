import { NextResponse } from 'next/server';

import {
  createPlatformAiCreditMeteringRule,
  createPlatformAiCreditMeteringRulesRepository,
  listPlatformAiCreditMeteringRules,
} from '@/modules/open-platform/server/ai-credit-metering-rules-management';
import {
  canAccessResource,
  type AccessContext,
} from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

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

function getRepository() {
  return createPlatformAiCreditMeteringRulesRepository(getDatabase());
}

function parseEnabled(value: string | null) {
  if (value === null) return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const access = requirePlatformRuleManagementAccess(request);
  if (!access.ok) return access.response;

  const params = new URL(request.url).searchParams;
  const enabled = parseEnabled(params.get('enabled'));
  if (enabled === undefined) {
    return lowSensitiveError(400, 'VALIDATION_FAILED');
  }

  try {
    const result = await listPlatformAiCreditMeteringRules({
      repository: getRepository(),
      filters: {
        provider: params.get('provider'),
        model: params.get('model'),
        enabled,
      },
    });

    return NextResponse.json(result, { status: 200 });
  } catch {
    return lowSensitiveError(503, 'METERING_RULES_UNAVAILABLE');
  }
}

export async function POST(request: Request) {
  const access = requirePlatformRuleManagementAccess(request);
  if (!access.ok) return access.response;

  const payload = await readJsonBody(request);
  if (!payload) return lowSensitiveError(400, 'VALIDATION_FAILED');

  try {
    const result = await createPlatformAiCreditMeteringRule({
      repository: getRepository(),
      payload: payload as Record<string, unknown>,
    });

    if (result.status === 'validation_failed') {
      return NextResponse.json({ ok: false, errorCode: 'VALIDATION_FAILED', errors: result.errors }, { status: 400 });
    }
    if (result.status === 'conflict') {
      return lowSensitiveError(409, result.errorCode);
    }

    return NextResponse.json({ record: result.record }, { status: 201 });
  } catch {
    return lowSensitiveError(503, 'METERING_RULES_UNAVAILABLE');
  }
}
