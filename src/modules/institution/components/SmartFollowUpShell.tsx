'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Loader2,
  MessageSquareText,
  ShieldCheck,
  TrendingUp,
  Workflow,
} from 'lucide-react';
import {
  approveFollowUpMessageDraft,
  createFollowUpMessageDraft,
  getFollowUpOperationsDashboard,
  getWeComControlledReachOut,
  listFollowUpMessageDrafts,
  listFollowUpPathEnrollments,
  listFollowUpTasks,
  markFollowUpMessageDraftAsSent,
  prepareWeComControlledReachOut,
  rejectFollowUpMessageDraft,
  transitionFollowUpTask,
  updateFollowUpMessageDraft,
  type TenantBusinessClientError,
} from '@/modules/institution/client/tenant-business-client';
import {
  InstitutionPageState,
  getInstitutionPageStateFromClientError,
  type InstitutionPageStateProps,
} from '@/modules/institution/components/InstitutionPageState';
import { InstitutionSectionHeader } from '@/modules/institution/components/InstitutionSectionHeader';
import { followUpMessageSuggestions } from '@/modules/institution/domain/followups';
import type { FollowUpMessageDraftDto } from '@/modules/institution/domain/followup-message-drafts';
import type {
  WeComControlledReachOutFailureCode,
  WeComControlledReachOutPreflight,
} from '@/modules/institution/domain/wecom-controlled-reachout';
import type { FollowUpOperationsDashboard } from '@/modules/institution/domain/followup-operations-dashboard';
import { getDefaultWeComAuthorizationDashboardView } from '@/modules/institution/domain/wecom-authorization';
import { getDefaultWeComCustomerContactSyncDashboardView } from '@/modules/institution/domain/wecom-customer-contact';
import { getDefaultWeComMockReachOutDashboardView } from '@/modules/institution/domain/wecom-reachout-mock';
import type { FollowUpPathEnrollmentDto } from '@/modules/institution/domain/followup-path-enrollment';
import type {
  FollowUpStatus,
  FollowUpTaskSource,
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

type FollowUpSourceFilter = 'all' | 'treatment_summary';

const riskToneClasses = {
  urgent: 'border-rose-200 bg-rose-50 text-rose-700',
  watch: 'border-amber-200 bg-amber-50 text-amber-700',
  normal: 'border-slate-200 bg-slate-50 text-slate-600',
} as const;

const handlerRoleLabels: Record<string, string> = {
  consultant: '咨询师',
  customer_service: '客服',
  medical_assistant: '医助',
  nursing_staff: '护理人员',
  operations_lead: '运营负责人',
  unassigned: '未分配',
};

const emptyOperationsDashboard: FollowUpOperationsDashboard = {
  overview: {
    activeEnrollmentCount: 0,
    todayDueTaskCount: 0,
    overdueTaskCount: 0,
    pendingTaskCount: 0,
    completedTaskCount: 0,
    escalatedTaskCount: 0,
    highRiskTaskCount: 0,
    draftCount: 0,
    approvedDraftCount: 0,
    markedSentCount: 0,
    approvedButNotMarkedSentCount: 0,
    messageDeliveryCount: 0,
    mockSentCount: 0,
    mockFailedCount: 0,
    skippedCount: 0,
    externalDisabledCount: 0,
    contactSafetyAllowedCount: 0,
    consentMissingBlockedCount: 0,
    optOutBlockedCount: 0,
    frequencyCapBlockedCount: 0,
    channelDisabledCount: 0,
    grayGuardBlockedCount: 0,
    manualFeedbackCount: 0,
  },
  pathPerformance: [],
  workload: [],
  draftOperations: {
    draftCount: 0,
    approvedDraftCount: 0,
    rejectedDraftCount: 0,
    markedSentCount: 0,
    approvedButNotMarkedSentCount: 0,
  },
  messageDeliveries: {
    messageDeliveryCount: 0,
    mockSentCount: 0,
    mockFailedCount: 0,
    skippedCount: 0,
    externalDisabledCount: 0,
    recentDeliveries: [],
  },
  contactSafety: {
    allowedCount: 0,
    consentMissingBlockedCount: 0,
    optOutBlockedCount: 0,
    frequencyCapBlockedCount: 0,
    channelDisabledCount: 0,
    tenantGrayBlockedCount: 0,
    institutionGrayBlockedCount: 0,
    grayGuardBlockedCount: 0,
  },
  weComAuthorization: getDefaultWeComAuthorizationDashboardView(),
  weComCustomerContactSync: getDefaultWeComCustomerContactSyncDashboardView(),
  weComMockReachOut: getDefaultWeComMockReachOutDashboardView(),
  riskSummary: {
    escalatedTaskCount: 0,
    highRiskTaskCount: 0,
    highRiskPendingTaskCount: 0,
    overdueHighRiskTaskCount: 0,
    manualFeedbackCount: 0,
  },
};

const draftStatusLabels: Record<FollowUpMessageDraftDto['status'], string> = {
  draft: '草稿待确认',
  approved: '已确认',
  rejected: '已拒绝',
  marked_sent: '已人工发送',
  cancelled: '已取消',
};

const controlledReachOutBlockReasonLabels: Record<WeComControlledReachOutFailureCode, string> = {
  draft_not_found: '草稿不存在或不属于当前机构',
  draft_not_approved: '草稿尚未批准',
  delivery_missing: 'MessageDelivery 缺失',
  delivery_not_unique: 'MessageDelivery 不唯一',
  delivery_customer_mismatch: 'MessageDelivery 客户不匹配',
  delivery_not_internal_mock: '内部模拟投递不符合正式审批记录',
  mapping_not_confirmed: '客户映射尚未确认',
  mapping_customer_mismatch: '客户映射不匹配',
  customer_not_found: '客户不存在或不属于当前机构',
  consent_missing: '客户授权状态未知',
  consent_revoked: '客户授权已撤销',
  opt_out: '客户已拒绝触达',
  frequency_cap_reached: '当前频控窗口已达上限',
  dry_run_not_ready: '官方 dry-run 尚未就绪',
  manual_confirmation_invalid: '人工确认无效',
  conflict: '状态冲突，请刷新后重试',
};

function draftContentValue(draft: FollowUpMessageDraftDto) {
  return draft.editedContent || draft.draftContent;
}

function isDraftEditable(draft: FollowUpMessageDraftDto | undefined) {
  return draft?.status === 'draft';
}

function visibleDraftSummary(draft: FollowUpMessageDraftDto) {
  return draft.safePreview || draftContentValue(draft).slice(0, 120);
}

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

function visibleControlledReachOutError(error: TenantBusinessClientError) {
  if (error.kind === 'not_found') return '草稿不存在或不属于当前机构';
  if (error.kind === 'conflict') return '受控触达状态已变化，请刷新后重试';
  if (error.kind === 'validation_error') return '受控触达门禁未通过';
  return visibleErrorMessage(error);
}

function visibleListErrorState(error: TenantBusinessClientError): InstitutionPageStateProps {
  return getInstitutionPageStateFromClientError(error, {
    forbiddenMessage: '当前账号没有访问随访任务的权限',
    fallbackMessage: '随访任务视图暂时无法加载',
    unavailableMessage: '数据服务暂时不可用，请稍后刷新或切换演示备份',
  });
}

function buildStatusCounts(tasks: TenantFollowUpTask[]) {
  return statusOptions.map(([status, label]) => ({
    status,
    label,
    count: tasks.filter((task) => task.status === status).length,
  }));
}

function sourceLabel(source: FollowUpTaskSource | undefined) {
  return source === 'treatment_summary' ? '治疗摘要' : null;
}

function hasOperationsData(dashboard: FollowUpOperationsDashboard) {
  return (
    dashboard.overview.activeEnrollmentCount +
      dashboard.overview.pendingTaskCount +
      dashboard.overview.completedTaskCount +
      dashboard.overview.draftCount +
      dashboard.overview.messageDeliveryCount +
      dashboard.overview.manualFeedbackCount >
    0
  );
}

function formatPercent(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function OperationsMetricCard(input: {
  label: string;
  value: number | string;
  description: string;
  tone?: 'slate' | 'violet' | 'amber' | 'rose' | 'emerald';
}) {
  const toneClass = {
    slate: 'border-slate-200 bg-white text-slate-950',
    violet: 'border-violet-100 bg-violet-50 text-violet-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  }[input.tone ?? 'slate'];

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-xs font-semibold opacity-75">{input.label}</div>
      <div className="mt-2 text-2xl font-semibold">{input.value}</div>
      <p className="mt-2 text-xs leading-5 opacity-75">{input.description}</p>
    </div>
  );
}

export function SmartFollowUpShell() {
  const [tasks, setTasks] = useState<TenantFollowUpTask[]>([]);
  const [enrollments, setEnrollments] = useState<FollowUpPathEnrollmentDto[]>([]);
  const [sourceFilter, setSourceFilter] = useState<FollowUpSourceFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrollmentLoading, setIsEnrollmentLoading] = useState(true);
  const [listErrorState, setListErrorState] = useState<InstitutionPageStateProps | null>(null);
  const [enrollmentErrorState, setEnrollmentErrorState] = useState<InstitutionPageStateProps | null>(null);
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});
  const [draftsByTaskId, setDraftsByTaskId] = useState<Record<string, FollowUpMessageDraftDto[]>>({});
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const [controlledReachOutByDraftId, setControlledReachOutByDraftId] = useState<Record<string, WeComControlledReachOutPreflight>>({});
  const [controlledReachOutErrors, setControlledReachOutErrors] = useState<Record<string, string>>({});
  const [updatingDraftKey, setUpdatingDraftKey] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [operationsDashboard, setOperationsDashboard] = useState<FollowUpOperationsDashboard>(emptyOperationsDashboard);
  const [isOperationsLoading, setIsOperationsLoading] = useState(true);
  const [operationsErrorState, setOperationsErrorState] = useState<InstitutionPageStateProps | null>(null);

  const refreshOperationsDashboard = useCallback(async () => {
    setIsOperationsLoading(true);
    setOperationsErrorState(null);
    const result = await getFollowUpOperationsDashboard();

    if (result.ok) {
      setOperationsDashboard(result.dashboard);
    } else {
      setOperationsDashboard(emptyOperationsDashboard);
      setOperationsErrorState(visibleListErrorState(result.error));
    }

    setIsOperationsLoading(false);
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadOperationsDashboard() {
      setIsOperationsLoading(true);
      setOperationsErrorState(null);
      const result = await getFollowUpOperationsDashboard();

      if (!isActive) return;

      if (result.ok) {
        setOperationsDashboard(result.dashboard);
      } else {
        setOperationsDashboard(emptyOperationsDashboard);
        setOperationsErrorState(visibleListErrorState(result.error));
      }

      setIsOperationsLoading(false);
    }

    void loadOperationsDashboard();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadFollowUpTasks() {
      setIsLoading(true);
      setListErrorState(null);
      const result = await listFollowUpTasks(
        sourceFilter === 'treatment_summary'
          ? { source: 'treatment_summary' }
          : undefined,
      );

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
  }, [sourceFilter]);

  useEffect(() => {
    let isActive = true;

    async function loadFollowUpPathEnrollments() {
      setIsEnrollmentLoading(true);
      setEnrollmentErrorState(null);
      const result = await listFollowUpPathEnrollments();

      if (!isActive) return;

      if (result.ok) {
        setEnrollments(result.records);
      } else {
        setEnrollments([]);
        setEnrollmentErrorState(visibleListErrorState(result.error));
      }

      setIsEnrollmentLoading(false);
    }

    void loadFollowUpPathEnrollments();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadDraftsForTasks() {
      if (tasks.length === 0) {
        setDraftsByTaskId({});
        return;
      }

      const entries = await Promise.all(
        tasks.map(async (task) => {
          const result = await listFollowUpMessageDrafts(task.id);
          return [task.id, result.ok ? result.records : []] as const;
        }),
      );

      if (!isActive) return;
      setDraftsByTaskId(Object.fromEntries(entries));
    }

    void loadDraftsForTasks();

    return () => {
      isActive = false;
    };
  }, [tasks]);

  useEffect(() => {
    let isActive = true;

    async function loadControlledReachOut() {
      const approvedDrafts = Object.values(draftsByTaskId)
        .flat()
        .filter((draft) => draft.status === 'approved');
      if (approvedDrafts.length === 0) {
        setControlledReachOutByDraftId({});
        setControlledReachOutErrors({});
        return;
      }

      const results = await Promise.all(
        approvedDrafts.map(async (draft) => {
          const result = await getWeComControlledReachOut(draft.draftId);
          return { draftId: draft.draftId, result };
        }),
      );
      if (!isActive) return;
      const preflights: Record<string, WeComControlledReachOutPreflight> = {};
      const errors: Record<string, string> = {};
      for (const entry of results) {
        if (entry.result.ok) {
          preflights[entry.draftId] = entry.result.preflight;
        } else {
          errors[entry.draftId] = visibleControlledReachOutError(entry.result.error);
        }
      }
      setControlledReachOutByDraftId(preflights);
      setControlledReachOutErrors(errors);
    }

    void loadControlledReachOut();
    return () => {
      isActive = false;
    };
  }, [draftsByTaskId]);

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
      void refreshOperationsDashboard();
    } else {
      setTaskErrors((current) => ({
        ...current,
        [task.id]: visibleErrorMessage(result.error),
      }));
    }

    setUpdatingTaskId(null);
  }

  function replaceDraft(taskId: string, draft: FollowUpMessageDraftDto) {
    setDraftsByTaskId((current) => ({
      ...current,
      [taskId]: [draft, ...(current[taskId] ?? []).filter((item) => item.draftId !== draft.draftId)],
    }));
    setDraftEdits((current) => ({ ...current, [draft.draftId]: draftContentValue(draft) }));
    if (draft.status !== 'approved') {
      setControlledReachOutByDraftId((current) => {
        const next = { ...current };
        delete next[draft.draftId];
        return next;
      });
      setControlledReachOutErrors((current) => {
        const next = { ...current };
        delete next[draft.draftId];
        return next;
      });
    }
  }

  async function handleCreateDraft(task: TenantFollowUpTask) {
    setUpdatingDraftKey(`${task.id}:create`);
    setDraftErrors((current) => ({ ...current, [task.id]: '' }));
    const result = await createFollowUpMessageDraft({ followUpTaskId: task.id });

    if (result.ok) {
      replaceDraft(task.id, result.record);
      void refreshOperationsDashboard();
    } else {
      setDraftErrors((current) => ({ ...current, [task.id]: visibleErrorMessage(result.error) }));
    }

    setUpdatingDraftKey(null);
  }

  async function handleUpdateDraft(taskId: string, draft: FollowUpMessageDraftDto) {
    setUpdatingDraftKey(`${draft.draftId}:update`);
    setDraftErrors((current) => ({ ...current, [taskId]: '' }));
    const result = await updateFollowUpMessageDraft(draft.draftId, {
      content: draftEdits[draft.draftId] ?? draftContentValue(draft),
    });

    if (result.ok) {
      replaceDraft(taskId, result.record);
      void refreshOperationsDashboard();
    } else {
      setDraftErrors((current) => ({ ...current, [taskId]: visibleErrorMessage(result.error) }));
    }

    setUpdatingDraftKey(null);
  }

  async function handleDraftAction(
    taskId: string,
    draft: FollowUpMessageDraftDto,
    action: 'approve' | 'reject' | 'mark_sent',
  ) {
    setUpdatingDraftKey(`${draft.draftId}:${action}`);
    setDraftErrors((current) => ({ ...current, [taskId]: '' }));
    const result = action === 'approve'
      ? await approveFollowUpMessageDraft(draft.draftId)
      : action === 'reject'
        ? await rejectFollowUpMessageDraft(draft.draftId)
        : await markFollowUpMessageDraftAsSent(draft.draftId);

    if (result.ok) {
      replaceDraft(taskId, result.record);
      void refreshOperationsDashboard();
    } else {
      setDraftErrors((current) => ({ ...current, [taskId]: visibleErrorMessage(result.error) }));
    }

    setUpdatingDraftKey(null);
  }

  async function handleControlledReachOut(draft: FollowUpMessageDraftDto) {
    setUpdatingDraftKey(`${draft.draftId}:wecom-controlled-reachout`);
    setControlledReachOutErrors((current) => ({ ...current, [draft.draftId]: '' }));
    const result = await prepareWeComControlledReachOut(draft.draftId);

    if (result.ok) {
      setControlledReachOutByDraftId((current) => ({ ...current, [draft.draftId]: result.preflight }));
    } else {
      setControlledReachOutErrors((current) => ({
        ...current,
        [draft.draftId]: result.error.kind === 'conflict'
          ? '草稿状态已变化，当前请求发生冲突，请刷新后重试。'
          : visibleErrorMessage(result.error),
      }));
    }

    setUpdatingDraftKey(null);
  }

  const overview = operationsDashboard.overview;
  const draftOperations = operationsDashboard.draftOperations;
  const messageDeliveries = operationsDashboard.messageDeliveries;
  const contactSafety = operationsDashboard.contactSafety ?? emptyOperationsDashboard.contactSafety;
  const weComAuthorization = operationsDashboard.weComAuthorization ?? emptyOperationsDashboard.weComAuthorization;
  const weComCustomerContactSync = operationsDashboard.weComCustomerContactSync ?? emptyOperationsDashboard.weComCustomerContactSync;
  const weComMockReachOut = operationsDashboard.weComMockReachOut ?? emptyOperationsDashboard.weComMockReachOut;
  const safetyBlockedCount =
    (overview.consentMissingBlockedCount ?? contactSafety.consentMissingBlockedCount) +
    (overview.optOutBlockedCount ?? contactSafety.optOutBlockedCount) +
    (overview.frequencyCapBlockedCount ?? contactSafety.frequencyCapBlockedCount) +
    (overview.channelDisabledCount ?? contactSafety.channelDisabledCount) +
    (overview.grayGuardBlockedCount ?? contactSafety.grayGuardBlockedCount);
  const riskSummary = operationsDashboard.riskSummary;
  const dashboardHasData = hasOperationsData(operationsDashboard);

  return (
    <section className="space-y-5">
      <InstitutionSectionHeader
        eyebrow="智能随访"
        title="智能随访"
        description="运营负责人可一眼看懂今天谁要跟、为什么要跟、任务来自哪里。任务需人工处理，不会主动向客户发送消息。"
        tone="violet"
        action={
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700">
            <ShieldCheck className="h-4 w-4" />
            任务需人工处理
          </div>
        }
      />

      <article className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-500">
              <TrendingUp className="h-4 w-4" />
              运营看板 / 路径效果
            </div>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">智能随访运营看板</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              本区域为内部运营统计，不代表已自动联系客户；标记已发送仅代表人工记录。触达安全治理默认关闭，渠道灰度前置，当前没有企业微信 / 短信接入，不做自动营销群发。
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
            只读聚合
          </span>
        </div>

        {isOperationsLoading ? (
          <InstitutionPageState kind="loading" title="正在加载运营看板..." className="mt-4" />
        ) : null}

        {!isOperationsLoading && operationsErrorState ? (
          <InstitutionPageState {...operationsErrorState} className="mt-4" />
        ) : null}

        {!isOperationsLoading && !operationsErrorState ? (
          <div className="mt-5 space-y-5">
            {!dashboardHasData ? (
              <InstitutionPageState
                kind="empty"
                title="暂无随访运营数据"
                description="当前还没有路径、任务、草稿或时间线记录。这里仅展示内部统计，不会自动联系客户。"
              />
            ) : null}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <OperationsMetricCard
                label="今日待随访"
                value={overview.todayDueTaskCount}
                description="到期日在今日且仍需人工处理的任务。"
                tone="violet"
              />
              <OperationsMetricCard
                label="逾期任务"
                value={overview.overdueTaskCount}
                description="已超过到期时间，需优先跟进。"
                tone={overview.overdueTaskCount > 0 ? 'rose' : 'slate'}
              />
              <OperationsMetricCard
                label="高风险 / 已升级"
                value={overview.highRiskTaskCount + overview.escalatedTaskCount}
                description={`高风险 ${overview.highRiskTaskCount}，已升级 ${overview.escalatedTaskCount}。`}
                tone={overview.highRiskTaskCount + overview.escalatedTaskCount > 0 ? 'amber' : 'slate'}
              />
              <OperationsMetricCard
                label="已确认待人工发送"
                value={overview.approvedButNotMarkedSentCount}
                description="草稿已确认，但尚未标记为人工发送。"
                tone="emerald"
              />
              <OperationsMetricCard
                label="受控发送记录"
                value={overview.messageDeliveryCount}
                description={`模拟成功 ${overview.mockSentCount}，失败 ${overview.mockFailedCount}，跳过 ${overview.skippedCount}，外部禁用 ${overview.externalDisabledCount}。`}
                tone="violet"
              />
              <OperationsMetricCard
                label="企业微信 mock 触达"
                value={weComMockReachOut.recordCount}
                description={`成功 ${weComMockReachOut.mockSentCount}，失败 ${weComMockReachOut.mockFailedCount}，跳过 ${weComMockReachOut.skippedCount}，外部禁用 ${weComMockReachOut.externalDisabledCount}。`}
                tone="emerald"
              />
              <OperationsMetricCard
                label="安全治理阻断"
                value={safetyBlockedCount}
                description={`未授权 ${overview.consentMissingBlockedCount ?? contactSafety.consentMissingBlockedCount}，退订 ${overview.optOutBlockedCount ?? contactSafety.optOutBlockedCount}，频控 ${overview.frequencyCapBlockedCount ?? contactSafety.frequencyCapBlockedCount}，渠道/灰度 ${(overview.channelDisabledCount ?? contactSafety.channelDisabledCount) + (overview.grayGuardBlockedCount ?? contactSafety.grayGuardBlockedCount)}。`}
                tone="amber"
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-950">路径执行概览</h4>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      按路径模板聚合 active enrollment、待办、完成、逾期和完成率。
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
                    活跃路径 {overview.activeEnrollmentCount}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {operationsDashboard.pathPerformance.map((path) => (
                    <div key={path.templateKey} className="rounded-2xl border border-white bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-950">{path.pathName}</div>
                          <p className="mt-1 text-xs font-semibold text-slate-400">{path.templateKey}</p>
                        </div>
                        <span className="rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                          {formatPercent(path.completionRate)}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-4 gap-2 text-xs font-semibold text-slate-500">
                        <span className="rounded-xl bg-slate-50 px-2 py-2">active {path.activeEnrollmentCount}</span>
                        <span className="rounded-xl bg-slate-50 px-2 py-2">待办 {path.pendingTaskCount}</span>
                        <span className="rounded-xl bg-slate-50 px-2 py-2">完成 {path.completedTaskCount}</span>
                        <span className="rounded-xl bg-slate-50 px-2 py-2">逾期 {path.overdueTaskCount}</span>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        已生成任务 {path.generatedTaskCount}，升级 {path.escalatedTaskCount}；下次到期：{path.nextDueAt ? formatBusinessDateTime(path.nextDueAt) : '--'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
                  <h4 className="text-sm font-semibold text-slate-950">草稿处理概览</h4>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600">
                    <span className="rounded-xl bg-white px-3 py-2">草稿数 {draftOperations.draftCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">已确认 {draftOperations.approvedDraftCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">已拒绝 {draftOperations.rejectedDraftCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">已人工发送 {draftOperations.markedSentCount}</span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    已确认但未标记发送：{draftOperations.approvedButNotMarkedSentCount}。所有草稿均需人工确认，不会自动发送消息。
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                  <h4 className="text-sm font-semibold text-slate-950">触达安全治理 / 渠道灰度前置</h4>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-blue-700">
                    <span className="rounded-xl bg-white px-3 py-2">允许触达 {contactSafety.allowedCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">未授权 {contactSafety.consentMissingBlockedCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">客户退订 {contactSafety.optOutBlockedCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">频率限制 {contactSafety.frequencyCapBlockedCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">渠道禁用 {contactSafety.channelDisabledCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">灰度阻断 {contactSafety.grayGuardBlockedCount}</span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    默认关闭、灰度前置、人工确认、模拟发送、不自动发送；未进入灰度不触达，客户退订 / 未授权 / 频率限制会阻断。
                  </p>
                </div>

                <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
                  <h4 className="text-sm font-semibold text-slate-950">企业微信客户联系</h4>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    企业微信客户联系 / 外部联系人当前仅 mock：不是企业微信登录，不是个人微信好友同步，不是聊天记录同步；未接真实企业微信，不真实出网，不同步真实客户。
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-cyan-700">
                    <span className="rounded-xl bg-white px-3 py-2">同步状态：{weComCustomerContactSync.statusLabel}</span>
                    <span className="rounded-xl bg-white px-3 py-2">外部联系人 {weComCustomerContactSync.externalContactCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">已关联系统客户 {weComCustomerContactSync.linkedSystemCustomerCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">未关联客户 {weComCustomerContactSync.unlinkedCustomerCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">可用于随访 {weComCustomerContactSync.availableForFollowUpCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">不可用于随访 {weComCustomerContactSync.unavailableForFollowUpCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">客户归属员工已映射 {weComCustomerContactSync.mappedOwnerEmployeeCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">客户归属员工未映射 {weComCustomerContactSync.unmappedOwnerEmployeeCount}</span>
                  </div>
                  <div className="mt-3 space-y-2 rounded-2xl bg-white/80 p-3 text-xs leading-5 text-slate-600">
                    <p><span className="font-semibold text-slate-800">客户标签：</span>{weComCustomerContactSync.tagsSummary}</p>
                    <p><span className="font-semibold text-slate-800">客户来源：</span>{weComCustomerContactSync.sourceSummary}</p>
                    <p><span className="font-semibold text-slate-800">客户归属员工：</span>{weComCustomerContactSync.ownerEmployeeSummary}</p>
                    <p><span className="font-semibold text-slate-800">客户备注：</span>{weComCustomerContactSync.remarkSummary}</p>
                    <p><span className="font-semibold text-slate-800">最近同步：</span>{weComCustomerContactSync.lastSyncedAt ? formatBusinessDateTime(weComCustomerContactSync.lastSyncedAt) : '--'}</p>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    {weComCustomerContactSync.safeSummary} 会话内容存档后置；{weComCustomerContactSync.deliveryPrerequisites.description}
                  </p>
                  {weComCustomerContactSync.contacts.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {weComCustomerContactSync.contacts.slice(0, 3).map((contact) => (
                        <div key={contact.mockExternalContactId} className="rounded-xl bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                          <div className="font-semibold text-slate-800">
                            {contact.customerDisplayName} · {contact.syncStatusLabel} · {contact.linkedToSystemCustomer ? '已关联系统客户' : '未关联系统客户'}
                          </div>
                          <div className="mt-1">外部联系人：{contact.mockExternalContactId}；客户归属员工：{contact.ownerEmployeeDisplayName}；{contact.ownerEmployeeMapped ? '已低敏映射机构员工' : '未映射机构员工，显示低敏空态'}</div>
                          <div className="mt-1">来源：{contact.source}；标签：{contact.tags.join(' / ')}；{contact.remarkSummary}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <h4 className="text-sm font-semibold text-slate-950">企业微信随访触达 mock</h4>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    当前仅 mock，未接真实企业微信，不真实发送，不真实出网，不使用真实 webhook；必须人工确认、经过 MessageDelivery、具备企业微信授权状态和客户联系 mock 关系后才写回本地状态。
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-emerald-700">
                    <span className="rounded-xl bg-white px-3 py-2">记录总数 {weComMockReachOut.recordCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">mock_sent {weComMockReachOut.mockSentCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">mock_failed {weComMockReachOut.mockFailedCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">skipped {weComMockReachOut.skippedCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">external_disabled {weComMockReachOut.externalDisabledCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">可触达客户 {weComMockReachOut.reachableCustomerCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">不可触达客户 {weComMockReachOut.unreachableCustomerCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">不真实发送：{weComMockReachOut.noRealSend ? '是' : '否'}</span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    {weComMockReachOut.safeSummary} 不是企业微信登录，不是个人微信好友同步，不是聊天记录同步；mock 已授权也不会真实发送。
                  </p>
                  {weComMockReachOut.recentRecords.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {weComMockReachOut.recentRecords.slice(0, 3).map((record) => (
                        <div key={`${record.deliveryId}:${record.status}`} className="rounded-xl bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                          <div className="font-semibold text-slate-800">{record.status} · {record.channelType} / {record.deliveryMode}</div>
                          <div className="mt-1">{record.safeReasonLabel}</div>
                          <div className="mt-1">外部联系人：{record.mockExternalContactId ?? '低敏空态'}；归属员工：{record.ownerEmployeeRef ?? '低敏空态'}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
                  <h4 className="text-sm font-semibold text-slate-950">企业微信客户运营接入</h4>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    不是企业微信登录；机构员工仍使用现有账号体系。这里仅展示机构授权其自有企业微信主体后的低敏客户运营状态。
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-cyan-700">
                    <span className="rounded-xl bg-white px-3 py-2">状态：{weComAuthorization.statusLabel}</span>
                    <span className="rounded-xl bg-white px-3 py-2">模拟授权：{weComAuthorization.isMockAuthorized ? '是' : '否'}</span>
                    <span className="rounded-xl bg-white px-3 py-2">客户联系：{weComAuthorization.customerContactAuthorized ? '已授权' : '未授权'}</span>
                    <span className="rounded-xl bg-white px-3 py-2">外部联系人同步：{weComAuthorization.externalContactSyncAuthorized ? '已授权' : '后续能力'}</span>
                    <span className="rounded-xl bg-white px-3 py-2">企业微信触达：{weComAuthorization.weComReachOutAuthorized ? 'mock 可读' : '未授权'}</span>
                    <span className="rounded-xl bg-white px-3 py-2">会话内容存档：后置规划</span>
                    <span className="rounded-xl bg-white px-3 py-2">默认关闭：{weComAuthorization.defaultClosed ? '是' : '否'}</span>
                    <span className="rounded-xl bg-white px-3 py-2">不真实发送：{weComAuthorization.allowRealSend ? '否' : '是'}</span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    未接真实企业微信，未申请服务商 / 未接真实接口；客户联系 / 外部联系人同步为后续能力，会话内容存档为高风险后置能力。企业微信触达必须经过人工确认和 MessageDelivery。
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {weComAuthorization.deliveryRelation.description}
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                  <h4 className="text-sm font-semibold text-slate-950">受控发送基础闭环</h4>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-blue-700">
                    <span className="rounded-xl bg-white px-3 py-2">发送记录 {messageDeliveries.messageDeliveryCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">mock_sent {messageDeliveries.mockSentCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">mock_failed {messageDeliveries.mockFailedCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">skipped {messageDeliveries.skippedCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">external_disabled {messageDeliveries.externalDisabledCount}</span>
                    <span className="rounded-xl bg-white px-3 py-2">低敏记录</span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    人工确认后才生成 MessageDelivery；先做触达安全治理，默认关闭、灰度前置，仅模拟发送，不自动发送，未接真实企业微信 / 短信。
                  </p>
                  {messageDeliveries.recentDeliveries.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {messageDeliveries.recentDeliveries.slice(0, 3).map((delivery) => (
                        <div key={delivery.deliveryId} className="rounded-xl bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                          <div className="font-semibold text-slate-800">{delivery.status} · {delivery.channelType} / {delivery.deliveryMode}</div>
                          <div className="mt-1">{delivery.contactSafety?.safeReasonLabel ?? '触达安全治理低敏记录：默认关闭、灰度前置、仅模拟发送。'}</div>
                          <div className="mt-1">{delivery.contentSnapshot}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                  <h4 className="text-sm font-semibold text-slate-950">风险汇总</h4>
                  <div className="mt-3 space-y-2 text-xs font-semibold text-amber-700">
                    <div className="flex justify-between rounded-xl bg-white px-3 py-2"><span>已升级任务</span><span>{riskSummary.escalatedTaskCount}</span></div>
                    <div className="flex justify-between rounded-xl bg-white px-3 py-2"><span>高风险任务</span><span>{riskSummary.highRiskTaskCount}</span></div>
                    <div className="flex justify-between rounded-xl bg-white px-3 py-2"><span>高风险待办</span><span>{riskSummary.highRiskPendingTaskCount}</span></div>
                    <div className="flex justify-between rounded-xl bg-white px-3 py-2"><span>逾期高风险</span><span>{riskSummary.overdueHighRiskTaskCount}</span></div>
                    <div className="flex justify-between rounded-xl bg-white px-3 py-2"><span>人工反馈记录</span><span>{riskSummary.manualFeedbackCount}</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-950">员工 / 角色工作量概览</h4>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    当前按路径阶段 handlerRole 聚合；现有任务模型没有个人负责人字段，因此不展示个人身份。
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                  角色数 {operationsDashboard.workload.length}
                </span>
              </div>
              {operationsDashboard.workload.length === 0 ? (
                <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  暂无角色工作量数据。
                </p>
              ) : (
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {operationsDashboard.workload.map((item) => (
                    <div key={`${item.handlerRole}:${item.assignedUserId ?? 'none'}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="text-sm font-semibold text-slate-950">
                        {handlerRoleLabels[item.handlerRole] ?? item.handlerRole}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-500">
                        <span className="rounded-xl bg-white px-2 py-2">待办 {item.pendingTaskCount}</span>
                        <span className="rounded-xl bg-white px-2 py-2">逾期 {item.overdueTaskCount}</span>
                        <span className="rounded-xl bg-white px-2 py-2">完成 {item.completedTaskCount}</span>
                        <span className="rounded-xl bg-white px-2 py-2">升级 {item.escalatedTaskCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </article>

      <article className="rounded-[24px] border border-violet-100 bg-violet-50/70 p-5 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">路径管理 / 路径实例</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              仅展示已纳入的随访路径实例。阶段任务全部进入人工队列，不会通过企业微信、短信或其他渠道主动触达客户。
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-semibold text-violet-700">
            当前 active：{isEnrollmentLoading ? '--' : enrollments.filter((item) => item.status === 'active').length}
          </span>
        </div>

        {isEnrollmentLoading ? (
          <InstitutionPageState kind="loading" title="正在加载路径实例..." className="mt-4" />
        ) : null}

        {!isEnrollmentLoading && enrollmentErrorState ? (
          <InstitutionPageState {...enrollmentErrorState} className="mt-4" />
        ) : null}

        {!isEnrollmentLoading && !enrollmentErrorState && enrollments.length === 0 ? (
          <InstitutionPageState
            kind="empty"
            title="暂无路径实例"
            description="治疗摘要纳入路径后，会在这里展示客户、路径、阶段任务和下一次到期时间。"
            className="mt-4"
          />
        ) : null}

        {!isEnrollmentLoading && !enrollmentErrorState && enrollments.length > 0 ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {enrollments.map((enrollment) => (
              <div
                key={enrollment.enrollmentId}
                data-testid="followup-path-enrollment-card"
                className="rounded-2xl border border-violet-100 bg-white/90 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">
                      {enrollment.customerDisplayName}
                    </div>
                    <p className="mt-1 text-xs font-semibold text-violet-700">
                      路径：{enrollment.templateKey}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {enrollment.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold text-slate-500">
                  <span className="rounded-xl bg-slate-50 px-2 py-2">阶段 {enrollment.stageCount}</span>
                  <span className="rounded-xl bg-slate-50 px-2 py-2">任务 {enrollment.taskCount}</span>
                  <span className="rounded-xl bg-slate-50 px-2 py-2">
                    下次 {enrollment.dueAt ? formatBusinessDateTime(enrollment.dueAt) : '--'}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">{enrollment.safeMessage}</p>
              </div>
            ))}
          </div>
        ) : null}
      </article>

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
              <p className="mt-1 text-sm text-slate-500">
                优先处理高风险、临近到期和来源为治疗摘要的任务。
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="text-xs font-semibold text-slate-500">
                来源筛选
                <select
                  value={sourceFilter}
                  onChange={(event) =>
                    setSourceFilter(event.target.value as FollowUpSourceFilter)
                  }
                  className="ml-2 h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none focus:border-violet-300"
                >
                  <option value="all">全部来源</option>
                  <option value="treatment_summary">治疗摘要来源</option>
                </select>
              </label>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                人工队列
              </span>
            </div>
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
              description="当前没有需要人工处理的随访任务，可回到治疗摘要管理查看建议来源。"
              className="mt-4"
            />
          ) : null}

          {!isLoading && !listErrorState && sortedTasks.length > 0 ? (
            <div className="mt-4 space-y-3">
              {sortedTasks.map((task) => {
                const nextStatuses = getAllowedFollowUpNextStatuses(task.status);
                const currentSourceLabel = sourceLabel(task.source);
                const draft = draftsByTaskId[task.id]?.[0];
                const draftEdit = draft ? draftEdits[draft.draftId] ?? draftContentValue(draft) : '';
                const controlledReachOut = draft ? controlledReachOutByDraftId[draft.draftId] : undefined;
                const controlledReachOutError = draft ? controlledReachOutErrors[draft.draftId] : undefined;

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
                          {currentSourceLabel ? (
                            <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                              来源：{currentSourceLabel}
                            </span>
                          ) : null}
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
                        {currentSourceLabel ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                              建议 key 用于来源追踪和避免重复创建。
                            </span>
                            {task.sourceTreatmentSummaryId ? (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                来源摘要：{task.sourceTreatmentSummaryId}
                              </span>
                            ) : null}
                            {task.sourceSuggestionKey ? (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                建议 key：{task.sourceSuggestionKey}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
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

                      <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <MessageSquareText className="h-4 w-4 text-violet-600" />
                              <span className="text-sm font-semibold text-slate-950">消息草稿</span>
                              {draft ? (
                                <span className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-violet-700">
                                  {draftStatusLabels[draft.status]}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                              仅生成低敏草稿，不会自动发送消息；需要人工确认，人工确认后生成受控发送记录并模拟发送，当前未接真实企业微信 / 短信。
                            </p>
                          </div>
                          {!draft ? (
                            <button
                              type="button"
                              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-violet-200 bg-white px-3 text-xs font-semibold text-violet-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                              onClick={() => handleCreateDraft(task)}
                              disabled={updatingDraftKey === `${task.id}:create`}
                            >
                              {updatingDraftKey === `${task.id}:create` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              生成草稿
                            </button>
                          ) : null}
                        </div>

                        {draft ? (
                          <div className="mt-3 space-y-3">
                            <div className="rounded-2xl border border-white/80 bg-white/86 p-3">
                              <div className="text-xs font-semibold text-slate-400">低敏预览</div>
                              <p className="mt-2 text-sm leading-6 text-slate-700">
                                {visibleDraftSummary(draft)}
                              </p>
                            </div>

                            <label className="block text-xs font-semibold text-slate-500">
                              草稿内容
                              <textarea
                                value={draftEdit}
                                onChange={(event) =>
                                  setDraftEdits((current) => ({
                                    ...current,
                                    [draft.draftId]: event.target.value,
                                  }))
                                }
                                disabled={!isDraftEditable(draft)}
                                className="mt-2 min-h-24 w-full rounded-2xl border border-violet-100 bg-white px-3 py-2 text-sm leading-6 text-slate-700 outline-none focus:border-violet-300 disabled:bg-slate-100 disabled:text-slate-500"
                              />
                            </label>

                            <div className="flex flex-wrap gap-2">
                              {isDraftEditable(draft) ? (
                                <button
                                  type="button"
                                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                  onClick={() => handleUpdateDraft(task.id, draft)}
                                  disabled={updatingDraftKey === `${draft.draftId}:update`}
                                >
                                  {updatingDraftKey === `${draft.draftId}:update` ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : null}
                                  保存草稿
                                </button>
                              ) : null}
                              {draft.status === 'draft' ? (
                                <>
                                  <button
                                    type="button"
                                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                    onClick={() => handleDraftAction(task.id, draft, 'approve')}
                                    disabled={updatingDraftKey === `${draft.draftId}:approve`}
                                  >
                                    {updatingDraftKey === `${draft.draftId}:approve` ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : null}
                                    人工确认
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                    onClick={() => handleDraftAction(task.id, draft, 'reject')}
                                    disabled={updatingDraftKey === `${draft.draftId}:reject`}
                                  >
                                    {updatingDraftKey === `${draft.draftId}:reject` ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : null}
                                    拒绝草稿
                                  </button>
                                </>
                              ) : null}
                              {draft.status === 'approved' ? (
                                <button
                                  type="button"
                                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                  onClick={() => handleDraftAction(task.id, draft, 'mark_sent')}
                                  disabled={updatingDraftKey === `${draft.draftId}:mark_sent`}
                                >
                                  {updatingDraftKey === `${draft.draftId}:mark_sent` ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : null}
                                  标记已人工发送
                                </button>
                              ) : null}
                            </div>

                            {draft.status === 'approved' ? (
                              <section
                                aria-label="企业微信受控触达"
                                className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <h4 className="text-sm font-semibold text-slate-950">企业微信受控触达</h4>
                                    <p className="mt-1 text-xs text-slate-500">
                                      仅单客户 · 必须人工确认 · 当前只完成发送前准备
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center justify-end gap-2">
                                    <span className="rounded-full border border-cyan-200 bg-white px-2.5 py-1 text-xs font-semibold text-cyan-700">
                                      {controlledReachOutError
                                        ? '阻断：门禁检查失败'
                                        : controlledReachOut?.blockReason
                                          ? `阻断：${controlledReachOutBlockReasonLabels[controlledReachOut.blockReason]}`
                                          : controlledReachOut?.controlledReachOut?.status === 'ready_no_send'
                                            ? 'ready_no_send'
                                            : controlledReachOut?.readOnly
                                              ? '只读'
                                              : '待检查'}
                                    </span>
                                    {controlledReachOut?.readOnly ? (
                                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                                        只读权限
                                      </span>
                                    ) : null}
                                  </div>
                                </div>

                                {controlledReachOut ? (
                                  <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                                    <div>MessageDelivery：{controlledReachOut.delivery?.messageDeliveryId ?? '缺失'}</div>
                                    <div>
                                      内部模拟投递：{
                                        controlledReachOut.delivery?.channelType === 'mock' &&
                                        controlledReachOut.delivery.deliveryMode === 'mock' &&
                                        controlledReachOut.delivery.status === 'mock_sent' &&
                                        controlledReachOut.blockReason !== 'delivery_not_internal_mock'
                                          ? '已生成（仅内部 mock）'
                                          : controlledReachOut.delivery
                                            ? '兼容只读，不能用于受控准备'
                                            : '缺失'
                                      }
                                    </div>
                                    <div>
                                      企业微信受控触达：{
                                        controlledReachOut.controlledReachOut?.status === 'ready_no_send'
                                          ? '仅准备，未真实发送'
                                          : '尚未准备，未真实发送'
                                      }
                                    </div>
                                    <div>映射：{controlledReachOut.mapping.status}</div>
                                    <div>consent：{controlledReachOut.consent.status}</div>
                                    <div>frequency：{controlledReachOut.frequency.status}</div>
                                    <div>dry-run snapshot：{controlledReachOut.dryRun.status}</div>
                                    <div>真实发送开关：关闭</div>
                                  </dl>
                                ) : (
                                  <p className="mt-3 text-xs text-slate-500">
                                    {controlledReachOutError ? '受控触达门禁检查失败，当前保持阻断。' : '受控触达门禁正在加载。'}
                                  </p>
                                )}

                                <p className="mt-3 text-xs leading-5 text-slate-500">
                                  不调用真实企业微信 · 不产生客户可见消息 · 不代表已经发送
                                </p>
                                <button
                                  type="button"
                                  className="mt-3 inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-cyan-200 bg-white px-3 text-xs font-semibold text-cyan-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                                  onClick={() => handleControlledReachOut(draft)}
                                  disabled={
                                    !controlledReachOut?.canPrepare ||
                                    controlledReachOut.readOnly ||
                                    updatingDraftKey === `${draft.draftId}:wecom-controlled-reachout`
                                  }
                                >
                                  {updatingDraftKey === `${draft.draftId}:wecom-controlled-reachout` ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : null}
                                  准备受控触达（不发送）
                                </button>
                                {controlledReachOutError ? (
                                  <p role="alert" className="mt-2 text-xs font-semibold text-rose-700">
                                    {controlledReachOutError}
                                  </p>
                                ) : null}
                              </section>
                            ) : null}
                          </div>
                        ) : null}

                        {draftErrors[task.id] ? (
                          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {draftErrors[task.id]}
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
                <p className="mt-1 text-sm text-slate-500">优先展示真实路径实例，不代表外部客服接入能力。</p>
              </div>
            </div>
            {isEnrollmentLoading ? (
              <InstitutionPageState kind="loading" title="正在加载随访旅程..." className="mt-4" />
            ) : null}
            {!isEnrollmentLoading && !enrollmentErrorState && enrollments.length > 0 ? (
              <div className="mt-4 space-y-3">
                {enrollments.slice(0, 3).map((enrollment) => (
                  <div
                    key={enrollment.enrollmentId}
                    className="rounded-2xl border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-950">
                        {enrollment.customerDisplayName}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                        {enrollment.stageCount} 阶段
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {enrollment.templateKey} · {enrollment.taskCount} 个人工任务 · 下次到期：
                      {enrollment.dueAt ? formatBusinessDateTime(enrollment.dueAt) : '--'}
                    </p>
                    <div className="mt-2 space-y-1">
                      {enrollment.stages.slice(0, 3).map((stage) => (
                        <div
                          key={stage.nodeKey}
                          className="rounded-xl bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-500"
                        >
                          {stage.stageKey} · {followUpStatusLabels[stage.status]} · 人工处理
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {!isEnrollmentLoading && (enrollmentErrorState || enrollments.length === 0) ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-sm leading-6 text-slate-500">
                暂无真实随访路径实例。治疗摘要纳入路径后，会在这里展示客户随访旅程。
              </div>
            ) : null}
          </article>

          <article className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <MessageSquareText className="h-5 w-5 text-emerald-600" />
              <div>
                <h3 className="text-lg font-semibold text-slate-950">话术建议</h3>
                <p className="mt-1 text-sm text-slate-500">暂无真实话术配置时保持空态。</p>
              </div>
            </div>

            {followUpMessageSuggestions.length > 0 ? (
              <div className="mt-4 space-y-3">
                {followUpMessageSuggestions.map((suggestion) => (
                <div
                  key={suggestion.title}
                  className="rounded-2xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <MessageSquareText className="h-4 w-4 text-emerald-600" />
                    {suggestion.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {suggestion.content}
                  </p>
                </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-sm leading-6 text-slate-500">
                暂无真实话术建议。
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
              任务需人工处理，不会主动向客户发送消息。
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}
