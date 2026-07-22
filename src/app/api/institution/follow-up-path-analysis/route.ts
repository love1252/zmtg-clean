import { NextResponse } from 'next/server';

const legacyFollowUpPathAnalysisDisabled = Object.freeze({
  error: '旧随访路径运营分析不提供机构级经营分析数据',
  code: 'legacy_follow_up_path_analysis_disabled',
});

/**
 * This retired endpoint must never inspect untrusted requests or legacy data.
 */
export function GET(_request: Request) {
  return NextResponse.json(legacyFollowUpPathAnalysisDisabled, {
    status: 410,
    headers: { 'Cache-Control': 'no-store' },
  });
}
