'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Filter,
  Loader2,
  Pencil,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  createFollowUpTaskFromTreatmentSummary,
  listFollowUpTasks,
  listTreatmentSummaries,
  listTreatmentFollowUpSuggestions,
  updateTreatmentSummary,
  voidTreatmentSummary,
  type TenantBusinessClientError,
  type TreatmentSummaryListClientQuery,
  type UpdateTreatmentSummaryClientPayload,
  type VoidTreatmentSummaryClientPayload,
} from '@/modules/institution/client/tenant-business-client';
import type { TreatmentFollowUpSuggestion } from '@/modules/institution/domain/treatment-followup-suggestions';
import {
  type InstitutionTreatmentSummaryListItem,
  type TreatmentSummaryVoidReasonCode,
  type TreatmentSummaryListPageInfo,
  treatmentSummaryVoidReasonCodes,
} from '@/modules/institution/domain/treatment-summaries';
import {
  followUpRiskLevelLabels,
  followUpStatusLabels,
  formatBusinessDateTime,
} from '@/modules/institution/domain/tenant-business-view-models';
import type {
  FollowUpRiskLevel,
  FollowUpStatus,
  TenantFollowUpTask,
} from '@/modules/institution/domain/followup-workflow';
import {
  InstitutionPageState,
  getInstitutionPageStateFromClientError,
  type InstitutionPageStateProps,
} from '@/modules/institution/components/InstitutionPageState';
import { InstitutionSectionHeader } from '@/modules/institution/components/InstitutionSectionHeader';
import { cn } from '@/shared/utils/cn';

type TreatmentSummaryFilterForm = {
  customerId: string;
  treatmentProject: string;
  riskLevel: '' | FollowUpRiskLevel;
  from: string;
  to: string;
};

type TreatmentSummaryEditForm = {
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

type TreatmentSummaryVoidForm = {
  reasonCode: TreatmentSummaryVoidReasonCode;
  reasonText: string;
};

const emptyTreatmentSummaryFilterForm: TreatmentSummaryFilterForm = {
  customerId: '',
  treatmentProject: '',
  riskLevel: '',
  from: '',
  to: '',
};

const emptyTreatmentSummaryVoidForm: TreatmentSummaryVoidForm = {
  reasonCode: 'manual_governance_review',
  reasonText: '',
};

const riskLevelToneClasses = {
  normal: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  watch: 'border-amber-200 bg-amber-50 text-amber-700',
  urgent: 'border-rose-200 bg-rose-50 text-rose-700',
} as const satisfies Record<FollowUpRiskLevel, string>;

const suggestionPriorityLabels = {
  low: '低',
  medium: '中',
  high: '高',
} as const satisfies Record<TreatmentFollowUpSuggestion['priority'], string>;

const suggestionPriorityToneClasses = {
  low: 'border-slate-200 bg-slate-50 text-slate-600',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  high: 'border-rose-200 bg-rose-50 text-rose-700',
} as const satisfies Record<TreatmentFollowUpSuggestion['priority'], string>;

const templatePathTypeLabels = {
  photoelectric_care: '光子 / 光电治疗',
  hydro_injection_care: '水光 / 注射护理',
  post_surgery_repair: '术后修复',
  skin_management: '皮肤管理',
} as const satisfies Record<string, string>;

type TemplatePathTypeKey = keyof typeof templatePathTypeLabels;

const templateHandlerRoleLabels = new Set([
  '客服',
  '医助',
  '护理人员',
  '咨询师',
  '运营负责人',
]);

const voidReasonCodeLabels = {
  duplicate_summary: '重复录入',
  created_by_mistake: '误创建',
  wrong_customer_or_appointment: '关联客户或预约错误',
  entered_wrong_treatment: '治疗项目录入错误',
  manual_governance_review: '人工治理复核',
  other: '其他',
} as const satisfies Record<TreatmentSummaryVoidReasonCode, string>;

const sensitiveVoidReasonPatterns = [
  /完整治疗记录正文|完整治疗记录|完整病历正文|完整病历|诊疗原文|咨询对话全文|咨询全文/iu,
  /fullTreatmentRecord|medicalRecordText|diagnosisText|consultationTranscript/iu,
  /phoneNumber|idNumber|rawMedicalRecordNo|手机号原文|身份证号|病历号原文/iu,
  /(?:\p{Decimal_Number}[\s-]?){11,}/u,
  /DATABASE_URL|postgres:\/\/|\bsql\b|\bstack\b|\btoken\b|\bsecret\b/iu,
  /imageUrl|fileUrl|aiGeneratedContent|externalSystemPayload|requestBody/iu,
  /https?:\/\/[^\s]+(?:\.(?:png|jpe?g|gif|pdf|docx?|zip)|\/raw-(?:image|file))/iu,
];

const activeFollowUpStatuses = new Set<FollowUpStatus>([
  'scheduled',
  'due',
  'in_progress',
  'escalated',
]);

const riskLevelOptions = Object.entries(followUpRiskLevelLabels) as [
  FollowUpRiskLevel,
  string,
][];

function toIsoDateTime(value: string) {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Date(timestamp).toISOString();
}

function trimOrUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function toDateTimeLocalInput(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value.slice(0, 16);
  }

  const date = new Date(timestamp);
  return [
    date.getFullYear(),
    '-',
    padDatePart(date.getMonth() + 1),
    '-',
    padDatePart(date.getDate()),
    'T',
    padDatePart(date.getHours()),
    ':',
    padDatePart(date.getMinutes()),
  ].join('');
}

