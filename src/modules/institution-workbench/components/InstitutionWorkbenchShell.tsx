import {
  Activity,
  ArrowUpRight,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarSync,
  ChevronRight,
  CircleAlert,
  Clock3,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';

import { WorkbenchActionQueue } from '@/modules/institution-workbench/components/WorkbenchActionQueue';
import type {
  WorkbenchActionProjection,
  WorkbenchCareCardViewModel,
} from '@/modules/institution-workbench/domain/workbench-action-view-models';
import type {
  WorkbenchCapabilityProjection,
  WorkbenchCapabilitySummaryViewModel,
} from '@/modules/institution-workbench/domain/workbench-capability-view-models';
import {
  WORKBENCH_LIFECYCLE_KEYS,
  type WorkbenchLifecycleItemViewModel,
  type WorkbenchLifecycleProjection,
} from '@/modules/institution-workbench/domain/workbench-lifecycle-view-models';
import { cn } from '@/shared/utils/cn';

export type InstitutionWorkbenchShellProps = Readonly<{
  actionProjection: WorkbenchActionProjection;
  lifecycleProjection: WorkbenchLifecycleProjection;
  capabilityProjection: WorkbenchCapabilityProjection;
}>;

const careCardIcons = {
  pending_confirmation_appointments: CalendarCheck2,
  reschedule_requested_appointments: CalendarSync,
  overdue_followups: CalendarClock,
  today_due_followups: CalendarDays,
} satisfies Record<WorkbenchCareCardViewModel['key'], typeof CalendarDays>;

const lifecycleAccents = {
  consulting: 'bg-cyan-500',
  scheduled: 'bg-blue-500',
  post_care: 'bg-violet-500',
  repurchase_window: 'bg-emerald-500',
} satisfies Record<WorkbenchLifecycleItemViewModel['key'], string>;

function sourceValue(value: number | null): string {
  return value === null ? '--' : String(value);
}

function FreshnessNote({ observedAt }: Readonly<{ observedAt: string | null }>) {
  return observedAt === null ? null : (
    <p className="mt-2 flex min-w-0 items-center gap-1.5 text-xs font-medium text-amber-700">
      <Clock3 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">截至 {observedAt}</span>
    </p>
  );
}

function careCardStatusLabel(status: WorkbenchCareCardViewModel['status']): string {
  switch (status) {
    case 'ready':
      return '数据可用';
    case 'empty':
      return '暂无待办';
    case 'stale':
      return '数据已过期';
    case 'unavailable':
      return '暂不可用';
  }
}

function CareCard({ card }: Readonly<{ card: WorkbenchCareCardViewModel }>) {
  const Icon = careCardIcons[card.key];
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-2xl',
            card.status === 'stale'
              ? 'bg-amber-50 text-amber-700'
              : card.status === 'unavailable'
                ? 'bg-slate-100 text-slate-400'
                : 'bg-cyan-50 text-cyan-700',
          )}
        >
          <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
        </span>
        <span
          className={cn(
            'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
            card.status === 'ready'
              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
              : card.status === 'empty'
                ? 'border-slate-200 bg-slate-50 text-slate-500'
                : card.status === 'stale'
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-slate-200 bg-slate-100 text-slate-500',
          )}
        >
          {careCardStatusLabel(card.status)}
        </span>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-600">{card.title}</h3>
          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            {sourceValue(card.count)}
          </p>
        </div>
        {card.status === 'ready' || card.status === 'empty' ? (
          <ArrowUpRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-cyan-700"
          />
        ) : null}
      </div>
      {card.status === 'stale' ? <FreshnessNote observedAt={card.observedAt} /> : null}
    </>
  );

  if (card.status === 'ready' || card.status === 'empty') {
    return (
      <li data-card-status={card.status} className="min-w-0">
        <a
          aria-label={`${card.title}详情`}
          href={card.canonicalHref}
          className="group block h-full min-h-40 rounded-[24px] border border-white/90 bg-white/86 p-4 shadow-[0_16px_42px_rgba(32,61,104,0.08)] transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-[0_20px_52px_rgba(32,61,104,0.13)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:p-5"
        >
          {content}
        </a>
      </li>
    );
  }

  return (
    <li
      data-card-status={card.status}
      className="min-h-40 min-w-0 rounded-[24px] border border-white/90 bg-white/72 p-4 shadow-[0_16px_42px_rgba(32,61,104,0.06)] sm:p-5"
    >
      {content}
    </li>
  );
}

