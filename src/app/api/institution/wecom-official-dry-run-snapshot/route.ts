import { NextResponse } from 'next/server';

const NO_STORE_HEADERS = { 'cache-control': 'no-store' } as const;

function capabilityDisabledResponse() {
  return NextResponse.json(
    {
      code: 'capability_disabled',
      error: '企业微信 dry-run 快照能力当前未启用',
    },
    { status: 503, headers: NO_STORE_HEADERS },
  );
}

export function GET(_request: Request) {
  return capabilityDisabledResponse();
}

export function POST(_request: Request) {
  return capabilityDisabledResponse();
}
