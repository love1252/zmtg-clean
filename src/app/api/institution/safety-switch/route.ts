import { NextResponse } from 'next/server';

const capabilityDisabledPayload = Object.freeze({
  code: 'capability_disabled',
  error: '安全开关能力当前未启用。',
});

function capabilityDisabledResponse() {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function GET(_request: Request) {
  return capabilityDisabledResponse();
}

export function PATCH(_request: Request) {
  return capabilityDisabledResponse();
}
