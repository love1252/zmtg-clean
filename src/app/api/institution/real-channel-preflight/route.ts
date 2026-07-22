import { NextResponse } from 'next/server';

const capabilityDisabledPayload = Object.freeze({
  code: 'capability_disabled',
  error: '真实渠道前置检查能力当前未启用。',
});

function capabilityDisabledResponse() {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function GET() {
  return capabilityDisabledResponse();
}

export function POST() {
  return capabilityDisabledResponse();
}
