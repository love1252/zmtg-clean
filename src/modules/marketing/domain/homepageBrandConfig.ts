export type HomepageBrandAction = {
  label: string;
  href: string;
};

export type HomepageBrandNavigationLink = {
  id: string;
  label: string;
  href: string;
  visible: boolean;
};

export type HomepageBrandAssetConfig = {
  horizontalLogoUrl: string;
  horizontalLogoNightUrl: string;
  markLogoUrl: string;
  heroBackgroundUrl: string;
  shareImageUrl: string;
};

export type HomepageBrandFooterConfig = {
  companyName: string;
  phone: string;
  email: string;
  icpNumber: string;
  icpUrl: string;
  policeNumber: string;
  policeUrl: string;
  wechatQrUrl: string;
  miniProgramQrUrl: string;
};

export type HomepageBrandMetric = {
  id: string;
  value: string;
  label: string;
  visible: boolean;
};

export type HomepageBrandGrowthRow = {
  id: string;
  label: string;
  value: string;
  percent: number;
  tone: 'blue' | 'teal' | 'rose' | 'gold';
};

export type HomepageBrandLoginMetric = {
  value: string;
  label: string;
  detail: string;
};

export type HomepageBrandLoginInsight = {
  title: string;
  description: string;
};

export type HomepageBrandLoginPageConfig = {
  eyebrow: string;
  title: string;
  accentTitle: string;
  description: string;
  formEyebrow: string;
  formTitle: string;
  formDescription: string;
  submitLabel: string;
  alternateHref: '/login' | '/platform-login';
  alternateLabel: string;
  metrics: HomepageBrandLoginMetric[];
  insights: HomepageBrandLoginInsight[];
};

export type HomepageBrandConfig = {
  brand: {
    platformName: string;
    consoleName: string;
    subtitle: string;
  };
  metadata: {
    title: string;
    description: string;
    shareTitle: string;
    shareDescription: string;
    seoTitle: string;
    seoKeywords: string;
    seoDescription: string;
  };
  footer: HomepageBrandFooterConfig;
  assets: HomepageBrandAssetConfig;
  navigation: {
    links: HomepageBrandNavigationLink[];
    cta: HomepageBrandAction;
  };
  hero: {
    eyebrow: string;
    titleLine: string;
    accentLine: string;
    description: string;
    note: string;
    primaryAction: HomepageBrandAction;
    secondaryAction: HomepageBrandAction;
  };
  metrics: HomepageBrandMetric[];
  growthCard: {
    title: string;
    subtitle: string;
    badge: string;
    rows: HomepageBrandGrowthRow[];
    insight: {
      eyebrow: string;
      title: string;
      confidence: string;
      description: string;
      chips: string[];
    };
  };
  login: {
    institution: HomepageBrandLoginPageConfig;
    platform: HomepageBrandLoginPageConfig;
  };
};

