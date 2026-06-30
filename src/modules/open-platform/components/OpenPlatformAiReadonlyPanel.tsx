'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

import {
  listOpenPlatformAiUsageCredits,
  type OpenPlatformAiUsageCreditsFilters,
  type OpenPlatformAiUsageCreditsResponse,
  type PlatformAiUsageCreditsByDateDto,
  type PlatformAiUsageCreditsByMeteringStatusDto,
  type PlatformAiUsageCreditsByModelDto,
  type PlatformAiUsageCreditsByTenantDto,
  type PlatformAiUsageCreditDetailDto,
} from '@/modules/open-platform/client/platform-ai-usage-credits-client';
import { PlatformSectionBanner } from '@/modules/open-platform/components/PlatformSectionBanner';
import { cn } from '@/shared/utils/cn';

const numberFormatter = new Intl.NumberFormat('zh-CN');

type LoadState = 'loading' | 'ready' | 'error';

type FilterFormState = {
  tenantId: string;
  status: string;
  meteringStatus: string;
  provider: string;
  model: string;
  dateFrom: string;
  dateTo: string;
  limit: string;
};

const defaultFilters: FilterFormState = {
  tenantId: '',
  status: '',
  meteringStatus: '',
  provider: '',
  model: '',
  dateFrom: '',
  dateTo: '',
  limit: '50',
};

const emptyData: OpenPlatformAiUsageCreditsResponse = {
  requestId: 'platform-ai-usage-credits',
  readonly: true,
  dataSource: 'repository',
  summary: {
    totalCalls: 0,
    succeededCalls: 0,
    failedCalls: 0,
    meteredCalls: 0,
    pendingCalls: 0,
    notBillableCalls: 0,
    totalAiCreditsConsumed: 0,
  },
  aggregations: {
    byModel: [],
    byTenant: [],
    byMeteringStatus: [],
    byDate: [],
  },
  filterOptions: {
    providers: [],
    models: [],
    tenants: [],
    statuses: ['succeeded', 'failed', 'rejected', 'sensitive_input_rejected', 'rate_limited', 'provider_unavailable'],
    meteringStatuses: ['metered', 'pending', 'not_billable', 'legacy', 'empty'],
  },
  records: [],
  emptyState: {
    title: '暂无 AI 用量明细',
    description: '当前过滤条件下没有 AI 调用记录。',
  },
};

function toApiFilters(filters: FilterFormState): OpenPlatformAiUsageCreditsFilters {
  return {
    tenantId: filters.tenantId,
    status: filters.status,
    meteringStatus: filters.meteringStatus,
    provider: filters.provider,
    model: filters.model,
    dateFrom: filters.dateFrom ? new Date(filters.dateFrom).toISOString() : '',
    dateTo: filters.dateTo ? new Date(filters.dateTo).toISOString() : '',
    limit: filters.limit,
  };
}

function formatNumber(value: number | null | undefined) {
  return numberFormatter.format(value ?? 0);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    succeeded: '成功',
    failed: '失败',
    rejected: '已拒绝',
    sensitive_input_rejected: '敏感输入拒绝',
    rate_limited: '限流',
    provider_unavailable: '供应商不可用',
  };
  return labels[status] ?? status;
}

function meteringStatusLabel(status: string | null) {
  if (!status) return '未计量';
  const labels: Record<string, string> = {
    metered: '已计量',
    pending: '待计量',
    not_billable: '不计费',
    legacy: '历史记录',
    empty: '未计量',
  };
  return labels[status] ?? status;
}

function meteringStatusDescription(status: string | null) {
  if (status === 'metered') return '已按当前规则计算 AI 积分。';
  if (status === 'pending') return '缺少有效规则或 Token 数据，暂待后续处理。';
  if (status === 'not_billable') return '调用未成功或不满足计费条件，AI 积分记为 0。';
  if (status === 'legacy') return '历史数据未进入新计量链路。';
  return '暂无计量状态。';
}

function errorMessage(kind: string) {
  if (kind === 'unauthorized') return '请先登录平台端。';
  if (kind === 'forbidden') return '当前账号没有查看平台 AI 用量的权限。';
  if (kind === 'validation_error') return '筛选条件不正确，请检查后重试。';
  if (kind === 'service_unavailable') return 'AI 用量与积分明细服务暂不可用，请稍后重试。';
  return 'AI 用量与积分明细请求失败，请稍后重试。';
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim())));
}

