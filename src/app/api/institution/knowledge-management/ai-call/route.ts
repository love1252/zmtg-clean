import { NextResponse } from 'next/server';

const capabilityDisabledPayload = {
  status: 'capability_disabled',
  code: 'institution_ai_call_capability_disabled',
  message: '机构 AI 调用暂未启用。',
} as const;

export async function POST(_request?: Request) {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
