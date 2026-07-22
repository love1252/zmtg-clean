import { NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

const customerFollowUpTimelineReadDisabled = Object.freeze({
  code: 'customer_followup_timeline_capability_disabled',
  error: '客户随访时间线能力暂未启用',
});
const noStoreHeaders = Object.freeze({
  'cache-control': 'no-store',
});

/**
 * No request or route data is inspected until an institution-scoped reader exists.
 * This deliberately avoids demo-session, database, repository, service, audit, and fetch side effects.
 */
export async function GET(_request: Request, _context: RouteContext) {
  return NextResponse.json(customerFollowUpTimelineReadDisabled, {
    status: 503,
    headers: noStoreHeaders,
  });
}
