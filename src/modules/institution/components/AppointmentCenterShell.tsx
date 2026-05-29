import { AlertTriangle, CalendarCheck, Clock3 } from 'lucide-react';
import {
  appointmentAlerts,
  appointmentPipelineGroups,
} from '@/modules/institution/domain/appointments';

const alertToneClasses = {
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
};

export function AppointmentCenterShell() {
  return (
    <section className="space-y-5">
      <div className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
        <p className="text-sm font-semibold text-emerald-600">Appointment Pipeline</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">预约中心</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          聚合今日预约确认、到院、改约与风险提醒。当前为 demo 预约队列，不写入真实日程。
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {appointmentPipelineGroups.map((group) => (
          <article key={group.status} className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">{group.status}</h3>
                <p className="mt-1 text-sm text-slate-500">{group.count} 个预约</p>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CalendarCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {group.items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200/80 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-950">{item.customerName}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{item.time}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-700">{item.project}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.note}</p>
                  <p className="mt-2 text-xs text-slate-400">负责人：{item.consultant}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <article className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Clock3 className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-950">运营提醒</h3>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {appointmentAlerts.map((alert) => (
            <div key={alert.title} className={`rounded-2xl border p-4 ${alertToneClasses[alert.tone]}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4" />
                {alert.title}
              </div>
              <p className="mt-2 text-sm leading-6">{alert.description}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
