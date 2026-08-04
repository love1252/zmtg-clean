import { withInstitutionSectionRouteGuardV1 } from '@/app/api/institution/_shared/institution-route-guard';

import { NextResponse } from 'next/server';

const followUpOperationsDashboardReadDisabled = Object.freeze({
  code: 'follow_up_operations_dashboard_capability_disabled',
  error: '随访运营看板能力暂未启用',
});
const noStoreHeaders = Object.freeze({
  'cache-control': 'no-store',
});

/**
 * No request data is inspected until an institution-scoped dashboard reader exists.
 * This deliberately avoids demo-session, database, repository, service, audit, and fetch side effects.
 */
async function GET(_request: Request) {
  return NextResponse.json(followUpOperationsDashboardReadDisabled, {
    status: 503,
    headers: noStoreHeaders,
  });
}

const _base02B4GuardedGET = withInstitutionSectionRouteGuardV1({
  sectionId: 'care',
  handler: GET,
});

export { _base02B4GuardedGET as GET };
