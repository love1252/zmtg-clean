import { NextResponse } from 'next/server';

const noStoreHeaders = { 'cache-control': 'no-store' } as const;
const capabilityDisabledPayload = Object.freeze({
  code: 'capability_disabled',
  error: '随访路径取消能力暂未启用',
});

export function POST(
  _request: Request,
  _context: { params: Promise<{ enrollmentId: string }> },
) {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: noStoreHeaders,
  });
}
