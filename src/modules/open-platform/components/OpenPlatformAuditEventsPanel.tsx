'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
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
  limit: '',
};

const resultToneClasses = {
  allowed: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  denied: 'border-rose-100 bg-rose-50 text-rose-100',
  transitioned: 'border-blue-100 bg-blue-50 text-blue-700',
} as const;

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
  const [activeQuery, setActiveQuery] = useState<OpenPlatformAuditEventsQuery>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorState, setErrorState] = useState<PlatformAuditStateProps | null>(null);

  async function loadAuditEvents(input: {
    query: OpenPlatformAuditEventsQuery;
    mode: 'replace' | 'append';
  }) {
    const { mode, query } = input;
    if (mode === 'append') {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setErrorState(null);

    const result = await listOpenPlatformAuditEvents(query);

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
      setErrorState(visibleAuditErrorState(result.error));
    }

    if (mode === 'append') {
      setIsLoadingMore(false);
    } else {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isActive = true;

    async function loadInitialAuditEvents() {
      setIsLoading(true);
      setErrorState(null);
      const result = await listOpenPlatformAuditEvents();

      if (!isActive) return;

      if (result.ok) {
        setRecords(result.records);
        setPageInfo(result.pageInfo);
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

  const resultCounts = useMemo(
    () =>
      AUDIT_RESULT_VALUES.map((result) => ({
        result,
        count: records.filter((record) => record.result === result).length,
      })),
    [records],
  );

  function handleFieldChange(key: keyof AuditFilterForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = formToAuditQuery(form);
    setActiveQuery(nextQuery);
    void loadAuditEvents({ query: nextQuery, mode: 'replace' });
  }

  function handleResetFilters() {
    setForm(emptyAuditFilterForm);
    setActiveQuery({});
    void loadAuditEvents({ query: {}, mode: 'replace' });
  }

  function handleLoadMore() {
    if (!pageInfo?.nextCursor) return;
    void loadAuditEvents({
      query: { ...activeQuery, cursor: pageInfo.nextCursor },
      mode: 'append',
    });
  }

  const isFilterDisabled = isLoading || isLoadingMore;

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
                  {resource}
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
                  {action}
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
                  {result}
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
                  {reason}
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
              <option value="">默认</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
        </div>
      </form>

      <section className="grid gap-4 md:grid-cols-3">
        {resultCounts.map((item) => (
          <article
            key={item.result}
            className={`rounded-xl border p-4 shadow-sm ${resultToneClasses[item.result]}`}
          >
            <div className="text-xs font-semibold opacity-80">{item.result}</div>
            <div className="mt-2 text-2xl font-semibold">{isLoading ? '--' : item.count}</div>
          </article>
        ))}
      </section>

      <article className="rounded-xl border border-[#e6edf5] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-normal text-slate-950">平台关键操作记录</h3>
            <p className="mt-1 text-sm text-slate-500">租户、套餐、商业化健康和拒绝事件按时间倒序排列。</p>
          </div>
          <span className="rounded-full border border-[#e6edf5] bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            {pageInfo ? `limit ${pageInfo.limit}` : 'limit 默认'}
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
                        结果：{record.result}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {auditField('租户 ID', record.tenantId)}
                      {auditField('资源类型', record.resource)}
                      {auditField('资源 ID', record.resourceId)}
                      {auditField('操作', record.action)}
                      {auditField('原因', record.reason)}
                      {auditField('操作者', record.actorId)}
                      {auditField('角色', record.actorRole)}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-2xl border border-[#e6edf5] bg-white px-3 py-2 text-sm font-semibold text-slate-600">
                    时间：{formatAuditTime(record.occurredAt)}
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
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#e6edf5] bg-white px-4 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:text-slate-500"
                >
                  {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  加载更多平台审计事件
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </article>
    </section>
  );
}
