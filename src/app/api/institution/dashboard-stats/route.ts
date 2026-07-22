import { NextResponse } from 'next/server';

const legacyDashboardStatsDisabled = Object.freeze({
  error: '旧经营看板统计不提供机构级经营分析数据',
  code: 'legacy_dashboard_stats_disabled',
});

/**
 * This retired tenant/demo endpoint must never inspect untrusted requests or legacy data.
 */
export function GET(_request?: Request) {
  return NextResponse.json(legacyDashboardStatsDisabled, {
    status: 410,
    headers: { 'Cache-Control': 'no-store' },
  });
}
