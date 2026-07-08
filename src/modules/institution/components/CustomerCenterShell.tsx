'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Eye, Loader2, Pencil, Search, ShieldCheck, Tags, UploadCloud } from 'lucide-react';
import {
  createCustomer,
  executeCustomerImport,
  getCustomerTimeline,
  listCustomers,
  previewCustomerImport,
  updateCustomer,
  type CreateCustomerClientPayload,
  type TenantBusinessClientError,
} from '@/modules/institution/client/tenant-business-client';
import {
  InstitutionPageState,
  getInstitutionPageStateFromClientError,
  type InstitutionPageStateProps,
} from '@/modules/institution/components/InstitutionPageState';
import { InstitutionSectionHeader } from '@/modules/institution/components/InstitutionSectionHeader';
import { CustomerTimelineDrawer } from '@/modules/institution/components/CustomerTimelineDrawer';
import {
  customerImportBoundary,
  lowSensitiveCustomerImportAllowedFields,
  type CustomerImportPreviewResult,
  type CustomerImportResult,
} from '@/modules/institution/domain/customer-import';
import type {
  CustomerLifecycleStage,
  CustomerPriority,
  CustomerRecordSummary,
} from '@/modules/institution/domain/customer-records';
import type { CustomerTimelineResponse } from '@/modules/institution/domain/customer-timeline';
import {
  buildCustomerSegmentStats,
  customerLifecycleLabels,
  customerPriorityLabels,
  type CustomerSegmentKey,
} from '@/modules/institution/domain/tenant-business-view-models';
import { cn } from '@/shared/utils/cn';

type CustomerFormState = {
  displayName: string;
  lifecycle: CustomerLifecycleStage;
  priority: CustomerPriority;
  ownerUserId: string;
  projectInterest: string;
  maskedPhone: string;
  maskedMedicalRecordNo: string;
  lastTouchSummary: string;
  nextAction: string;
  tagsText: string;
  gender: string;
  birthDate: string;
  referralSource: string;
  notes: string;
};

const emptyCustomerForm: CustomerFormState = {
  displayName: '',
  lifecycle: 'consulting',
  priority: 'observe',
  ownerUserId: '',
  projectInterest: '',
  maskedPhone: '',
  maskedMedicalRecordNo: '',
  lastTouchSummary: '',
  nextAction: '',
  tagsText: '',
  gender: '',
  birthDate: '',
  referralSource: '',
  notes: '',
};

const lifecycleOptions = Object.entries(customerLifecycleLabels) as [
  CustomerLifecycleStage,
  string,
][];

const priorityOptions = Object.entries(customerPriorityLabels) as [
  CustomerPriority,
  string,
][];

const segmentToneClasses: Record<CustomerSegmentKey, string> = {
  high_priority: 'border-blue-200 bg-blue-50 text-blue-700',
  post_care: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  repurchase_window: 'border-amber-200 bg-amber-50 text-amber-700',
  silent_reactivation: 'border-rose-200 bg-rose-50 text-rose-700',
};

const segmentTrendLabels: Record<CustomerSegmentKey, string> = {
  high_priority: 'API 客户',
  post_care: '脱敏摘要',
  repurchase_window: '运营分层',
  silent_reactivation: '待人工确认',
};

const customerBoundaryItems = [
  {
    title: '客户来自 API records',
    description: '无真实客户记录时保持空态，不使用前端虚拟客户填充业务列表。',
  },
  {
    title: '表单只提交白名单字段',
    description: '创建和更新仅发送展示名、分层、负责人、脱敏展示值、摘要、下一步动作与标签。',
  },
  {
    title: '低敏客户导入',
    description: '导入前必须预检字段白名单、失败原因和重复候选；不导入手机号、身份证、病历号或聊天记录。',
  },
  {
    title: '只展示脱敏标识',
    description: '手机号和病历号只使用脱敏展示值，不展示原始号码或完整咨询内容。',
  },
];

