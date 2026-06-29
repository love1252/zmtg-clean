'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, RefreshCw, Save, SlidersHorizontal } from 'lucide-react';

import {
  createOpenPlatformAiCreditMeteringRule,
  listOpenPlatformAiCreditMeteringRules,
  patchOpenPlatformAiCreditMeteringRule,
  type CreateOpenPlatformAiCreditMeteringRulePayload,
  type OpenPlatformAiCreditMeteringRulesClientError,
  type OpenPlatformAiCreditMeteringRulesListFilters,
  type PlatformAiCreditMeteringRuleDto,
} from '@/modules/open-platform/client/platform-ai-credit-metering-rules-client';
import { PlatformSectionBanner } from '@/modules/open-platform/components/PlatformSectionBanner';
import { cn } from '@/shared/utils/cn';

type EnabledFilter = 'all' | 'enabled' | 'disabled';

type RuleFormState = {
  provider: string;
  model: string;
  meteringVersion: string;
  inputTokenWeight: string;
  outputTokenWeight: string;
  modelMultiplier: string;
  ragCreditSurcharge: string;
  creditsPerStandardTokenUnit: string;
  enabled: boolean;
  effectiveFrom: string;
  effectiveTo: string;
};

type DateDraft = {
  effectiveFrom: string;
  effectiveTo: string;
};

const sectionShell = 'rounded-xl border border-[#e6edf5] bg-white p-5 shadow-sm lg:p-6';
const fieldShell = 'mt-1 h-10 w-full rounded-lg border border-[#dbe6f3] bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
const buttonShell = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60';

const initialForm: RuleFormState = {
  provider: '',
  model: '',
  meteringVersion: '',
  inputTokenWeight: '1',
  outputTokenWeight: '1',
  modelMultiplier: '1',
  ragCreditSurcharge: '0',
  creditsPerStandardTokenUnit: '1000',
  enabled: true,
  effectiveFrom: '',
  effectiveTo: '',
};

function toDatetimeLocalValue(value: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 16);
}

