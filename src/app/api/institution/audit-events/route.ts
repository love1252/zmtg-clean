import { withInstitutionSectionRouteGuardV1 } from '@/app/api/institution/_shared/institution-route-guard';

import { NextResponse } from 'next/server';

const institutionAuditEventsReadDisabled = Object.freeze({
  code: 'institution_audit_events_capability_disabled',
  error: '机构审计日志能力暂未启用',
});

/**
 * No request data is inspected until an institution-scoped audit reader exists.
 * This deliberately avoids demo-session, authorization, query parsing, database, repository, and fetch side effects.
 */
async function GET(_request: Request) {
  return NextResponse.json(institutionAuditEventsReadDisabled, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}

const _base02B4GuardedGET = withInstitutionSectionRouteGuardV1({
  sectionId: 'system',
  handler: GET,
});

export { _base02B4GuardedGET as GET };
