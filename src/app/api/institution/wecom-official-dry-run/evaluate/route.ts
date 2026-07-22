import { NextResponse } from 'next/server';

export function POST(_request: Request) {
  return NextResponse.json(
    {
      code: 'capability_disabled',
      error: '企业微信官方 dry-run 评估能力当前未启用',
    },
    {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
