import { withInstitutionSectionRouteGuardV1 } from '@/app/api/institution/_shared/institution-route-guard';
import { isInstitutionAuditCoverage } from '@/modules/audit/domain/audit-event-query';
import { parseAuditEventQueryParams } from '@/modules/audit/server/audit-event-query-parser';
import { readCurrentInstitutionAuditEventsV1 } from '@/server/orchestration/institution-audit-reader';
import { NextResponse } from 'next/server';

const institutionAuditEventsUnavailable = Object.freeze({
  code: 'institution_audit_events_service_unavailable',
  error: '机构审计日志服务暂时不可用',
});
const institutionAuditEventsForbidden = Object.freeze({
  code: 'institution_audit_events_forbidden',
  error: '无权读取机构审计日志',
});

async function GET(request: Request) {
  const parsedQuery = parseAuditEventQueryParams(new URL(request.url).searchParams);
  if (!parsedQuery.ok) {
    return NextResponse.json(
      { error: parsedQuery.error },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const result = await readCurrentInstitutionAuditEventsV1(parsedQuery.query);
  if (result.kind === 'forbidden') {
    return NextResponse.json(institutionAuditEventsForbidden, {
      status: 403,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  if (result.kind !== 'ready' || !isInstitutionAuditCoverage(result.coverage)) {
    return NextResponse.json(institutionAuditEventsUnavailable, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return NextResponse.json(
    {
      records: result.records,
      pageInfo: result.pageInfo,
      coverage: result.coverage,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

const _base02B4GuardedGET = withInstitutionSectionRouteGuardV1({
  sectionId: 'system',
  handler: GET,
});

export { _base02B4GuardedGET as GET };
