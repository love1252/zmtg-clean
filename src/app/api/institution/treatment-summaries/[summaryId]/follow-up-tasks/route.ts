import { NextResponse } from 'next/server';

type TreatmentFollowUpTaskRouteContext = {
  params: Promise<{ summaryId: string }>;
};

const disabledResponse = Object.freeze({
  code: 'capability_disabled',
  error: '治疗摘要创建随访任务能力暂未启用',
});

const noStoreHeaders = Object.freeze({
  'cache-control': 'no-store',
});

/**
 * Source-task creation remains disabled until its institution-scoped write boundary is formalized.
 * Do not inspect request or context: capability-off must not authorize, parse, persist, or audit.
 */
export async function POST(
  _request: Request,
  _context: TreatmentFollowUpTaskRouteContext,
) {
  return NextResponse.json(disabledResponse, {
    status: 503,
    headers: noStoreHeaders,
  });
}
