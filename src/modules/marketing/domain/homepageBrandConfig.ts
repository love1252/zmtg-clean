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

export type HomepageBrandContentCard = {
  id: string;
  marker?: string;
  icon?: string;
  title: string;
  description: string;
  items?: string[];
  hot?: boolean;
};

export type HomepageBrandContentSection = {
  kicker: string;
  title: string;
  description: string;
  cards: HomepageBrandContentCard[];
};

export type HomepageBrandJourneyLane = {
  id: string;
  title: string;
  cards: HomepageBrandContentCard[];
};

export type HomepageBrandJourneySection = HomepageBrandContentSection & {
  boardTitle: string;
  boardSummary: string;
  lanes: HomepageBrandJourneyLane[];
};

export type HomepageBrandCaseSection = {
  kicker: string;
  title: string;
  description: string;
  quote: string;
  author: string;
  stats: Array<{ id: string; value: string; label: string }>;
};

export type HomepageBrandPricingPlan = {
  id: string;
  title: string;
  description: string;
  price: string;
  period: string;
  featured: boolean;
  features: string[];
};

export type HomepageBrandPricingSection = {
  kicker: string;
  title: string;
  description: string;
  plans: HomepageBrandPricingPlan[];
};

export type HomepageBrandFinalCtaSection = {
  title: string;
  description: string;
  action: HomepageBrandAction;
};

