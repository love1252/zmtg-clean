import { NextResponse } from 'next/server';

const capabilityOffBody = Object.freeze({
  code: 'institution_ai_usage_capability_off',
  error: 'AI 服务使用能力当前未开放。',
});

export async function GET(_request: Request) {
  return NextResponse.json(capabilityOffBody, {
    status: 410,
    headers: { 'Cache-Control': 'no-store' },
  });
}
