'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  FileImage,
  History,
  Megaphone,
  RotateCcw,
  Save,
  ShieldCheck,
  Upload,
} from 'lucide-react';

import { buildMarketingHomePreviewDocument } from '@/modules/marketing/components/MarketingHome';
import {
  cloneHomepageBrandConfig,
  defaultHomepageBrandConfig,
  validateHomepageBrandConfig,
  type HomepageBrandConfig,
} from '@/modules/marketing/domain/homepageBrandConfig';
import { PlatformSectionBanner } from '@/modules/open-platform/components/PlatformSectionBanner';
import { cn } from '@/shared/utils/cn';

const sectionShell = 'rounded-xl border border-[#e6edf5] bg-white p-5 shadow-sm lg:p-6';
const fieldShell =
  'rounded-xl border border-[#d8e2ee] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]';
const apiBase = '/api/v1/open-platform/homepage-brand';

const tabs = ['品牌概览', '登录页管理', '素材上传', '发布记录', '草稿预览'] as const;
type HomepageBrandTab = (typeof tabs)[number];

type HomepageBrandVersionDto = {
  id: string;
  versionNumber: number;
  summary: string;
  publishedBy: string;
  publishedAt: string;
};

type HomepageBrandAssetDto = {
  id: string;
  kind: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  publicUrl: string;
  uploadedBy: string;
  createdAt: string;
};

type HomepageBrandAuditLogDto = {
  id: string;
  action: string;
  actorId: string;
  summary: string;
  createdAt: string;
};

type HomepageBrandViewDto = {
  config: HomepageBrandConfig;
  status: string;
  publishedVersionId: string | null;
  publishedAt: string | null;
  versions: HomepageBrandVersionDto[];
  assets: HomepageBrandAssetDto[];
  auditLogs: HomepageBrandAuditLogDto[];
};

type HomepageBrandDraftDto = {
  status: string;
  config: HomepageBrandConfig;
};

type PendingConfirmation =
  | { kind: 'publish' }
  | { kind: 'rollback'; versionId: string; versionNumber: number }
  | null;

type VisualEditTargetId =
  | 'brand'
  | 'navigation'
  | 'hero'
  | 'heroPrimaryAction'
  | 'heroImage'
  | 'metricConversionRate'
  | 'diagnosisSection'
  | 'journeySection'
  | 'agentSection'
  | 'caseSection'
  | 'pricingSection'
  | 'finalCta'
  | 'footer'
  | 'wechatQr'
  | 'miniProgramQr';
type VisualContentTargetId =
  | 'diagnosisSection'
  | 'journeySection'
  | 'agentSection'
  | 'caseSection'
  | 'pricingSection'
  | 'finalCta';
type PreviewDevice = 'desktop' | 'mobile';

type AssetKind = 'logo' | 'night_logo' | 'mark_logo' | 'hero_background' | 'share_image';
type FooterQrTarget = 'wechatQrUrl' | 'miniProgramQrUrl';
type SaveDraftHandler = () => Promise<boolean>;

const assetKinds: Array<{ kind: AssetKind; label: string; target: keyof HomepageBrandConfig['assets'] }> = [
  { kind: 'logo', label: '横版标识', target: 'horizontalLogoUrl' },
  { kind: 'night_logo', label: '夜间横版标识', target: 'horizontalLogoNightUrl' },
  { kind: 'mark_logo', label: '图形标识', target: 'markLogoUrl' },
  { kind: 'hero_background', label: '首页背景图', target: 'heroBackgroundUrl' },
  { kind: 'share_image', label: '分享封面图', target: 'shareImageUrl' },
];

const hrefOptions = ['/login', '#diagnosis', '#agents', '#journey', '#cases'];

function formatDateTime(value: string | null | undefined) {
  if (!value) return '暂无';
  return value.replace('T', ' ').replace('.000Z', '');
}

function formatFileSize(sizeBytes: number) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return '0 KB';
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}

function getAssetKindLabel(kind: string) {
  return assetKinds.find((item) => item.kind === kind)?.label ?? '未分类素材';
}

function getAssetUsages(config: HomepageBrandConfig, publicUrl: string) {
  const usages: string[] = [];

  assetKinds.forEach((item) => {
    if (config.assets[item.target] === publicUrl) usages.push(item.label);
  });
  if (config.footer.wechatQrUrl === publicUrl) usages.push('公众号二维码');
  if (config.footer.miniProgramQrUrl === publicUrl) usages.push('小程序二维码');

  return usages;
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
        {label}
        {hint ? <span className="text-xs font-medium text-slate-400">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

type LowSensitiveErrorPayload = {
  ok: false;
  errorCode?: string;
};

function isLowSensitiveErrorPayload(value: unknown): value is LowSensitiveErrorPayload {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'ok' in value &&
    (value as { ok?: unknown }).ok === false,
  );
}

function responseError(errorCode?: string) {
  if (errorCode === 'HOMEPAGE_BRAND_UNAVAILABLE') {
    return new Error('配置服务不可用，请确认数据库迁移已完成');
  }
  if (errorCode === 'VALIDATION_FAILED') {
    return new Error('字段校验失败，请检查后再保存');
  }
  return new Error('首页与品牌接口暂时不可用');
}

async function readJson<T>(response: Response): Promise<T> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) throw responseError();
    throw responseError();
  }

  if (!response.ok || isLowSensitiveErrorPayload(payload)) {
    throw responseError(isLowSensitiveErrorPayload(payload) ? payload.errorCode : undefined);
  }

  return payload as T;
}

