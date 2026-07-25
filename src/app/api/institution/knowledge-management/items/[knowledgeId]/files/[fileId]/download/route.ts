import { NextResponse } from 'next/server';

const capabilityDisabledPayload = Object.freeze({
  status: 'capability_disabled',
  code: 'capability_disabled',
  error: '机构知识库文件下载暂未启用。',
});

export function GET(_request: Request, _context?: unknown) {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
