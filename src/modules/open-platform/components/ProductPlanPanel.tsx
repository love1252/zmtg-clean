'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  History,
  LoaderCircle,
  RefreshCw,
  Save,
  Send,
  Table2,
  Zap,
} from 'lucide-react';

import {
  createOpenPlatformPlanVersionDraft,
  loadOpenPlatformPlanCatalog,
  publishOpenPlatformPlanVersion,
  saveOpenPlatformPlanVersionDraft,
} from '@/modules/open-platform/client/platform-plan-catalog-client';
import { PlatformSectionBanner } from '@/modules/open-platform/components/PlatformSectionBanner';
import type {
  PlanCatalogDto,
  PlanCatalogVersionDto,
  PlanVersionDraftPayload,
} from '@/modules/open-platform/domain/plan-catalog';
import { cn } from '@/shared/utils/cn';

type PlanCatalogPlan = PlanCatalogDto['plans'][number];
type PlanCatalogTab = 'catalog' | 'comparison' | 'history' | 'commercial';

type DraftForm = {
  versionId: string;
  versionCode: string;
  displayName: string;
  displayPrice: string;
  priceNote: string;
  agentLimit: string;
  seatLimit: string;
  monthlyAiCallLimit: string;
  knowledgeStorageGb: string;
  connectorText: string;
  serviceText: string;
  featureText: string;
  changeSummary: string;
};

const sectionShell = 'rounded-xl border border-[#e6edf5] bg-white p-5 shadow-sm lg:p-6';
const fieldShell =
  'mt-1 h-10 w-full rounded-lg border border-[#dbe6f3] bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
const tabItems: Array<{ id: PlanCatalogTab; label: string }> = [
  { id: 'catalog', label: '套餐目录' },
  { id: 'comparison', label: '权益对照' },
  { id: 'history', label: '版本记录' },
  { id: 'commercial', label: '商业化预留' },
];

function formatNumber(value: number | null) {
  return typeof value === 'number' ? new Intl.NumberFormat('zh-CN').format(value) : '不限';
}

