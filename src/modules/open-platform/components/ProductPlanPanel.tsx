'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  History,
  LoaderCircle,
  Save,
  Send,
  Table2,
  X,
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
  knowledgeItemsLimit: string;
  knowledgeFilesLimit: string;
  knowledgeTotalStorageMb: string;
  knowledgeSingleFileSizeMb: string;
  knowledgeParseJobsMonthly: string;
  knowledgeEmbeddingJobsMonthly: string;
  knowledgeOcrJobsMonthly: string;
  knowledgeRagAnswersMonthly: string;
  knowledgeIndexRebuildJobsMonthly: string;
  knowledgeOcrEnabled: boolean;
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
const customerFeatureOptions = ['客户运营', '客户档案', '客户基础资料导入', 'AI 用户画像', '客户分层'];
const moduleFeatureOptions = ['知识库', '智能随访', 'AI 智能助手', 'AI 客服辅助', '内容素材库', '数据统计', '审计日志'];
const connectorOptions = ['企微', '个人微信', 'HIS', 'CRM', '电商/订单', '短信/外呼'];
const serviceOptions = ['新手引导', '图文/视频教程', '实施支持', '季度复盘', '线上培训', '模板支持', '上线检查'];
const planSortRank: Record<string, number> = {
  trial: 0,
  'trial-care': 0,
  试用版: 0,
  starter: 1,
  'starter-care': 1,
  基础版: 1,
  growth: 2,
  'growth-care': 2,
  professional: 2,
  专业版: 2,
};

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

function readQuotaString(json: unknown, key: string) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return '';
  const value = (json as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function readQuotaBoolean(json: unknown, key: string) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return false;
  return (json as Record<string, unknown>)[key] === true;
}

function listText(items: string[]) {
  return items.length > 0 ? items.join(' / ') : '未配置';
}

function formatStorageMb(value: number | null) {
  return typeof value === 'number' ? `${formatNumber(value * 1024)} MB` : '不限';
}

function readQuotaNumber(json: unknown, key: string) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const value = (json as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatQuotaEntitlement(version: PlanCatalogVersionDto, key: string, suffix = '') {
  const value = readQuotaNumber(version.quotaEntitlementsJson, key);
  return typeof value === 'number' ? `${formatNumber(value)}${suffix}` : '未配置';
}

function formatQuotaEnabled(version: PlanCatalogVersionDto, key: string) {
  return readQuotaBoolean(version.quotaEntitlementsJson, key) ? '启用' : '未启用';
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

function joinText(items: string[]) {
  return Array.from(new Set(items)).join('、');
}

function toggleTextItem(value: string, item: string) {
  const items = splitText(value);
  return items.includes(item)
    ? joinText(items.filter((current) => current !== item))
    : joinText([...items, item]);
}

function getPlanSortRank(plan: PlanCatalogPlan) {
  return planSortRank[plan.planCode] ?? planSortRank[plan.planName] ?? 99;
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
    knowledgeItemsLimit: readQuotaString(version.quotaEntitlementsJson, 'knowledgeItemsLimit'),
    knowledgeFilesLimit: readQuotaString(version.quotaEntitlementsJson, 'knowledgeFilesLimit'),
    knowledgeTotalStorageMb: readQuotaString(version.quotaEntitlementsJson, 'knowledgeTotalStorageMb'),
    knowledgeSingleFileSizeMb: readQuotaString(version.quotaEntitlementsJson, 'knowledgeSingleFileSizeMb'),
    knowledgeParseJobsMonthly: readQuotaString(version.quotaEntitlementsJson, 'knowledgeParseJobsMonthly'),
    knowledgeEmbeddingJobsMonthly: readQuotaString(version.quotaEntitlementsJson, 'knowledgeEmbeddingJobsMonthly'),
    knowledgeOcrJobsMonthly: readQuotaString(version.quotaEntitlementsJson, 'knowledgeOcrJobsMonthly'),
    knowledgeRagAnswersMonthly: readQuotaString(version.quotaEntitlementsJson, 'knowledgeRagAnswersMonthly'),
    knowledgeIndexRebuildJobsMonthly: readQuotaString(version.quotaEntitlementsJson, 'knowledgeIndexRebuildJobsMonthly'),
    knowledgeOcrEnabled: readQuotaBoolean(version.quotaEntitlementsJson, 'knowledgeOcrEnabled'),
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
      knowledgeItemsLimit: numberText(form.knowledgeItemsLimit),
      knowledgeFilesLimit: numberText(form.knowledgeFilesLimit),
      knowledgeTotalStorageMb: numberText(form.knowledgeTotalStorageMb),
      knowledgeSingleFileSizeMb: numberText(form.knowledgeSingleFileSizeMb),
      knowledgeParseJobsMonthly: numberText(form.knowledgeParseJobsMonthly),
      knowledgeEmbeddingJobsMonthly: numberText(form.knowledgeEmbeddingJobsMonthly),
      knowledgeOcrJobsMonthly: numberText(form.knowledgeOcrJobsMonthly),
      knowledgeRagAnswersMonthly: numberText(form.knowledgeRagAnswersMonthly),
      knowledgeIndexRebuildJobsMonthly: numberText(form.knowledgeIndexRebuildJobsMonthly),
      knowledgeOcrEnabled: form.knowledgeOcrEnabled,
    },
    changeSummary: form.changeSummary.trim(),
  };
}

