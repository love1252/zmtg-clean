'use client';

import { useState, type FormEvent } from 'react';
import {
  CalendarClock,
  ClipboardList,
  HeartPulse,
  History,
  Loader2,
  MessageSquareText,
  PlusCircle,
  ShieldCheck,
  Workflow,
  X,
} from 'lucide-react';
import {
  createAppointment,
  createTreatmentSummary,
  recordManualFollowUpFeedback,
  type CreateAppointmentClientPayload,
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
import type {
  FollowUpCustomerTimelineEventDto,
  FollowUpManualFeedbackPayload,
} from '@/modules/institution/domain/followup-customer-timeline';
import type { FollowUpRiskLevel, FollowUpStatus } from '@/modules/institution/domain/followup-workflow';
import type { CustomerTimelineTreatmentSummary } from '@/modules/institution/domain/treatment-summaries';
import type { AppointmentStatus } from '@/modules/institution/domain/appointment-records';
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

type ManualFeedbackFormState = {
  safeSummary: string;
  riskLevel: FollowUpRiskLevel;
  relatedTaskId: string;
};

const emptyManualFeedbackForm: ManualFeedbackFormState = {
  safeSummary: '',
  riskLevel: 'normal',
  relatedTaskId: '',
};

const sensitiveFollowUpFeedbackPatterns = [
  /1[3-9]\d{9}/u,
  /\d{6}(?:19|20)\d{2}\d{2}\d{2}\d{3}[\dXx]/u,
  /\bMR[-_A-Z0-9]{3,}\b/iu,
  /完整治疗|完整病历|咨询全文|病历号|身份证|手机号原文/u,
  /\bHIS\b|his payload|externalSystemPayload/iu,
  /\b(?:provider|model|token|vendor|cost|prompt|raw ai response|secret|api key|baseUrl)\b/iu,
];

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

function containsSensitiveFollowUpFeedbackValue(value: string) {
  const normalized = value.normalize('NFKC');
  return sensitiveFollowUpFeedbackPatterns.some((pattern) => pattern.test(normalized));
}

function toManualFeedbackPayload(
  form: ManualFeedbackFormState,
): FollowUpManualFeedbackPayload {
  const relatedTaskId = form.relatedTaskId.trim();

  return {
    safeSummary: form.safeSummary.normalize('NFKC').replace(/\s+/gu, ' ').trim(),
    riskLevel: form.riskLevel,
    ...(relatedTaskId ? { relatedTaskId } : {}),
  };
}

function validateManualFeedbackPayload(payload: FollowUpManualFeedbackPayload) {
  if (!payload.safeSummary.trim()) {
    return '请填写低敏反馈或备注摘要';
  }

  if (payload.safeSummary.length > 240) {
    return '低敏反馈或备注摘要不能超过 240 个字符';
  }

  const searchableValues = [payload.safeSummary, payload.relatedTaskId ?? ''];
  if (searchableValues.some(containsSensitiveFollowUpFeedbackValue)) {
    return '人工反馈只能记录低敏摘要，请移除手机号原文、身份证、病历号、HIS 或 provider 信息';
  }

  return null;
}

function followUpTimelineEventLabel(eventType: FollowUpCustomerTimelineEventDto['eventType']) {
  const labels: Record<FollowUpCustomerTimelineEventDto['eventType'], string> = {
    followup_path_enrolled: '纳入路径',
    followup_path_cancelled: '路径取消',
    followup_tasks_generated: '生成阶段任务',
    followup_task_status_changed: '任务状态变化',
    followup_task_escalated: '任务升级',
    message_draft_created: '草稿生成',
    message_draft_updated: '草稿更新',
    message_draft_approved: '草稿确认',
    message_draft_rejected: '草稿拒绝',
    message_draft_marked_sent: '标记人工发送',
    manual_feedback_recorded: '人工反馈',
  };

  return labels[eventType];
}

function followUpTimelineSourceLabel(sourceType: FollowUpCustomerTimelineEventDto['sourceType']) {
  const labels: Record<FollowUpCustomerTimelineEventDto['sourceType'], string> = {
    path_enrollment: '路径纳入',
    followup_task: '随访任务',
    message_draft: '消息草稿',
    manual_note: '人工记录',
  };

  return labels[sourceType];
}

function followUpTimelineTone(eventType: FollowUpCustomerTimelineEventDto['eventType']) {
  if (eventType === 'followup_task_escalated') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (eventType === 'message_draft_marked_sent') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (eventType.startsWith('message_draft')) return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  if (eventType === 'manual_feedback_recorded') return 'border-sky-200 bg-sky-50 text-sky-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
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

function FollowUpOverviewTile({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

function FollowUpTimelineEventItem({ event }: { event: FollowUpCustomerTimelineEventDto }) {
  const tone = followUpTimelineTone(event.eventType);

  return (
    <li className="relative pl-5">
      <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-amber-500" />
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-950">{event.eventTitle}</span>
          <span className="text-xs font-semibold text-slate-400">
            {formatTimelineTime(event.occurredAt)}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{event.safeSummary}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full border px-2.5 py-1 font-semibold ${tone}`}>
            {followUpTimelineEventLabel(event.eventType)}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-500">
            来源：{followUpTimelineSourceLabel(event.sourceType)}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-500">
            关联：{event.sourceId}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-500">
            原因：{event.safeReasonCode}
          </span>
          {event.riskLevel ? (
            <span className="rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
              风险：{followUpRiskLevelLabels[event.riskLevel]}
            </span>
          ) : null}
        </div>
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
  const followUpTimelineEvents = timeline?.followUpTimelineEvents ?? [];
  const followUpOverview = timeline?.followUpOverview ?? {
    activeEnrollmentCount: 0,
    pendingTaskCount: 0,
    overdueTaskCount: 0,
    draftCount: 0,
    approvedDraftCount: 0,
    markedSentCount: 0,
    escalatedCount: 0,
  };
  const latestPathEnrollmentEvent = followUpTimelineEvents.find(
    (event) => event.eventType === 'followup_path_enrolled',
  );
  const [isTreatmentSummaryFormOpen, setIsTreatmentSummaryFormOpen] = useState(false);
  const [treatmentSummaryForm, setTreatmentSummaryForm] =
    useState<TreatmentSummaryFormState>(emptyTreatmentSummaryForm);
  const [treatmentSummarySubmitError, setTreatmentSummarySubmitError] =
    useState<string | null>(null);
  const [treatmentSummarySubmitSuccess, setTreatmentSummarySubmitSuccess] =
    useState<string | null>(null);
  const [isTreatmentSummarySubmitting, setIsTreatmentSummarySubmitting] = useState(false);

  // 预约新增表单
  type AppointmentFormState = {
    project: string;
    scheduledAt: string;
    consultantUserId: string;
    status: AppointmentStatus;
    note: string;
  };
  const emptyAppointmentForm: AppointmentFormState = {
    project: '',
    scheduledAt: '',
    consultantUserId: '',
    status: 'pending_confirmation',
    note: '',
  };
  const appointmentStatusOptions = Object.entries(appointmentStatusLabels) as [
    AppointmentStatus,
    string,
  ][];
  const [isAppointmentFormOpen, setIsAppointmentFormOpen] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState<AppointmentFormState>(emptyAppointmentForm);
  const [appointmentSubmitError, setAppointmentSubmitError] = useState<string | null>(null);
  const [appointmentSubmitSuccess, setAppointmentSubmitSuccess] = useState<string | null>(null);
  const [isAppointmentSubmitting, setIsAppointmentSubmitting] = useState(false);

  function updateAppointmentFormField<Key extends keyof AppointmentFormState>(
    key: Key,
    value: AppointmentFormState[Key],
  ) {
    setAppointmentForm((current) => ({ ...current, [key]: value }));
  }

  async function handleAppointmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appointmentForm.project.trim() || !appointmentForm.scheduledAt.trim()) {
      setAppointmentSubmitError('请填写预约项目和预约时间');
      return;
    }
    setIsAppointmentSubmitting(true);
    setAppointmentSubmitError(null);
    try {
      const payload: CreateAppointmentClientPayload = {
        customerId,
        customerDisplayName: customer?.displayName ?? customerName,
        project: appointmentForm.project.trim(),
        scheduledAt: appointmentForm.scheduledAt.trim(),
        consultantUserId: appointmentForm.consultantUserId.trim(),
        status: appointmentForm.status,
        note: appointmentForm.note.trim(),
      };
      const result = await createAppointment(payload);
      if (result.ok) {
        setAppointmentForm(emptyAppointmentForm);
        setIsAppointmentFormOpen(false);
        setAppointmentSubmitSuccess('预约已创建');
        await onTimelineRefresh();
      } else {
        setAppointmentSubmitError(result.error.message);
      }
    } finally {
      setIsAppointmentSubmitting(false);
    }
  }

  // 随访任务创建表单
  type FollowUpFormState = {
    stage: string;
    suggestedAction: string;
    riskLevel: FollowUpRiskLevel;
    dueAt: string;
    status: FollowUpStatus;
  };
  const emptyFollowUpForm: FollowUpFormState = {
    stage: '',
    suggestedAction: '',
    riskLevel: 'normal',
    dueAt: '',
    status: 'scheduled',
  };
  const followUpStatusOptions = Object.entries(followUpStatusLabels) as [
    FollowUpStatus,
    string,
  ][];
  const [isFollowUpFormOpen, setIsFollowUpFormOpen] = useState(false);
  const [followUpForm, setFollowUpForm] = useState<FollowUpFormState>(emptyFollowUpForm);
  const [followUpSubmitError, setFollowUpSubmitError] = useState<string | null>(null);
  const [followUpSubmitSuccess, setFollowUpSubmitSuccess] = useState<string | null>(null);
  const [isFollowUpSubmitting, setIsFollowUpSubmitting] = useState(false);
  const [isManualFeedbackFormOpen, setIsManualFeedbackFormOpen] = useState(false);
  const [manualFeedbackForm, setManualFeedbackForm] =
    useState<ManualFeedbackFormState>(emptyManualFeedbackForm);
  const [manualFeedbackSubmitError, setManualFeedbackSubmitError] = useState<string | null>(null);
  const [manualFeedbackSubmitSuccess, setManualFeedbackSubmitSuccess] = useState<string | null>(null);
  const [isManualFeedbackSubmitting, setIsManualFeedbackSubmitting] = useState(false);

  function updateManualFeedbackFormField<Key extends keyof ManualFeedbackFormState>(
    key: Key,
    value: ManualFeedbackFormState[Key],
  ) {
    setManualFeedbackForm((current) => ({ ...current, [key]: value }));
  }

  async function handleManualFeedbackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = toManualFeedbackPayload(manualFeedbackForm);
    const validationError = validateManualFeedbackPayload(payload);
    if (validationError) {
      setManualFeedbackSubmitError(validationError);
      setManualFeedbackSubmitSuccess(null);
      return;
    }

    setIsManualFeedbackSubmitting(true);
    setManualFeedbackSubmitError(null);
    setManualFeedbackSubmitSuccess(null);

    try {
      const result = await recordManualFollowUpFeedback(customerId, payload);
      if (result.ok) {
        setManualFeedbackForm(emptyManualFeedbackForm);
        setIsManualFeedbackFormOpen(false);
        setManualFeedbackSubmitSuccess('低敏人工反馈已记录');
        await onTimelineRefresh();
      } else {
        setManualFeedbackSubmitError(result.error.message || '低敏人工反馈记录失败');
      }
    } finally {
      setIsManualFeedbackSubmitting(false);
    }
  }

  function updateFollowUpFormField<Key extends keyof FollowUpFormState>(
    key: Key,
    value: FollowUpFormState[Key],
  ) {
    setFollowUpForm((current) => ({ ...current, [key]: value }));
  }

  async function handleFollowUpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!followUpForm.stage.trim() || !followUpForm.dueAt.trim()) {
      setFollowUpSubmitError('请填写随访阶段和到期时间');
      return;
    }
    setIsFollowUpSubmitting(true);
    setFollowUpSubmitError(null);
    try {
      const response = await fetch('/api/institution/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          customerDisplayName: customer?.displayName ?? customerName,
          stage: followUpForm.stage.trim(),
          suggestedAction: followUpForm.suggestedAction.trim(),
          riskLevel: followUpForm.riskLevel,
          dueAt: followUpForm.dueAt.trim(),
          status: followUpForm.status,
        }),
      });
      const data = await response.json();
      if (response.ok && data.record) {
        setFollowUpForm(emptyFollowUpForm);
        setIsFollowUpFormOpen(false);
        setFollowUpSubmitSuccess('随访任务已创建');
        await onTimelineRefresh();
      } else {
        setFollowUpSubmitError(typeof data.error === 'string' ? data.error : '随访创建失败');
      }
    } catch {
      setFollowUpSubmitError('请求失败，请稍后重试');
    } finally {
      setIsFollowUpSubmitting(false);
    }
  }

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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionHeader icon={CalendarClock} title="预约记录" />
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700"
                    onClick={() => {
                      setAppointmentSubmitError(null);
                      setAppointmentSubmitSuccess(null);
                      setIsAppointmentFormOpen((prev) => !prev);
                    }}
                  >
                    <PlusCircle className="h-4 w-4" />
                    新增预约
                  </button>
                </div>

                {appointmentSubmitSuccess ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                    {appointmentSubmitSuccess}
                  </div>
                ) : null}

                {isAppointmentFormOpen ? (
                  <form
                    className="rounded-2xl border border-blue-100 bg-white p-4"
                    onSubmit={handleAppointmentSubmit}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="appointment-project" className="text-xs font-semibold text-slate-500">
                          预约项目 *
                        </label>
                        <input
                          id="appointment-project"
                          className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-300"
                          maxLength={160}
                          placeholder="如：光子嫩肤"
                          value={appointmentForm.project}
                          onChange={(e) => updateAppointmentFormField('project', e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="appointment-scheduled-at" className="text-xs font-semibold text-slate-500">
                          预约时间 *
                        </label>
                        <input
                          id="appointment-scheduled-at"
                          className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-300"
                          placeholder="2026-07-01T10:00:00Z"
                          maxLength={64}
                          value={appointmentForm.scheduledAt}
                          onChange={(e) => updateAppointmentFormField('scheduledAt', e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="appointment-consultant" className="text-xs font-semibold text-slate-500">
                          顾问
                        </label>
                        <input
                          id="appointment-consultant"
                          className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-300"
                          maxLength={96}
                          placeholder="如：李医生"
                          value={appointmentForm.consultantUserId}
                          onChange={(e) => updateAppointmentFormField('consultantUserId', e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="appointment-status" className="text-xs font-semibold text-slate-500">
                          状态
                        </label>
                        <select
                          id="appointment-status"
                          className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-300"
                          value={appointmentForm.status}
                          onChange={(e) => updateAppointmentFormField('status', e.target.value as AppointmentStatus)}
                        >
                          {appointmentStatusOptions.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="appointment-note" className="text-xs font-semibold text-slate-500">
                          备注
                        </label>
                        <textarea
                          id="appointment-note"
                          className="mt-1 h-20 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                          placeholder="预约备注（可选）"
                          value={appointmentForm.note}
                          onChange={(e) => updateAppointmentFormField('note', e.target.value)}
                        />
                      </div>
                    </div>
                    {appointmentSubmitError ? (
                      <p className="mt-3 text-sm text-rose-600">{appointmentSubmitError}</p>
                    ) : null}
                    <div className="mt-4 flex gap-3">
                      <button
                        type="submit"
                        disabled={isAppointmentSubmitting}
                        className="inline-flex h-9 items-center gap-2 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                      >
                        {isAppointmentSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            创建中...
                          </>
                        ) : (
                          '创建预约'
                        )}
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                        onClick={() => {
                          setIsAppointmentFormOpen(false);
                          setAppointmentSubmitError(null);
                        }}
                      >
                        取消
                      </button>
                    </div>
                  </form>
                ) : null}

                {timeline.appointments.length > 0 ? (
                  <ul className="space-y-3">
                    {timeline.appointments.map((appointment) => (
                      <AppointmentSummary key={appointment.id} appointment={appointment} />
                    ))}
                  </ul>
                ) : !isAppointmentFormOpen ? (
                  <InstitutionPageState kind="empty" title="暂无预约记录" />
                ) : null}
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionHeader icon={ClipboardList} title="随访任务" />
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700"
                    onClick={() => {
                      setFollowUpSubmitError(null);
                      setFollowUpSubmitSuccess(null);
                      setIsFollowUpFormOpen((prev) => !prev);
                    }}
                  >
                    <PlusCircle className="h-4 w-4" />
                    新增随访
                  </button>
                </div>

                {followUpSubmitSuccess ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                    {followUpSubmitSuccess}
                  </div>
                ) : null}

                {isFollowUpFormOpen ? (
                  <form
                    className="rounded-2xl border border-amber-100 bg-white p-4"
                    onSubmit={handleFollowUpSubmit}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="followup-stage" className="text-xs font-semibold text-slate-500">
                          随访阶段 *
                        </label>
                        <input
                          id="followup-stage"
                          className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-300"
                          maxLength={120}
                          placeholder="如：术后1周随访"
                          value={followUpForm.stage}
                          onChange={(e) => updateFollowUpFormField('stage', e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="followup-due-at" className="text-xs font-semibold text-slate-500">
                          到期时间 *
                        </label>
                        <input
                          id="followup-due-at"
                          className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-300"
                          placeholder="2026-07-01T10:00:00Z"
                          maxLength={64}
                          value={followUpForm.dueAt}
                          onChange={(e) => updateFollowUpFormField('dueAt', e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="followup-risk" className="text-xs font-semibold text-slate-500">
                          风险等级
                        </label>
                        <select
                          id="followup-risk"
                          className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-300"
                          value={followUpForm.riskLevel}
                          onChange={(e) => updateFollowUpFormField('riskLevel', e.target.value as FollowUpRiskLevel)}
                        >
                          {riskLevelOptions.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="followup-status" className="text-xs font-semibold text-slate-500">
                          状态
                        </label>
                        <select
                          id="followup-status"
                          className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-300"
                          value={followUpForm.status}
                          onChange={(e) => updateFollowUpFormField('status', e.target.value as FollowUpStatus)}
                        >
                          {followUpStatusOptions.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="followup-action" className="text-xs font-semibold text-slate-500">
                          建议动作
                        </label>
                        <textarea
                          id="followup-action"
                          className="mt-1 h-20 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-300"
                          placeholder="随访动作说明（可选）"
                          value={followUpForm.suggestedAction}
                          onChange={(e) => updateFollowUpFormField('suggestedAction', e.target.value)}
                        />
                      </div>
                    </div>
                    {followUpSubmitError ? (
                      <p className="mt-3 text-sm text-rose-600">{followUpSubmitError}</p>
                    ) : null}
                    <div className="mt-4 flex gap-3">
                      <button
                        type="submit"
                        disabled={isFollowUpSubmitting}
                        className="inline-flex h-9 items-center gap-2 rounded-full bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
                      >
                        {isFollowUpSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            创建中...
                          </>
                        ) : (
                          '创建随访'
                        )}
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                        onClick={() => {
                          setIsFollowUpFormOpen(false);
                          setFollowUpSubmitError(null);
                        }}
                      >
                        取消
                      </button>
                    </div>
                  </form>
                ) : null}

                {timeline.followups.length > 0 ? (
                  <ul className="space-y-3">
                    {timeline.followups.map((followUp) => (
                      <FollowUpSummary key={followUp.id} followUp={followUp} />
                    ))}
                  </ul>
                ) : !isFollowUpFormOpen ? (
                  <InstitutionPageState kind="empty" title="暂无随访任务" />
                ) : null}
              </section>

              <section className="space-y-3 rounded-[24px] border border-amber-100 bg-amber-50/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionHeader icon={Workflow} title="治疗后管理 / 随访轨迹" />
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-sky-200 bg-white px-3 text-xs font-semibold text-sky-700"
                    onClick={() => {
                      setManualFeedbackSubmitError(null);
                      setManualFeedbackSubmitSuccess(null);
                      setIsManualFeedbackFormOpen((prev) => !prev);
                    }}
                  >
                    <MessageSquareText className="h-4 w-4" />
                    记录低敏反馈
                  </button>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-white px-3 py-2 text-xs leading-5 text-amber-800">
                  这里只展示内部随访执行记录，不代表已自动联系客户；标记已发送仅代表人工记录。当前没有企业微信 / 短信接入。
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <FollowUpOverviewTile
                    label="有效路径"
                    value={followUpOverview.activeEnrollmentCount}
                    helper="当前仍在执行的路径纳入数"
                  />
                  <FollowUpOverviewTile
                    label="待处理任务"
                    value={followUpOverview.pendingTaskCount}
                    helper="scheduled / in_progress 任务"
                  />
                  <FollowUpOverviewTile
                    label="逾期任务"
                    value={followUpOverview.overdueTaskCount}
                    helper="已超过 dueAt 且未完成"
                  />
                  <FollowUpOverviewTile
                    label="消息草稿"
                    value={followUpOverview.draftCount}
                    helper="已生成的低敏草稿总数"
                  />
                  <FollowUpOverviewTile
                    label="已确认草稿"
                    value={followUpOverview.approvedDraftCount}
                    helper="运营确认可人工使用"
                  />
                  <FollowUpOverviewTile
                    label="已人工发送 / 升级"
                    value={followUpOverview.markedSentCount + followUpOverview.escalatedCount}
                    helper={`发送 ${followUpOverview.markedSentCount} · 升级 ${followUpOverview.escalatedCount}`}
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-950">当前路径</p>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      {followUpOverview.activeEnrollmentCount > 0 ? '执行中' : '暂无有效路径'}
                    </span>
                  </div>
                  {latestPathEnrollmentEvent ? (
                    <div className="mt-2 text-sm leading-6 text-slate-600">
                      <p>{latestPathEnrollmentEvent.safeSummary}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        纳入时间：{formatTimelineTime(latestPathEnrollmentEvent.occurredAt)} · 路径记录：{latestPathEnrollmentEvent.sourceId}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      尚未沉淀路径纳入事件。后续治疗摘要纳入随访路径后会在这里展示。
                    </p>
                  )}
                </div>

                {manualFeedbackSubmitSuccess ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                    {manualFeedbackSubmitSuccess}
                  </div>
                ) : null}

                {isManualFeedbackFormOpen ? (
                  <form
                    className="rounded-2xl border border-sky-100 bg-white p-4"
                    onSubmit={handleManualFeedbackSubmit}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label htmlFor="followup-feedback-summary" className="text-xs font-semibold text-slate-500">
                          低敏反馈 / 备注摘要 *
                        </label>
                        <textarea
                          id="followup-feedback-summary"
                          className="mt-1 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300"
                          maxLength={240}
                          placeholder="仅记录低敏摘要，如：客户反馈恢复良好，建议按 D7 任务继续人工跟进。"
                          value={manualFeedbackForm.safeSummary}
                          onChange={(event) => updateManualFeedbackFormField('safeSummary', event.target.value)}
                        />
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          不要填写手机号原文、身份证、病历号、完整治疗原文、HIS payload 或 provider 信息。
                        </p>
                      </div>
                      <div>
                        <label htmlFor="followup-feedback-risk" className="text-xs font-semibold text-slate-500">
                          风险等级
                        </label>
                        <select
                          id="followup-feedback-risk"
                          className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-300"
                          value={manualFeedbackForm.riskLevel}
                          onChange={(event) => updateManualFeedbackFormField('riskLevel', event.target.value as FollowUpRiskLevel)}
                        >
                          {riskLevelOptions.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="followup-feedback-task" className="text-xs font-semibold text-slate-500">
                          关联随访任务（可选）
                        </label>
                        <select
                          id="followup-feedback-task"
                          className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-300"
                          value={manualFeedbackForm.relatedTaskId}
                          onChange={(event) => updateManualFeedbackFormField('relatedTaskId', event.target.value)}
                        >
                          <option value="">不关联任务</option>
                          {timeline.followups.map((followUp) => (
                            <option key={followUp.id} value={followUp.id}>
                              {followUp.stage} · {followUpStatusLabels[followUp.status]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {manualFeedbackSubmitError ? (
                      <div
                        className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"
                        role="alert"
                      >
                        {manualFeedbackSubmitError}
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={isManualFeedbackSubmitting}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                      >
                        {isManualFeedbackSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {isManualFeedbackSubmitting ? '记录中...' : '保存反馈'}
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600"
                        onClick={() => {
                          setIsManualFeedbackFormOpen(false);
                          setManualFeedbackSubmitError(null);
                        }}
                      >
                        取消
                      </button>
                    </div>
                  </form>
                ) : null}

                {followUpTimelineEvents.length > 0 ? (
                  <ol className="space-y-3 border-l border-amber-200 pl-3">
                    {followUpTimelineEvents.map((event) => (
                      <FollowUpTimelineEventItem key={event.eventId} event={event} />
                    ))}
                  </ol>
                ) : (
                  <InstitutionPageState kind="empty" title="暂无随访轨迹事件" />
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
