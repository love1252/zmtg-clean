import { NextResponse } from 'next/server';

const capabilityDisabledPayload = Object.freeze({
  status: 'capability_disabled',
  code: 'knowledge_indexing_jobs_capability_disabled',
  error: '机构知识库索引任务暂未启用。',
});

export function GET(_request: Request) {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function POST(_request: Request) {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
