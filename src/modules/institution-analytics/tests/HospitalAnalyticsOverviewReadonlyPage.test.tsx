import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  AnalyticsOverviewReadonlyShell,
} from '@/modules/institution-analytics/components/AnalyticsOverviewReadonlyShell';

const emptyOverview = {
  contractVersion: 'v1' as const,
  preset: 'month' as const,
  comparisonMode: 'previous_equal_length_period' as const,
  timeZone: 'Asia/Shanghai',
  defaultCurrency: 'CNY',
  asOfBusinessDate: '2026-08-17',
  currentPeriod: {
    startDate: '2026-08-01',
    endDateExclusive: '2026-08-18',
    localDayCount: 17,
  },
  previousPeriod: {
    startDate: '2026-07-15',
    endDateExclusive: '2026-08-01',
    localDayCount: 17,
  },
  dataState: 'empty' as const,
  currencies: [],
};

describe('Hospital Analytics overview readonly page', () => {
  it('权威空态明确说明不使用替代数据补零', () => {
    render(<AnalyticsOverviewReadonlyShell overview={emptyOverview} />);

    expect(
      screen.getByRole('heading', { name: '经营总览' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('analytics-overview-empty')).toHaveTextContent(
      '暂无正式经营事实',
    );
    expect(screen.getByTestId('analytics-overview-empty')).toHaveTextContent(
      '不会使用平台商业记录、治疗摘要或演示数据补零',
    );
  });

  it('canonical page 固定 analytics section 与 page_analytics_overview authority', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/hospital/analytics/page.tsx'),
      'utf8',
    );

    expect(source).toContain("const TARGET_SECTION_ID = 'analytics' as const;");
    expect(source).toContain(
      "const TARGET_CAPABILITY_KEY = 'page_analytics_overview' as const;",
    );
    expect(source).toContain(
      "capability.safeSummary !== '经营总览仅供查看'",
    );
    expect(source).not.toContain("preset: 'custom'");
    expect(source).not.toContain('AI 经营报告');
  });
});
