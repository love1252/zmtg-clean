import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ListChecks,
  MessageSquareText,
} from 'lucide-react';

import type {
  WorkbenchActionProjection,
  WorkbenchActionRowViewModel,
} from '@/modules/institution-workbench/domain/workbench-action-view-models';
import {
  WORKBENCH_DESKTOP_ACTION_LIMIT,
  WORKBENCH_MOBILE_ACTION_LIMIT,
} from '@/modules/institution-workbench/domain/workbench-action-view-models';
import { cn } from '@/shared/utils/cn';

export type WorkbenchActionQueueProps = Readonly<{
  projection: WorkbenchActionProjection;
}>;

function actionSubjectLabel(action: WorkbenchActionRowViewModel): string {
  return action.subject.kind === 'customer' ? action.subject.displayName : action.subject.label;
}

function actionTime(action: WorkbenchActionRowViewModel): string {
  switch (action.kind) {
    case 'appointment':
      return action.appointmentAt;
    case 'followup':
      return action.dueAt;
    case 'conversation':
      return action.lastCustomerMessageAt;
  }
}

function actionKindLabel(action: WorkbenchActionRowViewModel): string {
  switch (action.kind) {
    case 'appointment':
      return '预约';
    case 'followup':
      return '随访';
    case 'conversation':
      return '会话';
  }
}

function ActionKindIcon({ kind }: Readonly<{ kind: WorkbenchActionRowViewModel['kind'] }>) {
  const iconClassName = 'h-[18px] w-[18px]';

  switch (kind) {
    case 'appointment':
      return <CalendarClock aria-hidden="true" className={iconClassName} />;
    case 'followup':
      return <CheckCircle2 aria-hidden="true" className={iconClassName} />;
    case 'conversation':
      return <MessageSquareText aria-hidden="true" className={iconClassName} />;
  }
}

function actionTimeLabel(action: WorkbenchActionRowViewModel): string {
  switch (action.kind) {
    case 'appointment':
      return '预约时间';
    case 'followup':
      return '到期时间';
    case 'conversation':
      return '客户最近消息';
  }
}

function hasConfirmedEmptySources(
  sourceReadiness: Extract<WorkbenchActionProjection, { status: 'projected' }>['sourceReadiness'],
): boolean {
  return [sourceReadiness.care, sourceReadiness.conversation].every(
    (readiness) => readiness === 'ready' || readiness === 'empty',
  );
}

/**
 * 只消费已聚合的工作台行动投影；不读取来源、不会重新排序或构造业务链接。
 * 移动端从桌面安全前缀派生，以保证其始终是桌面队列的前缀。
 */
export function WorkbenchActionQueue({ projection }: WorkbenchActionQueueProps) {
  if (projection.status === 'blocked') {
    return null;
  }

  const desktopActions = projection.desktopActions.slice(0, WORKBENCH_DESKTOP_ACTION_LIMIT);
  const mobileActionCount = Math.min(desktopActions.length, WORKBENCH_MOBILE_ACTION_LIMIT);
  const isConfirmedEmpty = hasConfirmedEmptySources(projection.sourceReadiness);
  const hasDegradedSource = !isConfirmedEmpty;

  return (
    <section
      aria-labelledby="workbench-action-queue-heading"
      data-readiness={projection.sourceReadiness.care}
      className="min-w-0 rounded-[28px] border border-white/90 bg-white/82 p-5 shadow-[0_20px_64px_rgba(32,61,104,0.09)] sm:p-6"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.12em] text-slate-400">按风险与时效排序</p>
          <h2 id="workbench-action-queue-heading" className="mt-1 text-lg font-bold text-slate-950">
            行动队列
          </h2>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white">
          <ListChecks aria-hidden="true" className="h-[18px] w-[18px]" />
        </span>
      </div>

      {hasDegradedSource && desktopActions.length > 0 ? (
        <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          部分行动数据当前不可用；仅显示可验证行动
        </p>
      ) : null}

      {desktopActions.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-5 py-10 text-center">
          {isConfirmedEmpty ? (
            <CheckCircle2 aria-hidden="true" className="mx-auto h-7 w-7 text-slate-300" />
          ) : (
            <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-amber-600" />
          )}
          <p className="mt-3 text-sm font-semibold text-slate-600">
            {isConfirmedEmpty ? '当前筛选暂无行动' : '部分行动数据当前不可用；仅显示可验证行动'}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">这里不会使用客户自由文本补齐任务。</p>
        </div>
      ) : (
        <ol aria-label="行动队列" className="mt-2 min-w-0 divide-y divide-slate-100">
          {desktopActions.map((action, index) => {
            const isMobileAction = index < mobileActionCount;
            const kindLabel = actionKindLabel(action);
            const subjectLabel = actionSubjectLabel(action);

            return (
              <li
                key={action.key}
                className={cn(
                  'min-w-0 py-4 first:pt-3 last:pb-0',
                  isMobileAction ? undefined : 'hidden md:block',
                )}
                data-testid={isMobileAction ? 'mobile-action' : undefined}
              >
                <div className="group grid min-w-0 gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                  <span
                    className={cn(
                      'grid h-10 w-10 shrink-0 place-items-center rounded-2xl',
                      action.kind === 'appointment'
                        ? 'bg-blue-50 text-blue-700'
                        : action.kind === 'followup'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-violet-50 text-violet-700',
                    )}
                  >
                    <ActionKindIcon kind={action.kind} />
                  </span>

                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="max-w-full truncate text-sm font-bold text-slate-900">{subjectLabel}</p>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        {kindLabel}
                      </span>
                      {action.priority === 'high' ? (
                        <span className="rounded-full border border-rose-100 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                          高优先级
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                      <Clock3 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                      <span className="shrink-0">{actionTimeLabel(action)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="min-w-0 truncate">{actionTime(action)}</span>
                    </p>
                    {action.safeSummary === null ? null : (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{action.safeSummary}</p>
                    )}
                  </div>

                  <a
                    aria-label={`查看${subjectLabel}的${kindLabel}详情`}
                    href={action.detailHref}
                    className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:justify-self-end"
                  >
                    查看详情
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </a>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
