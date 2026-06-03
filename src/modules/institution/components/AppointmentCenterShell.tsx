'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarCheck, Clock3, Loader2, ShieldCheck } from 'lucide-react';
import {
  createAppointment,
  listAppointments,
  listCustomers,
  updateAppointment,
  type CreateAppointmentClientPayload,
  type TenantBusinessClientError,
} from '@/modules/institution/client/tenant-business-client';
import {
  InstitutionPageState,
  getInstitutionPageStateFromClientError,
  type InstitutionPageStateProps,
} from '@/modules/institution/components/InstitutionPageState';
import { InstitutionSectionHeader } from '@/modules/institution/components/InstitutionSectionHeader';
import type {
  AppointmentRecordSummary,
  AppointmentStatus,
} from '@/modules/institution/domain/appointment-records';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';
import {
  appointmentStatusLabels,
  formatBusinessDateTime,
  groupAppointmentsByStatus,
} from '@/modules/institution/domain/tenant-business-view-models';

type AppointmentFormState = {
  customerId: string;
  project: string;
  scheduledAt: string;
  consultantUserId: string;
  status: AppointmentStatus;
  note: string;
};

const emptyAppointmentForm: AppointmentFormState = {
  customerId: '',
  project: '',
  scheduledAt: '',
  consultantUserId: '',
  status: 'pending_confirmation',
  note: '',
};

const statusOptions = Object.entries(appointmentStatusLabels) as [
  AppointmentStatus,
  string,
][];

const boundaryItems = [
  {
    title: '预约用于串联客户旅程',
    description: '预约数据用于串联客户旅程，不代表外部 HIS 已完成同步。',
    tone: 'blue',
  },
  {
    title: '客户来自当前客户列表',
    description: '创建预约时只能选择已加载客户，并由客户记录派生 customerDisplayName。',
    tone: 'emerald',
  },
  {
    title: '状态更新保持最小 payload',
    description: '预约状态流转只提交必要状态和备注，不提交扩展字段或原始个人信息。',
    tone: 'amber',
  },
] as const;

const boundaryToneClasses = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
};

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

function visibleErrorMessage(error: TenantBusinessClientError, resource: 'appointment' | 'customer') {
  if (error.kind === 'unauthorized') {
    return '登录状态已失效，请重新登录';
  }

  if (error.kind === 'forbidden') {
    return resource === 'appointment'
      ? '当前账号没有访问预约数据的权限'
      : '当前账号没有访问客户数据的权限';
  }

  if (error.kind === 'service_unavailable') {
    return '数据服务暂时不可用';
  }

  return error.message || '预约数据请求失败';
}

function visibleListErrorState(
  error: TenantBusinessClientError,
  resource: 'appointment' | 'customer',
): InstitutionPageStateProps {
  return getInstitutionPageStateFromClientError(error, {
    forbiddenMessage:
      resource === 'appointment'
        ? '当前账号没有访问预约数据的权限'
        : '当前账号没有访问客户数据的权限',
    fallbackMessage: resource === 'appointment' ? '预约数据请求失败' : '客户数据请求失败',
    unavailableMessage: '数据服务暂时不可用，请稍后刷新或切换演示备份',
  });
}

function toAppointmentPayload(
  form: AppointmentFormState,
  customers: CustomerRecordSummary[],
): CreateAppointmentClientPayload | { error: string } {
  const customer = customers.find((record) => record.id === form.customerId);
  if (!customer) {
    return { error: '请选择当前客户列表中的客户' };
  }

  const payload: CreateAppointmentClientPayload = {
    customerId: customer.id,
    customerDisplayName: customer.displayName,
    project: form.project.trim(),
    scheduledAt: form.scheduledAt.trim(),
    consultantUserId: form.consultantUserId.trim(),
    status: form.status,
    note: form.note.trim(),
  };

  const requiredFields: Array<[keyof CreateAppointmentClientPayload, string]> = [
    ['project', '预约项目'],
    ['scheduledAt', '预约时间'],
    ['consultantUserId', '顾问 ID'],
    ['note', '预约备注'],
  ];

  for (const [key, label] of requiredFields) {
    if (typeof payload[key] !== 'string' || String(payload[key]).trim().length === 0) {
      return { error: `字段 ${label} 必须填写` };
    }
  }

  if (
    [
      payload.customerDisplayName,
      payload.project,
      payload.consultantUserId,
      payload.note,
    ].some(containsRawPersonalInfo)
  ) {
    return { error: '预约表单不允许提交原始个人信息' };
  }

  return payload;
}

