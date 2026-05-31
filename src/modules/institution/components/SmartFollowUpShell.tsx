'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Loader2,
  MessageSquareText,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import {
  listFollowUpTasks,
  transitionFollowUpTask,
  type TenantBusinessClientError,
} from '@/modules/institution/client/tenant-business-client';
import {
  InstitutionPageState,
  getInstitutionPageStateFromClientError,
  type InstitutionPageStateProps,
} from '@/modules/institution/components/InstitutionPageState';
import { InstitutionSectionHeader } from '@/modules/institution/components/InstitutionSectionHeader';
import {
  followUpJourneys,
  followUpMessageSuggestions,
} from '@/modules/institution/domain/followups';
import type {
  FollowUpStatus,
  TenantFollowUpTask,
} from '@/modules/institution/domain/followup-workflow';
import {
  followUpRiskLevelLabels,
  followUpStatusLabels,
  formatBusinessDateTime,
  getAllowedFollowUpNextStatuses,
  sortFollowUpTasksForWorkQueue,
} from '@/modules/institution/domain/tenant-business-view-models';

const statusOptions = Object.entries(followUpStatusLabels) as [
  FollowUpStatus,
  string,
][];

const riskToneClasses = {
  urgent: 'border-rose-200 bg-rose-50 text-rose-700',
  watch: 'border-amber-200 bg-amber-50 text-amber-700',
  normal: 'border-slate-200 bg-slate-50 text-slate-600',
} as const;

function visibleErrorMessage(error: TenantBusinessClientError) {
  if (error.kind === 'unauthorized') {
    return '登录状态已失效，请重新登录';
  }

  if (error.kind === 'forbidden') {
    return '当前账号没有访问随访任务的权限';
  }

  if (error.kind === 'service_unavailable') {
    return '数据服务暂时不可用';
  }

  if (error.kind === 'conflict') {
    return error.message || '随访状态已变化，请刷新后重试';
  }

  return error.message || '随访任务请求失败';
}

function visibleListErrorState(error: TenantBusinessClientError): InstitutionPageStateProps {
  return getInstitutionPageStateFromClientError(error, {
    forbiddenMessage: '当前账号没有访问随访任务的权限',
    fallbackMessage: '随访任务请求失败',
  });
}

function buildStatusCounts(tasks: TenantFollowUpTask[]) {
  return statusOptions.map(([status, label]) => ({
    status,
    label,
    count: tasks.filter((task) => task.status === status).length,
  }));
}

