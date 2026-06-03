'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  Activity,
  Bell,
  BriefcaseBusiness,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { LogoutButton } from '@/modules/auth/components/LogoutButton';
import { AppointmentCenterShell } from '@/modules/institution/components/AppointmentCenterShell';
import { CustomerCenterShell } from '@/modules/institution/components/CustomerCenterShell';
import { InstitutionAuditEventsShell } from '@/modules/institution/components/InstitutionAuditEventsShell';
import {
  InstitutionPageState,
  getInstitutionPageStateFromClientError,
  type InstitutionPageStateProps,
} from '@/modules/institution/components/InstitutionPageState';
import { SmartFollowUpShell } from '@/modules/institution/components/SmartFollowUpShell';
import { TreatmentSummaryManagementShell } from '@/modules/institution/components/TreatmentSummaryManagementShell';
import {
  listAppointments,
  listCustomers,
  listFollowUpTasks,
  type TenantBusinessClientError,
} from '@/modules/institution/client/tenant-business-client';
import { institutionNavItems } from '@/modules/workspace/domain/institution-dashboard';
import type { InstitutionViewId } from '@/modules/workspace/domain/institution-dashboard';
import {
  buildInstitutionDashboardSummary,
  type InstitutionDashboardMetricKey,
  type InstitutionDashboardSummary,
} from '@/modules/workspace/domain/institution-dashboard-view-models';
import { cn } from '@/shared/utils/cn';

const statToneClasses = {
  blue: 'border-blue-200/80 bg-blue-50/80 text-blue-700',
  violet: 'border-violet-200/80 bg-violet-50/80 text-violet-700',
  emerald: 'border-emerald-200/80 bg-emerald-50/80 text-emerald-700',
  amber: 'border-amber-200/80 bg-amber-50/80 text-amber-700',
};

const metricIcons = {
  customer_total: Users,
  high_priority_customers: BriefcaseBusiness,
  pending_appointments: CalendarCheck,
  due_followups: Clock3,
} satisfies Record<InstitutionDashboardMetricKey, typeof Users>;

const emptyDashboardSummary = buildInstitutionDashboardSummary({
  customers: [],
  appointments: [],
  followUpTasks: [],
});

type DashboardLoadStatus = 'loading' | 'success' | 'error';

const realInstitutionViews = [
  'dashboard',
  'customers',
  'appointments',
  'followups',
  'treatmentSummaries',
  'audit',
] as const satisfies readonly InstitutionViewId[];

function isRealInstitutionView(viewId: InstitutionViewId) {
  return (realInstitutionViews as readonly InstitutionViewId[]).includes(viewId);
}

function navigationBoundaryLabel(viewId: InstitutionViewId) {
  return isRealInstitutionView(viewId) ? '演示主线' : '后续';
}

function navigationBoundaryClasses(viewId: InstitutionViewId) {
  return isRealInstitutionView(viewId)
    ? 'border-emerald-300/30 bg-emerald-300/12 text-emerald-100'
    : 'border-amber-300/30 bg-amber-300/12 text-amber-100';
}

function visibleDashboardErrorState(error: TenantBusinessClientError): InstitutionPageStateProps {
  return getInstitutionPageStateFromClientError(error, {
    forbiddenMessage: '当前账号没有访问机构首页数据的权限',
    fallbackMessage: '机构运营视图暂时无法加载',
    unavailableMessage: '数据服务暂时不可用，请稍后刷新或切换演示备份',
  });
}

function firstDashboardError(
  results: Array<{ ok: true } | { ok: false; error: TenantBusinessClientError }>,
) {
  return results.find(
    (result): result is { ok: false; error: TenantBusinessClientError } => !result.ok,
  )?.error;
}

