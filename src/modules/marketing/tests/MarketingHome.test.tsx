import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildMarketingHomePreviewDocument,
  MarketingHome,
} from '@/modules/marketing/components/MarketingHome';
import {
  cloneHomepageBrandConfig,
  defaultHomepageBrandConfig,
} from '@/modules/marketing/domain/homepageBrandConfig';

describe('官网首页', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('渲染智美天工品牌承诺和主要操作入口', () => {
    render(<MarketingHome />);

    expect(document.querySelector('[aria-label="智美天工 ZHIMEI TIANGONG"]')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /让医美经营\s*更懂每位客户/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '预约演示' })).toHaveAttribute('href', '/login');
    screen.getAllByRole('link', { name: '预约增长诊断 →' }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/login');
    });
    expect(screen.getByRole('link', { name: '查看客户旅程' })).toHaveAttribute('href', '#journey');
  });

  it('可以使用首页与品牌配置渲染真实首页首屏', () => {
    const config = cloneHomepageBrandConfig(defaultHomepageBrandConfig);
    config.hero.eyebrow = '智美天工 · 可配置首页';
    config.hero.titleLine = '让首页配置';
    config.hero.accentLine = '真实生效';
    config.hero.primaryAction = { label: '立即预约', href: '/login' };
    config.navigation.links[0] = {
      ...config.navigation.links[0],
      label: '新版诊断',
      href: '#diagnosis',
    };
    config.metrics[0] = {
      ...config.metrics[0],
      value: '42%',
      label: '配置指标',
    };

    render(<MarketingHome config={config} />);

    expect(screen.getByText('智美天工 · 可配置首页')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /让首页配置\s*真实生效/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '新版诊断' })).toHaveAttribute('href', '#diagnosis');
    screen.getAllByRole('link', { name: '立即预约' }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/login');
    });
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('配置指标')).toBeInTheDocument();
  });

  it('使用页面基础信息配置渲染首页页脚和二维码', () => {
    const config = cloneHomepageBrandConfig(defaultHomepageBrandConfig);
    config.footer.companyName = '智美天工科技有限公司';
    config.footer.phone = '0755-12345678';
    config.footer.email = 'hello@zmtg.ai';
    config.footer.icpNumber = '粤ICP备12345678号';
    config.footer.icpUrl = 'https://beian.miit.gov.cn/';
    config.footer.policeNumber = '粤公网安备12345678901234号';
    config.footer.policeUrl = 'https://www.beian.gov.cn/';
    config.footer.wechatQrUrl = '/homepage/wechat-qr.png';
    config.footer.miniProgramQrUrl = '/homepage/mini-program-qr.png';

    render(<MarketingHome config={config} />);

    const footerGrid = document.querySelector('.footer-grid');
    const footerLegal = document.querySelector('.footer-legal');
    const icpLink = screen.getByRole('link', { name: '粤ICP备12345678号' });
    const policeLink = screen.getByRole('link', { name: '粤公网安备12345678901234号' });

    expect(screen.getByText('智美天工科技有限公司')).toBeInTheDocument();
    expect(screen.getByText('0755-12345678')).toBeInTheDocument();
    expect(screen.getByText('hello@zmtg.ai')).toBeInTheDocument();
    expect(icpLink).toHaveAttribute('href', 'https://beian.miit.gov.cn/');
    expect(policeLink).toHaveAttribute('href', 'https://www.beian.gov.cn/');
    expect(footerLegal).toContainElement(icpLink);
    expect(footerLegal).toContainElement(policeLink);
    expect(footerLegal?.previousElementSibling).toBe(footerGrid);
    expect(footerGrid).not.toContainElement(icpLink);
    expect(screen.getByRole('img', { name: '公众号二维码' })).toHaveAttribute('src', '/homepage/wechat-qr.png');
    expect(screen.getByRole('img', { name: '小程序二维码' })).toHaveAttribute('src', '/homepage/mini-program-qr.png');
  });

  it('使用首页与品牌配置渲染业务内容模块', () => {
    const config = cloneHomepageBrandConfig(defaultHomepageBrandConfig);
    config.sections.diagnosis.title = '重新定义增长诊断';
    config.sections.diagnosis.cards[0].title = '客户资产统一沉淀';
    config.sections.agents.cards[0].icon = '增';
    config.sections.agents.cards[0].title = '增长承接智能体';
    config.sections.cases.stats[0].value = '52%';
    config.sections.pricing.plans[0].title = '入门版';
    config.sections.finalCta.title = '现在启动你的增长旅程';
    config.sections.finalCta.action.label = '马上预约演示';

    render(<MarketingHome config={config} />);

    expect(screen.getByRole('heading', { name: '重新定义增长诊断' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '客户资产统一沉淀' })).toBeInTheDocument();
    expect(screen.getByText('增')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '增长承接智能体' })).toBeInTheDocument();
    expect(screen.getByText('52%')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '入门版' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '现在启动你的增长旅程' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '马上预约演示' })).toHaveAttribute('href', '/login');
  });

  it('草稿预览点击桥接优先识别具体嵌套区域', () => {
    document.body.innerHTML = `
      <section class="hero">
        <img class="hero-bg" alt="" />
        <div class="hero-veil"></div>
        <nav class="nav">
          <span class="brand-logo-stack"><img alt="" /></span>
          <a href="#diagnosis">增长诊断</a>
        </nav>
        <section class="hero-copy"><button>预约演示</button></section>
      </section>
      <footer class="site-footer">
        <div class="footer-qr"><img alt="公众号二维码" /></div>
        <div class="footer-qr"><img alt="小程序二维码" /></div>
      </footer>
    `;
    const previewDocument = buildMarketingHomePreviewDocument(defaultHomepageBrandConfig);
    const script = previewDocument.match(/<script>([\s\S]*)<\\?\/script>/)?.[1];
    const postMessage = vi.spyOn(window, 'postMessage').mockImplementation(() => undefined);

    expect(script).toBeTruthy();
    new Function(script as string)();

    fireEvent.click(document.querySelector('.brand-logo-stack img') as Element);
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'homepage-preview-target', target: 'brand' }, '*');

    fireEvent.click(document.querySelector('.nav a') as Element);
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'homepage-preview-target', target: 'navigation' }, '*');

    fireEvent.click(document.querySelector('.hero-veil') as Element);
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'homepage-preview-target', target: 'heroImage' }, '*');

    fireEvent.click(document.querySelector('.hero') as Element);
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'homepage-preview-target', target: 'heroImage' }, '*');

    fireEvent.click(document.querySelector('.hero-copy button') as Element);
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'homepage-preview-target', target: 'hero' }, '*');

    fireEvent.click(document.querySelector('.footer-qr:first-child img') as Element);
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'homepage-preview-target', target: 'wechatQr' }, '*');

    fireEvent.click(document.querySelector('.footer-qr:nth-child(2) img') as Element);
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'homepage-preview-target', target: 'miniProgramQr' }, '*');

    fireEvent.click(document.querySelector('.site-footer') as Element);
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'homepage-preview-target', target: 'footer' }, '*');
  });

  it('草稿预览点击不可编辑区域时会通知父页面显示提示', () => {
    document.body.innerHTML = `
      <main class="page">
        <div class="plain-area">不可编辑留白</div>
      </main>
    `;
    const previewDocument = buildMarketingHomePreviewDocument(defaultHomepageBrandConfig);
    const script = previewDocument.match(/<script>([\s\S]*)<\\?\/script>/)?.[1];
    const postMessage = vi.spyOn(window, 'postMessage').mockImplementation(() => undefined);

    expect(script).toBeTruthy();
    new Function(script as string)();

    fireEvent.click(document.querySelector('.plain-area') as Element);

    expect(postMessage).toHaveBeenLastCalledWith(
      { type: 'homepage-preview-target-unavailable' },
      '*',
    );
  });

  it('草稿预览文档为关键首页区域输出可编辑目标标记', () => {
    const previewDocument = buildMarketingHomePreviewDocument(defaultHomepageBrandConfig);
    const container = document.createElement('div');

    container.innerHTML = previewDocument;

    expect(container.querySelector('[data-edit-target="brand"]')).toBeTruthy();
    expect(container.querySelector('[data-edit-target="navigation"]')).toBeTruthy();
    expect(container.querySelector('[data-edit-target="hero"]')).toBeTruthy();
    expect(container.querySelector('[data-edit-target="heroImage"]')).toBeTruthy();
    expect(container.querySelector('[data-edit-target="footer"]')).toBeTruthy();
    expect(container.querySelector('[data-edit-target="wechatQr"]')).toBeTruthy();
    expect(container.querySelector('[data-edit-target="miniProgramQr"]')).toBeTruthy();
    expect(container.querySelector('[data-edit-target="heroPrimaryAction"]')).toBeTruthy();
    expect(container.querySelector('[data-edit-target="metricConversionRate"]')).toBeTruthy();
    expect(container.querySelector('[data-edit-target="diagnosisSection"]')).toBeTruthy();
    expect(container.querySelector('[data-edit-target="agentSection"]')).toBeTruthy();
    expect(container.querySelector('[data-edit-target="caseSection"]')).toBeTruthy();
    expect(container.querySelector('[data-edit-target="pricingSection"]')).toBeTruthy();
    expect(container.querySelector('[data-edit-target="finalCta"]')).toBeTruthy();
  });
});