function SearchableFilterInput(props: {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label?: string }>;
  placeholder: string;
  helper: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-[#1f2937]" htmlFor={props.id}>
      {props.label}
      <input
        id={props.id}
        aria-label={props.label}
        list={`${props.id}-options`}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-[#dbe3ee] bg-white px-3 text-sm font-normal"
        placeholder={props.placeholder}
      />
      <datalist id={`${props.id}-options`}>
        {props.options.map((option) => (
          <option key={`${props.id}:${option.value}`} value={option.value} label={option.label} />
        ))}
      </datalist>
      <span className="mt-1 block text-xs font-normal leading-5 text-[#64748b]">{props.helper}</span>
    </label>
  );
}

function SummaryCard(props: { label: string; value: string; tone?: string }) {
  return (
    <article className={cn('rounded-[18px] border border-[#e6edf5] bg-white p-4 shadow-sm', props.tone)}>
      <div className="text-xs font-semibold text-[#64748b]">{props.label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-normal text-[#1f2937]">{props.value}</div>
    </article>
  );
}

function EmptyAggregation({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-6 text-center text-sm text-[#64748b]">
      暂无{label}数据
    </div>
  );
}

function ModelAggregationTable({ rows }: { rows: PlatformAiUsageCreditsByModelDto[] }) {
  if (rows.length === 0) return <EmptyAggregation label="模型用量统计" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-[#f8fafc] text-xs font-semibold text-[#64748b]">
          <tr>
            <th className="px-4 py-3">模型厂商 / 模型名称</th>
            <th className="px-4 py-3">总调用</th>
            <th className="px-4 py-3">成功 / 失败</th>
            <th className="px-4 py-3">已计量</th>
            <th className="px-4 py-3">Token 总量</th>
            <th className="px-4 py-3">AI 积分消耗</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e6edf5]">
          {rows.map((row) => (
            <tr key={`${row.provider}:${row.model}`}>
              <td className="px-4 py-3">
                <div className="font-semibold text-[#1f2937]">{row.provider}</div>
                <div className="mt-1 text-xs text-[#94a3b8]">{row.model}</div>
              </td>
              <td className="px-4 py-3 text-[#1f2937]">{formatNumber(row.totalCalls)}</td>
              <td className="px-4 py-3 text-[#64748b]">{formatNumber(row.succeededCalls)} / {formatNumber(row.failedCalls)}</td>
              <td className="px-4 py-3 text-[#1f2937]">{formatNumber(row.meteredCalls)}</td>
              <td className="px-4 py-3 text-[#1f2937]">{formatNumber(row.totalTokens)}</td>
              <td className="px-4 py-3 font-semibold text-[#2563eb]">{formatNumber(row.totalAiCreditsConsumed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TenantAggregationTable({ rows }: { rows: PlatformAiUsageCreditsByTenantDto[] }) {
  if (rows.length === 0) return <EmptyAggregation label="租户用量统计" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-[#f8fafc] text-xs font-semibold text-[#64748b]">
          <tr>
            <th className="px-4 py-3">租户</th>
            <th className="px-4 py-3">总调用</th>
            <th className="px-4 py-3">成功 / 失败</th>
            <th className="px-4 py-3">已计量</th>
            <th className="px-4 py-3">待计量</th>
            <th className="px-4 py-3">不计费</th>
            <th className="px-4 py-3">AI 积分消耗</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e6edf5]">
          {rows.map((row) => (
            <tr key={row.tenantId}>
              <td className="px-4 py-3">
                <div className="font-semibold text-[#1f2937]">{row.tenantName ?? '未命名租户'}</div>
                <div className="mt-1 text-xs text-[#94a3b8]">{row.tenantId}</div>
              </td>
              <td className="px-4 py-3 text-[#1f2937]">{formatNumber(row.totalCalls)}</td>
              <td className="px-4 py-3 text-[#64748b]">{formatNumber(row.succeededCalls)} / {formatNumber(row.failedCalls)}</td>
              <td className="px-4 py-3 text-[#1f2937]">{formatNumber(row.meteredCalls)}</td>
              <td className="px-4 py-3 text-[#1f2937]">{formatNumber(row.pendingCalls)}</td>
              <td className="px-4 py-3 text-[#1f2937]">{formatNumber(row.notBillableCalls)}</td>
              <td className="px-4 py-3 font-semibold text-[#2563eb]">{formatNumber(row.totalAiCreditsConsumed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MeteringStatusAggregation({ rows }: { rows: PlatformAiUsageCreditsByMeteringStatusDto[] }) {
  if (rows.length === 0) return <EmptyAggregation label="计量状态统计" />;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <article key={row.meteringStatus} className="rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-4">
          <div className="text-sm font-semibold text-[#1f2937]">{meteringStatusLabel(row.meteringStatus)}</div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs font-semibold text-[#64748b]">调用次数</div>
              <div className="mt-1 text-lg font-semibold text-[#1f2937]">{formatNumber(row.calls)}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-[#64748b]">AI 积分消耗</div>
              <div className="mt-1 text-lg font-semibold text-[#2563eb]">{formatNumber(row.totalAiCreditsConsumed)}</div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function DateAggregationTable({ rows }: { rows: PlatformAiUsageCreditsByDateDto[] }) {
  if (rows.length === 0) return <EmptyAggregation label="日期用量趋势" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="bg-[#f8fafc] text-xs font-semibold text-[#64748b]">
          <tr>
            <th className="px-4 py-3">日期</th>
            <th className="px-4 py-3">总调用</th>
            <th className="px-4 py-3">成功调用</th>
            <th className="px-4 py-3">失败调用</th>
            <th className="px-4 py-3">AI 积分消耗</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e6edf5]">
          {rows.map((row) => (
            <tr key={row.date}>
              <td className="px-4 py-3 font-semibold text-[#1f2937]">{row.date}</td>
              <td className="px-4 py-3 text-[#1f2937]">{formatNumber(row.totalCalls)}</td>
              <td className="px-4 py-3 text-[#1f2937]">{formatNumber(row.succeededCalls)}</td>
              <td className="px-4 py-3 text-[#64748b]">{formatNumber(row.failedCalls)}</td>
              <td className="px-4 py-3 font-semibold text-[#2563eb]">{formatNumber(row.totalAiCreditsConsumed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AggregationCard(props: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e6edf5] bg-white" aria-labelledby={`${props.title}-heading`}>
      <div className="border-b border-[#e6edf5] px-4 py-3">
        <h3 id={`${props.title}-heading`} className="text-sm font-semibold text-[#1f2937]">{props.title}</h3>
        <p className="mt-1 text-xs leading-5 text-[#64748b]">{props.description}</p>
      </div>
      {props.children}
    </section>
  );
}

function DetailRow({ record }: { record: PlatformAiUsageCreditDetailDto }) {
  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="font-semibold text-[#1f2937]">{record.tenantName ?? '未命名租户'}</div>
        <div className="mt-1 text-xs text-[#94a3b8]">{record.tenantId}</div>
      </td>
      <td className="px-4 py-3">
        <div className="font-semibold text-[#1f2937]">{statusLabel(record.status)}</div>
        <div className="mt-1 text-xs text-[#94a3b8]">{record.errorCode ?? '无错误码'}</div>
      </td>
      <td className="px-4 py-3">
        <div className="font-semibold text-[#1f2937]">{record.provider}</div>
        <div className="mt-1 text-xs text-[#94a3b8]">{record.model}</div>
      </td>
      <td className="px-4 py-3 text-[#1f2937]">
        <div>输入 {formatNumber(record.promptTokens)}</div>
        <div className="mt-1">输出 {formatNumber(record.completionTokens)}</div>
        <div className="mt-1 font-semibold">总计 {formatNumber(record.totalTokens)}</div>
      </td>
      <td className="px-4 py-3">
        <div className="font-semibold text-[#2563eb]">{formatNumber(record.aiCreditsConsumed)}</div>
        <div className="mt-1 text-xs text-[#64748b]">{meteringStatusLabel(record.meteringStatus)}</div>
        <div className="mt-1 text-xs leading-5 text-[#94a3b8]">{meteringStatusDescription(record.meteringStatus)}</div>
      </td>
      <td className="px-4 py-3">
        <div className="font-semibold text-[#1f2937]">{record.meteringVersion ?? '无版本'}</div>
        <div className="mt-1 text-xs text-[#64748b]">
          {record.knowledgeContextUsed ? `使用知识库 · ${record.sourceCount} 个来源` : '未使用知识库'}
        </div>
      </td>
      <td className="px-4 py-3 text-[#64748b]">{formatDateTime(record.createdAt)}</td>
    </tr>
  );
}

export function OpenPlatformAiReadonlyPanel() {
  const [filters, setFilters] = useState<FilterFormState>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterFormState>(defaultFilters);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [data, setData] = useState<OpenPlatformAiUsageCreditsResponse>(emptyData);
  const [error, setError] = useState('');

  async function loadUsage(nextFilters: FilterFormState) {
    const result = await listOpenPlatformAiUsageCredits(toApiFilters(nextFilters));
    if (!result.ok) {
      setData(emptyData);
      setError(errorMessage(result.error.kind));
      setLoadState('error');
      return;
    }

    setData(result.data);
    setError('');
    setLoadState('ready');
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialUsage() {
      const result = await listOpenPlatformAiUsageCredits(toApiFilters(defaultFilters));
      if (!isMounted) return;

      if (!result.ok) {
        setData(emptyData);
        setError(errorMessage(result.error.kind));
        setLoadState('error');
        return;
      }

      setData(result.data);
      setError('');
      setLoadState('ready');
    }

    void loadInitialUsage();

    return () => {
      isMounted = false;
    };
  }, []);

  function updateFilter(key: keyof FilterFormState, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters() {
    setLoadState('loading');
    setAppliedFilters(filters);
    void loadUsage(filters);
  }

  function resetFilters() {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setLoadState('loading');
    void loadUsage(defaultFilters);
  }

  function refreshUsage() {
    setLoadState('loading');
    void loadUsage(appliedFilters);
  }

  const summary = data.summary;
  const providerOptions = data.filterOptions.providers.map((option) => ({ value: option.provider }));
  const modelOptions = data.filterOptions.models
    .filter((option) => !filters.provider.trim() || option.provider === filters.provider.trim())
    .map((option) => ({ value: option.model, label: option.provider }));
  const tenantOptions = data.filterOptions.tenants.map((option) => ({
    value: option.tenantId,
    label: option.tenantName ?? '未命名租户',
  }));
  const statusOptions = uniqueStrings(data.filterOptions.statuses);
  const meteringStatusOptions = uniqueStrings(data.filterOptions.meteringStatuses);

  return (
    <section className="flex flex-col gap-6" aria-labelledby="ai-usage-heading">
      <PlatformSectionBanner
        headingId="ai-usage-banner-heading"
        headingLevel="h1"
        title="AI用量与费用"
        description="平台端只读查看 AI 调用、计量状态和积分消耗明细；仅展示运营低敏字段，不返回原始问题、回答、模型厂商凭证或客户高敏信息。"
      />

      <section className="rounded-[20px] border border-[#e6edf5] bg-white p-5 shadow-sm" aria-labelledby="ai-usage-heading">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 id="ai-usage-heading" className="text-lg font-semibold tracking-normal text-[#1f2937]">AI 用量与积分明细</h2>
            <p className="mt-1 text-sm leading-6 text-[#64748b]">汇总和明细均来自 AI 调用记录，只读展示计量状态，不执行扣减、导出或模型厂商调用。</p>
          </div>
          <button
            type="button"
            onClick={refreshUsage}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#dbeafe] bg-[#eaf3ff] px-4 text-sm font-semibold text-[#2563eb] transition hover:bg-[#dbeafe]"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <SummaryCard label="总调用" value={formatNumber(summary.totalCalls)} />
          <SummaryCard label="成功调用" value={formatNumber(summary.succeededCalls)} tone="bg-emerald-50" />
          <SummaryCard label="失败调用" value={formatNumber(summary.failedCalls)} tone="bg-rose-50" />
          <SummaryCard label="已计量" value={formatNumber(summary.meteredCalls)} tone="bg-blue-50" />
          <SummaryCard label="待计量" value={formatNumber(summary.pendingCalls)} tone="bg-amber-50" />
          <SummaryCard label="不计费" value={formatNumber(summary.notBillableCalls)} tone="bg-slate-50" />
          <SummaryCard label="AI 积分消耗" value={formatNumber(summary.totalAiCreditsConsumed)} tone="bg-indigo-50" />
        </div>

        <form
          className="mt-5 grid gap-3 rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-4 md:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <SearchableFilterInput
            id="ai-usage-tenant-filter"
            label="租户"
            value={filters.tenantId}
            options={tenantOptions}
            placeholder="输入或选择租户ID"
            helper="可从候选租户中选择，也可手动输入历史租户ID。"
            onChange={(value) => updateFilter('tenantId', value)}
          />
          <label className="text-sm font-semibold text-[#1f2937]">
            调用状态
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[#dbe3ee] bg-white px-3 text-sm font-normal">
              <option value="">全部状态</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-[#1f2937]">
            计量状态
            <select value={filters.meteringStatus} onChange={(event) => updateFilter('meteringStatus', event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[#dbe3ee] bg-white px-3 text-sm font-normal">
              <option value="">全部计量状态</option>
              {meteringStatusOptions.map((status) => (
                <option key={status} value={status}>{meteringStatusLabel(status)}</option>
              ))}
            </select>
          </label>
          <SearchableFilterInput
            id="ai-usage-provider-filter"
            label="模型厂商"
            value={filters.provider}
            options={providerOptions}
            placeholder="输入或选择模型厂商"
            helper="可搜索候选厂商，也可手动输入历史值或异常值。"
            onChange={(value) => updateFilter('provider', value)}
          />
          <SearchableFilterInput
            id="ai-usage-model-filter"
            label="模型名称"
            value={filters.model}
            options={modelOptions}
            placeholder="输入或选择模型名称"
            helper="已选择模型厂商时，仅展示该厂商下的候选模型；仍可手动输入。"
            onChange={(value) => updateFilter('model', value)}
          />
          <label className="text-sm font-semibold text-[#1f2937]">
            开始时间
            <input type="datetime-local" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[#dbe3ee] bg-white px-3 text-sm font-normal" />
          </label>
          <label className="text-sm font-semibold text-[#1f2937]">
            结束时间
            <input type="datetime-local" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[#dbe3ee] bg-white px-3 text-sm font-normal" />
          </label>
          <label className="text-sm font-semibold text-[#1f2937]">
            返回条数
            <input type="number" min="1" max="100" value={filters.limit} onChange={(event) => updateFilter('limit', event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[#dbe3ee] bg-white px-3 text-sm font-normal" />
          </label>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
            <button type="submit" className="h-10 rounded-xl bg-[#2563eb] px-4 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]">应用筛选</button>
            <button type="button" onClick={resetFilters} className="h-10 rounded-xl border border-[#dbe3ee] bg-white px-4 text-sm font-semibold text-[#64748b] transition hover:bg-[#f1f5f9]">清空筛选</button>
          </div>
        </form>

        {loadState === 'loading' ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-8 text-center text-sm text-[#64748b]">正在加载 AI 用量与积分明细...</div>
        ) : null}

        {loadState === 'ready' ? (
          <div className="mt-5 grid gap-4">
            <div>
              <h3 className="text-base font-semibold text-[#1f2937]">AI 积分消耗统计</h3>
              <p className="mt-1 text-sm leading-6 text-[#64748b]">按筛选条件汇总模型、租户、计量状态和日期维度的只读用量，不包含账单导出、费用结算或功能场景统计。</p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <AggregationCard title="模型用量统计" description="按模型厂商和模型名称统计调用、Token 与 AI 积分消耗。">
                <ModelAggregationTable rows={data.aggregations.byModel} />
              </AggregationCard>

              <AggregationCard title="租户用量统计" description="按租户低敏标识统计调用成功、失败、计量状态和 AI 积分消耗。">
                <TenantAggregationTable rows={data.aggregations.byTenant} />
              </AggregationCard>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <AggregationCard title="计量状态统计" description="按已计量、待计量、不计费、未计量和历史记录归类。">
                <div className="p-4">
                  <MeteringStatusAggregation rows={data.aggregations.byMeteringStatus} />
                </div>
              </AggregationCard>

              <AggregationCard title="日期用量趋势" description="按日期展示调用量和 AI 积分消耗，便于对齐旧版每日消耗口径。">
                <DateAggregationTable rows={data.aggregations.byDate} />
              </AggregationCard>
            </div>
          </div>
        ) : null}

        {loadState === 'error' ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
            <div className="font-semibold">明细列表暂不可用。</div>
            <p className="mt-1">{error}</p>
          </div>
        ) : null}

        {loadState === 'ready' && data.records.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-8 text-center">
            <div className="text-sm font-semibold text-[#1f2937]">{data.emptyState.title}</div>
            <p className="mt-2 text-sm text-[#64748b]">{data.emptyState.description}</p>
          </div>
        ) : null}

        {loadState === 'ready' && data.records.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-[#e6edf5] bg-white">
            <div className="border-b border-[#e6edf5] px-4 py-3 text-sm font-semibold text-[#1f2937]">明细列表</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="bg-[#f8fafc] text-xs font-semibold text-[#64748b]">
                  <tr>
                    <th className="px-4 py-3">租户</th>
                    <th className="px-4 py-3">调用状态</th>
                    <th className="px-4 py-3">模型厂商 / 模型名称</th>
                    <th className="px-4 py-3">Token</th>
                    <th className="px-4 py-3">AI 积分 / 计量</th>
                    <th className="px-4 py-3">计量版本 / RAG</th>
                    <th className="px-4 py-3">创建时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6edf5]">
                  {data.records.map((record) => <DetailRow key={record.id} record={record} />)}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}
