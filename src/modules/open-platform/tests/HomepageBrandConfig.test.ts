import { describe, expect, it } from 'vitest';

import {
  defaultHomepageBrandConfig,
  validateHomepageBrandConfig,
} from '@/modules/marketing/domain/homepageBrandConfig';

describe('首页与品牌默认配置', () => {
  it('默认配置与当前真实首页首屏文案一致', () => {
    expect(defaultHomepageBrandConfig.hero.eyebrow).toBe('智美天工 · 医美 AI 增长操作系统');
    expect(defaultHomepageBrandConfig.hero.titleLine).toBe('让医美经营');
    expect(defaultHomepageBrandConfig.hero.accentLine).toBe('更懂每位客户');
    expect(defaultHomepageBrandConfig.hero.description).toContain('让咨询师从处理消息，升级为经营长期客户关系');
    expect(defaultHomepageBrandConfig.hero.note).toContain('先让增长动作持续发生');
    expect(defaultHomepageBrandConfig.hero.primaryAction.label).toBe('预约增长诊断 →');
    expect(defaultHomepageBrandConfig.hero.primaryAction.href).toBe('/login');
    expect(defaultHomepageBrandConfig.hero.secondaryAction.href).toBe('#journey');
  });

  it('默认导航区分普通链接和行动按钮', () => {
    expect(defaultHomepageBrandConfig.navigation.links.map((item) => item.href)).toEqual([
      '#diagnosis',
      '#agents',
      '#journey',
      '#cases',
    ]);
    expect(defaultHomepageBrandConfig.navigation.cta.href).toBe('/login');
    expect(defaultHomepageBrandConfig.navigation.cta.label).toBe('预约演示');
  });

  it('默认配置可以通过校验', () => {
    expect(validateHomepageBrandConfig(defaultHomepageBrandConfig)).toEqual([]);
  });

  it('默认包含机构和平台登录页的低敏展示配置', () => {
    expect(defaultHomepageBrandConfig.login.institution).toMatchObject({
      eyebrow: '机构增长工作台',
      title: '让咨询团队',
      accentTitle: '先看到增长机会',
      formTitle: '机构工作台登录',
      submitLabel: '登录机构工作台',
      alternateHref: '/platform-login',
      alternateLabel: '平台管理员入口',
    });
    expect(defaultHomepageBrandConfig.login.platform).toMatchObject({
      eyebrow: '平台安全入口',
      title: '平台运营中枢',
      accentTitle: '安全进入',
      formTitle: '平台管理员登录',
      submitLabel: '进入平台后台',
      alternateHref: '/login',
      alternateLabel: '机构工作台入口',
    });
  });

  it('默认包含页面基础信息扩展字段', () => {
    expect(defaultHomepageBrandConfig.metadata.seoTitle).toBe('智美天工 | AI智能运营中台');
    expect(defaultHomepageBrandConfig.metadata.seoKeywords).toContain('医美AI');
    expect(defaultHomepageBrandConfig.footer.companyName).toBe('智美天工');
    expect(defaultHomepageBrandConfig.footer.icpNumber).toBe('粤ICP备00000000号');
    expect(defaultHomepageBrandConfig.footer.policeNumber).toBe('粤公网安备00000000000000号');
    expect(defaultHomepageBrandConfig.footer.wechatQrUrl).toBe('/homepage/zmtg-luxury-clinic-bg.png');
    expect(defaultHomepageBrandConfig.footer.miniProgramQrUrl).toBe('/homepage/zmtg-luxury-clinic-bg.png');
  });

  it('登录页关键文案不能为空', () => {
    const invalidConfig = structuredClone(defaultHomepageBrandConfig);
    invalidConfig.login.institution.formTitle = '';
    invalidConfig.login.platform.submitLabel = '';

    expect(validateHomepageBrandConfig(invalidConfig)).toEqual([
      '机构登录页标题不能为空',
      '平台登录页按钮文字不能为空',
    ]);
  });

  it('页脚合规链接必须是站内路径或 HTTPS 链接', () => {
    const invalidConfig = structuredClone(defaultHomepageBrandConfig);
    invalidConfig.footer.icpUrl = 'javascript:alert(1)';
    invalidConfig.footer.policeUrl = 'http://unsafe.example';

    expect(validateHomepageBrandConfig(invalidConfig)).toEqual([
      'ICP备案链接不在白名单',
      '公安备案链接不在白名单',
    ]);
  });
});
