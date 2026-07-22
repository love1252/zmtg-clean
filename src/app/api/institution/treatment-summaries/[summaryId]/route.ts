import { NextResponse } from 'next/server';

type TreatmentSummaryUpdateRouteContext = {
  params: Promise<{ summaryId: string }>;
};

const treatmentSummaryUpdateDisabled = Object.freeze({
  code: 'capability_disabled',
  error: '治疗摘要编辑能力暂未启用',
});

/**
 * Capability-off until a formally released institution/object guard and write chain exist.
 * Request, route params, session, RBAC, body, persistence, and audit dependencies stay untouched.
 */
export async function PATCH(
  _request: Request,
  _context: TreatmentSummaryUpdateRouteContext,
) {
  return NextResponse.json(treatmentSummaryUpdateDisabled, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
