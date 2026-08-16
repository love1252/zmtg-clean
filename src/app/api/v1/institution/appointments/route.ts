import { NextResponse } from 'next/server';

import { readCurrentInstitutionAppointmentsV1 } from '@/server/orchestration/institution-appointment-list-reader';

const NO_STORE_HEADERS = Object.freeze({ 'cache-control': 'no-store' } as const);
const INVALID_QUERY = Object.freeze({ code: 'invalid_appointment_query' });
const FORBIDDEN = Object.freeze({
  code: 'institution_appointment_list_forbidden',
});
const UNAVAILABLE = Object.freeze({
  code: 'institution_appointment_list_unavailable',
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

  const result = await readCurrentInstitutionAppointmentsV1(searchParams);
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
