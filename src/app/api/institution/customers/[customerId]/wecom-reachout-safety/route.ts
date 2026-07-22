import { NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

const capabilityDisabledPayload = Object.freeze({
  code: 'capability_disabled',
  error: '客户企业微信触达许可能力暂未启用',
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

/**
 * Capability-off until a formally released institution/object guard and consent write chain exist.
 * Request, route params, session, body, persistence, transaction, and audit dependencies stay untouched.
 */
export function GET(_request: Request, _context: RouteContext) {
  return capabilityDisabledResponse();
}

/**
 * Capability-off until a formally released institution/object guard and consent write chain exist.
 * Request, route params, session, body, persistence, transaction, and audit dependencies stay untouched.
 */
export function POST(_request: Request, _context: RouteContext) {
  return capabilityDisabledResponse();
}
