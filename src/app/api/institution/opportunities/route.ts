import { NextResponse } from 'next/server';

const legacyOpportunityPoolDisabled = Object.freeze({
  error: '旧机会池不提供机构级经营分析数据',
  code: 'legacy_opportunity_pool_disabled',
});

/**
 * This retired tenant/demo endpoint must never inspect untrusted requests or legacy data.
 */
export function GET(_request: Request) {
  return NextResponse.json(legacyOpportunityPoolDisabled, {
    status: 410,
    headers: { 'Cache-Control': 'no-store' },
  });
}
