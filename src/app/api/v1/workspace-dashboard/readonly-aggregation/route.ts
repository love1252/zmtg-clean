import { NextResponse } from 'next/server';

const noStoreHeaders = { 'cache-control': 'no-store' } as const;

const capabilityDisabledPayload = Object.freeze({
  code: 'capability_disabled',
  error: '工作台聚合能力暂未启用。',
});

/**
 * Keep the legacy aggregation endpoint fail-closed until a formal institution guard and
 * production business providers exist. Request data and demo aggregation builders must not be
 * inspected or initialized here.
 */
export function GET(_request: Request) {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: noStoreHeaders,
  });
}
