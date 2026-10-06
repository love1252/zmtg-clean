import { NextResponse } from 'next/server';

import { readCurrentInstitutionCustomerSourceEvidenceV1 } from '@/server/orchestration/institution-excel-import-runtime';

const headers = Object.freeze({ 'cache-control': 'no-store' });

export async function GET(request: Request, context: Readonly<{
  params: Promise<{ customerId: string }>;
}>) {
  if ([...new URL(request.url).searchParams.keys()].length !== 0) {
    return NextResponse.json({ code: 'invalid_customer_source_query' }, { status: 400, headers });
  }
  const { customerId } = await context.params;
  const result = await readCurrentInstitutionCustomerSourceEvidenceV1(customerId);
  if (result.kind === 'ready') return NextResponse.json(result, { status: 200, headers });
  const status = result.kind === 'forbidden' ? 403 : result.kind === 'not_found' ? 404 : 503;
  return NextResponse.json({ code: result.code }, { status, headers });
}