export function SmartFollowUpShell() {
  const [tasks, setTasks] = useState<TenantFollowUpTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listErrorState, setListErrorState] = useState<InstitutionPageStateProps | null>(null);
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadFollowUpTasks() {
      setIsLoading(true);
      setListErrorState(null);
      const result = await listFollowUpTasks();

      if (!isActive) return;

      if (result.ok) {
        setTasks(result.records);
      } else {
        setTasks([]);
        setListErrorState(visibleListErrorState(result.error));
      }

      setIsLoading(false);
    }

    void loadFollowUpTasks();

    return () => {
      isActive = false;
    };
  }, []);

  const sortedTasks = useMemo(() => sortFollowUpTasksForWorkQueue(tasks), [tasks]);

  const statusCounts = useMemo(() => buildStatusCounts(tasks), [tasks]);

  async function handleTransition(task: TenantFollowUpTask, nextStatus: FollowUpStatus) {
    setUpdatingTaskId(task.id);
    setTaskErrors((current) => ({ ...current, [task.id]: '' }));

    const result = await transitionFollowUpTask({
      id: task.id,
      nextStatus,
    });

    if (result.ok) {
      setTasks((current) =>
        current.map((record) => (record.id === result.record.id ? result.record : record)),
      );
      setTaskErrors((current) => ({ ...current, [task.id]: '' }));
    } else {
      setTaskErrors((current) => ({
        ...current,
        [task.id]: visibleErrorMessage(result.error),
      }));
    }

    setUpdatingTaskId(null);
  }

  return (
    <section className="space-y-5">
      <InstitutionSectionHeader
        eyebrow="智能随访"
        title="智能随访"
        description="从机构随访任务 API 加载当前租户任务，按风险等级和到期时间排列人工工作队列。"
        tone="violet"
        action={
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700">
            <ShieldCheck className="h-4 w-4" />
            PATCH 仅提交 id 与 nextStatus
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {statusCounts.map((item) => (
          <article
            key={item.status}
            className="rounded-[22px] border border-white/80 bg-white/78 p-4 shadow-sm backdrop-blur-xl"
          >
            <div className="text-xs font-semibold text-slate-400">{item.label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">
              {isLoading ? '--' : item.count}
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">今日随访任务</h3>
              <p className="mt-1 text-sm text-slate-500">优先处理高风险、临近到期任务。</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
              真实 API
            </span>
          </div>

          {isLoading ? (
            <InstitutionPageState
              kind="loading"
              title="正在加载随访任务..."
              className="mt-4"
            />
          ) : null}

          {!isLoading && listErrorState ? (
            <InstitutionPageState {...listErrorState} className="mt-4" />
          ) : null}

          {!isLoading && !listErrorState && sortedTasks.length === 0 ? (
            <InstitutionPageState
              kind="empty"
              title="暂无随访任务"
              description="当前租户没有需要处理的随访任务。"
              className="mt-4"
            />
          ) : null}

          {!isLoading && !listErrorState && sortedTasks.length > 0 ? (
            <div className="mt-4 space-y-3">
              {sortedTasks.map((task) => {
                const nextStatuses = getAllowedFollowUpNextStatuses(task.status);

                return (
                  <div
                    key={task.id}
                    data-testid="followup-task-card"
                    className="rounded-2xl border border-slate-200/80 bg-white/86 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-slate-950">
                            {task.customerDisplayName}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                            状态：{followUpStatusLabels[task.status]}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${riskToneClasses[task.riskLevel]}`}
                          >
                            风险：{followUpRiskLevelLabels[task.riskLevel]}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-slate-800">
                          {task.stage}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          {task.suggestedAction}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-slate-400">
                          到期时间：{formatBusinessDateTime(task.dueAt)}
                        </p>
                      </div>

                      <div className="min-w-[220px] rounded-2xl bg-slate-50 p-3">
                        <div className="text-xs font-semibold text-slate-400">允许流转</div>
                        {nextStatuses.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {nextStatuses.map((nextStatus) => (
                              <button
                                key={nextStatus}
                                type="button"
                                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                onClick={() => handleTransition(task, nextStatus)}
                                disabled={updatingTaskId === task.id}
                              >
                                {updatingTaskId === task.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : null}
                                流转 {task.customerDisplayName} 到{' '}
                                {followUpStatusLabels[nextStatus]}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs leading-5 text-slate-500">
                            当前状态暂无可用流转
                          </p>
                        )}

                        {taskErrors[task.id] ? (
                          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {taskErrors[task.id]}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </article>

        <aside className="space-y-5">
          <article className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Workflow className="h-5 w-5 text-violet-600" />
              <div>
                <h3 className="text-lg font-semibold text-slate-950">随访旅程</h3>
                <p className="mt-1 text-sm text-slate-500">旅程定义仍为静态说明。</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {followUpJourneys.map((journey) => (
                <div key={journey.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-950">{journey.name}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                      {journey.stageCount} 阶段
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {journey.activeCustomers} 位客户 · {journey.conversionHint}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <MessageSquareText className="h-5 w-5 text-emerald-600" />
              <div>
                <h3 className="text-lg font-semibold text-slate-950">演示话术建议</h3>
                <p className="mt-1 text-sm text-slate-500">仅展示静态安全说明。</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {followUpMessageSuggestions.map((suggestion) => (
                <div
                  key={suggestion.title}
                  className="rounded-2xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <Bot className="h-4 w-4 text-emerald-600" />
                    {suggestion.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {suggestion.content}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
              不会调用 AI provider，也不会自动触达客户。
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}
