import { withInstitutionSectionRouteGuardV1 } from '@/app/api/institution/_shared/institution-route-guard';

import { NextResponse } from 'next/server';

const capabilityDisabledResponseContent = Object.freeze({
  code: 'capability_disabled',
  error: '机构套餐权益用量能力暂未启用。',
});

async function GET() {
  return NextResponse.json(capabilityDisabledResponseContent, {
    status: 503,
    headers: { 'cache-control': 'no-store' },
  });
}

const _base02B4GuardedGET = withInstitutionSectionRouteGuardV1({
  sectionId: 'system',
  handler: GET,
});

export { _base02B4GuardedGET as GET };
