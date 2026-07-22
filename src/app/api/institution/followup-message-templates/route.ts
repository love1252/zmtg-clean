import { NextResponse } from 'next/server';

const capabilityDisabledPayload = Object.freeze({
  code: 'capability_disabled',
  error: '随访消息模板能力当前未启用',
});

const noStoreHeaders = Object.freeze({
  'cache-control': 'no-store',
});

/**
 * Template reads stay disabled until an institution-scoped reader is formally released.
 * Do not inspect the request here: capability-off must be side-effect free.
 */
export function GET(_request: Request) {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: noStoreHeaders,
  });
}
