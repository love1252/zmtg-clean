import { withInstitutionSectionRouteGuardV1 } from '@/app/api/institution/_shared/institution-route-guard';

import { NextResponse } from 'next/server';

const noStoreHeaders = { 'cache-control': 'no-store' } as const;
const capabilityDisabledPayload = Object.freeze({
  code: 'capability_disabled',
  error: '随访路径模板能力暂未启用',
});

function GET(_request: Request) {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: noStoreHeaders,
  });
}

const _base02B4GuardedGET = withInstitutionSectionRouteGuardV1({
  sectionId: 'care',
  handler: GET,
});

export { _base02B4GuardedGET as GET };
