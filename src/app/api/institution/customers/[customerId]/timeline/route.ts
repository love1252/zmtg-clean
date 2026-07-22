import { NextResponse } from 'next/server';

type CustomerTimelineRouteContext = {
  params: Promise<{ customerId: string }>;
};

const customerTimelineReadDisabled = Object.freeze({
  code: 'customer_timeline_capability_disabled',
  error: '客户完整时间线能力暂未启用',
});
const noStoreHeaders = Object.freeze({
  'cache-control': 'no-store',
});

/**
 * No request or route data is inspected until an institution-scoped reader exists.
 * This deliberately avoids demo-session, database, repository, service, audit, and fetch side effects.
 */
export async function GET(_request: Request, _context: CustomerTimelineRouteContext) {
  return NextResponse.json(customerTimelineReadDisabled, {
    status: 503,
    headers: noStoreHeaders,
  });
}
