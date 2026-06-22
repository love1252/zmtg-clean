'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Filter, Loader2, Search, ShieldCheck } from 'lucide-react';
import {
  AUDIT_REASON_VALUES,
  AUDIT_RESULT_VALUES,
} from '@/modules/audit/domain/audit-event-query';
import {
  listOpenPlatformAuditEvents,
  type OpenPlatformAuditEventRecord,
  type OpenPlatformAuditEventsClientError,
  type OpenPlatformAuditEventsPageInfo,
  type OpenPlatformAuditEventsQuery,
} from '@/modules/audit/client/open-platform-audit-events-client';
import {
  ACCESS_ACTIONS,
  ACCESS_RESOURCES,
} from '@/modules/security/domain/access-control';
import { PlatformSectionBanner } from '@/modules/open-platform/components/PlatformSectionBanner';

type AuditFilterForm = {
  from: string;
  to: string;
  tenantId: string;
  resource: string;
  resourceId: string;
  action: string;
  result: string;
  reason: string;
  actorId: string;
  limit: string;
};

type PlatformAuditStateProps = {
  title: string;
  description?: string;
  kind: 'loading' | 'empty' | 'error' | 'forbidden' | 'unavailable';
};

const defaultAuditPageLimit = '10';
const defaultAuditEventsQuery = { limit: defaultAuditPageLimit } as const;

const emptyAuditFilterForm: AuditFilterForm = {
  from: '',
  to: '',
  tenantId: '',
  resource: '',
  resourceId: '',
  action: '',
  result: '',
  reason: '',
  actorId: '',
  limit: defaultAuditPageLimit,
};

const resultToneClasses = {
  allowed: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  denied: 'border-rose-100 bg-rose-50 text-rose-100',
  transitioned: 'border-blue-100 bg-blue-50 text-blue-700',
} as const;

const resourceLabels: Record<string, string> = {
  tenant: '租户',
  tenant_member: '租户成员',
  customer: '客户',
  appointment: '预约',
  follow_up: '随访',
  treatment_summary: '治疗摘要',
  open_connection: '开放连接',
  permission_policy: '权限策略',
  audit_log: '审计日志',
  platform_health: '平台健康',
  ai_model_config: 'AI 模型配置',
  knowledge_management: '知识库管理',
};

const actionLabels: Record<string, string> = {
  read_aggregate: '查看汇总',
  read_own_tenant: '查看本机构',
  read_detail: '查看详情',
  create: '创建',
  update: '更新',
  delete: '删除',
  manage_status: '管理状态',
  manage_credentials: '管理凭证',
  test_connection: '连通测试',
  manage_policy: '管理策略',
  review: '审查',
  export_report: '导出报告',
};

const resultLabels: Record<string, string> = {
  allowed: '通过',
  denied: '拒绝',
  transitioned: '状态已变更',
};

const reasonLabels: Record<string, string> = {
  allowed_by_policy: '符合平台策略',
  missing_tenant: '缺少租户上下文',
  cross_tenant_denied: '跨租户访问已拒绝',
  role_denied: '角色权限不足',
  sensitive_detail_denied: '敏感详情已拦截',
  invalid_transition: '状态流转无效',
  stale_transition: '状态已过期',
  not_found_or_not_owned: '资源不存在或不属于当前范围',
  invalid_his_connection_payload: 'HIS 连接内容不完整',
  his_connection_name_conflict: 'HIS 连接名称重复',
  invalid_treatment_summary_reference: '治疗摘要引用无效',
  invalid_treatment_summary_payload: '治疗摘要内容不完整',
  treatment_summary_voided: '治疗摘要已作废',
  treatment_summary_already_voided: '治疗摘要已作废',
  invalid_treatment_summary_void_payload: '作废说明不完整',
  voided_treatment_summary_follow_up_blocked: '已作废摘要不可生成随访',
  invalid_follow_up_suggestion: '随访建议无效',
  active_source_follow_up_exists: '来源任务已存在有效随访',
  quota_exceeded_customers: '客户配额已达上限',
  quota_exceeded_appointments: '预约配额已达上限',
  missing_active_plan: '缺少有效套餐',
  missing_quota_limit: '缺少配额上限',
  provider_unavailable: '服务商暂不可用',
  provider_timeout: '服务商响应超时',
  provider_retry_exhausted: '服务商重试已用尽',
  provider_circuit_open: '服务商保护开关已打开',
  provider_validation_failed: '服务商校验失败',
  provider_write_failed: '服务商写入失败',
  provider_revoke_failed: '服务商撤销失败',
  provider_describe_failed: '服务商详情读取失败',
  provider_health_failed: '服务商健康检查失败',
  repository_after_provider_failed: '本地记录同步失败',
  audit_after_provider_failed: '审计记录写入失败',
  test_connection_requested: '已发起连通测试',
  test_connection_provider_healthy: '服务商连通正常',
  test_connection_missing_credential: '缺少测试凭证',
  test_connection_unsupported_vendor: '暂不支持该服务商测试',
  test_connection_limited_health_probe: '仅完成受限健康检查',
  test_connection_external_unreachable: '外部服务不可达',
  test_connection_provider_timeout: '服务商测试超时',
  test_connection_connection_not_active: '连接未启用',
  test_connection_completed: '连通测试完成',
  compensation_pending: '补偿任务待处理',
  compensation_running: '补偿任务处理中',
  compensation_succeeded: '补偿任务已完成',
  compensation_failed: '补偿任务失败',
  manual_review_required: '需要人工复核',
};

