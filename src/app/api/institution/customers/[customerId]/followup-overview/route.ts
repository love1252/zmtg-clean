import { NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

const customerFollowUpOverviewReadDisabled = Object.freeze({
  code: 'customer_followup_overview_capability_disabled',
  error: '客户随访概览能力暂未启用',
});
const noStoreHeaders = Object.freeze({
  'cache-control': 'no-store',
});

/**
 * No request or route data is inspected until an institution-scoped reader exists.
 * This deliberately avoids demo-session, database, repository, service, audit, and fetch side effects.
 */
export async function GET(_request: Request, _context: RouteContext) {
  return NextResponse.json(customerFollowUpOverviewReadDisabled, {
    status: 503,
    headers: noStoreHeaders,
  });
}
