import { NextResponse } from 'next/server';

export async function GET(_request?: Request) {
  return NextResponse.json(
    {
      error: '旧经营看板统计不提供机构级经营分析数据',
      code: 'legacy_dashboard_stats_disabled',
    },
    { status: 410 },
  );
}
