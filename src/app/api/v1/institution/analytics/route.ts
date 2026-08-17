import { NextResponse } from 'next/server';

import {
  readCurrentInstitutionAnalyticsOverviewV1,
} from '@/server/orchestration/institution-analytics-overview-reader';

const NO_STORE_HEADERS = Object.freeze({ 'cache-control': 'no-store' } as const);
const INVALID_QUERY = Object.freeze({ code: 'invalid_analytics_overview_query' });
const FORBIDDEN = Object.freeze({ code: 'institution_analytics_overview_forbidden' });
const UNAVAILABLE = Object.freeze({ code: 'institution_analytics_overview_unavailable' });

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

  if ([...searchParams.keys()].length !== 0) {
    return NextResponse.json(INVALID_QUERY, {
      status: 400,
      headers: NO_STORE_HEADERS,
    });
  }

  const result = await readCurrentInstitutionAnalyticsOverviewV1();
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

  return NextResponse.json(result.overview, {
    status: 200,
    headers: NO_STORE_HEADERS,
  });
}
