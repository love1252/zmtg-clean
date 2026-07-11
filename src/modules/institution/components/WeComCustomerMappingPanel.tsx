'use client';

import { useEffect, useState } from 'react';
import { Link2, LoaderCircle } from 'lucide-react';
import type {
  WeComCustomerMappingAction,
  WeComCustomerMappingStatus,
} from '@/modules/institution/domain/wecom-customer-mapping';
import {
  getWeComCustomerMapping,
  updateWeComCustomerMapping,
  type WeComCustomerMappingCandidate,
  type WeComCustomerMappingReadResponse,
} from '@/modules/institution/client/wecom-customer-mapping-client';
import { TrustedReachOutSafetyPanel } from '@/modules/institution/components/TrustedReachOutSafetyPanel';

const statusLabels: Record<WeComCustomerMappingStatus, string> = {
  unreviewed: '待人工审核',
  confirmed: '已确认',
  rejected: '已拒绝',
  revoked: '已撤销',
};

type PanelState =
  | { kind: 'loading' }
  | { kind: 'loaded'; data: WeComCustomerMappingReadResponse }
  | { kind: 'forbidden' }
  | { kind: 'failed'; message: string };

function CustomerSummary({ customer }: { customer: WeComCustomerMappingCandidate }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
      <div className="font-semibold text-slate-900">{customer.displayName}</div>
      <div className="mt-1 text-slate-600">
        {customer.maskedPhone} · {customer.maskedMedicalRecordNo}
      </div>
      <div className="mt-1 text-slate-500">
        {customer.lifecycle} · {customer.priority} · {customer.customerId}
      </div>
    </div>
  );
}

