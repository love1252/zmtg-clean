import { NextResponse } from 'next/server';

const capabilityDisabledPayload = Object.freeze({
  status: 'capability_disabled',
  code: 'capability_disabled',
  error: '机构知识库解析片段暂未启用。',
});

export function GET() {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