function readStringList(json: unknown, key: string) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return [];
  const value = (json as Record<string, unknown>)[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function listText(items: string[]) {
  return items.length > 0 ? items.join(' / ') : '未配置';
}

function numberText(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function splitText(value: string) {
  return value
    .split(/[、,，/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getLatestVersion(plan: PlanCatalogPlan, status: PlanCatalogVersionDto['status']) {
  return [...plan.versions]
    .filter((version) => version.status === status)
    .sort((left, right) => {
      const leftTime = new Date(left.publishedAt ?? left.updatedAt).getTime();
      const rightTime = new Date(right.publishedAt ?? right.updatedAt).getTime();
      return rightTime - leftTime;
    })[0] ?? null;
}

function versionToDraftForm(version: PlanCatalogVersionDto): DraftForm {
  return {
    versionId: version.versionId,
    versionCode: version.versionCode,
    displayName: version.displayName,
    displayPrice: version.displayPrice,
    priceNote: version.priceNote,
    agentLimit: version.agentLimit?.toString() ?? '',
    seatLimit: version.seatLimit?.toString() ?? '',
    monthlyAiCallLimit: version.monthlyAiCallLimit?.toString() ?? '',
    knowledgeStorageGb: version.knowledgeStorageGb?.toString() ?? '',
    connectorText: readStringList(version.connectorEntitlementsJson, 'connectors').join('、'),
    serviceText: readStringList(version.serviceEntitlementsJson, 'services').join('、'),
    featureText: readStringList(version.featureEntitlementsJson, 'modules').join('、'),
    changeSummary: version.changeSummary,
  };
}

function draftFormToPayload(form: DraftForm): PlanVersionDraftPayload {
  return {
    versionCode: form.versionCode.trim(),
    displayName: form.displayName.trim(),
    displayPrice: form.displayPrice.trim(),
    priceNote: form.priceNote.trim(),
    agentLimit: numberText(form.agentLimit),
    seatLimit: numberText(form.seatLimit),
    monthlyAiCallLimit: numberText(form.monthlyAiCallLimit),
    knowledgeStorageGb: numberText(form.knowledgeStorageGb),
    connectorEntitlementsJson: { connectors: splitText(form.connectorText) },
    serviceEntitlementsJson: { services: splitText(form.serviceText) },
    featureEntitlementsJson: { modules: splitText(form.featureText) },
    quotaEntitlementsJson: {
      aiCallsPerMonth: numberText(form.monthlyAiCallLimit),
      knowledgeStorageGb: numberText(form.knowledgeStorageGb),
    },
    changeSummary: form.changeSummary.trim(),
  };
}

function upsertVersion(catalog: PlanCatalogDto, nextVersion: PlanCatalogVersionDto): PlanCatalogDto {
  const plans = catalog.plans.map((plan) => {
    if (plan.planId !== nextVersion.planId) return plan;
    const versions = plan.versions.some((version) => version.versionId === nextVersion.versionId)
      ? plan.versions.map((version) =>
          version.versionId === nextVersion.versionId ? nextVersion : version,
        )
      : [nextVersion, ...plan.versions];

    return {
      ...plan,
      draftVersionId:
        nextVersion.status === 'draft'
          ? nextVersion.versionId
          : versions.find((version) => version.status === 'draft')?.versionId ?? null,
      publishedVersionId:
        nextVersion.status === 'published'
          ? nextVersion.versionId
          : plan.publishedVersionId,
      versions,
    };
  });
  const allVersions = plans.flatMap((plan) => plan.versions);

  return {
    summary: {
      planCount: plans.length,
      draftVersionCount: allVersions.filter((version) => version.status === 'draft').length,
      publishedVersionCount: allVersions.filter((version) => version.status === 'published').length,
      retiredVersionCount: allVersions.filter((version) => version.status === 'retired').length,
    },
    plans,
  };
}

function StatusPill({ status }: { status: PlanCatalogVersionDto['status'] }) {
  const tone = {
    draft: 'border-blue-200 bg-blue-50 text-blue-700',
    published: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    retired: 'border-slate-200 bg-slate-100 text-slate-500',
  }[status];

  return (
    <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', tone)}>
      {status}
    </span>
  );
}

function VersionMetrics({ version }: { version: PlanCatalogVersionDto }) {
  const connectors = readStringList(version.connectorEntitlementsJson, 'connectors');
  const services = readStringList(version.serviceEntitlementsJson, 'services');

  return (
    <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
      <Metric label="Agent 数量" value={`${formatNumber(version.agentLimit)} 个`} />
      <Metric label="员工席位" value={`${formatNumber(version.seatLimit)} 席`} />
      <Metric label="AI 调用 / 月" value={`${formatNumber(version.monthlyAiCallLimit)} 次`} />
      <Metric label="知识库存储" value={`${formatNumber(version.knowledgeStorageGb)} GB`} />
      <Metric label="连接器" value={listText(connectors)} />
      <Metric label="服务权益" value={listText(services)} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-[#e6edf5] bg-[#f8fafc] px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#e6edf5] bg-white px-4 py-3 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#dbe6f3] bg-white px-4 py-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

export function ProductPlanPanel() {
  const [catalog, setCatalog] = useState<PlanCatalogDto | null>(null);
  const [activeTab, setActiveTab] = useState<PlanCatalogTab>('catalog');
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draftForm, setDraftForm] = useState<DraftForm | null>(null);

  useEffect(() => {
    let isActive = true;

    loadOpenPlatformPlanCatalog()
      .then((result) => {
        if (!isActive) return;
        if (result.ok) {
          setCatalog(result.catalog);
          setErrorMessage(null);
          return;
        }
        setErrorMessage(`套餐目录加载失败：${result.error.message}`);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const selectedDraftVersion = useMemo(() => {
    if (!catalog || !draftForm) return null;
    return catalog.plans
      .flatMap((plan) => plan.versions)
      .find((version) => version.versionId === draftForm.versionId) ?? null;
  }, [catalog, draftForm]);

  function updateDraft(field: keyof DraftForm, value: string) {
    setDraftForm((current) => (current ? { ...current, [field]: value } : current));
  }

  async function handleCreateDraft(plan: PlanCatalogPlan) {
    const source = getLatestVersion(plan, 'published') ?? plan.versions[0];
    setIsMutating(true);
    setMessage(null);
    const result = await createOpenPlatformPlanVersionDraft(plan.planId, {
      sourceVersionId: source?.versionId,
    });
    setIsMutating(false);
    if (!result.ok) {
      setErrorMessage(`草稿创建失败：${result.error.message}`);
      return;
    }
    setCatalog((current) => (current ? upsertVersion(current, result.version) : current));
    setDraftForm(versionToDraftForm(result.version));
    setMessage('草稿已创建');
    setActiveTab('catalog');
  }

  async function handleSaveDraft() {
    if (!draftForm) return;
    setIsMutating(true);
    setMessage(null);
    const result = await saveOpenPlatformPlanVersionDraft(
      draftForm.versionId,
      draftFormToPayload(draftForm),
    );
    setIsMutating(false);
    if (!result.ok) {
      setErrorMessage(`草稿保存失败：${result.error.message}`);
      return;
    }
    setCatalog((current) => (current ? upsertVersion(current, result.version) : current));
    setDraftForm(versionToDraftForm(result.version));
    setErrorMessage(null);
    setMessage('草稿已保存');
  }

  async function handlePublishDraft() {
    if (!draftForm) return;
    setIsMutating(true);
    setMessage(null);
    const result = await publishOpenPlatformPlanVersion(draftForm.versionId);
    setIsMutating(false);
    if (!result.ok) {
      setErrorMessage(`草稿发布失败：${result.error.message}`);
      return;
    }
    setCatalog((current) => (current ? upsertVersion(current, result.version) : current));
    setErrorMessage(null);
    setMessage('草稿已发布');
  }

  const plans = catalog?.plans ?? [];

  return (
    <section className="space-y-5" aria-labelledby="product-plan-heading">
      <PlatformSectionBanner
        headingId="product-plan-heading"
        title="产品与套餐"
        description="维护平台套餐目录、版本草稿、展示价格和权益对照；价格仅为展示口径，后续商业化记录仍保持人工预留边界。"
      />

      <div className="flex flex-col gap-3 rounded-xl border border-[#e6edf5] bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
            <Zap className="h-4 w-4" />
            套餐目录配置台
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            draft 可编辑，published 只作为当前发布版本展示，停用版本保留历史解释。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabItems.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm font-semibold transition',
                activeTab === tab.id
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-[#dbe6f3] bg-white text-slate-600 hover:border-blue-200',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {message ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <AlertCircle className="h-4 w-4" />
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className={cn(sectionShell, 'flex items-center gap-3 text-sm text-slate-500')}>
          <LoaderCircle className="h-4 w-4 animate-spin text-blue-600" />
          正在加载套餐目录...
        </div>
      ) : null}

      {catalog ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="套餐模板" value={catalog.summary.planCount} />
          <SummaryCard label="已发布版本" value={catalog.summary.publishedVersionCount} />
          <SummaryCard label="草稿版本" value={catalog.summary.draftVersionCount} />
          <SummaryCard label="停用版本" value={catalog.summary.retiredVersionCount} />
        </div>
      ) : null}

      {!isLoading && catalog && activeTab === 'catalog' ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-4 xl:grid-cols-2">
            {plans.map((plan) => {
              const publishedVersion = getLatestVersion(plan, 'published');
              const draftVersion = getLatestVersion(plan, 'draft');

              return (
                <article key={plan.planId} className={sectionShell}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-slate-950">{plan.planName}</div>
                      <div className="mt-1 text-sm text-slate-500">套餐编号：{plan.planCode}</div>
                    </div>
                    <StatusPill status={publishedVersion?.status ?? 'retired'} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-500">{plan.planDescription}</p>

                  {publishedVersion ? (
                    <div className="mt-4 rounded-xl border border-[#e6edf5] bg-[#f8fafc] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-slate-500">当前 published 版本</div>
                          <div className="mt-1 text-sm font-semibold text-slate-950">
                            {publishedVersion.versionCode}
                          </div>
                        </div>
                        <div className="text-right text-lg font-semibold text-slate-950">
                          {publishedVersion.displayPrice}
                        </div>
                      </div>
                      <VersionMetrics version={publishedVersion} />
                    </div>
                  ) : (
                    <EmptyState text="暂无已发布版本" />
                  )}

                  {draftVersion ? (
                    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-blue-700">可编辑 draft 版本</div>
                          <div className="mt-1 text-sm font-semibold text-slate-950">
                            {draftVersion.versionCode}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDraftForm(versionToDraftForm(draftVersion))}
                          className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700"
                        >
                          <Save className="h-4 w-4" />
                          编辑 {plan.planName} 草稿
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => void handleCreateDraft(plan)}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#dbe6f3] bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-blue-200 disabled:opacity-60"
                    >
                      <Copy className="h-4 w-4" />
                      复制 {plan.planName} 为草稿
                    </button>
                  )}
                </article>
              );
            })}
          </div>

          <aside aria-label="套餐草稿编辑器" role="region" className={sectionShell}>
            {draftForm && selectedDraftVersion ? (
              <div className="space-y-4">
                <div>
                  <div className="text-lg font-semibold text-slate-950">草稿编辑</div>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    published 版本不能原地编辑；保存后仍为 draft，发布后才进入可选版本池。
                  </p>
                </div>

                <label className="block text-sm font-semibold text-slate-700">
                  版本编码
                  <input
                    className={fieldShell}
                    value={draftForm.versionCode}
                    onChange={(event) => updateDraft('versionCode', event.target.value)}
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  展示名称
                  <input
                    className={fieldShell}
                    value={draftForm.displayName}
                    onChange={(event) => updateDraft('displayName', event.target.value)}
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  展示价格
                  <input
                    className={fieldShell}
                    value={draftForm.displayPrice}
                    onChange={(event) => updateDraft('displayPrice', event.target.value)}
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Agent 数量
                  <input
                    className={fieldShell}
                    inputMode="numeric"
                    value={draftForm.agentLimit}
                    onChange={(event) => updateDraft('agentLimit', event.target.value)}
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  员工席位
                  <input
                    className={fieldShell}
                    inputMode="numeric"
                    value={draftForm.seatLimit}
                    onChange={(event) => updateDraft('seatLimit', event.target.value)}
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  AI 调用 / 月
                  <input
                    className={fieldShell}
                    inputMode="numeric"
                    value={draftForm.monthlyAiCallLimit}
                    onChange={(event) => updateDraft('monthlyAiCallLimit', event.target.value)}
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  知识库存储 GB
                  <input
                    className={fieldShell}
                    inputMode="numeric"
                    value={draftForm.knowledgeStorageGb}
                    onChange={(event) => updateDraft('knowledgeStorageGb', event.target.value)}
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  连接器
                  <input
                    className={fieldShell}
                    value={draftForm.connectorText}
                    onChange={(event) => updateDraft('connectorText', event.target.value)}
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  服务权益
                  <input
                    className={fieldShell}
                    value={draftForm.serviceText}
                    onChange={(event) => updateDraft('serviceText', event.target.value)}
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  变更说明
                  <textarea
                    className="mt-1 min-h-20 w-full rounded-lg border border-[#dbe6f3] bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    value={draftForm.changeSummary}
                    onChange={(event) => updateDraft('changeSummary', event.target.value)}
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => void handleSaveDraft()}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    保存草稿
                  </button>
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => void handlePublishDraft()}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    发布草稿
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <RefreshCw className="mx-auto h-8 w-8 text-slate-300" />
                <div className="mt-3 text-sm font-semibold text-slate-700">选择一个 draft 版本开始编辑</div>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  没有草稿时，可以先从当前发布版本复制为草稿。
                </p>
              </div>
            )}
          </aside>
        </div>
      ) : null}

      {!isLoading && catalog && activeTab === 'comparison' ? (
        <section className={sectionShell}>
          <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-950">
            <Table2 className="h-5 w-5 text-blue-600" />
            权益对照预览
          </div>
          <div className="overflow-x-auto">
            <table aria-label="套餐权益对照预览" className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-slate-500">
                <tr className="border-b border-[#e6edf5]">
                  <th className="px-3 py-3 font-semibold">套餐</th>
                  <th className="px-3 py-3 font-semibold">展示价格</th>
                  <th className="px-3 py-3 font-semibold">Agent 数量</th>
                  <th className="px-3 py-3 font-semibold">员工席位</th>
                  <th className="px-3 py-3 font-semibold">AI 调用 / 月</th>
                  <th className="px-3 py-3 font-semibold">知识库存储</th>
                  <th className="px-3 py-3 font-semibold">连接器</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => {
                  const version = getLatestVersion(plan, 'published') ?? getLatestVersion(plan, 'draft');
                  if (!version) return null;
                  return (
                    <tr key={plan.planId} className="border-b border-[#eef3f8] text-slate-700">
                      <td className="px-3 py-3 font-semibold text-slate-950">{plan.planName}</td>
                      <td className="px-3 py-3">{version.displayPrice}</td>
                      <td className="px-3 py-3">{formatNumber(version.agentLimit)}</td>
                      <td className="px-3 py-3">{formatNumber(version.seatLimit)}</td>
                      <td className="px-3 py-3">{formatNumber(version.monthlyAiCallLimit)}</td>
                      <td className="px-3 py-3">{formatNumber(version.knowledgeStorageGb)} GB</td>
                      <td className="px-3 py-3">
                        {listText(readStringList(version.connectorEntitlementsJson, 'connectors'))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!isLoading && catalog && activeTab === 'history' ? (
        <section className={sectionShell}>
          <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-950">
            <History className="h-5 w-5 text-blue-600" />
            套餐版本记录
          </div>
          <div className="space-y-3">
            {plans.flatMap((plan) =>
              plan.versions.map((version) => (
                <div
                  key={version.versionId}
                  className="flex flex-col gap-2 rounded-lg border border-[#e6edf5] bg-[#f8fafc] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-semibold text-slate-950">
                      {plan.planName} · {version.versionCode}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{version.changeSummary || '无变更说明'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={version.status} />
                    <span className="text-sm text-slate-500">{version.updatedAt.slice(0, 10)}</span>
                  </div>
                </div>
              )),
            )}
          </div>
        </section>
      ) : null}

      {!isLoading && activeTab === 'commercial' ? (
        <section className={sectionShell}>
          <div className="text-lg font-semibold text-slate-950">商业化预留状态</div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            仅作为人工记录状态预留，不提供线上交易处理或第三方商业化系统对接。
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {['订单', '合同', '发票', '支付'].map((label) => (
              <div key={label} className="rounded-lg border border-[#e6edf5] bg-[#f8fafc] px-4 py-3">
                <div className="font-semibold text-slate-950">{label}</div>
                <div className="mt-1 text-sm text-slate-500">人工记录 / 待确认 / 已归档 / 取消</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
