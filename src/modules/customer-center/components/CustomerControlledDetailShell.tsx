
'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { CustomerControlledDtoV1 } from '@/modules/customers/application/customer-controlled-view';

export function CustomerControlledDetailShell({
  record,
}: Readonly<{
  record: CustomerControlledDtoV1;
}>) {
  const [displayName, setDisplayName] = useState(record.displayName);
  const [lifecycle, setLifecycle] = useState(record.lifecycle);
  const [priority, setPriority] = useState(record.priority);
  const [ownerUserId, setOwnerUserId] = useState(record.ownerUserId);
  const [projectInterest, setProjectInterest] = useState(record.projectInterest);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);

    try {
      const changes: Record<string, unknown> = {
        displayName,
        lifecycle,
        priority,
        projectInterest,
      };

      if (record.permissions.canReassignOwner) {
        changes.ownerUserId = ownerUserId;
      }

      const response = await fetch(
        `/api/v1/institution/customers/${encodeURIComponent(record.customerId)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedUpdatedAt: record.updatedAt,
            changes,
          }),
        },
      );

      if (!response.ok) {
        setError('客户更新失败，请刷新后重试');
        return;
      }

      window.location.reload();
    } catch {
      setError('客户更新失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5" aria-labelledby="customer-detail-title">
      <header className="rounded-[28px] border border-white/80 bg-white/95 px-6 py-6 shadow-xl shadow-slate-200/50">
        <p className="text-xs font-semibold tracking-[0.16em] text-cyan-700">
          CONTROLLED WRITE
        </p>
        <h1 id="customer-detail-title" className="mt-2 text-2xl font-bold text-slate-950">
          客户详情
        </h1>
        <p className="mt-2 text-sm text-slate-600">客户 ID：{record.customerId}</p>
        <time className="mt-1 block text-xs text-slate-500" dateTime={record.updatedAt}>
          更新于 {record.updatedAt}
        </time>
      </header>

      <div className="rounded-[24px] border border-cyan-100 bg-white/95 p-5">
        <h2 className="font-semibold text-slate-950">受控客户资料</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm text-slate-700">
            客户展示名
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={120}
              className="rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-700">
            负责人账号 ID
            <input
              value={ownerUserId}
              disabled={!record.permissions.canReassignOwner}
              onChange={(event) => setOwnerUserId(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 disabled:bg-slate-50"
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-700">
            生命周期
            <select
              value={lifecycle}
              onChange={(event) => setLifecycle(event.target.value as typeof lifecycle)}
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
              onChange={(event) => setPriority(event.target.value as typeof priority)}
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
        </div>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !record.permissions.canUpdate}
            onClick={() => void save()}
            className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? '保存中…' : '保存修改'}
          </button>
          <Link
            href="/hospital/customers"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            返回客户列表
          </Link>
        </div>
      </div>
    </section>
  );
}
