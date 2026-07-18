import { NextResponse } from 'next/server';

const noStoreHeaders = { 'cache-control': 'no-store' } as const;

function capabilityDisabledResponse() {
  return NextResponse.json(
    { code: 'capability_disabled', error: '随访消息草稿能力当前未启用' },
    { status: 503, headers: noStoreHeaders },
  );
}

export function GET(_request: Request) {
  return capabilityDisabledResponse();
}

export function POST(_request: Request) {
  return capabilityDisabledResponse();
}
