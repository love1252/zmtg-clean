import { NextResponse } from 'next/server';

const capabilityDisabledResponseContent = Object.freeze({
  code: 'capability_disabled',
  error: '机构 AI 调用记录能力暂未启用。',
});

export async function GET() {
  return NextResponse.json(capabilityDisabledResponseContent, {
    status: 503,
    headers: { 'cache-control': 'no-store' },
  });
}
