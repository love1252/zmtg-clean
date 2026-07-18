import { NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ enrollmentId: string }>;
};

const disabledResponse = Object.freeze({
  code: 'follow_up_path_enrollment_detail_capability_disabled',
  error: '随访路径详情能力暂未启用',
});

/**
 * This endpoint remains disabled until an institution-scoped reader is available.
 * Do not inspect request or route data here: doing so would make a disabled read
 * depend on untrusted input or trigger data, audit, or session side effects.
 */
export async function GET(_request: Request, _context: RouteContext) {
  return NextResponse.json(disabledResponse, { status: 503 });
}
