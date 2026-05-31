'use client';

import { CalendarClock, ClipboardList, HeartPulse, History, ShieldCheck, X } from 'lucide-react';
import {
  InstitutionPageState,
  type InstitutionPageStateProps,
} from '@/modules/institution/components/InstitutionPageState';
import type {
  CustomerTimelineAppointmentSummary,
  CustomerTimelineAuditSummary,
  CustomerTimelineEvent,
  CustomerTimelineFollowUpSummary,
  CustomerTimelineResponse,
} from '@/modules/institution/domain/customer-timeline';
import type { CustomerTimelineTreatmentSummary } from '@/modules/institution/domain/treatment-summaries';
import {
  appointmentStatusLabels,
  customerLifecycleLabels,
  customerPriorityLabels,
  followUpRiskLevelLabels,
  followUpStatusLabels,
  formatBusinessDateTime,
} from '@/modules/institution/domain/tenant-business-view-models';

type CustomerTimelineDrawerProps = {
  customerName: string;
  errorState: InstitutionPageStateProps | null;
  isLoading: boolean;
  onClose: () => void;
  timeline: CustomerTimelineResponse | null;
};

function formatTimelineTime(value: string | null) {
  return value ? formatBusinessDateTime(value) : '时间未记录';
}

function displayText(value: string | null | undefined, fallback = '未记录') {
  return value && value.trim().length > 0 ? value : fallback;
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: typeof CalendarClock;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-2xl bg-blue-50 text-blue-600">
        <Icon className="h-4 w-4" />
      </span>
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
    </div>
  );
}

function AppointmentSummary({ appointment }: { appointment: CustomerTimelineAppointmentSummary }) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-950">{appointment.project}</span>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">
          {appointmentStatusLabels[appointment.status]}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{appointment.note}</p>
      <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
        <span>预约时间：{formatBusinessDateTime(appointment.scheduledAt)}</span>
        <span>顾问：{displayText(appointment.consultantUserId)}</span>
      </div>
    </li>
  );
}

function FollowUpSummary({ followUp }: { followUp: CustomerTimelineFollowUpSummary }) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-950">{followUp.stage}</span>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
          {followUpStatusLabels[followUp.status]}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{followUp.suggestedAction}</p>
      <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
        <span>到期时间：{formatBusinessDateTime(followUp.dueAt)}</span>
        <span>风险：{followUpRiskLevelLabels[followUp.riskLevel]}</span>
      </div>
    </li>
  );
}

function TreatmentSummary({ treatment }: { treatment: CustomerTimelineTreatmentSummary }) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-950">
          {treatment.treatmentProject}
        </span>
        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
          {followUpRiskLevelLabels[treatment.riskLevel]}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{treatment.summary}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        下一步护理：{displayText(treatment.nextCareAction)}
      </p>
      <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
        <span>治疗时间：{formatBusinessDateTime(treatment.treatmentDate)}</span>
        <span>类别：{displayText(treatment.treatmentCategory)}</span>
        <span>阶段：{displayText(treatment.treatmentStage)}</span>
        <span>恢复：{displayText(treatment.recoveryStage)}</span>
        <span>风险：{followUpRiskLevelLabels[treatment.riskLevel]}</span>
        <span>负责人：{displayText(treatment.ownerUserId)}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {treatment.tags.length > 0 ? (
          treatment.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"
            >
              {tag}
            </span>
          ))
        ) : (
          <span className="text-sm text-slate-400">暂无标签</span>
        )}
      </div>
    </li>
  );
}

