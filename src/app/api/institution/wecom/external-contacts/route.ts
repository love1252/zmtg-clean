import { NextResponse } from 'next/server';
import { createWeComExternalContactReadonlyApiPayload } from '@/modules/institution/view-models/wecom-external-contact-readonly-view-model';
import type { WeComExternalContactReadonlyScenario } from '@/modules/institution/view-models/wecom-external-contact-readonly-view-model';
import { canAccessResource } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

const readonlyScenarios = [
  'ready',
  'provider_disabled',
  'external_disabled',
  'not_configured',
  'revoked',
  'expired',
] as const satisfies readonly WeComExternalContactReadonlyScenario[];

function scenarioFromRequest(request: Request): WeComExternalContactReadonlyScenario {
  const scenario = new URL(request.url).searchParams.get('scenario');
  return readonlyScenarios.includes(scenario as WeComExternalContactReadonlyScenario)
    ? scenario as WeComExternalContactReadonlyScenario
    : 'ready';
}

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
  if (!decision.allowed || !context.tenantId) {
    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  return NextResponse.json(createWeComExternalContactReadonlyApiPayload({
    tenantId: context.tenantId,
    scenario: scenarioFromRequest(request),
  }));
}
