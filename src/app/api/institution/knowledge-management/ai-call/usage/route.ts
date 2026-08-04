import { withInstitutionSectionRouteGuardV1 } from '@/app/api/institution/_shared/institution-route-guard';

import { NextResponse } from 'next/server';

const capabilityDisabledResponseContent = Object.freeze({
  code: 'capability_disabled',
  error: '机构 AI 调用记录能力暂未启用。',
});

async function GET() {
  return NextResponse.json(capabilityDisabledResponseContent, {
    status: 503,
    headers: { 'cache-control': 'no-store' },
  });
}

const _base02B4GuardedGET = withInstitutionSectionRouteGuardV1({
  sectionId: 'knowledge',
  handler: GET,
});

export { _base02B4GuardedGET as GET };