export const defaultHomepageBrandConfig: HomepageBrandConfig = {
  brand: {
    platformName: '智美天工',
    consoleName: '智美天工管理后台',
    subtitle: '平台控制台',
  },
  metadata: {
    title: '智美天工 | AI智能运营中台',
    description: '服务医美机构的 AI 智能运营中台。',
    shareTitle: '智美天工',
    shareDescription: '医美增长操作系统',
    seoTitle: '智美天工 | AI智能运营中台',
    seoKeywords: '医美AI,智能运营中台,客户管理,复购增长,咨询转化',
    seoDescription: '智美天工为医美机构提供 AI 智能运营中台，覆盖咨询承接、客户旅程、术后关怀与复购增长。',
  },
  footer: {
    companyName: '智美天工',
    phone: '400-000-0000',
    email: 'contact@zmtg.ai',
    icpNumber: '粤ICP备00000000号',
    icpUrl: 'https://beian.miit.gov.cn/',
    policeNumber: '粤公网安备00000000000000号',
    policeUrl: 'https://www.beian.gov.cn/',
    wechatQrUrl: '/homepage/zmtg-luxury-clinic-bg.png',
    miniProgramQrUrl: '/homepage/zmtg-luxury-clinic-bg.png',
  },
  assets: {
    horizontalLogoUrl: '/brand/zmtg-logo-horizontal-luxury-clean.png',
    horizontalLogoNightUrl: '/brand/zmtg-logo-horizontal-night-clean.png',
    markLogoUrl: '/brand/logo-mark.png',
    heroBackgroundUrl: '/homepage/zmtg-luxury-clinic-bg.png',
    shareImageUrl: '/homepage/zmtg-luxury-clinic-bg.png',
  },
  navigation: {
    links: [
      { id: 'diagnosis', label: '增长诊断', href: '#diagnosis', visible: true },
      { id: 'agents', label: '智能体方案', href: '#agents', visible: true },
      { id: 'journey', label: '客户旅程', href: '#journey', visible: true },
      { id: 'cases', label: '案例数据', href: '#cases', visible: true },
    ],
    cta: { label: '预约演示', href: '/login' },
  },
  hero: {
    eyebrow: '智美天工 · 医美 AI 增长操作系统',
    titleLine: '让医美经营',
    accentLine: '更懂每位客户',
    description:
      '用 AI 智能体识别高意向客户、推荐跟进节奏、编排术后关怀与复购召回，让咨询师从处理消息，升级为经营长期客户关系。',
    note: '7 天跑通核心旅程：新客咨询、到院提醒、术后关怀、复购召回，先让增长动作持续发生。',
    primaryAction: { label: '预约增长诊断 →', href: '/login' },
    secondaryAction: { label: '查看客户旅程', href: '#journey' },
  },
  metrics: [
    { id: 'repurchase', value: '35%', label: '复购率提升案例', visible: true },
    { id: 'response', value: '2.4x', label: '咨询响应效率', visible: true },
    { id: 'alwaysOn', value: '7×24', label: '智能体持续接待', visible: true },
    { id: 'journeySteps', value: '4步', label: '上线核心旅程', visible: true },
  ],
  growthCard: {
    title: '今日增长机会',
    subtitle: 'AI 已为咨询团队排好优先级',
    badge: '运行中',
    rows: [
      { id: 'newConsults', label: '新增咨询', value: '1,284', percent: 92, tone: 'blue' },
      { id: 'aiHandled', label: 'AI 已承接', value: '916', percent: 74, tone: 'teal' },
      { id: 'manualHandoff', label: '高意向转人工', value: '216', percent: 48, tone: 'rose' },
      { id: 'appointments', label: '预约到院', value: '88', percent: 34, tone: 'gold' },
    ],
    insight: {
      eyebrow: '下一步建议',
      title: '优先承接 18 位复购窗口客户',
      confidence: '92%匹配',
      description: '她们处于术后第 21-30 天，近期咨询补水与修复项目，建议由资深咨询师人工跟进。',
      chips: ['高意向', '复购窗口', '需人工承接'],
    },
  },
  login: {
    institution: {
      eyebrow: '机构增长工作台',
      title: '让咨询团队',
      accentTitle: '先看到增长机会',
      description: '把客户画像、咨询对话、预约进度与 AI 建议放在同一个入口里，登录后即可进入机构经营视角。',
      formEyebrow: '机构入口',
      formTitle: '机构工作台登录',
      formDescription: '请使用机构运营账号进入医美增长中枢。',
      submitLabel: '登录机构工作台',
      alternateHref: '/platform-login',
      alternateLabel: '平台管理员入口',
      metrics: [
        { value: '37%', label: '咨询转化提升', detail: '线索意向、回访节奏与成交机会集中呈现' },
        { value: '2.4h', label: '响应时间缩短', detail: 'AI 自动整理客户上下文，减少重复确认' },
        { value: '89%', label: '重点客户覆盖', detail: '高价值客户跟进、复诊与复购提醒不断档' },
      ],
      insights: [
        { title: 'AI 下一步建议', description: '进入工作台后优先看到今日高意向客户、待跟进事项与推荐动作。' },
        { title: '让咨询团队', description: '从对话、标签、预约到复购旅程形成同一条业务视线。' },
      ],
    },
    platform: {
      eyebrow: '平台安全入口',
      title: '平台运营中枢',
      accentTitle: '安全进入',
      description: '为智美天工运营团队保留的管理入口，聚焦租户治理、服务状态、模型配置与平台级风控。',
      formEyebrow: '平台管理入口',
      formTitle: '平台管理员登录',
      formDescription: '仅供智美天工平台运营团队使用。',
      submitLabel: '进入平台后台',
      alternateHref: '/login',
      alternateLabel: '机构工作台入口',
      metrics: [
        { value: '156', label: '入驻机构', detail: '租户、套餐与权限统一管理' },
        { value: '99.9%', label: '服务可用', detail: '平台级运行状态持续可观测' },
        { value: '24/7', label: '风险监控', detail: '关键接口、模型与连接器状态可追踪' },
      ],
      insights: [
        { title: '权限边界清晰', description: '平台运营、机构后台与租户数据保持隔离，降低误操作风险。' },
        { title: '平台运营中枢', description: '集中管理机构、套餐、模型、连接器与平台级数据资产。' },
      ],
    },
  },
};

const allowedHrefs = new Set(['/login', '#diagnosis', '#agents', '#journey', '#cases']);

function isSafeLink(value: string) {
  const trimmed = value.trim();
  return trimmed === '' || trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('https://');
}