export function HomepageBrandPanel() {
  const [activeTab, setActiveTab] = useState<HomepageBrandTab>('品牌概览');
  const [config, setConfig] = useState<HomepageBrandConfig>(() => cloneHomepageBrandConfig(defaultHomepageBrandConfig));
  const [versions, setVersions] = useState<HomepageBrandVersionDto[]>([]);
  const [assets, setAssets] = useState<HomepageBrandAssetDto[]>([]);
  const [auditLogs, setAuditLogs] = useState<HomepageBrandAuditLogDto[]>([]);
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [publishSummary, setPublishSummary] = useState('');
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>(null);
  const [selectedVisualTarget, setSelectedVisualTarget] = useState<VisualEditTargetId | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadView() {
      try {
        const view = await readJson<HomepageBrandViewDto>(await fetch(apiBase));
        if (ignore) return;
        setConfig(cloneHomepageBrandConfig(view.config));
        setVersions(view.versions);
        setAssets(view.assets);
        setAuditLogs(view.auditLogs);
        setIsDirty(false);
      } catch (error) {
        if (!ignore) setMessage(error instanceof Error ? error.message : '');
      }
    }

    void loadView();
    return () => {
      ignore = true;
    };
  }, []);

  const validationErrors = useMemo(() => validateHomepageBrandConfig(config), [config]);
  const visibleNavCount = config.navigation.links.filter((item) => item.visible).length;
  const previewDocument = useMemo(() => buildMarketingHomePreviewDocument(config), [config]);

  function updateConfig(updater: (draft: HomepageBrandConfig) => void) {
    setConfig((current) => {
      const next = cloneHomepageBrandConfig(current);
      updater(next);
      return next;
    });
    setIsDirty(true);
    setMessage('草稿已修改，尚未保存');
  }

  async function persistDraft() {
    if (validationErrors.length > 0) {
      setMessage('字段校验失败，请先修正后再保存');
      return false;
    }

    const result = await readJson<HomepageBrandDraftDto>(await fetch(`${apiBase}/draft`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config }),
    }));
    setConfig(cloneHomepageBrandConfig(result.config));
    setIsDirty(false);
    return true;
  }

  async function saveDraft() {
    setIsBusy(true);
    try {
      const saved = await persistDraft();
      if (saved) setMessage('草稿已保存');
      return saved;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '草稿保存失败');
      return false;
    } finally {
      setIsBusy(false);
    }
  }

  async function publishConfig() {
    if (validationErrors.length > 0) {
      setMessage('字段校验失败，请先修正后再发布');
      return;
    }

    setIsBusy(true);
    try {
      const saved = await persistDraft();
      if (!saved) return;
      const result = await readJson<{ status: string; version: HomepageBrandVersionDto }>(await fetch(`${apiBase}/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ summary: publishSummary || '发布首页与品牌配置' }),
      }));
      setVersions((current) => [result.version, ...current.filter((item) => item.id !== result.version.id)]);
      setMessage(`已保存草稿并发布版本 ${result.version.versionNumber}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '发布失败');
    } finally {
      setIsBusy(false);
    }
  }

  async function confirmPendingAction() {
    const action = pendingConfirmation;
    setPendingConfirmation(null);
    if (!action) return;
    if (action.kind === 'publish') {
      await publishConfig();
      return;
    }
    await rollbackToVersion(action.versionId);
  }

  async function rollbackToVersion(versionId: string) {
    setIsBusy(true);
    try {
      const result = await readJson<{
        status: string;
        config: HomepageBrandConfig;
        version: HomepageBrandVersionDto;
      }>(await fetch(`${apiBase}/rollback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ versionId, summary: '回滚首页与品牌配置' }),
      }));
      setConfig(cloneHomepageBrandConfig(result.config));
      setVersions((current) => [result.version, ...current.filter((item) => item.id !== result.version.id)]);
      setIsDirty(false);
      setMessage(`已回滚并生成版本 ${result.version.versionNumber}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '回滚失败');
    } finally {
      setIsBusy(false);
    }
  }

  async function uploadAsset(kind: AssetKind, file: File | undefined) {
    if (!file) return;
    const target = assetKinds.find((item) => item.kind === kind);
    const formData = new FormData();
    formData.set('kind', kind);
    formData.set('file', file);

    setIsBusy(true);
    try {
      const result = await readJson<{ status: string; asset: HomepageBrandAssetDto }>(await fetch(`${apiBase}/assets`, {
        method: 'POST',
        body: formData,
      }));
      setAssets((current) => [result.asset, ...current.filter((item) => item.id !== result.asset.id)]);
      if (target) {
        updateConfig((draft) => {
          draft.assets[target.target] = result.asset.publicUrl;
        });
      }
      setMessage('素材已上传');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '素材上传失败');
    } finally {
      setIsBusy(false);
    }
  }

  async function uploadFooterQr(target: FooterQrTarget, label: string, file: File | undefined) {
    if (!file) return;
    const formData = new FormData();
    formData.set('kind', 'share_image');
    formData.set('file', file);

    setIsBusy(true);
    try {
      const result = await readJson<{ status: string; asset: HomepageBrandAssetDto }>(await fetch(`${apiBase}/assets`, {
        method: 'POST',
        body: formData,
      }));
      setAssets((current) => [result.asset, ...current.filter((item) => item.id !== result.asset.id)]);
      updateConfig((draft) => {
        draft.footer[target] = result.asset.publicUrl;
      });
      setMessage(`${label}已上传`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${label}上传失败`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="space-y-5" aria-labelledby="homepage-brand-heading">
      <PlatformSectionBanner
        headingId="homepage-brand-heading"
        title="首页与品牌"
        description="管理首页品牌文字、首屏内容、导航、图片素材、发布版本、回滚和审计记录。草稿保存后进入持久化配置，发布后真实首页读取已发布版本。"
      >
        <div className="flex flex-wrap items-center gap-2">
          {isDirty ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              有未保存修改
            </span>
          ) : null}
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void saveDraft()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            保存草稿
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => setPendingConfirmation({ kind: 'publish' })}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:opacity-60"
          >
            <Megaphone className="h-4 w-4" />
            保存并发布
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('草稿预览')}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#d8e2ee] bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
          >
            <Eye className="h-4 w-4" />
            草稿预览
          </button>
        </div>
        {message ? (
          <p className="text-sm font-semibold text-blue-700" aria-live="polite">
            {message}
          </p>
        ) : null}
      </PlatformSectionBanner>

      <div className={cn(sectionShell, 'p-2')}>
        <div role="tablist" aria-label="首页与品牌页签" className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'h-10 rounded-lg px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#bfdbfe]',
                activeTab === tab ? 'bg-[#eaf3ff] text-[#2563eb]' : 'text-slate-500 hover:bg-[#f1f5f9] hover:text-slate-900',
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === '品牌概览' ? (
        <BrandOverview
          config={config}
          updateConfig={updateConfig}
          saveDraft={saveDraft}
          uploadFooterQr={uploadFooterQr}
          isBusy={isBusy}
        />
      ) : null}
      {activeTab === '登录页管理' ? <LoginPageEditor config={config} updateConfig={updateConfig} saveDraft={saveDraft} isBusy={isBusy} /> : null}
      {activeTab === '素材上传' ? <AssetUploader config={config} assets={assets} uploadAsset={uploadAsset} /> : null}
      {activeTab === '发布记录' ? (
        <PublishRecords
          versions={versions}
          auditLogs={auditLogs}
          publishSummary={publishSummary}
          setPublishSummary={setPublishSummary}
          requestPublish={() => setPendingConfirmation({ kind: 'publish' })}
          requestRollbackToVersion={(version) => setPendingConfirmation({
            kind: 'rollback',
            versionId: version.id,
            versionNumber: version.versionNumber,
          })}
          isBusy={isBusy}
        />
      ) : null}
      {activeTab === '草稿预览' ? (
        <HomepagePreview
          previewDocument={previewDocument}
          config={config}
          updateConfig={updateConfig}
          uploadAsset={uploadAsset}
          uploadFooterQr={uploadFooterQr}
          selectedTarget={selectedVisualTarget}
          setSelectedTarget={setSelectedVisualTarget}
          onUnavailableTarget={() => setMessage('该区域暂不可编辑，请点击蓝色高亮区域或上方可编辑区块。')}
          goToTab={setActiveTab}
          isBusy={isBusy}
        />
      ) : null}

      {pendingConfirmation ? (
        <ConfirmActionDialog
          action={pendingConfirmation}
          isBusy={isBusy}
          onCancel={() => setPendingConfirmation(null)}
          onConfirm={() => void confirmPendingAction()}
        />
      ) : null}
    </section>
  );
}

function BrandOverview({
  config,
  updateConfig,
  saveDraft,
  uploadFooterQr,
  isBusy,
}: {
  config: HomepageBrandConfig;
  updateConfig: (updater: (draft: HomepageBrandConfig) => void) => void;
  saveDraft: SaveDraftHandler;
  uploadFooterQr: (target: FooterQrTarget, label: string, file: File | undefined) => void;
  isBusy: boolean;
}) {
  return (
    <div className="grid gap-5">
      <article className={sectionShell} aria-label="品牌与页面基础信息">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold tracking-normal text-slate-950">品牌与页面基础信息</h3>
            <p className="text-sm leading-6 text-slate-500">集中管理品牌文字、浏览器标题、首页描述和分享文案。</p>
          </div>
          <CardSaveButton onSave={saveDraft} disabled={isBusy} />
        </div>
        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.15fr)]">
          <section className="grid content-start gap-4" aria-labelledby="brand-copy-heading">
            <h4 id="brand-copy-heading" className="text-base font-semibold tracking-normal text-slate-950">
              品牌文字
            </h4>
            <Field label="平台名称" hint="最多20字">
              <input aria-label="平台名称" className={fieldShell} maxLength={20} value={config.brand.platformName} onChange={(event) => updateConfig((draft) => { draft.brand.platformName = event.target.value; })} />
            </Field>
            <Field label="后台名称" hint="最多24字">
              <input aria-label="后台名称" className={fieldShell} maxLength={24} value={config.brand.consoleName} onChange={(event) => updateConfig((draft) => { draft.brand.consoleName = event.target.value; })} />
            </Field>
            <Field label="品牌副标题" hint="最多16字">
              <input aria-label="品牌副标题" className={fieldShell} maxLength={16} value={config.brand.subtitle} onChange={(event) => updateConfig((draft) => { draft.brand.subtitle = event.target.value; })} />
            </Field>
          </section>

          <section className="grid content-start gap-4 border-t border-[#e6edf5] pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0" aria-labelledby="page-display-heading">
            <h4 id="page-display-heading" className="text-base font-semibold tracking-normal text-slate-950">
              页面展示信息
            </h4>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="首页浏览器标题" hint="最多36字">
                <input aria-label="首页浏览器标题" className={fieldShell} maxLength={36} value={config.metadata.title} onChange={(event) => updateConfig((draft) => { draft.metadata.title = event.target.value; })} />
              </Field>
              <Field label="分享标题" hint="最多24字">
                <input aria-label="分享标题" className={fieldShell} maxLength={24} value={config.metadata.shareTitle} onChange={(event) => updateConfig((draft) => { draft.metadata.shareTitle = event.target.value; })} />
              </Field>
              <Field label="首页描述" hint="最多120字">
                <textarea aria-label="首页描述" className={cn(fieldShell, 'min-h-[76px] resize-none')} maxLength={120} value={config.metadata.description} onChange={(event) => updateConfig((draft) => { draft.metadata.description = event.target.value; })} />
              </Field>
              <Field label="分享描述" hint="最多120字">
                <textarea aria-label="分享描述" className={cn(fieldShell, 'min-h-[76px] resize-none')} maxLength={120} value={config.metadata.shareDescription} onChange={(event) => updateConfig((draft) => { draft.metadata.shareDescription = event.target.value; })} />
              </Field>
            </div>
          </section>
        </div>
      </article>

      <article className={sectionShell} aria-label="SEO 信息">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold tracking-normal text-slate-950">SEO 信息</h3>
            <p className="text-sm leading-6 text-slate-500">用于搜索引擎收录与分享检索，不影响后台品牌名称。</p>
          </div>
          <CardSaveButton onSave={saveDraft} disabled={isBusy} />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="SEO标题" hint="建议 20-60 字">
            <input aria-label="SEO标题" className={fieldShell} maxLength={80} value={config.metadata.seoTitle} onChange={(event) => updateConfig((draft) => { draft.metadata.seoTitle = event.target.value; })} />
          </Field>
          <Field label="SEO关键词" hint="用英文逗号分隔">
            <input aria-label="SEO关键词" className={fieldShell} maxLength={160} value={config.metadata.seoKeywords} onChange={(event) => updateConfig((draft) => { draft.metadata.seoKeywords = event.target.value; })} />
          </Field>
          <div className="md:col-span-2">
            <Field label="SEO描述" hint="最多180字">
              <textarea aria-label="SEO描述" className={cn(fieldShell, 'min-h-[84px] resize-none')} maxLength={180} value={config.metadata.seoDescription} onChange={(event) => updateConfig((draft) => { draft.metadata.seoDescription = event.target.value; })} />
            </Field>
          </div>
        </div>
      </article>

      <article className={sectionShell} aria-label="页脚与合规信息">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold tracking-normal text-slate-950">页脚与合规信息</h3>
            <p className="text-sm leading-6 text-slate-500">管理官网页脚展示、备案链接和二维码入口。</p>
          </div>
          <CardSaveButton onSave={saveDraft} disabled={isBusy} />
        </div>
        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <section className="grid content-start gap-4 md:grid-cols-2" aria-label="联系与备案字段">
            <Field label="公司名称">
              <input aria-label="公司名称" className={fieldShell} maxLength={40} value={config.footer.companyName} onChange={(event) => updateConfig((draft) => { draft.footer.companyName = event.target.value; })} />
            </Field>
            <Field label="联系电话">
              <input aria-label="联系电话" className={fieldShell} maxLength={24} value={config.footer.phone} onChange={(event) => updateConfig((draft) => { draft.footer.phone = event.target.value; })} />
            </Field>
            <Field label="邮箱地址">
              <input aria-label="邮箱地址" className={fieldShell} maxLength={60} value={config.footer.email} onChange={(event) => updateConfig((draft) => { draft.footer.email = event.target.value; })} />
            </Field>
            <Field label="ICP备案号">
              <input aria-label="ICP备案号" className={fieldShell} maxLength={40} value={config.footer.icpNumber} onChange={(event) => updateConfig((draft) => { draft.footer.icpNumber = event.target.value; })} />
            </Field>
            <Field label="ICP备案链接">
              <input aria-label="ICP备案链接" className={fieldShell} maxLength={120} value={config.footer.icpUrl} onChange={(event) => updateConfig((draft) => { draft.footer.icpUrl = event.target.value; })} />
            </Field>
            <Field label="公安网警备案号">
              <input aria-label="公安网警备案号" className={fieldShell} maxLength={50} value={config.footer.policeNumber} onChange={(event) => updateConfig((draft) => { draft.footer.policeNumber = event.target.value; })} />
            </Field>
            <div className="md:col-span-2">
              <Field label="公安网警备案链接">
                <input aria-label="公安网警备案链接" className={fieldShell} maxLength={120} value={config.footer.policeUrl} onChange={(event) => updateConfig((draft) => { draft.footer.policeUrl = event.target.value; })} />
              </Field>
            </div>
          </section>

          <section className="grid content-start gap-4 border-t border-[#e6edf5] pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0" aria-labelledby="qr-display-heading">
            <h4 id="qr-display-heading" className="text-base font-semibold tracking-normal text-slate-950">
              二维码展示
            </h4>
            <Field label="公众号二维码地址" hint="本轮使用图片地址">
              <input aria-label="公众号二维码地址" className={fieldShell} maxLength={180} value={config.footer.wechatQrUrl} onChange={(event) => updateConfig((draft) => { draft.footer.wechatQrUrl = event.target.value; })} />
            </Field>
            <Field label="小程序二维码地址" hint="本轮使用图片地址">
              <input aria-label="小程序二维码地址" className={fieldShell} maxLength={180} value={config.footer.miniProgramQrUrl} onChange={(event) => updateConfig((draft) => { draft.footer.miniProgramQrUrl = event.target.value; })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <QrPreview
                label="公众号二维码"
                src={config.footer.wechatQrUrl}
                uploadLabel="上传公众号二维码"
                removeLabel="移除公众号二维码"
                disabled={isBusy}
                onUpload={(file) => uploadFooterQr('wechatQrUrl', '公众号二维码', file)}
                onRemove={() => updateConfig((draft) => { draft.footer.wechatQrUrl = ''; })}
              />
              <QrPreview
                label="小程序二维码"
                src={config.footer.miniProgramQrUrl}
                uploadLabel="上传小程序二维码"
                removeLabel="移除小程序二维码"
                disabled={isBusy}
                onUpload={(file) => uploadFooterQr('miniProgramQrUrl', '小程序二维码', file)}
                onRemove={() => updateConfig((draft) => { draft.footer.miniProgramQrUrl = ''; })}
              />
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}

function CardSaveButton({ onSave, disabled }: { onSave: SaveDraftHandler; disabled: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void onSave()}
      className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-60"
    >
      <Save className="h-4 w-4" />
      保存
    </button>
  );
}

function QrPreview({
  label,
  src,
  uploadLabel,
  removeLabel,
  disabled,
  onUpload,
  onRemove,
}: {
  label: string;
  src: string;
  uploadLabel: string;
  removeLabel: string;
  disabled: boolean;
  onUpload: (file: File | undefined) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#e6edf5] bg-[#f8fafc] p-3">
      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#e6edf5] bg-white">
        {src ? <img src={src} alt={`${label}预览`} className="h-full w-full object-cover" /> : <span className="text-xs text-slate-400">暂无</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <div className="mt-1 truncate text-xs text-slate-500">{src || '未配置'}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="inline-flex h-8 cursor-pointer items-center justify-center rounded-lg border border-blue-200 bg-white px-2.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50">
            上传
            <input
              aria-label={uploadLabel}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={disabled}
              className="sr-only"
              onChange={(event) => onUpload(event.target.files?.[0])}
            />
          </label>
          <button
            type="button"
            disabled={disabled || !src}
            onClick={onRemove}
            aria-label={removeLabel}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-[#d8e2ee] bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-50"
          >
            移除
          </button>
        </div>
      </div>
    </div>
  );
}

function HeroEditor({
  config,
  updateConfig,
  validationErrors,
  saveDraft,
  isBusy,
}: {
  config: HomepageBrandConfig;
  updateConfig: (updater: (draft: HomepageBrandConfig) => void) => void;
  validationErrors: string[];
  saveDraft: SaveDraftHandler;
  isBusy: boolean;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <article className={sectionShell}>
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold tracking-normal text-slate-950">首屏文案与按钮</h3>
          <CardSaveButton onSave={saveDraft} disabled={isBusy} />
        </div>
        <div className="mt-5 grid gap-4">
          <Field label="首屏标签" hint="最多40字">
            <input className={fieldShell} maxLength={40} value={config.hero.eyebrow} onChange={(event) => updateConfig((draft) => { draft.hero.eyebrow = event.target.value; })} />
          </Field>
          <Field label="主标题第一行" hint="最多18字">
            <input aria-label="主标题第一行" className={fieldShell} maxLength={18} value={config.hero.titleLine} onChange={(event) => updateConfig((draft) => { draft.hero.titleLine = event.target.value; })} />
          </Field>
          <Field label="主标题强调行" hint="最多18字">
            <input aria-label="主标题强调行" className={fieldShell} maxLength={18} value={config.hero.accentLine} onChange={(event) => updateConfig((draft) => { draft.hero.accentLine = event.target.value; })} />
          </Field>
          <Field label="副标题" hint="最多160字">
            <textarea className={cn(fieldShell, 'min-h-[96px] resize-none')} maxLength={160} value={config.hero.description} onChange={(event) => updateConfig((draft) => { draft.hero.description = event.target.value; })} />
          </Field>
          <Field label="首屏说明" hint="最多120字">
            <textarea className={cn(fieldShell, 'min-h-[76px] resize-none')} maxLength={120} value={config.hero.note} onChange={(event) => updateConfig((draft) => { draft.hero.note = event.target.value; })} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="主按钮文字">
              <input className={fieldShell} value={config.hero.primaryAction.label} onChange={(event) => updateConfig((draft) => { draft.hero.primaryAction.label = event.target.value; })} />
            </Field>
            <Field label="主按钮地址">
              <select className={fieldShell} value={config.hero.primaryAction.href} onChange={(event) => updateConfig((draft) => { draft.hero.primaryAction.href = event.target.value; })}>
                {hrefOptions.map((href) => <option key={href} value={href}>{href}</option>)}
              </select>
            </Field>
            <Field label="辅助按钮文字">
              <input className={fieldShell} value={config.hero.secondaryAction.label} onChange={(event) => updateConfig((draft) => { draft.hero.secondaryAction.label = event.target.value; })} />
            </Field>
            <Field label="辅助按钮地址">
              <select className={fieldShell} value={config.hero.secondaryAction.href} onChange={(event) => updateConfig((draft) => { draft.hero.secondaryAction.href = event.target.value; })}>
                {hrefOptions.map((href) => <option key={href} value={href}>{href}</option>)}
              </select>
            </Field>
          </div>
        </div>
      </article>
      <ValidationPanel validationErrors={validationErrors} />
    </div>
  );
}

function NavigationEditor({
  config,
  updateConfig,
  visibleNavCount,
  saveDraft,
  isBusy,
}: {
  config: HomepageBrandConfig;
  updateConfig: (updater: (draft: HomepageBrandConfig) => void) => void;
  visibleNavCount: number;
  saveDraft: SaveDraftHandler;
  isBusy: boolean;
}) {
  return (
    <article className={sectionShell} aria-label="顶部导航配置">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-normal text-slate-950">导航列表</h3>
          <p className="mt-1 text-sm text-slate-500">导航保持固定数量，只允许修改名称、跳转位置和显示状态。</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">当前显示 {visibleNavCount} 项</span>
          <CardSaveButton onSave={saveDraft} disabled={isBusy} />
        </div>
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border border-[#e6edf5]">
        {config.navigation.links.map((item, index) => (
          <div key={item.id} className="grid gap-3 border-b border-[#e6edf5] px-4 py-3 last:border-b-0 md:grid-cols-[1fr_1fr_120px]">
            <input aria-label={`导航名称：${item.label}`} className={fieldShell} value={item.label} onChange={(event) => updateConfig((draft) => { draft.navigation.links[index].label = event.target.value; })} />
            <select className={fieldShell} value={item.href} onChange={(event) => updateConfig((draft) => { draft.navigation.links[index].href = event.target.value; })}>
              {hrefOptions.filter((href) => href !== '/login').map((href) => <option key={href} value={href}>{href}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input type="checkbox" aria-label={`导航显示状态：${item.label}`} checked={item.visible} onChange={(event) => updateConfig((draft) => { draft.navigation.links[index].visible = event.target.checked; })} />
              {item.visible ? '显示' : '隐藏'}
            </label>
          </div>
        ))}
      </div>
    </article>
  );
}

function LoginPageEditor({
  config,
  updateConfig,
  saveDraft,
  isBusy,
}: {
  config: HomepageBrandConfig;
  updateConfig: (updater: (draft: HomepageBrandConfig) => void) => void;
  saveDraft: SaveDraftHandler;
  isBusy: boolean;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <article className={sectionShell}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold tracking-normal text-slate-950">机构登录页</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">管理机构工作台登录页的公开品牌文案，不管理账号、密码和认证策略。</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              /login
            </span>
            <CardSaveButton onSave={saveDraft} disabled={isBusy} />
          </div>
        </div>
        <div className="mt-5 grid gap-4">
          <Field label="机构登录标签" hint="左侧胶囊文案">
            <input aria-label="机构登录标签" className={fieldShell} maxLength={24} value={config.login.institution.eyebrow} onChange={(event) => updateConfig((draft) => { draft.login.institution.eyebrow = event.target.value; })} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="机构登录主标题">
              <input aria-label="机构登录主标题" className={fieldShell} maxLength={18} value={config.login.institution.title} onChange={(event) => updateConfig((draft) => { draft.login.institution.title = event.target.value; })} />
            </Field>
            <Field label="机构登录强调标题">
              <input aria-label="机构登录强调标题" className={fieldShell} maxLength={18} value={config.login.institution.accentTitle} onChange={(event) => updateConfig((draft) => { draft.login.institution.accentTitle = event.target.value; })} />
            </Field>
          </div>
          <Field label="机构登录说明" hint="最多160字">
            <textarea aria-label="机构登录说明" className={cn(fieldShell, 'min-h-[88px] resize-none')} maxLength={160} value={config.login.institution.description} onChange={(event) => updateConfig((draft) => { draft.login.institution.description = event.target.value; })} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="机构表单眉标">
              <input aria-label="机构表单眉标" className={fieldShell} maxLength={16} value={config.login.institution.formEyebrow} onChange={(event) => updateConfig((draft) => { draft.login.institution.formEyebrow = event.target.value; })} />
            </Field>
            <Field label="机构表单标题">
              <input aria-label="机构表单标题" className={fieldShell} maxLength={24} value={config.login.institution.formTitle} onChange={(event) => updateConfig((draft) => { draft.login.institution.formTitle = event.target.value; })} />
            </Field>
          </div>
          <Field label="机构表单说明">
            <input aria-label="机构表单说明" className={fieldShell} maxLength={60} value={config.login.institution.formDescription} onChange={(event) => updateConfig((draft) => { draft.login.institution.formDescription = event.target.value; })} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="机构登录按钮文字">
              <input aria-label="机构登录按钮文字" className={fieldShell} maxLength={20} value={config.login.institution.submitLabel} onChange={(event) => updateConfig((draft) => { draft.login.institution.submitLabel = event.target.value; })} />
            </Field>
            <Field label="机构切换入口文案">
              <input aria-label="机构切换入口文案" className={fieldShell} maxLength={20} value={config.login.institution.alternateLabel} onChange={(event) => updateConfig((draft) => { draft.login.institution.alternateLabel = event.target.value; })} />
            </Field>
          </div>
        </div>
      </article>

      <article className={sectionShell}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold tracking-normal text-slate-950">平台登录页</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">管理平台管理员登录页的公开展示文案，认证范围仍由登录接口控制。</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
              /platform-login
            </span>
            <CardSaveButton onSave={saveDraft} disabled={isBusy} />
          </div>
        </div>
        <div className="mt-5 grid gap-4">
          <Field label="平台登录标签" hint="左侧胶囊文案">
            <input aria-label="平台登录标签" className={fieldShell} maxLength={24} value={config.login.platform.eyebrow} onChange={(event) => updateConfig((draft) => { draft.login.platform.eyebrow = event.target.value; })} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="平台登录主标题">
              <input aria-label="平台登录主标题" className={fieldShell} maxLength={18} value={config.login.platform.title} onChange={(event) => updateConfig((draft) => { draft.login.platform.title = event.target.value; })} />
            </Field>
            <Field label="平台登录强调标题">
              <input aria-label="平台登录强调标题" className={fieldShell} maxLength={18} value={config.login.platform.accentTitle} onChange={(event) => updateConfig((draft) => { draft.login.platform.accentTitle = event.target.value; })} />
            </Field>
          </div>
          <Field label="平台登录说明" hint="最多160字">
            <textarea aria-label="平台登录说明" className={cn(fieldShell, 'min-h-[88px] resize-none')} maxLength={160} value={config.login.platform.description} onChange={(event) => updateConfig((draft) => { draft.login.platform.description = event.target.value; })} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="平台表单眉标">
              <input aria-label="平台表单眉标" className={fieldShell} maxLength={16} value={config.login.platform.formEyebrow} onChange={(event) => updateConfig((draft) => { draft.login.platform.formEyebrow = event.target.value; })} />
            </Field>
            <Field label="平台表单标题">
              <input aria-label="平台表单标题" className={fieldShell} maxLength={24} value={config.login.platform.formTitle} onChange={(event) => updateConfig((draft) => { draft.login.platform.formTitle = event.target.value; })} />
            </Field>
          </div>
          <Field label="平台表单说明">
            <input aria-label="平台表单说明" className={fieldShell} maxLength={60} value={config.login.platform.formDescription} onChange={(event) => updateConfig((draft) => { draft.login.platform.formDescription = event.target.value; })} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="平台登录按钮文字">
              <input aria-label="平台登录按钮文字" className={fieldShell} maxLength={20} value={config.login.platform.submitLabel} onChange={(event) => updateConfig((draft) => { draft.login.platform.submitLabel = event.target.value; })} />
            </Field>
            <Field label="平台切换入口文案">
              <input aria-label="平台切换入口文案" className={fieldShell} maxLength={20} value={config.login.platform.alternateLabel} onChange={(event) => updateConfig((draft) => { draft.login.platform.alternateLabel = event.target.value; })} />
            </Field>
          </div>
        </div>
      </article>
    </div>
  );
}

function AssetUploader({
  config,
  assets,
  uploadAsset,
}: {
  config: HomepageBrandConfig;
  assets: HomepageBrandAssetDto[];
  uploadAsset: (kind: AssetKind, file: File | undefined) => void;
}) {
  const assetByUrl = new Map(assets.map((asset) => [asset.publicUrl, asset]));

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <article className={sectionShell} aria-label="当前品牌素材展示">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <FileImage className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-normal text-slate-950">当前素材展示</h3>
            <p className="mt-1 text-sm text-slate-500">展示当前平台首页正在使用的标识、背景图和分享图。</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {assetKinds.map((item) => {
            const publicUrl = config.assets[item.target];
            const asset = assetByUrl.get(publicUrl);
            const isWideAsset = item.kind === 'hero_background' || item.kind === 'share_image';

            return (
              <div
                key={item.kind}
                className={cn(
                  'rounded-xl border border-[#e6edf5] bg-[#f8fafc] p-4',
                  isWideAsset ? 'md:col-span-2' : '',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-950">{item.label}</h4>
                    <p className="mt-1 text-xs text-slate-500">{asset?.originalFilename ?? '当前配置素材'}</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {asset?.uploadedBy === 'system_sync' ? '系统同步' : '已上传'}
                  </span>
                </div>
                <div
                  className={cn(
                    'mt-3 grid overflow-hidden rounded-lg border border-[#e6edf5] bg-white',
                    isWideAsset ? 'h-44 place-items-center' : 'h-28 place-items-center px-4',
                  )}
                >
                  <img
                    src={publicUrl}
                    alt={`${item.label}预览`}
                    className={cn(
                      'max-h-full max-w-full',
                      isWideAsset ? 'h-full w-full object-cover' : 'object-contain',
                    )}
                  />
                </div>
                <div className="mt-2 break-all text-xs text-slate-500">{publicUrl}</div>
              </div>
            );
          })}
        </div>
      </article>

      <article className={sectionShell} aria-label="品牌素材上传替换">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-normal text-slate-950">上传替换</h3>
            <p className="mt-1 text-sm text-slate-500">上传后会替换对应素材的当前引用地址。</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4">
          {assetKinds.map((item) => (
            <Field key={item.kind} label={item.label} hint="PNG / JPG / WEBP，最大 5MB">
              <input
                aria-label={`上传${item.label}`}
                className={fieldShell}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => uploadAsset(item.kind, event.target.files?.[0])}
              />
            </Field>
          ))}
        </div>
      </article>

      <article className={cn(sectionShell, 'xl:col-span-2')} aria-label="全部素材库">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <FileImage className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-normal text-slate-950">全部素材库</h3>
              <p className="mt-1 text-sm text-slate-500">汇总从素材上传和草稿预览上传过的图片，并标记当前使用位置。</p>
            </div>
          </div>
          <span className="inline-flex h-8 items-center rounded-full border border-blue-100 bg-blue-50 px-3 text-xs font-semibold text-blue-700">
            共 {assets.length} 个素材
          </span>
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border border-[#e6edf5]">
          {assets.length === 0 ? (
            <div className="bg-[#f8fafc] px-4 py-8 text-center text-sm text-slate-500">暂无上传素材</div>
          ) : (
            <div className="divide-y divide-[#e6edf5]">
              {assets.map((asset) => {
                const usages = getAssetUsages(config, asset.publicUrl);

                return (
                  <div key={asset.id} className="grid gap-3 bg-white p-4 md:grid-cols-[72px_minmax(0,1fr)_auto] md:items-center">
                    <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-lg border border-[#e6edf5] bg-[#f8fafc]">
                      <img src={asset.publicUrl} alt={`${asset.originalFilename}预览`} className="h-full w-full object-contain" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-950">{asset.originalFilename}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                          {getAssetKindLabel(asset.kind)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>{asset.mimeType}</span>
                        <span>{formatFileSize(asset.sizeBytes)}</span>
                        <span>{formatDateTime(asset.createdAt)}</span>
                        <span>{asset.uploadedBy === 'system_sync' ? '来源：系统同步' : '来源：后台上传'}</span>
                      </div>
                      <p className="mt-2 break-all text-xs text-slate-400">{asset.publicUrl}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      {usages.length > 0 ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          当前用于：{usages.join('、')}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">未使用</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

function PublishRecords({
  versions,
  auditLogs,
  publishSummary,
  setPublishSummary,
  requestPublish,
  requestRollbackToVersion,
  isBusy,
}: {
  versions: HomepageBrandVersionDto[];
  auditLogs: HomepageBrandAuditLogDto[];
  publishSummary: string;
  setPublishSummary: (value: string) => void;
  requestPublish: () => void;
  requestRollbackToVersion: (version: HomepageBrandVersionDto) => void;
  isBusy: boolean;
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <article className={sectionShell}>
          <h3 className="text-lg font-semibold tracking-normal text-slate-950">发布控制</h3>
          <div className="mt-5 grid gap-4">
            <Field label="发布说明" hint="会写入版本摘要">
              <textarea aria-label="发布说明" className={cn(fieldShell, 'min-h-[96px] resize-none')} value={publishSummary} onChange={(event) => setPublishSummary(event.target.value)} />
            </Field>
            <button type="button" disabled={isBusy} onClick={requestPublish} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">
              <Megaphone className="h-4 w-4" />
              确认发布
            </button>
          </div>
        </article>
        <article className={sectionShell}>
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold tracking-normal text-slate-950">版本历史</h3>
          </div>
          <div className="mt-5 grid gap-3">
            {versions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#d8e2ee] bg-[#f8fafc] px-4 py-6 text-sm text-slate-500">暂无发布版本</div>
            ) : versions.map((version) => (
              <div key={version.id} className="flex flex-col gap-3 rounded-xl border border-[#e6edf5] bg-[#f8fafc] px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-950">版本 {version.versionNumber} · {version.summary}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatDateTime(version.publishedAt)} · {version.publishedBy}</div>
                </div>
                <button type="button" disabled={isBusy} onClick={() => requestRollbackToVersion(version)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#d8e2ee] bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 disabled:opacity-60">
                  <RotateCcw className="h-3.5 w-3.5" />
                  回滚到版本 {version.versionNumber}
                </button>
              </div>
            ))}
          </div>
        </article>
      </div>
      <AuditLogList auditLogs={auditLogs} />
    </div>
  );
}

function ConfirmActionDialog({
  action,
  isBusy,
  onCancel,
  onConfirm,
}: {
  action: NonNullable<PendingConfirmation>;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isPublish = action.kind === 'publish';
  const title = isPublish ? '确认发布' : '确认回滚';
  const description = isPublish
    ? '发布前会先保存当前草稿，再生成新的首页与品牌发布版本。'
    : `确认回滚到版本 ${action.versionNumber}？回滚会生成新的发布版本。`;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="homepage-brand-confirm-title"
        className="w-full max-w-md rounded-xl border border-[#d8e2ee] bg-white p-5 shadow-xl"
      >
        <h3 id="homepage-brand-confirm-title" className="text-lg font-semibold tracking-normal text-slate-950">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={onCancel}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#d8e2ee] bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 disabled:opacity-60"
          >
            取消
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={onConfirm}
            className={cn(
              'inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white transition disabled:opacity-60',
              isPublish ? 'bg-[#2563eb] hover:bg-[#1d4ed8]' : 'bg-slate-950 hover:bg-slate-800',
            )}
          >
            {isPublish ? '确认发布' : '确认回滚'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AuditLogList({ auditLogs }: { auditLogs: HomepageBrandAuditLogDto[] }) {
  return (
    <article className={sectionShell}>
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-emerald-600" />
        <h3 className="text-lg font-semibold tracking-normal text-slate-950">审计记录</h3>
      </div>
      <div className="mt-5 grid gap-3">
        {auditLogs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d8e2ee] bg-[#f8fafc] px-4 py-6 text-sm text-slate-500">暂无审计记录</div>
        ) : auditLogs.map((auditLog) => (
          <div key={auditLog.id} className="rounded-xl border border-[#e6edf5] bg-[#f8fafc] px-4 py-3">
            <div className="text-sm font-semibold text-slate-950">{auditLog.summary}</div>
            <div className="mt-1 text-xs text-slate-500">{auditLog.action} · {auditLog.actorId} · {formatDateTime(auditLog.createdAt)}</div>
          </div>
        ))}
      </div>
    </article>
  );
}

function ValidationPanel({ validationErrors }: { validationErrors: string[] }) {
  return (
    <article className={sectionShell}>
      <h3 className="text-lg font-semibold tracking-normal text-slate-950">字段校验</h3>
      <div className="mt-5 grid gap-2">
        {validationErrors.length === 0 ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">字段校验通过</div>
        ) : validationErrors.map((error) => (
          <div key={error} className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">{error}</div>
        ))}
      </div>
    </article>
  );
}

const visualTargetLabels: Record<VisualEditTargetId, { label: string; tab: HomepageBrandTab; hint: string }> = {
  brand: { label: '品牌文字', tab: '品牌概览', hint: '平台名称、后台名称和品牌副标题' },
  navigation: { label: '顶部导航', tab: '草稿预览', hint: '导航项、跳转地址和主按钮' },
  hero: { label: '首页首屏', tab: '草稿预览', hint: '主标题、说明文案和首屏按钮' },
  heroPrimaryAction: { label: '首屏按钮', tab: '草稿预览', hint: '主按钮、辅助按钮和跳转地址' },
  heroImage: { label: '首页背景图', tab: '素材上传', hint: '首屏背景图地址' },
  metricConversionRate: { label: '增长指标', tab: '草稿预览', hint: '首页指标卡、增长卡和下一步建议' },
  diagnosisSection: { label: '增长诊断区块', tab: '草稿预览', hint: '增长诊断标题、说明和四个诊断卡片' },
  journeySection: { label: '客户旅程区块', tab: '草稿预览', hint: '客户旅程标题、说明和旅程节点' },
  agentSection: { label: '智能体方案区块', tab: '草稿预览', hint: '智能体方案标题、说明和智能体卡片' },
  caseSection: { label: '案例数据区块', tab: '草稿预览', hint: '案例引用、结果指标和案例说明' },
  pricingSection: { label: '套餐方案区块', tab: '草稿预览', hint: '套餐标题、说明和方案卡片' },
  finalCta: { label: '底部转化区块', tab: '草稿预览', hint: '底部转化标题、说明和按钮' },
  footer: { label: '页脚与合规信息', tab: '品牌概览', hint: '公司信息、备案和联系方式' },
  wechatQr: { label: '公众号二维码', tab: '品牌概览', hint: '公众号二维码图片地址' },
  miniProgramQr: { label: '小程序二维码', tab: '品牌概览', hint: '小程序二维码图片地址' },
};

const visualEditTargets: VisualEditTargetId[] = [
  'hero',
  'heroPrimaryAction',
  'navigation',
  'brand',
  'heroImage',
  'metricConversionRate',
  'diagnosisSection',
  'journeySection',
  'agentSection',
  'caseSection',
  'pricingSection',
  'finalCta',
  'footer',
  'wechatQr',
  'miniProgramQr',
];

const visualContentModuleKeys: Record<VisualContentTargetId, keyof HomepageBrandConfig['sections']> = {
  diagnosisSection: 'diagnosis',
  journeySection: 'journey',
  agentSection: 'agents',
  caseSection: 'cases',
  pricingSection: 'pricing',
  finalCta: 'finalCta',
};

function isVisualContentTarget(target: VisualEditTargetId): target is VisualContentTargetId {
  return target in visualContentModuleKeys;
}

function HomepagePreview({
  previewDocument,
  config,
  updateConfig,
  uploadAsset,
  uploadFooterQr,
  selectedTarget,
  setSelectedTarget,
  onUnavailableTarget,
  goToTab,
  isBusy,
}: {
  previewDocument: string;
  config: HomepageBrandConfig;
  updateConfig: (updater: (draft: HomepageBrandConfig) => void) => void;
  uploadAsset: (kind: AssetKind, file: File | undefined) => void;
  uploadFooterQr: (target: FooterQrTarget, label: string, file: File | undefined) => void;
  selectedTarget: VisualEditTargetId | null;
  setSelectedTarget: (target: VisualEditTargetId) => void;
  onUnavailableTarget: () => void;
  goToTab: (tab: HomepageBrandTab) => void;
  isBusy: boolean;
}) {
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop');
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const selectedTargetMeta = selectedTarget ? visualTargetLabels[selectedTarget] : null;

  function scrollPreviewToTarget(target: VisualEditTargetId) {
    previewFrameRef.current?.contentWindow?.postMessage(
      { type: 'homepage-preview-scroll', target },
      '*',
    );
  }

  function selectTarget(target: VisualEditTargetId) {
    setSelectedTarget(target);
    scrollPreviewToTarget(target);
  }

  useEffect(() => {
    function handlePreviewMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'homepage-preview-target-unavailable') {
        onUnavailableTarget();
        return;
      }
      if (data.type !== 'homepage-preview-target') return;
      if (!visualEditTargets.includes(data.target)) return;
      setSelectedTarget(data.target);
    }

    window.addEventListener('message', handlePreviewMessage);
    return () => window.removeEventListener('message', handlePreviewMessage);
  }, [onUnavailableTarget, setSelectedTarget]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <article className={sectionShell}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-normal text-slate-950">真实首页草稿预览</h3>
            <p className="mt-1 text-sm text-slate-500">点击首页里的首屏、导航、Logo、背景图或页脚区块，可在右侧快速编辑对应字段。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-[#d8e2ee] bg-white p-1">
              {(['desktop', 'mobile'] as PreviewDevice[]).map((device) => (
                <button
                  key={device}
                  type="button"
                  onClick={() => setPreviewDevice(device)}
                  className={cn(
                    'inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-semibold transition',
                    previewDevice === device ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700',
                  )}
                >
                  {device === 'desktop' ? '桌面预览' : '移动端预览'}
                </button>
              ))}
            </div>
            <div className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {selectedTargetMeta ? `当前选中：${selectedTargetMeta.label}` : '点击预览区块开始编辑'}
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
          <p className="text-xs font-semibold text-blue-900">可编辑区块</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {visualEditTargets.map((target) => {
              const targetMeta = visualTargetLabels[target];
              const isActive = target === selectedTarget;
              return (
                <button
                  key={target}
                  type="button"
                  onClick={() => selectTarget(target)}
                  title={targetMeta.hint}
                  className={cn(
                    'inline-flex h-8 items-center justify-center rounded-full border px-3 text-xs font-semibold transition',
                    isActive
                      ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                      : 'border-blue-100 bg-white text-blue-700 hover:border-blue-300 hover:bg-blue-100',
                  )}
                >
                  {targetMeta.label}
                </button>
              );
            })}
          </div>
        </div>
        <div
          className={cn(
            'mt-5 max-h-[680px] overflow-auto rounded-xl border bg-slate-100 p-3 transition',
            selectedTarget ? 'border-blue-300 ring-2 ring-blue-100' : 'border-[#d8e2ee]',
          )}
        >
          <p className="mb-2 text-xs font-semibold text-slate-500">
            当前设备：{previewDevice === 'desktop' ? '桌面预览' : '移动端预览'}
          </p>
          <div
            aria-label="真实首页草稿预览"
            className={cn(
              'mx-auto overflow-hidden rounded-lg bg-white shadow-sm transition-all',
              previewDevice === 'mobile' ? 'w-[390px] max-w-full' : 'w-full',
            )}
          >
            <iframe
              ref={previewFrameRef}
              title="真实首页草稿预览画布"
              srcDoc={previewDocument}
              sandbox="allow-scripts"
              className={cn(
                'block border-0 bg-white transition',
                previewDevice === 'mobile' ? 'h-[2600px] w-[390px]' : 'h-[5200px] w-full',
              )}
            />
          </div>
        </div>
      </article>
      <VisualEditPanel
        config={config}
        selectedTarget={selectedTarget}
        updateConfig={updateConfig}
        uploadAsset={uploadAsset}
        uploadFooterQr={uploadFooterQr}
        goToTab={goToTab}
        isBusy={isBusy}
      />
    </div>
  );
}

function ContentModuleEditor({
  targetLabel,
  moduleKey,
  config,
  updateConfig,
}: {
  targetLabel: string;
  moduleKey: keyof HomepageBrandConfig['sections'];
  config: HomepageBrandConfig;
  updateConfig: (updater: (draft: HomepageBrandConfig) => void) => void;
}) {
  if (moduleKey === 'finalCta') {
    const section = config.sections.finalCta;

    return (
      <>
        <Field label={`可视化编辑模块标题：${targetLabel}`}>
          <input aria-label={`可视化编辑模块标题：${targetLabel}`} className={fieldShell} maxLength={36} value={section.title} onChange={(event) => updateConfig((draft) => { draft.sections.finalCta.title = event.target.value; })} />
        </Field>
        <Field label={`可视化编辑模块说明：${targetLabel}`}>
          <textarea aria-label={`可视化编辑模块说明：${targetLabel}`} className={cn(fieldShell, 'min-h-[80px] resize-none')} maxLength={160} value={section.description} onChange={(event) => updateConfig((draft) => { draft.sections.finalCta.description = event.target.value; })} />
        </Field>
        <Field label="可视化编辑转化按钮文字">
          <input aria-label="可视化编辑转化按钮文字" className={fieldShell} maxLength={24} value={section.action.label} onChange={(event) => updateConfig((draft) => { draft.sections.finalCta.action.label = event.target.value; })} />
        </Field>
        <Field label="可视化编辑转化按钮地址">
          <select aria-label="可视化编辑转化按钮地址" className={fieldShell} value={section.action.href} onChange={(event) => updateConfig((draft) => { draft.sections.finalCta.action.href = event.target.value; })}>
            {hrefOptions.map((href) => <option key={href} value={href}>{href}</option>)}
          </select>
        </Field>
      </>
    );
  }

  if (moduleKey === 'cases') {
    const section = config.sections.cases;

    return (
      <>
        <Field label={`可视化编辑模块标题：${targetLabel}`}>
          <input aria-label={`可视化编辑模块标题：${targetLabel}`} className={fieldShell} maxLength={36} value={section.title} onChange={(event) => updateConfig((draft) => { draft.sections.cases.title = event.target.value; })} />
        </Field>
        <Field label={`可视化编辑模块说明：${targetLabel}`}>
          <textarea aria-label={`可视化编辑模块说明：${targetLabel}`} className={cn(fieldShell, 'min-h-[80px] resize-none')} maxLength={160} value={section.description} onChange={(event) => updateConfig((draft) => { draft.sections.cases.description = event.target.value; })} />
        </Field>
        <Field label={`可视化编辑案例引用：${targetLabel}`}>
          <textarea aria-label={`可视化编辑案例引用：${targetLabel}`} className={cn(fieldShell, 'min-h-[90px] resize-none')} maxLength={180} value={section.quote} onChange={(event) => updateConfig((draft) => { draft.sections.cases.quote = event.target.value; })} />
        </Field>
        <Field label={`可视化编辑案例来源：${targetLabel}`}>
          <input aria-label={`可视化编辑案例来源：${targetLabel}`} className={fieldShell} maxLength={40} value={section.author} onChange={(event) => updateConfig((draft) => { draft.sections.cases.author = event.target.value; })} />
        </Field>
        {section.stats.map((stat, index) => {
          const valueLabel = index === 0 ? `可视化编辑首个指标数值：${targetLabel}` : `可视化编辑指标数值：${targetLabel} ${index + 1}`;
          const nameLabel = index === 0 ? `可视化编辑首个指标名称：${targetLabel}` : `可视化编辑指标名称：${targetLabel} ${index + 1}`;

          return (
            <div key={stat.id} className="grid gap-3 rounded-xl border border-[#e6edf5] bg-[#f8fafc] p-3">
              <Field label={valueLabel}>
                <input aria-label={valueLabel} className={fieldShell} maxLength={12} value={stat.value} onChange={(event) => updateConfig((draft) => { draft.sections.cases.stats[index].value = event.target.value; })} />
              </Field>
              <Field label={nameLabel}>
                <input aria-label={nameLabel} className={fieldShell} maxLength={24} value={stat.label} onChange={(event) => updateConfig((draft) => { draft.sections.cases.stats[index].label = event.target.value; })} />
              </Field>
            </div>
          );
        })}
      </>
    );
  }

  if (moduleKey === 'pricing') {
    const section = config.sections.pricing;

    return (
      <>
        <Field label={`可视化编辑模块标题：${targetLabel}`}>
          <input aria-label={`可视化编辑模块标题：${targetLabel}`} className={fieldShell} maxLength={36} value={section.title} onChange={(event) => updateConfig((draft) => { draft.sections.pricing.title = event.target.value; })} />
        </Field>
        <Field label={`可视化编辑模块说明：${targetLabel}`}>
          <textarea aria-label={`可视化编辑模块说明：${targetLabel}`} className={cn(fieldShell, 'min-h-[80px] resize-none')} maxLength={160} value={section.description} onChange={(event) => updateConfig((draft) => { draft.sections.pricing.description = event.target.value; })} />
        </Field>
        {section.plans.map((plan, index) => {
          const nameLabel = index === 0 ? `可视化编辑首个套餐名称：${targetLabel}` : `可视化编辑套餐名称：${targetLabel} ${index + 1}`;
          const priceLabel = index === 0 ? `可视化编辑首个套餐价格：${targetLabel}` : `可视化编辑套餐价格：${targetLabel} ${index + 1}`;

          return (
            <div key={plan.id} className="grid gap-3 rounded-xl border border-[#e6edf5] bg-[#f8fafc] p-3">
              <Field label={nameLabel}>
                <input aria-label={nameLabel} className={fieldShell} maxLength={24} value={plan.title} onChange={(event) => updateConfig((draft) => { draft.sections.pricing.plans[index].title = event.target.value; })} />
              </Field>
              <Field label={priceLabel}>
                <input aria-label={priceLabel} className={fieldShell} maxLength={16} value={plan.price} onChange={(event) => updateConfig((draft) => { draft.sections.pricing.plans[index].price = event.target.value; })} />
              </Field>
            </div>
          );
        })}
      </>
    );
  }

  const section = config.sections[moduleKey];

  return (
    <>
      <Field label={`可视化编辑模块标题：${targetLabel}`}>
        <input aria-label={`可视化编辑模块标题：${targetLabel}`} className={fieldShell} maxLength={36} value={section.title} onChange={(event) => updateConfig((draft) => { draft.sections[moduleKey].title = event.target.value; })} />
      </Field>
      <Field label={`可视化编辑模块说明：${targetLabel}`}>
        <textarea aria-label={`可视化编辑模块说明：${targetLabel}`} className={cn(fieldShell, 'min-h-[80px] resize-none')} maxLength={160} value={section.description} onChange={(event) => updateConfig((draft) => { draft.sections[moduleKey].description = event.target.value; })} />
      </Field>
      {section.cards.map((card, index) => {
        const iconLabel = index === 0 ? `可视化编辑首个卡片图标：${targetLabel}` : `可视化编辑卡片图标：${targetLabel} ${index + 1}`;
        const titleLabel = index === 0 ? `可视化编辑首个卡片标题：${targetLabel}` : `可视化编辑卡片标题：${targetLabel} ${index + 1}`;
        const descriptionLabel = index === 0 ? `可视化编辑首个卡片说明：${targetLabel}` : `可视化编辑卡片说明：${targetLabel} ${index + 1}`;

        return (
          <div key={card.id} className="grid gap-3 rounded-xl border border-[#e6edf5] bg-[#f8fafc] p-3">
            {'icon' in card ? (
              <Field label={iconLabel}>
                <input aria-label={iconLabel} className={fieldShell} maxLength={2} value={card.icon ?? ''} onChange={(event) => updateConfig((draft) => { draft.sections[moduleKey].cards[index].icon = event.target.value; })} />
              </Field>
            ) : null}
            <Field label={titleLabel}>
              <input aria-label={titleLabel} className={fieldShell} maxLength={28} value={card.title} onChange={(event) => updateConfig((draft) => { draft.sections[moduleKey].cards[index].title = event.target.value; })} />
            </Field>
            <Field label={descriptionLabel}>
              <textarea aria-label={descriptionLabel} className={cn(fieldShell, 'min-h-[74px] resize-none')} maxLength={140} value={card.description} onChange={(event) => updateConfig((draft) => { draft.sections[moduleKey].cards[index].description = event.target.value; })} />
            </Field>
          </div>
        );
      })}
    </>
  );
}

function VisualEditPanel({
  config,
  selectedTarget,
  updateConfig,
  uploadAsset,
  uploadFooterQr,
  goToTab,
  isBusy,
}: {
  config: HomepageBrandConfig;
  selectedTarget: VisualEditTargetId | null;
  updateConfig: (updater: (draft: HomepageBrandConfig) => void) => void;
  uploadAsset: (kind: AssetKind, file: File | undefined) => void;
  uploadFooterQr: (target: FooterQrTarget, label: string, file: File | undefined) => void;
  goToTab: (tab: HomepageBrandTab) => void;
  isBusy: boolean;
}) {
  if (!selectedTarget) {
    return (
      <aside className={cn(sectionShell, 'xl:sticky xl:top-4')} aria-label="可视化编辑面板">
        <h3 className="text-lg font-semibold tracking-normal text-slate-950">可视化编辑</h3>
        <p className="mt-3 text-sm leading-6 text-slate-500">点击左侧预览中的可编辑区块后，这里会显示对应字段。</p>
      </aside>
    );
  }

  const target = visualTargetLabels[selectedTarget];
  const contentModuleKey = isVisualContentTarget(selectedTarget) ? visualContentModuleKeys[selectedTarget] : null;

  return (
    <aside className={cn(sectionShell, 'xl:sticky xl:top-4')} aria-label="可视化编辑面板">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-normal text-slate-950">可视化编辑</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">草稿预览 / {target.label}</p>
          <p className="mt-1 text-sm font-semibold text-blue-700">正在编辑：{target.label}</p>
          <p className="mt-1 text-xs text-slate-500">{target.hint}</p>
        </div>
        <button
          type="button"
          onClick={() => goToTab(target.tab)}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
        >
          跳转到{target.tab}
        </button>
      </div>
      <div className="mt-5 grid gap-4">
        {selectedTarget === 'hero' ? (
          <>
            <Field label="可视化编辑主标题第一行">
              <input aria-label="可视化编辑主标题第一行" className={fieldShell} maxLength={18} value={config.hero.titleLine} onChange={(event) => updateConfig((draft) => { draft.hero.titleLine = event.target.value; })} />
            </Field>
            <Field label="可视化编辑主标题强调行">
              <input aria-label="可视化编辑主标题强调行" className={fieldShell} maxLength={18} value={config.hero.accentLine} onChange={(event) => updateConfig((draft) => { draft.hero.accentLine = event.target.value; })} />
            </Field>
            <Field label="可视化编辑首屏标签">
              <input aria-label="可视化编辑首屏标签" className={fieldShell} maxLength={40} value={config.hero.eyebrow} onChange={(event) => updateConfig((draft) => { draft.hero.eyebrow = event.target.value; })} />
            </Field>
            <Field label="可视化编辑首屏说明">
              <textarea aria-label="可视化编辑首屏说明" className={cn(fieldShell, 'min-h-[84px] resize-none')} maxLength={160} value={config.hero.description} onChange={(event) => updateConfig((draft) => { draft.hero.description = event.target.value; })} />
            </Field>
            <Field label="可视化编辑首屏补充说明">
              <textarea aria-label="可视化编辑首屏补充说明" className={cn(fieldShell, 'min-h-[72px] resize-none')} maxLength={120} value={config.hero.note} onChange={(event) => updateConfig((draft) => { draft.hero.note = event.target.value; })} />
            </Field>
          </>
        ) : null}
        {selectedTarget === 'heroPrimaryAction' ? (
          <>
            <Field label="可视化编辑主按钮文字">
              <input aria-label="可视化编辑主按钮文字" className={fieldShell} maxLength={24} value={config.hero.primaryAction.label} onChange={(event) => updateConfig((draft) => { draft.hero.primaryAction.label = event.target.value; })} />
            </Field>
            <Field label="可视化编辑主按钮地址">
              <select aria-label="可视化编辑主按钮地址" className={fieldShell} value={config.hero.primaryAction.href} onChange={(event) => updateConfig((draft) => { draft.hero.primaryAction.href = event.target.value; })}>
                {hrefOptions.map((href) => <option key={href} value={href}>{href}</option>)}
              </select>
            </Field>
            <Field label="可视化编辑辅助按钮文字">
              <input aria-label="可视化编辑辅助按钮文字" className={fieldShell} maxLength={24} value={config.hero.secondaryAction.label} onChange={(event) => updateConfig((draft) => { draft.hero.secondaryAction.label = event.target.value; })} />
            </Field>
            <Field label="可视化编辑辅助按钮地址">
              <select aria-label="可视化编辑辅助按钮地址" className={fieldShell} value={config.hero.secondaryAction.href} onChange={(event) => updateConfig((draft) => { draft.hero.secondaryAction.href = event.target.value; })}>
                {hrefOptions.map((href) => <option key={href} value={href}>{href}</option>)}
              </select>
            </Field>
          </>
        ) : null}
        {selectedTarget === 'navigation' ? (
          <>
            <div className="grid gap-3">
              {config.navigation.links.map((item, index) => (
                <div key={item.id} className="grid gap-2 rounded-xl border border-[#e6edf5] bg-[#f8fafc] p-3">
                  <Field label={`可视化编辑导航名称：${item.label}`}>
                    <input aria-label={`可视化编辑导航名称：${item.label}`} className={fieldShell} value={item.label} onChange={(event) => updateConfig((draft) => { draft.navigation.links[index].label = event.target.value; })} />
                  </Field>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <select aria-label={`可视化编辑导航地址：${item.label}`} className={fieldShell} value={item.href} onChange={(event) => updateConfig((draft) => { draft.navigation.links[index].href = event.target.value; })}>
                      {hrefOptions.filter((href) => href !== '/login').map((href) => <option key={href} value={href}>{href}</option>)}
                    </select>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                      <input type="checkbox" aria-label={`可视化编辑导航显示：${item.label}`} checked={item.visible} onChange={(event) => updateConfig((draft) => { draft.navigation.links[index].visible = event.target.checked; })} />
                      {item.visible ? '显示' : '隐藏'}
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <Field label="可视化编辑导航主按钮文字">
              <input aria-label="可视化编辑导航主按钮文字" className={fieldShell} value={config.navigation.cta.label} onChange={(event) => updateConfig((draft) => { draft.navigation.cta.label = event.target.value; })} />
            </Field>
            <Field label="可视化编辑导航主按钮地址">
              <select aria-label="可视化编辑导航主按钮地址" className={fieldShell} value={config.navigation.cta.href} onChange={(event) => updateConfig((draft) => { draft.navigation.cta.href = event.target.value; })}>
                {hrefOptions.map((href) => <option key={href} value={href}>{href}</option>)}
              </select>
            </Field>
          </>
        ) : null}
        {selectedTarget === 'brand' ? (
          <>
            <Field label="可视化编辑平台名称">
              <input aria-label="可视化编辑平台名称" className={fieldShell} maxLength={20} value={config.brand.platformName} onChange={(event) => updateConfig((draft) => { draft.brand.platformName = event.target.value; })} />
            </Field>
            <Field label="可视化编辑后台名称">
              <input aria-label="可视化编辑后台名称" className={fieldShell} maxLength={24} value={config.brand.consoleName} onChange={(event) => updateConfig((draft) => { draft.brand.consoleName = event.target.value; })} />
            </Field>
            <Field label="可视化编辑品牌副标题">
              <input aria-label="可视化编辑品牌副标题" className={fieldShell} maxLength={16} value={config.brand.subtitle} onChange={(event) => updateConfig((draft) => { draft.brand.subtitle = event.target.value; })} />
            </Field>
            <Field label="可视化编辑横版标识地址">
              <input aria-label="可视化编辑横版标识地址" className={fieldShell} value={config.assets.horizontalLogoUrl} onChange={(event) => updateConfig((draft) => { draft.assets.horizontalLogoUrl = event.target.value; })} />
            </Field>
            <VisualUploadInput
              label="上传横版标识"
              ariaLabel="上传可视化编辑横版标识"
              disabled={isBusy}
              onUpload={(file) => uploadAsset('logo', file)}
            />
            <Field label="可视化编辑夜间标识地址">
              <input aria-label="可视化编辑夜间标识地址" className={fieldShell} value={config.assets.horizontalLogoNightUrl} onChange={(event) => updateConfig((draft) => { draft.assets.horizontalLogoNightUrl = event.target.value; })} />
            </Field>
            <VisualUploadInput
              label="上传夜间标识"
              ariaLabel="上传可视化编辑夜间标识"
              disabled={isBusy}
              onUpload={(file) => uploadAsset('night_logo', file)}
            />
            <Field label="可视化编辑图形标识地址">
              <input aria-label="可视化编辑图形标识地址" className={fieldShell} value={config.assets.markLogoUrl} onChange={(event) => updateConfig((draft) => { draft.assets.markLogoUrl = event.target.value; })} />
            </Field>
            <VisualUploadInput
              label="上传图形标识"
              ariaLabel="上传可视化编辑图形标识"
              disabled={isBusy}
              onUpload={(file) => uploadAsset('mark_logo', file)}
            />
          </>
        ) : null}
        {selectedTarget === 'heroImage' ? (
          <>
            <Field label="可视化编辑首页背景图地址">
              <input aria-label="可视化编辑首页背景图地址" className={fieldShell} value={config.assets.heroBackgroundUrl} onChange={(event) => updateConfig((draft) => { draft.assets.heroBackgroundUrl = event.target.value; })} />
            </Field>
            <VisualUploadInput
              label="上传首页背景图"
              ariaLabel="上传可视化编辑首页背景图"
              disabled={isBusy}
              onUpload={(file) => uploadAsset('hero_background', file)}
            />
            <Field label="可视化编辑分享封面图地址">
              <input aria-label="可视化编辑分享封面图地址" className={fieldShell} value={config.assets.shareImageUrl} onChange={(event) => updateConfig((draft) => { draft.assets.shareImageUrl = event.target.value; })} />
            </Field>
            <VisualUploadInput
              label="上传分享封面图"
              ariaLabel="上传可视化编辑分享封面图"
              disabled={isBusy}
              onUpload={(file) => uploadAsset('share_image', file)}
            />
          </>
        ) : null}
        {selectedTarget === 'metricConversionRate' ? (
          <>
            <div className="grid gap-3">
              {config.metrics.map((metric, index) => (
                <div key={metric.id} className="grid gap-2 rounded-xl border border-[#e6edf5] bg-[#f8fafc] p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label={`可视化编辑指标数值：${metric.label}`}>
                      <input aria-label={`可视化编辑指标数值：${metric.label}`} className={fieldShell} maxLength={12} value={metric.value} onChange={(event) => updateConfig((draft) => { draft.metrics[index].value = event.target.value; })} />
                    </Field>
                    <Field label={`可视化编辑指标名称：${metric.label}`}>
                      <input aria-label={`可视化编辑指标名称：${metric.label}`} className={fieldShell} maxLength={24} value={metric.label} onChange={(event) => updateConfig((draft) => { draft.metrics[index].label = event.target.value; })} />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <input type="checkbox" aria-label={`可视化编辑指标显示：${metric.label}`} checked={metric.visible} onChange={(event) => updateConfig((draft) => { draft.metrics[index].visible = event.target.checked; })} />
                    {metric.visible ? '显示' : '隐藏'}
                  </label>
                </div>
              ))}
            </div>
            <Field label="可视化编辑增长卡标题">
              <input aria-label="可视化编辑增长卡标题" className={fieldShell} maxLength={24} value={config.growthCard.title} onChange={(event) => updateConfig((draft) => { draft.growthCard.title = event.target.value; })} />
            </Field>
            <Field label="可视化编辑增长卡副标题">
              <input aria-label="可视化编辑增长卡副标题" className={fieldShell} maxLength={36} value={config.growthCard.subtitle} onChange={(event) => updateConfig((draft) => { draft.growthCard.subtitle = event.target.value; })} />
            </Field>
            <Field label="可视化编辑增长卡状态">
              <input aria-label="可视化编辑增长卡状态" className={fieldShell} maxLength={12} value={config.growthCard.badge} onChange={(event) => updateConfig((draft) => { draft.growthCard.badge = event.target.value; })} />
            </Field>
            <Field label="可视化编辑下一步建议标题">
              <input aria-label="可视化编辑下一步建议标题" className={fieldShell} maxLength={36} value={config.growthCard.insight.title} onChange={(event) => updateConfig((draft) => { draft.growthCard.insight.title = event.target.value; })} />
            </Field>
          </>
        ) : null}
        {contentModuleKey ? (
          <>
            <ContentModuleEditor
              targetLabel={target.label}
              moduleKey={contentModuleKey}
              config={config}
              updateConfig={updateConfig}
            />
            <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-4">
            <p className="text-sm font-semibold text-blue-900">该区块属于官网结构化内容模块</p>
            <p className="mt-2 text-sm leading-6 text-blue-700">
              已接入草稿预览点击定位、字段编辑和实时预览；更多卡片和列表项可在后续继续展开为批量编辑。
            </p>
            <div className="mt-3 rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-semibold text-blue-700">
              当前区块：{target.label} · {target.hint}
            </div>
            </div>
          </>
        ) : null}
        {selectedTarget === 'footer' ? (
          <>
            <Field label="可视化编辑公司名称">
              <input aria-label="可视化编辑公司名称" className={fieldShell} maxLength={40} value={config.footer.companyName} onChange={(event) => updateConfig((draft) => { draft.footer.companyName = event.target.value; })} />
            </Field>
            <Field label="可视化编辑联系电话">
              <input aria-label="可视化编辑联系电话" className={fieldShell} maxLength={24} value={config.footer.phone} onChange={(event) => updateConfig((draft) => { draft.footer.phone = event.target.value; })} />
            </Field>
            <Field label="可视化编辑邮箱地址">
              <input aria-label="可视化编辑邮箱地址" className={fieldShell} maxLength={60} value={config.footer.email} onChange={(event) => updateConfig((draft) => { draft.footer.email = event.target.value; })} />
            </Field>
            <Field label="可视化编辑ICP备案号">
              <input aria-label="可视化编辑ICP备案号" className={fieldShell} maxLength={40} value={config.footer.icpNumber} onChange={(event) => updateConfig((draft) => { draft.footer.icpNumber = event.target.value; })} />
            </Field>
            <Field label="可视化编辑ICP备案链接">
              <input aria-label="可视化编辑ICP备案链接" className={fieldShell} maxLength={120} value={config.footer.icpUrl} onChange={(event) => updateConfig((draft) => { draft.footer.icpUrl = event.target.value; })} />
            </Field>
            <Field label="可视化编辑公安网警备案号">
              <input aria-label="可视化编辑公安网警备案号" className={fieldShell} maxLength={50} value={config.footer.policeNumber} onChange={(event) => updateConfig((draft) => { draft.footer.policeNumber = event.target.value; })} />
            </Field>
            <Field label="可视化编辑公安网警备案链接">
              <input aria-label="可视化编辑公安网警备案链接" className={fieldShell} maxLength={120} value={config.footer.policeUrl} onChange={(event) => updateConfig((draft) => { draft.footer.policeUrl = event.target.value; })} />
            </Field>
          </>
        ) : null}
        {selectedTarget === 'wechatQr' ? (
          <>
            <Field label="可视化编辑公众号二维码地址">
              <input aria-label="可视化编辑公众号二维码地址" className={fieldShell} value={config.footer.wechatQrUrl} onChange={(event) => updateConfig((draft) => { draft.footer.wechatQrUrl = event.target.value; })} />
            </Field>
            <VisualUploadInput
              label="上传公众号二维码"
              ariaLabel="上传可视化编辑公众号二维码"
              disabled={isBusy}
              onUpload={(file) => uploadFooterQr('wechatQrUrl', '公众号二维码', file)}
            />
            <button
              type="button"
              onClick={() => updateConfig((draft) => { draft.footer.wechatQrUrl = ''; })}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-[#d8e2ee] bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
            >
              移除公众号二维码
            </button>
          </>
        ) : null}
        {selectedTarget === 'miniProgramQr' ? (
          <>
            <Field label="可视化编辑小程序二维码地址">
              <input aria-label="可视化编辑小程序二维码地址" className={fieldShell} value={config.footer.miniProgramQrUrl} onChange={(event) => updateConfig((draft) => { draft.footer.miniProgramQrUrl = event.target.value; })} />
            </Field>
            <VisualUploadInput
              label="上传小程序二维码"
              ariaLabel="上传可视化编辑小程序二维码"
              disabled={isBusy}
              onUpload={(file) => uploadFooterQr('miniProgramQrUrl', '小程序二维码', file)}
            />
            <button
              type="button"
              onClick={() => updateConfig((draft) => { draft.footer.miniProgramQrUrl = ''; })}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-[#d8e2ee] bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
            >
              移除小程序二维码
            </button>
          </>
        ) : null}
      </div>
    </aside>
  );
}

function VisualUploadInput({
  label,
  ariaLabel,
  disabled,
  onUpload,
}: {
  label: string;
  ariaLabel: string;
  disabled: boolean;
  onUpload: (file: File | undefined) => void;
}) {
  return (
    <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
      <Upload className="h-4 w-4" />
      {label}
      <input
        aria-label={ariaLabel}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={disabled}
        className="sr-only"
        onChange={(event) => onUpload(event.target.files?.[0])}
      />
    </label>
  );
}