export type HomepageBrandContentSections = {
  diagnosis: HomepageBrandContentSection;
  journey: HomepageBrandJourneySection;
  agents: HomepageBrandContentSection;
  cases: HomepageBrandCaseSection;
  pricing: HomepageBrandPricingSection;
  finalCta: HomepageBrandFinalCtaSection;
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
  sections: HomepageBrandContentSections;
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
  sections: {
    diagnosis: {
      kicker: 'GROWTH DIAGNOSIS',
      title: '先诊断增长断点，再配置智能体',
      description: '页面不再堆功能，而是把机构最关心的经营问题拆成四个可被 AI 协同解决的环节。',
      cards: [
        { id: 'customer-assets', marker: '01', title: '客户资产分散', description: '客户记录、项目偏好和跟进状态散落在不同账号和表格，团队无法统一复盘。' },
        { id: 'consulting', marker: '02', title: '咨询承接不稳定', description: '新客咨询高峰期容易漏回，资深咨询师时间被低意向客户消耗。' },
        { id: 'aftercare', marker: '03', title: '术后关怀难坚持', description: '术后提醒、恢复反馈和复诊邀约靠人工记忆，服务标准难复制。' },
        { id: 'repurchase', marker: '04', title: '复购机会不可见', description: '客户进入补水、修复、抗衰等复购窗口时，系统没有及时提醒团队承接。' },
      ],
    },
    journey: {
      kicker: 'CUSTOMER JOURNEY',
      title: '把医美客户旅程做成可运营资产',
      description: '从咨询、到院、术后到复购，每个节点都可以由智能体提示、触达、转人工和复盘。',
      cards: [
        { id: 'new-consult', marker: '1', title: '新客咨询', description: 'AI 接待基础问题，识别高意向、禁忌风险和价格异议。' },
        { id: 'appointment', marker: '2', title: '预约到院', description: '提醒到院时间、术前注意事项，并把关键诉求同步给咨询师。' },
        { id: 'aftercare', marker: '3', title: '术后关怀', description: '按项目自动发送护理提醒，异常反馈及时转人工。' },
        { id: 'repurchase', marker: '4', title: '复购召回', description: '根据恢复周期和历史偏好，提示适合承接的复购窗口。' },
      ],
      boardTitle: '智美天工 · 旅程运营看板',
      boardSummary: '本周 216 个高意向机会',
      lanes: [
        { id: 'new-consult', title: '新客咨询', cards: [{ id: 'price', title: '玻尿酸价格咨询', description: 'AI 建议：转人工', hot: true }, { id: 'thermage', title: '热玛吉恢复期问题', description: '' }, { id: 'waterlight', title: '水光针禁忌咨询', description: '' }] },
        { id: 'appointment', title: '到院邀约', cards: [{ id: 'tomorrow', title: '明日到院提醒', description: '' }, { id: 'schedule', title: '高预算客户确认档期', description: '', hot: true }, { id: 'prep', title: '术前注意事项', description: '' }] },
        { id: 'aftercare', title: '术后关怀', cards: [{ id: 'swelling', title: '第 3 天红肿反馈', description: '' }, { id: 'followup', title: '第 7 天复诊提醒', description: '' }, { id: 'risk', title: '异常症状转人工', description: '', hot: true }] },
        { id: 'repurchase', title: '复购召回', cards: [{ id: 'repair', title: '补水修复窗口', description: '', hot: true }, { id: 'anti-aging', title: '抗衰项目推荐', description: '' }, { id: 'birthday', title: '会员生日关怀', description: '' }] },
      ],
    },
    agents: {
      kicker: 'AI AGENTS',
      title: '不是一个客服机器人，而是一组医美增长智能体',
      description: '每个智能体负责一个经营场景，并遵守医美合规话术边界。',
      cards: [
        { id: 'consulting', icon: '咨', title: '咨询转化智能体', description: '辅助接待新客，提炼需求，识别高意向并提示人工承接。', items: ['项目知识问答', '价格异议处理', '风险话术提醒'] },
        { id: 'aftercare', icon: '护', title: '术后关怀智能体', description: '根据项目周期自动发送护理提醒，收集恢复反馈并识别异常。', items: ['护理 SOP 触达', '复诊提醒', '异常转人工'] },
        { id: 'growth', icon: '营', title: '复购增长智能体', description: '结合客户偏好、恢复阶段和历史项目，发现适合跟进的增长机会。', items: ['复购窗口识别', '人群分层', '召回话术建议'] },
      ],
    },
    cases: {
      kicker: 'RESULTS',
      title: '让经营结果看得见',
      description: '比“用了 AI”更重要的是：客户有没有被及时承接，服务有没有持续发生，复购有没有被唤醒。',
      quote: '“上线后，咨询师每天打开系统先看高意向客户和复购窗口，不再靠人工翻聊天记录。术后关怀稳定了，客户体验也更一致。”',
      author: '某连锁医美机构 · 运营总监',
      stats: [
        { id: 'repurchase', value: '35%', label: '复购率提升' },
        { id: 'response', value: '2.4x', label: '咨询响应效率' },
        { id: 'risk', value: '40%', label: '客诉风险下降' },
      ],
    },
    pricing: {
      kicker: 'PLANS',
      title: '按机构阶段选择增长方案',
      description: '试用版先验证一条核心客户旅程，专业版跑通单店增长，企业版复制到多门店。',
      plans: [
        { id: 'trial', title: '试用版', description: '验证核心旅程', price: '¥0', period: '/14天', featured: false, features: ['客户管理基础功能', 'AI 咨询助手', '3 条随访旅程', '基础数据分析'] },
        { id: 'professional', title: '专业版', description: '适合单店和成长期机构', price: '¥2,999', period: '/月', featured: true, features: ['无限随访旅程', '企业微信客户同步', 'AI 优先响应', '营销自动化与数据导出'] },
        { id: 'enterprise', title: '企业版', description: '适合连锁机构', price: '¥7,999', period: '/月', featured: false, features: ['多门店统一管理', '专属成功经理', '高级数据分析', '私有化与定制方案'] },
      ],
    },
    finalCta: {
      title: '先从一条客户旅程开始，看到 AI 带来的真实增长',
      description: '我们会帮机构梳理咨询、到院、术后和复购四个关键节点，先配置一条可运行的增长旅程，再逐步扩展到完整智能运营中台。',
      action: { label: '预约增长诊断 →', href: '/login' },
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
    sections: {
      diagnosis: {
        ...defaultHomepageBrandConfig.sections.diagnosis,
        ...cloned.sections?.diagnosis,
        cards: cloned.sections?.diagnosis?.cards ?? defaultHomepageBrandConfig.sections.diagnosis.cards,
      },
      journey: {
        ...defaultHomepageBrandConfig.sections.journey,
        ...cloned.sections?.journey,
        cards: cloned.sections?.journey?.cards ?? defaultHomepageBrandConfig.sections.journey.cards,
        lanes: cloned.sections?.journey?.lanes ?? defaultHomepageBrandConfig.sections.journey.lanes,
      },
      agents: {
        ...defaultHomepageBrandConfig.sections.agents,
        ...cloned.sections?.agents,
        cards: cloned.sections?.agents?.cards ?? defaultHomepageBrandConfig.sections.agents.cards,
      },
      cases: {
        ...defaultHomepageBrandConfig.sections.cases,
        ...cloned.sections?.cases,
        stats: cloned.sections?.cases?.stats ?? defaultHomepageBrandConfig.sections.cases.stats,
      },
      pricing: {
        ...defaultHomepageBrandConfig.sections.pricing,
        ...cloned.sections?.pricing,
        plans: cloned.sections?.pricing?.plans ?? defaultHomepageBrandConfig.sections.pricing.plans,
      },
      finalCta: {
        ...defaultHomepageBrandConfig.sections.finalCta,
        ...cloned.sections?.finalCta,
        action: { ...defaultHomepageBrandConfig.sections.finalCta.action, ...cloned.sections?.finalCta?.action },
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

  if (!allowedHrefs.has(config.sections.finalCta.action.href)) {
    errors.push(`底部转化按钮地址不在白名单：${config.sections.finalCta.action.href}`);
  }

  return errors;
}
