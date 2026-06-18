'use client';

import { useState } from 'react';
import { useEffect } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Cpu,
  Layers3,
  Network,
  PlayCircle,
  PlusCircle,
  ShieldAlert,
  Sparkles,
  Trash2,
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

type PlatformAiRuntimeStatusView = {
  readonly: true;
  dataSource: 'env_only';
  enabled: boolean;
  configured: boolean;
  provider: 'openai_compatible' | 'unsupported' | null;
  model: string | null;
  baseUrlConfigured: boolean;
  missingKeys: string[];
  safety: {
    title: string;
    keyPolicy: string;
    smokePolicy: string;
  };
};

type PlatformAiRuntimeSmokeView = {
  ok: boolean;
  status: 'skipped' | 'ok' | 'failed';
  latencyMs: number;
  provider: 'openai_compatible' | 'unsupported' | null;
  model: string | null;
  checkedAt: string;
  errorCode: string | null;
};

type PlatformAiProviderConfigView = {
  configured: boolean;
  provider: 'openai_compatible' | null;
  model: string | null;
  baseUrlConfigured: boolean;
  lastCheckStatus: 'not_checked' | 'ok' | 'failed' | 'skipped';
  lastCheckedAt: string | null;
  updatedAt: string | null;
};

type VendorProviderConfigView = {
  id: string;
  vendor: string;
  displayName: string;
  provider: string;
  baseUrl: string;
  model: string;
  configured: boolean;
  lastCheckStatus: string;
  lastCheckedAt: string | null;
  updatedAt: string | null;
};

const SUPPORTED_VENDOR_KEYS = ['doubao', 'deepseek', 'qwen', 'chatglm', 'kimi'] as const;

const VENDOR_DISPLAY_NAMES: Record<string, string> = {
  doubao: '豆包 (Volcengine)',
  deepseek: 'DeepSeek',
  qwen: '通义千问',
  chatglm: '智谱 GLM',
  kimi: 'Kimi',
};

const VENDOR_DEFAULT_BASE_URLS: Record<string, string> = {
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  deepseek: 'https://api.deepseek.com/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  chatglm: 'https://open.bigmodel.cn/api/paas/v4',
  kimi: 'https://api.moonshot.cn/v1',
};

const VENDOR_DEFAULT_MODELS: Record<string, string> = {
  doubao: 'doubao-seed-1-8-251228',
  deepseek: 'deepseek-v4-flash',
  qwen: 'qwen-plus-latest',
  chatglm: 'glm-4.7-flash',
  kimi: 'kimi-k2-5-260127',
};

function formatLastChecked(value: string | null) {
  if (!value) return '未检查';
  try {
    return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  } catch {
    return value;
  }
}

function formatUpdatedAt(value: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  } catch {
    return value;
  }
}

const runtimeStatusFallback: PlatformAiRuntimeStatusView = {
  readonly: true as const,
  dataSource: 'env_only',
  enabled: false,
  configured: false,
  provider: null,
  model: null,
  baseUrlConfigured: false,
  missingKeys: ['ZMTG_AI_RUNTIME_ENABLED', 'ZMTG_AI_PROVIDER', 'ZMTG_AI_BASE_URL', 'ZMTG_AI_API_KEY', 'ZMTG_AI_MODEL'],
  safety: {
    title: 'AI Runtime env-only 可用性',
    keyPolicy: 'API Key 仅从服务端环境变量读取，不在页面输入、不回显、不保存。',
    smokePolicy: '真实调用仅用于固定 smoke test，不接收用户 prompt。',
  },
};




