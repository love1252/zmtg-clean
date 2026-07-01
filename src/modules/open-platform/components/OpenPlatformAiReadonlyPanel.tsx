'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

import {
  listOpenPlatformAiUsageCredits,
  type OpenPlatformAiUsageCreditsFilters,
  type OpenPlatformAiUsageCreditsResponse,
  type PlatformAiUsageCreditsByDateProviderDto,
  type PlatformAiUsageCreditsByMeteringStatusDto,
  type PlatformAiUsageCreditsByModelDto,
  type PlatformAiUsageCreditsByTenantDto,
  type PlatformAiUsageCreditDetailDto,
  type PlatformAiUsageCreditsFilterModelOptionDto,
  type PlatformAiUsageCreditsFilterProviderOptionDto,
  type PlatformAiUsageCreditsFilterTenantOptionDto,
} from '@/modules/open-platform/client/platform-ai-usage-credits-client';
import { PlatformSectionBanner } from '@/modules/open-platform/components/PlatformSectionBanner';
import { cn } from '@/shared/utils/cn';

const numberFormatter = new Intl.NumberFormat('zh-CN');

type LoadState = 'loading' | 'ready' | 'error';

type TimeRangePreset = 'today' | 'last7Days' | 'thisMonth' | 'lastMonth' | 'custom';

type FilterFormState = {
  tenantId: string;
  status: string;
  meteringStatus: string;
  provider: string;
  model: string;
  dateFrom: string;
  dateTo: string;
  limit: string;
  timeRange: TimeRangePreset;
};

const timeRangePresets: Array<{ key: TimeRangePreset; label: string }> = [
  { key: 'today', label: '今日' },
  { key: 'last7Days', label: '近7天' },
  { key: 'thisMonth', label: '本月' },
  { key: 'lastMonth', label: '上月' },
  { key: 'custom', label: '自定义时间范围' },
];

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function formatDateTimeLocal(date: Date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-') + `T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

function timeRangeDates(preset: Exclude<TimeRangePreset, 'custom'>, now = new Date()) {
  if (preset === 'today') {
    return {
      dateFrom: formatDateTimeLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0)),
      dateTo: formatDateTimeLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59)),
    };
  }

  if (preset === 'last7Days') {
    return {
      dateFrom: formatDateTimeLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0)),
      dateTo: formatDateTimeLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59)),
    };
  }

  if (preset === 'lastMonth') {
    return {
      dateFrom: formatDateTimeLocal(new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0)),
      dateTo: formatDateTimeLocal(new Date(now.getFullYear(), now.getMonth(), 0, 23, 59)),
    };
  }

  return {
    dateFrom: formatDateTimeLocal(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0)),
    dateTo: formatDateTimeLocal(new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59)),
  };
}

function createDefaultFilters(): FilterFormState {
  return {
    tenantId: '',
    status: '',
    meteringStatus: '',
    provider: '',
    model: '',
    ...timeRangeDates('thisMonth'),
    limit: '50',
    timeRange: 'thisMonth',
  };
}

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
    byDateProvider: [],
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

function formatDateOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatShortMonthDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function formatMonthUsageTitle(filters: FilterFormState) {
  const date = filters.dateFrom ? new Date(filters.dateFrom) : new Date();
  if (Number.isNaN(date.getTime())) return '当前时间范围用量';
  return `${date.getFullYear()}年${padDatePart(date.getMonth() + 1)}月用量`;
}

function formatDateRangeSummary(filters: FilterFormState) {
  if (!filters.dateFrom || !filters.dateTo) return '未限定时间范围';
  return `${formatDateOnly(filters.dateFrom)} - ${formatDateOnly(filters.dateTo)}`;
}

