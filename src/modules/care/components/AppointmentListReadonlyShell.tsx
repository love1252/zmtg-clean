'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  APPOINTMENT_LIST_MAX_PAGE_V1,
  type AppointmentListReaderResultV1,
} from '@/modules/care/application/appointment-list-pagination-contract';
import {
  appointmentCalendarRange,
  appointmentShanghaiTime,
  isAppointmentDate,
  shiftAppointmentDate,
  type AppointmentCalendarResultV1,
} from '@/modules/care/application/appointment-calendar-contract';
import { APPOINTMENT_LIST_STATUSES_V1, type AppointmentListStatusV1 } from '@/modules/care/ports/appointment-list-source';
import { InstitutionV11PageHeader } from '@/modules/institution-v11/components/InstitutionV11Ui';

type ReadyList = Extract<AppointmentListReaderResultV1, { kind: 'ready' }>;
type CalendarView = Extract<AppointmentCalendarResultV1, { kind: 'ready' | 'too_many' }>;
const statusLabels: Readonly<Record<AppointmentListStatusV1, string>> = {
  pending_confirmation: '待确认', confirmed: '已确认', arrived: '已到店',
  completed: '已完成', reschedule_requested: '申请改期', cancelled: '已取消',
};
const fieldClass = 'h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm disabled:bg-slate-100';
const linkClass = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700';