const roleLabels: Record<string, string> = {
  tenant_admin: '机构管理员',
  tenant_operator: '机构运营',
  consultant: '咨询师',
  customer_service: '客服',
  platform_admin: '平台管理员',
  platform_operator: '平台运营',
  security_auditor: '安全审计员',
};

function displayLabel(labels: Record<string, string>, value: string | null, fallback = '未归类') {
  if (!value) return null;
  return labels[value] ?? fallback;
}

function trimOrUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toIsoDateTime(value: string) {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Date(timestamp).toISOString();
}

function formToAuditQuery(form: AuditFilterForm): OpenPlatformAuditEventsQuery {
  return {
    from: toIsoDateTime(form.from),
    to: toIsoDateTime(form.to),
    tenantId: trimOrUndefined(form.tenantId),
    resource: trimOrUndefined(form.resource),
    resourceId: trimOrUndefined(form.resourceId),
    action: trimOrUndefined(form.action),
    result: trimOrUndefined(form.result),
    reason: trimOrUndefined(form.reason),
    actorId: trimOrUndefined(form.actorId),
    limit: trimOrUndefined(form.limit),
  };
}

function visibleAuditErrorState(error: OpenPlatformAuditEventsClientError): PlatformAuditStateProps {
  if (error.kind === 'unauthorized') {
    return {
      kind: 'error',
      title: '登录状态已失效，请重新登录',
    };
  }

  if (error.kind === 'forbidden') {
    return {
      kind: 'forbidden',
      title: '当前账号没有查看平台审计日志的权限',
    };
  }

  if (error.kind === 'service_unavailable') {
    return {
      kind: 'unavailable',
      title: '平台关键操作记录暂时不可用',
    };
  }

  return {
    kind: 'error',
    title: error.message || '平台关键操作记录请求失败',
  };
}

function formatAuditTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
  }).format(new Date(timestamp));
}

