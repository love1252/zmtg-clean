'use client';

import { AlertTriangle, CheckCircle2, Database, RefreshCw, Shield, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PlatformSectionBanner } from '@/modules/open-platform/components/PlatformSectionBanner';

type TrialOverview = {
  tenantCount: number;
  customerCount: number;
  appointmentCount: number;
  treatmentSummaryCount: number;
  followUpTaskCount: number;
  commercialRecordCount: number;
  auditEventCount: number;
};

type OverviewState =
  | { status: 'loading' }
  | { status: 'loaded'; overview: TrialOverview }
  | { status: 'error'; errorCode: string };

type ResetState =
  | { status: 'idle' }
  | { status: 'confirming' }
  | { status: 'resetting' }
  | { status: 'completed'; deletedCounts: Record<string, number> }
  | { status: 'no_data'; note: string }
  | { status: 'error'; errorCode: string };

const metricLabels: Array<{ key: keyof TrialOverview; label: string; icon: typeof Database }> = [
  { key: 'tenantCount', label: '机构数', icon: Database },
  { key: 'customerCount', label: '客户数', icon: Database },
  { key: 'appointmentCount', label: '预约数', icon: Database },
  { key: 'treatmentSummaryCount', label: '治疗摘要数', icon: Database },
  { key: 'followUpTaskCount', label: '随访任务数', icon: Database },
  { key: 'commercialRecordCount', label: '商业记录数', icon: Database },
  { key: 'auditEventCount', label: '关联审计事件数', icon: Database },
];

