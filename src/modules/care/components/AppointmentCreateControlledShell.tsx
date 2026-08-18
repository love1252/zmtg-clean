
'use client';

import Link from 'next/link';
import { useState } from 'react';

export function AppointmentCreateControlledShell({
  canCreate,
  open,
}: Readonly<{
  canCreate: boolean;
  open: boolean;
}>) {
  const [customerId, setCustomerId] = useState('');
  const [project, setProject] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [consultantUserId, setConsultantUserId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canCreate) return null;

  if (!open) {
    return (
      <div className="flex justify-end">
        <Link
          href="/hospital/care/appointments?create=1"
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          新建预约
        </Link>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="appointment-create-title"
      className="rounded-[24px] border border-cyan-100 bg-white/95 p-5 shadow-sm"
    >
      <h2
        id="appointment-create-title"
        className="text-lg font-bold text-slate-950"
      >
        新建预约
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        仅创建当前机构预约；客户与顾问归属由服务端重新校验。
      </p>

      <form
        className="mt-4 grid gap-3 md:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const parsed = new Date(scheduledAt);
            if (Number.isNaN(parsed.getTime())) {
              setError('预约时间无效');
              return;
            }

            const response = await fetch(
              '/api/v1/institution/appointments',
              {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                },
                body: JSON.stringify({
                  customerId,
                  project,
                  scheduledAt: parsed.toISOString(),
                  consultantUserId,
                  note,
                }),
              },
            );

            if (!response.ok) {
              setError('预约创建失败，请检查输入或稍后重试');
              return;
            }

            window.location.assign(
              '/hospital/care/appointments',
            );
          } catch {
            setError('预约创建失败，请稍后重试');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="grid gap-1 text-sm text-slate-700">
          客户 ID
          <input
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            required
            className="rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-700">
          顾问账号 ID
          <input
            value={consultantUserId}
            onChange={(event) => setConsultantUserId(event.target.value)}
            required
            className="rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-700">
          项目
          <input
            value={project}
            onChange={(event) => setProject(event.target.value)}
            required
            maxLength={120}
            className="rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-700">
          预约时间
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
            required
            className="rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-700 md:col-span-2">
          内部备注（可空）
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={240}
            className="min-h-20 rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
        {error ? (
          <p
            role="alert"
            className="text-sm text-red-700 md:col-span-2"
          >
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
            href="/hospital/care/appointments"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            取消
          </Link>
        </div>
      </form>
    </section>
  );
}
