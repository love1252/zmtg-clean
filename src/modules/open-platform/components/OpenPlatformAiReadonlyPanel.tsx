'use client';

import { useState } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Cpu,
  Layers3,
  Network,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { loadOpenPlatformAiReadonlyView } from '@/modules/open-platform/lib/platformAiReadonlyViewLoader';
import { cn } from '@/shared/utils/cn';

const percentFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'percent',
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat('zh-CN');

function formatPercent(value: number) {
  return percentFormatter.format(value);
}

function formatCurrency(value: number) {
  return `¥${value.toFixed(2)}`;
}

function formatLatency(value: number) {
  return `${numberFormatter.format(value)}ms`;
}

export function OpenPlatformAiReadonlyPanel() {
  const [selectedMonth, setSelectedMonth] = useState('2026-06');
  const view = loadOpenPlatformAiReadonlyView({ month: selectedMonth });
  const summaryCards = [
    { label: '月份', value: view.month, icon: Clock3, tone: 'bg-cyan-300/[0.12] text-cyan-100' },
    { label: '总调用数', value: numberFormatter.format(view.usage.summary.totalCalls), icon: Cpu, tone: 'bg-blue-300/[0.12] text-blue-100' },
    { label: 'Token', value: numberFormatter.format(view.usage.summary.totalTokens), icon: Layers3, tone: 'bg-violet-300/[0.12] text-violet-100' },
    { label: '成功率', value: formatPercent(view.usage.summary.successRate), icon: CheckCircle2, tone: 'bg-emerald-300/[0.12] text-emerald-100' },
    { label: '平均延迟', value: formatLatency(view.usage.summary.averageLatencyMs), icon: Network, tone: 'bg-amber-300/[0.12] text-amber-100' },
    { label: '估算费用 / 运营参考', value: formatCurrency(view.usage.summary.estimatedCostCny), icon: CircleDollarSign, tone: 'bg-rose-300/[0.12] text-rose-100' },
  ];

  return (
    <section className="space-y-6" aria-labelledby="open-platform-ai-readonly-heading">
      <div className="overflow-hidden rounded-[28px] border border-cyan-300/18 bg-white/[0.075] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl lg:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[0.10] px-3.5 py-1.5 text-xs font-semibold text-cyan-100">
              <Sparkles className="h-4 w-4" />
              {view.scopeLabel}
            </div>
            <h1 id="open-platform-ai-readonly-heading" className="mt-5 text-3xl font-semibold tracking-normal text-white sm:text-4xl">
              AI 模型与用量
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              平台端只读展示 AI 模型目录、能力分组、场景关系和用量费用信息架构；当前不接入真实模型服务，不读取真实机构日志。
            </p>
          </div>
          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] p-4 text-sm leading-6 text-amber-50 lg:w-[420px]">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-5 w-5" />
              {view.safetyBanner.title}
            </div>
            <p className="mt-2 text-amber-100/90">估算费用不是正式账单。</p>
            <p className="mt-1 text-amber-100/90">真实 AI 未启用，API Key 管理、模型同步和自动扣费均未启用。</p>
          </div>
        </div>
      </div>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6" aria-labelledby="ai-model-catalog-heading">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="ai-model-catalog-heading" className="text-xl font-semibold tracking-normal text-white">AI 模型目录</h2>
            <p className="mt-1 text-sm text-slate-400">厂商列表、模型列表、能力分组、推荐业务场景和继承关系均来自受控示例数据。</p>
          </div>
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs font-semibold text-cyan-100">
            模型启用状态说明
          </span>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="text-sm font-semibold text-slate-200">厂商列表</div>
            {view.modelCatalog.providers.map((provider) => (
              <article key={provider.providerId} className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold tracking-normal text-white">{provider.providerName}</h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-2.5 py-1 text-emerald-100">
                        {provider.lowSensitiveConfigStatus}
                      </span>
                      <span className="rounded-full border border-slate-300/15 bg-white/[0.06] px-2.5 py-1 text-slate-300">
                        Key 管理未启用
                      </span>
                    </div>
                  </div>
                  <p className="max-w-xl text-sm leading-6 text-slate-400">{provider.enabledStatusNote}</p>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {provider.models.map((model) => (
                    <div key={model.modelId} className="rounded-xl border border-white/10 bg-white/[0.055] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{model.displayName}</div>
                          <div className="mt-1 text-xs text-slate-500">{model.modelId} · {model.contextWindowLabel}</div>
                        </div>
                        <span className={cn(
                          'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                          model.status === 'sample_enabled' ? 'bg-emerald-300/[0.10] text-emerald-100' : 'bg-amber-300/[0.10] text-amber-100',
                        )}>
                          {model.statusLabel}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {model.capabilityIds.map((capability) => (
                          <span key={capability} className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-xs text-slate-300">
                            {capability}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 text-xs leading-5 text-slate-400">
                        推荐业务场景：{model.recommendedScenarios.join('、')}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
              <h3 className="text-sm font-semibold text-slate-200">推荐业务场景</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                AI-1 只展示客服回复、知识库问答、智能随访、工作流判断和数据分析等示例场景，不触发任何真实调用。
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
              <h3 className="text-sm font-semibold text-slate-200">能力分组</h3>
              <div className="mt-3 space-y-3">
                {view.modelCatalog.capabilityGroups.map((group) => (
                  <div key={group.capabilityId} className="rounded-xl border border-white/10 bg-white/[0.055] p-3">
                    <div className="font-semibold text-white">{group.label}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{group.description}</p>
                    <div className="mt-2 text-xs text-slate-500">{group.modelIds.length} 个示例模型</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
              <h3 className="text-sm font-semibold text-slate-200">场景默认模型关系</h3>
              <div className="mt-3 space-y-3">
                {view.modelCatalog.scenarioDefaults.map((scenario) => (
                  <div key={scenario.scenarioId} className="rounded-xl border border-white/10 bg-white/[0.055] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{scenario.scenarioName}</div>
                        <p className="mt-1 text-sm leading-6 text-slate-400">{scenario.description}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-blue-300/[0.10] px-2.5 py-1 text-xs font-semibold text-blue-100">
                        {scenario.requiredCapability}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-cyan-100">{scenario.defaultModelName}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
              <h3 className="text-sm font-semibold text-slate-200">Agent 继承关系</h3>
              <div className="mt-3 space-y-3">
                {view.modelCatalog.agentInheritance.map((agent) => (
                  <div key={agent.agentName} className="rounded-xl border border-white/10 bg-white/[0.055] p-3">
                    <div className="font-semibold text-white">{agent.agentName}</div>
                    <p className="mt-1 text-sm text-slate-400">{agent.agentDescription}</p>
                    <div className="mt-2 text-xs text-slate-500">{agent.inheritsScenarioName} · {agent.inheritedModelName}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6" aria-labelledby="ai-capability-coverage-heading">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="ai-capability-coverage-heading" className="text-xl font-semibold tracking-normal text-white">能力覆盖矩阵</h2>
            <p className="mt-1 text-sm text-slate-400">能力、场景和示例模型的只读对应关系；视觉与向量能力保持占位，不启用真实处理链路。</p>
          </div>
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs font-semibold text-cyan-100">
            只读覆盖关系
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {view.capabilityCoverageRows.map((row) => (
            <article key={row.capabilityId} className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/70">{row.capabilityId}</div>
              <h3 className="mt-2 text-base font-semibold tracking-normal text-white">覆盖：{row.capabilityName}</h3>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <p>场景：{row.scenarioNames.join('、')}</p>
                <p>模型：{row.modelNames.join('、')}</p>
              </div>
              <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.07] px-3 py-2 text-xs font-semibold text-amber-100">
                {row.safetyNote}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6" aria-labelledby="ai-security-boundary-heading">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="ai-security-boundary-heading" className="text-xl font-semibold tracking-normal text-white">安全边界清单</h2>
            <p className="mt-1 text-sm text-slate-400">以下能力在 AI-1-02 中仅作为低敏边界文案展示，不提供操作入口。</p>
          </div>
          <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-3 py-1 text-xs font-semibold text-amber-100">
            全部未启用
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {view.disabledCapabilities.map((capability) => (
            <div key={capability} className="rounded-2xl border border-white/10 bg-[#071322]/72 px-4 py-3 text-sm font-semibold text-slate-100">
              {capability}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6" aria-labelledby="ai-usage-heading">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="ai-usage-heading" className="text-xl font-semibold tracking-normal text-white">AI 用量与费用</h2>
            <p className="mt-1 text-sm text-slate-400">受控示例用量，不读取真实日志，不连接数据库，不展示真实机构标识。</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="flex flex-wrap gap-2">
              {view.availableMonths.map((month) => {
                const isActive = month.value === view.selectedMonth;
                const statusLabel = month.hasUsageData ? '有示例用量' : '空状态示例';

                return (
                  <button
                    key={month.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setSelectedMonth(month.value)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                      isActive
                        ? 'border-cyan-200/50 bg-cyan-300/[0.16] text-cyan-50'
                        : 'border-white/10 bg-white/[0.06] text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100',
                    )}
                  >
                    {month.label} <span className="ml-1 text-[11px] opacity-80">{statusLabel}</span>
                  </button>
                );
              })}
            </div>
            <span className="rounded-full border border-rose-300/20 bg-rose-300/[0.08] px-3 py-1 text-xs font-semibold text-rose-100">
              {view.usage.summary.billingStatusLabel}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm text-slate-400">{card.label}</div>
                <div className={cn('grid h-10 w-10 place-items-center rounded-2xl', card.tone)}>
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 text-2xl font-semibold tracking-normal text-white">{card.value}</div>
            </div>
          ))}
        </div>

        {view.emptyState ? (
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] p-5">
            <div className="text-base font-semibold text-amber-50">{view.emptyState.title}</div>
            <p className="mt-2 text-sm leading-6 text-amber-100/90">{view.emptyState.description}</p>
            <p className="mt-1 text-sm leading-6 text-amber-100/80">真实 AI、真实日志、真实机构排行和正式计费均未接入。</p>
          </div>
        ) : null}

        {view.hasUsageData ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <BrainCircuit className="h-4 w-4 text-cyan-100" />
              厂商 / 模型维度
            </div>
            <div className="mt-4 space-y-3">
              {view.usage.providerModelRows.map((row) => (
                <div key={`${row.providerName}-${row.modelName}`} className="rounded-xl border border-white/10 bg-white/[0.055] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{row.modelName}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.providerName}</div>
                    </div>
                    <div className="text-right text-sm font-semibold text-cyan-100">{formatCurrency(row.estimatedCostCny)}</div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-400">
                    <span>{numberFormatter.format(row.calls)} 次</span>
                    <span>{numberFormatter.format(row.totalTokens)} Token</span>
                    <span>{formatPercent(row.successRate)}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
            <div className="text-sm font-semibold text-white">业务场景维度</div>
            <div className="mt-4 space-y-3">
              {view.usage.scenarioRows.map((row) => (
                <div key={row.scenarioName} className="rounded-xl border border-white/10 bg-white/[0.055] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold text-white">{row.scenarioName}</div>
                    <div className="text-sm font-semibold text-cyan-100">{formatCurrency(row.estimatedCostCny)}</div>
                  </div>
                  <div className="mt-3 text-xs text-slate-400">
                    {numberFormatter.format(row.calls)} 次 · {numberFormatter.format(row.totalTokens)} Token · 成功率 {formatPercent(row.successRate)}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
            <div className="text-sm font-semibold text-white">示例机构排行</div>
            <p className="mt-1 text-xs text-slate-500">仅展示匿名示例机构，不读取真实租户。</p>
            <div className="mt-4 space-y-3">
              {view.usage.sampleInstitutionRanking.map((row, index) => (
                <div key={row.institutionName} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.055] p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cyan-300/[0.12] text-sm font-semibold text-cyan-100">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-white">{row.institutionName}</div>
                      <div className="mt-1 text-xs text-slate-500">{numberFormatter.format(row.calls)} 次 · {numberFormatter.format(row.totalTokens)} Token</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-cyan-100">{formatCurrency(row.estimatedCostCny)}</div>
                </div>
              ))}
            </div>
          </article>
          </div>
        ) : null}
      </section>
    </section>
  );
}
