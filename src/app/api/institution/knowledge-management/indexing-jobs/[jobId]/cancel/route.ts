import { NextResponse } from 'next/server';

const capabilityDisabledPayload = Object.freeze({
  status: 'capability_disabled',
  code: 'knowledge_indexing_job_cancel_capability_disabled',
  error: '机构知识库索引任务取消暂未启用。',
});

export function POST(_request?: Request, _context?: unknown) {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
