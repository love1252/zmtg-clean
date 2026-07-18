import { NextResponse } from 'next/server';

const noStoreHeaders = { 'cache-control': 'no-store' } as const;

export function POST(
  _request: Request,
  _routeContext: { params: Promise<{ mappingId: string }> },
) {
  return NextResponse.json(
    { code: 'capability_disabled' },
    { status: 503, headers: noStoreHeaders },
  );
}
