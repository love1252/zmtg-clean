import { NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

const customerFollowUpFeedbackDisabled = Object.freeze({
  code: 'capability_disabled',
  error: '客户随访反馈记录能力暂未启用',
});

/**
 * Capability-off until a formally released institution/object guard and write chain exist.
 * Request, route params, session, body, and all downstream dependencies remain untouched.
 */
export function POST(_request: Request, _context: RouteContext) {
  return NextResponse.json(customerFollowUpFeedbackDisabled, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
