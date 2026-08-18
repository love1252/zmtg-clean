import Link from 'next/link';

import {
  APPOINTMENT_LIST_MAX_PAGE_V1,
  type AppointmentListReaderResultV1,
} from '@/modules/care/application/appointment-list-reader';
import type { AppointmentListStatusV1 } from '@/modules/care/ports/appointment-list-source';

type AppointmentListReadyResultV1 = Extract<
  AppointmentListReaderResultV1,
  { kind: 'ready' }
>;

const statusLabels = Object.freeze({
  pending_confirmation: '待确认',
  confirmed: '已确认',
  arrived: '已到店',
  completed: '已完成',
  reschedule_requested: '申请改期',
  cancelled: '已取消',
} as const satisfies Readonly<Record<AppointmentListStatusV1, string>>);

function pageHref(page: number, status: AppointmentListStatusV1 | null) {
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set('status', status);
  return `/hospital/care/appointments?${params.toString()}`;
}

export function AppointmentListReadonlyShell({
  result,
  status,
  operational,
}: Readonly<{
  result: AppointmentListReadyResultV1;
  status: AppointmentListStatusV1 | null;
  operational: boolean;
}>) {
  return (
    <section className="space-y-5" aria-labelledby="appointment-list-title">
      <header className="rounded-[28px] border border-white/80 bg-white/90 px-6 py-6 shadow-xl shadow-slate-200/50">
        <p className="text-xs font-semibold tracking-[0.16em] text-cyan-700">
          {operational ? 'CONTROLLED WRITE' : 'READ ONLY'}
        </p>
        <h1 id="appointment-list-title" className="mt-2 text-2xl font-bold text-slate-950">
          预约管理
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {operational
            ? `当前共展示 ${result.records.length} 条低敏预约记录；具备权限的账号可进入详情执行受控操作。`
            : `当前共展示 ${result.records.length} 条低敏预约记录，仅供查看。`}
        </p>
      </header>

      {result.records.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center text-sm text-slate-600">
          当前页暂无预约记录
        </div>
      ) : (
        <ul
          className="grid gap-3"
          aria-label={operational ? '预约记录' : '预约只读记录'}
        >
          {result.records.map((record) => (
            <li
              key={record.appointmentId}
              className="rounded-[24px] border border-white/90 bg-white/90 px-5 py-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">
                    {statusLabels[record.status]}
                  </p>
                  <time className="mt-1 block text-sm text-slate-600" dateTime={record.scheduledAt}>
                    预约时间 {record.scheduledAt}
                  </time>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <time className="text-xs text-slate-500" dateTime={record.updatedAt}>
                    更新于 {record.updatedAt}
                  </time>
                  {operational ? (
                    <Link
                      href={`/hospital/care/appointments/${encodeURIComponent(
                        record.appointmentId,
                      )}`}
                      className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800"
                    >
                      查看 / 操作
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="预约列表分页" className="flex items-center justify-between gap-3">
        {result.pageInfo.page > 1 ? (
          <Link
            href={pageHref(result.pageInfo.page - 1, status)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            上一页
          </Link>
        ) : (
          <span />
        )}
        <span className="text-sm text-slate-500">第 {result.pageInfo.page} 页</span>
        {result.pageInfo.hasMore &&
        result.pageInfo.page < APPOINTMENT_LIST_MAX_PAGE_V1 ? (
          <Link
            href={pageHref(result.pageInfo.page + 1, status)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            下一页
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </section>
  );
}
