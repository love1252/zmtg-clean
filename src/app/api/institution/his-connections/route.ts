import { NextResponse } from 'next/server';

const capabilityDisabledBody = Object.freeze({
  code: 'institution_his_connections_capability_disabled',
  error: 'HIS 连接管理能力暂未启用。',
});

function capabilityDisabledResponse() {
  return NextResponse.json(capabilityDisabledBody, {
    status: 503,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function GET() {
  return capabilityDisabledResponse();
}

export async function POST() {
  return capabilityDisabledResponse();
}
