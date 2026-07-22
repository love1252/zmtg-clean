import { NextResponse } from 'next/server';

const capabilityDisabledPayload = {
  code: 'capability_disabled',
  error: '企业微信客户联系预检查能力当前未启用',
} as const;

function capabilityDisabledResponse() {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function GET(_request: Request) {
  return capabilityDisabledResponse();
}

export function POST(_request: Request) {
  return capabilityDisabledResponse();
}
