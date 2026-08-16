import { NextResponse } from 'next/server';

import {
  readCurrentInstitutionAiUsageMetricsV1,
} from '@/server/orchestration/institution-ai-usage-metrics-reader';

const NO_STORE_HEADERS = Object.freeze({
  'cache-control': 'no-store',
} as const);

const INVALID_QUERY = Object.freeze({
  code: 'invalid_ai_usage_query',
});
const FORBIDDEN = Object.freeze({
  code: 'institution_ai_usage_forbidden',
});
const UNAVAILABLE = Object.freeze({
  code: 'institution_ai_usage_unavailable',
});

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

  const result =
    await readCurrentInstitutionAiUsageMetricsV1(
      searchParams,
    );

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
    result.metrics,
    {
      status: 200,
      headers: NO_STORE_HEADERS,
    },
  );
}
