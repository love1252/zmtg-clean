import { NextResponse } from 'next/server';

const capabilityDisabledPayload = Object.freeze({
  status: 'capability_disabled',
  code: 'knowledge_indexing_job_capability_disabled',
  error: '机构知识库索引任务详情暂未启用。',
});

export function GET(_request: Request, _context?: unknown) {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