function toStableTreatmentDate(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(trimmed)) {
    return `${trimmed}:00+08:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/u.test(trimmed)) {
    return `${trimmed}+08:00`;
  }
  return trimmed;
}

function normalizeTagsText(value: string) {
  return [
    ...new Set(
      value
        .split(/[,\n，、]/u)
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    ),
  ];
}

function recordToEditForm(
  record: InstitutionTreatmentSummaryListItem,
): TreatmentSummaryEditForm {
  return {
    treatmentDate: toDateTimeLocalInput(record.treatmentDate),
    treatmentProject: record.treatmentProject,
    treatmentCategory: record.treatmentCategory,
    treatmentStage: record.treatmentStage,
    recoveryStage: record.recoveryStage,
    riskLevel: record.riskLevel,
    ownerUserId: record.ownerUserId,
    summary: record.summary,
    nextCareAction: record.nextCareAction,
    tagsText: record.tags.join('，'),
    appointmentId: record.appointmentId ?? '',
  };
}

function formToUpdateTreatmentSummaryPayload(
  form: TreatmentSummaryEditForm,
): UpdateTreatmentSummaryClientPayload {
  const appointmentId = form.appointmentId.trim();

  return {
    treatmentDate: toStableTreatmentDate(form.treatmentDate),
    treatmentProject: form.treatmentProject.trim(),
    treatmentCategory: form.treatmentCategory.trim(),
    treatmentStage: form.treatmentStage.trim(),
    recoveryStage: form.recoveryStage.trim(),
    riskLevel: form.riskLevel,
    ownerUserId: form.ownerUserId.trim(),
    summary: form.summary.trim(),
    nextCareAction: form.nextCareAction.trim(),
    tags: normalizeTagsText(form.tagsText),
    appointmentId: appointmentId.length > 0 ? appointmentId : null,
  };
}

function formToTreatmentSummaryQuery(
  form: TreatmentSummaryFilterForm,
): TreatmentSummaryListClientQuery {
  return {
    customerId: trimOrUndefined(form.customerId),
    treatmentProject: trimOrUndefined(form.treatmentProject),
    riskLevel: form.riskLevel || undefined,
    from: toIsoDateTime(form.from),
    to: toIsoDateTime(form.to),
  };
}

function visibleTreatmentSummaryErrorState(
  error: TenantBusinessClientError,
): InstitutionPageStateProps {
  return getInstitutionPageStateFromClientError(error, {
    forbiddenMessage: '当前账号没有查看治疗摘要的权限',
    fallbackMessage: '治疗摘要运营视图暂时无法加载',
    unavailableMessage: '治疗摘要数据暂时不可用',
  });
}

function visibleTreatmentSummaryEditErrorMessage(error: TenantBusinessClientError) {
  if (error.kind === 'unauthorized') return '请先登录';
  if (error.kind === 'forbidden') return '当前账号没有编辑治疗摘要的权限';
  if (error.kind === 'not_found') return '治疗摘要不存在或不可见';
  if (error.kind === 'conflict') {
    return error.message || 'appointmentId 归属不合法，请选择同客户预约';
  }
  if (error.kind === 'service_unavailable') return '数据服务暂时不可用';
  if (error.kind === 'validation_error') {
    return error.message || '字段非法，请检查治疗摘要编辑内容';
  }
  return error.message || '治疗摘要编辑失败';
}

function displayValue(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : '-';
}

function treatmentSummaryStatusLabel(record: Pick<InstitutionTreatmentSummaryListItem, 'status'>) {
  return record.status === 'voided' ? '已作废' : '可作为运营依据';
}

function isTreatmentSummaryVoided(record: Pick<InstitutionTreatmentSummaryListItem, 'status' | 'voidedAt'>) {
  return record.status === 'voided' || Boolean(record.voidedAt);
}

function isTreatmentSummaryEdited(
  record: Pick<InstitutionTreatmentSummaryListItem, 'createdAt' | 'updatedAt'>,
) {
  return record.createdAt !== record.updatedAt;
}

function visibleTreatmentSummaryVoidErrorMessage(error: TenantBusinessClientError) {
  if (error.kind === 'unauthorized') return '请先登录';
  if (error.kind === 'forbidden') return '当前账号没有作废治疗摘要的权限';
  if (error.kind === 'not_found') return '治疗摘要不存在或不可见';
  if (error.kind === 'conflict') return error.message || '治疗摘要已作废';
  if (error.kind === 'service_unavailable') return '数据服务暂时不可用';
  if (error.kind === 'validation_error') {
    return error.message || '字段非法，请检查作废原因';
  }
  return error.message || '治疗摘要作废失败';
}

function validateVoidTreatmentSummaryForm(form: TreatmentSummaryVoidForm) {
  const reasonText = form.reasonText.trim();
  if (reasonText.length === 0) return '作废原因必须填写';
  if (reasonText.length > 120) return '作废原因最多 120 个字';
  if (!treatmentSummaryVoidReasonCodes.includes(form.reasonCode)) {
    return '作废原因分类不合法';
  }
  if (sensitiveVoidReasonPatterns.some((pattern) => pattern.test(reasonText.normalize('NFKC')))) {
    return '作废原因包含敏感信息，请改为短说明';
  }
  return null;
}

function safeTagList(tags: string[]) {
  return tags.length > 0 ? tags : ['未标记'];
}

function isTemplatePathSuggestion(suggestion: TreatmentFollowUpSuggestion) {
  return suggestion.ruleKey === 'template_path_followup';
}

function isTemplatePathTypeKey(tag: string): tag is TemplatePathTypeKey {
  return Object.prototype.hasOwnProperty.call(templatePathTypeLabels, tag);
}

function getTemplatePathTypeLabel(suggestion: TreatmentFollowUpSuggestion) {
  const templateKey = suggestion.tags.find(isTemplatePathTypeKey);

  return templateKey ? templatePathTypeLabels[templateKey] : '治疗项目路径模板';
}

function getTemplateHandlerRoleLabel(suggestion: TreatmentFollowUpSuggestion) {
  return (
    suggestion.tags.find((tag) => templateHandlerRoleLabels.has(tag)) ??
    '人工确认后分配'
  );
}

function findActiveSourceTask(
  tasks: TenantFollowUpTask[],
  suggestion: TreatmentFollowUpSuggestion,
) {
  return tasks.find(
    (task) =>
      task.source === 'treatment_summary' &&
      task.sourceTreatmentSummaryId === suggestion.sourceTreatmentSummaryId &&
      task.sourceSuggestionKey === suggestion.suggestionKey &&
      activeFollowUpStatuses.has(task.status),
  );
}

function SummaryField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
      {label}：{displayValue(value)}
    </span>
  );
}

function TreatmentSummaryDetailDialog({
  onClose,
  onRecordUpdated,
  record,
}: {
  onClose: () => void;
  onRecordUpdated: (record: InstitutionTreatmentSummaryListItem) => void;
  record: InstitutionTreatmentSummaryListItem;
}) {
  const [detailRecord, setDetailRecord] = useState(record);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [editForm, setEditForm] = useState<TreatmentSummaryEditForm>(() =>
    recordToEditForm(record),
  );
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editMessage, setEditMessage] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isVoidFormOpen, setIsVoidFormOpen] = useState(false);
  const [voidForm, setVoidForm] = useState<TreatmentSummaryVoidForm>(
    emptyTreatmentSummaryVoidForm,
  );
  const [isSubmittingVoid, setIsSubmittingVoid] = useState(false);
  const [voidMessage, setVoidMessage] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);
  const [followUpSuggestions, setFollowUpSuggestions] = useState<TreatmentFollowUpSuggestion[]>(
    [],
  );
  const [sourceFollowUpTasks, setSourceFollowUpTasks] = useState<TenantFollowUpTask[]>([]);
  const [suggestionStatus, setSuggestionStatus] = useState<
    'idle' | 'loading' | 'loaded' | 'error'
  >('idle');
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [creatingSuggestionKey, setCreatingSuggestionKey] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    setDetailRecord(record);
    setEditForm(recordToEditForm(record));
  }, [record]);

  const isVoided = isTreatmentSummaryVoided(detailRecord);

  const rows = [
    ['摘要 ID', detailRecord.id],
    ['客户 ID', detailRecord.customerId],
    ['预约 ID', detailRecord.appointmentId ?? '-'],
    ['状态', treatmentSummaryStatusLabel(detailRecord)],
    ['治疗时间', formatBusinessDateTime(detailRecord.treatmentDate)],
    ['治疗项目', detailRecord.treatmentProject],
    ['治疗类别', detailRecord.treatmentCategory],
    ['治疗阶段', detailRecord.treatmentStage],
    ['恢复阶段', detailRecord.recoveryStage],
    ['风险等级', followUpRiskLevelLabels[detailRecord.riskLevel]],
    ['负责人', detailRecord.ownerUserId],
    ['摘要', detailRecord.summary],
    ['下一步护理建议', detailRecord.nextCareAction],
    ['标签', safeTagList(detailRecord.tags).join('、')],
    ...(isVoided
      ? ([
          ['作废时间', detailRecord.voidedAt ? formatBusinessDateTime(detailRecord.voidedAt) : '-'],
          ['作废人', detailRecord.voidedBy ?? '-'],
          ['作废原因', detailRecord.voidReason ?? '-'],
        ] as const)
      : []),
    ['创建时间', formatBusinessDateTime(detailRecord.createdAt)],
    ['更新时间', formatBusinessDateTime(detailRecord.updatedAt)],
  ] as const;

  useEffect(() => {
    let isActive = true;

    async function loadVoidedSourceTasks() {
      if (!isVoided) return;
      const result = await listFollowUpTasks({
        source: 'treatment_summary',
        sourceTreatmentSummaryId: detailRecord.id,
      });
      if (!isActive) return;
      setSourceFollowUpTasks(result.ok ? result.records : []);
    }

    void loadVoidedSourceTasks();

    return () => {
      isActive = false;
    };
  }, [detailRecord.id, isVoided]);

  function handleEditFieldChange(
    key: keyof TreatmentSummaryEditForm,
    value: string,
  ) {
    setEditForm((current) => ({ ...current, [key]: value }));
  }

  function handleOpenEditForm() {
    setEditForm(recordToEditForm(detailRecord));
    setEditMessage(null);
    setIsEditFormOpen(true);
  }

  function handleOpenVoidForm() {
    setVoidForm(emptyTreatmentSummaryVoidForm);
    setVoidMessage(null);
    setIsVoidFormOpen(true);
  }

  function handleVoidFieldChange<Key extends keyof TreatmentSummaryVoidForm>(
    key: Key,
    value: TreatmentSummaryVoidForm[Key],
  ) {
    setVoidForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmitVoid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateVoidTreatmentSummaryForm(voidForm);
    if (validationError) {
      setVoidMessage({ kind: 'error', text: validationError });
      return;
    }

    setIsSubmittingVoid(true);
    setVoidMessage(null);

    const payload: VoidTreatmentSummaryClientPayload = {
      reasonCode: voidForm.reasonCode,
      reasonText: voidForm.reasonText.trim(),
    };
    const result = await voidTreatmentSummary(detailRecord.id, payload);

    if (result.ok) {
      const nextRecord: InstitutionTreatmentSummaryListItem = {
        ...detailRecord,
        ...result.record,
        customerId: detailRecord.customerId,
      };
      setDetailRecord(nextRecord);
      setIsVoidFormOpen(false);
      setVoidMessage({ kind: 'success', text: '治疗摘要已作废' });
      onRecordUpdated(nextRecord);
    } else {
      setVoidMessage({
        kind: 'error',
        text: visibleTreatmentSummaryVoidErrorMessage(result.error),
      });
    }

    setIsSubmittingVoid(false);
  }

  async function handleSubmitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingEdit(true);
    setEditMessage(null);

    const result = await updateTreatmentSummary(
      detailRecord.id,
      formToUpdateTreatmentSummaryPayload(editForm),
    );

    if (result.ok) {
      const nextRecord: InstitutionTreatmentSummaryListItem = {
        ...detailRecord,
        ...result.record,
        customerId: detailRecord.customerId,
      };
      setDetailRecord(nextRecord);
      setEditForm(recordToEditForm(nextRecord));
      setEditMessage({ kind: 'success', text: '治疗摘要已更新' });
      onRecordUpdated(nextRecord);
    } else {
      setEditMessage({
        kind: 'error',
        text: visibleTreatmentSummaryEditErrorMessage(result.error),
      });
    }

    setIsSubmittingEdit(false);
  }

  async function handleLoadFollowUpSuggestions() {
    if (isVoided) {
      setSuggestionStatus('error');
      setSuggestionError('治疗摘要已作废，不能继续生成随访建议或来源随访任务。');
      setFollowUpSuggestions([]);
      return;
    }

    setSuggestionStatus('loading');
    setSuggestionError(null);
    setCreateMessage(null);
    setSourceFollowUpTasks([]);

    const [suggestionsResult, sourceTasksResult] = await Promise.all([
      listTreatmentFollowUpSuggestions(detailRecord.id),
      listFollowUpTasks({
        source: 'treatment_summary',
        sourceTreatmentSummaryId: detailRecord.id,
      }),
    ]);

    if (suggestionsResult.ok) {
      setFollowUpSuggestions(suggestionsResult.suggestions);
      setSourceFollowUpTasks(sourceTasksResult.ok ? sourceTasksResult.records : []);
      setSuggestionStatus('loaded');
      return;
    }

    setFollowUpSuggestions([]);
    setSourceFollowUpTasks([]);
    setSuggestionError(suggestionsResult.error.message);
    setSuggestionStatus('error');
  }

  async function handleCreateFollowUpTask(suggestion: TreatmentFollowUpSuggestion) {
    if (isVoided) {
      setCreateMessage({
        kind: 'error',
        text: '治疗摘要已作废，不能继续创建来源随访任务。',
      });
      return;
    }

    setCreatingSuggestionKey(suggestion.suggestionKey);
    setCreateMessage(null);

    const result = await createFollowUpTaskFromTreatmentSummary(detailRecord.id, {
      suggestionKey: suggestion.suggestionKey,
    });

    if (result.ok) {
      setCreateMessage({ kind: 'success', text: '已创建内部随访任务' });
    } else {
      setCreateMessage({ kind: 'error', text: result.error.message });
    }

    setCreatingSuggestionKey(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 px-3 py-4 backdrop-blur-sm sm:items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="治疗摘要安全详情"
        className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.24)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-blue-600">安全详情</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-950">
              {detailRecord.treatmentProject}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              展示结构化摘要，不展示原始诊疗内容或隐私原文。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={cn(
                  'inline-flex h-9 items-center justify-center rounded-full border px-3 text-sm font-semibold',
                  isVoided
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700',
                )}
              >
                {treatmentSummaryStatusLabel(detailRecord)}
              </span>
              {!isVoided && isTreatmentSummaryEdited(detailRecord) ? (
                <span className="inline-flex h-9 items-center justify-center rounded-full border border-blue-100 bg-blue-50 px-3 text-sm font-semibold text-blue-700">
                  已编辑
                </span>
              ) : null}
              <button
                type="button"
                onClick={handleOpenEditForm}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
              >
                <Pencil className="h-4 w-4" />
                编辑治疗摘要
              </button>
              {!isVoided ? (
                <button
                  type="button"
                  onClick={handleOpenVoidForm}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                >
                  <Ban className="h-4 w-4" />
                  作废治疗摘要
                </button>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭安全详情"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[68vh] overflow-y-auto">
          {isVoided ? (
            <div className="mx-5 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
              <p>作废不是删除。</p>
              <p>该治疗摘要已作废，仅保留历史追溯。</p>
              <p>作废摘要不会继续生成新的随访建议或来源随访任务。</p>
              <p>已存在的来源随访任务不会被自动取消，仍保留来源追溯。</p>
              <p>系统不会主动向客户发送消息。</p>
            </div>
          ) : null}

          {voidMessage ? (
            <div
              className={cn(
                'mx-5 mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold',
                voidMessage.kind === 'success'
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                  : 'border-rose-100 bg-rose-50 text-rose-700',
              )}
            >
              {voidMessage.text}
            </div>
          ) : null}

          <dl className="grid gap-3 px-5 py-5 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div
                key={label}
                className={cn(
                  'rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4',
                  label === '摘要' || label === '下一步护理建议' ? 'sm:col-span-2' : '',
                )}
              >
                <dt className="text-xs font-semibold text-slate-500">{label}</dt>
                <dd className="mt-2 break-words text-sm font-semibold leading-6 text-slate-800">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {isVoidFormOpen ? (
            <section className="border-t border-slate-100 px-5 py-5">
              <form
                role="form"
                aria-label="作废治疗摘要表单"
                className="rounded-2xl border border-amber-100 bg-amber-50/45 p-4"
                onSubmit={handleSubmitVoid}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-slate-950">
                      作废治疗摘要
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      作废不是删除，记录会保留历史追溯；作废后不再作为后续运营依据，也不会主动向客户发送消息。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsVoidFormOpen(false);
                      setVoidMessage(null);
                      setVoidForm(emptyTreatmentSummaryVoidForm);
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600"
                  >
                    取消作废
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-600">
                    作废原因分类
                    <select
                      value={voidForm.reasonCode}
                      onChange={(event) =>
                        handleVoidFieldChange(
                          'reasonCode',
                          event.target.value as TreatmentSummaryVoidReasonCode,
                        )
                      }
                      className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-amber-300"
                    >
                      {treatmentSummaryVoidReasonCodes.map((code) => (
                        <option key={code} value={code}>
                          {voidReasonCodeLabels[code]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-600 md:col-span-2">
                    作废原因说明
                    <textarea
                      value={voidForm.reasonText}
                      onChange={(event) =>
                        handleVoidFieldChange('reasonText', event.target.value)
                      }
                      rows={3}
                      maxLength={120}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-amber-300"
                    />
                  </label>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmittingVoid}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isSubmittingVoid ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    确认作废
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {isEditFormOpen ? (
            <section className="border-t border-slate-100 px-5 py-5">
              <form
                role="form"
                aria-label="编辑治疗摘要表单"
                className="rounded-2xl border border-blue-100 bg-blue-50/45 p-4"
                onSubmit={handleSubmitEdit}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-slate-950">
                      编辑治疗摘要
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      编辑治疗摘要不会自动修改既有随访任务，也不会重新生成随访建议。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditFormOpen(false);
                      setEditMessage(null);
                      setEditForm(recordToEditForm(detailRecord));
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600"
                  >
                    取消编辑
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-600">
                    治疗时间
                    <input
                      type="datetime-local"
                      value={editForm.treatmentDate}
                      onChange={(event) =>
                        handleEditFieldChange('treatmentDate', event.target.value)
                      }
                      className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-600">
                    治疗项目
                    <input
                      value={editForm.treatmentProject}
                      onChange={(event) =>
                        handleEditFieldChange('treatmentProject', event.target.value)
                      }
                      className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-600">
                    治疗类别
                    <input
                      value={editForm.treatmentCategory}
                      onChange={(event) =>
                        handleEditFieldChange('treatmentCategory', event.target.value)
                      }
                      className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-600">
                    治疗阶段
                    <input
                      value={editForm.treatmentStage}
                      onChange={(event) =>
                        handleEditFieldChange('treatmentStage', event.target.value)
                      }
                      className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-600">
                    恢复阶段
                    <input
                      value={editForm.recoveryStage}
                      onChange={(event) =>
                        handleEditFieldChange('recoveryStage', event.target.value)
                      }
                      className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-600">
                    风险等级
                    <select
                      value={editForm.riskLevel}
                      onChange={(event) =>
                        handleEditFieldChange('riskLevel', event.target.value)
                      }
                      className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
                    >
                      {riskLevelOptions.map(([riskLevel, label]) => (
                        <option key={riskLevel} value={riskLevel}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-600">
                    负责人 ID
                    <input
                      value={editForm.ownerUserId}
                      onChange={(event) =>
                        handleEditFieldChange('ownerUserId', event.target.value)
                      }
                      className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-600">
                    预约 ID
                    <input
                      value={editForm.appointmentId}
                      onChange={(event) =>
                        handleEditFieldChange('appointmentId', event.target.value)
                      }
                      className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-600 md:col-span-2">
                    摘要
                    <textarea
                      value={editForm.summary}
                      onChange={(event) =>
                        handleEditFieldChange('summary', event.target.value)
                      }
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-600 md:col-span-2">
                    下一步护理建议
                    <textarea
                      value={editForm.nextCareAction}
                      onChange={(event) =>
                        handleEditFieldChange('nextCareAction', event.target.value)
                      }
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-600 md:col-span-2">
                    标签
                    <input
                      value={editForm.tagsText}
                      onChange={(event) =>
                        handleEditFieldChange('tagsText', event.target.value)
                      }
                      className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
                    />
                  </label>
                </div>

                {editMessage ? (
                  <div
                    className={cn(
                      'mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold',
                      editMessage.kind === 'success'
                        ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                        : 'border-rose-100 bg-rose-50 text-rose-700',
                    )}
                  >
                    {editMessage.text}
                  </div>
                ) : null}

                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmittingEdit}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isSubmittingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    保存编辑
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          <section className="border-t border-slate-100 px-5 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-950">
                  治疗后护理随访建议
                </h4>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  建议仅供机构内部参考，需要人工确认后才会创建内部随访任务。
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  建议 key 用于来源追踪和避免重复创建。
                </p>
              </div>
              <button
                type="button"
                onClick={handleLoadFollowUpSuggestions}
                disabled={suggestionStatus === 'loading'}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {suggestionStatus === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ClipboardList className="h-4 w-4" />
                )}
                查看随访建议
              </button>
            </div>

            {suggestionStatus === 'error' && suggestionError ? (
              <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {suggestionError}
              </div>
            ) : null}

            {createMessage ? (
              <div
                className={cn(
                  'mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold',
                  createMessage.kind === 'success'
                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                    : 'border-rose-100 bg-rose-50 text-rose-700',
                )}
              >
                {createMessage.text}
              </div>
            ) : null}

            {isVoided && sourceFollowUpTasks.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>来源治疗摘要已作废</span>
                </div>
                <p className="mt-1">
                  既有来源随访任务仍保留，不会自动取消或修改任务状态。
                </p>
              </div>
            ) : null}

            {suggestionStatus === 'loaded' && followUpSuggestions.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                暂无可创建的随访建议
              </div>
            ) : null}

            {followUpSuggestions.length > 0 ? (
              <div className="mt-4 space-y-3">
                {followUpSuggestions.map((suggestion) => {
                  const activeSourceTask = findActiveSourceTask(
                    sourceFollowUpTasks,
                    suggestion,
                  );
                  const isTemplateSuggestion = isTemplatePathSuggestion(suggestion);

                  return (
                    <article
                      key={suggestion.suggestionKey}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h5 className="text-sm font-semibold text-slate-950">
                              {suggestion.title}
                            </h5>
                            <span
                              className={cn(
                                'rounded-full border px-2.5 py-1 text-xs font-semibold',
                                suggestionPriorityToneClasses[suggestion.priority],
                              )}
                            >
                              优先级：{suggestionPriorityLabels[suggestion.priority]}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {suggestion.description}
                          </p>
                          {isTemplateSuggestion ? (
                            <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-3 py-3 text-xs font-semibold leading-5 text-blue-800">
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1">
                                  路径模板建议
                                </span>
                                <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1">
                                  来源：治疗项目路径模板
                                </span>
                                <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1">
                                  路径类型：{getTemplatePathTypeLabel(suggestion)}
                                </span>
                                <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1">
                                  建议处理角色：{getTemplateHandlerRoleLabel(suggestion)}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 text-blue-700">
                                <span>系统只生成内部随访建议</span>
                                <span>人工确认后创建内部随访任务</span>
                                <span>禁止自动触达客户</span>
                                <span>不自动回复客户</span>
                                <span>不接 AI</span>
                              </div>
                            </div>
                          ) : null}
                          <p className="mt-2 text-xs font-semibold text-slate-500">
                            建议时间：{formatBusinessDateTime(suggestion.recommendedDueAt)}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-slate-500">
                            {suggestion.reason}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-slate-500">
                            建议 key 用于来源追踪和避免重复创建。
                          </p>
                          {activeSourceTask ? (
                            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
                              <p>该建议已有进行中的随访任务，请在智能随访中继续处理。</p>
                              <p className="mt-1">
                                活跃任务状态：{followUpStatusLabels[activeSourceTask.status]}
                              </p>
                            </div>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {safeTagList(suggestion.tags).map((tag) => (
                              <span
                                key={`${suggestion.suggestionKey}:${tag}`}
                                className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleCreateFollowUpTask(suggestion)}
                          disabled={
                            Boolean(activeSourceTask) ||
                            creatingSuggestionKey === suggestion.suggestionKey
                          }
                          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {creatingSuggestionKey === suggestion.suggestionKey ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          {activeSourceTask ? '已存在活跃随访任务' : '确认创建随访任务'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  );
}

export function TreatmentSummaryManagementShell() {
  const [records, setRecords] = useState<InstitutionTreatmentSummaryListItem[]>([]);
  const [pageInfo, setPageInfo] = useState<TreatmentSummaryListPageInfo | null>(null);
  const [form, setForm] = useState<TreatmentSummaryFilterForm>(
    emptyTreatmentSummaryFilterForm,
  );
  const [activeQuery, setActiveQuery] = useState<TreatmentSummaryListClientQuery>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorState, setErrorState] = useState<InstitutionPageStateProps | null>(null);
  const [selectedRecord, setSelectedRecord] =
    useState<InstitutionTreatmentSummaryListItem | null>(null);

  async function loadTreatmentSummaries(input: {
    query: TreatmentSummaryListClientQuery;
    mode: 'replace' | 'append';
  }) {
    const { mode, query } = input;
    if (mode === 'append') {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setErrorState(null);

    const result = await listTreatmentSummaries(query);

    if (result.ok) {
      setRecords((current) =>
        mode === 'append' ? [...current, ...result.records] : result.records,
      );
      setPageInfo(result.pageInfo);
    } else {
      if (mode === 'replace') {
        setRecords([]);
        setPageInfo(null);
      }
      setErrorState(visibleTreatmentSummaryErrorState(result.error));
    }

    if (mode === 'append') {
      setIsLoadingMore(false);
    } else {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isActive = true;

    async function loadInitialTreatmentSummaries() {
      setIsLoading(true);
      setErrorState(null);
      const result = await listTreatmentSummaries();

      if (!isActive) return;

      if (result.ok) {
        setRecords(result.records);
        setPageInfo(result.pageInfo);
      } else {
        setRecords([]);
        setPageInfo(null);
        setErrorState(visibleTreatmentSummaryErrorState(result.error));
      }

      setIsLoading(false);
    }

    void loadInitialTreatmentSummaries();

    return () => {
      isActive = false;
    };
  }, []);

  const riskCounts = useMemo(
    () =>
      riskLevelOptions.map(([riskLevel, label]) => ({
        riskLevel,
        label,
        count: records.filter((record) => record.riskLevel === riskLevel).length,
      })),
    [records],
  );

  function handleFieldChange(key: keyof TreatmentSummaryFilterForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = formToTreatmentSummaryQuery(form);
    setActiveQuery(nextQuery);
    void loadTreatmentSummaries({ query: nextQuery, mode: 'replace' });
  }

  function handleResetFilters() {
    setForm(emptyTreatmentSummaryFilterForm);
    setActiveQuery({});
    void loadTreatmentSummaries({ query: {}, mode: 'replace' });
  }

  function handleLoadMore() {
    if (!pageInfo?.nextCursor) return;
    void loadTreatmentSummaries({
      query: { ...activeQuery, cursor: pageInfo.nextCursor },
      mode: 'append',
    });
  }

  function handleTreatmentSummaryUpdated(record: InstitutionTreatmentSummaryListItem) {
    setSelectedRecord(record);
    setRecords((current) =>
      current.map((item) => (item.id === record.id ? { ...item, ...record } : item)),
    );
    void loadTreatmentSummaries({ query: activeQuery, mode: 'replace' });
  }

  return (
    <section className="space-y-5">
      <InstitutionSectionHeader
        eyebrow="治疗摘要"
        title="治疗摘要管理"
        description="集中查看治疗后结构化摘要，区分可作为运营依据、已编辑和已作废状态，并把随访建议交给人工确认。"
        tone="blue"
        action={
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
            <ShieldCheck className="h-4 w-4" />
            当前机构只读
          </div>
        }
      />

      <form
        className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl"
        onSubmit={handleApplyFilters}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-blue-50 text-blue-600">
              <Filter className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-950">筛选</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                仅按客户、治疗项目、风险等级和时间范围筛选。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600"
            >
              重置筛选
            </button>
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-slate-950 px-3 text-sm font-semibold text-white"
            >
              <Search className="h-4 w-4" />
              应用筛选
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm font-semibold text-slate-600">
            客户 ID
            <input
              value={form.customerId}
              onChange={(event) => handleFieldChange('customerId', event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
            />
          </label>
          <label className="text-sm font-semibold text-slate-600">
            治疗项目
            <input
              value={form.treatmentProject}
              onChange={(event) => handleFieldChange('treatmentProject', event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
            />
          </label>
          <label className="text-sm font-semibold text-slate-600">
            风险等级
            <select
              value={form.riskLevel}
              onChange={(event) => handleFieldChange('riskLevel', event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
            >
              <option value="">全部</option>
              {riskLevelOptions.map(([riskLevel, label]) => (
                <option key={riskLevel} value={riskLevel}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-600">
            开始时间
            <input
              type="datetime-local"
              value={form.from}
              onChange={(event) => handleFieldChange('from', event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
            />
          </label>
          <label className="text-sm font-semibold text-slate-600">
            结束时间
            <input
              type="datetime-local"
              value={form.to}
              onChange={(event) => handleFieldChange('to', event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
            />
          </label>
        </div>
      </form>

      <section className="grid gap-4 md:grid-cols-3">
        {riskCounts.map((item) => (
          <article
            key={item.riskLevel}
            className={cn(
              'rounded-[22px] border p-4 shadow-sm',
              riskLevelToneClasses[item.riskLevel],
            )}
          >
            <div className="text-xs font-semibold opacity-80">{item.label}</div>
            <div className="mt-2 text-2xl font-semibold">{isLoading ? '--' : item.count}</div>
          </article>
        ))}
      </section>

      <article className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-white">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-950">治疗摘要列表</h3>
              <p className="mt-1 text-sm text-slate-500">按治疗时间倒序排列，展示结构化摘要而不是原始诊疗内容。</p>
            </div>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
            {pageInfo ? `limit ${pageInfo.limit}` : 'limit 默认'}
          </span>
        </div>

        {isLoading ? (
          <InstitutionPageState
            kind="loading"
            title="正在加载治疗摘要..."
            className="mt-4"
          />
        ) : null}

        {!isLoading && errorState ? (
          <InstitutionPageState {...errorState} className="mt-4" />
        ) : null}

        {!isLoading && !errorState && records.length === 0 ? (
          <InstitutionPageState
            kind="empty"
            title="暂无治疗摘要"
            description="当前筛选条件下没有可用于运营复盘的治疗摘要。"
            className="mt-4"
          />
        ) : null}

        {!isLoading && !errorState && records.length > 0 ? (
          <div className="mt-4 space-y-3">
            {records.map((record) => (
              <section
                key={record.id}
                className="rounded-2xl border border-slate-200/80 bg-white/86 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-slate-950">
                        {record.treatmentProject}
                      </span>
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs font-semibold',
                          riskLevelToneClasses[record.riskLevel],
                        )}
                      >
                        风险：{followUpRiskLevelLabels[record.riskLevel]}
                      </span>
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs font-semibold',
                          isTreatmentSummaryVoided(record)
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700',
                        )}
                      >
                        {isTreatmentSummaryVoided(record)
                          ? '已作废'
                          : treatmentSummaryStatusLabel(record)}
                      </span>
                      {!isTreatmentSummaryVoided(record) && isTreatmentSummaryEdited(record) ? (
                        <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          已编辑
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <SummaryField
                        label="治疗日期"
                        value={formatBusinessDateTime(record.treatmentDate)}
                      />
                      <SummaryField label="治疗类别" value={record.treatmentCategory} />
                      <SummaryField label="治疗阶段" value={record.treatmentStage} />
                      <SummaryField label="恢复阶段" value={record.recoveryStage} />
                      <SummaryField label="负责人" value={record.ownerUserId} />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      摘要：{displayValue(record.summary)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      下一步护理建议：{displayValue(record.nextCareAction)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {safeTagList(record.tags).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
                      <CalendarClock className="h-4 w-4" />
                      {formatBusinessDateTime(record.updatedAt)}
                    </div>
                    <button
                      type="button"
                      aria-label={`查看安全详情 ${record.id}`}
                      onClick={() => setSelectedRecord(record)}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      查看安全详情
                    </button>
                  </div>
                </div>
              </section>
            ))}

            {pageInfo?.hasMore && pageInfo.nextCursor ? (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  加载更多治疗摘要
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </article>

      {selectedRecord ? (
        <TreatmentSummaryDetailDialog
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onRecordUpdated={handleTreatmentSummaryUpdated}
        />
      ) : null}
    </section>
  );
}