function PlatformAuditState({ title, description, kind }: PlatformAuditStateProps) {
  const isLoading = kind === 'loading';

  return (
    <div className="rounded-2xl border border-[#e6edf5] bg-[#f8fafc] px-4 py-8 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-700">
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-950">{title}</div>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}

function auditField(label: string, value: string | null) {
  return (
    <span className="rounded-full border border-[#e6edf5] bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
      {label}：{value ?? '-'}
    </span>
  );
}

export function OpenPlatformAuditEventsPanel() {
  const [records, setRecords] = useState<OpenPlatformAuditEventRecord[]>([]);
  const [pageInfo, setPageInfo] = useState<OpenPlatformAuditEventsPageInfo | null>(null);
  const [form, setForm] = useState<AuditFilterForm>(emptyAuditFilterForm);
  const [activeQuery, setActiveQuery] = useState<OpenPlatformAuditEventsQuery>(defaultAuditEventsQuery);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<Array<string | undefined>>([undefined]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorState, setErrorState] = useState<PlatformAuditStateProps | null>(null);

  async function loadAuditEvents(input: {
    query: OpenPlatformAuditEventsQuery;
    pageIndex: number;
    pageCursors: Array<string | undefined>;
  }) {
    const { query } = input;
    setIsLoading(true);
    setErrorState(null);

    const result = await listOpenPlatformAuditEvents(query);

    if (result.ok) {
      setRecords(result.records);
      setPageInfo(result.pageInfo);
      setPageIndex(input.pageIndex);
      setPageCursors(input.pageCursors);
    } else {
      setRecords([]);
      setPageInfo(null);
      setErrorState(visibleAuditErrorState(result.error));
    }

    setIsLoading(false);
  }

  useEffect(() => {
    let isActive = true;

    async function loadInitialAuditEvents() {
      setIsLoading(true);
      setErrorState(null);
      const result = await listOpenPlatformAuditEvents(defaultAuditEventsQuery);

      if (!isActive) return;

      if (result.ok) {
        setRecords(result.records);
        setPageInfo(result.pageInfo);
        setPageIndex(0);
        setPageCursors([undefined]);
      } else {
        setRecords([]);
        setPageInfo(null);
        setErrorState(visibleAuditErrorState(result.error));
      }

      setIsLoading(false);
    }

    void loadInitialAuditEvents();

    return () => {
      isActive = false;
    };
  }, []);

  function handleFieldChange(key: keyof AuditFilterForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = formToAuditQuery(form);
    setActiveQuery(nextQuery);
    void loadAuditEvents({ query: nextQuery, pageIndex: 0, pageCursors: [undefined] });
  }

  function handleResetFilters() {
    setForm(emptyAuditFilterForm);
    setActiveQuery(defaultAuditEventsQuery);
    void loadAuditEvents({
      query: defaultAuditEventsQuery,
      pageIndex: 0,
      pageCursors: [undefined],
    });
  }

  function handleNextPage() {
    if (!pageInfo?.nextCursor) return;
    const nextPageIndex = pageIndex + 1;
    const nextPageCursors = pageCursors.slice(0, nextPageIndex + 1);
    nextPageCursors[nextPageIndex] = pageInfo.nextCursor;
    void loadAuditEvents({
      query: { ...activeQuery, cursor: pageInfo.nextCursor },
      pageIndex: nextPageIndex,
      pageCursors: nextPageCursors,
    });
  }

  function handlePreviousPage() {
    if (pageIndex <= 0) return;
    const previousPageIndex = pageIndex - 1;
    const previousCursor = pageCursors[previousPageIndex];
    const previousQuery = previousCursor
      ? { ...activeQuery, cursor: previousCursor }
      : activeQuery;
    void loadAuditEvents({
      query: previousQuery,
      pageIndex: previousPageIndex,
      pageCursors,
    });
  }

  const isFilterDisabled = isLoading;

  return (
    <section className="space-y-5">
      <PlatformSectionBanner
        headingId="platform-audit-events-heading"
        title="平台审计日志"
        description="展示平台管理员查看租户、查看商业化健康和配额拒绝等关键操作，只展示白名单字段。不展示请求体、服务端错误细节、凭证、连接信息或机构业务敏感内容。"
      />

      <form
        className="rounded-xl border border-[#e6edf5] bg-white p-5 shadow-sm"
        onSubmit={handleApplyFilters}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-blue-50 text-blue-700">
              <Filter className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-950">筛选</h3>
              <p className="mt-0.5 text-xs text-slate-500">仅支持平台审计白名单字段，租户 ID 只用于平台侧筛选。</p>
              {isFilterDisabled ? (
                <p className="mt-1 text-xs font-semibold text-blue-700">加载期间筛选暂不可用</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleResetFilters}
              disabled={isFilterDisabled}
              className="inline-flex h-9 items-center justify-center rounded-full border border-[#e6edf5] bg-white px-3 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            >
              重置筛选
            </button>
            <button
              type="submit"
              disabled={isFilterDisabled}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-cyan-300 px-3 text-sm font-semibold text-[#06111f] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              <Search className="h-4 w-4" />
              应用筛选
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm font-semibold text-slate-600">
            开始时间
            <input
              type="datetime-local"
              value={form.from}
              onChange={(event) => handleFieldChange('from', event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-[#e6edf5] bg-[#f8fafc] px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
            />
          </label>
          <label className="text-sm font-semibold text-slate-600">
            结束时间
            <input
              type="datetime-local"
              value={form.to}
              onChange={(event) => handleFieldChange('to', event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-[#e6edf5] bg-[#f8fafc] px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
            />
          </label>
          <label className="text-sm font-semibold text-slate-600">
            租户 ID
            <input
              value={form.tenantId}
              onChange={(event) => handleFieldChange('tenantId', event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-[#e6edf5] bg-[#f8fafc] px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
            />
          </label>
          <label className="text-sm font-semibold text-slate-600">
            资源类型
            <select
              value={form.resource}
              onChange={(event) => handleFieldChange('resource', event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-[#e6edf5] bg-[#f8fafc] px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
            >
              <option value="">全部</option>
              {ACCESS_RESOURCES.map((resource) => (
                <option key={resource} value={resource}>
                  {displayLabel(resourceLabels, resource)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-600">
            资源 ID
            <input
              value={form.resourceId}
              onChange={(event) => handleFieldChange('resourceId', event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-[#e6edf5] bg-[#f8fafc] px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
            />
          </label>
          <label className="text-sm font-semibold text-slate-600">
            操作
            <select
              value={form.action}
              onChange={(event) => handleFieldChange('action', event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-[#e6edf5] bg-[#f8fafc] px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
            >
              <option value="">全部</option>
              {ACCESS_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {displayLabel(actionLabels, action)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-600">
            结果
            <select
              value={form.result}
              onChange={(event) => handleFieldChange('result', event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-[#e6edf5] bg-[#f8fafc] px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
            >
              <option value="">全部</option>
              {AUDIT_RESULT_VALUES.map((result) => (
                <option key={result} value={result}>
                  {displayLabel(resultLabels, result)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-600">
            原因
            <select
              value={form.reason}
              onChange={(event) => handleFieldChange('reason', event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-[#e6edf5] bg-[#f8fafc] px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
            >
              <option value="">全部</option>
              {AUDIT_REASON_VALUES.map((reason) => (
                <option key={reason} value={reason}>
                  {displayLabel(reasonLabels, reason)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-600">
            操作者 ID
            <input
              value={form.actorId}
              onChange={(event) => handleFieldChange('actorId', event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-[#e6edf5] bg-[#f8fafc] px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
            />
          </label>
          <label className="text-sm font-semibold text-slate-600">
            每页条数
            <select
              value={form.limit}
              onChange={(event) => handleFieldChange('limit', event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-[#e6edf5] bg-[#f8fafc] px-3 text-sm text-slate-700 outline-none focus:border-blue-300"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
        </div>
      </form>

      <article className="rounded-xl border border-[#e6edf5] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-normal text-slate-950">平台关键操作记录</h3>
            <p className="mt-1 text-sm text-slate-500">租户、套餐、商业化健康和拒绝事件按时间倒序排列。</p>
          </div>
          <span className="rounded-full border border-[#e6edf5] bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            {pageInfo ? `第 ${pageIndex + 1} 页 · 每页 ${pageInfo.limit} 条` : '每页 10 条'}
          </span>
        </div>

        {isLoading ? (
          <PlatformAuditState
            kind="loading"
            title="正在加载平台审计事件..."
          />
        ) : null}

        {!isLoading && errorState ? (
          <PlatformAuditState {...errorState} />
        ) : null}

        {!isLoading && !errorState && records.length === 0 ? (
          <PlatformAuditState
            kind="empty"
            title="暂无平台关键操作记录"
            description="当前筛选条件下没有可展示的平台关键操作。"
          />
        ) : null}

        {!isLoading && !errorState && records.length > 0 ? (
          <div className="mt-4 space-y-3">
            {records.map((record) => (
              <section
                key={record.id}
                className="rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-slate-950">
                        {record.id}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${resultToneClasses[record.result]}`}>
                        结果：{displayLabel(resultLabels, record.result)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {auditField('租户 ID', record.tenantId)}
                      {auditField('资源类型', displayLabel(resourceLabels, record.resource))}
                      {auditField('资源 ID', record.resourceId)}
                      {auditField('操作', displayLabel(actionLabels, record.action))}
                      {auditField('原因', displayLabel(reasonLabels, record.reason))}
                      {auditField('操作者', record.actorId)}
                      {auditField('角色', displayLabel(roleLabels, record.actorRole))}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-2xl border border-[#e6edf5] bg-white px-3 py-2 text-sm font-semibold text-slate-600">
                    时间：{formatAuditTime(record.occurredAt)}
                  </div>
                </div>
              </section>
            ))}

            {pageIndex > 0 || (pageInfo?.hasMore && pageInfo.nextCursor) ? (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handlePreviousPage}
                  disabled={isLoading || pageIndex <= 0}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#e6edf5] bg-white px-4 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:text-slate-500"
                >
                  上一页
                </button>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={isLoading || !pageInfo?.hasMore || !pageInfo.nextCursor}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#e6edf5] bg-white px-4 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:text-slate-500"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  下一页
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </article>
    </section>
  );
}
