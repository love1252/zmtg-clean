import { NextResponse } from 'next/server';
import {
  createWeComPlatformGovernancePayload,
  parseWeComPlatformGovernancePayload,
} from '@/modules/open-platform/domain/wecom-customer-data-governance';
import {
  canAccessResource,
  type AccessContext,
} from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

function canReadGovernance(context: AccessContext) {
  if (context.scope !== 'platform') return false;
  return canAccessResource({
    context,
    resource: 'tenant',
    action: 'read_aggregate',
  }).allowed;
}

export function GET(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }
  if (!canReadGovernance(context)) {
    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  const payload = parseWeComPlatformGovernancePayload(
    createWeComPlatformGovernancePayload(),
  );
  if (!payload) {
    return NextResponse.json(
      { error: '治理摘要未通过安全校验' },
      { status: 503 },
    );
  }

  return NextResponse.json(payload, { status: 200 });
}
