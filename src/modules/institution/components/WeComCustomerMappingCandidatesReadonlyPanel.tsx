'use client';

import { useEffect, useState } from 'react';
import { Link2, LoaderCircle, ShieldAlert } from 'lucide-react';
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

const manualReviewLabels = {
  not_required: '当前无需人工复核',
  pending: '等待人工复核',
  required: '需要人工复核',
  unavailable: '复核状态不可用',
} as const;

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

type PanelState =
  | { kind: 'loading' }
  | { kind: 'loaded'; data: WeComCustomerMappingCandidatesResponse }
  | { kind: 'forbidden' }
  | { kind: 'failed' };

export function WeComCustomerMappingCandidatesReadonlyPanel({
  requestScopeKey = 'current-session',
}: {
  requestScopeKey?: string;
}) {
  const [state, setState] = useState<PanelState>({ kind: 'loading' });

  useEffect(() => {
    setState({ kind: 'loading' });
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
  }, [requestScopeKey]);

  const data = state.kind === 'loaded' ? state.data : null;

  return (
    <section
      aria-label="企业微信客户匹配候选只读视图"
      className="space-y-5 rounded-[28px] border border-cyan-200 bg-white/90 p-5 shadow-sm lg:p-7"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-600 text-white">
            <Link2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-950">企业微信客户匹配候选</h2>
            <p className="mt-1 text-sm text-slate-600">外部联系人与系统客户的低敏候选摘要</p>
          </div>
        </div>
        <span className="w-fit rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-800">
          MOCK / DEMO · 只读
        </span>
      </header>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
        当前不会自动合并客户、不会写真实客户关系。
      </div>

      {state.kind === 'loading' ? (
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          正在加载只读候选
        </div>
      ) : null}
      {state.kind === 'forbidden' ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          当前账号没有查看机构客户匹配候选的权限。
        </div>
      ) : null}
      {state.kind === 'failed' ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          候选视图暂时不可用，已保持 fail-closed（失败关闭）。
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="数据模式" value={data.dataMode.toUpperCase()} />
            <SummaryCard label="候选状态" value={mappingStatusLabels[data.mappingStatus]} />
            <SummaryCard
              label="置信度提示"
              value={data.confidenceLevel ? confidenceLabels[data.confidenceLevel] : '不可用'}
            />
            <SummaryCard label="人工复核状态" value={manualReviewLabels[data.manualReviewStatus]} />
          </div>

          {data.failClosedReason ? (
            <div className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="font-semibold">fail-closed：候选已隐藏</div>
                <div className="mt-1 text-xs">原因：{failClosedReasonLabels[data.failClosedReason]}</div>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {data.candidates.map((candidate, index) => (
              <article
                key={`${candidate.systemCustomerSummary.mockCustomerNumber}-${index}`}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-cyan-100 bg-white p-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-cyan-700">外部联系人低敏摘要</div>
                    <div className="mt-2 font-semibold text-slate-950">{candidate.externalContactSummary.displayName}</div>
                    <div className="mt-2 space-y-1 text-sm text-slate-600">
                      <div>跟进人：{candidate.externalContactSummary.ownerSummary}</div>
                      <div>备注：{candidate.externalContactSummary.remarkSummary}</div>
                      <div>标签：{candidate.externalContactSummary.tagNames.join('、') || '无'}</div>
                      <div>添加日期：{candidate.externalContactSummary.addedAtDate}</div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-white p-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-blue-700">系统客户候选低敏摘要</div>
                    <div className="mt-2 font-semibold text-slate-950">{candidate.systemCustomerSummary.displayNameSummary}</div>
                    <div className="mt-2 space-y-1 text-sm text-slate-600">
                      <div>演示客户编号：{candidate.systemCustomerSummary.mockCustomerNumber}</div>
                      <div>负责人：{candidate.systemCustomerSummary.ownerSummary}</div>
                      <div>标签：{candidate.systemCustomerSummary.tagNames.join('、') || '无'}</div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">
                    {mappingStatusLabels[candidate.mappingStatus]}
                  </span>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                    {confidenceLabels[candidate.confidenceLevel]}
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                    冲突：{candidate.conflictSummary.status === 'none' ? '无' : `未解决 ${candidate.conflictSummary.unresolvedCount} 项`}
                  </span>
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700">
                    {manualReviewLabels[candidate.manualReviewStatus]}
                  </span>
                </div>
              </article>
            ))}
            {data.candidates.length === 0 && !data.failClosedReason ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                当前没有可展示的候选。
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            审计摘要：{auditStatusLabels[data.auditSummary.status]} · {auditReasonLabels[data.auditSummary.reasonCode]}；自动合并：否；真实客户关系写入：否。
          </div>
        </>
      ) : null}
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}