function upsertVersion(catalog: PlanCatalogDto, nextVersion: PlanCatalogVersionDto): PlanCatalogDto {
  const plans = catalog.plans.map((plan) => {
    if (plan.planId !== nextVersion.planId) return plan;
    const versions = (
      plan.versions.some((version) => version.versionId === nextVersion.versionId)
        ? plan.versions.map((version) =>
            version.versionId === nextVersion.versionId ? nextVersion : version,
          )
        : [nextVersion, ...plan.versions]
    ).map((version) => {
      if (
        nextVersion.status !== 'published' ||
        version.versionId === nextVersion.versionId ||
        version.status !== 'published'
      ) {
        return version;
      }

      return {
        ...version,
        status: 'retired' as const,
        retiredAt: nextVersion.publishedAt ?? nextVersion.updatedAt,
        updatedAt: nextVersion.updatedAt,
      };
    });

    return {
      ...plan,
      draftVersionId: versions.find((version) => version.status === 'draft')?.versionId ?? null,
      publishedVersionId: versions.find((version) => version.status === 'published')?.versionId ?? null,
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
  const label = {
    draft: '草稿',
    published: '已发布',
    retired: '已停用',
  }[status];

  return (
    <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', tone)}>
      {label}
    </span>
  );
}

function CompactInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-[#e6edf5] bg-[#f8fafc] px-2 py-1.5">
      <div className="truncate text-[11px] font-semibold leading-4 text-slate-500">{label}</div>
      <div className="truncate text-xs font-semibold leading-5 text-slate-950">{value}</div>
    </div>
  );
}

function EditorGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="rounded-lg border border-[#e6edf5] bg-[#f8fafc] p-3">
      <legend className="px-1 text-sm font-semibold text-slate-950">{title}</legend>
      {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

function CheckboxList({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const selected = splitText(value);

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {options.map((option) => (
        <label
          key={option}
          className="flex min-h-9 items-center gap-2 rounded-lg border border-[#dbe6f3] bg-white px-3 py-2 text-sm font-semibold text-slate-700"
        >
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={() => onChange(toggleTextItem(value, option))}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
          />
          {option}
        </label>
      ))}
    </div>
  );
}

function DraftEditor({
  planName,
  draftForm,
  isMutating,
  onUpdateDraft,
  onCancelDraft,
  onPublishDraft,
}: {
  planName: string;
  draftForm: DraftForm;
  isMutating: boolean;
  onUpdateDraft: <K extends keyof DraftForm>(field: K, value: DraftForm[K]) => void;
  onCancelDraft: () => void;
  onPublishDraft: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6">
      <section
        aria-label={`编辑${planName}草稿`}
        aria-modal="true"
        role="dialog"
        className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-blue-100 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#e6edf5] px-5 py-4">
          <div>
            <div className="text-base font-semibold text-slate-950">编辑{planName}草稿</div>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              已发布版本不能原地编辑；保存后仍为草稿，发布后才进入可选版本池。
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭编辑弹窗"
            disabled={isMutating}
            onClick={onCancelDraft}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#dbe6f3] bg-white text-slate-500 hover:border-blue-200 hover:text-slate-800 disabled:opacity-60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <div className="grid gap-3 xl:grid-cols-2">
          <EditorGroup title="基础信息" description="只表达展示口径，不代表真实计费或合同价格。">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                版本编码
                <input
                  className={fieldShell}
                  value={draftForm.versionCode}
                  onChange={(event) => onUpdateDraft('versionCode', event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                展示名称
                <input
                  className={fieldShell}
                  value={draftForm.displayName}
                  onChange={(event) => onUpdateDraft('displayName', event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                展示价格
                <input
                  className={fieldShell}
                  value={draftForm.displayPrice}
                  onChange={(event) => onUpdateDraft('displayPrice', event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                价格备注
                <input
                  className={fieldShell}
                  value={draftForm.priceNote}
                  onChange={(event) => onUpdateDraft('priceNote', event.target.value)}
                />
              </label>
            </div>
          </EditorGroup>

          <EditorGroup title="容量配额" description="机构端只看到业务额度，不展示 Token、模型厂商或平台成本。">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                员工席位
                <input
                  className={fieldShell}
                  inputMode="numeric"
                  value={draftForm.seatLimit}
                  onChange={(event) => onUpdateDraft('seatLimit', event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Agent 数量
                <input
                  className={fieldShell}
                  inputMode="numeric"
                  value={draftForm.agentLimit}
                  onChange={(event) => onUpdateDraft('agentLimit', event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                AI 调用 / 月
                <input
                  className={fieldShell}
                  inputMode="numeric"
                  value={draftForm.monthlyAiCallLimit}
                  onChange={(event) => onUpdateDraft('monthlyAiCallLimit', event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                文件存储 GB
                <input
                  className={fieldShell}
                  inputMode="numeric"
                  value={draftForm.knowledgeStorageGb}
                  onChange={(event) => onUpdateDraft('knowledgeStorageGb', event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                知识条目数
                <input
                  className={fieldShell}
                  inputMode="numeric"
                  value={draftForm.knowledgeItemsLimit}
                  onChange={(event) => onUpdateDraft('knowledgeItemsLimit', event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                知识文件数
                <input
                  className={fieldShell}
                  inputMode="numeric"
                  value={draftForm.knowledgeFilesLimit}
                  onChange={(event) => onUpdateDraft('knowledgeFilesLimit', event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                总容量 MB
                <input
                  className={fieldShell}
                  inputMode="numeric"
                  value={draftForm.knowledgeTotalStorageMb}
                  onChange={(event) => onUpdateDraft('knowledgeTotalStorageMb', event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                单文件 MB
                <input
                  className={fieldShell}
                  inputMode="numeric"
                  value={draftForm.knowledgeSingleFileSizeMb}
                  onChange={(event) => onUpdateDraft('knowledgeSingleFileSizeMb', event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                解析任务 / 月
                <input
                  className={fieldShell}
                  inputMode="numeric"
                  value={draftForm.knowledgeParseJobsMonthly}
                  onChange={(event) => onUpdateDraft('knowledgeParseJobsMonthly', event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                向量任务 / 月
                <input
                  className={fieldShell}
                  inputMode="numeric"
                  value={draftForm.knowledgeEmbeddingJobsMonthly}
                  onChange={(event) => onUpdateDraft('knowledgeEmbeddingJobsMonthly', event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                OCR 任务 / 月
                <input
                  className={fieldShell}
                  inputMode="numeric"
                  value={draftForm.knowledgeOcrJobsMonthly}
                  onChange={(event) => onUpdateDraft('knowledgeOcrJobsMonthly', event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                知识库问答 / 月
                <input
                  className={fieldShell}
                  inputMode="numeric"
                  value={draftForm.knowledgeRagAnswersMonthly}
                  onChange={(event) => onUpdateDraft('knowledgeRagAnswersMonthly', event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                索引重建 / 月
                <input
                  className={fieldShell}
                  inputMode="numeric"
                  value={draftForm.knowledgeIndexRebuildJobsMonthly}
                  onChange={(event) => onUpdateDraft('knowledgeIndexRebuildJobsMonthly', event.target.value)}
                />
              </label>
              <label className="flex min-h-10 items-center gap-2 rounded-lg border border-[#dbe6f3] bg-white px-3 py-2 text-sm font-semibold text-slate-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={draftForm.knowledgeOcrEnabled}
                  onChange={(event) => onUpdateDraft('knowledgeOcrEnabled', event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                />
                启用知识库 OCR 能力
              </label>
            </div>
          </EditorGroup>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <EditorGroup title="客户与画像">
            <CheckboxList
              options={customerFeatureOptions}
              value={draftForm.featureText}
              onChange={(nextValue) => onUpdateDraft('featureText', nextValue)}
            />
          </EditorGroup>

          <EditorGroup title="功能模块">
            <CheckboxList
              options={moduleFeatureOptions}
              value={draftForm.featureText}
              onChange={(nextValue) => onUpdateDraft('featureText', nextValue)}
            />
          </EditorGroup>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <EditorGroup title="连接器" description="连接器按系统能力勾选，个人微信默认需要合规评估。">
            <CheckboxList
              options={connectorOptions}
              value={draftForm.connectorText}
              onChange={(nextValue) => onUpdateDraft('connectorText', nextValue)}
            />
          </EditorGroup>

          <EditorGroup title="上线支持">
            <CheckboxList
              options={serviceOptions}
              value={draftForm.serviceText}
              onChange={(nextValue) => onUpdateDraft('serviceText', nextValue)}
            />
          </EditorGroup>
        </div>

        <label className="block text-sm font-semibold text-slate-700">
          变更说明
          <textarea
            className="mt-1 min-h-16 w-full rounded-lg border border-[#dbe6f3] bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            value={draftForm.changeSummary}
            onChange={(event) => onUpdateDraft('changeSummary', event.target.value)}
          />
        </label>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[#e6edf5] bg-[#f8fafc] px-5 py-4">
          <button
            type="button"
            disabled={isMutating}
            onClick={onCancelDraft}
            className="inline-flex items-center gap-2 rounded-lg border border-[#dbe6f3] bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            取消
          </button>
          <button
            type="button"
            disabled={isMutating}
            onClick={onPublishDraft}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            发布
          </button>
        </div>
      </section>
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
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

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

  const plans = useMemo(
    () => [...(catalog?.plans ?? [])].sort((left, right) => {
      const rankDiff = getPlanSortRank(left) - getPlanSortRank(right);
      return rankDiff || left.planName.localeCompare(right.planName, 'zh-CN');
    }),
    [catalog],
  );
  const selectedDraftPlan = useMemo(() => {
    if (!catalog || !selectedDraftVersion) return null;
    return catalog.plans.find((plan) => plan.planId === selectedDraftVersion.planId) ?? null;
  }, [catalog, selectedDraftVersion]);

  function updateDraft<K extends keyof DraftForm>(field: K, value: DraftForm[K]) {
    setDraftForm((current) => (current ? { ...current, [field]: value } : current));
  }

  async function handleCreateDraft(plan: PlanCatalogPlan) {
    const source = getLatestVersion(plan, 'published') ?? plan.versions[0];
    setSelectedPlanId(plan.planId);
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

  function handleCancelDraft() {
    setDraftForm(null);
  }

  async function handlePublishDraft() {
    if (!draftForm) return;
    setIsMutating(true);
    setMessage(null);
    const saveResult = await saveOpenPlatformPlanVersionDraft(
      draftForm.versionId,
      draftFormToPayload(draftForm),
    );
    if (!saveResult.ok) {
      setIsMutating(false);
      setErrorMessage(`草稿保存失败：${saveResult.error.message}`);
      return;
    }
    setCatalog((current) => (current ? upsertVersion(current, saveResult.version) : current));

    const result = await publishOpenPlatformPlanVersion(saveResult.version.versionId);
    setIsMutating(false);
    if (!result.ok) {
      setErrorMessage(`草稿发布失败：${result.error.message}`);
      return;
    }
    setCatalog((current) => (current ? upsertVersion(current, result.version) : current));
    setDraftForm(null);
    setErrorMessage(null);
    setMessage('草稿已发布');
  }

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
            草稿可编辑，已发布版本只作为当前发布版本展示，停用版本保留历史解释。
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

      {!isLoading && catalog && activeTab === 'catalog' ? (
        <div className="grid gap-4">
          <section aria-label="紧凑套餐目录" role="region" className="overflow-hidden rounded-xl border border-[#e6edf5] bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[#e6edf5] bg-[#f8fafc] px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-950">套餐列表</div>
                <div className="mt-0.5 text-xs text-slate-500">一行管理版本、配额和编辑入口。</div>
              </div>
              <div className="text-xs font-semibold text-slate-500">{plans.length} 个套餐</div>
            </div>
            <div className="divide-y divide-[#eef3f8] overflow-x-auto">
            {plans.map((plan) => {
              const publishedVersion = getLatestVersion(plan, 'published');
              const draftVersion = getLatestVersion(plan, 'draft');
              const displayVersion = publishedVersion ?? draftVersion;
              const connectors = displayVersion
                ? readStringList(displayVersion.connectorEntitlementsJson, 'connectors')
                : [];
              const isSelected = selectedPlanId === plan.planId;

              return (
                <div
                  key={plan.planId}
                  className={cn(
                    'px-3 py-2 text-sm transition',
                    isSelected ? 'bg-blue-50/60' : 'bg-white',
                  )}
                >
                  <div className="grid min-w-[1000px] grid-cols-[minmax(180px,1.05fr)_minmax(128px,.95fr)_64px_52px_58px_96px_82px_minmax(178px,1.45fr)_auto] items-center gap-1.5">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate text-sm font-semibold text-slate-950">{plan.planName}</div>
                        <StatusPill status={publishedVersion?.status ?? draftVersion?.status ?? 'retired'} />
                      </div>
                      <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs">
                        <span className="truncate text-slate-500">编号：{plan.planCode}</span>
                        <span className="truncate font-semibold text-blue-700">
                          {draftVersion ? `草稿 ${draftVersion.versionCode}` : '点击编辑创建草稿'}
                        </span>
                      </div>
                    </div>
                    <CompactInfo label="当前版本" value={displayVersion?.versionCode ?? '暂无'} />
                    <CompactInfo label="展示价格" value={displayVersion?.displayPrice ?? '未定价'} />
                    <CompactInfo label="Agent" value={`${formatNumber(displayVersion?.agentLimit ?? null)} 个`} />
                    <CompactInfo label="员工席位" value={`${formatNumber(displayVersion?.seatLimit ?? null)} 席`} />
                    <CompactInfo label="AI调用额度/月" value={`${formatNumber(displayVersion?.monthlyAiCallLimit ?? null)} 次`} />
                    <CompactInfo label="知识库容量" value={formatStorageMb(displayVersion?.knowledgeStorageGb ?? null)} />
                    <CompactInfo
                      label="知识库任务"
                      value={displayVersion
                        ? [
                            `解析 ${formatQuotaEntitlement(displayVersion, 'knowledgeParseJobsMonthly')}`,
                            `向量 ${formatQuotaEntitlement(displayVersion, 'knowledgeEmbeddingJobsMonthly')}`,
                            `OCR ${formatQuotaEntitlement(displayVersion, 'knowledgeOcrJobsMonthly')}`,
                          ].join(' / ')
                        : '未配置'}
                    />
                    <CompactInfo label="连接器" value={listText(connectors)} />
                    {draftVersion ? (
                      <button
                        type="button"
                        aria-label={`编辑 ${plan.planName} 草稿`}
                        onClick={() => {
                          setSelectedPlanId(plan.planId);
                          setDraftForm(versionToDraftForm(draftVersion));
                        }}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 text-xs font-semibold text-blue-700"
                      >
                        <Save className="h-3.5 w-3.5" />
                        编辑
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-label={`编辑 ${plan.planName}`}
                        disabled={isMutating}
                        onClick={() => void handleCreateDraft(plan)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 text-xs font-semibold text-blue-700 hover:border-blue-300 disabled:opacity-60"
                      >
                        <Save className="h-3.5 w-3.5" />
                        编辑
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </section>
        </div>
      ) : null}

      {draftForm && selectedDraftPlan ? (
        <DraftEditor
          planName={selectedDraftPlan.planName}
          draftForm={draftForm}
          isMutating={isMutating}
          onUpdateDraft={updateDraft}
          onCancelDraft={handleCancelDraft}
          onPublishDraft={() => void handlePublishDraft()}
        />
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
                  <th className="px-3 py-3 font-semibold">知识库条目</th>
                  <th className="px-3 py-3 font-semibold">知识库文件</th>
                  <th className="px-3 py-3 font-semibold">总容量</th>
                  <th className="px-3 py-3 font-semibold">单文件</th>
                  <th className="px-3 py-3 font-semibold">解析 / 月</th>
                  <th className="px-3 py-3 font-semibold">向量 / 月</th>
                  <th className="px-3 py-3 font-semibold">OCR / 月</th>
                  <th className="px-3 py-3 font-semibold">问答 / 月</th>
                  <th className="px-3 py-3 font-semibold">索引重建 / 月</th>
                  <th className="px-3 py-3 font-semibold">OCR 能力</th>
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
                      <td className="px-3 py-3">{formatQuotaEntitlement(version, 'knowledgeItemsLimit')}</td>
                      <td className="px-3 py-3">{formatQuotaEntitlement(version, 'knowledgeFilesLimit')}</td>
                      <td className="px-3 py-3">{formatQuotaEntitlement(version, 'knowledgeTotalStorageMb', ' MB')}</td>
                      <td className="px-3 py-3">{formatQuotaEntitlement(version, 'knowledgeSingleFileSizeMb', ' MB')}</td>
                      <td className="px-3 py-3">{formatQuotaEntitlement(version, 'knowledgeParseJobsMonthly')}</td>
                      <td className="px-3 py-3">{formatQuotaEntitlement(version, 'knowledgeEmbeddingJobsMonthly')}</td>
                      <td className="px-3 py-3">{formatQuotaEntitlement(version, 'knowledgeOcrJobsMonthly')}</td>
                      <td className="px-3 py-3">{formatQuotaEntitlement(version, 'knowledgeRagAnswersMonthly')}</td>
                      <td className="px-3 py-3">{formatQuotaEntitlement(version, 'knowledgeIndexRebuildJobsMonthly')}</td>
                      <td className="px-3 py-3">{formatQuotaEnabled(version, 'knowledgeOcrEnabled')}</td>
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
