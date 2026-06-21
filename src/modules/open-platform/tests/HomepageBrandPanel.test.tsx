import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildMarketingHomeMarkup } from '@/modules/marketing/components/MarketingHome';
import {
  cloneHomepageBrandConfig,
  defaultHomepageBrandConfig,
} from '@/modules/marketing/domain/homepageBrandConfig';
import { HomepageBrandPanel } from '@/modules/open-platform/components/HomepageBrandPanel';

const systemAssets = [
  {
    id: 'homepage-brand-system-asset-logo',
    kind: 'logo',
    originalFilename: '横版标识（系统同步）',
    mimeType: 'image/png',
    sizeBytes: 0,
    publicUrl: defaultHomepageBrandConfig.assets.horizontalLogoUrl,
    uploadedBy: 'system_sync',
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
  },
  {
    id: 'homepage-brand-system-asset-night-logo',
    kind: 'night_logo',
    originalFilename: '夜间横版标识（系统同步）',
    mimeType: 'image/png',
    sizeBytes: 0,
    publicUrl: defaultHomepageBrandConfig.assets.horizontalLogoNightUrl,
    uploadedBy: 'system_sync',
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
  },
  {
    id: 'homepage-brand-system-asset-mark-logo',
    kind: 'mark_logo',
    originalFilename: '图形标识（系统同步）',
    mimeType: 'image/png',
    sizeBytes: 0,
    publicUrl: defaultHomepageBrandConfig.assets.markLogoUrl,
    uploadedBy: 'system_sync',
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
  },
  {
    id: 'homepage-brand-system-asset-hero-background',
    kind: 'hero_background',
    originalFilename: '首页背景图（系统同步）',
    mimeType: 'image/png',
    sizeBytes: 0,
    publicUrl: defaultHomepageBrandConfig.assets.heroBackgroundUrl,
    uploadedBy: 'system_sync',
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
  },
  {
    id: 'homepage-brand-system-asset-share-image',
    kind: 'share_image',
    originalFilename: '分享封面图（系统同步）',
    mimeType: 'image/png',
    sizeBytes: 0,
    publicUrl: defaultHomepageBrandConfig.assets.shareImageUrl,
    uploadedBy: 'system_sync',
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
  },
];

const baseView = {
  config: defaultHomepageBrandConfig,
  status: 'draft',
  publishedVersionId: null,
  publishedAt: null,
  versions: [
    {
      id: 'version-a',
      configId: 'homepage-brand-default',
      versionNumber: 1,
      config: defaultHomepageBrandConfig,
      summary: '首版发布',
      publishedBy: 'platform-user',
      publishedAt: '2026-06-20T08:00:00.000Z',
      createdAt: '2026-06-20T08:00:00.000Z',
      updatedAt: '2026-06-20T08:00:00.000Z',
    },
  ],
  assets: systemAssets,
  auditLogs: [
    {
      id: 'audit-a',
      action: 'publish',
      configId: 'homepage-brand-default',
      versionId: 'version-a',
      assetId: null,
      actorId: 'platform-user',
      summary: '发布首页与品牌配置',
      metadata: {},
      createdAt: '2026-06-20T08:00:00.000Z',
    },
  ],
};

function createFetchMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (url.endsWith('/api/v1/open-platform/homepage-brand') && method === 'GET') {
      return Response.json(baseView);
    }

    if (url.endsWith('/api/v1/open-platform/homepage-brand/draft') && method === 'PUT') {
      return Response.json({ status: 'saved', config: JSON.parse(String(init?.body)).config });
    }

    if (url.endsWith('/api/v1/open-platform/homepage-brand/publish') && method === 'POST') {
      return Response.json({
        status: 'published',
        version: { ...baseView.versions[0], id: 'version-b', versionNumber: 2, summary: '发布首页新版' },
      });
    }

    if (url.endsWith('/api/v1/open-platform/homepage-brand/rollback') && method === 'POST') {
      return Response.json({
        status: 'rolled_back',
        config: defaultHomepageBrandConfig,
        version: { ...baseView.versions[0], id: 'version-rollback', versionNumber: 3, summary: '回滚到首版' },
      });
    }

    if (url.endsWith('/api/v1/open-platform/homepage-brand/assets') && method === 'POST') {
      return Response.json({
        status: 'uploaded',
        asset: {
          id: 'asset-logo-a',
          kind: 'logo',
          originalFilename: '品牌.png',
          mimeType: 'image/png',
          sizeBytes: 9,
          publicUrl: '/uploads/homepage-brand/logo/asset-logo-a.png',
          uploadedBy: 'platform-user',
          createdAt: '2026-06-20T08:00:00.000Z',
          updatedAt: '2026-06-20T08:00:00.000Z',
        },
      });
    }

    return Response.json({ ok: false, errorCode: 'UNEXPECTED_TEST_REQUEST' }, { status: 500 });
  });
}

