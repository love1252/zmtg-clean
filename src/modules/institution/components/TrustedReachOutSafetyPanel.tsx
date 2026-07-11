'use client';

import { useEffect, useState } from 'react';
import {
  getTrustedReachOutSafety,
  updateTrustedReachOutConsent,
  type TrustedReachOutSafetyReadResponse,
} from '@/modules/institution/client/trusted-reachout-safety-client';
import type {
  WeComReachOutConsentAction,
  WeComReachOutConsentSourceType,
} from '@/modules/institution/domain/trusted-reachout-safety';

const statusLabels = {
  unknown: '未记录',
  consented: '已明确同意',
  opted_out: '已退订',
  consent_revoked: '已撤回',
} as const;

const sourceLabels = {
  customer_explicit_verbal: '客户明确口头同意',
  customer_explicit_written: '客户明确书面同意',
  customer_opt_out_request: '客户退订请求',
  customer_consent_revocation: '客户撤回同意',
} as const;

type State =
  | { kind: 'loading' }
  | { kind: 'loaded'; data: TrustedReachOutSafetyReadResponse }
  | { kind: 'failed' };

export function TrustedReachOutSafetyPanel({ customerId }: { customerId: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [pending, setPending] = useState<WeComReachOutConsentAction | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void getTrustedReachOutSafety(customerId, (input, init) => fetch(input, { ...init, signal: controller.signal }))
      .then((result) => setState(result.ok ? { kind: 'loaded', data: result.data } : { kind: 'failed' }))
      .catch(() => setState({ kind: 'failed' }));
    return () => controller.abort();
  }, [customerId]);

  async function submit(action: WeComReachOutConsentAction, sourceType: WeComReachOutConsentSourceType) {
    if (state.kind !== 'loaded' || !state.data.canWrite || pending) return;
    setPending(action);
    setNotice('');
    const result = await updateTrustedReachOutConsent({ customerId, action, sourceType });
    if (!result.ok) {
      if (result.error.status === 401 || result.error.status === 403) {
        setState({ kind: 'loaded', data: { ...state.data, canWrite: false } });
        setNotice('没有写入权限，当前保持只读。');
      } else {
        setNotice(result.error.message);
      }
      setPending(null);
      return;
    }
    setState({ kind: 'loaded', data: { ...state.data, safety: { ...state.data.safety, consent: result.data } } });
    setNotice('触达许可状态已记录。');
    setPending(null);
  }

  if (state.kind === 'loading') return <div className="text-xs text-slate-500">正在加载企业微信触达许可</div>;
  if (state.kind === 'failed') return <div className="text-xs font-semibold text-rose-700">触达许可加载失败，所有动作已禁用。</div>;

  const { consent, frequency } = state.data.safety;
  const disabled = !state.data.canWrite || Boolean(pending);
  return (
    <section aria-label="企业微信触达许可" className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-xs">
      <h4 className="text-sm font-semibold text-slate-950">企业微信触达许可</h4>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-slate-700">
        <dt>当前许可</dt><dd className="font-semibold">{statusLabels[consent.status]}</dd>
        <dt>来源类型</dt><dd>{consent.sourceType ? sourceLabels[consent.sourceType] : '无'}</dd>
        <dt>记录时间</dt><dd>{consent.recordedAt ? new Date(consent.recordedAt).toLocaleString('zh-CN') : '无'}</dd>
        <dt>频控窗口</dt><dd>{frequency.windowEndsAt ? `截至 ${new Date(frequency.windowEndsAt).toLocaleString('zh-CN')}` : '尚未开始'}</dd>
        <dt>准备 / 完成</dt><dd>{frequency.preparedCount} / {frequency.completedCount}（上限均为 1）</dd>
        <dt>下一允许时间</dt><dd>{frequency.nextAllowedAt ? new Date(frequency.nextAllowedAt).toLocaleString('zh-CN') : '当前未因频控阻断'}</dd>
      </dl>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button type="button" disabled={disabled} onClick={() => void submit('record_consent', 'customer_explicit_written')} className="rounded-lg bg-emerald-600 px-2 py-2 font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400">记录明确同意</button>
        <button type="button" disabled={disabled} onClick={() => void submit('record_opt_out', 'customer_opt_out_request')} className="rounded-lg bg-amber-100 px-2 py-2 font-semibold text-amber-900 disabled:bg-slate-200 disabled:text-slate-400">记录退订</button>
        <button type="button" disabled={disabled} onClick={() => void submit('revoke_consent', 'customer_consent_revocation')} className="rounded-lg bg-rose-100 px-2 py-2 font-semibold text-rose-800 disabled:bg-slate-200 disabled:text-slate-400">记录撤回</button>
      </div>
      {!state.data.canWrite ? <p className="mt-2 font-semibold text-slate-600">当前角色仅可只读查看。</p> : null}
      {notice ? <p role="status" className="mt-2 font-semibold text-blue-800">{notice}</p> : null}
      <p className="mt-2 text-slate-600">频控仅由系统事务维护，无人工修改、清零或绕过入口。</p>
    </section>
  );
}
