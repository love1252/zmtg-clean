import { NextResponse } from 'next/server';

import { readCurrentInstitutionOpportunitiesV1 } from '@/server/orchestration/institution-opportunity-reader';

export async function GET(request: Request) {
  const result = await readCurrentInstitutionOpportunitiesV1(new URL(request.url).searchParams);
  const headers = { 'cache-control': 'no-store' };
  if (result.kind === 'ready') return NextResponse.json(result, { status: 200, headers });
  const status = result.kind === 'invalid_query' ? 400 : result.kind === 'forbidden' ? 403 : 503;
  return NextResponse.json({ code: 'institution_opportunities_' + result.kind }, { status, headers });
}