function normalizeMarkup(markup: string) {
  const container = document.createElement('div');
  container.innerHTML = markup;
  return container.innerHTML;
}

describe('首页与品牌面板', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', createFetchMock());
  });

  it('渲染真实闭环栏目，不显示阶段和技术状态提示', async () => {
    render(<HomepageBrandPanel />);

    const heading = await screen.findByRole('heading', { name: '首页与品牌' });
    expect(heading).toBeInTheDocument();
    const banner = heading.closest('[data-platform-banner="true"]');
    expect(banner).toHaveClass('rounded-xl', 'py-4', 'lg:py-5');
    expect(heading).toHaveClass('text-2xl', 'sm:text-[28px]');
    expect(screen.queryByText('第二阶段')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '品牌概览' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '首页首屏' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '顶部导航' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '素材上传' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '发布回滚' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '审计记录' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '草稿预览' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '登录页管理' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: '保存草稿' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '发布首页' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '查看草稿预览' })).not.toBeInTheDocument();
    expect(screen.queryByText('配置状态')).not.toBeInTheDocument();
    expect(screen.queryByText('版本数量')).not.toBeInTheDocument();
    expect(screen.queryByText('素材数量')).not.toBeInTheDocument();
    expect(screen.queryByText('当前消息')).not.toBeInTheDocument();
    expect(screen.queryByText('配置加载失败，当前显示默认配置')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('临时草稿');
    expect(document.body.textContent).not.toContain('不会持久化');
  });

  it('配置接口加载失败时不展示默认配置技术提示', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: false }, { status: 500 })));

    render(<HomepageBrandPanel />);

    expect(await screen.findByRole('heading', { name: '首页与品牌' })).toBeInTheDocument();
    expect(screen.queryByText('配置加载失败，当前显示默认配置')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('配置加载失败');
    expect(document.body.textContent).not.toContain('当前显示默认配置');
  });

  it('素材上传使用文件输入并调用上传 API', async () => {
    const fetchMock = vi.mocked(fetch);
    render(<HomepageBrandPanel />);

    fireEvent.click(await screen.findByRole('tab', { name: '素材上传' }));
    const displaySection = screen.getByLabelText('当前品牌素材展示');
    expect(within(displaySection).getByRole('heading', { name: '当前素材展示' })).toBeInTheDocument();
    expect(within(displaySection).getByRole('img', { name: '横版标识预览' })).toHaveAttribute(
      'src',
      defaultHomepageBrandConfig.assets.horizontalLogoUrl,
    );
    expect(within(displaySection).getByRole('img', { name: '夜间横版标识预览' })).toHaveAttribute(
      'src',
      defaultHomepageBrandConfig.assets.horizontalLogoNightUrl,
    );
    expect(within(displaySection).getByRole('img', { name: '图形标识预览' })).toHaveAttribute(
      'src',
      defaultHomepageBrandConfig.assets.markLogoUrl,
    );
    expect(within(displaySection).getByRole('img', { name: '首页背景图预览' })).toHaveAttribute(
      'src',
      defaultHomepageBrandConfig.assets.heroBackgroundUrl,
    );
    expect(within(displaySection).getByRole('img', { name: '分享封面图预览' })).toHaveAttribute(
      'src',
      defaultHomepageBrandConfig.assets.shareImageUrl,
    );

    const uploadSection = screen.getByLabelText('品牌素材上传替换');
    expect(within(uploadSection).getByRole('heading', { name: '上传替换' })).toBeInTheDocument();
    const fileInput = within(uploadSection).getByLabelText('上传横版标识');
    fireEvent.change(fileInput, {
      target: { files: [new File([new TextEncoder().encode('png bytes')], '品牌.png', { type: 'image/png' })] },
    });

    await screen.findByText('素材已上传');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/open-platform/homepage-brand/assets',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
  });

  it('发布和回滚都调用对应 API 并显示版本结果', async () => {
    const fetchMock = vi.mocked(fetch);
    render(<HomepageBrandPanel />);

    fireEvent.click(await screen.findByRole('tab', { name: '发布回滚' }));
    fireEvent.change(screen.getByLabelText('发布说明'), { target: { value: '发布首页新版' } });
    fireEvent.click(screen.getByRole('button', { name: '确认发布' }));
    expect(await screen.findByText('已发布版本 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '回滚到版本 1' }));
    expect(await screen.findByText('已回滚并生成版本 3')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/open-platform/homepage-brand/publish',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/open-platform/homepage-brand/rollback',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('草稿预览使用真实首页同一套渲染输出', async () => {
    const expectedConfig = cloneHomepageBrandConfig(defaultHomepageBrandConfig);
    expectedConfig.hero.titleLine = '预览一致';
    render(<HomepageBrandPanel />);

    fireEvent.click(await screen.findByRole('tab', { name: '首页首屏' }));
    fireEvent.change(screen.getByLabelText('主标题第一行'), { target: { value: '预览一致' } });
    fireEvent.click(screen.getByRole('tab', { name: '草稿预览' }));

    const preview = screen.getByLabelText('真实首页草稿预览');
    expect(preview.innerHTML).toContain('预览一致');
    expect(preview.innerHTML).toBe(normalizeMarkup(buildMarketingHomeMarkup(expectedConfig)));
  });

  it('登录页管理可以编辑机构和平台登录页低敏文案', async () => {
    render(<HomepageBrandPanel />);

    fireEvent.click(await screen.findByRole('tab', { name: '登录页管理' }));
    expect(screen.getByRole('heading', { name: '机构登录页' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '平台登录页' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('机构登录主标题'), { target: { value: '机构入口新版' } });
    fireEvent.change(screen.getByLabelText('平台登录按钮文字'), { target: { value: '安全进入平台' } });

    expect(screen.getByDisplayValue('机构入口新版')).toBeInTheDocument();
    expect(screen.getByDisplayValue('安全进入平台')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('admin123');
    expect(document.body.textContent).not.toContain('secret');
  });

  it('品牌概览将品牌和页面基础信息合并，并把 SEO 与页脚合规拆成独立卡片', async () => {
    render(<HomepageBrandPanel />);

    await screen.findByRole('heading', { name: '首页与品牌' });
    const brandAndBasicInfo = screen.getByRole('article', { name: '品牌与页面基础信息' });
    expect(within(brandAndBasicInfo).getByRole('heading', { name: '品牌文字' })).toBeInTheDocument();
    expect(within(brandAndBasicInfo).getByRole('heading', { name: '页面展示信息' })).toBeInTheDocument();
    expect(within(brandAndBasicInfo).getByLabelText('平台名称')).toBeInTheDocument();
    expect(within(brandAndBasicInfo).getByLabelText('后台名称')).toBeInTheDocument();
    expect(within(brandAndBasicInfo).getByLabelText('品牌副标题')).toBeInTheDocument();
    expect(within(brandAndBasicInfo).getByLabelText('首页浏览器标题')).toBeInTheDocument();
    expect(within(brandAndBasicInfo).getByLabelText('首页描述')).toBeInTheDocument();
    expect(within(brandAndBasicInfo).getByLabelText('分享标题')).toBeInTheDocument();
    expect(within(brandAndBasicInfo).getByLabelText('分享描述')).toBeInTheDocument();
    expect(within(brandAndBasicInfo).queryByLabelText('SEO标题')).not.toBeInTheDocument();

    const seoInfo = screen.getByRole('article', { name: 'SEO 信息' });
    expect(within(seoInfo).getByLabelText('SEO标题')).toBeInTheDocument();
    expect(within(seoInfo).getByLabelText('SEO关键词')).toBeInTheDocument();
    expect(within(seoInfo).getByLabelText('SEO描述')).toBeInTheDocument();

    const footerInfo = screen.getByRole('article', { name: '页脚与合规信息' });
    expect(within(footerInfo).getByLabelText('公司名称')).toBeInTheDocument();
    expect(within(footerInfo).getByLabelText('联系电话')).toBeInTheDocument();
    expect(within(footerInfo).getByLabelText('邮箱地址')).toBeInTheDocument();
    expect(within(footerInfo).getByLabelText('ICP备案号')).toBeInTheDocument();
    expect(within(footerInfo).getByLabelText('ICP备案链接')).toBeInTheDocument();
    expect(within(footerInfo).getByLabelText('公安网警备案号')).toBeInTheDocument();
    expect(within(footerInfo).getByLabelText('公安网警备案链接')).toBeInTheDocument();
    expect(within(footerInfo).getByLabelText('公众号二维码地址')).toBeInTheDocument();
    expect(within(footerInfo).getByLabelText('小程序二维码地址')).toBeInTheDocument();

    fireEvent.change(within(footerInfo).getByLabelText('公司名称'), { target: { value: '智美天工科技有限公司' } });
    expect(within(footerInfo).getByDisplayValue('智美天工科技有限公司')).toBeInTheDocument();
  });
});
