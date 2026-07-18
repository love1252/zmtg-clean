import { NextResponse } from 'next/server';

const capabilityDisabledPayload = Object.freeze({
  status: 'capability_disabled',
  code: 'knowledge_retrieval_capability_disabled',
  message: '机构知识库检索暂未启用。',
});

export async function GET(_request?: Request) {
  return NextResponse.json(capabilityDisabledPayload, { status: 503 });
}