export function AppointmentListReadonlyShell({
  result, status, operational, view = 'list', startDate = '', endDate = '', keyword = '',
  date = '', today = '', pageSize,
}: Readonly<{
  result: ReadyList | CalendarView;
  status: AppointmentListStatusV1 | null;
  operational: boolean;
  view?: 'list' | 'day' | 'week';
  startDate?: string; endDate?: string; keyword?: string; date?: string; today?: string; pageSize?: string;
}>) {
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);
  const [anchor, setAnchor] = useState(date || startDate || today);
  const [selectedStatus, setSelectedStatus] = useState(status ?? '');
  const [search, setSearch] = useState(keyword);
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const calendar = view !== 'list';
  const range = calendar ? appointmentCalendarRange(date || startDate || today, view) : null;
  const records = result.kind === 'ready' ? result.records : [];
  const listResult = result.kind === 'ready' && 'pageInfo' in result ? result : null;
  function href(updates: Record<string, string | null> = {}) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (keyword) params.set('q', keyword);
    if (calendar) { params.set('view', view); params.set('date', date || startDate || today); }
    else {
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (pageSize) params.set('pageSize', pageSize);
    }
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key); else params.set(key, value);
    }
    return `/hospital/care/appointments${params.size ? `?${params}` : ''}`;
  }
  function viewHref(next: 'list' | 'day' | 'week') {
    return href(next === 'list'
      ? { view: null, date: null, startDate: (range?.startDate ?? startDate) || null, endDate: (range?.endDate ?? endDate) || null }
      : { view: next, date: date || startDate || today, startDate: null, endDate: null, pageSize: null });
  }
  const days = range ? Array.from({ length: view === 'day' ? 1 : 7 }, (_, index) => shiftAppointmentDate(range.startDate, index)!) : [];
  const slots = new Map<string, typeof records>();
  for (const record of records) {
    const key = appointmentShanghaiTime(record.scheduledAt).slice(0, 13);
    slots.set(key, [...(slots.get(key) ?? []), record]);
  }
  const previous = range && shiftAppointmentDate(date || range.startDate, view === 'day' ? -1 : -7);
  const next = range && shiftAppointmentDate(date || range.startDate, view === 'day' ? 1 : 7);
  const createHref = href({ create: '1' });
  return (
    <section className="space-y-5" aria-labelledby="appointment-list-title" aria-busy={busy}>
      <div id="appointment-list-title">
        <span className="sr-only">{operational ? 'CONTROLLED WRITE' : 'READ ONLY'}</span>
        <InstitutionV11PageHeader eyebrow="APPOINTMENT MANAGEMENT" title="预约管理"
          description="按上海时区查询预约；支持未来日期。日历查询所选完整日期范围，空白时段不代表可预约。"
          breadcrumbs={[{ label: '机构端', href: '/hospital' }, { label: '预约与随访' }, { label: '预约管理' }]}
          state={operational ? 'LIVE' : 'READ_ONLY'}
          actions={operational ? <Link href={createHref} className={linkClass}>创建预约</Link> : null} />
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="预约视图">
        {(['list', 'day', 'week'] as const).map((mode) => <Link key={mode} href={viewHref(mode)} aria-current={view === mode ? 'page' : undefined} className={linkClass}>{mode === 'list' ? '列表视图' : mode === 'day' ? '日视图' : '周视图'}</Link>)}
      </nav>
      <form action="/hospital/care/appointments" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4"
        onSubmit={(event) => {
          const valid = calendar ? isAppointmentDate(anchor) : (!start && !end) || (isAppointmentDate(start) && isAppointmentDate(end) && start <= end);
          if (!valid) { event.preventDefault(); setError('请选择有效的开始和结束日期，结束日期不得早于开始日期。'); return; }
          event.preventDefault();
          setError(null);
          const params = new URLSearchParams();
          if (calendar) { params.set('view', view); params.set('date', anchor); }
          else {
            if (start && end) { params.set('startDate', start); params.set('endDate', end); }
            if (pageSize) params.set('pageSize', pageSize);
          }
          if (selectedStatus) params.set('status', selectedStatus);
          if (search.trim()) params.set('q', search.trim());
          startTransition(() => router.push(`/hospital/care/appointments?${params}`));
        }}>
        {calendar ? <><input type="hidden" name="view" value={view} /><label className="grid gap-1 text-sm">{view === 'day' ? '预约日期' : '所在周日期'}<input type="date" name="date" value={anchor} min="0100-01-01" max="9999-12-31" onChange={(event) => setAnchor(event.target.value)} disabled={busy} required className={fieldClass} /></label></> : <>
          <label className="grid gap-1 text-sm">开始日期<input type="date" name={start ? 'startDate' : undefined} value={start} min="0100-01-01" max="9999-12-31" onChange={(event) => setStart(event.target.value)} disabled={busy} className={fieldClass} /></label>
          <label className="grid gap-1 text-sm">结束日期<input type="date" name={end ? 'endDate' : undefined} value={end} min="0100-01-01" max="9999-12-31" onChange={(event) => setEnd(event.target.value)} disabled={busy} className={fieldClass} /></label>
          {pageSize ? <input type="hidden" name="pageSize" value={pageSize} /> : null}
        </>}
        <label className="grid gap-1 text-sm">预约状态<select name={selectedStatus ? 'status' : undefined} value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)} disabled={busy} className={fieldClass}><option value="">全部状态</option>{APPOINTMENT_LIST_STATUSES_V1.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label>
        <label className="grid gap-1 text-sm">客户或项目<input name={search.trim() ? 'q' : undefined} value={search} maxLength={80} onChange={(event) => setSearch(event.target.value.trimStart())} onBlur={() => setSearch(search.trim())} disabled={busy} className={fieldClass} /></label>
        <button type="submit" disabled={busy} className={linkClass}>{busy ? '正在查询…' : '应用筛选'}</button>
        <Link href="/hospital/care/appointments" className={linkClass}>清除筛选</Link>
      </form>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {busy ? <p role="status">正在查询预约，请稍候…</p> : null}
      {calendar && range ? <div className="flex flex-wrap items-center gap-3" aria-label="日历日期导航">
        {previous && appointmentCalendarRange(previous, view) ? <Link href={href({ date: previous })} className={linkClass}>{view === 'day' ? '前一天' : '前一周'}</Link> : <span>已到日期起点</span>}
        <Link href={href({ date: today })} className={linkClass}>今天</Link>
        {next && appointmentCalendarRange(next, view) ? <Link href={href({ date: next })} className={linkClass}>{view === 'day' ? '后一天' : '后一周'}</Link> : <span>已到日期终点</span>}
        <p className="text-sm">{range.startDate} — {range.endDate}（上海时区）</p>
      </div> : null}
      {result.kind === 'too_many' ? <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-5">当前范围超过 {result.limit} 条预约，未展示不完整日历。请切换日视图或按状态、客户／项目缩小范围。</div> : calendar && range ? <>
        <p role="status" className="text-sm text-slate-600">{records.length ? `当前日期范围共 ${records.length} 条预约，已完整展示。` : '当前日期范围暂无预约。'}</p>
        <div className="overflow-auto rounded-xl border bg-white" tabIndex={0} aria-label="预约日历（上海时区）"><table className="w-full table-fixed text-xs" style={{ minWidth: days.length === 1 ? 320 : 980 }}>
          <thead><tr><th scope="col" className="w-16 p-3">时间</th>{days.map((day) => <th key={day} scope="col" className="border-l p-3">{day}<br />{['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(`${day}T00:00:00Z`).getUTCDay()]}</th>)}</tr></thead>
          <tbody>{Array.from({ length: 24 }, (_, hour) => <tr key={hour}><th scope="row" className="border-t p-2 align-top">{String(hour).padStart(2, '0')}:00</th>{days.map((day) => <td key={day} className="h-14 border-l border-t p-1 align-top" aria-label={`${day} ${String(hour).padStart(2, '0')}:00`}>
            {(slots.get(`${day} ${String(hour).padStart(2, '0')}`) ?? []).map((record) => <article key={record.appointmentId} className="mb-1 rounded bg-blue-50 p-2 text-blue-950"><p className="font-semibold">{record.customerDisplayName} · {record.project}</p><p>{statusLabels[record.status]}</p><time dateTime={record.scheduledAt}>预约时间 {appointmentShanghaiTime(record.scheduledAt)}</time>{operational ? <Link href={`/hospital/care/appointments/${encodeURIComponent(record.appointmentId)}`} className="mt-1 block underline">查看 / 操作</Link> : null}</article>)}
          </td>)}</tr>)}</tbody>
        </table></div>
      </> : records.length === 0 ? <p role="status" className="rounded-xl border border-dashed p-8 text-center">当前页暂无预约记录</p> : <ul className="grid gap-3" aria-label={operational ? '预约记录' : '预约只读记录'}>{records.map((record) => <li key={record.appointmentId} className="rounded-xl border bg-white p-5">
        <p className="font-semibold">{record.customerDisplayName} · {record.project}</p><p className="text-sm text-slate-500">{statusLabels[record.status]}</p>
        <time dateTime={record.scheduledAt} className="block text-sm">预约时间 {appointmentShanghaiTime(record.scheduledAt)}</time>
        <time dateTime={record.updatedAt} className="block text-xs text-slate-500">更新于 {appointmentShanghaiTime(record.updatedAt)}</time>
        {operational ? <Link href={`/hospital/care/appointments/${encodeURIComponent(record.appointmentId)}`} className="mt-2 inline-block underline">查看 / 操作</Link> : null}
      </li>)}</ul>}
      {!calendar && listResult ? <nav aria-label="预约列表分页" className="flex items-center justify-between gap-3">
        {listResult.pageInfo.page > 1 ? <Link href={href({ page: String(listResult.pageInfo.page - 1) })} className={linkClass}>上一页</Link> : <span />}
        <span className="text-sm">第 {listResult.pageInfo.page} 页 · 共 {listResult.pageInfo.total} 条</span>
        {listResult.pageInfo.hasMore && listResult.pageInfo.page < APPOINTMENT_LIST_MAX_PAGE_V1 ? <Link href={href({ page: String(listResult.pageInfo.page + 1) })} className={linkClass}>下一页</Link> : null}
        {listResult.pageInfo.hasMore && listResult.pageInfo.page >= APPOINTMENT_LIST_MAX_PAGE_V1 ? <p role="status">已到分页上限，请缩小日期范围或增加筛选条件。</p> : null}
      </nav> : null}
    </section>
  );
}
