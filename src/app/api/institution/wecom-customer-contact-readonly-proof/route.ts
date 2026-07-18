import { NextResponse } from 'next/server';

const noStoreHeaders = Object.freeze({ 'cache-control': 'no-store' } as const);

const capabilityDisabledPayload = Object.freeze({
  code: 'capability_disabled',
  error: '企业微信客户联系只读证明能力暂未启用。',
});

function capabilityDisabledResponse() {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: noStoreHeaders,
  });
}

export function GET(_request: Request) {
  return capabilityDisabledResponse();
}

export function POST(_request: Request) {
  return capabilityDisabledResponse();
}
