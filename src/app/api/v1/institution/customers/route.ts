
import { NextResponse } from 'next/server';

import { createCurrentInstitutionCustomerControlledV1 } from '@/server/orchestration/institution-customer-controlled-write-runtime';
import { readCurrentInstitutionCustomersV1 } from '@/server/orchestration/institution-customer-list-reader';

const NO_STORE_HEADERS = Object.freeze({ 'cache-control': 'no-store' } as const);
const INVALID_QUERY = Object.freeze({ code: 'invalid_customer_query' });
const FORBIDDEN = Object.freeze({ code: 'institution_customer_list_forbidden' });
const UNAVAILABLE = Object.freeze({ code: 'institution_customer_list_unavailable' });
const MAX_JSON_BODY_BYTES = 8 * 1024;

async function readJsonBody(request: Request): Promise<unknown | null> {
  const contentLength = request.headers.get('content-length');
  if (
    contentLength !== null &&
    (!/^\d+$/u.test(contentLength) || Number(contentLength) > MAX_JSON_BODY_BYTES)
  ) {
    return null;
  }

  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_JSON_BODY_BYTES) {
      return null;
    }
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  let searchParams: URLSearchParams;
  try {
    searchParams = new URL(request.url).searchParams;
  } catch {
    return NextResponse.json(INVALID_QUERY, {
      status: 400,
      headers: NO_STORE_HEADERS,
    });
  }

  const result = await readCurrentInstitutionCustomersV1(searchParams);
  if (result.kind === 'invalid_query') {
    return NextResponse.json(INVALID_QUERY, {
      status: 400,
      headers: NO_STORE_HEADERS,
    });
  }
  if (result.kind === 'forbidden') {
    return NextResponse.json(FORBIDDEN, {
      status: 403,
      headers: NO_STORE_HEADERS,
    });
  }
  if (result.kind !== 'ready') {
    return NextResponse.json(UNAVAILABLE, {
      status: 503,
      headers: NO_STORE_HEADERS,
    });
  }

  return NextResponse.json(
    { records: result.records, pageInfo: result.pageInfo },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (body === null) {
    return NextResponse.json(
      { code: 'invalid_customer_create' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const result = await createCurrentInstitutionCustomerControlledV1(body);
  if (result.kind === 'ready') {
    return NextResponse.json(result, {
      status: 201,
      headers: NO_STORE_HEADERS,
    });
  }

  const status =
    result.kind === 'invalid'
      ? 400
      : result.kind === 'forbidden'
        ? 403
        : result.kind === 'not_found'
          ? 404
          : result.kind === 'conflict' || result.kind === 'quota_denied'
            ? 409
            : 503;

  return NextResponse.json(
    { code: result.code ?? `institution_customer_${result.kind}` },
    { status, headers: NO_STORE_HEADERS },
  );
}