function LifecycleItem({ item }: Readonly<{ item: WorkbenchLifecycleItemViewModel }>) {
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className={cn(
            'h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-slate-100',
            item.status === 'unavailable' ? 'bg-slate-300' : lifecycleAccents[item.key],
          )}
        />
        <h3 className="truncate text-sm font-semibold text-slate-700">{item.label}</h3>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2 pl-5">
        <p className="text-2xl font-bold tracking-tight text-slate-950">
          {sourceValue(item.count)}
        </p>
        {item.canonicalHref === null ? null : (
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4 text-slate-300 transition group-hover:text-cyan-700"
          />
        )}
      </div>
      {item.status === 'stale' ? <FreshnessNote observedAt={item.observedAt} /> : null}
    </>
  );

  return (
    <li
      data-lifecycle-status={item.status}
      className={cn(
        'min-w-0 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5',
        item.canonicalHref === null ? '' : 'transition hover:border-cyan-200 hover:bg-white',
      )}
    >
      {item.canonicalHref === null ? (
        content
      ) : (
        <a
          aria-label={`查看${item.label}客户`}
          href={item.canonicalHref}
          className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          {content}
        </a>
      )}
    </li>
  );
}

function CapabilitySummary({ summary }: Readonly<{ summary: WorkbenchCapabilitySummaryViewModel }>) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate text-sm font-semibold text-slate-800">{summary.label}</h3>
        <span className="shrink-0 rounded-full border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
          {summary.decision === 'operational' ? '可操作' : '只读'}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{summary.safeSummary}</p>
      {summary.dataStatus === 'stale' ? <FreshnessNote observedAt={summary.observedAt} /> : null}
    </article>
  );
}

function orderedLifecycleItems(projection: WorkbenchLifecycleProjection) {
  if (projection.status === 'blocked') {
    return [];
  }

  return WORKBENCH_LIFECYCLE_KEYS.flatMap((key) => {
    const item = projection.items.find((candidate) => candidate.key === key);
    return item === undefined ? [] : [item];
  });
}

/**
 * capability-off 工作台展示层：只接收已授权、低敏的领域投影，不承担读取、解析、授权或刷新职责。
 */