function TimelineEventItem({ event }: { event: CustomerTimelineEvent }) {
  return (
    <li className="relative pl-5">
      <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-slate-900" />
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-950">{event.title}</span>
          <span className="text-xs font-semibold text-slate-400">
            {formatTimelineTime(event.occurredAt)}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{event.summary}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
          <span>状态：{event.status}</span>
          <span>来源：{event.source}</span>
          <span>关联：{event.relatedRecordId}</span>
          {event.riskLevel ? (
            <span>风险：{followUpRiskLevelLabels[event.riskLevel]}</span>
          ) : null}
        </div>
        {event.tags && event.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {event.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function AuditSummary({ auditEvent }: { auditEvent: CustomerTimelineAuditSummary }) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-950">{auditEvent.id}</span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          {auditEvent.result}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {auditEvent.action} · {auditEvent.result} / {auditEvent.reason}
      </p>
      <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
        <span>操作人：{auditEvent.actor.id}</span>
        <span>角色：{auditEvent.actor.role}</span>
        <span>资源：{auditEvent.resource}</span>
        <span>资源 ID：{displayText(auditEvent.resourceId)}</span>
        <span>时间：{formatBusinessDateTime(auditEvent.occurredAt)}</span>
      </div>
    </li>
  );
}

export function CustomerTimelineDrawer({
  customerName,
  errorState,
  isLoading,
  onClose,
  timeline,
}: CustomerTimelineDrawerProps) {
  const customer = timeline?.customer;
  const treatmentSummaries = timeline?.treatmentSummaries ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
      <aside
        aria-label="客户详情时间线"
        aria-modal="true"
        className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-slate-50 shadow-[-24px_0_80px_rgba(15,23,42,0.22)]"
        role="dialog"
      >
        <header className="border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-blue-600">客户详情</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">客户详情时间线</h2>
              <p className="mt-1 text-sm text-slate-500">{customer?.displayName ?? customerName}</p>
            </div>
            <button
              type="button"
              aria-label="关闭客户详情"
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-500"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {isLoading ? (
            <InstitutionPageState kind="loading" title="正在加载客户详情..." />
          ) : null}

          {!isLoading && errorState ? <InstitutionPageState {...errorState} /> : null}

          {!isLoading && !errorState && timeline && customer ? (
            <div className="space-y-5">
              <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold text-slate-950">{customer.displayName}</span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">
                    {customerPriorityLabels[customer.priority]}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                    {customerLifecycleLabels[customer.lifecycle]}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                  <span>脱敏手机号：{customer.maskedPhone}</span>
                  <span>脱敏病历号：{customer.maskedMedicalRecordNo}</span>
                  <span>项目兴趣：{customer.projectInterest}</span>
                  <span>负责人：{customer.ownerUserId}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {customer.tags.length > 0 ? (
                    customer.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-400">暂无标签</span>
                  )}
                </div>

                <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-400">下一步动作</div>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-800">
                    {customer.nextAction}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    最近触达：{customer.lastTouchSummary}
                  </p>
                </div>
              </section>

              <section className="space-y-3">
                <SectionHeader icon={CalendarClock} title="预约摘要" />
                {timeline.appointments.length > 0 ? (
                  <ul className="space-y-3">
                    {timeline.appointments.map((appointment) => (
                      <AppointmentSummary key={appointment.id} appointment={appointment} />
                    ))}
                  </ul>
                ) : (
                  <InstitutionPageState kind="empty" title="暂无预约摘要" />
                )}
              </section>

              <section className="space-y-3">
                <SectionHeader icon={ClipboardList} title="随访摘要" />
                {timeline.followups.length > 0 ? (
                  <ul className="space-y-3">
                    {timeline.followups.map((followUp) => (
                      <FollowUpSummary key={followUp.id} followUp={followUp} />
                    ))}
                  </ul>
                ) : (
                  <InstitutionPageState kind="empty" title="暂无随访任务" />
                )}
              </section>

              <section className="space-y-3">
                <SectionHeader icon={HeartPulse} title="治疗结构化摘要" />
                {treatmentSummaries.length > 0 ? (
                  <ul className="space-y-3">
                    {treatmentSummaries.map((treatment) => (
                      <TreatmentSummary key={treatment.id} treatment={treatment} />
                    ))}
                  </ul>
                ) : (
                  <InstitutionPageState kind="empty" title="暂无治疗摘要" />
                )}
              </section>

              <section className="space-y-3">
                <SectionHeader icon={History} title="结构化时间线" />
                {timeline.timeline.length > 0 ? (
                  <ol className="space-y-3 border-l border-slate-200 pl-3">
                    {timeline.timeline.map((event) => (
                      <TimelineEventItem key={event.id} event={event} />
                    ))}
                  </ol>
                ) : (
                  <InstitutionPageState kind="empty" title="暂无时间线事件" />
                )}
              </section>

              <section className="space-y-3">
                <SectionHeader icon={ShieldCheck} title="安全审计摘要" />
                {timeline.auditEvents.length > 0 ? (
                  <ul className="space-y-3">
                    {timeline.auditEvents.map((auditEvent) => (
                      <AuditSummary key={auditEvent.id} auditEvent={auditEvent} />
                    ))}
                  </ul>
                ) : (
                  <InstitutionPageState kind="empty" title="暂无安全审计摘要" />
                )}
              </section>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
