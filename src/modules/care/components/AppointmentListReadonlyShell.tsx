'use client';

import Link from 'next/link';
import { CalendarDays, PanelRightOpen, Plus } from 'lucide-react';
import { useState } from 'react';

import {
  APPOINTMENT_LIST_MAX_PAGE_V1,
  type AppointmentListReaderResultV1,
} from '@/modules/care/application/appointment-list-pagination-contract';
import type { AppointmentListStatusV1 } from '@/modules/care/ports/appointment-list-source';
import {
  InstitutionV11Button,
  InstitutionV11DateRangeControl,
  InstitutionV11Drawer,
  InstitutionV11PageHeader,
} from '@/modules/institution-v11/components/InstitutionV11Ui';

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

function appointmentCreateHref() {
  const params = new URLSearchParams({ create: '1' });
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
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  return (
    <section className="space-y-5" aria-labelledby="appointment-list-title">
      <div id="appointment-list-title">
        <span className="sr-only">{operational ? 'CONTROLLED WRITE' : 'READ ONLY'}</span>
        <InstitutionV11PageHeader
          eyebrow="APPOINTMENT MANAGEMENT"
          title="预约管理"
          description={operational
            ? `当前页展示 ${result.records.length} 条低敏预约记录；所有创建、修改与取消仍走现有命令。`
            : `当前页展示 ${result.records.length} 条低敏预约记录，仅供查看。`}
          breadcrumbs={[{ label: '机构端', href: '/hospital' }, { label: '预约与随访' }, { label: '预约管理' }]}
          state={operational ? 'LIVE' : 'READ_ONLY'}
          actions={(
            <>
              <InstitutionV11DateRangeControl label="本周" />
              <Link href={operational ? appointmentCreateHref() : '/hospital/care/appointments'} aria-disabled={!operational} className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold ${operational ? 'border-blue-700 bg-blue-700 text-white' : 'pointer-events-none border-slate-200 bg-slate-100 text-slate-400'}`}><Plus aria-hidden="true" className="h-4 w-4" />创建预约</Link>
            </>
          )}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex gap-1"><button type="button" onClick={() => setView('list')} className={`rounded-lg px-3 py-1.5 text-xs ${view === 'list' ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-500'}`}>列表视图</button><button type="button" onClick={() => setView('calendar')} className={`rounded-lg px-3 py-1.5 text-xs ${view === 'calendar' ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-500'}`}>日历视图</button><span className="mx-1 h-8 w-px bg-slate-200" /><button type="button" className="rounded-lg px-3 py-1.5 text-xs text-slate-500">日</button><button type="button" className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700">周</button></div>
        <InstitutionV11Button icon={PanelRightOpen} onClick={() => setAvailabilityOpen(true)}>空闲时间查询</InstitutionV11Button>
      </div>

      {view === 'calendar' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><div className="min-w-[820px]"><div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((day) => <div key={day} className="px-3 py-2 text-center text-xs font-semibold text-slate-500">{day}</div>)}</div><div className="grid grid-cols-7">{Array.from({ length: 35 }, (_, index) => <button key={index} type="button" disabled title="Availability 能力未开放" className="min-h-24 border-b border-r border-slate-100 bg-slate-50/30 p-2 text-left disabled:cursor-not-allowed"><span className="text-xs text-slate-500">{index + 1 <= 31 ? index + 1 : ''}</span><span className="mt-5 block text-[10px] text-slate-400">Availability 未开放</span></button>)}</div></div></div>
      ) : result.records.length === 0 ? (
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

      <InstitutionV11Drawer open={availabilityOpen} onClose={() => setAvailabilityOpen(false)} title="空闲时间查询" description="项目、医生、治疗室与设备条件已经还原；不会生成假空闲时段。" footer={<div className="flex justify-end"><InstitutionV11Button onClick={() => setAvailabilityOpen(false)}>关闭</InstitutionV11Button></div>}>
        <div className="grid gap-4"><label className="grid gap-1.5 text-xs text-slate-600">项目<span className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-100 px-3 text-slate-400">正式 Availability Reader 未开放</span></label><label className="grid gap-1.5 text-xs text-slate-600">医生 / 治疗室 / 设备<span className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-100 px-3 text-slate-400">当前不支持</span></label><div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><CalendarDays aria-hidden="true" className="mx-auto h-6 w-6 text-slate-400" /><h3 className="mt-2 text-sm font-semibold text-slate-900">Availability 能力未开放</h3><p className="mt-1 text-xs text-slate-500">时间槽全部置灰并显示真实禁用原因。</p></div></div>
      </InstitutionV11Drawer>
    </section>
  );
}
