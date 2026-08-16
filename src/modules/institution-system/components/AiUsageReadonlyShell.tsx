import Link from 'next/link';

import type {
  AiUsageMetrics,
} from '@/modules/institution-system/domain/ai-usage-metrics';

type Preset =
  | 'today'
  | 'last7days'
  | 'currentMonth'
  | 'lastMonth';

const presetLinks = Object.freeze([
  {
    value: 'today' as const,
    label: '今天',
  },
  {
    value: 'last7days' as const,
    label: '近 7 天',
  },
  {
    value: 'currentMonth' as const,
    label: '本月',
  },
  {
    value: 'lastMonth' as const,
    label: '上月',
  },
]);

const serviceLabels = Object.freeze({
  conversation_ai: '会话 AI',
  knowledge_qa: '知识问答',
  analytics_report: 'AI 经营报告',
} as const);

function formatRate(
  value: number | null,
) {
  if (value === null) {
    return '暂无可计算成功率';
  }

  return `${(value * 100).toFixed(1)}%`;
}

function formatServiceUnits(
  value: number | null,
) {
  return value === null
    ? '暂无可靠用量单位'
    : String(value);
}

export function AiUsageReadonlyShell({
  metrics,
  preset,
}: Readonly<{
  metrics: AiUsageMetrics;
  preset: Preset;
}>) {
  const empty = metrics.totalCallCount === 0;

  return (
    <section
      aria-labelledby="ai-usage-title"
      className="mx-auto w-full max-w-6xl space-y-6"
    >
      <header className="space-y-2">
        <h1
          id="ai-usage-title"
          className="text-2xl font-semibold text-slate-950"
        >
          AI 使用概览
        </h1>
        <p className="text-sm leading-6 text-slate-600">
          仅展示当前机构范围内的低敏 AI 使用统计。
        </p>
      </header>

      <nav
        aria-label="AI 使用统计时间范围"
        className="flex flex-wrap gap-2"
      >
        {presetLinks.map((item) => (
          <Link
            key={item.value}
            href={`/hospital/system/ai-usage?preset=${item.value}`}
            aria-current={
              item.value === preset
                ? 'page'
                : undefined
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {empty ? (
        <div
          data-ai-usage-state="empty"
          className="rounded-2xl border border-slate-200 bg-white p-6"
        >
          <h2 className="text-base font-semibold text-slate-900">
            暂无正式 AI 使用记录
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            当前所选时间范围内没有可用的正式 AI 使用记录。
          </p>
        </div>
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <dt className="text-sm text-slate-500">
                调用总量
              </dt>
              <dd className="mt-2 text-2xl font-semibold text-slate-950">
                {metrics.totalCallCount}
              </dd>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <dt className="text-sm text-slate-500">
                服务单位
              </dt>
              <dd className="mt-2 text-lg font-semibold text-slate-950">
                {formatServiceUnits(metrics.serviceUnits)}
              </dd>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <dt className="text-sm text-slate-500">
                成功率
              </dt>
              <dd className="mt-2 text-lg font-semibold text-slate-950">
                {formatRate(metrics.successRate.value)}
              </dd>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <dt className="text-sm text-slate-500">
                失败
              </dt>
              <dd className="mt-2 text-2xl font-semibold text-slate-950">
                {metrics.failureCount}
              </dd>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <dt className="text-sm text-slate-500">
                拒绝
              </dt>
              <dd className="mt-2 text-2xl font-semibold text-slate-950">
                {metrics.rejectionCount}
              </dd>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <dt className="text-sm text-slate-500">
                未完成
              </dt>
              <dd className="mt-2 text-2xl font-semibold text-slate-950">
                {metrics.incompleteCount}
              </dd>
            </div>
          </dl>

          <section
            aria-labelledby="ai-usage-services-title"
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <h2
              id="ai-usage-services-title"
              className="text-base font-semibold text-slate-900"
            >
              按业务服务查看
            </h2>

            <div className="mt-4 space-y-3">
              {metrics.byServiceKey.map((item) => (
                <dl
                  key={item.serviceKey}
                  className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-5"
                >
                  <div>
                    <dt className="text-xs text-slate-500">
                      服务
                    </dt>
                    <dd className="text-sm font-medium text-slate-900">
                      {
                        serviceLabels[
                          item.serviceKey as keyof typeof serviceLabels
                        ] ?? item.serviceKey
                      }
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-slate-500">
                      调用
                    </dt>
                    <dd className="text-sm text-slate-900">
                      {item.totalCallCount}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-slate-500">
                      服务单位
                    </dt>
                    <dd className="text-sm text-slate-900">
                      {formatServiceUnits(item.serviceUnits)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-slate-500">
                      失败 / 拒绝
                    </dt>
                    <dd className="text-sm text-slate-900">
                      {item.failureCount} / {item.rejectionCount}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-slate-500">
                      成功率
                    </dt>
                    <dd className="text-sm text-slate-900">
                      {formatRate(item.successRate.value)}
                    </dd>
                  </div>
                </dl>
              ))}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
