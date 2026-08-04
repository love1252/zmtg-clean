import { withInstitutionSectionRouteGuardV1 } from '@/app/api/institution/_shared/institution-route-guard';

import { NextResponse } from 'next/server';

function GET(_request: Request) {
  return NextResponse.json(
    {
      code: 'capability_disabled',
      error: '企业微信官方 dry-run 能力当前未启用',
    },
    {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}

const _base02B4GuardedGET = withInstitutionSectionRouteGuardV1({
  sectionId: 'conversations',
  handler: GET,
});

export { _base02B4GuardedGET as GET };
