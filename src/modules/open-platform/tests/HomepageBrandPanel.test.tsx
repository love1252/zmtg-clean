import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  it('首次加载配置前不渲染默认页脚字段，避免刷新时闪现初始内容', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));

    render(<HomepageBrandPanel />);

    expect(screen.getByText('正在加载首页与品牌配置')).toBeInTheDocument();
    expect(screen.queryByDisplayValue(defaultHomepageBrandConfig.footer.phone)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(defaultHomepageBrandConfig.footer.email)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(defaultHomepageBrandConfig.footer.icpNumber)).not.toBeInTheDocument();
  });

  it('草稿与已发布版本不一致时提示官网首页仍读取已发布版本', async () => {
    const draftView = {
      ...baseView,
      status: 'draft',
      publishedVersionId: 'version-a',
      publishedAt: '2026-06-20T08:00:00.000Z',
      config: {
        ...defaultHomepageBrandConfig,
        footer: {
          ...defaultHomepageBrandConfig.footer,
          phone: '15221995259',
          email: '125238695@qq.com',
          icpNumber: '沪ICP备2023031593号',
          policeNumber: '沪公网安备31011502400713号',
          wechatQrUrl: '/uploads/homepage-brand/share_image/homepage-brand-asset-qr.png',
        },
      },
    };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/v1/open-platform/homepage-brand') && method === 'GET') {
        return Response.json(draftView);
      }
      return createFetchMock()(input, init);
    }));

    render(<HomepageBrandPanel />);

    expect(await screen.findByDisplayValue('15221995259')).toBeInTheDocument();
    expect(screen.getByText('当前为草稿，官网首页仍读取已发布版本')).toBeInTheDocument();
    expect(screen.getByText('如需让官网首页同步这些联系信息、备案号和二维码，请使用“保存并发布”。')).toBeInTheDocument();
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
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      '品牌概览',
      '登录页管理',
      '素材上传',
      '发布记录',
      '草稿预览',
    ]);
    expect(screen.queryByRole('tab', { name: '首页首屏' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '顶部导航' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '发布回滚' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '审计记录' })).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: '保存草稿' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存并发布' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '草稿预览' })).toBeInTheDocument();
    expect(screen.queryByText('配置状态')).not.toBeInTheDocument();
    expect(screen.queryByText('版本数量')).not.toBeInTheDocument();
    expect(screen.queryByText('素材数量')).not.toBeInTheDocument();
    expect(screen.queryByText('当前消息')).not.toBeInTheDocument();
    expect(screen.queryByText('配置加载失败，当前显示默认配置')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('临时草稿');
    expect(document.body.textContent).not.toContain('不会持久化');
  });

  it('发布记录合并版本历史、回滚入口和审计记录', async () => {
    render(<HomepageBrandPanel />);

    fireEvent.click(await screen.findByRole('tab', { name: '发布记录' }));

    expect(screen.getByRole('heading', { name: '发布控制' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '版本历史' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '审计记录' })).toBeInTheDocument();
    expect(screen.getByText('版本 1 · 首版发布')).toBeInTheDocument();
    expect(screen.getByText('发布首页与品牌配置')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '回滚到版本 1' })).toBeInTheDocument();
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

  it('全局保存和卡片保存都调用草稿保存 API，并保留最新编辑内容', async () => {
    const fetchMock = vi.mocked(fetch);
    render(<HomepageBrandPanel />);

    await screen.findByRole('heading', { name: '首页与品牌' });
    fireEvent.change(screen.getByLabelText('平台名称'), { target: { value: '智美天工新版' } });
    expect(screen.getByText('有未保存修改')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await screen.findByText('草稿已保存');
    const firstDraftCall = fetchMock.mock.calls.find(([url, init]) => (
      String(url).endsWith('/api/v1/open-platform/homepage-brand/draft') && init?.method === 'PUT'
    ));
    expect(firstDraftCall).toBeTruthy();
    expect(JSON.parse(String(firstDraftCall?.[1]?.body)).config.brand.platformName).toBe('智美天工新版');
    expect(screen.queryByText('有未保存修改')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('SEO标题'), { target: { value: '新版 SEO 标题' } });
    const seoInfo = screen.getByRole('article', { name: 'SEO 信息' });
    fireEvent.click(within(seoInfo).getByRole('button', { name: '保存' }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url, init]) => (
      String(url).endsWith('/api/v1/open-platform/homepage-brand/draft') && init?.method === 'PUT'
    ))).toHaveLength(2));
    const secondDraftCall = fetchMock.mock.calls.filter(([url, init]) => (
      String(url).endsWith('/api/v1/open-platform/homepage-brand/draft') && init?.method === 'PUT'
    )).at(-1);
    expect(JSON.parse(String(secondDraftCall?.[1]?.body)).config.metadata.seoTitle).toBe('新版 SEO 标题');
  });

  it('保存接口返回配置服务不可用时显示明确提示', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/v1/open-platform/homepage-brand') && method === 'GET') {
        return Response.json(baseView);
      }
      if (url.endsWith('/api/v1/open-platform/homepage-brand/draft') && method === 'PUT') {
        return Response.json({ ok: false, errorCode: 'HOMEPAGE_BRAND_UNAVAILABLE' }, { status: 503 });
      }
      return Response.json({ ok: false, errorCode: 'UNEXPECTED_TEST_REQUEST' }, { status: 500 });
    });
    render(<HomepageBrandPanel />);

    fireEvent.change(await screen.findByLabelText('平台名称'), { target: { value: '保存失败提示' } });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));

    expect(await screen.findByText('配置服务不可用，请确认数据库迁移已完成')).toBeInTheDocument();
  });

  it('保存并发布会先保存当前草稿，再发布服务端草稿', async () => {
    const fetchMock = vi.mocked(fetch);
    render(<HomepageBrandPanel />);

    await screen.findByRole('heading', { name: '首页与品牌' });
    fireEvent.change(screen.getByLabelText('平台名称'), { target: { value: '发布前保存品牌' } });
    fireEvent.click(screen.getByRole('button', { name: '保存并发布' }));
    const dialog = await screen.findByRole('dialog', { name: '确认发布' });
    expect(fetchMock.mock.calls.some(([url, init]) => (
      String(url).endsWith('/api/v1/open-platform/homepage-brand/publish') && init?.method === 'POST'
    ))).toBe(false);
    fireEvent.click(within(dialog).getByRole('button', { name: '确认发布' }));
    expect(await screen.findByText('已保存草稿并发布版本 2')).toBeInTheDocument();

    const draftIndex = fetchMock.mock.calls.findIndex(([url, init]) => (
      String(url).endsWith('/api/v1/open-platform/homepage-brand/draft') && init?.method === 'PUT'
    ));
    const publishIndex = fetchMock.mock.calls.findIndex(([url, init]) => (
      String(url).endsWith('/api/v1/open-platform/homepage-brand/publish') && init?.method === 'POST'
    ));
    expect(draftIndex).toBeGreaterThan(-1);
    expect(publishIndex).toBeGreaterThan(draftIndex);
    expect(JSON.parse(String(fetchMock.mock.calls[draftIndex]?.[1]?.body)).config.brand.platformName).toBe('发布前保存品牌');
  });

  it('发布和回滚取消确认时不触发对应 API', async () => {
    const fetchMock = vi.mocked(fetch);
    render(<HomepageBrandPanel />);

    fireEvent.click(await screen.findByRole('tab', { name: '发布记录' }));
    fireEvent.change(screen.getByLabelText('发布说明'), { target: { value: '发布首页新版' } });
    fireEvent.click(screen.getByRole('button', { name: '确认发布' }));
    const publishDialog = await screen.findByRole('dialog', { name: '确认发布' });
    fireEvent.click(within(publishDialog).getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('dialog', { name: '确认发布' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url, init]) => (
      String(url).endsWith('/api/v1/open-platform/homepage-brand/publish') && init?.method === 'POST'
    ))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: '回滚到版本 1' }));
    const rollbackDialog = await screen.findByRole('dialog', { name: '确认回滚' });
    fireEvent.click(within(rollbackDialog).getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('dialog', { name: '确认回滚' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url, init]) => (
      String(url).endsWith('/api/v1/open-platform/homepage-brand/rollback') && init?.method === 'POST'
    ))).toBe(false);
  });

  it('发布和回滚确认后都调用对应 API 并显示版本结果', async () => {
    const fetchMock = vi.mocked(fetch);
    render(<HomepageBrandPanel />);

    fireEvent.click(await screen.findByRole('tab', { name: '发布记录' }));
    fireEvent.change(screen.getByLabelText('发布说明'), { target: { value: '发布首页新版' } });
    fireEvent.click(screen.getByRole('button', { name: '确认发布' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: '确认发布' })).getByRole('button', { name: '确认发布' }));
    expect(await screen.findByText('已保存草稿并发布版本 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '回滚到版本 1' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: '确认回滚' })).getByRole('button', { name: '确认回滚' }));
    expect(await screen.findByText('已回滚并生成版本 3')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/open-platform/homepage-brand/draft',
      expect.objectContaining({ method: 'PUT' }),
    );
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

    fireEvent.click(await screen.findByRole('tab', { name: '草稿预览' }));
    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: 'homepage-preview-target', target: 'hero' },
      }),
    );
    fireEvent.change(screen.getByLabelText('可视化编辑主标题第一行'), { target: { value: '预览一致' } });

    const previewFrame = screen.getByTitle('真实首页草稿预览画布');
    const srcDoc = previewFrame.getAttribute('srcdoc') ?? '';
    expect(srcDoc).toContain('预览一致');
    expect(srcDoc).toContain('<div class="page">');
    expect(srcDoc).toContain('<section class="hero" data-edit-target="heroImage">');
    expect(srcDoc).toContain('真实首页草稿预览');
    expect(normalizeMarkup(srcDoc)).toContain('预览一致');
    expect(buildMarketingHomeMarkup(expectedConfig)).toContain('预览一致');
    expect(srcDoc).toContain('.hero');
    expect(srcDoc).toContain('min-height: 960px');
  });

  it('草稿预览可点击首页区块并在右侧轻量编辑后实时更新预览', async () => {
    render(<HomepageBrandPanel />);

    fireEvent.click(await screen.findByRole('button', { name: '草稿预览' }));
    const previewFrame = screen.getByTitle('真实首页草稿预览画布');
    expect(screen.getByText('可编辑区块')).toBeInTheDocument();
    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: 'homepage-preview-target', target: 'hero' },
      }),
    );

    expect(screen.getByText('正在编辑：首页首屏')).toBeInTheDocument();
    expect(screen.getByText('当前选中：首页首屏')).toBeInTheDocument();
    expect(screen.getByText('草稿预览 / 首页首屏')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '移动端预览' }));
    expect(screen.getByText('当前设备：移动端预览')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '桌面预览' }));
    expect(screen.getByText('当前设备：桌面预览')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('可视化编辑主标题第一行'), { target: { value: '预览点击编辑标题' } });

    expect(previewFrame.getAttribute('srcdoc')).toContain('预览点击编辑标题');
    expect(screen.getByText('有未保存修改')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '跳转到草稿预览' }));
    expect(screen.getByRole('tab', { name: '草稿预览' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByDisplayValue('预览点击编辑标题')).toBeInTheDocument();
  });

  it('草稿预览点击不可编辑区域时给出明确提示', async () => {
    render(<HomepageBrandPanel />);

    fireEvent.click(await screen.findByRole('button', { name: '草稿预览' }));
    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: 'homepage-preview-target-unavailable' },
      }),
    );

    expect(screen.getByText('该区域暂不可编辑，请点击蓝色高亮区域或上方可编辑区块。')).toBeInTheDocument();
  });

  it('草稿预览区块按钮会滚动 iframe 到对应真实首页区域', async () => {
    render(<HomepageBrandPanel />);

    fireEvent.click(await screen.findByRole('button', { name: '草稿预览' }));
    const previewFrame = screen.getByTitle('真实首页草稿预览画布') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(previewFrame, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    fireEvent.click(screen.getByRole('button', { name: '页脚与合规信息' }));

    expect(screen.getByText('正在编辑：页脚与合规信息')).toBeInTheDocument();
    expect(postMessage).toHaveBeenCalledWith({ type: 'homepage-preview-scroll', target: 'footer' }, '*');

    fireEvent.click(screen.getByRole('button', { name: '小程序二维码' }));

    expect(screen.getByText('正在编辑：小程序二维码')).toBeInTheDocument();
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: 'homepage-preview-scroll', target: 'miniProgramQr' },
      '*',
    );
  });

  it('草稿预览右侧编辑覆盖导航、品牌、图片、页脚和二维码字段', async () => {
    render(<HomepageBrandPanel />);

    fireEvent.click(await screen.findByRole('button', { name: '草稿预览' }));
    const previewFrame = screen.getByTitle('真实首页草稿预览画布');

    fireEvent.click(screen.getByRole('button', { name: '顶部导航' }));
    fireEvent.change(screen.getByLabelText('可视化编辑导航名称：增长诊断'), {
      target: { value: '经营诊断' },
    });
    fireEvent.change(screen.getByLabelText('可视化编辑导航主按钮文字'), {
      target: { value: '立即预约' },
    });
    expect(previewFrame.getAttribute('srcdoc')).toContain('经营诊断');
    expect(previewFrame.getAttribute('srcdoc')).toContain('立即预约');

    fireEvent.click(screen.getByRole('button', { name: '品牌文字' }));
    fireEvent.change(screen.getByLabelText('可视化编辑后台名称'), {
      target: { value: '智美后台新版' },
    });
    fireEvent.change(screen.getByLabelText('可视化编辑横版标识地址'), {
      target: { value: '/brand/new-logo.png' },
    });
    expect(screen.getByDisplayValue('智美后台新版')).toBeInTheDocument();
    expect(previewFrame.getAttribute('srcdoc')).toContain('/brand/new-logo.png');

    fireEvent.click(screen.getByRole('button', { name: '首页背景图' }));
    fireEvent.change(screen.getByLabelText('可视化编辑首页背景图地址'), {
      target: { value: '/homepage/new-hero.png' },
    });
    expect(previewFrame.getAttribute('srcdoc')).toContain('/homepage/new-hero.png');

    fireEvent.click(screen.getByRole('button', { name: '页脚与合规信息' }));
    fireEvent.change(screen.getByLabelText('可视化编辑邮箱地址'), {
      target: { value: 'hello@zmtg.ai' },
    });
    fireEvent.change(screen.getByLabelText('可视化编辑ICP备案号'), {
      target: { value: '粤ICP备12345678号' },
    });
    expect(previewFrame.getAttribute('srcdoc')).toContain('hello@zmtg.ai');
    expect(previewFrame.getAttribute('srcdoc')).toContain('粤ICP备12345678号');

    fireEvent.click(screen.getByRole('button', { name: '公众号二维码' }));
    fireEvent.change(screen.getByLabelText('可视化编辑公众号二维码地址'), {
      target: { value: '/qr/wechat.png' },
    });
    expect(previewFrame.getAttribute('srcdoc')).toContain('/qr/wechat.png');
  });

  it('草稿预览支持首屏按钮和增长指标的专属编辑器', async () => {
    render(<HomepageBrandPanel />);

    fireEvent.click(await screen.findByRole('button', { name: '草稿预览' }));
    const previewFrame = screen.getByTitle('真实首页草稿预览画布');

    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: 'homepage-preview-target', target: 'heroPrimaryAction' },
      }),
    );

    expect(screen.getByText('正在编辑：首屏按钮')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('可视化编辑主按钮文字'), {
      target: { value: '预约智能诊断' },
    });
    fireEvent.change(screen.getByLabelText('可视化编辑辅助按钮文字'), {
      target: { value: '查看运营旅程' },
    });
    expect(previewFrame.getAttribute('srcdoc')).toContain('预约智能诊断');
    expect(previewFrame.getAttribute('srcdoc')).toContain('查看运营旅程');

    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: 'homepage-preview-target', target: 'metricConversionRate' },
      }),
    );

    expect(screen.getByText('正在编辑：增长指标')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('可视化编辑指标数值：复购率提升案例'), {
      target: { value: '48%' },
    });
    fireEvent.change(screen.getByLabelText('可视化编辑增长卡标题'), {
      target: { value: '今日经营机会' },
    });
    expect(previewFrame.getAttribute('srcdoc')).toContain('48%');
    expect(previewFrame.getAttribute('srcdoc')).toContain('今日经营机会');
  });

  it('草稿预览点击业务内容区块时右侧不静默并进入模块编辑状态', async () => {
    render(<HomepageBrandPanel />);

    fireEvent.click(await screen.findByRole('button', { name: '草稿预览' }));
    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: 'homepage-preview-target', target: 'diagnosisSection' },
      }),
    );

    expect(screen.getByText('正在编辑：增长诊断区块')).toBeInTheDocument();
    expect(screen.getByText('该区块属于官网结构化内容模块')).toBeInTheDocument();

    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: 'homepage-preview-target', target: 'finalCta' },
      }),
    );

    expect(screen.getByText('正在编辑：底部转化区块')).toBeInTheDocument();
  });

  it('草稿预览业务内容区块支持字段编辑并实时更新真实首页预览', async () => {
    render(<HomepageBrandPanel />);

    fireEvent.click(await screen.findByRole('button', { name: '草稿预览' }));
    const previewFrame = screen.getByTitle('真实首页草稿预览画布');

    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: 'homepage-preview-target', target: 'diagnosisSection' },
      }),
    );

    fireEvent.change(screen.getByLabelText('可视化编辑模块标题：增长诊断区块'), {
      target: { value: '重新定义增长诊断' },
    });
    fireEvent.change(screen.getByLabelText('可视化编辑首个卡片标题：增长诊断区块'), {
      target: { value: '客户资产统一沉淀' },
    });
    expect(previewFrame.getAttribute('srcdoc')).toContain('重新定义增长诊断');
    expect(previewFrame.getAttribute('srcdoc')).toContain('客户资产统一沉淀');

    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: 'homepage-preview-target', target: 'finalCta' },
      }),
    );

    fireEvent.change(screen.getByLabelText('可视化编辑模块标题：底部转化区块'), {
      target: { value: '现在启动你的增长旅程' },
    });
    fireEvent.change(screen.getByLabelText('可视化编辑转化按钮文字'), {
      target: { value: '马上预约演示' },
    });
    expect(previewFrame.getAttribute('srcdoc')).toContain('现在启动你的增长旅程');
    expect(previewFrame.getAttribute('srcdoc')).toContain('马上预约演示');
  });

  it('草稿预览业务内容区块支持编辑非首项卡片、图标和套餐', async () => {
    render(<HomepageBrandPanel />);

    fireEvent.click(await screen.findByRole('button', { name: '草稿预览' }));
    const previewFrame = screen.getByTitle('真实首页草稿预览画布');

    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: 'homepage-preview-target', target: 'agentSection' },
      }),
    );
    fireEvent.change(screen.getByLabelText('可视化编辑卡片图标：智能体方案区块 2'), {
      target: { value: '访' },
    });
    fireEvent.change(screen.getByLabelText('可视化编辑卡片标题：智能体方案区块 2'), {
      target: { value: '回访关怀智能体' },
    });

    expect(previewFrame.getAttribute('srcdoc')).toContain('访');
    expect(previewFrame.getAttribute('srcdoc')).toContain('回访关怀智能体');

    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: 'homepage-preview-target', target: 'pricingSection' },
      }),
    );
    fireEvent.change(screen.getByLabelText('可视化编辑套餐名称：套餐方案区块 2'), {
      target: { value: '增长版' },
    });
    fireEvent.change(screen.getByLabelText('可视化编辑套餐价格：套餐方案区块 2'), {
      target: { value: '¥3,699' },
    });

    expect(previewFrame.getAttribute('srcdoc')).toContain('增长版');
    expect(previewFrame.getAttribute('srcdoc')).toContain('¥3,699');
  });

  it('草稿预览右侧可以直接上传标识、背景图和二维码素材并实时更新预览', async () => {
    render(<HomepageBrandPanel />);

    fireEvent.click(await screen.findByRole('button', { name: '草稿预览' }));
    const previewFrame = screen.getByTitle('真实首页草稿预览画布');
    const imageFile = new File(['preview-image'], 'preview-image.png', { type: 'image/png' });

    fireEvent.click(screen.getByRole('button', { name: '品牌文字' }));
    fireEvent.change(screen.getByLabelText('上传可视化编辑横版标识'), {
      target: { files: [imageFile] },
    });

    await waitFor(() => {
      expect(previewFrame.getAttribute('srcdoc')).toContain('/uploads/homepage-brand/logo/asset-logo-a.png');
    });

    fireEvent.click(screen.getByRole('button', { name: '首页背景图' }));
    fireEvent.change(screen.getByLabelText('上传可视化编辑首页背景图'), {
      target: { files: [imageFile] },
    });

    await waitFor(() => {
      expect(previewFrame.getAttribute('srcdoc')).toContain('/uploads/homepage-brand/logo/asset-logo-a.png');
    });

    fireEvent.click(screen.getByRole('button', { name: '公众号二维码' }));
    fireEvent.change(screen.getByLabelText('上传可视化编辑公众号二维码'), {
      target: { files: [imageFile] },
    });

    await waitFor(() => {
      expect(previewFrame.getAttribute('srcdoc')).toContain('/uploads/homepage-brand/logo/asset-logo-a.png');
    });
  });

  it('草稿预览上传的素材会进入素材上传列表并标记当前用途', async () => {
    render(<HomepageBrandPanel />);

    fireEvent.click(await screen.findByRole('button', { name: '草稿预览' }));
    fireEvent.click(screen.getByRole('button', { name: '公众号二维码' }));
    fireEvent.change(screen.getByLabelText('上传可视化编辑公众号二维码'), {
      target: { files: [new File(['qr-image'], '公众号二维码.png', { type: 'image/png' })] },
    });

    await screen.findByText('公众号二维码已上传');
    fireEvent.click(screen.getByRole('tab', { name: '素材上传' }));

    const assetLibrary = screen.getByRole('article', { name: '全部素材库' });
    expect(within(assetLibrary).getByText('品牌.png')).toBeInTheDocument();
    expect(within(assetLibrary).getByText('当前用于：公众号二维码')).toBeInTheDocument();
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

  it('二维码支持上传、移除并通过保存草稿持久化引用', async () => {
    const fetchMock = vi.mocked(fetch);
    render(<HomepageBrandPanel />);

    await screen.findByRole('heading', { name: '首页与品牌' });
    const footerInfo = screen.getByRole('article', { name: '页脚与合规信息' });
    fireEvent.change(within(footerInfo).getByLabelText('上传公众号二维码'), {
      target: { files: [new File([new TextEncoder().encode('qr bytes')], '公众号.png', { type: 'image/png' })] },
    });

    await screen.findByText('公众号二维码已上传');
    expect(within(footerInfo).getByRole('img', { name: '公众号二维码预览' })).toHaveAttribute(
      'src',
      '/uploads/homepage-brand/logo/asset-logo-a.png',
    );
    expect(screen.getByText('有未保存修改')).toBeInTheDocument();

    fireEvent.click(within(footerInfo).getByRole('button', { name: '保存' }));
    await screen.findByText('草稿已保存');
    const savedQrCall = fetchMock.mock.calls.filter(([url, init]) => (
      String(url).endsWith('/api/v1/open-platform/homepage-brand/draft') && init?.method === 'PUT'
    )).at(-1);
    expect(JSON.parse(String(savedQrCall?.[1]?.body)).config.footer.wechatQrUrl).toBe('/uploads/homepage-brand/logo/asset-logo-a.png');

    fireEvent.click(within(footerInfo).getByRole('button', { name: '移除公众号二维码' }));
    expect(within(footerInfo).queryByRole('img', { name: '公众号二维码预览' })).not.toBeInTheDocument();
    expect(within(footerInfo).getAllByText('未配置').length).toBeGreaterThan(0);

    fireEvent.click(within(footerInfo).getByRole('button', { name: '保存' }));
    await screen.findByText('草稿已保存');
    const removedQrCall = fetchMock.mock.calls.filter(([url, init]) => (
      String(url).endsWith('/api/v1/open-platform/homepage-brand/draft') && init?.method === 'PUT'
    )).at(-1);
    expect(JSON.parse(String(removedQrCall?.[1]?.body)).config.footer.wechatQrUrl).toBe('');
  });
});