const defaultImportRowsText = JSON.stringify(
  [
    {
      customerDisplayName: '低敏客户A',
      customerAlias: 'A 客户',
      gender: '未指定',
      ageRange: '30-39',
      customerStage: 'consulting',
      treatmentProject: '皮肤管理',
      lastVisitDate: '2026-07-01',
      nextFollowUpDate: '2026-07-15',
      ownerEmployeeName: '咨询师A',
      ownerEmployeeRef: 'employee-ref-a',
      sourceChannel: '线下咨询低敏来源',
      tagSummary: '低敏标签',
      noteSummary: '仅导入低敏摘要',
      externalCustomerRef: 'external-ref-low-sensitive-a',
      importedCustomerRef: 'import-ref-a',
    },
  ],
  null,
  2,
);

function countDigits(value: string) {
  return value.match(/\p{Decimal_Number}/gu)?.length ?? 0;
}

function containsRawPersonalInfo(value: string) {
  const normalized = value.normalize('NFKC');
  if (countDigits(normalized) >= 11) {
    return true;
  }

  return (
    /(?:\bmr\b|病历号|病歷號|medical\s*record)[^\n\r]{0,32}\p{Decimal_Number}/iu.test(
      normalized,
    ) ||
    /(?:身份证|身分證|id\s*(?:card|number))[^\n\r]{0,32}\p{Decimal_Number}/iu.test(
      normalized,
    )
  );
}

function isMaskedDisplayValue(key: 'maskedPhone' | 'maskedMedicalRecordNo', value: string) {
  const normalized = value.trim();
  if (/\p{Decimal_Number}{6,}/u.test(normalized) || /raw/i.test(normalized)) {
    return false;
  }

  const maxVisibleDigits = key === 'maskedPhone' ? 7 : 4;
  if (countDigits(normalized) > maxVisibleDigits) {
    return false;
  }

  if (normalized.includes('*')) {
    return true;
  }

  return (
    /^masked[-_][a-z][a-z0-9_-]*$/i.test(normalized) ||
    /^demo[-_][a-z][a-z0-9_-]*$/i.test(normalized)
  );
}

function toFormState(record: CustomerRecordSummary): CustomerFormState {
  return {
    displayName: record.displayName,
    lifecycle: record.lifecycle,
    priority: record.priority,
    ownerUserId: record.ownerUserId,
    projectInterest: record.projectInterest,
    maskedPhone: record.maskedPhone,
    maskedMedicalRecordNo: record.maskedMedicalRecordNo,
    lastTouchSummary: record.lastTouchSummary,
    nextAction: record.nextAction,
    tagsText: record.tags.join(', '),
    gender: record.gender,
    birthDate: record.birthDate,
    referralSource: record.referralSource,
    notes: record.notes,
  };
}

