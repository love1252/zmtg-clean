import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarketingHome } from '@/modules/marketing/components/MarketingHome';
import {
  cloneHomepageBrandConfig,
  defaultHomepageBrandConfig,
} from '@/modules/marketing/domain/homepageBrandConfig';

describe('官网首页', () => {
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

    expect(screen.getByText('智美天工科技有限公司')).toBeInTheDocument();
    expect(screen.getByText('0755-12345678')).toBeInTheDocument();
    expect(screen.getByText('hello@zmtg.ai')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '粤ICP备12345678号' })).toHaveAttribute('href', 'https://beian.miit.gov.cn/');
    expect(screen.getByRole('link', { name: '粤公网安备12345678901234号' })).toHaveAttribute('href', 'https://www.beian.gov.cn/');
    expect(screen.getByRole('img', { name: '公众号二维码' })).toHaveAttribute('src', '/homepage/wechat-qr.png');
    expect(screen.getByRole('img', { name: '小程序二维码' })).toHaveAttribute('src', '/homepage/mini-program-qr.png');
  });
});
