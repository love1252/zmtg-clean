import { NextResponse } from 'next/server';

const capabilityDisabledPayload = Object.freeze({
  code: 'capability_disabled',
  error: '当前能力尚未开放',
});

function capabilityDisabledResponse() {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function GET(_request?: Request) {
  return capabilityDisabledResponse();
}

export function POST(_request?: Request) {
  return capabilityDisabledResponse();
}