export function TrialDataResetPanel() {
  const [overviewState, setOverviewState] = useState<OverviewState>({ status: 'loading' });
  const [resetState, setResetState] = useState<ResetState>({ status: 'idle' });

  const refreshOverview = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/open-platform/trial-data-reset', {
        cache: 'no-store',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setOverviewState({ status: 'error', errorCode: body.errorCode ?? 'UNKNOWN' });
        return;
      }
      const data = await response.json();
      if (data.ok && data.overview) {
        setOverviewState({ status: 'loaded', overview: data.overview as TrialOverview });
      } else {
        setOverviewState({ status: 'error', errorCode: data.errorCode ?? 'UNKNOWN' });
      }
    } catch {
      setOverviewState({ status: 'error', errorCode: 'FETCH_FAILED' });
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    async function fetchOverview() {
      try {
        const response = await fetch('/api/v1/open-platform/trial-data-reset', {
          cache: 'no-store',
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          if (isActive) setOverviewState({ status: 'error', errorCode: body.errorCode ?? 'UNKNOWN' });
          return;
        }
        const data = await response.json();
        if (isActive) {
          if (data.ok && data.overview) {
            setOverviewState({ status: 'loaded', overview: data.overview as TrialOverview });
          } else {
            setOverviewState({ status: 'error', errorCode: data.errorCode ?? 'UNKNOWN' });
          }
        }
      } catch {
        if (isActive) setOverviewState({ status: 'error', errorCode: 'FETCH_FAILED' });
      }
    }

    void fetchOverview();
    return () => { isActive = false; };
  }, [refreshOverview]);

  const handleReset = async () => {
    setResetState({ status: 'resetting' });
    try {
      const response = await fetch('/api/v1/open-platform/trial-data-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'RESET' }),
      });
      const data = await response.json();
      if (data.ok) {
        if (data.status === 'no_tenant_data') {
          setResetState({ status: 'no_data', note: (data as { note: string }).note });
        } else {
          setResetState({
            status: 'completed',
            deletedCounts: (data as { deletedCounts: Record<string, number> }).deletedCounts,
          });
        }
        refreshOverview();
      } else {
        setResetState({ status: 'error', errorCode: (data as { errorCode: string }).errorCode ?? 'UNKNOWN' });
      }
    } catch {
      setResetState({ status: 'error', errorCode: 'FETCH_FAILED' });
    }
  };

  const hasData =
    overviewState.status === 'loaded' && overviewState.overview.tenantCount > 0;

  return (
    <section className="space-y-6">
      <PlatformSectionBanner
        headingId="trial-data-reset-heading"
        title="体验数据重置"
        headingLevel="h1"
        description={
          <>
            本功能仅用于<strong>测试服 / 体验版</strong>环境。
            操作为不可逆，请确认当前环境非正式生产后再执行。
            重置后所有机构、客户、随访、商业记录等体验数据将被清除。
          </>
        }
      />

      {/* 安全提示 */}
      <section className="rounded-xl border border-rose-200 bg-rose-50/70 p-5 shadow-sm lg:p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <h2 className="text-base font-semibold text-rose-900">高危操作提醒</h2>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-rose-800">
              <li>• 本操作将清空<strong>所有机构及关联数据</strong>，不可恢复。</li>
              <li>• 仅限测试服 / 体验版环境使用，<strong>不应用于正式生产</strong>。</li>
              <li>• 清理后需重新运行 <code className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-mono">pnpm seed</code> 恢复演示种子数据。</li>
              <li>• 清理后机构端首次登录仍会自动触发体验数据 provision。</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 数据概览 */}
      <section className="rounded-xl border border-[#e6edf5] bg-white p-5 shadow-sm lg:p-6">
        <h2 className="text-lg font-semibold text-slate-950">当前体验数据概览</h2>
        <p className="mt-1 text-sm text-slate-500">以下统计来自当前数据库中所有机构数据。</p>

        {overviewState.status === 'loading' ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metricLabels.map((item) => (
              <div key={item.key} className="animate-pulse rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="h-4 w-16 rounded bg-slate-200" />
                <div className="mt-2 h-8 w-12 rounded bg-slate-300" />
              </div>
            ))}
          </div>
        ) : overviewState.status === 'error' ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            数据概览加载失败（{overviewState.errorCode}），请刷新页面重试。
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metricLabels.map(({ key, label }) => (
              <div key={key} className="rounded-lg border border-[#e6edf5] bg-slate-50/70 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-950">
                  {overviewState.overview[key]}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 操作区 */}
      <section className="rounded-xl border border-[#e6edf5] bg-white p-5 shadow-sm lg:p-6">
        <h2 className="text-lg font-semibold text-slate-950">执行数据重置</h2>
        <p className="mt-1 text-sm text-slate-500">
          清理范围：所有机构、机构账号、客户、预约、治疗摘要、随访任务、商业记录、授权快照、配额快照、审计事件（关联机构部分）。
          不清理：平台管理员账号 platform、套餐目录和版本。
        </p>

        {resetState.status === 'idle' && (
          <button
            type="button"
            onClick={() => setResetState({ status: 'confirming' })}
            disabled={!hasData}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            重置体验数据
          </button>
        )}

        {resetState.status === 'confirming' && (
          <div className="mt-4 rounded-lg border-2 border-rose-300 bg-rose-50 p-5">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-rose-600" />
              <p className="text-sm font-semibold text-rose-900">二次确认</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-rose-800">
              您即将清空所有机构及关联数据，共
              {overviewState.status === 'loaded'
                ? ` ${overviewState.overview.tenantCount} 个机构`
                : ' 未知数量的机构'}
              。此操作不可逆，请确认本环境不是正式生产环境。
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setResetState({ status: 'idle' })}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleReset()}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
              >
                <AlertTriangle className="h-4 w-4" />
                确认重置，不可撤销
              </button>
            </div>
          </div>
        )}

        {resetState.status === 'resetting' && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
            <p className="text-sm font-medium text-blue-800">正在清理体验数据，请勿关闭页面...</p>
          </div>
        )}

        {resetState.status === 'completed' && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-800">体验数据已成功重置。</p>
            </div>
            <div className="rounded-lg border border-[#e6edf5] bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-700">清理摘要</h3>
              <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                {Object.entries(resetState.deletedCounts).map(([key, count]) => (
                  <div key={key} className="flex justify-between">
                    <dt className="text-slate-500">{key}</dt>
                    <dd className="font-mono font-semibold text-slate-800">{String(count)}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <button
              type="button"
              onClick={() => setResetState({ status: 'idle' })}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              完成
            </button>
          </div>
        )}

        {resetState.status === 'no_data' && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <CheckCircle2 className="h-5 w-5 text-slate-500" />
            <p className="text-sm text-slate-600">{resetState.note}</p>
          </div>
        )}

        {resetState.status === 'error' && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            <p className="text-sm text-rose-800">
              重置失败（{resetState.errorCode}），请稍后重试或联系管理员。
            </p>
          </div>
        )}
      </section>

      {/* 范围说明 */}
      <section className="rounded-xl border border-[#e6edf5] bg-white p-5 shadow-sm lg:p-6">
        <h2 className="text-lg font-semibold text-slate-950">清理与不清理范围说明</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-rose-700">
              <Trash2 className="h-4 w-4" />
              清理范围
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-600">
              <li>• 所有机构主体（tenants）</li>
              <li>• 机构管理员账号（authUsers，不含 platform）</li>
              <li>• 机构联系人（tenantContacts）</li>
              <li>• 机构成员（tenantMembers）</li>
              <li>• 客户（customers）</li>
              <li>• 预约（appointments）</li>
              <li>• 治疗摘要（treatmentSummaries）</li>
              <li>• 随访任务（followUpTasks）</li>
              <li>• 商业记录（tenantCommercialRecords）</li>
              <li>• 套餐分配/快照/变更记录</li>
              <li>• 关联机构的审计事件</li>
            </ul>
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <Shield className="h-4 w-4" />
              不清理范围
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-600">
              <li>• 平台管理员账号 platform</li>
              <li>• 套餐目录和套餐版本</li>
              <li>• AI 模型配置</li>
              <li>• 知识库数据</li>
              <li>• HIS 连接配置</li>
              <li>• 首页品牌配置</li>
              <li>• scope=platform 的审计事件</li>
            </ul>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          注：机会池数据基于客户生命周期自动派生，不单独存储，随客户数据清理后自动消失。
        </p>
      </section>
    </section>
  );
}
