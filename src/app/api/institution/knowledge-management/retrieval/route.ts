import { NextResponse } from 'next/server';

const capabilityDisabledPayload = Object.freeze({
  status: 'capability_disabled',
  code: 'knowledge_retrieval_capability_disabled',
  message: '机构知识库检索暂未启用。',
});

const noStoreHeaders = { 'Cache-Control': 'no-store' } as const;

export async function GET(_request: Request) {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: noStoreHeaders,
  });
}
