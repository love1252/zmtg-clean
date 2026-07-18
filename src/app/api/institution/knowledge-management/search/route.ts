import { NextResponse } from 'next/server';

const capabilityDisabledPayload = {
  status: 'capability_disabled',
  code: 'institution_knowledge_search_capability_disabled',
  message: '机构知识库检索暂未启用。',
} as const;

export async function GET(_request?: Request) {
  return NextResponse.json(capabilityDisabledPayload, { status: 503 });
}