export function InstitutionWorkspace() {
  const [activeView, setActiveView] = useState<InstitutionViewId>('dashboard');
  const [dashboardSummary, setDashboardSummary] = useState<InstitutionDashboardSummary>(
    emptyDashboardSummary,
  );
  const [dashboardStatus, setDashboardStatus] = useState<DashboardLoadStatus>('loading');
  const [dashboardErrorState, setDashboardErrorState] =
    useState<InstitutionPageStateProps | null>(null);
  const activeNavItem = institutionNavItems.find((item) => item.id === activeView) ?? institutionNavItems[0];
  const highPriorityMetric = dashboardSummary.metrics.find(
    (metric) => metric.key === 'high_priority_customers',
  );
  const highPriorityLabel =
    dashboardStatus === 'loading' ? '--' : highPriorityMetric?.value ?? '0';

  useEffect(() => {
    let isActive = true;

    async function loadDashboardSummary() {
      setDashboardStatus('loading');
      setDashboardErrorState(null);

      const [customerResult, appointmentResult, followUpResult] = await Promise.all([
        listCustomers(),
        listAppointments(),
        listFollowUpTasks(),
      ]);

      if (!isActive) return;

      const error = firstDashboardError([customerResult, appointmentResult, followUpResult]);
      if (error) {
        setDashboardSummary(emptyDashboardSummary);
        setDashboardErrorState(visibleDashboardErrorState(error));
        setDashboardStatus('error');
        return;
      }

      setDashboardSummary(
        buildInstitutionDashboardSummary({
          customers: customerResult.ok ? customerResult.records : [],
          appointments: appointmentResult.ok ? appointmentResult.records : [],
          followUpTasks: followUpResult.ok ? followUpResult.records : [],
        }),
      );
      setDashboardStatus('success');
    }

    void loadDashboardSummary();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <main
      className="min-h-screen bg-[#eef4fb] bg-cover bg-center text-slate-950"
      style={{
        backgroundImage:
          'linear-gradient(110deg, rgba(247,250,255,0.94) 0%, rgba(244,249,255,0.9) 46%, rgba(232,244,251,0.82) 100%), url("/homepage/zmtg-luxury-clinic-bg.png")',
      }}
    >
      <div className="flex min-h-screen">
        <aside className="hidden w-[276px] shrink-0 flex-col border-r border-white/12 bg-[#071322]/95 text-slate-200 shadow-2xl shadow-slate-950/20 md:flex">
          <div className="absolute inset-y-0 left-0 hidden w-[276px] bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:36px_36px] md:block" />
          <div className="relative flex h-[84px] items-center gap-3 border-b border-white/10 px-5">
            <Image src="/brand/logo-mark.png" alt="" width={50} height={50} className="h-[50px] w-[50px] rounded-xl bg-white object-contain p-1.5" />
            <div>
              <div className="text-lg font-semibold tracking-normal text-white">智美天工</div>
              <div className="mt-0.5 text-xs text-slate-400">医美智能运营系统</div>
            </div>
          </div>

          <div className="relative px-5 py-5">
            <label className="relative block" aria-label="搜索占位">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="h-10 w-full rounded-xl border border-white/10 bg-white/8 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-300/70"
                placeholder="搜索暂未接入"
              />
            </label>
          </div>

          <nav className="relative flex-1 space-y-1 overflow-y-auto px-4">
            {institutionNavItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setActiveView(item.id)}
                aria-current={activeView === item.id ? 'page' : undefined}
                className={cn(
                  'flex h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-medium tracking-normal transition',
                  activeView === item.id ? 'bg-blue-500/20 text-cyan-200 ring-1 ring-cyan-300/20' : 'text-slate-300 hover:bg-white/8 hover:text-white',
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                    navigationBoundaryClasses(item.id),
                  )}
                >
                  {navigationBoundaryLabel(item.id)}
                </span>
              </button>
            ))}
          </nav>

          <div className="relative space-y-3 border-t border-white/10 p-5">
            <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">
                    高优先级客户 {highPriorityLabel} 位
                  </div>
                  <div className="mt-1 text-xs text-slate-400">待人工承接客户</div>
                </div>
                <Bell className="h-5 w-5 text-cyan-300" />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/8 px-3 py-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-cyan-400/16 text-sm font-semibold text-cyan-200">管</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">系统管理员</div>
                <div className="text-xs text-slate-400">机构运营账号</div>
              </div>
            </div>
            <LogoutButton
              redirectTo="/login"
              className="flex h-10 w-full rounded-xl text-sm font-semibold text-rose-200 hover:bg-rose-500/10"
            />
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-hidden">
          <nav aria-label="机构端移动导航" className="sticky top-0 z-20 border-b border-white/70 bg-white/84 px-4 py-3 shadow-sm shadow-slate-200/50 backdrop-blur-xl md:hidden">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-500">机构导航</span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
                  高优先级 {highPriorityLabel}
                </span>
                <LogoutButton
                  redirectTo="/login"
                  className="h-8 shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-600"
                >
                  退出工作台
                </LogoutButton>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {institutionNavItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  aria-label={`移动导航：${item.label}`}
                  onClick={() => setActiveView(item.id)}
                  aria-current={activeView === item.id ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold tracking-normal',
                    activeView === item.id ? 'border-blue-200 bg-blue-600 text-white shadow-sm shadow-blue-500/20' : 'border-slate-200 bg-white/76 text-slate-600',
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'ml-0.5 rounded-full border px-1.5 py-0.5 text-[10px]',
                      isRealInstitutionView(item.id)
                        ? activeView === item.id
                          ? 'border-white/30 bg-white/16 text-white'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : activeView === item.id
                          ? 'border-white/30 bg-white/16 text-white'
                          : 'border-amber-200 bg-amber-50 text-amber-700',
                    )}
                  >
                    {navigationBoundaryLabel(item.id)}
                  </span>
                </button>
              ))}
            </div>
          </nav>

          <div className="mx-auto w-full max-w-[1740px] space-y-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-7">
            {activeView === 'dashboard' ? (
              <InstitutionDashboardHome
                errorState={dashboardErrorState}
                status={dashboardStatus}
                summary={dashboardSummary}
              />
            ) : activeView === 'customers' ? (
              <CustomerCenterShell />
            ) : activeView === 'appointments' ? (
              <AppointmentCenterShell />
            ) : activeView === 'followups' ? (
              <SmartFollowUpShell />
            ) : activeView === 'treatmentSummaries' ? (
              <TreatmentSummaryManagementShell />
            ) : activeView === 'audit' ? (
              <InstitutionAuditEventsShell />
            ) : (
              <PlaceholderInstitutionView label={activeNavItem.label} />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function InstitutionDashboardHome({
  errorState,
  status,
  summary,
}: {
  errorState: InstitutionPageStateProps | null;
  status: DashboardLoadStatus;
  summary: InstitutionDashboardSummary;
}) {
  return (
    <>
      <header className="overflow-hidden rounded-[28px] border border-white/80 bg-white/72 p-5 shadow-[0_24px_80px_rgba(32,61,104,0.12)] backdrop-blur-xl lg:p-7">
        <div className="flex flex-col gap-6 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div className="max-w-4xl">
            <div className="flex items-center gap-3 md:hidden">
              <Image
                src="/brand/logo-mark.png"
                alt=""
                width={46}
                height={46}
                className="h-11 w-11 rounded-xl bg-white object-contain p-1"
              />
              <div>
                <div className="font-semibold tracking-normal text-slate-950">智美天工</div>
                <div className="text-xs text-slate-500">机构工作台</div>
              </div>
            </div>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-cyan-50/80 px-3.5 py-1.5 text-xs font-semibold text-cyan-700 md:mt-0">
              <Sparkles className="h-4 w-4" />
              当前为受控 demo 数据
            </div>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-normal text-slate-950 sm:text-5xl lg:text-[60px] xl:text-[64px]">
              <span className="block">今日治疗后随访重点</span>
              <span className="block whitespace-nowrap bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 bg-clip-text text-transparent">
                待人工确认的后续动作
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              客户、预约、随访任务统一进入运营视图，用于演示治疗后服务闭环；当前为受控 demo 数据，不代表外部系统已完成同步。
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 2xl:w-[520px]">
            {[
              { label: '数据范围', value: '当前租户' },
              { label: '演示口径', value: '受控 demo' },
              { label: '后续动作', value: '人工确认' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/80 bg-white/70 p-3 shadow-sm sm:p-4"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-500 sm:h-5 sm:w-5" />
                <div className="mt-2 text-sm font-semibold tracking-normal text-slate-950 sm:mt-3 sm:text-lg">
                  {item.value}
                </div>
                <div className="mt-1 text-[11px] leading-4 text-slate-500 sm:text-xs">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {status === 'loading' ? (
        <InstitutionPageState kind="loading" title="正在加载机构运营摘要..." />
      ) : null}

      {status === 'error' && errorState ? (
        <InstitutionPageState {...errorState} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summary.metrics.map((metric) => {
          const MetricIcon = metricIcons[metric.key];

          return (
            <article
              key={metric.key}
              className="rounded-[22px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div
                  className={cn(
                    'grid h-12 w-12 place-items-center rounded-2xl border',
                    statToneClasses[metric.tone],
                  )}
                >
                  <MetricIcon className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
                  {metric.helper}
                </span>
              </div>
              <div className="mt-5 text-4xl font-semibold tracking-normal text-slate-950">
                {status === 'loading' ? '--' : metric.value}
              </div>
              <div className="mt-1 text-sm font-medium text-slate-500">{metric.label}</div>
            </article>
          );
        })}
      </section>

      {status === 'success' && summary.isEmpty ? (
        <InstitutionPageState
          kind="empty"
          title="暂无可计算运营摘要"
          description="当前没有客户、预约或随访任务可进入运营视图。"
        />
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-normal text-slate-950">
                  近期需要人工处理
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  客户、预约、随访任务统一进入运营视图。
                </p>
              </div>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
              人工确认后处理
            </span>
          </div>

          {status === 'success' && summary.actionItems.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm font-semibold text-slate-500">
              当前没有可展示的待处理行动。
            </div>
          ) : null}

          {summary.actionItems.length > 0 ? (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {summary.actionItems.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-200/80 bg-white/86 p-4"
                >
                  <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">
                    {item.badge}
                  </span>
                  <h3 className="mt-3 text-base font-semibold tracking-normal text-slate-950">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.detail}</p>
                </article>
              ))}
            </div>
          ) : null}
        </article>

        <article className="rounded-[24px] border border-slate-900/90 bg-[#071322] p-5 text-white shadow-[0_24px_80px_rgba(3,15,33,0.22)] lg:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-normal">当前行动队列</h2>
              <p className="mt-1 text-sm text-slate-400">
                运营负责人可先看谁要跟、为什么跟、下一步由谁处理。
              </p>
            </div>
            <Activity className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="mt-5 space-y-3">
            {summary.supportingStats.map((item) => (
              <div key={item.key} className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-white">{item.label}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-400">{item.helper}</div>
                  </div>
                  <div className="rounded-full bg-cyan-300/14 px-2.5 py-1 text-sm font-semibold text-cyan-200">
                    {status === 'loading' ? '--' : item.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-normal text-slate-950">
                客户旅程看板
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                按客户旅程阶段聚合，帮助判断治疗后服务和复诊机会。
              </p>
            </div>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
              运营视图
            </span>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-4">
            {summary.journeyLanes.map((lane) => (
              <section
                key={lane.key}
                className="rounded-2xl border border-slate-200/80 bg-white/84 p-4"
              >
                <h3 className="text-sm font-semibold tracking-normal text-slate-950">
                  {lane.title}
                </h3>
                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-2xl font-semibold text-slate-950">
                      {status === 'loading' ? '--' : lane.count}
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      条
                    </span>
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">{lane.detail}</div>
                </div>
              </section>
            ))}
          </div>
        </article>

        <article className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">演示边界</h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
              只读
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {[
              '工作台用于串联治疗后运营闭环，不展示原始诊疗、沟通或附件内容。',
              '首页不提交 tenantId，也不创建、修改或删除业务记录。',
              '当前为受控 demo 数据，页面仅展示可解释的运营摘要。',
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm leading-6 text-slate-600"
              >
                {item}
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

function PlaceholderInstitutionView({ label }: { label: string }) {
  return (
    <InstitutionPageState
      kind="placeholder"
      title={`${label}暂不进入本次演示主线`}
      description="本入口不会触发客服、知识库或数据分析真实功能请求。"
      action={
        <div className="space-y-2 text-sm leading-6 text-slate-500">
          <p>本次主线：工作台、客户中心、预约中心、智能随访、治疗摘要管理、审计日志。</p>
          <p>后续：客服工作台、知识库、数据分析。</p>
        </div>
      }
      className="items-start text-left"
    />
  );
}
