'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock3,
  Gauge,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  getInstitutionAiServiceUsage,
  type InstitutionAiServiceUsageClientError,
  type InstitutionAiServiceUsagePreset,
  type InstitutionAiServiceUsageResponse,
} from '@/modules/institution/client/institution-ai-service-usage-client';
import { InstitutionPageState } from '@/modules/institution/components/InstitutionPageState';
import { InstitutionSectionHeader } from '@/modules/institution/components/InstitutionSectionHeader';
import { cn } from '@/shared/utils/cn';

type AiServiceUsageLoadState =
  | { status: 'loading' }
  | { status: 'error'; error: InstitutionAiServiceUsageClientError }
  | { status: 'loaded'; data: InstitutionAiServiceUsageResponse };

const presetOptions = [
  { value: 'currentMonth', label: '本月' },
  { value: 'last7days', label: '近 7 天' },
  { value: 'lastMonth', label: '上月' },
] as const satisfies Array<{
  value: InstitutionAiServiceUsagePreset;
  label: string;
}>;

const metricToneClasses = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
} as const;

const quotaStatusLabels: Record<string, string> = {
  active: '正常',
  warning: '接近额度',
  overLimit: '已超出',
  expired: '已过期',
  unlinked: '未接入',
};

const quotaWarningLevelLabels: Record<string, string> = {
  none: '无',
  low: '低',
  medium: '中',
  high: '高',
  exceeded: '已超出',
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatPercent(value: number | null | undefined) {
  return `${typeof value === 'number' && Number.isFinite(value) ? value : 0}%`;
}

function formatQuotaNumber(value: number | null | undefined) {
  return value === null || value === undefined ? '未设置' : formatNumber(value);
}

function formatQuotaDateRange(periodStart: string | null, periodEnd: string | null) {
  if (!periodStart || !periodEnd) return '未设置周期';
  return `${periodStart} 至 ${periodEnd}`;
}

function formatDateLabel(value: string) {
  const parts = value.split('-');
  return parts.length === 3 ? `${parts[1]}-${parts[2]}` : value;
}

function isEmptyUsage(data: InstitutionAiServiceUsageResponse) {
  return (
    data.summary.totalUsageCount === 0
    && data.trend.length === 0
    && data.serviceProjects.length === 0
  );
}

export function InstitutionAiServiceUsageShell() {
  const [preset, setPreset] = useState<InstitutionAiServiceUsagePreset>('currentMonth');
  const [reloadKey, setReloadKey] = useState(0);
  const [loadState, setLoadState] = useState<AiServiceUsageLoadState>({ status: 'loading' });

  useEffect(() => {
    let isActive = true;

    async function load() {
      setLoadState({ status: 'loading' });
      const result = await getInstitutionAiServiceUsage({ preset });
      if (!isActive) return;

      if (result.ok) {
        setLoadState({ status: 'loaded', data: result.data });
        return;
      }

      setLoadState({ status: 'error', error: result.error });
    }

    void load();

    return () => {
      isActive = false;
    };
  }, [preset, reloadKey]);

  const data = loadState.status === 'loaded' ? loadState.data : null;
  const maxTrendValue = useMemo(() => {
    if (!data || data.trend.length === 0) return 1;
    return Math.max(...data.trend.map((item) => Math.max(item.usageCount, item.aiServiceUnitsUsed)), 1);
  }, [data]);

  const summary = data?.summary;
  const unfinishedCount = summary ? summary.failedCount + summary.rejectedCount : 0;

  const metrics = [
    {
      label: 'AI 服务使用次数',
      value: formatNumber(summary?.totalUsageCount ?? 0),
      helper: `成功 ${formatNumber(summary?.succeededCount ?? 0)} · 未完成 ${formatNumber(unfinishedCount)}`,
      icon: Activity,
      tone: 'blue',
    },
    {
      label: 'AI 服务额度使用量',
      value: formatNumber(summary?.aiServiceUnitsUsed ?? 0),
      helper: '仅展示服务额度使用，不展示套餐扣减',
      icon: Gauge,
      tone: 'violet',
    },
    {
      label: '成功率',
      value: formatPercent(summary?.successRate ?? 0),
      helper: '基于当前时间范围内的使用记录',
      icon: CheckCircle2,
      tone: 'emerald',
    },
    {
      label: '未完成调用',
      value: formatNumber(unfinishedCount),
      helper: '包含失败和已拒绝记录',
      icon: Clock3,
      tone: 'amber',
    },
  ] as const;

  return (
    <section className="space-y-5">
      <InstitutionSectionHeader
        eyebrow="AI 服务"
        title="AI 服务使用"
        description="面向机构的只读 AI 服务使用视图，仅展示低敏服务用量、趋势和服务项目排行。"
        tone="blue"
        action={
          <div className="flex flex-wrap gap-2">
            {presetOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPreset(option.value)}
                className={cn(
                  'inline-flex h-9 items-center justify-center rounded-full border px-4 text-sm font-semibold transition',
                  preset === option.value
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'border-slate-200 bg-white/86 text-slate-600 hover:border-blue-200 hover:text-blue-700',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      />

      {loadState.status === 'loading' ? (
        <InstitutionPageState kind="loading" title="正在加载 AI 服务使用数据..." />
      ) : null}

      {loadState.status === 'error' ? (
        <InstitutionPageState
          kind="unavailable"
          title="AI 服务使用数据暂时不可用"
          description="请稍后刷新重试。"
          action={
            <button
              type="button"
              onClick={() => setReloadKey((current) => current + 1)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              <RefreshCw className="h-4 w-4" />
              重新加载
            </button>
          }
        />
      ) : null}

      {data ? (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <article
                  key={metric.label}
                  className="rounded-[22px] border border-white/80 bg-white/82 p-5 shadow-sm backdrop-blur-xl"
                >
                  <div
                    className={cn(
                      'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                      metricToneClasses[metric.tone],
                    )}
                  >
                    {metric.label}
                  </div>
                  <div className="mt-4 flex items-start gap-3">
                    <div
                      className={cn(
                        'grid h-10 w-10 shrink-0 place-items-center rounded-2xl border',
                        metricToneClasses[metric.tone],
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-3xl font-semibold tracking-normal text-slate-950">
                        {metric.value}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{metric.helper}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {!data.quota.isLinked ? (
            <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="font-semibold">套餐额度暂未接入</div>
                  <p className="mt-1">
                    当前仅展示 AI 服务使用情况，不显示剩余额度，也不代表套餐已经发生扣减。
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <section className="rounded-[24px] border border-blue-100 bg-blue-50/80 p-5 text-sm leading-6 text-blue-900 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-blue-700">套餐 AI 服务额度</p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-950">只读额度视图</h3>
                  <p className="mt-2 text-slate-600">
                    当前为只读额度视图，不代表真实扣减，不代表财务账单；超出额度仅显示状态，不阻断服务、不触发扣减或告警。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-xs font-semibold text-blue-700">
                    状态：{quotaStatusLabels[data.quota.status] ?? data.quota.status}
                  </span>
                  <span className="rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-xs font-semibold text-amber-700">
                    warningLevel：{quotaWarningLevelLabels[data.quota.warningLevel] ?? data.quota.warningLevel}
                  </span>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border border-white/80 bg-white/78 p-4">
                  <div className="text-xs text-slate-400">总额度</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-950">
                    {formatQuotaNumber(data.quota.totalAllowance)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{data.quota.displayUnit}</div>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/78 p-4">
                  <div className="text-xs text-slate-400">已用</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-950">
                    {formatQuotaNumber(data.quota.used)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">只读统计</div>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/78 p-4">
                  <div className="text-xs text-slate-400">剩余</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-950">
                    {formatQuotaNumber(data.quota.remaining)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">不代表可用扣减余额</div>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/78 p-4">
                  <div className="text-xs text-slate-400">使用率</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-950">
                    {formatPercent(data.quota.usageRate)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">mock 口径展示</div>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/78 p-4">
                  <div className="text-xs text-slate-400">周期</div>
                  <div className="mt-1 text-base font-semibold text-slate-950">
                    {formatQuotaDateRange(data.quota.periodStart, data.quota.periodEnd)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">仅用于展示</div>
                </div>
              </div>
            </section>
          )}

          {isEmptyUsage(data) ? (
            <InstitutionPageState
              kind="empty"
              title="暂无 AI 服务使用记录"
              description={preset === 'currentMonth' ? '本月暂无使用记录' : '当前时间范围暂无使用记录'}
            />
          ) : (
            <>
              <section className="rounded-[24px] border border-white/80 bg-white/82 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-blue-600">使用趋势</p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-950">AI 服务使用趋势</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      按日期展示使用次数和 AI 服务额度使用量。
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                    <BarChart3 className="h-4 w-4" />
                    {data.period.from} 至 {data.period.to}
                  </div>
                </div>

                {data.trend.length === 0 ? (
                  <InstitutionPageState
                    kind="empty"
                    title="本月暂无使用记录"
                    description="当前时间范围内还没有可展示的趋势数据。"
                    className="mt-4"
                  />
                ) : (
                  <div className="mt-5 space-y-3" aria-label="AI 服务使用趋势">
                    {data.trend.map((item) => (
                      <div
                        key={item.date}
                        className="grid gap-3 rounded-2xl border border-slate-100 bg-white/76 p-3 sm:grid-cols-[88px_1fr_auto]"
                      >
                        <div className="text-sm font-semibold text-slate-700">
                          {formatDateLabel(item.date)}
                        </div>
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-600"
                              style={{
                                width: `${Math.max((item.usageCount / maxTrendValue) * 100, item.usageCount > 0 ? 8 : 0)}%`,
                              }}
                            />
                          </div>
                          <div className="h-2.5 w-24 overflow-hidden rounded-full bg-violet-50">
                            <div
                              className="h-full rounded-full bg-violet-500"
                              style={{
                                width: `${Math.max((item.aiServiceUnitsUsed / maxTrendValue) * 100, item.aiServiceUnitsUsed > 0 ? 8 : 0)}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-slate-600">
                          {formatNumber(item.usageCount)} 次 · 额度 {formatNumber(item.aiServiceUnitsUsed)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-[24px] border border-white/80 bg-white/82 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
                <div>
                  <p className="text-sm font-semibold text-blue-600">服务项目排行</p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-950">AI 服务项目使用排行</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    智能随访相关项目仅在已有使用记录中出现时展示。
                  </p>
                </div>

                {data.serviceProjects.length === 0 ? (
                  <InstitutionPageState
                    kind="empty"
                    title="暂无 AI 服务使用记录"
                    description="当前时间范围内暂无服务项目排行。"
                    className="mt-4"
                  />
                ) : (
                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    {data.serviceProjects.map((project) => (
                      <article
                        key={`${project.serviceCategory}-${project.serviceName}`}
                        className="rounded-2xl border border-slate-100 bg-white/78 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h4 className="text-base font-semibold text-slate-950">
                              {project.serviceName}
                            </h4>
                            <p className="mt-1 text-sm text-slate-500">
                              服务分类：{project.serviceCategory}
                            </p>
                          </div>
                          <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            占比 {formatPercent(project.sharePercent)}
                          </span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                          <div>
                            <div className="text-xs text-slate-400">使用次数</div>
                            <div className="mt-1 font-semibold text-slate-900">
                              {formatNumber(project.usageCount)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400">成功率</div>
                            <div className="mt-1 font-semibold text-slate-900">
                              {formatPercent(project.successRate)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400">额度使用量</div>
                            <div className="mt-1 font-semibold text-slate-900">
                              {formatNumber(project.aiServiceUnitsUsed)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400">未完成</div>
                            <div className="mt-1 font-semibold text-slate-900">
                              {formatNumber(project.failedCount + project.rejectedCount)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-blue-600"
                            style={{ width: `${Math.min(Math.max(project.sharePercent, 0), 100)}%` }}
                          />
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
