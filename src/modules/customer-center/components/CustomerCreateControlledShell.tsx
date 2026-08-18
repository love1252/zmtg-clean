
'use client';

import Link from 'next/link';
import { useState } from 'react';

export function CustomerCreateControlledShell({
  canCreate,
  open,
}: Readonly<{
  canCreate: boolean;
  open: boolean;
}>) {
  const [displayName, setDisplayName] = useState('');
  const [lifecycle, setLifecycle] = useState('consulting');
  const [priority, setPriority] = useState('medium');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [projectInterest, setProjectInterest] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canCreate) return null;

  if (!open) {
    return (
      <div className="flex justify-end">
        <Link
          href="/hospital/customers?create=1"
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          新建客户
        </Link>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="customer-create-title"
      className="rounded-[24px] border border-cyan-100 bg-white/95 p-5 shadow-sm"
    >
      <h2 id="customer-create-title" className="text-lg font-bold text-slate-950">
        新建客户
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        仅创建当前机构低敏客户资料；负责人归属与客户配额由服务端重新校验。
      </p>

      <form
        className="mt-4 grid gap-3 md:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);

          try {
            const response = await fetch('/api/v1/institution/customers', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                displayName,
                lifecycle,
                priority,
                ownerUserId,
                projectInterest,
              }),
            });

            if (!response.ok) {
              setError('客户创建失败，请检查配额、负责人和输入后重试');
              return;
            }

            window.location.assign('/hospital/customers');
          } catch {
            setError('客户创建失败，请稍后重试');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="grid gap-1 text-sm text-slate-700">
          客户展示名
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            maxLength={120}
            className="rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="grid gap-1 text-sm text-slate-700">
          负责人账号 ID
          <input
            value={ownerUserId}
            onChange={(event) => setOwnerUserId(event.target.value)}
            required
            className="rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="grid gap-1 text-sm text-slate-700">
          生命周期
          <select
            value={lifecycle}
            onChange={(event) => setLifecycle(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2"
          >
            <option value="consulting">咨询中</option>
            <option value="scheduled">已预约</option>
            <option value="post_care">术后关怀</option>
            <option value="repurchase_window">复购窗口</option>
            <option value="silent_reactivation">沉默唤醒</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm text-slate-700">
          优先级
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2"
          >
            <option value="high">高优先级</option>
            <option value="medium">中优先级</option>
            <option value="observe">持续观察</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm text-slate-700 md:col-span-2">
          项目意向
          <input
            value={projectInterest}
            onChange={(event) => setProjectInterest(event.target.value)}
            maxLength={120}
            className="rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>

        {error ? (
          <p role="alert" className="text-sm text-red-700 md:col-span-2">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2 md:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? '提交中…' : '确认创建'}
          </button>
          <Link
            href="/hospital/customers"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            取消
          </Link>
        </div>
      </form>
    </section>
  );
}