export function WeComCustomerMappingPanel() {
  const [state, setState] = useState<PanelState>({ kind: 'loading' });
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [pendingAction, setPendingAction] = useState<WeComCustomerMappingAction | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    void getWeComCustomerMapping({
      fetcher: (input, init) => fetch(input, { ...init, signal: controller.signal }),
    })
      .then((result) => {
        if (!result.ok && (result.error.status === 401 || result.error.status === 403)) {
          setState({ kind: 'forbidden' });
          return;
        }
        if (!result.ok) throw new Error('load_failed');
        setState({ kind: 'loaded', data: result.data });
        setSelectedCustomerId(
          result.data.mapping.customerId ?? result.data.candidates[0]?.customerId ?? '',
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ kind: 'failed', message: '映射信息加载失败，请稍后重试。' });
      });

    return () => controller.abort();
  }, []);

  async function submit(action: WeComCustomerMappingAction) {
    if (state.kind !== 'loaded' || !state.data.canWrite || pendingAction) return;
    const customerId = action === 'revoke' ? state.data.mapping.customerId : selectedCustomerId;
    if (!customerId) {
      setNotice('请先选择本机构客户。');
      return;
    }

    setPendingAction(action);
    setNotice('');
    try {
      const result = await updateWeComCustomerMapping({ action, customerId });

      if (!result.ok && (result.error.status === 401 || result.error.status === 403)) {
        setNotice('没有写入权限，当前保持只读。');
        setState({
          kind: 'loaded',
          data: { ...state.data, canWrite: false },
        });
        return;
      }
      if (!result.ok && result.error.status === 409) {
        setNotice(
          result.error.code === 'conflict'
            ? '映射状态发生冲突，请刷新后重试。'
            : '当前状态不允许执行此操作。',
        );
        return;
      }
      if (!result.ok) {
        setNotice(result.error.message);
        return;
      }

      const currentCustomer =
        state.data.candidates.find(
          (candidate) => candidate.customerId === result.data.mapping.customerId,
        ) ??
        state.data.currentCustomer;
      setState({
        kind: 'loaded',
        data: {
          ...state.data,
          mapping: result.data.mapping,
          currentCustomer,
        },
      });
      setNotice(
        result.data.outcome === 'idempotent'
          ? '当前映射已是目标状态。'
          : '人工映射操作成功。',
      );
    } catch {
      setNotice('操作失败，请稍后重试。');
    } finally {
      setPendingAction(null);
    }
  }

  const loaded = state.kind === 'loaded' ? state.data : null;
  const disabled = !loaded?.canWrite || Boolean(pendingAction);

  return (
    <section
      aria-label="企业微信客户关联"
      className="rounded-2xl border border-cyan-200/80 bg-cyan-50/50 p-4"
    >
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-600 text-white">
          <Link2 className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-950">企业微信客户关联</h3>
          <p className="text-[11px] font-semibold text-cyan-800">匿名低敏联系人引用</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-cyan-100 bg-white/80 px-3 py-2 text-xs text-slate-700">
        <div>联系人：live-contact-proof-01</div>
        <div className="mt-1">员工：live-employee-proof-01</div>
        <div className="mt-1">来源：real_readonly_proof</div>
      </div>

      {state.kind === 'loading' ? (
        <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          正在加载映射信息
        </div>
      ) : null}
      {state.kind === 'forbidden' ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          无权限查看映射信息，所有操作已禁用。
        </div>
      ) : null}
      {state.kind === 'failed' ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
          {state.message}
        </div>
      ) : null}

      {loaded ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <span className="font-semibold text-slate-500">当前状态：</span>
            <span className="font-semibold text-slate-900">{statusLabels[loaded.mapping.status]}</span>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-slate-600">当前关联客户低敏摘要</div>
            {loaded.currentCustomer ? (
              <CustomerSummary customer={loaded.currentCustomer} />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs text-slate-500">
                当前没有可展示的关联客户。
              </div>
            )}
          </div>

          {loaded.mapping.status === 'confirmed' && loaded.currentCustomer ? (
            <TrustedReachOutSafetyPanel customerId={loaded.currentCustomer.customerId} />
          ) : null}

          <label className="block text-xs font-semibold text-slate-600" htmlFor="wecom-mapping-candidate">
            本机构客户候选（最多 20 条）
          </label>
          <select
            id="wecom-mapping-candidate"
            aria-label="本机构客户候选"
            value={selectedCustomerId}
            onChange={(event) => setSelectedCustomerId(event.target.value)}
            disabled={disabled || loaded.candidates.length === 0}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            {loaded.candidates.length === 0 ? <option value="">暂无本机构候选</option> : null}
            {loaded.candidates.slice(0, 20).map((candidate) => (
              <option key={candidate.customerId} value={candidate.customerId}>
                {candidate.displayName} · {candidate.maskedPhone} · {candidate.customerId}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => void submit('confirm')}
              disabled={disabled || !selectedCustomerId}
              className="rounded-xl bg-emerald-600 px-2 py-2 text-xs font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
            >
              {pendingAction === 'confirm' ? '确认中' : '确认关联'}
            </button>
            <button
              type="button"
              onClick={() => void submit('reject')}
              disabled={disabled || !selectedCustomerId}
              className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-2 text-xs font-semibold text-amber-800 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              {pendingAction === 'reject' ? '拒绝中' : '拒绝关联'}
            </button>
            <button
              type="button"
              onClick={() => void submit('revoke')}
              disabled={disabled || !loaded.mapping.customerId}
              className="rounded-xl border border-rose-200 bg-rose-50 px-2 py-2 text-xs font-semibold text-rose-700 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              {pendingAction === 'revoke' ? '撤销中' : '撤销关联'}
            </button>
          </div>

          {!loaded.canWrite ? (
            <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
              当前角色仅可只读查看，不能修改映射。
            </div>
          ) : null}
          {notice ? (
            <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
              {notice}
            </div>
          ) : null}
        </div>
      ) : null}

      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs font-semibold leading-5 text-cyan-900">
        <li>仅人工关联</li>
        <li>不自动匹配</li>
        <li>不自动创建或合并客户</li>
        <li>关联不代表允许触达</li>
        <li>当前不调用真实企业微信</li>
      </ul>
    </section>
  );
}
