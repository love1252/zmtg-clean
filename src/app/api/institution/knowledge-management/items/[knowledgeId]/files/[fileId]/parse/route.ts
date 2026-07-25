import { NextResponse } from 'next/server';

const capabilityDisabledPayload = Object.freeze({
  status: 'capability_disabled',
  code: 'knowledge_file_parse_capability_disabled',
  error: '机构知识库文件解析暂未启用。',
});

function capabilityDisabledResponse() {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function GET(_request: Request, _context?: unknown) {
  return capabilityDisabledResponse();
}

export function POST(_request: Request, _context?: unknown) {
  return capabilityDisabledResponse();
}
