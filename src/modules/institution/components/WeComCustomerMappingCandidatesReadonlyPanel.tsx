'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Check,
  CircleAlert,
  Link2,
  LoaderCircle,
  MessageSquareMore,
  RotateCcw,
  ShieldAlert,
  TriangleAlert,
  X,
} from 'lucide-react';
import {
  createWeComCustomerMappingReviewIdempotencyKey,
  getAvailableWeComCustomerMappingReviewActions,
  isWeComCustomerMappingReviewNoteRequired,
  submitWeComCustomerMappingReviewAction,
  weComCustomerMappingReviewActionLabels,
  weComCustomerMappingReviewReasonOptions,
  type WeComCustomerMappingReviewAction,
  type WeComCustomerMappingReviewReasonCode,
  type WeComCustomerMappingReviewState,
} from '@/modules/institution/client/wecom-customer-mapping-review-actions-client';
import type {
  WeComCustomerMappingCandidatesResponse,
  WeComCustomerMappingFailClosedReason,
} from '@/modules/institution/view-models/wecom-customer-mapping-candidates';
import { readWeComCustomerMappingCandidatesResponse } from '@/modules/institution/view-models/wecom-customer-mapping-candidates-reader';

const mappingStatusLabels = {
  unmatched: '未匹配',
  candidate: '候选待查看',
  manual_review_required: '需要人工复核',
  conflict: '存在冲突',
  matched: '已匹配',
  rejected: '已拒绝',
  needs_more_info: '需要更多信息',
  stale: '候选已过期',
  disabled: '已关闭',
  cleared_locked: '已清理并锁定',
} as const;

const confidenceLabels = {
  low: '低置信度',
  medium: '中置信度',
  high: '高置信度',
} as const;

const systemCustomerStatusLabels = {
  active: '有效',
  inactive: '停用',
  manual_review_required: '需复核',
} as const;

const manualReviewLabels = {
  not_required: '当前无需人工复核',
  pending: '等待人工复核',
  required: '需要人工复核',
  unavailable: '复核状态不可用',
} as const;

const reviewStateLabels: Record<WeComCustomerMappingReviewState, string> = {
  pending_review: '等待人工复核',
  needs_more_info: '等待补充信息',
  conflict: '冲突待处理',
  approved_pending_link: '已确认，待后续关联',
  rejected: '已拒绝',
  reopened: '已重新打开',
  disabled: '复核已关闭',
};

const failClosedReasonLabels: Record<WeComCustomerMappingFailClosedReason, string> = {
  provider_disabled: '候选来源当前已关闭',
  external_provider_disabled: '外部候选来源当前已关闭',
  authorization_revoked: '机构授权当前不可用',
  tenant_fixture_unavailable: '当前机构没有可用的受控候选数据',
  fixture_registry_initialization_blocked: '受控候选数据当前不可用',
  audit_not_ready: '只读审计状态当前不可用',
  manifest_entry_missing: '受控候选清单当前不可用',
  response_contract_invalid: '候选响应未通过安全校验',
  response_json_invalid: '候选响应格式不可用',
  response_unavailable: '候选服务当前不可用',
};

const auditStatusLabels = {
  recorded: '已记录',
  blocked: '已阻断',
} as const;

const auditReasonLabels = {
  candidate_evidence_available: '候选依据可用',
  provider_disabled: '候选来源已关闭',
  external_provider_disabled: '外部候选来源已关闭',
  authorization_revoked: '机构授权不可用',
  tenant_fixture_unavailable: '受控机构数据不可用',
  fixture_registry_initialization_blocked: '受控数据初始化已阻断',
  audit_not_ready: '审计状态不可用',
  manifest_entry_missing: '受控候选清单缺失',
  response_contract_invalid: '响应安全校验未通过',
  response_json_invalid: '响应格式不可用',
  response_unavailable: '响应服务不可用',
} as const;

const actionButtonClasses: Record<WeComCustomerMappingReviewAction, string> = {
  approve_candidate: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  reject_candidate: 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100',
  request_more_info: 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100',
  mark_conflict: 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100',
  reopen_review: 'border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100',
};

const actionIcons = {
  approve_candidate: Check,
  reject_candidate: X,
  request_more_info: MessageSquareMore,
  mark_conflict: TriangleAlert,
  reopen_review: RotateCcw,
} satisfies Record<WeComCustomerMappingReviewAction, typeof Check>;

type PanelState =
  | { kind: 'loading' }
  | { kind: 'loaded'; data: WeComCustomerMappingCandidatesResponse }
  | { kind: 'forbidden' }
  | { kind: 'failed' };

