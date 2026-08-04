import { withInstitutionSectionRouteGuardV1 } from '@/app/api/institution/_shared/institution-route-guard';

import { NextResponse } from 'next/server';

const noStoreHeaders = { 'cache-control': 'no-store' } as const;
const capabilityDisabledPayload = Object.freeze({ code: 'capability_disabled' });

function GET(_request: Request) {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: noStoreHeaders,
  });
}

const _base02B4GuardedGET = withInstitutionSectionRouteGuardV1({
  sectionId: 'conversations',
  handler: GET,
});

export { _base02B4GuardedGET as GET };