function formatPercent(numerator: number, denominator: number) {
  if (denominator <= 0) return '0%';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function totalTokensFromAggregations(data: OpenPlatformAiUsageCreditsResponse) {
  const modelTokens = data.aggregations.byModel.reduce((total, row) => total + row.totalTokens, 0);
  if (modelTokens > 0) return modelTokens;
  return data.aggregations.byDateProvider.reduce((total, row) => total + row.totalTokens, 0);
}

type PeakDaySummary = {
  date: string;
  totalCalls: number;
  totalTokens: number;
  totalAiCreditsConsumed: number;
} | null;

function peakDayFromDateProviders(rows: PlatformAiUsageCreditsByDateProviderDto[]): PeakDaySummary {
  const grouped = new Map<string, Exclude<PeakDaySummary, null>>();

  rows.forEach((row) => {
    const current = grouped.get(row.date) ?? {
      date: row.date,
      totalCalls: 0,
      totalTokens: 0,
      totalAiCreditsConsumed: 0,
    };
    current.totalCalls += row.totalCalls;
    current.totalTokens += row.totalTokens;
    current.totalAiCreditsConsumed += row.totalAiCreditsConsumed;
    grouped.set(row.date, current);
  });

  return Array.from(grouped.values()).sort((left, right) => (
    right.totalAiCreditsConsumed - left.totalAiCreditsConsumed ||
    right.totalCalls - left.totalCalls ||
    left.date.localeCompare(right.date)
  ))[0] ?? null;
}

function successRateFromCalls(succeededCalls: number, failedCalls: number) {
  const total = succeededCalls + failedCalls;
  return formatPercent(succeededCalls, total);
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

function providerFilterOption(option: PlatformAiUsageCreditsFilterProviderOptionDto): SearchableFilterOption {
  const title = option.displayName ?? option.provider;
  return {
    value: option.provider,
    title,
    subtitle: option.displayName ? option.provider : filterOptionSourceLabel(option.source),
    badge: filterOptionSourceLabel(option.source),
    logoUrl: option.logoUrl,
    logoText: option.logoText,
    logoClassName: option.logoClassName,
    keywords: [option.provider, option.displayName ?? '', filterOptionSourceLabel(option.source)],
  };
}

function modelFilterOption(option: PlatformAiUsageCreditsFilterModelOptionDto): SearchableFilterOption {
  const title = option.displayName ?? option.model;
  const providerLabel = option.providerDisplayName ?? option.provider;
  return {
    value: option.model,
    title,
    subtitle: option.displayName ? `${option.model} · ${providerLabel}` : `${providerLabel} · ${filterOptionSourceLabel(option.source)}`,
    badge: filterOptionSourceLabel(option.source),
    logoUrl: option.logoUrl,
    logoText: option.logoText,
    logoClassName: option.logoClassName,
    keywords: [option.model, option.displayName ?? '', option.provider, option.providerDisplayName ?? '', filterOptionSourceLabel(option.source)],
  };
}

function tenantFilterOption(option: PlatformAiUsageCreditsFilterTenantOptionDto): SearchableFilterOption {
  const title = option.tenantName ?? option.tenantId;
  return {
    value: option.tenantId,
    title,
    subtitle: option.tenantName ? option.tenantId : '未命名租户',
    logoText: title.slice(0, 1).toUpperCase(),
    logoClassName: 'bg-sky-600',
    keywords: [option.tenantId, option.tenantName ?? ''],
  };
}

type SearchableFilterOption = {
  value: string;
  title: string;
  subtitle?: string;
  badge?: string;
  logoUrl?: string | null;
  logoText?: string | null;
  logoClassName?: string | null;
  keywords: string[];
};

type UsageStatsMetric = 'calls' | 'tokens' | 'credits';
type AiUsageTab = 'overview' | 'models' | 'tenants' | 'metering' | 'details';

type ProviderModelUsageStat = {
  provider: string;
  providerOption: SearchableFilterOption;
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  totalTokens: number;
  totalAiCreditsConsumed: number;
  models: Array<{
    provider: string;
    model: string;
    modelOption: SearchableFilterOption;
    totalCalls: number;
    succeededCalls: number;
    failedCalls: number;
    totalTokens: number;
    totalAiCreditsConsumed: number;
  }>;
};

const usageStatsMetrics: Array<{ key: UsageStatsMetric; label: string; shortLabel: string }> = [
  { key: 'calls', label: '调用次数', shortLabel: '调用' },
  { key: 'tokens', label: 'Token 总量', shortLabel: 'Token' },
  { key: 'credits', label: 'AI 积分消耗', shortLabel: '积分' },
];

const providerBarColors = ['#2563eb', '#059669', '#7c3aed', '#ea580c', '#0891b2', '#db2777', '#4f46e5', '#16a34a'];

const aiUsageTabs: Array<{ key: AiUsageTab; label: string }> = [
  { key: 'overview', label: '总览' },
  { key: 'models', label: '模型与厂商' },
  { key: 'tenants', label: '租户用量' },
  { key: 'metering', label: '计量状态' },
  { key: 'details', label: '明细记录' },
];

function filterOptionSourceLabel(source: 'configured' | 'system' | 'history') {
  if (source === 'configured') return '已配置';
  if (source === 'system') return '系统值';
  return '历史值';
}

function optionLogo(option: SearchableFilterOption, className?: string) {
  const logoClassName = option.logoClassName ?? 'bg-slate-500';
  if (option.logoUrl) {
    return (
      <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#e2e8f0] bg-white', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={option.logoUrl} alt="" className="h-5 w-5 object-contain" />
      </span>
    );
  }
  return (
    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white', logoClassName, className)}>
      {option.logoText ?? option.title.slice(0, 1).toUpperCase()}
    </span>
  );
}

function optionMatchesQuery(option: SearchableFilterOption, query: string) {
  return option.keywords.some((keyword) => keyword.toLowerCase().includes(query));
}

function usageMetricValue(row: Pick<PlatformAiUsageCreditsByModelDto, 'totalCalls' | 'totalTokens' | 'totalAiCreditsConsumed'>, metric: UsageStatsMetric) {
  if (metric === 'calls') return row.totalCalls;
  if (metric === 'tokens') return row.totalTokens;
  return row.totalAiCreditsConsumed;
}

function providerColor(provider: string) {
  const hash = provider.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  return providerBarColors[hash % providerBarColors.length];
}

function fallbackProviderOption(provider: string): SearchableFilterOption {
  return {
    value: provider,
    title: provider,
    subtitle: '历史值',
    badge: '历史值',
    logoText: provider.slice(0, 1).toUpperCase(),
    logoClassName: 'bg-slate-500',
    keywords: [provider, '历史值'],
  };
}

function fallbackModelOption(row: Pick<PlatformAiUsageCreditsByModelDto, 'provider' | 'model'>): SearchableFilterOption {
  return {
    value: row.model,
    title: row.model,
    subtitle: `${row.provider} · 历史值`,
    badge: '历史值',
    logoText: row.provider.slice(0, 1).toUpperCase(),
    logoClassName: 'bg-slate-500',
    keywords: [row.model, row.provider, '历史值'],
  };
}

function SearchableFilterInput(props: {
  id: string;
  label: string;
  value: string;
  options: SearchableFilterOption[];
  placeholder: string;
  helper: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLLabelElement | null>(null);
  const selectedOption = useMemo(() => props.options.find((option) => option.value === props.value), [props.options, props.value]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return props.options;
    return props.options.filter((option) => optionMatchesQuery(option, normalizedQuery));
  }, [normalizedQuery, props.options]);
  const displayValue = isOpen ? query : (selectedOption?.title ?? props.value);

  function openOptions(nextQuery = '') {
    setQuery(nextQuery);
    setIsOpen(true);
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <label ref={rootRef} className="relative text-sm font-semibold text-[#1f2937]" htmlFor={props.id}>
      {props.label}
      <div className="relative mt-1">
        {selectedOption && !isOpen ? (
          <span className="pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2">
            {optionLogo(selectedOption, 'h-6 w-6 text-[11px]')}
          </span>
        ) : null}
        <input
          id={props.id}
          role="combobox"
          aria-label={props.label}
          aria-expanded={isOpen}
          aria-controls={`${props.id}-listbox`}
          aria-haspopup="listbox"
          value={displayValue}
          onFocus={() => openOptions('')}
          onClick={() => openOptions('')}
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            props.onChange(nextValue);
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setIsOpen(false);
          }}
          className={cn(
            'h-10 w-full rounded-xl border border-[#dbe3ee] bg-white px-3 text-sm font-normal outline-none transition focus:border-[#93c5fd] focus:ring-2 focus:ring-[#dbeafe]',
            selectedOption && !isOpen ? 'pl-10' : '',
          )}
          placeholder={props.placeholder}
        />
      </div>
      {selectedOption && !isOpen ? (
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-normal leading-5 text-[#64748b]">
          <span className="truncate font-semibold text-[#1f2937]">{selectedOption.title}</span>
          {selectedOption.subtitle ? <span className="truncate">{selectedOption.subtitle}</span> : null}
          {selectedOption.badge ? <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[11px] font-semibold text-[#4f46e5]">{selectedOption.badge}</span> : null}
        </div>
      ) : null}
      {isOpen ? (
        <div
          id={`${props.id}-listbox`}
          role="listbox"
          aria-label={`${props.label}候选项`}
          className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-[#dbe3ee] bg-white p-1 shadow-lg shadow-slate-200/70"
        >
          {filteredOptions.length > 0 ? filteredOptions.map((option) => (
            <button
              key={`${props.id}:${option.value}`}
              type="button"
              role="option"
              aria-selected={props.value === option.value}
              onClick={() => {
                props.onChange(option.value);
                setQuery('');
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-[#f1f5f9] focus:bg-[#eef6ff] focus:outline-none"
            >
              {optionLogo(option)}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[#1f2937]">{option.title}</span>
                {option.subtitle ? <span className="mt-0.5 block truncate text-xs font-normal text-[#64748b]">{option.subtitle}</span> : null}
              </span>
              {option.badge ? <span className="shrink-0 rounded-full bg-[#eef2ff] px-2 py-0.5 text-[11px] font-semibold text-[#4f46e5]">{option.badge}</span> : null}
            </button>
          )) : (
            <div className="rounded-lg px-3 py-3 text-sm font-normal text-[#64748b]">暂无候选，可手动输入</div>
          )}
        </div>
      ) : null}
      <span className="mt-1 block text-xs font-normal leading-5 text-[#64748b]">{props.helper}</span>
    </label>
  );
}

function LegacyOverviewMetricCard(props: { label: string; value: string; helper?: string; tone?: 'default' | 'success' | 'warning' | 'blue' }) {
  const toneClassName = {
    default: 'border-[#e6edf5] bg-white text-[#1f2937]',
    success: 'border-emerald-100 bg-[#e8f9ef] text-[#047857]',
    warning: 'border-amber-100 bg-[#fff7e6] text-[#d97706]',
    blue: 'border-blue-100 bg-[#eef6ff] text-[#2563eb]',
  }[props.tone ?? 'default'];

  return (
    <article className={cn('min-w-0 rounded-xl border px-3 py-2 shadow-sm', toneClassName)}>
      <div className="text-[11px] font-semibold text-[#64748b]">{props.label}</div>
      <div className="mt-1 break-words text-lg font-bold leading-tight tracking-tight">{props.value}</div>
      {props.helper ? <div className="mt-1 break-words text-[11px] leading-4 text-[#64748b]">{props.helper}</div> : null}
    </article>
  );
}

function EmptyAggregation({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-5 text-center text-sm text-[#64748b]">
      暂无{label}数据
    </div>
  );
}

function ModelAggregationTable({
  rows,
  providerOptions,
  modelOptions,
}: {
  rows: PlatformAiUsageCreditsByModelDto[];
  providerOptions: SearchableFilterOption[];
  modelOptions: SearchableFilterOption[];
}) {
  if (rows.length === 0) return <EmptyAggregation label="模型用量统计" />;
  const providersByCode = new Map(providerOptions.map((option) => [option.value, option]));
  const modelsByKey = new Map(rows.map((row) => {
    const option = modelOptions.find((candidate) => candidate.value === row.model && candidate.keywords.includes(row.provider)) ?? fallbackModelOption(row);
    return [`${row.provider}:${row.model}`, option] as const;
  }));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-[#f8fafc] text-xs font-semibold text-[#64748b]">
          <tr>
            <th className="px-3 py-2">模型厂商 / 模型名称</th>
            <th className="px-3 py-2">总调用</th>
            <th className="px-3 py-2">成功 / 失败</th>
            <th className="px-3 py-2">已计量</th>
            <th className="px-3 py-2">Token 总量</th>
            <th className="px-3 py-2">AI 积分消耗</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e6edf5]">
          {rows.map((row) => {
            const providerOption = providersByCode.get(row.provider) ?? fallbackProviderOption(row.provider);
            const modelOption = modelsByKey.get(`${row.provider}:${row.model}`) ?? fallbackModelOption(row);
            return (
              <tr key={`${row.provider}:${row.model}`}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {optionLogo(providerOption)}
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-[#1f2937]">{providerOption.title}</div>
                      <div className="mt-1 truncate text-xs text-[#94a3b8]">{row.provider}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-[#64748b]">
                    <span className="font-semibold text-[#1f2937]">{modelOption.title}</span>
                    <span className="ml-2 text-[#94a3b8]">{row.model}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-[#1f2937]">{formatNumber(row.totalCalls)}</td>
                <td className="px-3 py-2 text-[#64748b]">{formatNumber(row.succeededCalls)} / {formatNumber(row.failedCalls)}</td>
                <td className="px-3 py-2 text-[#1f2937]">{formatNumber(row.meteredCalls)}</td>
                <td className="px-3 py-2 text-[#1f2937]">{formatNumber(row.totalTokens)}</td>
                <td className="px-3 py-2 font-semibold text-[#2563eb]">{formatNumber(row.totalAiCreditsConsumed)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function buildProviderModelUsageStats(input: {
  rows: PlatformAiUsageCreditsByModelDto[];
  providerOptions: SearchableFilterOption[];
  modelOptions: SearchableFilterOption[];
}): ProviderModelUsageStat[] {
  const providersByCode = new Map(input.providerOptions.map((option) => [option.value, option]));
  const groups = new Map<string, ProviderModelUsageStat>();

  input.rows.forEach((row) => {
    const providerOption = providersByCode.get(row.provider) ?? fallbackProviderOption(row.provider);
    const group = groups.get(row.provider) ?? {
      provider: row.provider,
      providerOption,
      totalCalls: 0,
      succeededCalls: 0,
      failedCalls: 0,
      totalTokens: 0,
      totalAiCreditsConsumed: 0,
      models: [],
    };
    const modelOption = input.modelOptions.find((option) => option.value === row.model && option.keywords.includes(row.provider)) ?? fallbackModelOption(row);
    group.totalCalls += row.totalCalls;
    group.succeededCalls += row.succeededCalls;
    group.failedCalls += row.failedCalls;
    group.totalTokens += row.totalTokens;
    group.totalAiCreditsConsumed += row.totalAiCreditsConsumed;
    group.models.push({
      provider: row.provider,
      model: row.model,
      modelOption,
      totalCalls: row.totalCalls,
      succeededCalls: row.succeededCalls,
      failedCalls: row.failedCalls,
      totalTokens: row.totalTokens,
      totalAiCreditsConsumed: row.totalAiCreditsConsumed,
    });
    groups.set(row.provider, group);
  });

  return Array.from(groups.values()).sort((left, right) => right.totalAiCreditsConsumed - left.totalAiCreditsConsumed || right.totalCalls - left.totalCalls);
}

function ProviderModelDetailTable({ provider }: { provider: ProviderModelUsageStat }) {
  const providerCredits = Math.max(1, provider.totalAiCreditsConsumed);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#dbeafe] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#e6edf5] bg-[#f8fbff] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className="text-base font-semibold text-[#1f2937]">{provider.providerOption.title} 模型明细</h4>
          <p className="mt-1 text-xs leading-5 text-[#64748b]">当前展示选中厂商下模型的低敏用量字段，不包含费用金额或原始内容。</p>
        </div>
        <div className="grid gap-2 text-xs font-semibold text-[#64748b] sm:grid-cols-3">
          <span className="rounded-xl bg-white px-3 py-2">调用 {formatNumber(provider.totalCalls)}</span>
          <span className="rounded-xl bg-white px-3 py-2">Token {formatNumber(provider.totalTokens)}</span>
          <span className="rounded-xl bg-white px-3 py-2">积分 {formatNumber(provider.totalAiCreditsConsumed)}</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table aria-label="选中厂商模型明细表" className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-[#f8fafc] text-xs font-semibold text-[#64748b]">
            <tr>
              <th className="px-3 py-2">厂商名称</th>
              <th className="px-3 py-2">模型名称</th>
              <th className="px-3 py-2">model code</th>
              <th className="px-3 py-2">调用次数</th>
              <th className="px-3 py-2">Token 总量</th>
              <th className="px-3 py-2">AI 积分消耗</th>
              <th className="px-3 py-2">成功率</th>
              <th className="px-3 py-2">AI 积分占比</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e6edf5]">
            {provider.models.map((model) => (
              <tr key={`${model.provider}:${model.model}`}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {optionLogo(provider.providerOption, 'h-7 w-7 text-[11px]')}
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-[#1f2937]">{provider.providerOption.title}</div>
                      <div className="mt-1 truncate text-xs text-[#94a3b8]">{provider.provider}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="font-semibold text-[#1f2937]">{model.modelOption.title}</div>
                </td>
                <td className="px-3 py-2 text-[#64748b]">{model.model}</td>
                <td className="px-3 py-2 text-[#1f2937]">{formatNumber(model.totalCalls)}</td>
                <td className="px-3 py-2 text-[#1f2937]">{formatNumber(model.totalTokens)}</td>
                <td className="px-3 py-2 font-semibold text-[#2563eb]">{formatNumber(model.totalAiCreditsConsumed)}</td>
                <td className="px-3 py-2 text-[#64748b]">{successRateFromCalls(model.succeededCalls, model.failedCalls)}</td>
                <td className="px-3 py-2 text-[#64748b]">{formatPercent(model.totalAiCreditsConsumed, providerCredits)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProviderModelUsageStats(props: {
  rows: PlatformAiUsageCreditsByModelDto[];
  providerOptions: SearchableFilterOption[];
  modelOptions: SearchableFilterOption[];
  metric: UsageStatsMetric;
  onMetricChange: (metric: UsageStatsMetric) => void;
  onSelectProvider: (provider: string) => void;
  onSelectModel: (provider: string, model: string) => void;
  periodLabel: string;
  selectedProvider: string;
  selectedModel: string;
  totalAiCreditsConsumed: number;
}) {
  const stats = useMemo(() => buildProviderModelUsageStats({
    rows: props.rows,
    providerOptions: props.providerOptions,
    modelOptions: props.modelOptions,
  }), [props.modelOptions, props.providerOptions, props.rows]);
  const maxValue = Math.max(1, ...stats.flatMap((provider) => [
    usageMetricValue(provider, props.metric),
    ...provider.models.map((model) => usageMetricValue(model, props.metric)),
  ]));
  const metricLabel = usageStatsMetrics.find((metric) => metric.key === props.metric)?.label ?? '调用次数';
  const totalCredits = Math.max(1, props.totalAiCreditsConsumed);
  const selectedProviderDetails = props.selectedProvider
    ? stats.find((provider) => provider.provider === props.selectedProvider) ?? null
    : null;

  return (
    <section className="overflow-hidden rounded-[20px] border border-[#dbeafe] bg-white shadow-sm" aria-labelledby="provider-model-usage-stats-heading">
      <div className="flex flex-col gap-3 border-b border-[#dbeafe] bg-[#f8fbff] px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2563eb]">厂商与模型消耗明细</div>
          <h3 id="provider-model-usage-stats-heading" className="mt-1 text-base font-semibold text-[#1f2937]">厂商 / 模型消耗</h3>
          <p className="mt-1 text-xs leading-5 text-[#64748b]">卡片复用当前 AI 用量聚合数据，展示厂商标识、模型数量、AI 积分占比、调用、Token 与成功率；选择厂商后在下方查看模型明细表。</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#64748b]">
            <span className="rounded-full border border-[#dbeafe] bg-white px-3 py-1">{props.periodLabel}</span>
            <span className="rounded-full bg-[#2563eb] px-3 py-1 text-white">总 AI 积分 {formatNumber(props.totalAiCreditsConsumed)}</span>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="厂商模型卡片指标切换">
            {usageStatsMetrics.map((metric) => (
              <button
                key={metric.key}
                type="button"
                onClick={() => props.onMetricChange(metric.key)}
                className={cn(
                  'h-8 rounded-full border px-3 text-xs font-semibold transition',
                  props.metric === metric.key
                    ? 'border-[#2563eb] bg-[#2563eb] text-white'
                    : 'border-[#dbe3ee] bg-white text-[#64748b] hover:bg-[#f1f5f9]',
                )}
                aria-pressed={props.metric === metric.key}
              >
                {metric.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {stats.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-[#64748b]">暂无厂商 / 模型消耗卡片数据</div>
      ) : (
        <div className="grid gap-3 bg-[#f8fbff] p-4 lg:grid-cols-2">
          {stats.map((provider) => {
            const color = providerColor(provider.provider);
            const providerValue = usageMetricValue(provider, props.metric);
            const creditPercent = formatPercent(provider.totalAiCreditsConsumed, totalCredits);
            const isSelectedProvider = props.selectedProvider === provider.provider;
            return (
              <article
                key={provider.provider}
                className={cn(
                  'rounded-2xl border p-4 shadow-sm transition',
                  isSelectedProvider ? 'border-[#93c5fd] bg-[#eef6ff]' : 'border-[#e6edf5] bg-white',
                )}
              >
                <button
                  type="button"
                  onClick={() => props.onSelectProvider(provider.provider)}
                  className="flex w-full items-start gap-3 rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
                  aria-label={`筛选厂商 ${provider.providerOption.title}`}
                  aria-pressed={isSelectedProvider}
                >
                  {optionLogo(provider.providerOption, 'h-10 w-10 text-sm')}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-base font-semibold text-[#1f2937]">{provider.providerOption.title}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#2563eb]">{provider.models.length} 个模型</span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-[#94a3b8]">{provider.provider}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-lg font-bold text-[#2563eb]">{creditPercent}</span>
                    <span className="text-[11px] font-semibold text-[#64748b]">AI 积分占比</span>
                  </span>
                </button>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e2e8f0]" aria-label={`${provider.providerOption.title}${metricLabel}占比`}>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(4, (providerValue / maxValue) * 100)}%`, backgroundColor: color }} />
                </div>

                <div className="mt-3 grid gap-2 text-xs font-semibold text-[#64748b] sm:grid-cols-4">
                  <span className="rounded-xl bg-[#f8fafc] px-3 py-2">调用 {formatNumber(provider.totalCalls)}</span>
                  <span className="rounded-xl bg-[#f8fafc] px-3 py-2">Token {formatNumber(provider.totalTokens)}</span>
                  <span className="rounded-xl bg-[#f8fafc] px-3 py-2">成功率 {successRateFromCalls(provider.succeededCalls, provider.failedCalls)}</span>
                  <span className="rounded-xl bg-[#f8fafc] px-3 py-2">积分 {formatNumber(provider.totalAiCreditsConsumed)}</span>
                </div>

                <div className="mt-3 grid gap-2">
                  {provider.models.map((model) => {
                    const modelValue = usageMetricValue(model, props.metric);
                    const isSelectedModel = props.selectedProvider === model.provider && props.selectedModel === model.model;
                    return (
                      <button
                        key={`${model.provider}:${model.model}`}
                        type="button"
                        onClick={() => props.onSelectModel(model.provider, model.model)}
                        className={cn(
                          'grid gap-2 rounded-xl border p-3 text-left transition hover:border-[#bfdbfe] hover:bg-[#eef6ff] focus:border-[#93c5fd] focus:outline-none',
                          isSelectedModel ? 'border-[#93c5fd] bg-[#eef6ff]' : 'border-[#edf2f7] bg-[#f8fafc]',
                        )}
                        aria-label={`筛选模型 ${model.modelOption.title}`}
                      >
                        <span className="flex items-center gap-2">
                          {optionLogo(model.modelOption, 'h-6 w-6 text-[11px]')}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-[#1f2937]">{model.modelOption.title}</span>
                            <span className="mt-0.5 block truncate text-xs text-[#94a3b8]">{model.model}</span>
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-[#1f2937]">{formatNumber(modelValue)}</span>
                        </span>
                        <span className="h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
                          <span className="block h-full rounded-full" style={{ width: `${Math.max(4, (modelValue / maxValue) * 100)}%`, backgroundColor: color }} />
                        </span>
                        <span className="grid gap-1 text-[11px] font-semibold text-[#64748b] sm:grid-cols-4">
                          <span>调用 {formatNumber(model.totalCalls)}</span>
                          <span>Token {formatNumber(model.totalTokens)}</span>
                          <span>成功率 {successRateFromCalls(model.succeededCalls, model.failedCalls)}</span>
                          <span>积分 {formatNumber(model.totalAiCreditsConsumed)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <div className="border-t border-[#dbeafe] bg-[#f8fbff] p-4">
        {!props.selectedProvider ? (
          <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-white px-4 py-5 text-center text-sm text-[#64748b]">选择上方厂商后查看模型消耗明细。</div>
        ) : selectedProviderDetails ? (
          <ProviderModelDetailTable provider={selectedProviderDetails} />
        ) : (
          <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-white px-4 py-5 text-center text-sm text-[#64748b]">当前选中厂商暂无模型明细数据。</div>
        )}
      </div>
    </section>
  );
}

function TenantAggregationTable({ rows }: { rows: PlatformAiUsageCreditsByTenantDto[] }) {
  if (rows.length === 0) return <EmptyAggregation label="租户用量统计" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="bg-[#f8fafc] text-xs font-semibold text-[#64748b]">
          <tr>
            <th className="px-3 py-2">租户</th>
            <th className="px-3 py-2">总调用</th>
            <th className="px-3 py-2">成功 / 失败</th>
            <th className="px-3 py-2">Token 总量</th>
            <th className="px-3 py-2">AI 积分消耗</th>
            <th className="px-3 py-2">已计量</th>
            <th className="px-3 py-2">待计量</th>
            <th className="px-3 py-2">不计费</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e6edf5]">
          {rows.map((row) => (
            <tr key={row.tenantId}>
              <td className="px-3 py-2">
                <div className="font-semibold text-[#1f2937]">{row.tenantName ?? '未命名租户'}</div>
                <div className="mt-1 text-xs text-[#94a3b8]">{row.tenantId}</div>
              </td>
              <td className="px-3 py-2 text-[#1f2937]">{formatNumber(row.totalCalls)}</td>
              <td className="px-3 py-2 text-[#64748b]">{formatNumber(row.succeededCalls)} / {formatNumber(row.failedCalls)}</td>
              <td className="px-3 py-2 font-semibold text-[#1f2937]">{formatNumber(row.totalTokens)}</td>
              <td className="px-3 py-2 font-semibold text-[#2563eb]">{formatNumber(row.totalAiCreditsConsumed)}</td>
              <td className="px-3 py-2 text-[#1f2937]">{formatNumber(row.meteredCalls)}</td>
              <td className="px-3 py-2 text-[#1f2937]">{formatNumber(row.pendingCalls)}</td>
              <td className="px-3 py-2 text-[#1f2937]">{formatNumber(row.notBillableCalls)}</td>
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

function AggregationCard(props: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e6edf5] bg-white" aria-labelledby={`${props.title}-heading`}>
      <div className="border-b border-[#e6edf5] px-3 py-2">
        <h3 id={`${props.title}-heading`} className="text-sm font-semibold text-[#1f2937]">{props.title}</h3>
        {props.description ? <p className="mt-1 text-xs leading-5 text-[#64748b]">{props.description}</p> : null}
      </div>
      {props.children}
    </section>
  );
}

function DateTrendChart(props: {
  rows: PlatformAiUsageCreditsByDateProviderDto[];
  metric: UsageStatsMetric;
  onMetricChange: (metric: UsageStatsMetric) => void;
  onSelectProvider: (provider: string) => void;
}) {
  const metricOption = usageStatsMetrics.find((metric) => metric.key === props.metric) ?? usageStatsMetrics[0];
  const days = useMemo(() => {
    const grouped = new Map<string, {
      date: string;
      total: number;
      segments: Array<{
        provider: string;
        providerLabel: string;
        value: number;
        totalCalls: number;
        totalTokens: number;
        totalAiCreditsConsumed: number;
      }>;
    }>();

    props.rows.forEach((row) => {
      const value = usageMetricValue(row, props.metric);
      const day = grouped.get(row.date) ?? { date: row.date, total: 0, segments: [] };
      day.total += value;
      day.segments.push({
        provider: row.provider,
        providerLabel: row.providerDisplayName ?? row.provider,
        value,
        totalCalls: row.totalCalls,
        totalTokens: row.totalTokens,
        totalAiCreditsConsumed: row.totalAiCreditsConsumed,
      });
      grouped.set(row.date, day);
    });

    return Array.from(grouped.values())
      .map((day) => ({
        ...day,
        segments: day.segments.sort((left, right) => right.value - left.value || left.provider.localeCompare(right.provider)),
      }))
      .sort((left, right) => left.date.localeCompare(right.date));
  }, [props.metric, props.rows]);
  const providers = useMemo(() => {
    const providerMap = new Map<string, string>();
    props.rows.forEach((row) => providerMap.set(row.provider, row.providerDisplayName ?? row.provider));
    return Array.from(providerMap.entries()).sort((left, right) => left[1].localeCompare(right[1]));
  }, [props.rows]);
  const maxTotal = Math.max(1, ...days.map((day) => day.total));

  return (
    <section className="grid gap-4 p-4" aria-labelledby="date-trend-chart-heading">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 id="date-trend-chart-heading" className="text-sm font-semibold text-[#1f2937]">按日期查看 AI 用量趋势</h4>
          <p className="mt-1 text-xs leading-5 text-[#64748b]">X 轴为日期，Y 轴为当前指标；柱体按厂商稳定分色堆叠，点击厂商分段可联动筛选。</p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="趋势图指标切换">
          {usageStatsMetrics.map((metric) => (
            <button
              key={metric.key}
              type="button"
              onClick={() => props.onMetricChange(metric.key)}
              className={cn(
                'h-8 rounded-full border px-3 text-xs font-semibold transition',
                props.metric === metric.key
                  ? 'border-[#2563eb] bg-[#2563eb] text-white'
                  : 'border-[#dbe3ee] bg-white text-[#64748b] hover:bg-[#f1f5f9]',
              )}
              aria-pressed={props.metric === metric.key}
            >
              {metric.label}
            </button>
          ))}
        </div>
      </div>

      {days.length === 0 ? (
        <EmptyAggregation label="日期用量趋势" />
      ) : (
        <>
          <div className="rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-4">
            <div className="mb-3 flex items-center justify-between text-xs font-semibold text-[#64748b]">
              <span>Y 轴：{metricOption.label}</span>
              <span>峰值 {formatNumber(maxTotal)}</span>
            </div>
            <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-3">
              <div className="flex h-52 flex-col justify-between text-right text-[11px] font-semibold text-[#94a3b8]" aria-hidden="true">
                <span>{formatNumber(maxTotal)}</span>
                <span>{formatNumber(Math.round(maxTotal / 2))}</span>
                <span>0</span>
              </div>
              <div className="relative border-b border-l border-[#cbd5e1] pl-3 pt-2">
                <div className="pointer-events-none absolute inset-x-3 top-2 h-px bg-[#e2e8f0]" />
                <div className="pointer-events-none absolute inset-x-3 top-1/2 h-px bg-[#e2e8f0]" />
                <div className="flex h-52 items-end gap-2 overflow-x-auto pb-2" aria-label="按日期和厂商堆叠的 AI 用量趋势图">
                  {days.map((day) => (
                    <div key={day.date} className="flex min-w-[56px] flex-1 flex-col items-center gap-2">
                      <div className="flex h-44 w-full items-end justify-center">
                        <div
                          className="flex w-full max-w-[44px] flex-col-reverse overflow-hidden rounded-t-xl border border-white bg-[#e2e8f0] shadow-sm"
                          style={{ height: `${Math.max(8, (day.total / maxTotal) * 100)}%` }}
                          aria-label={`${day.date} ${metricOption.label}合计 ${formatNumber(day.total)}`}
                        >
                          {day.segments.map((segment) => {
                            if (segment.value <= 0) return null;
                            const title = `${day.date} · ${segment.providerLabel} · ${metricOption.label} ${formatNumber(segment.value)}；点击筛选厂商 ${segment.providerLabel}`;
                            return (
                              <button
                                key={`${day.date}:${segment.provider}`}
                                type="button"
                                onClick={() => props.onSelectProvider(segment.provider)}
                                title={title}
                                aria-label={title}
                                className="min-h-[6px] w-full border-t border-white/60 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#1d4ed8] focus:ring-offset-1"
                                style={{ height: `${(segment.value / Math.max(1, day.total)) * 100}%`, backgroundColor: providerColor(segment.provider) }}
                              />
                            );
                          })}
                        </div>
                      </div>
                      <span className="w-full truncate text-center text-[11px] font-semibold text-[#64748b]" title={day.date}>{day.date.slice(5)}</span>
                      <span className="text-[11px] font-semibold text-[#1f2937]">{formatNumber(day.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="趋势图厂商图例">
            {providers.map(([provider, label]) => (
              <button
                key={provider}
                type="button"
                onClick={() => props.onSelectProvider(provider)}
                className="inline-flex items-center gap-2 rounded-full border border-[#dbe3ee] bg-white px-3 py-1.5 text-xs font-semibold text-[#64748b] transition hover:bg-[#eef6ff] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
                aria-label={`筛选趋势图厂商 ${label}`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: providerColor(provider) }} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function DetailRow({ record }: { record: PlatformAiUsageCreditDetailDto }) {
  return (
    <tr className="align-top">
      <td className="px-3 py-2">
        <div className="font-semibold text-[#1f2937]">{record.tenantName ?? '未命名租户'}</div>
        <div className="mt-1 text-xs text-[#94a3b8]">{record.tenantId}</div>
      </td>
      <td className="px-3 py-2">
        <div className="font-semibold text-[#1f2937]">{statusLabel(record.status)}</div>
        <div className="mt-1 text-xs text-[#94a3b8]">{record.errorCode ?? '无错误码'}</div>
      </td>
      <td className="px-3 py-2">
        <div className="font-semibold text-[#1f2937]">{record.provider}</div>
        <div className="mt-1 text-xs text-[#94a3b8]">{record.model}</div>
      </td>
      <td className="px-3 py-2 text-[#1f2937]">
        <div>输入 {formatNumber(record.promptTokens)}</div>
        <div className="mt-1">输出 {formatNumber(record.completionTokens)}</div>
        <div className="mt-1 font-semibold">总计 {formatNumber(record.totalTokens)}</div>
      </td>
      <td className="px-3 py-2">
        <div className="font-semibold text-[#2563eb]">{formatNumber(record.aiCreditsConsumed)}</div>
        <div className="mt-1 text-xs text-[#64748b]">{meteringStatusLabel(record.meteringStatus)}</div>
        <div className="mt-1 text-xs leading-5 text-[#94a3b8]">{meteringStatusDescription(record.meteringStatus)}</div>
      </td>
      <td className="px-3 py-2">
        <div className="font-semibold text-[#1f2937]">{record.meteringVersion ?? '无版本'}</div>
        <div className="mt-1 text-xs text-[#64748b]">
          {record.knowledgeContextUsed ? `使用知识库 · ${record.sourceCount} 个来源` : '未使用知识库'}
        </div>
      </td>
      <td className="px-3 py-2 text-[#64748b]">{formatDateTime(record.createdAt)}</td>
    </tr>
  );
}

export function OpenPlatformAiReadonlyPanel() {
  const [initialFilters] = useState(createDefaultFilters);
  const [filters, setFilters] = useState<FilterFormState>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterFormState>(initialFilters);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [data, setData] = useState<OpenPlatformAiUsageCreditsResponse>(emptyData);
  const [error, setError] = useState('');
  const [usageStatsMetric, setUsageStatsMetric] = useState<UsageStatsMetric>('calls');
  const [dateTrendMetric, setDateTrendMetric] = useState<UsageStatsMetric>('calls');
  const [activeTab, setActiveTab] = useState<AiUsageTab>('overview');

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
      const result = await listOpenPlatformAiUsageCredits(toApiFilters(initialFilters));
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
  }, [initialFilters]);

  function updateFilter(key: keyof FilterFormState, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'dateFrom' || key === 'dateTo' ? { timeRange: 'custom' as const } : {}),
    }));
  }

  function updateTimeRange(preset: TimeRangePreset) {
    const dateFilters = preset === 'custom' ? {} : timeRangeDates(preset);
    setFilters((current) => ({ ...current, ...dateFilters, timeRange: preset }));
  }

  function applyTimeRange(preset: TimeRangePreset) {
    const dateFilters = preset === 'custom' ? {} : timeRangeDates(preset);
    const nextFilters = { ...filters, ...dateFilters, timeRange: preset };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setLoadState('loading');
    void loadUsage(nextFilters);
  }

  function updateProviderFilter(value: string) {
    setFilters((current) => ({
      ...current,
      provider: value,
      model: current.provider === value ? current.model : '',
    }));
  }

  function selectProviderFilter(provider: string) {
    const nextFilters = { ...filters, provider, model: '' };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setLoadState('loading');
    void loadUsage(nextFilters);
  }

  function selectModelFilter(provider: string, model: string) {
    const nextFilters = { ...filters, provider, model };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setLoadState('loading');
    void loadUsage(nextFilters);
  }

  function applyFilters() {
    setLoadState('loading');
    setAppliedFilters(filters);
    void loadUsage(filters);
  }

  function resetFilters() {
    const nextFilters = createDefaultFilters();
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setLoadState('loading');
    void loadUsage(nextFilters);
  }

  function refreshUsage() {
    setLoadState('loading');
    void loadUsage(appliedFilters);
  }

  const summary = data.summary;
  const providerOptions = data.filterOptions.providers.map(providerFilterOption);
  const modelOptions = data.filterOptions.models
    .filter((option) => !filters.provider.trim() || option.provider === filters.provider.trim())
    .map(modelFilterOption);
  const tenantOptions = data.filterOptions.tenants.map(tenantFilterOption);
  const statusOptions = uniqueStrings(data.filterOptions.statuses);
  const meteringStatusOptions = uniqueStrings(data.filterOptions.meteringStatuses);

  const allModelOptions = data.filterOptions.models.map(modelFilterOption);
  const periodTitle = formatMonthUsageTitle(appliedFilters);
  const periodRange = formatDateRangeSummary(appliedFilters);
  const totalTokens = totalTokensFromAggregations(data);
  const successRate = successRateFromCalls(summary.succeededCalls, summary.failedCalls);
  const peakDay = peakDayFromDateProviders(data.aggregations.byDateProvider);
  const peakDayLabel = peakDay ? formatShortMonthDay(peakDay.date) : '暂无峰值日';
  const peakDayHelper = peakDay
    ? `${formatDateOnly(peakDay.date)} · AI 积分 ${formatNumber(peakDay.totalAiCreditsConsumed)} · 调用 ${formatNumber(peakDay.totalCalls)}`
    : '当前范围内暂无日期聚合数据';
  const summaryCards = (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
      <LegacyOverviewMetricCard label="调用次数" value={formatNumber(summary.totalCalls)} helper={`成功 ${formatNumber(summary.succeededCalls)} · 失败 ${formatNumber(summary.failedCalls)}`} tone="blue" />
      <LegacyOverviewMetricCard label="Token 总量" value={formatNumber(totalTokens)} helper="由模型聚合优先回退到日期聚合" />
      <LegacyOverviewMetricCard label="成功率" value={successRate} helper="成功调用 / 成功与失败调用" tone="success" />
      <LegacyOverviewMetricCard label="峰值日" value={peakDayLabel} helper={peakDayHelper} tone="warning" />
    </div>
  );
  const providerModelStats = (
    <ProviderModelUsageStats
      rows={data.aggregations.byModel}
      providerOptions={providerOptions}
      modelOptions={allModelOptions}
      metric={usageStatsMetric}
      onMetricChange={setUsageStatsMetric}
      onSelectProvider={selectProviderFilter}
      onSelectModel={selectModelFilter}
      periodLabel={periodTitle}
      selectedProvider={appliedFilters.provider}
      selectedModel={appliedFilters.model}
      totalAiCreditsConsumed={summary.totalAiCreditsConsumed}
    />
  );
  const timeRangeFilter = (
    <section className="mt-4 rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-3" aria-labelledby="ai-usage-time-range-heading">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 id="ai-usage-time-range-heading" className="text-sm font-semibold text-[#1f2937]">全局时间范围</h3>
          <p className="mt-1 text-xs leading-5 text-[#64748b]">时间范围作用于总览、模型与厂商、租户用量、计量状态和明细记录；返回条数仅影响明细记录。</p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="全局时间范围筛选">
          {timeRangePresets.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => (preset.key === 'custom' ? updateTimeRange('custom') : applyTimeRange(preset.key))}
              className={cn(
                'h-8 rounded-full border px-3 text-xs font-semibold transition',
                filters.timeRange === preset.key
                  ? 'border-[#2563eb] bg-[#2563eb] text-white'
                  : 'border-[#dbe3ee] bg-white text-[#64748b] hover:bg-[#f1f5f9]',
              )}
              aria-pressed={filters.timeRange === preset.key}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      {filters.timeRange === 'custom' ? (
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <label className="text-sm font-semibold text-[#1f2937]">
            开始时间
            <input type="datetime-local" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[#dbe3ee] bg-white px-3 text-sm font-normal" />
          </label>
          <label className="text-sm font-semibold text-[#1f2937]">
            结束时间
            <input type="datetime-local" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[#dbe3ee] bg-white px-3 text-sm font-normal" />
          </label>
          <button type="button" onClick={applyFilters} className="h-10 rounded-xl bg-[#2563eb] px-4 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]">应用时间范围</button>
        </div>
      ) : null}
    </section>
  );
  const filterForm = (
    <form
      className="grid gap-3 rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-3 md:grid-cols-2 xl:grid-cols-4"
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
        helper="可选择候选，也可手动输入历史租户ID。"
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
        onChange={updateProviderFilter}
      />
      <SearchableFilterInput
        id="ai-usage-model-filter"
        label="模型名称"
        value={filters.model}
        options={modelOptions}
        placeholder="输入或选择模型名称"
        helper="选择厂商后仅展示该厂商模型；仍可手动输入。"
        onChange={(value) => updateFilter('model', value)}
      />
      <label className="text-sm font-semibold text-[#1f2937]">
        返回条数
        <input type="number" min="1" max="100" value={filters.limit} onChange={(event) => updateFilter('limit', event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[#dbe3ee] bg-white px-3 text-sm font-normal" />
      </label>
      <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
        <button type="submit" className="h-10 rounded-xl bg-[#2563eb] px-4 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]">应用筛选</button>
        <button type="button" onClick={resetFilters} className="h-10 rounded-xl border border-[#dbe3ee] bg-white px-4 text-sm font-semibold text-[#64748b] transition hover:bg-[#f1f5f9]">清空筛选</button>
      </div>
    </form>
  );
  const detailList = data.records.length === 0 ? (
    <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-5 text-center">
      <div className="text-sm font-semibold text-[#1f2937]">{data.emptyState.title}</div>
      <p className="mt-1 text-sm text-[#64748b]">{data.emptyState.description}</p>
    </div>
  ) : (
    <div className="overflow-hidden rounded-2xl border border-[#e6edf5] bg-white">
      <div className="border-b border-[#e6edf5] px-3 py-2 text-sm font-semibold text-[#1f2937]">明细列表</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="bg-[#f8fafc] text-xs font-semibold text-[#64748b]">
            <tr>
              <th className="px-3 py-2">租户</th>
              <th className="px-3 py-2">调用状态</th>
              <th className="px-3 py-2">模型厂商 / 模型名称</th>
              <th className="px-3 py-2">Token</th>
              <th className="px-3 py-2">AI 积分 / 计量</th>
              <th className="px-3 py-2">计量版本 / RAG</th>
              <th className="px-3 py-2">创建时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e6edf5]">
            {data.records.map((record) => <DetailRow key={record.id} record={record} />)}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <section className="flex flex-col gap-4" aria-labelledby="ai-usage-heading">
      <PlatformSectionBanner
        headingId="ai-usage-banner-heading"
        headingLevel="h1"
        title="AI用量与费用"
        description="平台端只读查看 AI 调用、计量状态和积分消耗明细；仅展示运营低敏字段。"
      />

      <section className="rounded-[20px] border border-[#e6edf5] bg-white p-4 shadow-sm" aria-labelledby="ai-usage-heading">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold text-[#2563eb]">AI 用量账单</div>
            <h2 id="ai-usage-heading" className="mt-1 text-xl font-semibold tracking-normal text-[#1f2937]">{periodTitle}</h2>
            <p className="mt-1 text-sm leading-6 text-[#64748b]">{periodRange}；当前以 AI 积分消耗替代费用主指标，真实费用结算后置。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 items-center justify-center rounded-xl border border-[#dbeafe] bg-[#f8fbff] px-3 text-sm font-semibold text-[#2563eb]">{periodTitle}</span>
            <button
              type="button"
              disabled
              className="inline-flex h-9 cursor-not-allowed items-center justify-center rounded-xl border border-[#dbe3ee] bg-[#f1f5f9] px-3 text-sm font-semibold text-[#94a3b8]"
              title="账单导出能力后置，本 PR 不实现真实导出"
            >
              导出（后置）
            </button>
            <button
              type="button"
              onClick={refreshUsage}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#dbeafe] bg-[#eaf3ff] px-3 text-sm font-semibold text-[#2563eb] transition hover:bg-[#dbeafe]"
            >
              <RefreshCw className="h-4 w-4" />
              刷新
            </button>
          </div>
        </div>

        {timeRangeFilter}

        <div className="mt-4 flex gap-2 overflow-x-auto rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-1" role="tablist" aria-label="AI用量栏目">
          {aiUsageTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`ai-usage-tabpanel-${tab.key}`}
              id={`ai-usage-tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'h-9 shrink-0 rounded-xl px-3 text-sm font-semibold transition',
                activeTab === tab.key
                  ? 'bg-white text-[#2563eb] shadow-sm'
                  : 'text-[#64748b] hover:bg-white/70 hover:text-[#1f2937]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loadState === 'loading' ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-6 text-center text-sm text-[#64748b]">正在加载 AI 用量与积分明细...</div>
        ) : null}

        {loadState === 'error' ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
            <div className="font-semibold">明细列表暂不可用。</div>
            <p className="mt-1">{error}</p>
          </div>
        ) : null}

        {loadState === 'ready' ? (
          <div
            id={`ai-usage-tabpanel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`ai-usage-tab-${activeTab}`}
            className="mt-4"
          >
            {activeTab === 'overview' ? (
              <div className="grid gap-4">
                <div className="grid min-w-0 gap-4 2xl:grid-cols-[400px_minmax(0,1fr)]">
                  <section className="min-w-0 rounded-[20px] border border-[#dbeafe] bg-[#f8fbff] p-4 shadow-sm" aria-labelledby="legacy-billing-summary-heading">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2563eb]">账单摘要</div>
                    <h3 id="legacy-billing-summary-heading" className="mt-1 text-base font-semibold text-[#1f2937]">AI 积分消耗</h3>
                    <div className="mt-3 break-words text-4xl font-bold leading-tight tracking-tight text-[#2563eb]">{formatNumber(summary.totalAiCreditsConsumed)}</div>
                    <p className="mt-2 text-xs leading-5 text-[#64748b]">当前展示 AI 积分消耗，不展示法币金额或结算成本；费用结算与导出能力后置。</p>
                    <div className="mt-4">{summaryCards}</div>
                  </section>

                  <AggregationCard title="每日消耗" description="旧版账单式主图区域；保留调用次数、Token 总量、AI 积分消耗切换，以及厂商分色图例和点击筛选联动。">
                    <DateTrendChart
                      rows={data.aggregations.byDateProvider}
                      metric={dateTrendMetric}
                      onMetricChange={setDateTrendMetric}
                      onSelectProvider={selectProviderFilter}
                    />
                  </AggregationCard>
                </div>

                <section className="rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4" aria-labelledby="single-day-model-composition-heading">
                  <h3 id="single-day-model-composition-heading" className="text-sm font-semibold text-[#1f2937]">单日模型消耗构成</h3>
                  <p className="mt-1 text-xs leading-5 text-[#64748b]">当前 API 仅提供日期 × 厂商聚合，暂不补造单日模型构成或费用数据；后续 10E-2 在口径确认后补充模型明细。</p>
                </section>

                {providerModelStats}
              </div>
            ) : null}

            {activeTab === 'models' ? (
              <div className="grid gap-4">
                {providerModelStats}
                <AggregationCard title="模型用量统计">
                  <ModelAggregationTable rows={data.aggregations.byModel} providerOptions={providerOptions} modelOptions={allModelOptions} />
                </AggregationCard>
              </div>
            ) : null}

            {activeTab === 'tenants' ? (
              <AggregationCard title="租户用量统计">
                <TenantAggregationTable rows={data.aggregations.byTenant} />
              </AggregationCard>
            ) : null}

            {activeTab === 'metering' ? (
              <AggregationCard title="计量状态统计">
                <div className="p-3">
                  <MeteringStatusAggregation rows={data.aggregations.byMeteringStatus} />
                </div>
              </AggregationCard>
            ) : null}

            {activeTab === 'details' ? (
              <div className="grid gap-4">
                {filterForm}
                {detailList}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </section>
  );
}
