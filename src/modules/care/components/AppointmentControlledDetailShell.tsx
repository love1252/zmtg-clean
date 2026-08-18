
'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { AppointmentControlledDtoV1 } from '@/modules/care/application/appointment-controlled-view';

const labels = Object.freeze({
  pending_confirmation: '待确认',
  confirmed: '已确认',
  arrived: '已到店',
  completed: '已完成',
  reschedule_requested: '申请改期',
  cancelled: '已取消',
} as const);

export function AppointmentControlledDetailShell({
  record,
}: Readonly<{
  record: AppointmentControlledDtoV1;
}>) {
  const [rescheduleAt, setRescheduleAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mutate(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/institution/appointments/${encodeURIComponent(record.appointmentId)}`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        setError('预约更新失败，请刷新后重试');
        return;
      }
      window.location.reload();
    } catch {
      setError('预约更新失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  }

  const transitionTarget =
    record.status === 'pending_confirmation'
      ? 'confirmed'
      : record.status === 'confirmed'
        ? 'arrived'
        : record.status === 'arrived'
          ? 'completed'
          : null;

  const transitionLabel =
    transitionTarget === 'confirmed'
      ? '确认预约'
      : transitionTarget === 'arrived'
        ? '标记到店'
        : transitionTarget === 'completed'
          ? '标记完成'
          : null;

  return (
    <section
      className="space-y-5"
      aria-labelledby="appointment-detail-title"
    >
      <header className="rounded-[28px] border border-white/80 bg-white/95 px-6 py-6 shadow-xl shadow-slate-200/50">
        <p className="text-xs font-semibold tracking-[0.16em] text-cyan-700">
          CONTROLLED WRITE
        </p>
        <h1
          id="appointment-detail-title"
          className="mt-2 text-2xl font-bold text-slate-950"
        >
          预约详情
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          状态：{labels[record.status]}
        </p>
        <time
          className="mt-1 block text-sm text-slate-600"
          dateTime={record.scheduledAt}
        >
          预约时间 {record.scheduledAt}
        </time>
        <time
          className="mt-1 block text-xs text-slate-500"
          dateTime={record.updatedAt}
        >
          更新于 {record.updatedAt}
        </time>
      </header>

      {record.permissions.canOperate ? (
        <div className="rounded-[24px] border border-cyan-100 bg-white/95 p-5">
          <h2 className="font-semibold text-slate-950">
            受控操作
          </h2>

          <div className="mt-4 flex flex-wrap gap-2">
            {transitionTarget && transitionLabel ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void mutate({
                    command: 'transition',
                    expectedUpdatedAt: record.updatedAt,
                    targetStatus: transitionTarget,
                  })
                }
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {transitionLabel}
              </button>
            ) : null}

            {record.status === 'confirmed' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void mutate({
                    command: 'transition',
                    expectedUpdatedAt: record.updatedAt,
                    targetStatus: 'reschedule_requested',
                  })
                }
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                标记需要改期
              </button>
            ) : null}

            {record.permissions.canCancel ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void mutate({
                    command: 'cancel',
                    expectedUpdatedAt: record.updatedAt,
                  })
                }
                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
              >
                取消预约
              </button>
            ) : null}
          </div>

          {record.permissions.canReschedule ? (
            <form
              className="mt-4 flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const parsed = new Date(rescheduleAt);
                if (Number.isNaN(parsed.getTime())) {
                  setError('新预约时间无效');
                  return;
                }
                void mutate({
                  command: 'reschedule',
                  expectedUpdatedAt: record.updatedAt,
                  scheduledAt: parsed.toISOString(),
                });
              }}
            >
              <label className="grid gap-1 text-sm text-slate-700">
                新预约时间
                <input
                  type="datetime-local"
                  value={rescheduleAt}
                  onChange={(event) =>
                    setRescheduleAt(event.target.value)
                  }
                  required
                  className="rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                确认改期
              </button>
            </form>
          ) : null}

          {error ? (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-[24px] border border-slate-200 bg-white/90 p-5 text-sm text-slate-600">
          当前账号仅可查看该预约，未开放状态修改。
        </div>
      )}

      <Link
        href="/hospital/care/appointments"
        className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
      >
        返回预约列表
      </Link>
    </section>
  );
}
