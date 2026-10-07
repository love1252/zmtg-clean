import type { WorkbenchAppointmentResultV1 } from '@/modules/care/application/workbench-appointment-view';

type Ready = Extract<WorkbenchAppointmentResultV1, { kind: 'ready' }>;
const labels = { pending_confirmation: '待确认', confirmed: '已确认', arrived: '已到店', completed: '已完成', reschedule_requested: '申请改期', cancelled: '已取消' };

function AppointmentSection({ title, data, href, empty }: Readonly<{
  title: string; data: Ready['today']; href: string; empty: string;
}>) {
  return <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label={title}>
    <header className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold text-slate-900">{title} <span className="text-sm text-slate-500">{data.total} 项</span></h2><a className="text-sm font-medium text-blue-700" href={href}>查看全部</a></header>
    {data.records.length ? <ul className="divide-y divide-slate-100">{data.records.map(record => <li key={record.appointmentId} className="py-3">
      <a href={`/hospital/care/appointments/${encodeURIComponent(record.appointmentId)}`} className="block rounded text-sm focus-visible:outline-blue-500">
        <span className="font-medium text-slate-900">{record.customerDisplayName} · {record.project}</span>
        <span className="mt-1 block text-xs text-slate-500"><time dateTime={record.scheduledAt}>{new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(record.scheduledAt))}</time> · {labels[record.status]}</span>
      </a>
    </li>)}</ul> : <p className="py-5 text-sm text-slate-500">{empty}</p>}
    {data.total > data.records.length ? <p className="mt-2 text-xs text-slate-500">显示最早的 {data.records.length} 项，共 {data.total} 项；全部记录可继续分页查看。</p> : null}
  </section>;
}

export function WorkbenchAppointmentSchedule({ result }: Readonly<{ result: WorkbenchAppointmentResultV1 }>) {
  if (result.kind !== 'ready') return <section aria-label="预约安排" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><h2 className="font-semibold">预约安排暂不可用</h2><p>尚未取得当前机构的完整预约结果，请刷新后重试。</p></section>;
  const query = new URLSearchParams({ startDate: result.businessDate, endDate: result.businessDate });
  return <div className="space-y-2"><p className="text-xs text-slate-500">{result.businessDate} · 上海时间 · 数量覆盖当前授权机构的全部匹配记录</p><div className="grid gap-4 xl:grid-cols-3">
    <AppointmentSection title="今日安排" data={result.today} href={`/hospital/care/appointments?${query}`} empty="今日暂无预约记录" />
    <AppointmentSection title="待确认预约" data={result.pending} href="/hospital/care/appointments?status=pending_confirmation" empty="暂无待确认预约" />
    <AppointmentSection title="改期申请" data={result.rescheduled} href="/hospital/care/appointments?status=reschedule_requested" empty="暂无改期申请" />
  </div></div>;
}
