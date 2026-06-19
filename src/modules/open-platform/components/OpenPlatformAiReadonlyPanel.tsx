'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { loadOpenPlatformAiReadonlyView } from '@/modules/open-platform/lib/platformAiReadonlyViewLoader';
import {
  PLATFORM_AI_READONLY_DEFAULT_MONTH,
  type PlatformAiDailyUsageSample,
} from '@/modules/open-platform/mock/platformAiReadonly';
import { cn } from '@/shared/utils/cn';

const percentFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'percent',
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat('zh-CN');

function formatPercent(value: number) {
  return percentFormatter.format(value);
}

function formatCurrency(value: number, fractionDigits = 4) {
  return `¥${value.toFixed(fractionDigits)}`;
}

function formatTruncatedCurrency(value: number, fractionDigits = 4) {
  const ratio = 10 ** fractionDigits;
  return `¥${(Math.floor(value * ratio) / ratio).toFixed(fractionDigits)}`;
}

function formatLatency(value: number) {
  return `${numberFormatter.format(value)}ms`;
}

type UsageMonthPickerAnchor = 'summary' | 'provider';




export function OpenPlatformAiReadonlyPanel() {
  const [selectedMonth, setSelectedMonth] = useState('2026-05');
  const [isUsageMonthPickerOpen, setIsUsageMonthPickerOpen] = useState(false);
  const [usageMonthPickerAnchor, setUsageMonthPickerAnchor] = useState<UsageMonthPickerAnchor | null>(null);
  const [selectedUsageDay, setSelectedUsageDay] = useState<string | null>(null);
  const [selectedUsageProvider, setSelectedUsageProvider] = useState<string | null>(null);
  const [selectedUsageInstitution, setSelectedUsageInstitution] = useState<string | null>(null);
  const view = loadOpenPlatformAiReadonlyView({ month: selectedMonth });
  const dailyRows = view.usage.dailyRows;
  const peakDailyRow = dailyRows.reduce<PlatformAiDailyUsageSample | null>((result, row) => (
    !result || row.estimatedCostCny > result.estimatedCostCny ? row : result
  ), null);
  const selectedDailyRow = dailyRows.find((row) => row.date === selectedUsageDay) ?? peakDailyRow;
  const providerGroups = view.usage.providerUsageGroups;
  const selectedProviderGroup = providerGroups.find((group) => group.providerId === selectedUsageProvider) ?? null;
  const selectedInstitution = view.usage.sampleInstitutionRanking.find((row) => row.institutionName === selectedUsageInstitution)
    ?? view.usage.sampleInstitutionRanking[0]
    ?? null;
  const maxDayCost = Math.max(0.01, ...dailyRows.map((row) => row.estimatedCostCny));
  const usageMonthLabel = `${view.availableMonths.find((month) => month.value === view.selectedMonth)?.label ?? view.selectedMonth}用量`;
  const modelCostColors: Record<string, string> = {
    qwen: 'bg-[#facc15]',
    deepseek: 'bg-[#38bdf8]',
    doubao: 'bg-[#fb923c]',
    chatglm: 'bg-[#a78bfa]',
    kimi: 'bg-[#38bdf8]',
  };
  const usageMetricCards = [
    { label: '调用次数', value: numberFormatter.format(view.usage.summary.totalCalls), className: 'bg-white' },
    { label: 'Token', value: numberFormatter.format(view.usage.summary.totalTokens), className: 'bg-white' },
    { label: '成功率', value: formatPercent(view.usage.summary.successRate), className: 'bg-emerald-50 text-emerald-700' },
    { label: '峰值日', value: formatTruncatedCurrency(view.usage.summary.peakDayCostCny, 3), className: 'bg-amber-50 text-amber-700' },
  ];
  const usageChartDays = Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    const date = `${view.selectedMonth}-${String(day).padStart(2, '0')}`;
    return {
      day,
      row: dailyRows.find((item) => item.date === date) ?? null,
    };
  });
  const monthPickerYear = Number(view.selectedMonth.slice(0, 4));
  const selectedMonthNumber = Number(view.selectedMonth.slice(5, 7));

  function changeUsageMonth(value: string) {
    setSelectedMonth(value);
    setSelectedUsageDay(null);
    setSelectedUsageProvider(null);
    setSelectedUsageInstitution(null);
    setIsUsageMonthPickerOpen(false);
    setUsageMonthPickerAnchor(null);
  }

  function toggleUsageMonthPicker(anchor: UsageMonthPickerAnchor) {
    setUsageMonthPickerAnchor(anchor);
    setIsUsageMonthPickerOpen((value) => usageMonthPickerAnchor === anchor ? !value : true);
  }

  function renderUsageMonthPicker(anchor: UsageMonthPickerAnchor) {
    if (!isUsageMonthPickerOpen || usageMonthPickerAnchor !== anchor) return null;

    return (
      <div
        role="dialog"
        aria-label="选择 AI 用量月份"
        className="absolute right-0 top-12 z-20 w-[385px] max-w-[calc(100vw-2rem)] border border-[#b8c0cc] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
      >
        <div className="bg-[#f0f0f0] px-3 py-2 text-base text-black">{monthPickerYear}</div>
        <div className="mt-3 grid grid-cols-4 gap-y-2 text-center text-base text-black">
          {Array.from({ length: 12 }, (_, index) => index + 1).map((monthNumber) => {
            const value = `${monthPickerYear}-${String(monthNumber).padStart(2, '0')}`;
            const isSelected = selectedMonthNumber === monthNumber;
            return (
              <button
                key={monthNumber}
                type="button"
                aria-pressed={isSelected}
                onClick={() => changeUsageMonth(value)}
                className={cn(
                  'mx-auto h-10 w-20 border border-transparent text-base',
                  isSelected ? 'border-black bg-[#0879f2] font-bold text-white' : 'bg-white hover:border-[#8b949e]',
                )}
              >
                {monthNumber}月
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex items-center justify-between text-base text-[#0879f2]">
          <button type="button" onClick={() => changeUsageMonth(PLATFORM_AI_READONLY_DEFAULT_MONTH)}>清除</button>
          <button type="button" onClick={() => changeUsageMonth(PLATFORM_AI_READONLY_DEFAULT_MONTH)}>本月</button>
        </div>
      </div>
    );
  }

  function renderUsageMonthButton(anchor: UsageMonthPickerAnchor, ariaLabelPrefix: string) {
    const isOpen = isUsageMonthPickerOpen && usageMonthPickerAnchor === anchor;
    const label = view.availableMonths.find((month) => month.value === view.selectedMonth)?.label ?? view.selectedMonth;

    return (
      <div className="relative">
        <button
          type="button"
          aria-label={`${ariaLabelPrefix} ${label}`}
          aria-expanded={isOpen}
          onClick={() => toggleUsageMonthPicker(anchor)}
          className={cn(
            'inline-flex h-11 min-w-[138px] items-center justify-between gap-3 rounded-xl border bg-white px-3 text-sm font-bold text-[#1f2937] shadow-[0_2px_8px_rgba(15,23,42,0.08)] transition',
            isOpen ? 'border-[#bfdbfe] bg-[#eaf3ff] ring-2 ring-[#dbeafe]' : 'border-[#e6edf5]',
          )}
        >
          {label}
          <span className="text-[#64748b]">⌄</span>
        </button>
        {renderUsageMonthPicker(anchor)}
      </div>
    );
  }

  function exportUsageDetail() {
    if (!view.hasUsageData || typeof window === 'undefined') return;
    const header = ['月份', '日期', '厂商', '模型', '调用次数', '总 Token', '估算费用'];
    const rows = dailyRows.flatMap((day) => day.modelCosts.map((model) => [
      view.selectedMonth,
      day.date,
      model.providerName,
      model.modelName,
      String(model.calls),
      String(model.totalTokens),
      model.estimatedCostCny.toFixed(2),
    ]));
    const content = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-usage-${view.selectedMonth}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="ai-usage-heading">
      <section className="order-1 rounded-[18px] border border-[#e6edf5] bg-[#f7f9fc] p-3 text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] lg:p-4" aria-labelledby="ai-usage-heading">
        <h2 id="ai-usage-heading" className="sr-only">AI 用量与费用</h2>
        <p className="sr-only">用量口径：当前为受控示例用量，费用为估算，不是正式账单。</p>
        <div className="rounded-[16px] border border-[#e6edf5] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 border-b border-[#e6edf5] pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-bold text-[#2f7cf6]">AI 用量账单</div>
              <div className="mt-1 text-[22px] font-bold tracking-normal text-[#1f2937]">{usageMonthLabel}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {renderUsageMonthButton('summary', '选择 AI 用量月份')}
              <button
                type="button"
                onClick={exportUsageDetail}
                disabled={!view.hasUsageData}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#e6edf5] bg-white px-4 text-sm font-bold text-[#1f2937] shadow-[0_2px_8px_rgba(15,23,42,0.08)] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:text-[#94a3b8]"
              >
                <Download className="h-4 w-4" />
                导出
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[250px_minmax(0,1fr)]">
            <article className="rounded-xl border border-[#e6edf5] bg-white p-4">
              <div className="text-xs font-bold text-[#2f7cf6]">消耗金额</div>
              <div className="mt-1 text-[32px] font-extrabold leading-tight text-[#2563eb]">{formatCurrency(view.usage.summary.estimatedCostCny)}</div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {usageMetricCards.map((card) => (
                  <div key={card.label} className={cn('rounded-lg border border-[#e6edf5] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]', card.className)}>
                    <div className="text-xs text-[#64748b]">{card.label}</div>
                    <div className="mt-1 text-sm font-bold text-[#1f2937]">{card.value}</div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-xl border border-[#e6edf5] bg-[#eef6ff] p-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-bold tracking-normal text-[#1f2937]">每日消耗</h3>
                <p className="text-xs text-[#64748b]">按模型费用占比堆叠，点击查看单日构成</p>
              </div>
              <div className="relative mt-3 h-[142px] border-b border-[#dbe7f6]">
                <div className="absolute inset-x-0 top-1/3 border-t border-[#dbe7f6]" />
                <div className="absolute inset-x-0 top-2/3 border-t border-[#dbe7f6]" />
                <div className="relative z-10 grid h-full items-end gap-1 px-2" style={{ gridTemplateColumns: 'repeat(31, minmax(0, 1fr))' }}>
                  {usageChartDays.map(({ day, row }) => {
                    const isActive = row?.date === selectedDailyRow?.date;
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-label={`日期 ${day}`}
                        disabled={!row}
                        onClick={() => row ? setSelectedUsageDay(row.date) : undefined}
                        className="flex h-full items-end justify-center disabled:cursor-default"
                      >
                        {row ? (
                          <span
                            className={cn('flex w-5 flex-col-reverse overflow-hidden rounded-t-md rounded-b-sm ring-2 ring-transparent transition', isActive ? 'ring-[#2f7cf6]' : 'hover:ring-[#93c5fd]')}
                            style={{ height: `${Math.max(8, (row.estimatedCostCny / maxDayCost) * 100)}%` }}
                          >
                            {row.modelCosts.map((model) => (
                              <span
                                key={`${row.date}-${model.modelId}`}
                                className={modelCostColors[model.providerId] ?? 'bg-[#94a3b8]'}
                                style={{ height: `${Math.max(4, (model.estimatedCostCny / Math.max(0.0001, row.estimatedCostCny)) * 100)}%` }}
                              />
                            ))}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-2 grid px-2 text-xs text-[#64748b]" style={{ gridTemplateColumns: 'repeat(31, minmax(0, 1fr))' }}>
                {usageChartDays.map(({ day }) => (
                  <span key={day} className={cn('text-center', [1, 5, 10, 15, 20, 25, 30, 31].includes(day) ? 'opacity-100' : 'opacity-0')}>
                    {day}
                  </span>
                ))}
              </div>
            </article>
          </div>

          {view.emptyState ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <div className="font-bold">{view.emptyState.title}</div>
              <p className="mt-2 text-sm leading-6">{view.emptyState.description}</p>
              <p className="mt-1 text-sm leading-6">真实 AI、真实日志、真实机构排行和正式计费均未接入。</p>
            </div>
          ) : null}

          {view.hasUsageData && selectedDailyRow ? (
            <article className="mt-4 rounded-[16px] border border-[#e6edf5] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold tracking-normal text-[#1f2937]">{selectedDailyRow.date}</h3>
                  <p className="mt-1 text-xs text-[#64748b]">单日模型费用构成</p>
                </div>
                <span className="rounded-full bg-[#eaf3ff] px-3 py-1 text-xs font-bold text-[#2563eb]">{formatCurrency(selectedDailyRow.estimatedCostCny)}</span>
              </div>
              <div className="mt-4 grid gap-2 lg:grid-cols-3">
                {selectedDailyRow.modelCosts.map((model) => (
                  <div key={`${selectedDailyRow.date}-${model.modelId}`} className="flex items-center justify-between gap-3 rounded-lg border border-[#e6edf5] bg-[#f8fafc] px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('h-2.5 w-2.5 rounded-full', modelCostColors[model.providerId] ?? 'bg-[#94a3b8]')} />
                        <span className="truncate text-sm font-bold text-[#1f2937]">{model.modelName}</span>
                      </div>
                      <div className="mt-1 pl-4 text-xs text-[#64748b]">调用 {numberFormatter.format(model.calls)} 次 · Token {numberFormatter.format(model.totalTokens)}</div>
                    </div>
                    <div className="shrink-0 text-sm font-bold text-[#1f2937]">{formatCurrency(model.estimatedCostCny)}</div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </div>

        {view.hasUsageData ? (
          <div className="mt-4 space-y-4">
            <article className="rounded-[16px] border border-[#e6edf5] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-3 border-b border-[#e6edf5] pb-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg font-bold tracking-normal text-[#1f2937]">厂商与模型消耗明细</h3>
                  <p className="mt-1 text-sm text-[#64748b]">按厂商汇总调用量、Token、金额和成功率，默认展示当月消耗。</p>
                </div>
	                <div className="flex items-center gap-2">
	                  {renderUsageMonthButton('provider', '选择厂商模型消耗月份')}
	                  <span className="rounded-full bg-[#f5ecff] px-3 py-2 text-xs font-bold text-[#9333ea]">总金额 {formatCurrency(view.usage.summary.estimatedCostCny)}</span>
	                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-5">
                {providerGroups.map((provider) => {
                  const isActive = selectedProviderGroup?.providerId === provider.providerId;
                  return (
                    <button
                      key={provider.providerId}
                      type="button"
                      aria-label={`厂商 ${provider.providerName}`}
                      aria-pressed={isActive}
                      onClick={() => setSelectedUsageProvider(isActive ? null : provider.providerId)}
                      className={cn(
                        'min-h-[128px] rounded-xl border p-3 text-left transition',
                        isActive ? 'border-[#bfdbfe] bg-[#eaf3ff]' : 'border-[#e6edf5] bg-[#f8fafc] hover:border-[#bfdbfe]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={cn('grid h-7 w-7 place-items-center rounded-lg text-xs font-bold text-white', modelCostColors[provider.providerId] ?? 'bg-[#2f7cf6]')}>
                            {provider.providerName.slice(0, 1)}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-[#1f2937]">{provider.providerName}</div>
                            <div className="mt-0.5 text-xs text-[#64748b]">{provider.models.length} 个模型 · 金额占比 {provider.costShare}%</div>
                          </div>
                        </div>
                        <span className="text-[#94a3b8]">{isActive ? '⌄' : '⌃'}</span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-y-2 text-xs text-[#64748b]">
                        <div><span className="block">调用</span><strong className="text-[#1f2937]">{numberFormatter.format(provider.calls)}</strong></div>
                        <div><span className="block">费用</span><strong className="text-[#1f2937]">{formatCurrency(provider.estimatedCostCny)}</strong></div>
                        <div><span className="block">Token</span><strong className="text-[#1f2937]">{numberFormatter.format(provider.totalTokens)}</strong></div>
                        <div><span className="block">成功率</span><strong className="text-[#1f2937]">{formatPercent(provider.successRate)}</strong></div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedProviderGroup ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-[#e6edf5] bg-white">
                  <div className="flex flex-col gap-3 border-b border-[#e6edf5] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-base font-bold text-[#1f2937]">{selectedProviderGroup.providerName} 模型明细</div>
                      <p className="mt-1 text-xs text-[#64748b]">仅展示当前厂商模型，厂商合计 {formatCurrency(selectedProviderGroup.estimatedCostCny)}，占总费用 {selectedProviderGroup.costShare}%。</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-lg bg-[#f8fafc] px-4 py-2"><span className="block text-[#64748b]">调用</span><strong>{numberFormatter.format(selectedProviderGroup.calls)}</strong></div>
                      <div className="rounded-lg bg-[#f8fafc] px-4 py-2"><span className="block text-[#64748b]">Token</span><strong>{numberFormatter.format(selectedProviderGroup.totalTokens)}</strong></div>
                      <div className="rounded-lg bg-[#f8fafc] px-4 py-2"><span className="block text-[#64748b]">均耗时</span><strong>{formatLatency(selectedProviderGroup.averageLatencyMs)}</strong></div>
                    </div>
                  </div>
                  <div className="max-h-[330px] overflow-auto">
                    <table className="w-full min-w-[980px] text-left text-sm">
                      <thead className="sticky top-0 bg-[#eaf3ff] text-xs font-bold text-[#64748b]">
                        <tr>
                          <th className="px-4 py-3">模型</th>
                          <th className="px-4 py-3">调用</th>
                          <th className="px-4 py-3">输入 Token</th>
                          <th className="px-4 py-3">输出 Token</th>
                          <th className="px-4 py-3">总 Token</th>
                          <th className="px-4 py-3">成功率</th>
                          <th className="px-4 py-3">均耗时</th>
                          <th className="px-4 py-3">金额</th>
                          <th className="px-4 py-3">厂商占比</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e6edf5] bg-white">
                        {selectedProviderGroup.models.map((model) => (
                          <tr key={model.modelId}>
                            <td className="px-4 py-3">
                              <div className="font-bold text-[#1f2937]">{model.modelName}</div>
                              <div className="mt-1 text-xs text-[#94a3b8]">{selectedProviderGroup.providerId} · {model.modelId}</div>
                            </td>
                            <td className="px-4 py-3 text-[#1f2937]">{numberFormatter.format(model.calls)}</td>
                            <td className="px-4 py-3 text-[#1f2937]">{numberFormatter.format(model.inputTokens)}</td>
                            <td className="px-4 py-3 text-[#1f2937]">{numberFormatter.format(model.outputTokens)}</td>
                            <td className="px-4 py-3 text-[#1f2937]">{numberFormatter.format(model.totalTokens)}</td>
                            <td className="px-4 py-3 text-[#1f2937]">{formatPercent(model.successRate)}</td>
                            <td className="px-4 py-3 text-[#1f2937]">{formatLatency(model.averageLatencyMs)}</td>
                            <td className="px-4 py-3 font-bold text-[#1f2937]">{formatCurrency(model.estimatedCostCny)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[#eef2f7]">
                                  <span className="block h-full rounded-full bg-[#2f7cf6]" style={{ width: `${Math.min(100, Math.max(0, model.costShare))}%` }} />
                                </span>
                                <span>{model.costShare}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-[#e6edf5] bg-[#f8fafc] py-7 text-center text-sm text-[#64748b]">选择上方厂商后查看模型消耗明细</div>
              )}
            </article>

            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <article className="rounded-[16px] border border-[#e6edf5] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold tracking-normal text-[#1f2937]">业务场景消耗</h3>
                    <p className="mt-1 text-sm text-[#64748b]">统一业务口径，技术来源保留在标签中。</p>
                  </div>
                  <span className="rounded-full border border-[#e6edf5] bg-white px-3 py-1 text-xs font-bold text-[#64748b]">{view.usage.scenarioRows.length} 项</span>
                </div>
                <div className="mt-4 grid max-h-[520px] gap-3 overflow-auto pr-1 lg:grid-cols-2">
                  {view.usage.scenarioRows.map((row) => (
                    <div key={row.scenarioId} className="rounded-xl border border-[#e6edf5] bg-[#f8fafc] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-bold text-[#1f2937]">{row.scenarioName}</div>
                        <div className="shrink-0 font-bold text-[#1f2937]">{formatCurrency(row.estimatedCostCny)}</div>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#64748b]">{row.description}</p>
                      <div className="mt-2 text-xs text-[#64748b]">{numberFormatter.format(row.calls)} 次 · {numberFormatter.format(row.totalTokens)} Token · 成功率 {formatPercent(row.successRate)}</div>
                      {row.sourceScenarios.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {row.sourceScenarios.map((source) => (
                            <span key={`${row.scenarioId}-${source}`} className="rounded bg-white px-2 py-1 text-xs text-[#64748b]">{source}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[16px] border border-[#e6edf5] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold tracking-normal text-[#1f2937]">机构用量排行</h3>
                    <p className="mt-1 text-sm text-[#64748b]">点击机构查看场景明细</p>
                  </div>
                  <span className="rounded-full border border-[#e6edf5] bg-white px-3 py-1 text-xs font-bold text-[#64748b]">{view.usage.sampleInstitutionRanking.length} 家</span>
                </div>
                <div className="mt-4 space-y-3">
                  {view.usage.sampleInstitutionRanking.map((row, index) => (
                    <button
                      key={row.institutionName}
                      type="button"
                      aria-label={`机构 ${row.institutionName}`}
                      onClick={() => setSelectedUsageInstitution(row.institutionName)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition',
                        selectedInstitution?.institutionName === row.institutionName ? 'border-[#bfdbfe] bg-[#eaf3ff]' : 'border-[#e6edf5] bg-[#f8fafc] hover:border-[#bfdbfe]',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#2563eb] text-sm font-bold text-white">{index + 1}</span>
                        <div className="min-w-0">
                          <div className="truncate font-bold text-[#1f2937]">{row.institutionName}</div>
                          <div className="mt-1 text-xs text-[#64748b]">{numberFormatter.format(row.calls)} 次调用 · {numberFormatter.format(row.totalTokens)} Token · 成功率 {formatPercent(view.usage.summary.successRate)}</div>
                        </div>
                      </div>
                      <div className="shrink-0 text-base font-bold text-[#2563eb]">{formatCurrency(row.estimatedCostCny)}</div>
                    </button>
                  ))}
                </div>
                {selectedInstitution ? (
                  <div className="mt-4 rounded-xl bg-[#eef6ff] p-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="font-bold text-[#1f2937]">{selectedInstitution.institutionName} 场景明细</div>
                      <button type="button" className="text-xs font-bold text-[#2f7cf6]">场景明细</button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {selectedInstitution.scenarios.map((scenario) => (
                        <div key={`${selectedInstitution.institutionName}-${scenario.scenarioName}`} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-[#1f2937]">{scenario.scenarioName}</span>
                          <span className="font-bold text-[#1f2937]">{numberFormatter.format(scenario.calls)} 次 · {formatCurrency(scenario.estimatedCostCny)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}
