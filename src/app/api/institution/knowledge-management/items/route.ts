import { NextResponse } from 'next/server';

const capabilityDisabledPayload = Object.freeze({
  status: 'capability_disabled',
  code: 'knowledge_items_capability_disabled',
  message: '机构知识库资料库暂未启用。',
});

export async function GET(_request?: Request) {
  return NextResponse.json(capabilityDisabledPayload, { status: 503 });
}

export async function POST(_request?: Request) {
  return NextResponse.json(capabilityDisabledPayload, { status: 503 });
}

export async function PATCH(_request?: Request) {
  return NextResponse.json(capabilityDisabledPayload, { status: 503 });
}