function datetimeLocalToIso(value: string) {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function formatDateTime(value: string | null) {
  if (!value) return '长期有效';
  return value.replace('T', ' ').slice(0, 16);
}

function positiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function nonNegativeInteger(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function positiveInteger(value: string) {
  const parsed = nonNegativeInteger(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function errorMessage(error: OpenPlatformAiCreditMeteringRulesClientError) {
  if (error.kind === 'unauthorized') return '登录状态已失效，请重新登录平台端。';
  if (error.kind === 'forbidden') return '当前账号没有管理 AI 积分计量规则的权限。';
  if (error.kind === 'validation_error') return `规则校验失败：${error.errors?.join('、') ?? error.message}`;
  if (error.kind === 'conflict') return '规则版本已存在，请调整计量版本。';
  if (error.kind === 'not_found') return '计量规则不存在或已被移除。';
  if (error.kind === 'service_unavailable') return '计量规则服务暂不可用，请稍后重试。';
  return error.message;
}

function validateCreateForm(form: RuleFormState): { ok: true; payload: CreateOpenPlatformAiCreditMeteringRulePayload } | { ok: false; message: string } {
  const provider = form.provider.trim();
  const model = form.model.trim();
  const meteringVersion = form.meteringVersion.trim();
  const inputTokenWeight = positiveNumber(form.inputTokenWeight);
  const outputTokenWeight = positiveNumber(form.outputTokenWeight);
  const modelMultiplier = positiveNumber(form.modelMultiplier);
  const ragCreditSurcharge = nonNegativeInteger(form.ragCreditSurcharge);
  const creditsPerStandardTokenUnit = positiveInteger(form.creditsPerStandardTokenUnit);
  const effectiveFrom = datetimeLocalToIso(form.effectiveFrom);
  const effectiveTo = form.effectiveTo.trim() ? datetimeLocalToIso(form.effectiveTo) : null;

  if (!provider || !model || !meteringVersion) return { ok: false, message: '模型厂商、模型名称和计量版本必填。' };
  if (inputTokenWeight === null || outputTokenWeight === null || modelMultiplier === null) return { ok: false, message: 'Token 权重和模型倍率必须为正数。' };
  if (ragCreditSurcharge === null) return { ok: false, message: '知识库附加积分必须为非负整数。' };
  if (creditsPerStandardTokenUnit === null) return { ok: false, message: '每标准 Token 单位积分必须为正整数。' };
  if (!effectiveFrom) return { ok: false, message: '生效开始必须为有效时间。' };
  if (form.effectiveTo.trim() && !effectiveTo) return { ok: false, message: '生效结束必须为有效时间。' };
  if (effectiveTo && new Date(effectiveTo).getTime() <= new Date(effectiveFrom).getTime()) return { ok: false, message: '生效结束必须晚于生效开始。' };

  return {
    ok: true,
    payload: {
      provider,
      model,
      meteringVersion,
      inputTokenWeight,
      outputTokenWeight,
      modelMultiplier,
      ragCreditSurcharge,
      creditsPerStandardTokenUnit,
      enabled: form.enabled,
      effectiveFrom,
      effectiveTo,
    },
  };
}

function enabledToFilter(value: EnabledFilter): boolean | null {
  if (value === 'enabled') return true;
  if (value === 'disabled') return false;
  return null;
}

function RuleStatusPill({ enabled }: { enabled: boolean }) {
  return (
    <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500')}>
      {enabled ? '已启用' : '已停用'}
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {children}
    </label>
  );
}

export function OpenPlatformAiCreditMeteringRulesPanel() {
  const [records, setRecords] = useState<PlatformAiCreditMeteringRuleDto[]>([]);
  const [providerFilter, setProviderFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>('all');
  const [form, setForm] = useState<RuleFormState>(initialForm);
  const [dateDrafts, setDateDrafts] = useState<Record<string, DateDraft>>({});
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [isMutating, setIsMutating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo<OpenPlatformAiCreditMeteringRulesListFilters>(() => ({
    provider: providerFilter,
    model: modelFilter,
    enabled: enabledToFilter(enabledFilter),
  }), [enabledFilter, modelFilter, providerFilter]);

  async function loadRules(nextFilters = filters) {
    setLoadState('loading');
    setError(null);
    const result = await listOpenPlatformAiCreditMeteringRules(nextFilters);
    if (!result.ok) {
      setLoadState('error');
      setError(errorMessage(result.error));
      return;
    }

    setRecords(result.records);
    setDateDrafts(Object.fromEntries(result.records.map((record) => [record.id, {
      effectiveFrom: toDatetimeLocalValue(record.effectiveFrom),
      effectiveTo: toDatetimeLocalValue(record.effectiveTo),
    }])));
    setLoadState('ready');
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialRules() {
      const result = await listOpenPlatformAiCreditMeteringRules({ provider: '', model: '', enabled: null });
      if (!isMounted) return;

      if (!result.ok) {
        setLoadState('error');
        setError(errorMessage(result.error));
        return;
      }

      setRecords(result.records);
      setDateDrafts(Object.fromEntries(result.records.map((record) => [record.id, {
        effectiveFrom: toDatetimeLocalValue(record.effectiveFrom),
        effectiveTo: toDatetimeLocalValue(record.effectiveTo),
      }])));
      setLoadState('ready');
    }

    void loadInitialRules();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    await loadRules(filters);
  }

  async function handleResetFilters() {
    const nextFilters = { provider: '', model: '', enabled: null };
    setProviderFilter('');
    setModelFilter('');
    setEnabledFilter('all');
    setMessage(null);
    await loadRules(nextFilters);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const validation = validateCreateForm(form);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setIsMutating(true);
    const result = await createOpenPlatformAiCreditMeteringRule(validation.payload);
    setIsMutating(false);
    if (!result.ok) {
      setError(errorMessage(result.error));
      return;
    }

    setForm(initialForm);
    setMessage('计量规则已创建');
    await loadRules(filters);
  }

  async function patchRule(id: string, payload: { enabled?: boolean; effectiveFrom?: string; effectiveTo?: string | null }, success: string) {
    setIsMutating(true);
    setError(null);
    setMessage(null);
    const result = await patchOpenPlatformAiCreditMeteringRule(id, payload);
    setIsMutating(false);
    if (!result.ok) {
      setError(errorMessage(result.error));
      return;
    }

    setMessage(success);
    await loadRules(filters);
  }

  async function handleSaveDates(record: PlatformAiCreditMeteringRuleDto) {
    const draft = dateDrafts[record.id];
    if (!draft) return;
    const effectiveFrom = datetimeLocalToIso(draft.effectiveFrom);
    const effectiveTo = draft.effectiveTo.trim() ? datetimeLocalToIso(draft.effectiveTo) : null;
    if (!effectiveFrom) {
      setError('生效开始必须为有效时间。');
      return;
    }
    if (draft.effectiveTo.trim() && !effectiveTo) {
      setError('生效结束必须为有效时间。');
      return;
    }
    if (effectiveTo && new Date(effectiveTo).getTime() <= new Date(effectiveFrom).getTime()) {
      setError('生效结束必须晚于生效开始。');
      return;
    }
    await patchRule(record.id, { effectiveFrom, effectiveTo }, '计量规则生效期已更新');
  }

  return (
    <>
      <PlatformSectionBanner
        headingId="ai-credit-metering-rules-heading"
        headingLevel="h1"
        title="AI 积分计量规则"
        description="平台端仅维护 AI 积分低敏计量规则，不展示模型厂商凭证、不触发真实模型调用，也不会把规则明细暴露到机构端。"
      />

      {message ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      <section className={sectionShell} aria-label="AI 积分计量规则筛选">
        <div className="flex items-center gap-2 text-lg font-semibold text-slate-950">
          <SlidersHorizontal className="h-5 w-5 text-blue-600" />
          规则筛选
        </div>
        <form onSubmit={handleFilterSubmit} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_160px_auto_auto]">
          <Field label="模型厂商">
            <input className={fieldShell} value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)} placeholder="deepseek" />
          </Field>
          <Field label="模型名称">
            <input className={fieldShell} value={modelFilter} onChange={(event) => setModelFilter(event.target.value)} placeholder="deepseek-v4-flash" />
          </Field>
          <Field label="启用状态">
            <select className={fieldShell} value={enabledFilter} onChange={(event) => setEnabledFilter(event.target.value as EnabledFilter)}>
              <option value="all">全部</option>
              <option value="enabled">已启用</option>
              <option value="disabled">已停用</option>
            </select>
          </Field>
          <button type="submit" className={cn(buttonShell, 'self-end bg-blue-600 text-white hover:bg-blue-700')}>查询</button>
          <button type="button" onClick={handleResetFilters} className={cn(buttonShell, 'self-end border border-[#dbe6f3] bg-white text-slate-700 hover:bg-slate-50')}>清空</button>
        </form>
      </section>

      <section className={sectionShell} aria-label="创建 AI 积分计量规则">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">创建规则</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">权重变更请创建新的计量版本；本表单不会写入模型厂商凭证或触发 AI 调用。</p>
        </div>
        <form onSubmit={handleCreate} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="模型厂商"><input aria-label="创建模型厂商" className={fieldShell} value={form.provider} onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))} /></Field>
          <Field label="模型名称"><input aria-label="创建模型名称" className={fieldShell} value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} /></Field>
          <Field label="计量版本"><input aria-label="创建计量版本" className={fieldShell} value={form.meteringVersion} onChange={(event) => setForm((current) => ({ ...current, meteringVersion: event.target.value }))} /></Field>
          <Field label="启用状态">
            <select aria-label="创建启用状态" className={fieldShell} value={String(form.enabled)} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.value === 'true' }))}>
              <option value="true">已启用</option>
              <option value="false">已停用</option>
            </select>
          </Field>
          <Field label="输入 Token 权重"><input aria-label="创建输入 Token 权重" type="number" step="0.000001" className={fieldShell} value={form.inputTokenWeight} onChange={(event) => setForm((current) => ({ ...current, inputTokenWeight: event.target.value }))} /></Field>
          <Field label="输出 Token 权重"><input aria-label="创建输出 Token 权重" type="number" step="0.000001" className={fieldShell} value={form.outputTokenWeight} onChange={(event) => setForm((current) => ({ ...current, outputTokenWeight: event.target.value }))} /></Field>
          <Field label="模型倍率"><input aria-label="创建模型倍率" type="number" step="0.000001" className={fieldShell} value={form.modelMultiplier} onChange={(event) => setForm((current) => ({ ...current, modelMultiplier: event.target.value }))} /></Field>
          <Field label="知识库附加积分"><input aria-label="创建知识库附加积分" type="number" step="1" className={fieldShell} value={form.ragCreditSurcharge} onChange={(event) => setForm((current) => ({ ...current, ragCreditSurcharge: event.target.value }))} /></Field>
          <Field label="每标准 Token 单位积分"><input aria-label="创建每标准 Token 单位积分" type="number" step="1" className={fieldShell} value={form.creditsPerStandardTokenUnit} onChange={(event) => setForm((current) => ({ ...current, creditsPerStandardTokenUnit: event.target.value }))} /></Field>
          <Field label="生效开始"><input aria-label="创建生效开始" type="datetime-local" className={fieldShell} value={form.effectiveFrom} onChange={(event) => setForm((current) => ({ ...current, effectiveFrom: event.target.value }))} /></Field>
          <Field label="生效结束"><input aria-label="创建生效结束" type="datetime-local" className={fieldShell} value={form.effectiveTo} onChange={(event) => setForm((current) => ({ ...current, effectiveTo: event.target.value }))} /></Field>
          <button type="submit" disabled={isMutating} className={cn(buttonShell, 'self-end bg-blue-600 text-white hover:bg-blue-700')}>
            {isMutating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            创建规则
          </button>
        </form>
      </section>

      <section className={sectionShell} aria-label="AI 积分计量规则列表">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">规则列表</h2>
            <p className="mt-1 text-sm text-slate-500">共 {records.length} 条规则，字段均为低敏计量参数。</p>
          </div>
          <button type="button" onClick={() => void loadRules(filters)} className={cn(buttonShell, 'border border-[#dbe6f3] bg-white text-slate-700 hover:bg-slate-50')}>
            <RefreshCw className="h-4 w-4" />
            刷新列表
          </button>
        </div>

        {loadState === 'loading' ? (
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            正在加载 AI 积分计量规则...
          </div>
        ) : null}

        {loadState === 'error' ? (
          <div className="mt-5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">规则列表暂不可用。</div>
        ) : null}

        {loadState === 'ready' && records.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-[#dbe6f3] bg-[#f8fafc] px-4 py-8 text-center text-sm text-slate-500">
            暂无 AI 积分计量规则，请创建第一条规则。
          </div>
        ) : null}

        {loadState === 'ready' && records.length > 0 ? (
          <div className="mt-5 overflow-x-auto rounded-xl border border-[#e6edf5]">
            <table className="min-w-[1200px] w-full divide-y divide-[#e6edf5] text-left text-sm">
              <thead className="bg-[#f8fafc] text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">模型厂商 / 模型名称</th>
                  <th className="px-3 py-3">计量版本</th>
                  <th className="px-3 py-3">启用状态</th>
                  <th className="px-3 py-3">输入 / 输出权重</th>
                  <th className="px-3 py-3">模型倍率</th>
                  <th className="px-3 py-3">知识库附加 / 单位积分</th>
                  <th className="px-3 py-3">生效开始</th>
                  <th className="px-3 py-3">生效结束</th>
                  <th className="px-3 py-3">更新时间</th>
                  <th className="px-3 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f7] bg-white">
                {records.map((record) => {
                  const draft = dateDrafts[record.id] ?? { effectiveFrom: toDatetimeLocalValue(record.effectiveFrom), effectiveTo: toDatetimeLocalValue(record.effectiveTo) };
                  return (
                    <tr key={record.id}>
                      <td className="px-3 py-3 align-top">
                        <div className="font-semibold text-slate-950">{record.provider}</div>
                        <div className="mt-1 text-xs text-slate-500">{record.model}</div>
                      </td>
                      <td className="px-3 py-3 align-top font-mono text-xs text-slate-700">{record.meteringVersion}</td>
                      <td className="px-3 py-3 align-top"><RuleStatusPill enabled={record.enabled} /></td>
                      <td className="px-3 py-3 align-top text-slate-700">{record.inputTokenWeight} / {record.outputTokenWeight}</td>
                      <td className="px-3 py-3 align-top text-slate-700">{record.modelMultiplier}</td>
                      <td className="px-3 py-3 align-top text-slate-700">{record.ragCreditSurcharge} / {record.creditsPerStandardTokenUnit}</td>
                      <td className="px-3 py-3 align-top">
                        <input
                          aria-label={`生效开始 ${record.meteringVersion}`}
                          type="datetime-local"
                          className="h-9 rounded-lg border border-[#dbe6f3] px-2 text-xs text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          value={draft.effectiveFrom}
                          onChange={(event) => setDateDrafts((current) => ({ ...current, [record.id]: { ...draft, effectiveFrom: event.target.value } }))}
                        />
                        <div className="mt-1 text-[11px] text-slate-500">{formatDateTime(record.effectiveFrom)}</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          aria-label={`生效结束 ${record.meteringVersion}`}
                          type="datetime-local"
                          className="h-9 rounded-lg border border-[#dbe6f3] px-2 text-xs text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          value={draft.effectiveTo}
                          onChange={(event) => setDateDrafts((current) => ({ ...current, [record.id]: { ...draft, effectiveTo: event.target.value } }))}
                        />
                        <div className="mt-1 text-[11px] text-slate-500">{formatDateTime(record.effectiveTo)}</div>
                      </td>
                      <td className="px-3 py-3 align-top text-xs text-slate-500">{formatDateTime(record.updatedAt)}</td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-col gap-2">
                          <button type="button" disabled={isMutating} onClick={() => void patchRule(record.id, { enabled: !record.enabled }, record.enabled ? '计量规则已停用' : '计量规则已启用')} className="rounded-lg border border-[#dbe6f3] px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                            {record.enabled ? '停用' : '启用'}
                          </button>
                          <button type="button" disabled={isMutating} onClick={() => void handleSaveDates(record)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                            保存生效期
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
      </section>
    </>
  );
}
