import {
  withInstitutionObjectRouteGuardV1,
} from '@/app/api/institution/_shared/institution-route-guard';

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

async function GET(
  _request: Request,
  _context: CustomerTimelineRouteContext,
) {
  return NextResponse.json(customerTimelineReadDisabled, {
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
    context: CustomerTimelineRouteContext,
  ) {
    const params = await context.params;
    return params.customerId;
  },
  handler: GET,
});

export { guardedGET as GET };
