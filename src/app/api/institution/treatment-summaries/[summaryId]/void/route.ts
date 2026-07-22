import { NextResponse } from 'next/server';

type TreatmentSummaryVoidRouteContext = {
  params: Promise<{ summaryId: string }>;
};

const treatmentSummaryVoidDisabled = Object.freeze({
  code: 'capability_disabled',
  error: '治疗摘要作废能力暂未启用',
});

/**
 * Capability-off until a formally released institution/object guard and write chain exist.
 * Request, route params, session, RBAC, body, persistence, and audit dependencies stay untouched.
 */
export function POST(
  _request: Request,
  _context: TreatmentSummaryVoidRouteContext,
) {
  return NextResponse.json(treatmentSummaryVoidDisabled, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