export function cloneHomepageBrandConfig(config: HomepageBrandConfig): HomepageBrandConfig {
  const cloned = JSON.parse(JSON.stringify(config)) as HomepageBrandConfig;

  return {
    ...defaultHomepageBrandConfig,
    ...cloned,
    brand: { ...defaultHomepageBrandConfig.brand, ...cloned.brand },
    metadata: { ...defaultHomepageBrandConfig.metadata, ...cloned.metadata },
    footer: { ...defaultHomepageBrandConfig.footer, ...cloned.footer },
    assets: { ...defaultHomepageBrandConfig.assets, ...cloned.assets },
    navigation: {
      ...defaultHomepageBrandConfig.navigation,
      ...cloned.navigation,
      links: cloned.navigation?.links ?? defaultHomepageBrandConfig.navigation.links,
      cta: { ...defaultHomepageBrandConfig.navigation.cta, ...cloned.navigation?.cta },
    },
    hero: {
      ...defaultHomepageBrandConfig.hero,
      ...cloned.hero,
      primaryAction: { ...defaultHomepageBrandConfig.hero.primaryAction, ...cloned.hero?.primaryAction },
      secondaryAction: { ...defaultHomepageBrandConfig.hero.secondaryAction, ...cloned.hero?.secondaryAction },
    },
    metrics: cloned.metrics ?? defaultHomepageBrandConfig.metrics,
    growthCard: {
      ...defaultHomepageBrandConfig.growthCard,
      ...cloned.growthCard,
      rows: cloned.growthCard?.rows ?? defaultHomepageBrandConfig.growthCard.rows,
      insight: {
        ...defaultHomepageBrandConfig.growthCard.insight,
        ...cloned.growthCard?.insight,
        chips: cloned.growthCard?.insight?.chips ?? defaultHomepageBrandConfig.growthCard.insight.chips,
      },
    },
    login: {
      institution: {
        ...defaultHomepageBrandConfig.login.institution,
        ...cloned.login?.institution,
        metrics: cloned.login?.institution?.metrics ?? defaultHomepageBrandConfig.login.institution.metrics,
        insights: cloned.login?.institution?.insights ?? defaultHomepageBrandConfig.login.institution.insights,
      },
      platform: {
        ...defaultHomepageBrandConfig.login.platform,
        ...cloned.login?.platform,
        metrics: cloned.login?.platform?.metrics ?? defaultHomepageBrandConfig.login.platform.metrics,
        insights: cloned.login?.platform?.insights ?? defaultHomepageBrandConfig.login.platform.insights,
      },
    },
  };
}

export function validateHomepageBrandConfig(config: HomepageBrandConfig) {
  const errors: string[] = [];

  if (!config.brand.platformName.trim()) {
    errors.push('平台名称不能为空');
  }

  if (!config.metadata.title.trim()) {
    errors.push('首页标题不能为空');
  }

  if (!config.metadata.seoTitle.trim()) {
    errors.push('SEO标题不能为空');
  }

  if (!config.hero.titleLine.trim()) {
    errors.push('首页主标题不能为空');
  }

  if (!config.hero.accentLine.trim()) {
    errors.push('首页强调标题不能为空');
  }

  if (!config.hero.primaryAction.label.trim() || !config.hero.secondaryAction.label.trim()) {
    errors.push('首页按钮文字不能为空');
  }

  if (!config.login.institution.formTitle.trim()) {
    errors.push('机构登录页标题不能为空');
  }

  if (!config.login.institution.submitLabel.trim()) {
    errors.push('机构登录页按钮文字不能为空');
  }

  if (!config.login.platform.formTitle.trim()) {
    errors.push('平台登录页标题不能为空');
  }

  if (!config.login.platform.submitLabel.trim()) {
    errors.push('平台登录页按钮文字不能为空');
  }

  if (!isSafeLink(config.footer.icpUrl)) {
    errors.push('ICP备案链接不在白名单');
  }

  if (!isSafeLink(config.footer.policeUrl)) {
    errors.push('公安备案链接不在白名单');
  }

  for (const link of config.navigation.links) {
    if (!link.label.trim()) {
      errors.push('导航名称不能为空');
    }

    if (!allowedHrefs.has(link.href)) {
      errors.push(`导航地址不在白名单：${link.href}`);
    }
  }

  if (!allowedHrefs.has(config.navigation.cta.href)) {
    errors.push(`行动按钮地址不在白名单：${config.navigation.cta.href}`);
  }

  if (!allowedHrefs.has(config.hero.primaryAction.href)) {
    errors.push(`主按钮地址不在白名单：${config.hero.primaryAction.href}`);
  }

  if (!allowedHrefs.has(config.hero.secondaryAction.href)) {
    errors.push(`辅助按钮地址不在白名单：${config.hero.secondaryAction.href}`);
  }

  return errors;
}