function splitTags(tagsText: string) {
  return tagsText
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function toCustomerPayload(form: CustomerFormState): CreateCustomerClientPayload {
  return {
    displayName: form.displayName.trim(),
    lifecycle: form.lifecycle,
    priority: form.priority,
    ownerUserId: form.ownerUserId.trim(),
    projectInterest: form.projectInterest.trim(),
    maskedPhone: form.maskedPhone.trim(),
    maskedMedicalRecordNo: form.maskedMedicalRecordNo.trim(),
    lastTouchSummary: form.lastTouchSummary.trim(),
    nextAction: form.nextAction.trim(),
    tags: splitTags(form.tagsText),
    gender: form.gender.trim(),
    birthDate: form.birthDate.trim(),
    referralSource: form.referralSource.trim(),
    notes: form.notes.trim(),
  };
}

function validateCustomerPayload(payload: CreateCustomerClientPayload) {
  const requiredFields: Array<[keyof CreateCustomerClientPayload, string]> = [
    ['displayName', '客户姓名'],
    ['ownerUserId', '负责人 ID'],
    ['projectInterest', '项目兴趣'],
    ['maskedPhone', '脱敏手机号展示值'],
    ['maskedMedicalRecordNo', '脱敏病历号展示值'],
    ['lastTouchSummary', '最近触达摘要'],
    ['nextAction', '下一步动作'],
  ];

  for (const [key, label] of requiredFields) {
    if (typeof payload[key] !== 'string' || String(payload[key]).trim().length === 0) {
      return `字段 ${label} 必须填写`;
    }
  }

  if (!isMaskedDisplayValue('maskedPhone', payload.maskedPhone)) {
    return '字段 maskedPhone 必须是脱敏展示值';
  }

  if (!isMaskedDisplayValue('maskedMedicalRecordNo', payload.maskedMedicalRecordNo)) {
    return '字段 maskedMedicalRecordNo 必须是脱敏展示值';
  }

  const piiFields = [
    payload.displayName,
    payload.ownerUserId,
    payload.projectInterest,
    payload.lastTouchSummary,
    payload.nextAction,
    ...payload.tags,
  ];

  if (piiFields.some(containsRawPersonalInfo)) {
    return '客户表单不允许提交原始个人信息';
  }

  return null;
}

function visibleListErrorState(error: TenantBusinessClientError): InstitutionPageStateProps {
  return getInstitutionPageStateFromClientError(error, {
    forbiddenMessage: '当前账号没有访问客户数据的权限',
    fallbackMessage: '客户运营视图暂时无法加载',
    unavailableMessage: '数据服务暂时不可用，请稍后刷新或切换演示备份',
  });
}

function visibleTimelineErrorState(error: TenantBusinessClientError): InstitutionPageStateProps {
  if (error.kind === 'unauthorized') {
    return {
      kind: 'error',
      title: '登录状态已失效，请重新登录',
    };
  }

  if (error.kind === 'forbidden') {
    return {
      kind: 'forbidden',
      title: '当前账号没有访问客户详情的权限',
    };
  }

  if (error.kind === 'not_found') {
    return {
      kind: 'error',
      title: '客户不存在或不属于当前租户',
    };
  }

  if (error.kind === 'service_unavailable') {
    return {
      kind: 'unavailable',
      title: '数据服务暂时不可用',
    };
  }

  return {
    kind: 'error',
    title: '客户详情请求失败',
  };
}

function visibleErrorMessage(error: TenantBusinessClientError) {
  if (error.kind === 'unauthorized') {
    return '登录状态已失效，请重新登录';
  }

  if (error.kind === 'forbidden') {
    return '当前账号没有访问客户数据的权限';
  }

  if (error.kind === 'service_unavailable') {
    return '数据服务暂时不可用';
  }

  return error.message || '客户数据请求失败';
}

const importFailureReasonLabels: Record<string, string> = {
  missing_required_field: '必填字段缺失',
  unsupported_field: '字段不在白名单',
  sensitive_field_detected: '识别到高敏字段或高敏内容',
  invalid_date: '日期格式错误',
  duplicated_customer: '重复客户候选',
  empty_row: '空行',
  unsafe_payload: '嵌套或不安全 payload',
};

function parseImportRowsText(value: string) {
  try {
    const rows = JSON.parse(value) as unknown;
    if (!Array.isArray(rows)) {
      return { ok: false as const, error: '导入内容必须是 JSON 数组' };
    }

    return { ok: true as const, rows };
  } catch {
    return { ok: false as const, error: '导入内容必须是合法 JSON' };
  }
}

function collectImportIssues(preview: CustomerImportPreviewResult | null) {
  if (!preview) return [];

  return preview.importBatch.rows
    .filter((row) => row.issues.length > 0)
    .flatMap((row) =>
      row.issues.map((issue) => ({
        ...issue,
        rowNumber: row.rowNumber,
      })),
    );
}

function formatImportReason(reason: string) {
  return importFailureReasonLabels[reason] ?? reason;
}

export function CustomerCenterShell() {
  const [customers, setCustomers] = useState<CustomerRecordSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listErrorState, setListErrorState] = useState<InstitutionPageStateProps | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerFormState>(emptyCustomerForm);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importRowsText, setImportRowsText] = useState(defaultImportRowsText);
  const [importPreview, setImportPreview] = useState<CustomerImportPreviewResult | null>(null);
  const [importResult, setImportResult] = useState<CustomerImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedTimelineCustomer, setSelectedTimelineCustomer] =
    useState<CustomerRecordSummary | null>(null);
  const [customerTimeline, setCustomerTimeline] = useState<CustomerTimelineResponse | null>(null);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [timelineErrorState, setTimelineErrorState] =
    useState<InstitutionPageStateProps | null>(null);
  const timelineRequestIdRef = useRef(0);

  useEffect(() => {
    let isActive = true;

    async function loadCustomerRecords() {
      setIsLoading(true);
      setListErrorState(null);
      const result = await listCustomers();

      if (!isActive) return;

      if (result.ok) {
        setCustomers(result.records);
      } else {
        setCustomers([]);
        setListErrorState(visibleListErrorState(result.error));
      }

      setIsLoading(false);
    }

    void loadCustomerRecords();

    return () => {
      isActive = false;
    };
  }, []);

  const segmentStats = useMemo(() => buildCustomerSegmentStats(customers), [customers]);
  const importIssues = useMemo(() => collectImportIssues(importPreview), [importPreview]);
  const importedCustomerCount = importResult?.importedCustomerIds.length ?? 0;

  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return customers;

    return customers.filter((customer) =>
      [
        customer.displayName,
        customer.ownerUserId,
        customer.projectInterest,
        customer.lastTouchSummary,
        customer.nextAction,
        customer.maskedPhone,
        customer.maskedMedicalRecordNo,
        ...customer.tags,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [customers, searchQuery]);

  function updateFormField<Key extends keyof CustomerFormState>(
    key: Key,
    value: CustomerFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startEditing(customer: CustomerRecordSummary) {
    setEditingCustomerId(customer.id);
    setForm(toFormState(customer));
    setSubmitError(null);
  }

  function resetForm() {
    setEditingCustomerId(null);
    setForm(emptyCustomerForm);
    setSubmitError(null);
  }

  async function openCustomerTimeline(customer: CustomerRecordSummary) {
    const requestId = timelineRequestIdRef.current + 1;
    timelineRequestIdRef.current = requestId;
    setSelectedTimelineCustomer(customer);
    setCustomerTimeline(null);
    setTimelineErrorState(null);
    setIsTimelineLoading(true);

    const result = await getCustomerTimeline(customer.id);
    if (timelineRequestIdRef.current !== requestId) return;

    if (result.ok) {
      setCustomerTimeline(result.timeline);
    } else {
      setTimelineErrorState(visibleTimelineErrorState(result.error));
    }

    setIsTimelineLoading(false);
  }

  async function refreshCustomerTimeline(customerId: string) {
    const requestId = timelineRequestIdRef.current + 1;
    timelineRequestIdRef.current = requestId;
    setTimelineErrorState(null);

    const result = await getCustomerTimeline(customerId);
    if (timelineRequestIdRef.current !== requestId) return;

    if (result.ok) {
      setCustomerTimeline(result.timeline);
    } else {
      setTimelineErrorState(visibleTimelineErrorState(result.error));
    }
  }

  async function reloadCustomersAfterImport() {
    const result = await listCustomers();
    if (result.ok) {
      setCustomers(result.records);
      setListErrorState(null);
    } else {
      setListErrorState(visibleListErrorState(result.error));
    }
  }

  async function handlePreviewCustomerImport() {
    const parsed = parseImportRowsText(importRowsText);
    if (!parsed.ok) {
      setImportError(parsed.error);
      return;
    }

    setIsImporting(true);
    setImportError(null);
    setImportResult(null);

    const result = await previewCustomerImport({ rows: parsed.rows });
    if (result.ok) {
      setImportPreview(result.preview);
    } else {
      setImportError(visibleErrorMessage(result.error));
    }

    setIsImporting(false);
  }

  async function handleExecuteCustomerImport() {
    const parsed = parseImportRowsText(importRowsText);
    if (!parsed.ok) {
      setImportError(parsed.error);
      return;
    }

    setIsImporting(true);
    setImportError(null);

    const result = await executeCustomerImport({ rows: parsed.rows });
    if (result.ok) {
      setImportPreview(result.result);
      setImportResult(result.result);
      await reloadCustomersAfterImport();
    } else {
      setImportError(visibleErrorMessage(result.error));
    }

    setIsImporting(false);
  }

  function closeCustomerTimeline() {
    timelineRequestIdRef.current += 1;
    setSelectedTimelineCustomer(null);
    setCustomerTimeline(null);
    setTimelineErrorState(null);
    setIsTimelineLoading(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = toCustomerPayload(form);
    const validationError = validateCustomerPayload(payload);
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const result = editingCustomerId
      ? await updateCustomer({ id: editingCustomerId, ...payload })
      : await createCustomer(payload);

    if (result.ok) {
      setCustomers((current) => {
        if (!editingCustomerId) {
          return [result.record, ...current];
        }

        return current.map((customer) =>
          customer.id === result.record.id ? result.record : customer,
        );
      });
      resetForm();
    } else {
      setSubmitError(visibleErrorMessage(result.error));
    }

    setIsSubmitting(false);
  }

  return (
    <section className="space-y-5">
      <InstitutionSectionHeader
        eyebrow="客户运营"
        title="客户中心"
        description="客户、预约、随访任务统一进入运营视图。这里仅展示 API 返回的脱敏客户摘要、负责人、优先级和下一步动作。"
        action={
          <label className="relative block w-full lg:w-[320px]" aria-label="客户搜索">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none placeholder:text-slate-400"
              placeholder="搜索客户、标签或负责人"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {segmentStats.map((segment) => (
          <article
            key={segment.key}
            className="rounded-[22px] border border-white/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl"
          >
            <div
              className={cn(
                'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                segmentToneClasses[segment.key],
              )}
            >
              {segmentTrendLabels[segment.key]}
            </div>
            <div className="mt-4 text-3xl font-semibold text-slate-950">
              {isLoading ? '--' : segment.count}
            </div>
            <div className="mt-1 text-sm font-medium text-slate-500">{segment.label}</div>
          </article>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-950">客户优先级队列</h3>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
              API 数据
            </span>
          </div>

          {isLoading ? (
            <InstitutionPageState
              kind="loading"
              title="正在加载客户数据..."
              className="mt-4"
            />
          ) : null}

          {!isLoading && listErrorState ? (
            <InstitutionPageState {...listErrorState} className="mt-4" />
          ) : null}

          {!isLoading && !listErrorState && filteredCustomers.length === 0 ? (
            <InstitutionPageState
              kind="empty"
              title="暂无客户记录"
              description="当前没有可展示的客户旅程记录，可先创建只包含脱敏展示字段的客户摘要。"
              className="mt-4"
            />
          ) : null}

          {!isLoading && !listErrorState && filteredCustomers.length > 0 ? (
            <div className="mt-4 space-y-3">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="rounded-2xl border border-slate-200/80 bg-white/86 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-slate-950">
                          {customer.displayName}
                        </span>
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">
                          {customerPriorityLabels[customer.priority]}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                          生命周期：{customerLifecycleLabels[customer.lifecycle]}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        {customer.projectInterest} · {customer.lastTouchSummary}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {customer.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                        <span>脱敏手机号：{customer.maskedPhone}</span>
                        <span>脱敏病历号：{customer.maskedMedicalRecordNo}</span>
                      </div>
                    </div>
                    <div className="min-w-[220px] rounded-2xl bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-400">下一步动作</div>
                      <div className="mt-1 text-sm font-semibold leading-6 text-slate-800">
                        {customer.nextAction}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        负责人：{customer.ownerUserId}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700"
                          onClick={() => {
                            void openCustomerTimeline(customer);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          查看详情 {customer.displayName}
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                          onClick={() => startEditing(customer)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          编辑 {customer.displayName}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </article>

        <aside className="space-y-5">
          <form
            className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl"
            onSubmit={handleSubmit}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">
                  {editingCustomerId ? '编辑客户' : '新建客户'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">仅提交客户摘要白名单字段。</p>
              </div>
              {editingCustomerId ? (
                <button
                  type="button"
                  className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500"
                  onClick={resetForm}
                >
                  取消编辑
                </button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3">
              <div>
                <label htmlFor="customer-display-name" className="text-xs font-semibold text-slate-500">
                  客户姓名
                </label>
                <input
                  id="customer-display-name"
                  className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-300"
                  value={form.displayName}
                  onChange={(event) => updateFormField('displayName', event.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="customer-lifecycle" className="text-xs font-semibold text-slate-500">
                    生命周期
                  </label>
                  <select
                    id="customer-lifecycle"
                    className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-300"
                    value={form.lifecycle}
                    onChange={(event) =>
                      updateFormField('lifecycle', event.target.value as CustomerLifecycleStage)
                    }
                  >
                    {lifecycleOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="customer-priority" className="text-xs font-semibold text-slate-500">
                    优先级
                  </label>
                  <select
                    id="customer-priority"
                    className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-300"
                    value={form.priority}
                    onChange={(event) =>
                      updateFormField('priority', event.target.value as CustomerPriority)
                    }
                  >
                    {priorityOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="customer-owner" className="text-xs font-semibold text-slate-500">
                  负责人 ID
                </label>
                <input
                  id="customer-owner"
                  className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-300"
                  value={form.ownerUserId}
                  onChange={(event) => updateFormField('ownerUserId', event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="customer-project" className="text-xs font-semibold text-slate-500">
                  项目兴趣
                </label>
                <input
                  id="customer-project"
                  className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-300"
                  value={form.projectInterest}
                  onChange={(event) => updateFormField('projectInterest', event.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="customer-masked-phone" className="text-xs font-semibold text-slate-500">
                    脱敏手机号展示值
                  </label>
                  <input
                    id="customer-masked-phone"
                    className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-300"
                    value={form.maskedPhone}
                    onChange={(event) => updateFormField('maskedPhone', event.target.value)}
                  />
                </div>
                <div>
                  <label
                    htmlFor="customer-masked-record"
                    className="text-xs font-semibold text-slate-500"
                  >
                    脱敏病历号展示值
                  </label>
                  <input
                    id="customer-masked-record"
                    className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-300"
                    value={form.maskedMedicalRecordNo}
                    onChange={(event) =>
                      updateFormField('maskedMedicalRecordNo', event.target.value)
                    }
                  />
                </div>
              </div>

              <div>
                <label htmlFor="customer-last-touch" className="text-xs font-semibold text-slate-500">
                  最近触达摘要
                </label>
                <textarea
                  id="customer-last-touch"
                  className="mt-1 min-h-20 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  value={form.lastTouchSummary}
                  onChange={(event) => updateFormField('lastTouchSummary', event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="customer-next-action" className="text-xs font-semibold text-slate-500">
                  下一步动作
                </label>
                <textarea
                  id="customer-next-action"
                  className="mt-1 min-h-20 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  value={form.nextAction}
                  onChange={(event) => updateFormField('nextAction', event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="customer-tags" className="text-xs font-semibold text-slate-500">
                  客户标签
                </label>
                <input
                  id="customer-tags"
                  className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-300"
                  value={form.tagsText}
                  onChange={(event) => updateFormField('tagsText', event.target.value)}
                />
              </div>
            </div>

            {submitError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                {submitError}
              </div>
            ) : null}

            <button
              type="submit"
              className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={isSubmitting || Boolean(listErrorState)}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? '提交中...' : editingCustomerId ? '保存客户' : '创建客户'}
            </button>
          </form>

          <section className="rounded-[24px] border border-blue-100 bg-blue-50/70 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-950">低敏客户导入</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  当前只支持低敏客户数据 JSON 导入；导入前预检字段白名单、重复候选和失败原因，导入后记录审计并进入现有客户运营 / 智能随访低敏链路。
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 text-xs font-semibold text-blue-800 sm:grid-cols-2">
              <span className="rounded-full border border-blue-200 bg-white px-3 py-2">{customerImportBoundary.noHis ? '不接 HIS' : 'HIS 未开启'}</span>
              <span className="rounded-full border border-blue-200 bg-white px-3 py-2">{customerImportBoundary.noRealWeCom ? '不接真实企业微信' : '真实企业微信未开启'}</span>
              <span className="rounded-full border border-blue-200 bg-white px-3 py-2">不导入手机号 / 身份证 / 病历号</span>
              <span className="rounded-full border border-blue-200 bg-white px-3 py-2">{customerImportBoundary.noRealSend ? '不导入聊天记录 / 凭证 / 原始 payload' : '禁止真实发送'}</span>
            </div>

            <div className="mt-4 rounded-2xl border border-blue-100 bg-white p-3">
              <div className="text-xs font-semibold text-slate-500">字段白名单</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {lowSensitiveCustomerImportAllowedFields.map((field) => (
                  <span
                    key={field}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="customer-import-rows" className="text-xs font-semibold text-slate-500">
                导入 JSON 数组
              </label>
              <textarea
                id="customer-import-rows"
                className="mt-1 min-h-64 w-full rounded-2xl border border-blue-100 bg-white px-3 py-2 font-mono text-xs leading-5 text-slate-700 outline-none focus:border-blue-300"
                value={importRowsText}
                onChange={(event) => setImportRowsText(event.target.value)}
              />
            </div>

            {importError ? (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                {importError}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:text-slate-400"
                disabled={isImporting || Boolean(listErrorState)}
                onClick={() => {
                  void handlePreviewCustomerImport();
                }}
              >
                {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                导入预检
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={isImporting || Boolean(listErrorState) || !importPreview?.canExecute}
                onClick={() => {
                  void handleExecuteCustomerImport();
                }}
              >
                {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                执行合法行导入
              </button>
            </div>

            {importPreview ? (
              <div className="mt-4 space-y-3">
                <div className="grid gap-2 sm:grid-cols-4">
                  <div className="rounded-2xl bg-white p-3">
                    <div className="text-xs font-semibold text-slate-400">总行数</div>
                    <div className="mt-1 text-xl font-semibold text-slate-950">{importPreview.totalCount}</div>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <div className="text-xs font-semibold text-slate-400">可导入</div>
                    <div className="mt-1 text-xl font-semibold text-emerald-600">{importPreview.successCount}</div>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <div className="text-xs font-semibold text-slate-400">失败</div>
                    <div className="mt-1 text-xl font-semibold text-rose-600">{importPreview.failureCount}</div>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <div className="text-xs font-semibold text-slate-400">跳过</div>
                    <div className="mt-1 text-xl font-semibold text-amber-600">{importPreview.skippedCount}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-white p-3 text-sm text-slate-600">
                  <div className="font-semibold text-slate-950">导入批次</div>
                  <div className="mt-1 break-all font-mono text-xs text-slate-500">
                    {importPreview.importBatch.importBatchId}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    tenant / institution 隔离来自登录上下文，页面不会提交 tenantId、institutionId 或 operatorRef。
                  </div>
                </div>

                {importResult ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                    已写入 {importedCustomerCount} 条低敏客户记录，并记录导入审计。
                  </div>
                ) : null}

                {importIssues.length > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-white p-3">
                    <div className="text-sm font-semibold text-slate-950">失败原因</div>
                    <div className="mt-2 space-y-2">
                      {importIssues.map((issue, index) => (
                        <div
                          key={`${issue.rowNumber}-${issue.reason}-${issue.field ?? 'row'}-${index}`}
                          className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"
                        >
                          第 {issue.rowNumber} 行 · {formatImportReason(issue.reason)}
                          {issue.field ? ` · ${issue.field}` : ''}：{issue.message}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700">
                    当前预检未发现失败原因，可执行导入。
                  </div>
                )}
              </div>
            ) : null}
          </section>

          <div className="rounded-[24px] border border-slate-900/90 bg-[#071322] p-5 text-white shadow-[0_24px_80px_rgba(3,15,33,0.22)]">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-400/16 text-cyan-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">客户数据边界</h3>
                <p className="mt-1 text-sm text-slate-400">只展示脱敏客户摘要和下一步人工动作。</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {customerBoundaryItems.map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/8 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Tags className="h-4 w-4 text-cyan-300" />
                    {item.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950">
              当前只展示脱敏 API 数据
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </aside>
      </div>
      {selectedTimelineCustomer ? (
        <CustomerTimelineDrawer
          customerId={selectedTimelineCustomer.id}
          customerName={selectedTimelineCustomer.displayName}
          errorState={timelineErrorState}
          isLoading={isTimelineLoading}
          onClose={closeCustomerTimeline}
          onTimelineRefresh={() => refreshCustomerTimeline(selectedTimelineCustomer.id)}
          timeline={customerTimeline}
        />
      ) : null}
    </section>
  );
}
