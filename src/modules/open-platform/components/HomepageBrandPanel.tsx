'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FileImage,
  History,
  Megaphone,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react';

import { buildMarketingHomeMarkup } from '@/modules/marketing/components/MarketingHome';
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

const tabs = ['品牌概览', '首页首屏', '顶部导航', '登录页管理', '素材上传', '发布回滚', '审计记录', '草稿预览'] as const;
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

type AssetKind = 'logo' | 'night_logo' | 'mark_logo' | 'hero_background' | 'share_image';

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

function responseError() {
  return new Error('首页与品牌接口暂时不可用');
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw responseError();
  return response.json() as Promise<T>;
}

export function HomepageBrandPanel() {
  const [activeTab, setActiveTab] = useState<HomepageBrandTab>('品牌概览');
  const [config, setConfig] = useState<HomepageBrandConfig>(() => cloneHomepageBrandConfig(defaultHomepageBrandConfig));
  const [versions, setVersions] = useState<HomepageBrandVersionDto[]>([]);
  const [assets, setAssets] = useState<HomepageBrandAssetDto[]>([]);
  const [auditLogs, setAuditLogs] = useState<HomepageBrandAuditLogDto[]>([]);
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [publishSummary, setPublishSummary] = useState('');

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
      } catch {
        if (!ignore) setMessage('');
      }
    }

    void loadView();
    return () => {
      ignore = true;
    };
  }, []);

  const validationErrors = useMemo(() => validateHomepageBrandConfig(config), [config]);
  const visibleNavCount = config.navigation.links.filter((item) => item.visible).length;
  const previewMarkup = useMemo(() => buildMarketingHomeMarkup(config), [config]);

  function updateConfig(updater: (draft: HomepageBrandConfig) => void) {
    setConfig((current) => {
      const next = cloneHomepageBrandConfig(current);
      updater(next);
      return next;
    });
    setMessage('草稿已修改，尚未保存');
  }

  async function publishConfig() {
    if (validationErrors.length > 0) {
      setMessage('字段校验失败，请先修正后再发布');
      return;
    }

    setIsBusy(true);
    try {
      const result = await readJson<{ status: string; version: HomepageBrandVersionDto }>(await fetch(`${apiBase}/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ summary: publishSummary || '发布首页与品牌配置' }),
      }));
      setVersions((current) => [result.version, ...current.filter((item) => item.id !== result.version.id)]);
      setMessage(`已发布版本 ${result.version.versionNumber}`);
    } catch {
      setMessage('发布失败');
    } finally {
      setIsBusy(false);
    }
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
      setMessage(`已回滚并生成版本 ${result.version.versionNumber}`);
    } catch {
      setMessage('回滚失败');
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
    } catch {
      setMessage('素材上传失败');
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

      {activeTab === '品牌概览' ? <BrandOverview config={config} updateConfig={updateConfig} /> : null}
      {activeTab === '首页首屏' ? <HeroEditor config={config} updateConfig={updateConfig} validationErrors={validationErrors} /> : null}
      {activeTab === '顶部导航' ? <NavigationEditor config={config} updateConfig={updateConfig} visibleNavCount={visibleNavCount} /> : null}
      {activeTab === '登录页管理' ? <LoginPageEditor config={config} updateConfig={updateConfig} /> : null}
      {activeTab === '素材上传' ? <AssetUploader config={config} assets={assets} uploadAsset={uploadAsset} /> : null}
      {activeTab === '发布回滚' ? (
        <PublishRollback
          versions={versions}
          publishSummary={publishSummary}
          setPublishSummary={setPublishSummary}
          publishConfig={publishConfig}
          rollbackToVersion={rollbackToVersion}
          isBusy={isBusy}
        />
      ) : null}
      {activeTab === '审计记录' ? <AuditLogList auditLogs={auditLogs} /> : null}
      {activeTab === '草稿预览' ? <HomepagePreview markup={previewMarkup} /> : null}
    </section>
  );
}

function BrandOverview({
  config,
  updateConfig,
}: {
  config: HomepageBrandConfig;
  updateConfig: (updater: (draft: HomepageBrandConfig) => void) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.74fr)_minmax(0,1.26fr)]">
      <article className={sectionShell}>
        <h3 className="text-lg font-semibold tracking-normal text-slate-950">品牌文字</h3>
        <div className="mt-5 grid gap-4">
          <Field label="平台名称" hint="最多20字">
            <input aria-label="平台名称" className={fieldShell} maxLength={20} value={config.brand.platformName} onChange={(event) => updateConfig((draft) => { draft.brand.platformName = event.target.value; })} />
          </Field>
          <Field label="后台名称" hint="最多24字">
            <input aria-label="后台名称" className={fieldShell} maxLength={24} value={config.brand.consoleName} onChange={(event) => updateConfig((draft) => { draft.brand.consoleName = event.target.value; })} />
          </Field>
          <Field label="品牌副标题" hint="最多16字">
            <input aria-label="品牌副标题" className={fieldShell} maxLength={16} value={config.brand.subtitle} onChange={(event) => updateConfig((draft) => { draft.brand.subtitle = event.target.value; })} />
          </Field>
        </div>
      </article>

      <article className={sectionShell} aria-label="页面基础信息">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold tracking-normal text-slate-950">页面基础信息</h3>
          <p className="text-sm leading-6 text-slate-500">集中管理首页浏览器信息、SEO、页脚合规和二维码展示。</p>
        </div>
        <div className="mt-5 grid gap-5">
          <div className="grid gap-4 rounded-xl border border-[#e6edf5] bg-[#f8fafc] p-4 md:grid-cols-2">
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

          <div className="grid gap-4 rounded-xl border border-[#e6edf5] bg-white p-4 md:grid-cols-2">
            <h4 className="text-sm font-semibold text-slate-950 md:col-span-2">SEO 信息</h4>
            <Field label="SEO标题" hint="建议 20-60 字">
              <input aria-label="SEO标题" className={fieldShell} maxLength={80} value={config.metadata.seoTitle} onChange={(event) => updateConfig((draft) => { draft.metadata.seoTitle = event.target.value; })} />
            </Field>
            <Field label="SEO关键词" hint="用英文逗号分隔">
              <input aria-label="SEO关键词" className={fieldShell} maxLength={160} value={config.metadata.seoKeywords} onChange={(event) => updateConfig((draft) => { draft.metadata.seoKeywords = event.target.value; })} />
            </Field>
            <Field label="SEO描述" hint="最多180字">
              <textarea aria-label="SEO描述" className={cn(fieldShell, 'min-h-[84px] resize-none')} maxLength={180} value={config.metadata.seoDescription} onChange={(event) => updateConfig((draft) => { draft.metadata.seoDescription = event.target.value; })} />
            </Field>
          </div>

          <div className="grid gap-4 rounded-xl border border-[#e6edf5] bg-white p-4 md:grid-cols-2">
            <h4 className="text-sm font-semibold text-slate-950 md:col-span-2">页脚与合规信息</h4>
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
            <Field label="公安网警备案链接">
              <input aria-label="公安网警备案链接" className={fieldShell} maxLength={120} value={config.footer.policeUrl} onChange={(event) => updateConfig((draft) => { draft.footer.policeUrl = event.target.value; })} />
            </Field>
          </div>

          <div className="grid gap-4 rounded-xl border border-[#e6edf5] bg-white p-4 md:grid-cols-2">
            <h4 className="text-sm font-semibold text-slate-950 md:col-span-2">二维码展示</h4>
            <Field label="公众号二维码地址" hint="本轮使用图片地址">
              <input aria-label="公众号二维码地址" className={fieldShell} maxLength={180} value={config.footer.wechatQrUrl} onChange={(event) => updateConfig((draft) => { draft.footer.wechatQrUrl = event.target.value; })} />
            </Field>
            <Field label="小程序二维码地址" hint="本轮使用图片地址">
              <input aria-label="小程序二维码地址" className={fieldShell} maxLength={180} value={config.footer.miniProgramQrUrl} onChange={(event) => updateConfig((draft) => { draft.footer.miniProgramQrUrl = event.target.value; })} />
            </Field>
            <QrPreview label="公众号二维码" src={config.footer.wechatQrUrl} />
            <QrPreview label="小程序二维码" src={config.footer.miniProgramQrUrl} />
          </div>
        </div>
      </article>
    </div>
  );
}

function QrPreview({ label, src }: { label: string; src: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#e6edf5] bg-[#f8fafc] p-3">
      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#e6edf5] bg-white">
        {src ? <img src={src} alt={`${label}预览`} className="h-full w-full object-cover" /> : <span className="text-xs text-slate-400">暂无</span>}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <div className="mt-1 truncate text-xs text-slate-500">{src || '未配置'}</div>
      </div>
    </div>
  );
}

function HeroEditor({
  config,
  updateConfig,
  validationErrors,
}: {
  config: HomepageBrandConfig;
  updateConfig: (updater: (draft: HomepageBrandConfig) => void) => void;
  validationErrors: string[];
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <article className={sectionShell}>
        <h3 className="text-lg font-semibold tracking-normal text-slate-950">首屏文案与按钮</h3>
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
}: {
  config: HomepageBrandConfig;
  updateConfig: (updater: (draft: HomepageBrandConfig) => void) => void;
  visibleNavCount: number;
}) {
  return (
    <article className={sectionShell} aria-label="顶部导航配置">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-normal text-slate-950">导航列表</h3>
          <p className="mt-1 text-sm text-slate-500">导航保持固定数量，只允许修改名称、跳转位置和显示状态。</p>
        </div>
        <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">当前显示 {visibleNavCount} 项</span>
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
}: {
  config: HomepageBrandConfig;
  updateConfig: (updater: (draft: HomepageBrandConfig) => void) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <article className={sectionShell}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold tracking-normal text-slate-950">机构登录页</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">管理机构工作台登录页的公开品牌文案，不管理账号、密码和认证策略。</p>
          </div>
          <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            /login
          </span>
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
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
            /platform-login
          </span>
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
    </div>
  );
}

function PublishRollback({
  versions,
  publishSummary,
  setPublishSummary,
  publishConfig,
  rollbackToVersion,
  isBusy,
}: {
  versions: HomepageBrandVersionDto[];
  publishSummary: string;
  setPublishSummary: (value: string) => void;
  publishConfig: () => void;
  rollbackToVersion: (versionId: string) => void;
  isBusy: boolean;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <article className={sectionShell}>
        <h3 className="text-lg font-semibold tracking-normal text-slate-950">发布控制</h3>
        <div className="mt-5 grid gap-4">
          <Field label="发布说明" hint="会写入版本摘要">
            <textarea aria-label="发布说明" className={cn(fieldShell, 'min-h-[96px] resize-none')} value={publishSummary} onChange={(event) => setPublishSummary(event.target.value)} />
          </Field>
          <button type="button" disabled={isBusy} onClick={publishConfig} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">
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
              <button type="button" disabled={isBusy} onClick={() => rollbackToVersion(version.id)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#d8e2ee] bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 disabled:opacity-60">
                <RotateCcw className="h-3.5 w-3.5" />
                回滚到版本 {version.versionNumber}
              </button>
            </div>
          ))}
        </div>
      </article>
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

function HomepagePreview({ markup }: { markup: string }) {
  return (
    <article className={sectionShell}>
      <h3 className="text-lg font-semibold tracking-normal text-slate-950">真实首页草稿预览</h3>
      <div className="mt-5 max-h-[680px] overflow-auto rounded-xl border border-[#d8e2ee] bg-white">
        <div aria-label="真实首页草稿预览" dangerouslySetInnerHTML={{ __html: markup }} />
      </div>
    </article>
  );
}
