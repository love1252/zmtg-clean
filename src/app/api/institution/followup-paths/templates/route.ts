import { NextResponse } from 'next/server';

const noStoreHeaders = { 'cache-control': 'no-store' } as const;
const capabilityDisabledPayload = Object.freeze({
  code: 'capability_disabled',
  error: '随访路径模板能力暂未启用',
});

export function GET(_request: Request) {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: noStoreHeaders,
  });
}
