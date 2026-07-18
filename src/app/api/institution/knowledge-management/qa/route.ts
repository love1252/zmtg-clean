import { NextResponse } from 'next/server';

const capabilityDisabledPayload = Object.freeze({
  status: 'capability_disabled',
  code: 'knowledge_qa_capability_disabled',
  answer: '机构知识库问答暂未启用。仅供内部运营参考，需人工确认',
  citations: [],
});

export async function POST(_request?: Request) {
  return NextResponse.json(capabilityDisabledPayload, { status: 503 });
}