type ReviewDraft = {
  action: WeComCustomerMappingReviewAction;
  reasonCode: WeComCustomerMappingReviewReasonCode;
  note: string;
};

type Notice = {
  tone: 'success' | 'warning' | 'danger';
  message: string;
};

type SubmissionAttempt = {
  fingerprint: string;
  idempotencyKey: string;
};

type WeComCustomerMappingCandidatesPanelProps = {
  requestScopeKey?: string;
  canReview?: boolean;
};

function submissionFingerprint(
  data: WeComCustomerMappingCandidatesResponse,
  draft: ReviewDraft,
  note: string | undefined,
) {
  return JSON.stringify([
    data.mappingId,
    data.mappingVersion,
    draft.action,
    draft.reasonCode,
    note ?? null,
  ]);
}

export function WeComCustomerMappingCandidatesReadonlyPanel({
  requestScopeKey = 'current-session',
  canReview = false,
}: WeComCustomerMappingCandidatesPanelProps) {
  return (
    <WeComCustomerMappingCandidatesPanelSession
      key={requestScopeKey}
      requestScopeKey={requestScopeKey}
      canReview={canReview}
    />
  );
}

function WeComCustomerMappingCandidatesPanelSession({
  requestScopeKey,
  canReview,
}: Required<WeComCustomerMappingCandidatesPanelProps>) {
  const [state, setState] = useState<PanelState>({ kind: 'loading' });
  const [reloadVersion, setReloadVersion] = useState(0);
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewAccessRevoked, setReviewAccessRevoked] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const mutationControllerRef = useRef<AbortController | null>(null);
  const mutationRequestIdRef = useRef(0);
  const submissionAttemptRef = useRef<SubmissionAttempt | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isCurrent = true;
    void fetch('/api/institution/wecom/customer-mapping-candidates', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!isCurrent) return;
        if (response.status === 401 || response.status === 403) {
          setState({ kind: 'forbidden' });
          return;
        }
        const result = await readWeComCustomerMappingCandidatesResponse(response);
        if (!isCurrent) return;
        setState(result.ok ? { kind: 'loaded', data: result.data } : { kind: 'failed' });
      })
      .catch((error: unknown) => {
        if (!isCurrent || (error instanceof DOMException && error.name === 'AbortError')) return;
        setState({ kind: 'failed' });
      });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [reloadVersion, requestScopeKey]);

  useEffect(() => () => {
    mutationRequestIdRef.current += 1;
    mutationControllerRef.current?.abort();
  }, []);

  const data = state.kind === 'loaded' ? state.data : null;
  const availableActions = getAvailableWeComCustomerMappingReviewActions(
    data?.mappingReviewStatus ?? null,
  );
  const reviewEnabled = canReview
    && !reviewAccessRevoked
    && Boolean(data?.mappingId)
    && data?.mappingVersion !== null
    && !data?.failClosedReason;

  function openReview(action: WeComCustomerMappingReviewAction) {
    if (!reviewEnabled || submitting) return;
    const reasonCode = weComCustomerMappingReviewReasonOptions[action][0].value;
    submissionAttemptRef.current = null;
    setNotice(null);
    setReviewDraft({ action, reasonCode, note: '' });
  }

  function updateReason(reasonCode: WeComCustomerMappingReviewReasonCode) {
    submissionAttemptRef.current = null;
    setReviewDraft((current) => current ? { ...current, reasonCode } : current);
  }

  function updateNote(note: string) {
    submissionAttemptRef.current = null;
    setReviewDraft((current) => current ? { ...current, note } : current);
  }

  function closeReview() {
    if (submitting) return;
    submissionAttemptRef.current = null;
    setReviewDraft(null);
    setNotice(null);
  }

  async function submitReview() {
    if (
      !data
      || !reviewDraft
      || !reviewEnabled
      || submitting
      || data.mappingId === null
      || data.mappingVersion === null
    ) return;

    const normalizedNote = reviewDraft.note.trim();
    const note = normalizedNote.length > 0 ? normalizedNote : undefined;
    if (isWeComCustomerMappingReviewNoteRequired(reviewDraft.action, reviewDraft.reasonCode) && !note) {
      setNotice({ tone: 'warning', message: '请补充本次复核所依据的低敏说明。' });
      return;
    }

    const fingerprint = submissionFingerprint(data, reviewDraft, note);
    const existingAttempt = submissionAttemptRef.current;
    const idempotencyKey = existingAttempt?.fingerprint === fingerprint
      ? existingAttempt.idempotencyKey
      : createWeComCustomerMappingReviewIdempotencyKey();
    submissionAttemptRef.current = { fingerprint, idempotencyKey };

    mutationControllerRef.current?.abort();
    const controller = new AbortController();
    const requestId = mutationRequestIdRef.current + 1;
    mutationRequestIdRef.current = requestId;
    mutationControllerRef.current = controller;
    setSubmitting(true);
    setNotice(null);

    const result = await submitWeComCustomerMappingReviewAction({
      mappingId: data.mappingId,
      action: reviewDraft.action,
      expectedVersion: data.mappingVersion,
      idempotencyKey,
      reasonCode: reviewDraft.reasonCode,
      ...(note === undefined ? {} : { note }),
    }, { signal: controller.signal });

    if (mutationRequestIdRef.current !== requestId) return;
    if (!result.ok && result.error.kind === 'aborted') {
      setSubmitting(false);
      return;
    }

    if (result.ok) {
      submissionAttemptRef.current = null;
      setReviewDraft(null);
      setNotice({
        tone: 'success',
        message: result.data.idempotentReplay
          ? '该复核操作已处理，页面状态已同步。'
          : '复核结果已保存，页面状态已更新。',
      });
      setState({ kind: 'loading' });
      setReloadVersion((version) => version + 1);
    } else {
      switch (result.error.kind) {
        case 'unauthenticated':
          submissionAttemptRef.current = null;
          setReviewDraft(null);
          setReviewAccessRevoked(true);
          setNotice({ tone: 'danger', message: '登录状态已失效，请重新登录。' });
          break;
        case 'forbidden':
          submissionAttemptRef.current = null;
          setReviewDraft(null);
          setReviewAccessRevoked(true);
          setNotice({ tone: 'danger', message: '当前账号没有人工复核权限。' });
          break;
        case 'refresh_required':
          submissionAttemptRef.current = null;
          setReviewDraft(null);
          setNotice({ tone: 'warning', message: '候选状态已更新，正在刷新当前结果。' });
          setState({ kind: 'loading' });
          setReloadVersion((version) => version + 1);
          break;
        case 'invalid_response':
          setReviewDraft(null);
          setNotice({ tone: 'warning', message: '操作结果正在确认，已刷新当前候选状态。' });
          setState({ kind: 'loading' });
          setReloadVersion((version) => version + 1);
          break;
        case 'in_progress':
          setNotice({ tone: 'warning', message: '操作正在处理中，请稍后使用原操作重试。' });
          break;
        case 'attempt_conflict':
          submissionAttemptRef.current = null;
          setNotice({ tone: 'warning', message: '提交内容已经变化，请重新确认后提交。' });
          break;
        case 'origin_invalid':
          setNotice({ tone: 'danger', message: '当前页面来源校验失败，请刷新页面后重试。' });
          break;
        case 'invalid_note':
          submissionAttemptRef.current = null;
          setNotice({ tone: 'warning', message: '备注含不支持的信息，请仅填写低敏核验依据。' });
          break;
        case 'invalid_request':
          submissionAttemptRef.current = null;
          setNotice({ tone: 'warning', message: '提交内容不完整，请检查后重试。' });
          break;
        case 'unavailable':
          setNotice({ tone: 'danger', message: '复核服务暂时不可用，可以稍后重试。' });
          break;
        case 'network':
          setNotice({ tone: 'danger', message: '网络连接异常，可以使用原操作重试。' });
          break;
        case 'aborted':
          break;
      }
    }
    setSubmitting(false);
  }

  return (
    <section
      aria-label="企业微信客户匹配复核工作台"
      className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
    >
      <header className="border-b border-slate-200 bg-gradient-to-r from-cyan-50 via-white to-blue-50 px-5 py-5 lg:px-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-600 text-white shadow-sm shadow-cyan-200">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-950">企业微信客户匹配复核</h2>
              <p className="mt-1 text-sm text-slate-600">对照低敏候选信息，完成人工判断与状态流转</p>
            </div>
          </div>
          <span className="w-fit rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-bold text-cyan-800 shadow-sm">
            MOCK / DEMO · 人工复核
          </span>
        </div>
        <div className="mt-4 flex items-start gap-2 text-xs font-semibold leading-5 text-slate-600">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          候选资料保持只读；复核结论仅保存在当前演示进程，不会自动合并或写入真实客户关系。
        </div>
      </header>

      <div className="px-5 py-5 lg:px-7 lg:py-6">
        {state.kind === 'loading' ? (
          <div className="flex items-center gap-2 py-8 text-sm font-semibold text-slate-600">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            正在加载匹配候选
          </div>
        ) : null}
        {state.kind === 'forbidden' ? (
          <div className="border-l-4 border-rose-400 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            当前账号没有查看机构客户匹配候选的权限。
          </div>
        ) : null}
        {state.kind === 'failed' ? (
          <div className="border-l-4 border-rose-400 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            候选视图暂时不可用，已保持 fail-closed（失败关闭）。
          </div>
        ) : null}

        {data ? (
          <>
            <div
              data-testid="mapping-status-strip"
              className="flex flex-wrap items-center gap-x-1 gap-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2"
            >
              <StatusItem label="候选状态" value={mappingStatusLabels[data.mappingStatus]} />
              <StatusItem
                label="置信度"
                value={data.confidenceLevel ? confidenceLabels[data.confidenceLevel] : '不可用'}
              />
              <StatusItem
                label="冲突"
                value={data.conflictSummary.status === 'none'
                  ? '无'
                  : `未解决 ${data.conflictSummary.unresolvedCount} 项`}
              />
              <StatusItem
                label="复核状态"
                value={data.mappingReviewStatus
                  ? reviewStateLabels[data.mappingReviewStatus]
                  : manualReviewLabels[data.manualReviewStatus]}
              />
              <StatusItem
                label="版本"
                value={data.mappingVersion === null ? '—' : `v${data.mappingVersion}`}
              />
            </div>

            {data.failClosedReason ? (
              <div className="mt-4 flex gap-3 border-l-4 border-rose-400 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="font-semibold">fail-closed：候选已隐藏</div>
                  <div className="mt-1 text-xs">原因：{failClosedReasonLabels[data.failClosedReason]}</div>
                </div>
              </div>
            ) : null}

            {!data.failClosedReason ? (
              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)] lg:items-start">
                <div className="space-y-3">
                  {data.candidates.map((candidate, index) => (
                    <article
                      key={`${candidate.systemCustomerSummary.mockCustomerNumber}-${index}`}
                      data-testid="mapping-comparison"
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                    >
                      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold">
                        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-700">
                          {mappingStatusLabels[candidate.mappingStatus]}
                        </span>
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">
                          {confidenceLabels[candidate.confidenceLevel]}
                        </span>
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">
                          冲突：{candidate.conflictSummary.status === 'none'
                            ? '无'
                            : `未解决 ${candidate.conflictSummary.unresolvedCount} 项`}
                        </span>
                      </div>
                      <div className="grid divide-y divide-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                        <section className="p-4 lg:p-5">
                          <div className="text-xs font-bold uppercase tracking-wide text-cyan-700">
                            外部联系人低敏摘要
                          </div>
                          <div className="mt-2 text-base font-semibold text-slate-950">
                            {candidate.externalContactSummary.displayName}
                          </div>
                          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm text-slate-600">
                            <dt className="text-slate-400">跟进人</dt>
                            <dd>{candidate.externalContactSummary.ownerSummary}</dd>
                            <dt className="text-slate-400">备注</dt>
                            <dd>备注：{candidate.externalContactSummary.remarkSummary}</dd>
                            <dt className="text-slate-400">标签</dt>
                            <dd>{candidate.externalContactSummary.tagNames.join('、') || '无'}</dd>
                            <dt className="text-slate-400">添加日期</dt>
                            <dd>{candidate.externalContactSummary.addedAtDate}</dd>
                          </dl>
                        </section>
                        <section className="p-4 lg:p-5">
                          <div className="text-xs font-bold uppercase tracking-wide text-blue-700">
                            系统客户候选低敏摘要
                          </div>
                          <div className="mt-2 text-base font-semibold text-slate-950">
                            {candidate.systemCustomerSummary.displayNameSummary}
                          </div>
                          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm text-slate-600">
                            <dt className="text-slate-400">演示编号</dt>
                            <dd>{candidate.systemCustomerSummary.mockCustomerNumber}</dd>
                            <dt className="text-slate-400">负责人</dt>
                            <dd>{candidate.systemCustomerSummary.ownerSummary}</dd>
                            <dt className="text-slate-400">标签</dt>
                            <dd>{candidate.systemCustomerSummary.tagNames.join('、') || '无'}</dd>
                            <dt className="text-slate-400">档案状态</dt>
                            <dd>{systemCustomerStatusLabels[candidate.systemCustomerSummary.statusSummary]}</dd>
                          </dl>
                        </section>
                      </div>
                    </article>
                  ))}
                  {data.candidates.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                      当前没有可展示的候选。
                    </div>
                  ) : null}
                </div>

                <aside
                  aria-label="人工复核操作区"
                  className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white shadow-sm lg:sticky lg:top-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">复核操作</div>
                      <h3 className="mt-1 text-base font-semibold">人工复核操作</h3>
                    </div>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200">
                      {data.mappingVersion === null ? '无版本' : `v${data.mappingVersion}`}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {data.mappingReviewStatus
                      ? reviewStateLabels[data.mappingReviewStatus]
                      : '当前复核状态不可用'}
                  </p>

                  {notice ? (
                    <div
                      role="status"
                      className={`mt-4 rounded-xl px-3 py-2 text-xs font-semibold leading-5 ${
                        notice.tone === 'success'
                          ? 'bg-emerald-400/15 text-emerald-200'
                          : notice.tone === 'warning'
                            ? 'bg-amber-300/15 text-amber-100'
                            : 'bg-rose-400/15 text-rose-200'
                      }`}
                    >
                      {notice.message}
                    </div>
                  ) : null}

                  {!reviewEnabled ? (
                    <div className="mt-4 rounded-xl bg-white/8 px-3 py-3 text-sm leading-6 text-slate-300">
                      {reviewAccessRevoked || !canReview
                        ? '当前账号仅可查看候选，不能执行人工复核。'
                        : '当前候选暂无可执行的复核动作。'}
                    </div>
                  ) : null}

                  {reviewEnabled && !reviewDraft ? (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {availableActions.map((action) => {
                        const Icon = actionIcons[action];
                        return (
                          <button
                            key={action}
                            type="button"
                            disabled={submitting}
                            onClick={() => openReview(action)}
                            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${actionButtonClasses[action]}`}
                          >
                            <Icon className="h-4 w-4" />
                            {weComCustomerMappingReviewActionLabels[action]}
                          </button>
                        );
                      })}
                      {availableActions.length === 0 ? (
                        <div className="col-span-2 rounded-xl bg-white/8 px-3 py-3 text-sm text-slate-300">
                          当前状态没有可执行动作。
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {reviewEnabled && reviewDraft ? (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <div className="text-sm font-semibold">
                        {weComCustomerMappingReviewActionLabels[reviewDraft.action]}
                      </div>
                      <label className="mt-3 block text-xs font-semibold text-slate-300" htmlFor="mapping-review-reason">
                        复核原因
                      </label>
                      <select
                        id="mapping-review-reason"
                        value={reviewDraft.reasonCode}
                        disabled={submitting}
                        onChange={(event) => updateReason(event.target.value as WeComCustomerMappingReviewReasonCode)}
                        className="mt-1 w-full rounded-xl border border-white/15 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                      >
                        {weComCustomerMappingReviewReasonOptions[reviewDraft.action].map((reason) => (
                          <option key={reason.value} value={reason.value}>{reason.label}</option>
                        ))}
                      </select>
                      <label className="mt-3 block text-xs font-semibold text-slate-300" htmlFor="mapping-review-note">
                        低敏说明
                        {isWeComCustomerMappingReviewNoteRequired(
                          reviewDraft.action,
                          reviewDraft.reasonCode,
                        ) ? '（必填）' : '（选填）'}
                      </label>
                      <textarea
                        id="mapping-review-note"
                        value={reviewDraft.note}
                        maxLength={512}
                        rows={3}
                        disabled={submitting}
                        placeholder="只填写人工核验依据，不填写手机号、证件号或会话内容"
                        onChange={(event) => updateNote(event.target.value)}
                        className="mt-1 w-full resize-none rounded-xl border border-white/15 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                      />
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={closeReview}
                          className="rounded-xl border border-white/15 px-3 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => void submitReview()}
                          className="flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-3 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                          {submitting ? '提交中' : '确认执行'}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <p className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-5 text-slate-400">
                    本操作只更新演示复核状态，不执行真实关联、自动合并或客户触达。
                  </p>
                </aside>
              </div>
            ) : null}

            <details className="mt-5 border-t border-slate-200 pt-4 text-xs text-slate-600">
              <summary className="w-fit cursor-pointer select-none font-semibold text-slate-700 hover:text-slate-950">
                查看审计与运行说明
              </summary>
              <div className="mt-3 leading-6">
                审计摘要：{auditStatusLabels[data.auditSummary.status]} · {auditReasonLabels[data.auditSummary.reasonCode]}；
                自动合并：否；真实客户关系写入：否；运行模式：{data.dataMode.toUpperCase()}。
              </div>
            </details>
          </>
        ) : null}
      </div>
    </section>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 text-xs">
      <span className="font-semibold text-slate-400">{label}</span>
      <span className="font-bold text-slate-800">{value}</span>
    </div>
  );
}
