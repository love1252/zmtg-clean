import {
  withInstitutionObjectRouteGuardV1,
} from '@/app/api/institution/_shared/institution-route-guard';

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
 * The shared guard authorizes customers/customer/read before this handler.
 * The existing capability-disabled response remains unchanged.
 */
async function GET(
  _request: Request,
  _context: RouteContext,
) {
  return NextResponse.json(customerFollowUpTimelineReadDisabled, {
    status: 503,
    headers: noStoreHeaders,
  });
}

const guardedGET = withInstitutionObjectRouteGuardV1({
  sectionId: 'customers',
  objectType: 'customer',
  action: 'read',
  async resolveObjectId(
    _request: Request,
    context: RouteContext,
  ) {
    const params = await context.params;
    return params.customerId;
  },
  handler: GET,
});

export { guardedGET as GET };
