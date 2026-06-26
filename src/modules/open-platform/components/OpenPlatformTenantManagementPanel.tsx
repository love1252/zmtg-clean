'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarClock,
  Check,
  ClipboardList,
  FileText,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import {
  applyOpenPlatformTenantPlanChange,
  createOpenPlatformTenantWithPlan,
  listOpenPlatformTenantCommercialRecords,
  listOpenPlatformTenants,
  listOpenPlatformTenantPlanOptions,
  previewOpenPlatformTenantPlanChange,
  type OpenPlatformTenantClientError,
  type OpenPlatformTenantRecord,
} from '@/modules/open-platform/client/platform-tenant-management-client';
import {
  buildTenantCommercialRecordOverview,
  type TenantCommercialRecordDto,
} from '@/modules/open-platform/domain/tenant-commercial-records';
import type { TenantPlanChangePreview } from '@/modules/open-platform/domain/tenant-plan-change';
import type { TenantPlanOptionDto } from '@/modules/open-platform/domain/tenant-plan-binding';
import {
  buildTenantManagementOverview,
  filterTenantManagementRecords,
  getTenantAuthorizationState,
  getTenantExpiryState,
  getTenantQuotaRiskState,
  getTenantStatusLabel,
  type TenantAuthorizationStatus,
  type TenantExpiryStatus,
  type TenantQuotaRiskStatus,
} from '@/modules/open-platform/domain/tenant-management-view';
import { PlatformSectionBanner } from '@/modules/open-platform/components/PlatformSectionBanner';
import { cn } from '@/shared/utils/cn';

type TenantManagementStateProps = {
  title: string;
  description?: string;
  kind: 'loading' | 'empty' | 'error' | 'forbidden' | 'unavailable';
};

type CreateTenantStep = 1 | 2 | 3 | 4;

type CreateTenantForm = {
  organizationName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  adminName: string;
  adminAccount: string;
  adminContact: string;
  planVersionId: string;
  reason: string;
};

const defaultNow = '2026-06-22T00:00:00.000+08:00';
const trialDurationDays = 10;

const defaultCreateTenantForm: CreateTenantForm = {
  organizationName: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  adminName: '',
  adminAccount: '',
  adminContact: '',
  planVersionId: '',
  reason: '平台测试租户开设，用于授权快照验证。',
};

const quotaItems = [
  { key: 'customers', label: '客户数', currentKey: 'currentCustomers', maxKey: 'maxCustomers' },
  { key: 'appointments', label: '预约数', currentKey: 'currentAppointments', maxKey: 'maxAppointments' },
  { key: 'followUps', label: '随访任务', currentKey: 'currentFollowUps', maxKey: 'maxFollowUps' },
  { key: 'aiCalls', label: 'AI 调用', currentKey: 'currentAiCalls', maxKey: 'maxAiCalls' },
] as const;

function visibleTenantErrorState(error: OpenPlatformTenantClientError): TenantManagementStateProps {
  if (error.kind === 'unauthorized') {
    return {
      kind: 'error',
      title: '登录状态已失效，请重新登录',
    };
  }

  if (error.kind === 'forbidden') {
    return {
      kind: 'forbidden',
      title: '当前账号没有查看租户管理的权限',
    };
  }

  if (error.kind === 'service_unavailable') {
    return {
      kind: 'unavailable',
      title: '租户治理视图暂时不可用，请稍后刷新或切换到开发空态',
    };
  }

  return {
    kind: 'error',
    title: error.message || '租户治理视图请求失败',
  };
}

function formatDateTime(value: string | null) {
  if (!value) return '-';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
  }).format(new Date(timestamp));
}

function quotaValue(value: number | null) {
  return typeof value === 'number' ? String(value) : '-';
}

function formatLimit(value: number | null, fallback = '不限') {
  return typeof value === 'number' ? new Intl.NumberFormat('zh-CN').format(value) : fallback;
}

function addDaysIso(value: string, days: number) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Date(timestamp + days * 24 * 60 * 60 * 1000).toISOString();
}

function isTrialPlanOption(plan: TenantPlanOptionDto | null) {
  if (!plan) return false;
  return (
    plan.planCode.toLowerCase().includes('trial') ||
    plan.planName.includes('试用') ||
    plan.displayName.includes('试用')
  );
}

function statusBadgeClass(tone: 'slate' | 'emerald' | 'blue' | 'amber' | 'rose') {
  if (tone === 'emerald') return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  if (tone === 'blue') return 'border-blue-100 bg-blue-50 text-blue-700';
  if (tone === 'amber') return 'border-amber-100 bg-amber-50 text-amber-700';
  if (tone === 'rose') return 'border-rose-100 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function tenantStatusTone(status: string) {
  if (status === 'active') return 'emerald';
  if (status === 'trialing') return 'blue';
  if (status === 'suspended') return 'amber';
  if (status === 'cancelled') return 'rose';
  return 'slate';
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7) return '已脱敏';
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