export function InstitutionWorkbenchShell({
  actionProjection,
  lifecycleProjection,
  capabilityProjection,
}: InstitutionWorkbenchShellProps) {
  const lifecycleItems = orderedLifecycleItems(lifecycleProjection);
  const hasVisibleProjection =
    actionProjection.status === 'projected' ||
    lifecycleProjection.status === 'projected' ||
    capabilityProjection.status === 'projected';

  return (
    <section
      aria-labelledby="institution-workbench-heading"
      className="relative space-y-5 overflow-hidden sm:space-y-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-36 -top-44 -z-10 h-96 w-96 rounded-full bg-cyan-200/30 blur-3xl"
      />

      <header className="flex flex-col gap-4 rounded-[28px] border border-white/80 bg-white/72 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
            <Activity aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.14em] text-cyan-700">机构运营工作台</p>
            <h1
              id="institution-workbench-heading"
              className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl"
            >
              工作台
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              聚合已授权的预约、随访与会话信息，帮助团队优先处理需要关注的事项。
            </p>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex w-fit shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
            hasVisibleProjection
              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700',
          )}
        >
          <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
          {hasVisibleProjection ? '已授权投影' : '安全阻断'}
        </span>
      </header>

      {hasVisibleProjection ? null : (
        <section
          aria-labelledby="workbench-unavailable-heading"
          className="relative overflow-hidden rounded-[28px] border border-amber-200/80 bg-white/82 p-6 shadow-[0_24px_80px_rgba(32,61,104,0.10)] sm:p-8 lg:p-10"
        >
          <div
            aria-hidden="true"
            className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-100/70 blur-3xl"
          />
          <div className="relative flex max-w-3xl flex-col gap-5 sm:flex-row sm:items-start">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 shadow-sm">
              <LockKeyhole aria-hidden="true" className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                能力未开放
              </span>
              <h2
                id="workbench-unavailable-heading"
                className="mt-3 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl"
              >
                数据服务/能力尚未安全开放
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                当前工作台不会展示模拟数字、演示客户或未授权业务入口。只有真实数据来源、机构隔离与服务端权限校验完成后，才会呈现可用的运营信息。
              </p>
              <div className="mt-5 flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm leading-6 text-slate-600">
                <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <span>这不是“零数据”状态，因此未知值不会显示为 0。</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {actionProjection.status !== 'projected' || actionProjection.cards.length === 0 ? null : (
        <section aria-labelledby="workbench-care-cards-heading">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-semibold tracking-[0.12em] text-slate-400">今日优先事项</p>
              <h2 id="workbench-care-cards-heading" className="mt-1 text-lg font-bold text-slate-950">
                Care 行动概览
              </h2>
            </div>
            <span className="hidden text-xs font-medium text-slate-400 sm:inline">仅展示已授权低敏投影</span>
          </div>
          <ul aria-label="Care 行动概览" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {actionProjection.cards.map((card) => (
              <CareCard key={card.key} card={card} />
            ))}
          </ul>
        </section>
      )}

      {hasVisibleProjection ? (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)] xl:items-start">
          <WorkbenchActionQueue projection={actionProjection} />

          <div className="min-w-0 space-y-5">
            {lifecycleItems.length === 0 ? null : (
              <section
                aria-labelledby="workbench-lifecycle-heading"
                className="rounded-[28px] border border-white/90 bg-white/82 p-5 shadow-[0_20px_64px_rgba(32,61,104,0.09)] sm:p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.12em] text-slate-400">客户阶段分布</p>
                    <h2 id="workbench-lifecycle-heading" className="mt-1 text-lg font-bold text-slate-950">
                      客户旅程
                    </h2>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700">
                    <UsersRound aria-hidden="true" className="h-[18px] w-[18px]" />
                  </span>
                </div>
                <ul aria-label="客户旅程" className="mt-4 grid min-w-0 grid-cols-2 gap-3">
                  {lifecycleItems.map((item) => (
                    <LifecycleItem key={item.key} item={item} />
                  ))}
                </ul>
              </section>
            )}

            {capabilityProjection.status !== 'projected' ? null : (
              <section
                aria-labelledby="workbench-capability-heading"
                className="rounded-[28px] border border-white/90 bg-white/82 p-5 shadow-[0_20px_64px_rgba(32,61,104,0.09)] sm:p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.12em] text-slate-400">当前开放范围</p>
                    <h2 id="workbench-capability-heading" className="mt-1 text-lg font-bold text-slate-950">
                      机构能力
                    </h2>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                    <Sparkles aria-hidden="true" className="h-[18px] w-[18px]" />
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {capabilityProjection.summaries.map((summary) => (
                    <CapabilitySummary key={summary.key} summary={summary} />
                  ))}
                </div>

                {capabilityProjection.quickCreateMenu === null ? null : (
                  <nav
                    aria-label={capabilityProjection.quickCreateMenu.label}
                    className="mt-4 border-t border-slate-100 pt-4"
                  >
                    <h3 className="text-xs font-semibold tracking-[0.12em] text-slate-400">
                      {capabilityProjection.quickCreateMenu.label}
                    </h3>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {capabilityProjection.quickCreateMenu.items.map((item) => (
                        <li key={item.key}>
                          <a
                            href={item.href}
                            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
                          >
                            <Plus aria-hidden="true" className="h-4 w-4" />
                            {item.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                )}
              </section>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
