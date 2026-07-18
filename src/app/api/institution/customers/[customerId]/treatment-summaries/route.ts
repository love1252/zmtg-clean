import { NextResponse } from 'next/server';

type TreatmentSummaryCreateRouteContext = {
  params: Promise<{ customerId: string }>;
};

const treatmentSummaryCreateDisabled = Object.freeze({
  code: 'capability_disabled',
  error: '客户治疗摘要创建能力暂未启用',
});

/**
 * Capability-off until a formally released institution/object guard and write chain exist.
 * Request, route params, session, body, persistence, and audit dependencies stay untouched.
 */
export function POST(
  _request: Request,
  _context: TreatmentSummaryCreateRouteContext,
) {
  return NextResponse.json(treatmentSummaryCreateDisabled, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