function validateStatusUpdate(input: { note: string }) {
  if (input.note.trim().length === 0) {
    return '字段 备注 必须填写';
  }

  if (containsRawPersonalInfo(input.note)) {
    return '预约状态更新不允许提交原始个人信息';
  }

  return null;
}

export function AppointmentCenterShell() {
  const [appointments, setAppointments] = useState<AppointmentRecordSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerRecordSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listErrorState, setListErrorState] = useState<InstitutionPageStateProps | null>(null);
  const [form, setForm] = useState<AppointmentFormState>(emptyAppointmentForm);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusErrors, setStatusErrors] = useState<Record<string, string>>({});
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadAppointmentCenterData() {
      setIsLoading(true);
      setListErrorState(null);

      const [appointmentResult, customerResult] = await Promise.all([
        listAppointments(),
        listCustomers(),
      ]);

      if (!isActive) return;

      if (!appointmentResult.ok) {
        setAppointments([]);
        setCustomers([]);
        setListErrorState(visibleListErrorState(appointmentResult.error, 'appointment'));
        setIsLoading(false);
        return;
      }

      if (!customerResult.ok) {
        setAppointments([]);
        setCustomers([]);
        setListErrorState(visibleListErrorState(customerResult.error, 'customer'));
        setIsLoading(false);
        return;
      }

      setAppointments(appointmentResult.records);
      setCustomers(customerResult.records);
      setIsLoading(false);
    }

    void loadAppointmentCenterData();

    return () => {
      isActive = false;
    };
  }, []);

  const groupedAppointments = useMemo(
    () => groupAppointmentsByStatus(appointments),
    [appointments],
  );

  function updateFormField<Key extends keyof AppointmentFormState>(
    key: Key,
    value: AppointmentFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleCreateAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = toAppointmentPayload(form, customers);
    if ('error' in payload) {
      setSubmitError(payload.error);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const result = await createAppointment(payload);
    if (result.ok) {
      setAppointments((current) => [result.record, ...current]);
      setForm(emptyAppointmentForm);
    } else {
      setSubmitError(visibleErrorMessage(result.error, 'appointment'));
    }

    setIsSubmitting(false);
  }

  async function handleStatusUpdate(
    event: FormEvent<HTMLFormElement>,
    appointment: AppointmentRecordSummary,
  ) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const status = String(data.get('status')) as AppointmentStatus;
    const note = String(data.get('note') ?? '').trim();
    const validationError = validateStatusUpdate({ note });

    if (validationError) {
      setStatusErrors((current) => ({ ...current, [appointment.id]: validationError }));
      return;
    }

    setUpdatingAppointmentId(appointment.id);
    setStatusErrors((current) => ({ ...current, [appointment.id]: '' }));

    const result = await updateAppointment({
      id: appointment.id,
      status,
      note,
    });

    if (result.ok) {
      setAppointments((current) =>
        current.map((record) => (record.id === result.record.id ? result.record : record)),
      );
      setStatusErrors((current) => ({ ...current, [appointment.id]: '' }));
    } else {
      setStatusErrors((current) => ({
        ...current,
        [appointment.id]: visibleErrorMessage(result.error, 'appointment'),
      }));
    }

    setUpdatingAppointmentId(null);
  }

  return (
    <section className="space-y-5">
      <InstitutionSectionHeader
        eyebrow="预约流转"
        title="预约中心"
        description="预约数据用于串联客户旅程，不代表外部 HIS 已完成同步。这里用于口头串起面诊、治疗、复诊、待确认和取消状态。"
        tone="emerald"
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {isLoading ? (
            <InstitutionPageState kind="loading" title="正在加载预约数据..." />
          ) : null}

          {!isLoading && listErrorState ? (
            <InstitutionPageState {...listErrorState} />
          ) : null}

          {!isLoading && !listErrorState && appointments.length === 0 ? (
            <InstitutionPageState
              kind="empty"
              title="暂无可串联的预约记录"
              description="当前没有预约可放入客户旅程，可从右侧选择演示客户创建预约摘要。"
            />
          ) : null}

          <div className="grid gap-4 xl:grid-cols-3">
            {groupedAppointments.map((group) => (
              <article
                key={group.status}
                className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">{group.label}</h3>
                    <p className="mt-1 text-sm text-slate-500">{group.count} 个预约</p>
                  </div>
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <CalendarCheck className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {!isLoading && !listErrorState && group.records.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-3 py-4 text-sm text-slate-400">
                      暂无{group.label}预约，可在演示中跳过该状态
                    </div>
                  ) : null}

                  {group.records.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="rounded-2xl border border-slate-200/80 bg-white p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-slate-950">
                          {appointment.customerDisplayName}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                          {formatBusinessDateTime(appointment.scheduledAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-700">
                        {appointment.project}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{appointment.note}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        负责人：{appointment.consultantUserId}
                      </p>

                      <form
                        className="mt-3 rounded-2xl bg-slate-50 p-3"
                        onSubmit={(event) => handleStatusUpdate(event, appointment)}
                      >
                        <div className="grid gap-2">
                          <div>
                            <label
                              htmlFor={`appointment-status-${appointment.id}`}
                              className="text-xs font-semibold text-slate-500"
                            >
                              状态更新 {appointment.customerDisplayName}
                            </label>
                            <select
                              id={`appointment-status-${appointment.id}`}
                              name="status"
                              className="mt-1 h-9 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-emerald-300"
                              defaultValue={appointment.status}
                            >
                              {statusOptions.map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label
                              htmlFor={`appointment-note-${appointment.id}`}
                              className="text-xs font-semibold text-slate-500"
                            >
                              备注更新 {appointment.customerDisplayName}
                            </label>
                            <textarea
                              id={`appointment-note-${appointment.id}`}
                              name="note"
                              className="mt-1 min-h-16 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-300"
                              defaultValue={appointment.note}
                            />
                          </div>
                        </div>

                        {statusErrors[appointment.id] ? (
                          <div className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                            {statusErrors[appointment.id]}
                          </div>
                        ) : null}

                        <button
                          type="submit"
                          className="mt-3 inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-slate-950 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                          disabled={
                            updatingAppointmentId === appointment.id ||
                            Boolean(listErrorState)
                          }
                        >
                          {updatingAppointmentId === appointment.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          更新预约 {appointment.customerDisplayName}
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-5">
          <form
            className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl"
            onSubmit={handleCreateAppointment}
          >
            <div className="flex items-center gap-3">
              <Clock3 className="h-5 w-5 text-emerald-600" />
              <div>
                <h3 className="text-lg font-semibold text-slate-950">新建预约</h3>
                <p className="mt-1 text-sm text-slate-500">客户姓名由已加载客户记录派生。</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <div>
                <label htmlFor="appointment-customer" className="text-xs font-semibold text-slate-500">
                  预约客户
                </label>
                <select
                  id="appointment-customer"
                  className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-300"
                  value={form.customerId}
                  onChange={(event) => updateFormField('customerId', event.target.value)}
                  disabled={customers.length === 0 || Boolean(listErrorState)}
                >
                  <option value="">选择当前客户</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="appointment-project" className="text-xs font-semibold text-slate-500">
                  预约项目
                </label>
                <input
                  id="appointment-project"
                  className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-300"
                  value={form.project}
                  onChange={(event) => updateFormField('project', event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="appointment-scheduled-at" className="text-xs font-semibold text-slate-500">
                  预约时间
                </label>
                <input
                  id="appointment-scheduled-at"
                  className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-300"
                  placeholder="2026-06-01T10:30:00+08:00"
                  value={form.scheduledAt}
                  onChange={(event) => updateFormField('scheduledAt', event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="appointment-consultant" className="text-xs font-semibold text-slate-500">
                  顾问 ID
                </label>
                <input
                  id="appointment-consultant"
                  className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-300"
                  value={form.consultantUserId}
                  onChange={(event) => updateFormField('consultantUserId', event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="appointment-status" className="text-xs font-semibold text-slate-500">
                  预约状态
                </label>
                <select
                  id="appointment-status"
                  className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-300"
                  value={form.status}
                  onChange={(event) =>
                    updateFormField('status', event.target.value as AppointmentStatus)
                  }
                >
                  {statusOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="appointment-note" className="text-xs font-semibold text-slate-500">
                  预约备注
                </label>
                <textarea
                  id="appointment-note"
                  className="mt-1 min-h-20 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300"
                  value={form.note}
                  onChange={(event) => updateFormField('note', event.target.value)}
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
              disabled={isSubmitting || customers.length === 0 || Boolean(listErrorState)}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? '提交中...' : '新建预约'}
            </button>
          </form>

          <article className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-950">数据边界</h3>
            </div>
            <div className="mt-4 grid gap-3">
              {boundaryItems.map((item) => (
                <div
                  key={item.title}
                  className={`rounded-2xl border p-4 ${boundaryToneClasses[item.tone]}`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    {item.title}
                  </div>
                  <p className="mt-2 text-sm leading-6">{item.description}</p>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}
