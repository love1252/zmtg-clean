import { NextResponse } from 'next/server';

const capabilityDisabledResponseContent = Object.freeze({
  code: 'capability_disabled',
  error: 'HIS 连接测试能力暂未启用。',
});

export async function POST() {
  return NextResponse.json(capabilityDisabledResponseContent, {
    status: 503,
    headers: { 'cache-control': 'no-store' },
  });
}