export function OpenPlatformAiReadonlyPanel() {
  const [selectedMonth, setSelectedMonth] = useState('2026-06');
  const [runtimeStatus, setRuntimeStatus] = useState<PlatformAiRuntimeStatusView | null>(null);
  const [runtimeStatusLoadFailed, setRuntimeStatusLoadFailed] = useState(false);
  const [runtimeSmokeResult, setRuntimeSmokeResult] = useState<PlatformAiRuntimeSmokeView | null>(null);
  const [isRuntimeSmokeRunning, setIsRuntimeSmokeRunning] = useState(false);
  const [dryRunSmokeResult, setDryRunSmokeResult] = useState<PlatformAiRuntimeSmokeView | null>(null);
  const [isDryRunSmokeRunning, setIsDryRunSmokeRunning] = useState(false);
  const [vendorConfigs, setVendorConfigs] = useState<VendorProviderConfigView[]>([]);
  const [vendorConfigsLoadFailed, setVendorConfigsLoadFailed] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string>('doubao');
  const [vendorForm, setVendorForm] = useState({
    baseUrl: VENDOR_DEFAULT_BASE_URLS.doubao,
    model: VENDOR_DEFAULT_MODELS.doubao,
    apiKey: '',
  });
  const [vendorSaveState, setVendorSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [vendorDeleteState, setVendorDeleteState] = useState<'idle' | 'deleting' | 'deleted' | 'failed'>('idle');
  const currentConfig = vendorConfigs.find((c) => c.vendor === selectedVendor);
  const view = loadOpenPlatformAiReadonlyView({ month: selectedMonth });
  const effectiveRuntimeStatus = runtimeStatus ?? runtimeStatusFallback;
  const canRunRuntimeSmoke = effectiveRuntimeStatus.enabled && effectiveRuntimeStatus.configured;
  const canRunDryRunSmoke = currentConfig?.configured ?? false;
  const summaryCards = [
    { label: '月份', value: view.month, icon: Clock3, tone: 'bg-cyan-300/[0.12] text-cyan-100' },
    { label: '总调用数', value: numberFormatter.format(view.usage.summary.totalCalls), icon: Cpu, tone: 'bg-blue-300/[0.12] text-blue-100' },
    { label: 'Token', value: numberFormatter.format(view.usage.summary.totalTokens), icon: Layers3, tone: 'bg-violet-300/[0.12] text-violet-100' },
    { label: '成功率', value: formatPercent(view.usage.summary.successRate), icon: CheckCircle2, tone: 'bg-emerald-300/[0.12] text-emerald-100' },
    { label: '平均延迟', value: formatLatency(view.usage.summary.averageLatencyMs), icon: Network, tone: 'bg-amber-300/[0.12] text-amber-100' },
    { label: '估算费用 / 运营参考', value: formatCurrency(view.usage.summary.estimatedCostCny), icon: CircleDollarSign, tone: 'bg-rose-300/[0.12] text-rose-100' },
  ];

  useEffect(() => {
    let isMounted = true;

    fetch('/api/v1/open-platform/ai-runtime/status', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('runtime_status_unavailable');
        return response.json() as Promise<PlatformAiRuntimeStatusView>;
      })
      .then((payload) => {
        if (!isMounted) return;
        setRuntimeStatus(payload);
        setRuntimeStatusLoadFailed(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setRuntimeStatus(runtimeStatusFallback);
        setRuntimeStatusLoadFailed(true);
      });

    fetch('/api/v1/open-platform/provider-configs', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('vendor_configs_unavailable');
        return response.json() as Promise<{ configs: VendorProviderConfigView[] }>;
      })
      .then((payload) => {
        if (!isMounted) return;
        const configs = payload.configs ?? [];
        setVendorConfigs(configs);
        setVendorConfigsLoadFailed(false);
        const currentCfg = configs.find((c) => c.vendor === 'doubao');
        if (currentCfg) {
          setVendorForm({
            baseUrl: currentCfg.baseUrl,
            model: currentCfg.model,
            apiKey: '',
          });
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setVendorConfigs([]);
        setVendorConfigsLoadFailed(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function saveVendorConfig() {
    if (vendorSaveState === 'saving') return;
    if (vendorConfigsLoadFailed) {
      setVendorSaveState('failed');
      return;
    }
    setVendorSaveState('saving');

    try {
      const response = await fetch('/api/v1/open-platform/provider-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: selectedVendor,
          baseUrl: vendorForm.baseUrl,
          model: vendorForm.model,
          apiKey: vendorForm.apiKey,
        }),
      });
      const payload = await response.json() as VendorProviderConfigView | { ok: false; errorCode: string };

      if (!response.ok || 'ok' in payload) {
        throw new Error('vendor_config_save_failed');
      }

      setVendorConfigs((prev) => {
        const idx = prev.findIndex((c) => c.vendor === selectedVendor);
        const config = payload as VendorProviderConfigView;
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = config;
          return next;
        }
        return [...prev, config];
      });
      setVendorForm((current) => ({ ...current, apiKey: '' }));
      setVendorSaveState('saved');
    } catch {
      setVendorSaveState('failed');
    }
  }

  async function deleteVendorConfig() {
    if (vendorDeleteState === 'deleting') return;
    if (vendorConfigsLoadFailed) {
      setVendorDeleteState('failed');
      return;
    }
    setVendorDeleteState('deleting');

    try {
      const response = await fetch(
        `/api/v1/open-platform/provider-configs?vendor=${encodeURIComponent(selectedVendor)}`,
        { method: 'DELETE' },
      );
      const payload = await response.json() as Record<string, unknown>;

      if (!response.ok) {
        throw new Error('vendor_config_delete_failed');
      }

      if (payload.ok) {
        setVendorConfigs((prev) => prev.filter((c) => c.vendor !== selectedVendor));
        setVendorForm({
          baseUrl: VENDOR_DEFAULT_BASE_URLS[selectedVendor],
          model: VENDOR_DEFAULT_MODELS[selectedVendor],
          apiKey: '',
        });
        setVendorDeleteState('deleted');
      } else {
        throw new Error('vendor_config_delete_failed');
      }
    } catch {
      setVendorDeleteState('failed');
    }
  }

  async function runDryRunSmokeTest() {
    if (isDryRunSmokeRunning) return;
    setIsDryRunSmokeRunning(true);
    setDryRunSmokeResult(null);

    try {
      const response = await fetch('/api/v1/open-platform/provider-configs/smoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor: selectedVendor }),
      });
      const payload = await response.json() as PlatformAiRuntimeSmokeView;

      if (!response.ok && 'ok' in payload && !payload.ok) {
        setDryRunSmokeResult({
          ok: false,
          status: 'failed',
          latencyMs: 0,
          provider: null,
          model: null,
          checkedAt: new Date().toISOString(),
          errorCode: 'PROVIDER_REQUEST_FAILED',
        });
      } else {
        setDryRunSmokeResult(payload);
      }
    } catch {
      setDryRunSmokeResult({
        ok: false,
        status: 'failed',
        latencyMs: 0,
        provider: null,
        model: null,
        checkedAt: new Date().toISOString(),
        errorCode: 'PROVIDER_REQUEST_FAILED',
      });
    } finally {
      setIsDryRunSmokeRunning(false);
    }
  }

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

      <section className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6" aria-labelledby="ai-runtime-status-heading">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-1 text-xs font-semibold text-emerald-100">
              env-only
            </div>
            <h2 id="ai-runtime-status-heading" className="mt-3 text-xl font-semibold tracking-normal text-white">AI Runtime 状态</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              真实调用已禁用。dry-run readiness 检查厂商配置完整性，不解密 Key、不外呼厂商 API。
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              {effectiveRuntimeStatus.safety.smokePolicy}
            </p>
            {runtimeStatusLoadFailed ? (
              <p className="mt-2 text-xs font-semibold text-amber-100">状态读取失败，当前按未配置展示。</p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={!canRunDryRunSmoke || isDryRunSmokeRunning}
            onClick={() => void runDryRunSmokeTest()}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
              canRunDryRunSmoke
                ? 'border-cyan-200/50 bg-cyan-300/[0.16] text-cyan-50 hover:bg-cyan-300/[0.22]'
                : 'cursor-not-allowed border-white/10 bg-white/[0.05] text-slate-500',
            )}
          >
            <PlayCircle className="h-4 w-4" />
            dry-run readiness
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: '启用状态', value: effectiveRuntimeStatus.enabled ? '已启用' : '未启用' },
            { label: '配置状态', value: effectiveRuntimeStatus.configured ? '配置完整' : '配置不完整' },
            { label: 'Provider', value: effectiveRuntimeStatus.provider ?? '未配置' },
            { label: '模型名', value: effectiveRuntimeStatus.model ?? '未配置' },
            { label: 'Base URL', value: effectiveRuntimeStatus.baseUrlConfigured ? '已配置' : '未配置' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
              <div className="text-sm text-slate-400">{item.label}</div>
              <div className="mt-3 text-base font-semibold text-white">{item.value}</div>
            </div>
          ))}
        </div>

        {effectiveRuntimeStatus.missingKeys.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] p-4">
            <div className="text-sm font-semibold text-amber-50">缺失配置项</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {effectiveRuntimeStatus.missingKeys.map((key) => (
                <span key={key} className="rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-3 py-1 text-xs font-semibold text-amber-100">
                  {key}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {runtimeSmokeResult ? (
          <div className={cn(
            'mt-4 rounded-2xl border p-4 text-sm leading-6',
            runtimeSmokeResult.ok
              ? 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-50'
              : 'border-rose-300/20 bg-rose-300/[0.08] text-rose-50',
          )}>
            <div className="font-semibold">{runtimeSmokeResult.ok ? 'smoke test 通过' : 'smoke test 未通过'}</div>
            <p className="mt-1">
              状态：{runtimeSmokeResult.status} · 延迟：{formatLatency(runtimeSmokeResult.latencyMs)} · 模型：{runtimeSmokeResult.model ?? '未配置'}
            </p>
            {runtimeSmokeResult.errorCode ? <p className="mt-1">错误码：{runtimeSmokeResult.errorCode}</p> : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6" aria-labelledby="ai-vendor-config-heading">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 id="ai-vendor-config-heading" className="text-xl font-semibold tracking-normal text-white">厂商 Key 配置</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              支持 {SUPPORTED_VENDOR_KEYS.length} 家厂商独立配置，仅保存到服务端加密存储，页面只展示低敏状态；保存后不返回 Key。
            </p>
            {vendorConfigsLoadFailed ? (
              <p className="mt-2 text-xs font-semibold text-amber-100">厂商配置读取失败，当前展示为空。</p>
            ) : null}
          </div>
          <div className={cn(
            'inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold',
            currentConfig?.configured
              ? 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100'
              : 'border-amber-300/20 bg-amber-300/[0.08] text-amber-100',
          )}>
            {currentConfig?.configured ? '已配置' : '未配置'}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {SUPPORTED_VENDOR_KEYS.map((vendor) => {
            const config = vendorConfigs.find((c) => c.vendor === vendor);
            const isActive = vendor === selectedVendor;
            return (
              <button
                key={vendor}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  const cfg = vendorConfigs.find((c) => c.vendor === vendor);
                  setSelectedVendor(vendor);
                  setVendorForm({
                    baseUrl: cfg?.baseUrl ?? VENDOR_DEFAULT_BASE_URLS[vendor],
                    model: cfg?.model ?? VENDOR_DEFAULT_MODELS[vendor],
                    apiKey: '',
                  });
                  setVendorSaveState('idle');
                  setVendorDeleteState('idle');
                }}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition',
                  isActive
                    ? 'border-cyan-200/50 bg-cyan-300/[0.16] text-cyan-50'
                    : 'border-white/10 bg-white/[0.06] text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100',
                )}
              >
                {VENDOR_DISPLAY_NAMES[vendor] ?? vendor}
                {config?.configured ? (
                  <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: '厂商', value: VENDOR_DISPLAY_NAMES[selectedVendor] ?? selectedVendor },
            { label: '模型', value: currentConfig?.model ?? VENDOR_DEFAULT_MODELS[selectedVendor] },
            { label: 'Base URL', value: currentConfig?.baseUrl ?? VENDOR_DEFAULT_BASE_URLS[selectedVendor] },
            { label: '检查状态', value: currentConfig?.lastCheckStatus ?? 'not_checked' },
            { label: '最后检查时间', value: formatLastChecked(currentConfig?.lastCheckedAt ?? null) },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
              <div className="text-sm text-slate-400">{item.label}</div>
              <div className="mt-2 text-sm font-semibold text-white break-all">{item.value}</div>
            </div>
          ))}
        </div>

        <form
          className="mt-5 grid gap-4 xl:grid-cols-[1.3fr_1fr_1.3fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            if (vendorConfigsLoadFailed) return;
            void saveVendorConfig();
          }}
        >
          <label className="space-y-2 text-sm font-semibold text-slate-200">
            <span>Base URL</span>
            <input
              aria-label="Base URL"
              value={vendorForm.baseUrl}
              disabled={vendorConfigsLoadFailed}
              onChange={(event) => setVendorForm((current) => ({ ...current, baseUrl: event.target.value }))}
              className="h-11 w-full rounded-xl border border-white/10 bg-[#071322]/72 px-3 text-sm text-white outline-none transition focus:border-cyan-200/50 disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-200">
            <span>Model</span>
            <input
              aria-label="Model"
              value={vendorForm.model}
              disabled={vendorConfigsLoadFailed}
              onChange={(event) => setVendorForm((current) => ({ ...current, model: event.target.value }))}
              className="h-11 w-full rounded-xl border border-white/10 bg-[#071322]/72 px-3 text-sm text-white outline-none transition focus:border-cyan-200/50 disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-200">
            <span>API Key（仅输入新 key，不回显旧值）</span>
            <input
              aria-label="API Key"
              type="password"
              value={vendorForm.apiKey}
              disabled={vendorConfigsLoadFailed}
              onChange={(event) => setVendorForm((current) => ({ ...current, apiKey: event.target.value }))}
              className="h-11 w-full rounded-xl border border-white/10 bg-[#071322]/72 px-3 text-sm text-white outline-none transition focus:border-cyan-200/50 disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={vendorSaveState === 'saving' || vendorConfigsLoadFailed}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-cyan-200/50 bg-cyan-300/[0.16] px-5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/[0.22] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.05] disabled:text-slate-500"
            >
              <PlusCircle className="h-4 w-4" />
              保存
            </button>
            <button
              type="button"
              disabled={vendorConfigsLoadFailed || vendorDeleteState === 'deleting' || !currentConfig}
              onClick={() => void deleteVendorConfig()}
              className={cn(
                'inline-flex h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition',
                currentConfig
                  ? 'border-rose-300/30 bg-rose-300/[0.10] text-rose-100 hover:bg-rose-300/[0.18]'
                  : 'cursor-not-allowed border-white/10 bg-white/[0.05] text-slate-500',
              )}
            >
              <Trash2 className="h-4 w-4" />
              删除
            </button>
          </div>
        </form>

        {vendorSaveState === 'saved' ? (
          <p className="mt-3 text-sm font-semibold text-emerald-100">配置已保存，Key 输入已清空。</p>
        ) : null}
        {vendorSaveState === 'failed' ? (
          <p className="mt-3 text-sm font-semibold text-rose-100">配置保存失败，请检查必填项或服务端加密设置。</p>
        ) : null}
        {vendorDeleteState === 'deleted' ? (
          <p className="mt-3 text-sm font-semibold text-emerald-100">配置已删除。</p>
        ) : null}
        {vendorDeleteState === 'failed' ? (
          <p className="mt-3 text-sm font-semibold text-rose-100">删除失败，请重试。</p>
        ) : null}
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6" aria-labelledby="ai-model-catalog-heading">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="ai-model-catalog-heading" className="text-xl font-semibold tracking-normal text-white">AI 模型目录</h2>
            <p className="mt-1 text-sm text-slate-400">厂商列表、模型列表、能力分组、推荐业务场景和继承关系均来自受控示例数据。</p>
            <p className="mt-2 text-xs font-semibold text-cyan-100">Registry 状态：{view.registryStatusNote}</p>
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
            <p className="mt-2 text-xs font-semibold text-rose-100">用量口径：当前为受控示例用量，费用为估算，不是正式账单。</p>
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