function maskEmail(value: string) {
  const [name, domain] = value.split('@');
  if (!domain) return '已脱敏';
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskContact(value: string) {
  return value.includes('@') ? maskEmail(value) : maskPhone(value);
}

function displayField(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : '未录入';
}

function isTrialTenant(tenant: OpenPlatformTenantRecord) {
  return (
    tenant.planCode?.toLowerCase().includes('trial') ||
    tenant.planName?.includes('试用') ||
    tenant.planDisplayName?.includes('试用')
  );
}

function TenantManagementState({ title, description, kind }: TenantManagementStateProps) {
  const isLoading = kind === 'loading';

  return (
    <div className="rounded-xl border border-[#dbe6f3] bg-[#f8fafc] px-4 py-8 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-950">{title}</div>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  helper: string;
  tone: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate';
  icon: typeof Building2;
}) {
  const iconClass =
    tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-700'
        : tone === 'rose'
          ? 'bg-rose-50 text-rose-700'
          : tone === 'slate'
            ? 'bg-slate-50 text-slate-600'
            : 'bg-blue-50 text-blue-700';

  return (
    <article className="rounded-xl border border-[#dbe6f3] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-600">{label}</div>
          <div className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">{value}</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">{helper}</div>
        </div>
        <div className={cn('grid h-10 w-10 place-items-center rounded-xl', iconClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: 'slate' | 'emerald' | 'blue' | 'amber' | 'rose' }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold', statusBadgeClass(tone))}>
      {label}
    </span>
  );
}

function UsageCell({ tenant }: { tenant: OpenPlatformTenantRecord }) {
  return (
    <div className="grid min-w-[170px] gap-1 text-xs leading-5 text-slate-600">
      {quotaItems.map((item) => {
        const current = tenant[item.currentKey];
        const max = tenant[item.maxKey];
        const isAiQuotaDisabled = item.key === 'aiCalls' && current === 0 && max === 0;

        return (
          <span key={item.key}>
            {item.label} <span className="font-semibold text-slate-900">{quotaValue(current)} / {quotaValue(max)}</span>
            {isAiQuotaDisabled ? <span className="ml-1 text-slate-500">当前未启用 AI 调用配额</span> : null}
          </span>
        );
      })}
    </div>
  );
}

function EmptyTenantState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-[#dbe6f3] bg-white px-6 py-14 text-center shadow-sm">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
        <Building2 className="h-8 w-8" />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-slate-950">暂无租户</h3>
      <p className="mt-2 text-sm text-slate-500">请通过平台管理端开设第一个测试租户。</p>
      <p className="mt-1 text-sm text-slate-500">开设后会生成套餐授权快照和审计记录。</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          新建租户
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-[#dbe6f3] bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
        >
          <FileText className="h-4 w-4" />
          查看产品与套餐
        </button>
      </div>
      <div className="mt-5 text-xs text-slate-500">当前页面不支持公开注册、真实计费或外部通知。</div>
      <div className="sr-only">暂无租户记录</div>
      <div className="sr-only">当前没有可展示的租户、套餐或配额快照。</div>
    </div>
  );
}

function TenantDetailDrawer({
  tenant,
  planOptions,
  onTenantChanged,
  onClose,
}: {
  tenant: OpenPlatformTenantRecord;
  planOptions: TenantPlanOptionDto[];
  onTenantChanged: (tenant: OpenPlatformTenantRecord) => void;
  onClose: () => void;
}) {
  const authorization = getTenantAuthorizationState(tenant);
  const quotaRisk = getTenantQuotaRiskState(tenant);
  const expiry = getTenantExpiryState(tenant, { now: defaultNow });
  const changePlanOptions = useMemo(
    () => planOptions.filter((plan) => plan.planVersionId !== tenant.planVersionId),
    [planOptions, tenant.planVersionId],
  );
  const [isChangeOpen, setIsChangeOpen] = useState(false);
  const [targetPlanVersionId, setTargetPlanVersionId] = useState(
    changePlanOptions[0]?.planVersionId ?? '',
  );
  const [changeReason, setChangeReason] = useState('平台套餐变更，刷新授权快照。');
  const [changePreview, setChangePreview] = useState<TenantPlanChangePreview | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [isPreviewingChange, setIsPreviewingChange] = useState(false);
  const [isApplyingChange, setIsApplyingChange] = useState(false);
  const [changeSuccess, setChangeSuccess] = useState<{
    changeRecordId: string;
    auditEventId: string;
  } | null>(null);
  const [commercialRecordsState, setCommercialRecordsState] = useState<{
    status: 'loading' | 'ready' | 'error';
    records: TenantCommercialRecordDto[];
    message?: string;
  }>({
    status: 'loading',
    records: [],
  });

  const effectiveTargetPlanVersionId = changePlanOptions.some(
    (plan) => plan.planVersionId === targetPlanVersionId,
  )
    ? targetPlanVersionId
    : changePlanOptions[0]?.planVersionId ?? '';
  const selectedChangePlan =
    changePlanOptions.find((plan) => plan.planVersionId === effectiveTargetPlanVersionId) ??
    changePlanOptions[0] ??
    null;

  useEffect(() => {
    let isActive = true;

    async function loadCommercialRecords() {
      const result = await listOpenPlatformTenantCommercialRecords(tenant.tenantId);
      if (!isActive) return;

      if (result.ok) {
        setCommercialRecordsState({
          status: 'ready',
          records: result.records,
        });
        return;
      }

      setCommercialRecordsState({
        status: 'error',
        records: [],
        message: result.error.message,
      });
    }

    void loadCommercialRecords();

    return () => {
      isActive = false;
    };
  }, [tenant.tenantId]);

  const commercialOverview = useMemo(
    () => buildTenantCommercialRecordOverview(commercialRecordsState.records),
    [commercialRecordsState.records],
  );
  const openingContact = tenant.openingContact;
  const showTrialPeriod = isTrialTenant(tenant) && Boolean(tenant.startedAt || tenant.expiresAt);

  function resetPlanChangeResult() {
    setChangePreview(null);
    setChangeSuccess(null);
    setChangeError(null);
  }

  async function handlePreviewPlanChange() {
    if (!effectiveTargetPlanVersionId || !changeReason.trim()) {
      setChangeError('请选择目标套餐版本并填写变更原因');
      return;
    }

    setIsPreviewingChange(true);
    setChangeError(null);
    setChangeSuccess(null);
    const result = await previewOpenPlatformTenantPlanChange(tenant.tenantId, {
      toPlanVersionId: effectiveTargetPlanVersionId,
      reason: changeReason,
    });
    setIsPreviewingChange(false);

    if (!result.ok) {
      setChangePreview(null);
      setChangeError(`套餐变更预览失败：${result.error.message}`);
      return;
    }

    setChangePreview(result.preview);
  }

  async function handleApplyPlanChange() {
    if (!effectiveTargetPlanVersionId || !changeReason.trim()) {
      setChangeError('请选择目标套餐版本并填写变更原因');
      return;
    }

    setIsApplyingChange(true);
    setChangeError(null);
    const result = await applyOpenPlatformTenantPlanChange(tenant.tenantId, {
      toPlanVersionId: effectiveTargetPlanVersionId,
      reason: changeReason,
    });
    setIsApplyingChange(false);

    if (!result.ok) {
      setChangeError(`套餐变更应用失败：${result.error.message}`);
      return;
    }

    setChangeSuccess({
      changeRecordId: result.changeRecordId,
      auditEventId: result.auditEventId,
    });
    onTenantChanged(result.tenant);
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/25 backdrop-blur-[1px]">
      <aside
        role="dialog"
        aria-label="租户详情"
        className="h-full w-full max-w-3xl overflow-y-auto border-l border-[#dbe6f3] bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold text-slate-950">{tenant.tenantName}</h3>
                <StatusBadge label={getTenantStatusLabel(tenant.tenantStatus)} tone={tenantStatusTone(tenant.tenantStatus)} />
              </div>
              <p className="mt-1 text-sm text-slate-500">租户 ID：{tenant.tenantId}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-[#dbe6f3] bg-white px-3 py-2 text-sm font-semibold text-slate-600"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
              关闭
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-[#dbe6f3] bg-white px-3 py-2 text-sm font-semibold text-slate-600"
            >
              <ClipboardList className="h-4 w-4" />
              查看审计日志
            </button>
          </div>
        </div>

        <section className="mt-5 rounded-xl border border-[#dbe6f3] p-4">
          <h4 className="text-base font-semibold text-slate-950">基础信息</h4>
          <div className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
            <div>租户 ID：{tenant.tenantId}</div>
            <div>最近更新：{formatDateTime(tenant.updatedAt)}</div>
            <div>创建时间：{formatDateTime(tenant.createdAt)}</div>
            <div>联系人：{displayField(openingContact?.contactName)}</div>
            <div>联系人手机：{displayField(openingContact?.contactPhone)}</div>
            <div>联系人邮箱：{displayField(openingContact?.contactEmail)}</div>
            <div>管理员姓名：{displayField(openingContact?.adminName)}</div>
            <div>管理员账号：{displayField(openingContact?.adminAccount)}</div>
            <div>管理员联系方式：{displayField(openingContact?.adminContact)}</div>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-[#dbe6f3] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-base font-semibold text-slate-950">当前套餐</h4>
            <button
              type="button"
              onClick={() => setIsChangeOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700"
            >
              <ClipboardList className="h-4 w-4" />
              变更套餐
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-blue-50 p-4">
              <div className="text-lg font-semibold text-slate-950">{tenant.planName ?? '未配置套餐'}</div>
              <div className="mt-1 text-sm text-slate-500">套餐编号：{tenant.planCode ?? '-'}</div>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <div>有效期：{tenant.expiresAt ? formatDateTime(tenant.expiresAt) : '未设置'}</div>
              {showTrialPeriod ? (
                <>
                  <div>试用开始：{formatDateTime(tenant.startedAt)}</div>
                  <div>试用截止：{formatDateTime(tenant.expiresAt)}</div>
                </>
              ) : null}
              <div>分配状态：{tenant.assignmentStatus ?? '-'}</div>
              <StatusBadge label={expiry.label} tone={expiry.tone} />
            </div>
          </div>
        </section>

        {isChangeOpen ? (
          <section className="mt-4 rounded-xl border border-[#dbe6f3] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-950">套餐变更</h4>
                <p className="mt-1 text-sm text-slate-500">
                  先预览权益差异，再应用变更并生成新的授权快照。
                </p>
              </div>
              {selectedChangePlan ? (
                <StatusBadge label={selectedChangePlan.versionCode} tone="blue" />
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1.2fr]">
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                目标套餐版本
                <select
                  aria-label="目标套餐版本"
                  value={effectiveTargetPlanVersionId}
                  onChange={(event) => {
                    setTargetPlanVersionId(event.target.value);
                    resetPlanChangeResult();
                  }}
                  className="rounded-lg border border-[#dbe6f3] bg-white px-3 py-2 text-sm font-normal text-slate-900"
                >
                  {changePlanOptions.length === 0 ? <option value="">暂无可变更套餐</option> : null}
                  {changePlanOptions.map((plan) => (
                    <option key={plan.planVersionId} value={plan.planVersionId}>
                      {plan.displayName} - {plan.displayPrice}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                变更原因
                <textarea
                  aria-label="变更原因"
                  value={changeReason}
                  onChange={(event) => {
                    setChangeReason(event.target.value);
                    resetPlanChangeResult();
                  }}
                  className="min-h-20 rounded-lg border border-[#dbe6f3] px-3 py-2 text-sm font-normal text-slate-900"
                  placeholder="请输入本次套餐变更的业务原因"
                />
              </label>
            </div>

            {selectedChangePlan ? (
              <div className="mt-3 rounded-xl border border-[#dbe6f3] bg-[#f8fafc] p-3">
                <div className="text-sm font-semibold text-slate-950">
                  目标：{selectedChangePlan.displayName}
                </div>
                <div className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-4">
                  <span>Agent {formatLimit(selectedChangePlan.agentLimit)}</span>
                  <span>员工席位 {formatLimit(selectedChangePlan.seatLimit)}</span>
                  <span>AI 调用/月 {formatLimit(selectedChangePlan.monthlyAiCallLimit)}</span>
                  <span>知识库 {formatLimit(selectedChangePlan.knowledgeStorageGb)} GB</span>
                </div>
              </div>
            ) : null}

            {changeError ? (
              <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                {changeError}
              </div>
            ) : null}

            {changeSuccess ? (
              <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <div className="font-semibold">套餐变更已应用并生成新授权快照</div>
                <div className="mt-1">变更记录：{changeSuccess.changeRecordId}</div>
                <div>审计事件：{changeSuccess.auditEventId}</div>
              </div>
            ) : null}

            {changePreview ? (
              <div className="mt-4 overflow-x-auto rounded-xl border border-[#dbe6f3]">
                <table className="min-w-[640px] w-full border-collapse text-left text-sm">
                  <caption className="sr-only">套餐变更差异对照</caption>
                  <thead className="bg-[#f8fafc] text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-3 py-2">权益项</th>
                      <th className="px-3 py-2">变更前</th>
                      <th className="px-3 py-2">变更后</th>
                      <th className="px-3 py-2">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dbe6f3] bg-white">
                    {changePreview.items.map((item) => (
                      <tr key={item.key}>
                        <td className="px-3 py-2 font-semibold text-slate-900">{item.label}</td>
                        <td className="px-3 py-2 text-slate-600">{item.before}</td>
                        <td className="px-3 py-2 text-slate-900">{item.after}</td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            label={item.changed ? '已变化' : '未变化'}
                            tone={item.changed ? 'amber' : 'slate'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t border-[#dbe6f3] bg-[#f8fafc] px-3 py-2 text-xs text-slate-500">
                  套餐变更差异对照：{changePreview.changedItemCount} 项变化，{changePreview.unchangedItemCount} 项不变。
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                <Lock className="h-4 w-4" />
                仅提交套餐版本和变更原因，不提交联系人、计费、支付或密钥字段。
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isPreviewingChange || isApplyingChange || !effectiveTargetPlanVersionId}
                  onClick={() => void handlePreviewPlanChange()}
                  className="rounded-lg border border-[#dbe6f3] bg-white px-4 py-2 text-sm font-semibold text-blue-700 disabled:text-slate-400"
                >
                  {isPreviewingChange ? '预览中...' : '预览变更'}
                </button>
                <button
                  type="button"
                  disabled={isApplyingChange || !changePreview}
                  onClick={() => void handleApplyPlanChange()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
                >
                  {isApplyingChange ? '应用中...' : '确认应用变更'}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-4 rounded-xl border border-[#dbe6f3] p-4">
          <h4 className="text-base font-semibold text-slate-950">授权快照</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {['客户管理', '预约管理', '知识库', 'AI助手', '报表'].map((item) => (
              <StatusBadge key={item} label={item} tone="blue" />
            ))}
          </div>
          <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            <div>快照时间：{formatDateTime(tenant.snapshotAt)}</div>
            <div>授权状态：{authorization.label}</div>
            <div>AI 用量边界：每日调用上限仅作 UI 预览</div>
            <div>知识库边界：文件数量与存储空间仅作 UI 预览</div>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-[#dbe6f3] p-4">
          <h4 className="text-base font-semibold text-slate-950">用量摘要（本月）</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {quotaItems.map((item) => (
              <div key={item.key} className="rounded-xl bg-[#f8fafc] p-3">
                <div className="text-xs font-semibold text-slate-500">{item.label}</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">
                  {quotaValue(tenant[item.currentKey])} / {quotaValue(tenant[item.maxKey])}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-[#dbe6f3] p-4">
          <h4 className="text-base font-semibold text-slate-950">风险提示</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#dbe6f3] bg-[#f8fafc] p-3">
              <StatusBadge label={quotaRisk.label} tone={quotaRisk.tone} />
              <p className="mt-2 text-sm text-slate-500">当前用量与配置均为安全运营参考。</p>
            </div>
            <div className="rounded-xl border border-[#dbe6f3] bg-[#f8fafc] p-3">
              <StatusBadge label={expiry.label} tone={expiry.tone} />
              <p className="mt-2 text-sm text-slate-500">到期提醒只展示状态，不触发外部通知。</p>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-[#dbe6f3] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-base font-semibold text-slate-950">商业化预留</h4>
              <p className="mt-1 text-sm text-slate-500">
                只读人工记录，用于观察订单、合同、发票、支付的预留状态。
              </p>
            </div>
            <div className="rounded-full border border-[#dbe6f3] bg-[#f8fafc] px-3 py-1 text-xs font-semibold text-slate-600">
              {commercialRecordsState.status === 'loading'
                ? '加载中'
                : `${commercialOverview.total} 条记录`}
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            {[
              { key: 'order', label: '订单' },
              { key: 'contract', label: '合同' },
              { key: 'invoice', label: '发票' },
              { key: 'payment', label: '支付' },
            ].map((item) => (
              <div key={item.key} className="rounded-xl border border-[#dbe6f3] bg-[#f8fafc] p-3">
                <div className="text-sm font-semibold text-slate-950">{item.label}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {commercialRecordsState.status === 'ready'
                    ? `${commercialOverview.byType[item.key as keyof typeof commercialOverview.byType]} 条人工记录`
                    : '等待读取'}
                </div>
              </div>
            ))}
          </div>

          {commercialRecordsState.status === 'error' ? (
            <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              商业化预留记录暂时不可用：{commercialRecordsState.message || '请求失败'}
            </div>
          ) : null}

          {commercialRecordsState.status === 'ready' && commercialRecordsState.records.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-[#dbe6f3] bg-[#f8fafc] px-4 py-6 text-center text-sm text-slate-500">
              暂无人工商业化预留记录。
            </div>
          ) : null}

          {commercialRecordsState.records.length > 0 ? (
            <div className="mt-4 overflow-x-auto rounded-xl border border-[#dbe6f3]">
              <table className="min-w-[720px] w-full border-collapse text-left text-sm">
                <thead className="bg-[#f8fafc] text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-3 py-2">类型</th>
                    <th className="px-3 py-2">展示编号</th>
                    <th className="px-3 py-2">人工状态</th>
                    <th className="px-3 py-2">展示金额</th>
                    <th className="px-3 py-2">周期</th>
                    <th className="px-3 py-2">关联变更</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dbe6f3] bg-white">
                  {commercialRecordsState.records.map((record) => (
                    <tr key={record.recordId}>
                      <td className="px-3 py-2 font-semibold text-slate-950">
                        {record.recordTypeLabel}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{record.displayCode}</td>
                      <td className="px-3 py-2">
                        <StatusBadge label={record.statusLabel} tone="blue" />
                      </td>
                      <td className="px-3 py-2 text-slate-600">{record.displayAmount ?? '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{record.periodLabel ?? '-'}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {record.relatedPlanChangeId ?? '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
            当前区域不提供线上交易处理、资金处理、外部交易系统调用或税务处理能力。
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-[#dbe6f3] p-4">
          <h4 className="text-base font-semibold text-slate-950">审计入口</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {['操作日志', '登录日志', '敏感操作', '导出报表'].map((item) => (
              <button
                key={item}
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-[#dbe6f3] bg-white px-3 py-2 text-left text-sm font-semibold text-slate-600"
              >
                <FileText className="h-4 w-4 text-blue-700" />
                {item}
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function CreateTenantModal({
  form,
  planOptions,
  isSubmitting,
  errorMessage,
  step,
  onChange,
  onStepChange,
  onSubmit,
  onClose,
}: {
  form: CreateTenantForm;
  planOptions: TenantPlanOptionDto[];
  isSubmitting: boolean;
  errorMessage: string | null;
  step: CreateTenantStep;
  onChange: (form: CreateTenantForm) => void;
  onStepChange: (step: CreateTenantStep) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const selectedPlan =
    planOptions.find((plan) => plan.planVersionId === form.planVersionId) ?? planOptions[0] ?? null;
  const trialExpiresAt = isTrialPlanOption(selectedPlan)
    ? addDaysIso(defaultNow, trialDurationDays)
    : null;
  const update = (key: keyof CreateTenantForm, value: string) => onChange({ ...form, [key]: value });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4 py-6">
      <section
        role="dialog"
        aria-label="新建租户"
        className="max-h-full w-full max-w-5xl overflow-y-auto rounded-xl border border-[#dbe6f3] bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#dbe6f3] px-5 py-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-950">新建租户</h3>
            <p className="mt-1 text-sm text-slate-500">三步式受控流程，只写入租户、套餐分配和授权快照。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-[#dbe6f3] p-2 text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 border-b border-[#dbe6f3] px-5 py-4 md:grid-cols-3">
          {[
            { id: 1, title: '机构与管理员', helper: step > 1 ? '已完成' : '填写基础信息' },
            { id: 2, title: '套餐与权益', helper: step > 2 ? '已完成' : '选择套餐与权限预览' },
            { id: 3, title: '提交确认', helper: step > 3 ? '已完成' : '确认信息并提交' },
          ].map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <div
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-full text-sm font-semibold',
                  step >= item.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500',
                )}
              >
                {step > item.id ? <Check className="h-4 w-4" /> : item.id}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-950">{item.title}</div>
                <div className="text-xs text-slate-500">{item.helper}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-5">
          {step === 1 ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-xl border border-[#dbe6f3] p-4">
                <h4 className="text-base font-semibold text-slate-950">机构信息</h4>
                <div className="mt-4 grid gap-4">
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    机构名称
                    <input
                      value={form.organizationName}
                      onChange={(event) => update('organizationName', event.target.value)}
                      className="rounded-lg border border-[#dbe6f3] px-3 py-2 text-sm font-normal"
                      placeholder="请输入机构名称"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    联系人姓名
                    <input
                      value={form.contactName}
                      onChange={(event) => update('contactName', event.target.value)}
                      className="rounded-lg border border-[#dbe6f3] px-3 py-2 text-sm font-normal"
                      placeholder="请输入联系人姓名"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    联系人手机号
                    <input
                      value={form.contactPhone}
                      onChange={(event) => update('contactPhone', event.target.value)}
                      className="rounded-lg border border-[#dbe6f3] px-3 py-2 text-sm font-normal"
                      placeholder="用于商业试用开通台账"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    联系人邮箱
                    <input
                      value={form.contactEmail}
                      onChange={(event) => update('contactEmail', event.target.value)}
                      className="rounded-lg border border-[#dbe6f3] px-3 py-2 text-sm font-normal"
                      placeholder="用于商业试用开通台账"
                    />
                  </label>
                </div>
              </section>
              <section className="rounded-xl border border-[#dbe6f3] p-4">
                <h4 className="text-base font-semibold text-slate-950">初始管理员</h4>
                <div className="mt-4 grid gap-4">
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    管理员姓名
                    <input
                      value={form.adminName}
                      onChange={(event) => update('adminName', event.target.value)}
                      className="rounded-lg border border-[#dbe6f3] px-3 py-2 text-sm font-normal"
                      placeholder="请输入管理员姓名"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    管理员登录账号
                    <input
                      value={form.adminAccount}
                      onChange={(event) => update('adminAccount', event.target.value)}
                      className="rounded-lg border border-[#dbe6f3] px-3 py-2 text-sm font-normal"
                      placeholder="例如 xinglan_admin"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    管理员手机号或邮箱
                    <input
                      value={form.adminContact}
                      onChange={(event) => update('adminContact', event.target.value)}
                      className="rounded-lg border border-[#dbe6f3] px-3 py-2 text-sm font-normal"
                      placeholder="用于账号开通联系与授权台账"
                    />
                  </label>
                  <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                    初始角色默认为租户管理员，不展示明文密码，不触发短信或邮件。
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
              <section className="rounded-xl border border-[#dbe6f3] p-4">
                <h4 className="text-base font-semibold text-slate-950">选择套餐</h4>
                <div className="mt-4 grid gap-3">
                  {planOptions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#dbe6f3] bg-[#f8fafc] px-4 py-8 text-center text-sm text-slate-500">
                      暂无可选择的 published 套餐版本
                    </div>
                  ) : null}
                  {planOptions.map((plan) => (
                    <button
                      key={plan.planVersionId}
                      type="button"
                      onClick={() => update('planVersionId', plan.planVersionId)}
                      className={cn(
                        'rounded-xl border p-4 text-left',
                        form.planVersionId === plan.planVersionId
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-[#dbe6f3] bg-white',
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-slate-950">{plan.displayName}</span>
                        <StatusBadge label={plan.versionCode} tone="blue" />
                      </div>
                      <p className="mt-1 text-sm text-slate-500">展示价格 {plan.displayPrice}</p>
                      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-4">
                        <span>Agent {formatLimit(plan.agentLimit)}</span>
                        <span>员工席位 {formatLimit(plan.seatLimit)}</span>
                        <span>AI调用/月 {formatLimit(plan.monthlyAiCallLimit)}</span>
                        <span>知识库 {formatLimit(plan.knowledgeStorageGb)} GB</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-[#dbe6f3] p-4">
                <h4 className="text-base font-semibold text-slate-950">
                  {selectedPlan ? `${selectedPlan.displayName} 授权预览` : '授权预览'}
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedPlan ? `套餐版本 ${selectedPlan.versionCode}` : '请先选择 published 套餐版本'}
                </p>
                {selectedPlan ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-[#dbe6f3] p-3">
                      <div className="text-sm font-semibold text-slate-950">展示价格 {selectedPlan.displayPrice}</div>
                      <div className="mt-1 text-sm text-slate-500">{selectedPlan.priceNote || '人工确认口径'}</div>
                    </div>
                  <div className="rounded-xl border border-[#dbe6f3] p-3">
                    <div className="text-sm font-semibold text-slate-950">连接器</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(selectedPlan.connectorEntitlements.length > 0
                        ? selectedPlan.connectorEntitlements
                        : ['未配置']).map((item) => (
                        <StatusBadge key={item} label={item} tone="blue" />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#dbe6f3] p-3">
                    <div className="text-sm font-semibold text-slate-950">服务权益</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(selectedPlan.serviceEntitlements.length > 0
                        ? selectedPlan.serviceEntitlements
                        : ['未配置']).map((item) => (
                        <StatusBadge key={item} label={item} tone="blue" />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#dbe6f3] p-3">
                    <div className="text-sm font-semibold text-slate-950">容量配额</div>
                    <div className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                      <span>Agent {formatLimit(selectedPlan.agentLimit)}</span>
                      <span>员工席位 {formatLimit(selectedPlan.seatLimit)}</span>
                      <span>AI 调用/月 {formatLimit(selectedPlan.monthlyAiCallLimit)}</span>
                      <span>知识库存储 {formatLimit(selectedPlan.knowledgeStorageGb)} GB</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">
                    套餐控制租户能力，角色控制人员动作。
                  </div>
                </div>
                ) : null}
              </section>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-xl border border-[#dbe6f3] p-4">
                <h4 className="text-base font-semibold text-slate-950">提交确认</h4>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div>租户：{form.organizationName || '未填写机构'}</div>
                  <div>
                    联系人：{form.contactName || '-'}（{form.contactPhone || '-'} / {form.contactEmail || '-'}）
                  </div>
                  <div>
                    初始管理员：{form.adminName || '-'}（账号 {form.adminAccount || '-'} / 联系方式 {form.adminContact || '-'}）
                  </div>
                  <div>套餐：{selectedPlan?.displayName ?? '-'}</div>
                  <div>套餐版本：{selectedPlan?.versionCode ?? '-'}</div>
                  {trialExpiresAt ? (
                    <>
                      <div>试用周期：{trialDurationDays} 天</div>
                      <div>开始时间：{formatDateTime(defaultNow)}</div>
                      <div>截止时间：{formatDateTime(trialExpiresAt)}</div>
                    </>
                  ) : (
                    <div>有效期：正式套餐暂未设置到期时间</div>
                  )}
                </div>
              </section>
              <section className="rounded-xl border border-[#dbe6f3] p-4">
                <h4 className="text-base font-semibold text-slate-950">审计摘要</h4>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div>记录租户开设原因：{form.reason}</div>
                  <div>记录套餐版本：{selectedPlan?.versionCode ?? '-'}</div>
                  <div>记录授权快照摘要：模块、功能门禁、容量配额、试用周期和开通联系人</div>
                  <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-amber-700">
                    业务联系人字段按授权快照保存；密码不明文保存；请求体、SQL 和服务端细节仅进入受控诊断边界。
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-6 py-10 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-600 text-white">
                <Check className="h-7 w-7" />
              </div>
              <h4 className="mt-4 text-xl font-semibold text-slate-950">租户已开通并生成授权快照</h4>
              <p className="mt-2 text-sm text-slate-600">
                已通过平台受控 API 写入租户主体、套餐分配和授权快照。
              </p>
              <div className="mt-3 text-sm font-semibold text-slate-950">
                租户：{form.organizationName || '新建租户'}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                {['租户主体', '套餐分配', '授权快照', '返回列表'].map((item) => (
                  <div key={item} className="rounded-xl border border-emerald-100 bg-white px-3 py-3 text-sm font-semibold text-emerald-700">
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-5 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-[#dbe6f3] bg-white px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  返回租户列表
                </button>
                <button type="button" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                  查看租户详情
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {step < 4 ? (
          <div className="flex items-center justify-between border-t border-[#dbe6f3] px-5 py-4">
            <div className="inline-flex items-center gap-2 text-xs text-slate-500">
              <Lock className="h-4 w-4" />
              提交真实业务联系人字段；密码、请求体、SQL 和服务端细节不进入普通审计。
            </div>
            {errorMessage ? <div className="text-sm font-semibold text-rose-700">{errorMessage}</div> : null}
            <div className="flex gap-2">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => onStepChange((step - 1) as CreateTenantStep)}
                  className="rounded-lg border border-[#dbe6f3] bg-white px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  上一步
                </button>
              ) : null}
              <button
                type="button"
                disabled={isSubmitting || (step === 2 && !selectedPlan)}
                onClick={() => {
                  if (step === 3) {
                    onSubmit();
                    return;
                  }
                  onStepChange((step + 1) as CreateTenantStep);
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                {step === 3 ? (isSubmitting ? '提交中...' : '确认开设租户') : '下一步'}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function OpenPlatformTenantManagementPanel() {
  const [records, setRecords] = useState<OpenPlatformTenantRecord[]>([]);
  const [tenantPlanOptions, setTenantPlanOptions] = useState<TenantPlanOptionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorState, setErrorState] = useState<TenantManagementStateProps | null>(null);
  const [keyword, setKeyword] = useState('');
  const [tenantStatus, setTenantStatus] = useState<'all' | string>('all');
  const [planCode, setPlanCode] = useState<'all' | string>('all');
  const [expiry, setExpiry] = useState<'all' | TenantExpiryStatus>('all');
  const [authorization, setAuthorization] = useState<'all' | TenantAuthorizationStatus>('all');
  const [quotaRisk, setQuotaRisk] = useState<'all' | TenantQuotaRiskStatus>('all');
  const [selectedTenant, setSelectedTenant] = useState<OpenPlatformTenantRecord | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);
  const [createTenantError, setCreateTenantError] = useState<string | null>(null);
  const [createStep, setCreateStep] = useState<CreateTenantStep>(1);
  const [createForm, setCreateForm] = useState<CreateTenantForm>(defaultCreateTenantForm);
  const [aiUsageSummary, setAiUsageSummary] = useState<Array<{
    tenantId: string;
    callCount: number;
    totalTokens: number | null;
    succeededCount: number;
    failedCount: number;
  }>>([]);
  const [isAiUsageLoading, setIsAiUsageLoading] = useState(false);
  const [showAiUsage, setShowAiUsage] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadTenants() {
      setIsLoading(true);
      setErrorState(null);
      const tenantResult = await listOpenPlatformTenants();
      const planOptionsResult = await listOpenPlatformTenantPlanOptions();

      if (!isActive) return;

      if (tenantResult.ok) {
        setRecords(tenantResult.records);
      } else if (!tenantResult.ok) {
        setRecords([]);
        setErrorState(visibleTenantErrorState(tenantResult.error));
      }
      if (planOptionsResult.ok) {
        setTenantPlanOptions(planOptionsResult.options);
        setCreateForm((current) =>
          current.planVersionId || !planOptionsResult.options[0]
            ? current
            : { ...current, planVersionId: planOptionsResult.options[0].planVersionId },
        );
      } else {
        setTenantPlanOptions([]);
      }

      setIsLoading(false);
    }

    void loadTenants();

    return () => {
      isActive = false;
    };
  }, []);

  const overview = useMemo(() => buildTenantManagementOverview(records, { now: defaultNow }), [records]);

  const planOptionsForFilter = useMemo(
    () =>
      Array.from(
        new Map(
          records
            .filter((record) => record.planCode)
            .map((record) => [record.planCode, record.planName ?? record.planCode]),
        ),
      ),
    [records],
  );

  const filteredRecords = useMemo(
    () =>
      filterTenantManagementRecords(records, {
        keyword,
        tenantStatus,
        planCode,
        expiry,
        authorization,
        quotaRisk,
        now: defaultNow,
      }),
    [authorization, expiry, keyword, planCode, quotaRisk, records, tenantStatus],
  );

  function openCreateTenant() {
    setCreateStep(1);
    setCreateTenantError(null);
    setCreateForm({
      ...defaultCreateTenantForm,
      planVersionId: tenantPlanOptions[0]?.planVersionId ?? '',
    });
    setIsCreateOpen(true);
  }

  async function handleCreateTenant() {
    setIsCreatingTenant(true);
    setCreateTenantError(null);
    const result = await createOpenPlatformTenantWithPlan({
      organizationName: createForm.organizationName,
      contactName: createForm.contactName,
      contactPhone: createForm.contactPhone,
      contactEmail: createForm.contactEmail,
      adminName: createForm.adminName,
      adminAccount: createForm.adminAccount,
      adminContact: createForm.adminContact,
      planVersionId: createForm.planVersionId,
      reason: createForm.reason,
    });
    setIsCreatingTenant(false);

    if (!result.ok) {
      setCreateTenantError(`租户开通失败：${result.error.message}`);
      return;
    }

    setRecords((current) => [result.tenant, ...current.filter((item) => item.tenantId !== result.tenant.tenantId)]);
    setCreateStep(4);
  }

  function handleTenantChanged(tenant: OpenPlatformTenantRecord) {
    setRecords((current) =>
      current.map((item) => (item.tenantId === tenant.tenantId ? tenant : item)),
    );
    setSelectedTenant(tenant);
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <PlatformSectionBanner
          headingId="tenant-management-heading"
          title="租户管理"
          description="平台侧查看机构、套餐和配额边界。支持受控开通测试租户并生成授权快照，不代表正式计费后台；不提供冻结、恢复、删除或真实商业化流程。"
        />
        <button
          type="button"
          aria-label="打开新建租户"
          onClick={openCreateTenant}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          新建租户
        </button>
      </div>

      <div className="sr-only">租户管理工作台</div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="全部租户" value={isLoading ? '--' : overview.total} helper="总租户" tone="blue" icon={Building2} />
        <MetricCard label="运行中租户" value={isLoading ? '--' : overview.active} helper="当前处于 active 状态" tone="emerald" icon={ShieldCheck} />
        <MetricCard label="试用中" value={isLoading ? '--' : overview.trialing} helper="试用租户" tone="blue" icon={Users} />
        <MetricCard label="即将到期" value={isLoading ? '--' : overview.expiringSoon} helper="30 天内或已过期" tone="amber" icon={CalendarClock} />
        <MetricCard label="授权异常" value={isLoading ? '--' : overview.authorizationIssues} helper="存在异常" tone="rose" icon={ShieldAlert} />
      </section>

      <article className="rounded-xl border border-[#dbe6f3] bg-white p-5 shadow-sm lg:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-normal text-slate-950">租户列表</h3>
            <p className="mt-1 text-sm text-slate-500">展示 API 返回租户的基础状态、套餐信息、授权快照和配额风险。</p>
          </div>
          <div className="rounded-full border border-[#dbe6f3] bg-[#f8fafc] px-3 py-1 text-xs font-semibold text-slate-600">
            筛选结果 {filteredRecords.length} 个租户
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[#dbe6f3] bg-[#f8fafc] p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="relative grid gap-1 text-xs font-semibold text-slate-600 xl:col-span-2">
              搜索租户
              <Search className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-slate-400" />
              <input
                aria-label="搜索租户"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                className="rounded-lg border border-[#dbe6f3] bg-white py-2 pl-9 pr-3 text-sm font-normal text-slate-900"
                placeholder="机构名称 / 租户 ID / 编码"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              状态
              <select
                aria-label="状态"
                value={tenantStatus}
                onChange={(event) => setTenantStatus(event.target.value)}
                className="rounded-lg border border-[#dbe6f3] bg-white px-3 py-2 text-sm font-normal"
              >
                <option value="all">全部</option>
                <option value="active">运行中租户</option>
                <option value="trialing">试用中</option>
                <option value="suspended">已停用</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              套餐
              <select
                aria-label="套餐"
                value={planCode}
                onChange={(event) => setPlanCode(event.target.value)}
                className="rounded-lg border border-[#dbe6f3] bg-white px-3 py-2 text-sm font-normal"
              >
                <option value="all">全部</option>
                {planOptionsForFilter.map(([code, label]) => (
                  <option key={code} value={code ?? ''}>
                    筛选：{label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              有效期
              <select
                aria-label="有效期"
                value={expiry}
                onChange={(event) => setExpiry(event.target.value as 'all' | TenantExpiryStatus)}
                className="rounded-lg border border-[#dbe6f3] bg-white px-3 py-2 text-sm font-normal"
              >
                <option value="all">全部</option>
                <option value="expiring_soon">即将到期</option>
                <option value="expired">已过期</option>
                <option value="valid">有效期正常</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              授权状态
              <select
                aria-label="授权状态"
                value={authorization}
                onChange={(event) => setAuthorization(event.target.value as 'all' | TenantAuthorizationStatus)}
                className="rounded-lg border border-[#dbe6f3] bg-white px-3 py-2 text-sm font-normal"
              >
                <option value="all">全部</option>
                <option value="normal">授权正常</option>
                <option value="issue">授权异常</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              配额风险
              <select
                aria-label="配额风险"
                value={quotaRisk}
                onChange={(event) => setQuotaRisk(event.target.value as 'all' | TenantQuotaRiskStatus)}
                className="rounded-lg border border-[#dbe6f3] bg-white px-3 py-2 text-sm font-normal"
              >
                <option value="all">全部</option>
                <option value="normal">低风险</option>
                <option value="near_limit">配额风险</option>
                <option value="blocked">已触发阻断</option>
                <option value="none">暂无配额</option>
              </select>
            </label>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-4">
            <TenantManagementState kind="loading" title="正在加载租户管理数据..." />
          </div>
        ) : null}

        {!isLoading && errorState ? (
          <div className="mt-4">
            <TenantManagementState {...errorState} />
          </div>
        ) : null}

        {!isLoading && !errorState && records.length === 0 ? (
          <div className="mt-4">
            <EmptyTenantState onCreate={openCreateTenant} />
          </div>
        ) : null}

        {!isLoading && !errorState && records.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-[#dbe6f3]">
            <table className="min-w-[1080px] w-full border-collapse text-left text-sm">
              <thead className="bg-[#f8fafc] text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">机构名称</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">当前套餐</th>
                  <th className="px-4 py-3">有效期</th>
                  <th className="px-4 py-3">授权快照</th>
                  <th className="px-4 py-3">配额风险</th>
                  <th className="px-4 py-3">用量快照</th>
                  <th className="px-4 py-3">最近更新</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dbe6f3] bg-white">
                {filteredRecords.map((tenant) => {
                  const expiryState = getTenantExpiryState(tenant, { now: defaultNow });
                  const authorizationState = getTenantAuthorizationState(tenant);
                  const quotaRiskState = getTenantQuotaRiskState(tenant);
                  const openingContact = tenant.openingContact;

                  return (
                    <tr key={tenant.tenantId} className="align-top">
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-950">{tenant.tenantName}</div>
                            <div className="mt-1 text-xs text-slate-500">租户 ID：{tenant.tenantId}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              联系人：{displayField(openingContact?.contactName)}
                              {openingContact?.contactPhone ? ` / ${openingContact.contactPhone}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={getTenantStatusLabel(tenant.tenantStatus)} tone={tenantStatusTone(tenant.tenantStatus)} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-900">{tenant.planName ?? '未配置套餐'}</div>
                        <div className="mt-1 text-xs text-slate-500">套餐编号：{tenant.planCode ?? '-'}</div>
                        <div className="mt-1 text-xs text-slate-500">套餐状态：{tenant.planStatus ?? '-'}</div>
                        <div className="mt-1 text-xs text-slate-500">分配状态：{tenant.assignmentStatus ?? '-'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={expiryState.label} tone={expiryState.tone} />
                        <div className="mt-2 text-xs text-slate-500">{tenant.expiresAt ? formatDateTime(tenant.expiresAt) : '未设置'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={authorizationState.label} tone={authorizationState.tone} />
                        <div className="mt-2 text-xs text-slate-500">快照时间：{formatDateTime(tenant.snapshotAt)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={quotaRiskState.label} tone={quotaRiskState.tone} />
                      </td>
                      <td className="px-4 py-4">
                        <UsageCell tenant={tenant} />
                      </td>
                      <td className="px-4 py-4 text-xs leading-5 text-slate-500">
                        <div>{formatDateTime(tenant.updatedAt)}</div>
                        <div>超级管理员</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            aria-label={`查看 ${tenant.tenantName}`}
                            onClick={() => setSelectedTenant(tenant)}
                            className="text-sm font-semibold text-blue-700 hover:text-blue-800"
                          >
                            查看
                          </button>
                          <button type="button" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
                            审计
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {!isLoading && !errorState && records.length > 0 && filteredRecords.length === 0 ? (
          <div className="mt-4">
            <TenantManagementState kind="empty" title="没有匹配的租户，请调整筛选条件。" />
          </div>
        ) : null}
      </article>

      {!isLoading && !errorState && (authorization === 'issue' || overview.authorizationIssues > 0) ? (
        <article className="grid gap-5 rounded-xl border border-[#dbe6f3] bg-white p-5 shadow-sm lg:grid-cols-[1fr_0.8fr] lg:p-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
              <ShieldAlert className="h-4 w-4" />
              授权异常处理视图
            </div>
            <h3 className="mt-3 text-lg font-semibold text-slate-950">授权风险定位</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              按套餐缺失、快照失效、配额缺失、即将到期和阻断信号定位风险。高风险处理动作在 V1.1 中仅展示为后续任务。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['套餐缺失', '快照失效', '配额缺失', '即将到期', '已触发阻断'].map((item) => (
                <StatusBadge key={item} label={item} tone="rose" />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <h4 className="text-sm font-semibold text-slate-950">建议处理</h4>
            <div className="mt-3 space-y-2">
              <button type="button" className="flex w-full items-center justify-between rounded-lg border border-[#dbe6f3] bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                查看审计日志
                <ClipboardList className="h-4 w-4 text-blue-700" />
              </button>
              {['重新生成快照', '提交后续任务'].map((item) => (
                <button
                  key={item}
                  type="button"
                  disabled
                  className="flex w-full items-center justify-between rounded-lg border border-[#dbe6f3] bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-400"
                >
                  {item}
                  <Lock className="h-4 w-4" />
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-amber-700">高风险操作暂不在 V1.1 开放，敬请关注后续版本更新。</p>
          </div>
        </article>
      ) : null}

      {selectedTenant ? (
        <TenantDetailDrawer
          key={selectedTenant.tenantId}
          tenant={selectedTenant}
          planOptions={tenantPlanOptions}
          onTenantChanged={handleTenantChanged}
          onClose={() => setSelectedTenant(null)}
        />
      ) : null}
      {isCreateOpen ? (
        <CreateTenantModal
          form={createForm}
          planOptions={tenantPlanOptions}
          isSubmitting={isCreatingTenant}
          errorMessage={createTenantError}
          step={createStep}
          onChange={setCreateForm}
          onStepChange={setCreateStep}
          onSubmit={() => void handleCreateTenant()}
          onClose={() => setIsCreateOpen(false)}
        />
      ) : null}

      {showAiUsage ? (
        <section
          aria-label="平台端 AI 用量聚合"
          className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-normal text-slate-950">AI 用量聚合</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">只读查看各租户 AI 调用次数和 token 用量。</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                setIsAiUsageLoading(true);
                try {
                  const r = await fetch('/api/v1/open-platform/ai-usage', { cache: 'no-store' });
                  const p = await r.json().catch(() => ({ records: [] }));
                  setAiUsageSummary(Array.isArray(p.records) ? p.records : []);
                } catch { setAiUsageSummary([]); }
                finally { setIsAiUsageLoading(false); }
              }}
              disabled={isAiUsageLoading}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 text-xs font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-100"
            >
              {isAiUsageLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              刷新用量
            </button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-xs font-semibold text-slate-500">
                  <th className="px-4 py-2.5 text-left">租户 ID</th>
                  <th className="px-4 py-2.5 text-right">调用次数</th>
                  <th className="px-4 py-2.5 text-right">成功</th>
                  <th className="px-4 py-2.5 text-right">失败</th>
                  <th className="px-4 py-2.5 text-right">Token 总量</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {aiUsageSummary.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-xs font-semibold text-slate-400">
                      暂无 AI 调用数据
                    </td>
                  </tr>
                ) : (
                  aiUsageSummary.map((row) => (
                    <tr key={row.tenantId} className="text-xs text-slate-700">
                      <td className="px-4 py-2.5 font-mono text-slate-600">{row.tenantId}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{row.callCount}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">{row.succeededCount}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-rose-600">{row.failedCount}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{row.totalTokens ?? '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => setShowAiUsage((v) => !v)}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 text-xs font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-100"
        >
          <Sparkles className="h-4 w-4" />
          {showAiUsage ? '隐藏 AI 用量' : 'AI 用量'}
        </button>
      </div>
    </section>
  );
}
