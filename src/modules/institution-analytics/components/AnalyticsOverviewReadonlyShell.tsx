'use client';

import type {
  AnalyticsOverviewV1,
} from '@/modules/institution-analytics/application/institution/analytics-overview-reader';
import {
  InstitutionV11DateRangeControl,
  InstitutionV11PageHeader,
  InstitutionV11Tabs,
} from '@/modules/institution-v11/components/InstitutionV11Ui';

function currencyDivisor(currency: string) {
  try {
    const formatter = new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency,
    });
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    const divisor = 10 ** digits;
    return Number.isSafeInteger(divisor) && divisor > 0 ? divisor : 1;
  } catch {
    return 1;
  }
}

function formatMinor(value: number | null, currency: string) {
  if (value === null || !Number.isFinite(value)) return '--';
  try {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value / currencyDivisor(currency));
  } catch {
    return '--';
  }
}

function formatAverage(
  value: Readonly<{ numeratorMinor: number; denominator: number }> | null,
  currency: string,
) {
  if (!value || value.denominator <= 0) return '--';
  return formatMinor(value.numeratorMinor / value.denominator, currency);
}

function formatPercent(
  comparison: Readonly<{
    status: string;
    percentageRatio: Readonly<{ numerator: string; denominator: string }> | null;
  }>,
) {
  if (comparison.status !== 'comparable' || !comparison.percentageRatio) return '--';
  const numerator = Number(comparison.percentageRatio.numerator);
  const denominator = Number(comparison.percentageRatio.denominator);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return '--';
  }
  return new Intl.NumberFormat('zh-CN', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(numerator / denominator);
}

export function AnalyticsOverviewReadonlyShell({
  overview,
}: Readonly<{ overview: AnalyticsOverviewV1 }>) {
  return (
    <section className="space-y-6" aria-labelledby="analytics-overview-title">
      <div id="analytics-overview-title">
        <InstitutionV11PageHeader
          eyebrow="BUSINESS ANALYTICS"
          title="经营总览"
          description={`本月截至 ${overview.asOfBusinessDate}，对比上一等长周期。金额按币种独立呈现，不跨币种合计。`}
          breadcrumbs={[{ label: '机构端', href: '/hospital' }, { label: '经营分析' }, { label: '经营总览' }]}
          state="READ_ONLY"
          actions={<InstitutionV11DateRangeControl label="本月" />}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <InstitutionV11Tabs
          label="经营分析页面"
          activeId="overview"
          onChange={() => undefined}
          items={[
            { id: 'overview', label: '经营总览' },
            { id: 'customers', label: '客户分析', disabled: true, reason: '需要页面级 Capability' },
            { id: 'appointments', label: '预约与服务', disabled: true, reason: '需要页面级 Capability' },
            { id: 'followups', label: '随访与触达', disabled: true, reason: '需要页面级 Capability' },
            { id: 'ai', label: 'AI 与自动化', disabled: true, reason: '需要页面级 Capability' },
            { id: 'strategy', label: '经营策略', disabled: true, reason: '经营策略模型未开放' },
          ]}
        />
      </div>

      {overview.dataState === 'empty' ? (
        <div
          className="border border-slate-200 bg-white p-6"
          data-testid="analytics-overview-empty"
        >
          <h2 className="font-medium text-slate-900">暂无正式经营事实</h2>
          <p className="mt-2 text-sm text-slate-600">
            当前机构尚无已批准的正式消费、成功支付或确认退款事实；页面不会使用平台商业记录、治疗摘要或演示数据补零。
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {overview.currencies.map((item) => {
            const metrics = [
              {
                label: '成功实付',
                value: formatMinor(item.current.paidAmountMinor, item.currency),
                comparison: formatPercent(item.comparisons.paidAmountMinor),
              },
              {
                label: '确认退款',
                value: formatMinor(item.current.refundAmountMinor, item.currency),
                comparison: formatPercent(item.comparisons.refundAmountMinor),
              },
              {
                label: '净额',
                value: formatMinor(item.current.netAmountMinor, item.currency),
                comparison: formatPercent(item.comparisons.netAmountMinor),
              },
              {
                label: '付费客户',
                value: item.current.paidCustomerCount === null
                  ? '--'
                  : String(item.current.paidCustomerCount),
                comparison: formatPercent(item.comparisons.paidCustomerCount),
              },
              {
                label: '客单价',
                value: formatAverage(
                  item.current.averageNetAmountPerPaidCustomer,
                  item.currency,
                ),
                comparison: formatPercent(
                  item.comparisons.averageNetAmountPerPaidCustomer,
                ),
              },
            ];

            return (
              <section
                key={item.currency}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                aria-label={`${item.currency} 经营指标`}
              >
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="font-semibold text-slate-950">{item.currency}</h2>
                  <span className="text-xs text-slate-500">对比上一等长周期</span>
                </div>
                <div className="grid gap-3 md:grid-cols-5">
                  {metrics.map((metric) => (
                    <article key={metric.label} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                      <p className="text-xs text-slate-500">{metric.label}</p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">
                        {metric.value}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        环比 {metric.comparison}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        <span>数据来源：正式消费事实聚合</span>
        <span>统计口径：成功支付与确认退款</span>
        <span>更新时间：{overview.asOfBusinessDate}</span>
        <span>新鲜度：按当前 Reader 返回</span>
      </footer>
    </section>
  );
}
