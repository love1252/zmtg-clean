import { NextResponse } from 'next/server';

const capabilityDisabledPayload = Object.freeze({
  code: 'capability_disabled',
  error: '企业微信客户联系只读凭据能力当前未启用',
});

const noStoreHeaders = Object.freeze({
  'Cache-Control': 'no-store',
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
