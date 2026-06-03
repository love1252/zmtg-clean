'use client';

import { useState, type FormEvent } from 'react';
import {
  CalendarClock,
  ClipboardList,
  HeartPulse,
  History,
  Loader2,
  PlusCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  createTreatmentSummary,
  type CreateTreatmentSummaryClientPayload,
  type TenantBusinessClientError,
} from '@/modules/institution/client/tenant-business-client';
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
import type { FollowUpRiskLevel } from '@/modules/institution/domain/followup-workflow';
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
  customerId: string;
  customerName: string;
  errorState: InstitutionPageStateProps | null;
  isLoading: boolean;
  onClose: () => void;
  onTimelineRefresh: () => Promise<void>;
  timeline: CustomerTimelineResponse | null;
};

type TreatmentSummaryFormState = {
  treatmentDate: string;
  treatmentProject: string;
  treatmentCategory: string;
  treatmentStage: string;
  recoveryStage: string;
  riskLevel: FollowUpRiskLevel;
  ownerUserId: string;
  summary: string;
  nextCareAction: string;
  tagsText: string;
  appointmentId: string;
};

const emptyTreatmentSummaryForm: TreatmentSummaryFormState = {
  treatmentDate: '',
  treatmentProject: '',
  treatmentCategory: '',
  treatmentStage: '',
  recoveryStage: '',
  riskLevel: 'normal',
  ownerUserId: '',
  summary: '',
  nextCareAction: '',
  tagsText: '',
  appointmentId: '',
};

const riskLevelOptions = Object.entries(followUpRiskLevelLabels) as [
  FollowUpRiskLevel,
  string,
][];

const sensitiveTreatmentSummaryValuePatterns = [
  /完整治疗记录正文|完整治疗记录|完整病历正文|完整病历|诊疗原文|咨询对话全文|咨询全文/iu,
  /fullTreatmentRecord|medicalRecordText|diagnosisText|consultationTranscript/iu,
  /phoneNumber|idNumber|rawMedicalRecordNo|手机号原文|身份证号|病历号原文/iu,
  /(?:\p{Decimal_Number}[\s-]?){11,}/u,
  /DATABASE_URL|postgres:\/\/|\bsql\b|\bstack\b|\btoken\b|\bsecret\b/iu,
  /imageUrl|fileUrl|aiGeneratedContent|externalSystemPayload/iu,
  /https?:\/\/[^\s]+(?:\.(?:png|jpe?g|gif|pdf|docx?|zip)|\/raw-(?:image|file))/iu,
];

function formatTimelineTime(value: string | null) {
  return value ? formatBusinessDateTime(value) : '时间未记录';
}

function displayText(value: string | null | undefined, fallback = '未记录') {
  return value && value.trim().length > 0 ? value : fallback;
}

function treatmentSummaryStatusLabel(status: CustomerTimelineTreatmentSummary['status']) {
  return status === 'voided' ? '已作废' : '可作为运营依据';
}

function timelineEventStatusLabel(event: CustomerTimelineEvent) {
  if (event.type === 'treatment_summary' && event.status === 'voided') {
    return '已作废';
  }

  return event.status;
}

