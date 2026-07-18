import { NextResponse } from 'next/server';

const NO_STORE_HEADERS = { 'cache-control': 'no-store' } as const;

type RouteContext = { params: Promise<{ draftId: string }> };

function capabilityDisabledResponse() {
  return NextResponse.json(
    {
      code: 'capability_disabled',
      error: '企业微信受控触达能力当前未启用',
    },
    { status: 503, headers: NO_STORE_HEADERS },
  );
}

export function GET(_request: Request, _context: RouteContext) {
  return capabilityDisabledResponse();
}

export function POST(_request: Request, _context: RouteContext) {
  return capabilityDisabledResponse();
}
