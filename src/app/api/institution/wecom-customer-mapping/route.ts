import { NextResponse } from 'next/server';

const noStoreHeaders = { 'cache-control': 'no-store' } as const;

function capabilityDisabledResponse() {
  return NextResponse.json(
    { code: 'capability_disabled' },
    { status: 503, headers: noStoreHeaders },
  );
}

export function GET(_request: Request) {
  return capabilityDisabledResponse();
}

export function POST(_request: Request) {
  return capabilityDisabledResponse();
}
