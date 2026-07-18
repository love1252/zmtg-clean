import { NextResponse } from 'next/server';

const capabilityDisabledResponseContent = Object.freeze({
  code: 'capability_disabled',
  error: '机构套餐权益用量能力暂未启用。',
});

export async function GET() {
  return NextResponse.json(capabilityDisabledResponseContent, {
    status: 503,
    headers: { 'cache-control': 'no-store' },
  });
}
