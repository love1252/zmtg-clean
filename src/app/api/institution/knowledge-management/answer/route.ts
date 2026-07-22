import { NextResponse } from 'next/server';

const capabilityDisabledPayload = Object.freeze({
  status: 'capability_disabled',
  code: 'knowledge_capability_disabled',
  answer: '机构知识库问答暂未启用。仅供内部运营参考，需人工确认',
  sources: [],
});

/**
 * This endpoint is intentionally capability-off. It must not inspect request
 * data or initialize authentication, persistence, retrieval, quota, or AI.
 */
export async function POST(_request?: Request) {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
