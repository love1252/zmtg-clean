import { NextResponse } from 'next/server';

const disabledListResponse = Object.freeze({
  code: 'follow_up_path_enrollment_list_capability_disabled',
  error: '随访路径实例列表能力暂未启用',
});

const disabledCreationResponse = Object.freeze({
  code: 'capability_disabled',
  error: '随访路径纳入能力暂未启用',
});

const noStoreHeaders = Object.freeze({
  'cache-control': 'no-store',
});

/**
 * This endpoint remains disabled until the list has a formal institution-scoped reader.
 * Do not inspect the request here: a disabled list must not trigger session, data,
 * audit, or service side effects from untrusted input.
 */
export async function GET(_request: Request) {
  return NextResponse.json(disabledListResponse, { status: 503 });
}

/**
 * Enrollment creation remains disabled until its institution-scoped write boundary is formalized.
 * Do not inspect the request here: capability-off must be side-effect free.
 */
export async function POST(_request: Request) {
  return NextResponse.json(disabledCreationResponse, {
    status: 503,
    headers: noStoreHeaders,
  });
}
