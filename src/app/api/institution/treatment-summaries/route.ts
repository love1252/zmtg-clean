import { NextResponse } from 'next/server';

const treatmentSummaryListReadDisabled = Object.freeze({
  code: 'treatment_summary_list_capability_disabled',
  error: '治疗记录列表能力暂未启用',
});
const noStoreHeaders = Object.freeze({
  'cache-control': 'no-store',
});

/**
 * No request data is inspected until an institution-scoped treatment reader exists.
 * This deliberately avoids demo-session, database, repository, audit, and fetch side effects.
 */
export async function GET(_request: Request) {
  return NextResponse.json(treatmentSummaryListReadDisabled, {
    status: 503,
    headers: noStoreHeaders,
  });
}