function splitTreatmentSummaryTags(tagsText: string) {
  return tagsText
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function containsSensitiveTreatmentSummaryValue(value: string) {
  const normalized = value.normalize('NFKC');
  return sensitiveTreatmentSummaryValuePatterns.some((pattern) => pattern.test(normalized));
}

function toTreatmentSummaryPayload(
  form: TreatmentSummaryFormState,
): CreateTreatmentSummaryClientPayload {
  const appointmentId = form.appointmentId.trim();

  return {
    treatmentDate: form.treatmentDate.trim(),
    treatmentProject: form.treatmentProject.trim(),
    treatmentCategory: form.treatmentCategory.trim(),
    treatmentStage: form.treatmentStage.trim(),
    recoveryStage: form.recoveryStage.trim(),
    riskLevel: form.riskLevel,
    ownerUserId: form.ownerUserId.trim(),
    summary: form.summary.trim(),
    nextCareAction: form.nextCareAction.trim(),
    tags: splitTreatmentSummaryTags(form.tagsText),
    ...(appointmentId ? { appointmentId } : {}),
  };
}

function validateTreatmentSummaryPayload(payload: CreateTreatmentSummaryClientPayload) {
  const requiredFields: Array<[keyof CreateTreatmentSummaryClientPayload, string]> = [
    ['treatmentDate', '治疗时间'],
    ['treatmentProject', '治疗项目'],
    ['treatmentCategory', '治疗类别'],
    ['treatmentStage', '治疗阶段'],
    ['recoveryStage', '恢复阶段'],
    ['ownerUserId', '负责人 ID'],
    ['summary', '摘要'],
    ['nextCareAction', '下一步护理'],
  ];

  for (const [key, label] of requiredFields) {
    if (typeof payload[key] !== 'string' || String(payload[key]).trim().length === 0) {
      return `字段 ${label} 必须填写`;
    }
  }

  const searchableValues = [
    payload.treatmentDate,
    payload.treatmentProject,
    payload.treatmentCategory,
    payload.treatmentStage,
    payload.recoveryStage,
    payload.ownerUserId,
    payload.summary,
    payload.nextCareAction,
    payload.appointmentId ?? '',
    ...payload.tags,
  ];

  if (searchableValues.some(containsSensitiveTreatmentSummaryValue)) {
    return '治疗摘要字段包含敏感信息，请改为结构化摘要';
  }

  return null;
}

function visibleTreatmentSummaryErrorMessage(error: TenantBusinessClientError) {
  if (error.kind === 'unauthorized') {
    return '登录状态已失效，请重新登录';
  }

  if (error.kind === 'forbidden') {
    return '当前账号没有添加治疗摘要的权限';
  }

  if (error.kind === 'not_found') {
    return '客户不存在或不属于当前租户';
  }

  if (error.kind === 'conflict') {
    return '关联预约不属于当前客户或不可用';
  }

  if (error.kind === 'service_unavailable') {
    return '数据服务暂时不可用';
  }

  return error.message || '治疗摘要提交失败';
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
  const isVoided = treatment.status === 'voided';

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-950">
          {treatment.treatmentProject}
        </span>
        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
          {isVoided ? '已作废' : followUpRiskLevelLabels[treatment.riskLevel]}
        </span>
      </div>
      {isVoided ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold leading-6 text-amber-800">
          <p>作废不是删除，该治疗摘要仅保留历史追溯。</p>
          <p className="mt-1 text-xs">不再作为后续运营依据，也不会主动向客户发送消息。</p>
        </div>
      ) : null}
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
        <span>状态：{treatmentSummaryStatusLabel(treatment.status)}</span>
        <span>负责人：{displayText(treatment.ownerUserId)}</span>
        {isVoided ? (
          <>
            <span>作废时间：{formatBusinessDateTime(treatment.voidedAt ?? '')}</span>
            <span>作废人：{displayText(treatment.voidedBy)}</span>
          </>
        ) : null}
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
          <span>状态：{timelineEventStatusLabel(event)}</span>
          <span>来源：{event.source}</span>
          <span>关联记录：{event.relatedRecordId}</span>
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
  customerId,
  customerName,
  errorState,
  isLoading,
  onClose,
  onTimelineRefresh,
  timeline,
}: CustomerTimelineDrawerProps) {
  const customer = timeline?.customer;
  const treatmentSummaries = timeline?.treatmentSummaries ?? [];
  const [isTreatmentSummaryFormOpen, setIsTreatmentSummaryFormOpen] = useState(false);
  const [treatmentSummaryForm, setTreatmentSummaryForm] =
    useState<TreatmentSummaryFormState>(emptyTreatmentSummaryForm);
  const [treatmentSummarySubmitError, setTreatmentSummarySubmitError] =
    useState<string | null>(null);
  const [treatmentSummarySubmitSuccess, setTreatmentSummarySubmitSuccess] =
    useState<string | null>(null);
  const [isTreatmentSummarySubmitting, setIsTreatmentSummarySubmitting] = useState(false);

  function updateTreatmentSummaryFormField<Key extends keyof TreatmentSummaryFormState>(
    key: Key,
    value: TreatmentSummaryFormState[Key],
  ) {
    setTreatmentSummaryForm((current) => ({ ...current, [key]: value }));
  }

  function openTreatmentSummaryForm() {
    setIsTreatmentSummaryFormOpen(true);
    setTreatmentSummarySubmitError(null);
    setTreatmentSummarySubmitSuccess(null);
  }

  function closeTreatmentSummaryForm() {
    setIsTreatmentSummaryFormOpen(false);
    setTreatmentSummarySubmitError(null);
  }

  async function handleTreatmentSummarySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = toTreatmentSummaryPayload(treatmentSummaryForm);
    const validationError = validateTreatmentSummaryPayload(payload);
    if (validationError) {
      setTreatmentSummarySubmitError(validationError);
      setTreatmentSummarySubmitSuccess(null);
      return;
    }

    setIsTreatmentSummarySubmitting(true);
    setTreatmentSummarySubmitError(null);
    setTreatmentSummarySubmitSuccess(null);

    try {
      const result = await createTreatmentSummary(customerId, payload);

      if (result.ok) {
        setTreatmentSummaryForm(emptyTreatmentSummaryForm);
        setIsTreatmentSummaryFormOpen(false);
        setTreatmentSummarySubmitSuccess('治疗摘要已添加');
        await onTimelineRefresh();
      } else {
        setTreatmentSummarySubmitError(visibleTreatmentSummaryErrorMessage(result.error));
      }
    } finally {
      setIsTreatmentSummarySubmitting(false);
    }
  }

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
              <p className="mt-1 text-xs leading-5 text-slate-500">
                服务过程沉淀：预约、治疗摘要、随访任务和关键操作记录。这里展示结构化摘要，不展示原始诊疗内容。
              </p>
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
                <SectionHeader icon={CalendarClock} title="预约记录" />
                {timeline.appointments.length > 0 ? (
                  <ul className="space-y-3">
                    {timeline.appointments.map((appointment) => (
                      <AppointmentSummary key={appointment.id} appointment={appointment} />
                    ))}
                  </ul>
                ) : (
                  <InstitutionPageState kind="empty" title="暂无预约记录" />
                )}
              </section>

              <section className="space-y-3">
                <SectionHeader icon={ClipboardList} title="随访任务" />
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionHeader icon={HeartPulse} title="治疗后结构化摘要" />
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700"
                    onClick={openTreatmentSummaryForm}
                  >
                    <PlusCircle className="h-4 w-4" />
                    添加治疗摘要
                  </button>
                </div>

                {treatmentSummarySubmitSuccess ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                    {treatmentSummarySubmitSuccess}
                  </div>
                ) : null}

                {isTreatmentSummaryFormOpen ? (
                  <form
                    className="rounded-2xl border border-rose-100 bg-white p-4"
                    onSubmit={handleTreatmentSummarySubmit}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="treatment-summary-date"
                          className="text-xs font-semibold text-slate-500"
                        >
                          治疗时间
                        </label>
                        <input
                          id="treatment-summary-date"
                          className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-rose-300"
                          maxLength={64}
                          value={treatmentSummaryForm.treatmentDate}
                          onChange={(event) =>
                            updateTreatmentSummaryFormField('treatmentDate', event.target.value)
                          }
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="treatment-summary-project"
                          className="text-xs font-semibold text-slate-500"
                        >
                          治疗项目
                        </label>
                        <input
                          id="treatment-summary-project"
                          className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-rose-300"
                          maxLength={80}
                          value={treatmentSummaryForm.treatmentProject}
                          onChange={(event) =>
                            updateTreatmentSummaryFormField('treatmentProject', event.target.value)
                          }
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="treatment-summary-category"
                          className="text-xs font-semibold text-slate-500"
                        >
                          治疗类别
                        </label>
                        <input
                          id="treatment-summary-category"
                          className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-rose-300"
                          maxLength={80}
                          value={treatmentSummaryForm.treatmentCategory}
                          onChange={(event) =>
                            updateTreatmentSummaryFormField('treatmentCategory', event.target.value)
                          }
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="treatment-summary-stage"
                          className="text-xs font-semibold text-slate-500"
                        >
                          治疗阶段
                        </label>
                        <input
                          id="treatment-summary-stage"
                          className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-rose-300"
                          maxLength={80}
                          value={treatmentSummaryForm.treatmentStage}
                          onChange={(event) =>
                            updateTreatmentSummaryFormField('treatmentStage', event.target.value)
                          }
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="treatment-summary-recovery-stage"
                          className="text-xs font-semibold text-slate-500"
                        >
                          恢复阶段
                        </label>
                        <input
                          id="treatment-summary-recovery-stage"
                          className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-rose-300"
                          maxLength={80}
                          value={treatmentSummaryForm.recoveryStage}
                          onChange={(event) =>
                            updateTreatmentSummaryFormField('recoveryStage', event.target.value)
                          }
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="treatment-summary-risk"
                          className="text-xs font-semibold text-slate-500"
                        >
                          风险等级
                        </label>
                        <select
                          id="treatment-summary-risk"
                          className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-rose-300"
                          value={treatmentSummaryForm.riskLevel}
                          onChange={(event) =>
                            updateTreatmentSummaryFormField(
                              'riskLevel',
                              event.target.value as FollowUpRiskLevel,
                            )
                          }
                        >
                          {riskLevelOptions.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="treatment-summary-owner"
                          className="text-xs font-semibold text-slate-500"
                        >
                          负责人 ID
                        </label>
                        <input
                          id="treatment-summary-owner"
                          className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-rose-300"
                          maxLength={80}
                          value={treatmentSummaryForm.ownerUserId}
                          onChange={(event) =>
                            updateTreatmentSummaryFormField('ownerUserId', event.target.value)
                          }
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="treatment-summary-appointment"
                          className="text-xs font-semibold text-slate-500"
                        >
                          关联预约 ID（可选）
                        </label>
                        <input
                          id="treatment-summary-appointment"
                          className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-rose-300"
                          maxLength={80}
                          value={treatmentSummaryForm.appointmentId}
                          onChange={(event) =>
                            updateTreatmentSummaryFormField('appointmentId', event.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label
                        htmlFor="treatment-summary-summary"
                        className="text-xs font-semibold text-slate-500"
                      >
                        摘要
                      </label>
                      <textarea
                        id="treatment-summary-summary"
                        className="mt-1 min-h-20 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-300"
                        maxLength={240}
                        value={treatmentSummaryForm.summary}
                        onChange={(event) =>
                          updateTreatmentSummaryFormField('summary', event.target.value)
                        }
                      />
                    </div>

                    <div className="mt-3">
                      <label
                        htmlFor="treatment-summary-next-action"
                        className="text-xs font-semibold text-slate-500"
                      >
                        下一步护理
                      </label>
                      <textarea
                        id="treatment-summary-next-action"
                        className="mt-1 min-h-20 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-300"
                        maxLength={240}
                        value={treatmentSummaryForm.nextCareAction}
                        onChange={(event) =>
                          updateTreatmentSummaryFormField('nextCareAction', event.target.value)
                        }
                      />
                    </div>

                    <div className="mt-3">
                      <label
                        htmlFor="treatment-summary-tags"
                        className="text-xs font-semibold text-slate-500"
                      >
                        标签
                      </label>
                      <input
                        id="treatment-summary-tags"
                        className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-rose-300"
                        maxLength={160}
                        value={treatmentSummaryForm.tagsText}
                        onChange={(event) =>
                          updateTreatmentSummaryFormField('tagsText', event.target.value)
                        }
                      />
                    </div>

                    {treatmentSummarySubmitError ? (
                      <div
                        className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"
                        role="alert"
                      >
                        {treatmentSummarySubmitError}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="submit"
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                        disabled={isTreatmentSummarySubmitting}
                      >
                        {isTreatmentSummarySubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        {isTreatmentSummarySubmitting ? '提交中...' : '保存治疗摘要'}
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600"
                        onClick={closeTreatmentSummaryForm}
                      >
                        取消
                      </button>
                    </div>
                  </form>
                ) : null}

                {!isTreatmentSummaryFormOpen && treatmentSummarySubmitError ? (
                  <div
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"
                    role="alert"
                  >
                    {treatmentSummarySubmitError}
                  </div>
                ) : null}

                {treatmentSummaries.length > 0 ? (
                  <ul className="space-y-3">
                    {treatmentSummaries.map((treatment) => (
                      <TreatmentSummary key={treatment.id} treatment={treatment} />
                    ))}
                  </ul>
                ) : (
                  <InstitutionPageState kind="empty" title="暂无治疗后结构化摘要" />
                )}
              </section>

              <section className="space-y-3">
                <SectionHeader icon={History} title="服务过程时间线" />
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
                <SectionHeader icon={ShieldCheck} title="关键操作记录" />
                {timeline.auditEvents.length > 0 ? (
                  <ul className="space-y-3">
                    {timeline.auditEvents.map((auditEvent) => (
                      <AuditSummary key={auditEvent.id} auditEvent={auditEvent} />
                    ))}
                  </ul>
                ) : (
                  <InstitutionPageState kind="empty" title="暂无关键操作记录" />
                )}
              </section>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
