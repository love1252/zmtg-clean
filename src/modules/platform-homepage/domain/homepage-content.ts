export type PlatformHomepageStatus = 'draft' | 'published';

export type PlatformHomepageLink = {
  id: string;
  label: string;
  href: string;
};

export type PlatformHomepageImage = {
  alt: string;
  imageUrl?: string;
  assetId?: string;
};

export type PlatformHomepageHeader = {
  brandName: string;
  logo: PlatformHomepageImage;
  navigation: PlatformHomepageLink[];
  primaryAction: PlatformHomepageLink;
};

export type PlatformHomepageHero = {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryAction: PlatformHomepageLink;
  secondaryAction: PlatformHomepageLink;
  image: PlatformHomepageImage;
};

export type PlatformHomepageStatsItem = {
  id: string;
  value: string;
  label: string;
  description: string;
};

export type PlatformHomepageFeatureItem = {
  id: string;
  title: string;
  description: string;
  icon: string;
  image?: PlatformHomepageImage;
};

export type PlatformHomepageClientItem = {
  id: string;
  name: string;
  industry: string;
  quote: string;
  logo: PlatformHomepageImage;
};

export type PlatformHomepagePlanItem = {
  id: string;
  name: string;
  summary: string;
  priceLabel: string;
  highlight: boolean;
  features: string[];
  action: PlatformHomepageLink;
};

export type PlatformHomepageFooterSection = {
  id: string;
  title: string;
  links: PlatformHomepageLink[];
};

export type PlatformHomepageFooter = {
  slogan: string;
  contactEmail: string;
  sections: PlatformHomepageFooterSection[];
  copyright: string;
};

export type PlatformHomepageSeo = {
  title: string;
  description: string;
  keywords: string[];
  canonicalUrl: string;
  ogImage: PlatformHomepageImage;
};

export type PlatformHomepageMetadata = {
  contentId: string;
  version: number;
  status: PlatformHomepageStatus;
  updatedAt: string;
  updatedBy: string;
  publishedAt: string | null;
  publishedBy: string | null;
  changeSummary: string;
};

export type PlatformHomepageContent = PlatformHomepageMetadata & {
  header: PlatformHomepageHeader;
  hero: PlatformHomepageHero;
  stats: PlatformHomepageStatsItem[];
  features: PlatformHomepageFeatureItem[];
  clients: PlatformHomepageClientItem[];
  plans: PlatformHomepagePlanItem[];
  footer: PlatformHomepageFooter;
  seo: PlatformHomepageSeo;
};

export type PlatformHomepageMetadataInput = {
  actorId: string;
  now: string;
  status?: PlatformHomepageStatus;
  changeSummary: string;
};

export type PlatformHomepageValidationErrorCode =
  | 'array_length'
  | 'base64_image'
  | 'empty_asset_id'
  | 'empty_text'
  | 'empty_url'
  | 'forbidden_knowledge_base_field'
  | 'invalid_status'
  | 'invalid_utf8_text'
  | 'text_too_long'
  | 'unsafe_url';

export type PlatformHomepageValidationError = {
  path: string;
  code: PlatformHomepageValidationErrorCode;
  message: string;
};

export type PlatformHomepageValidationResult = {
  valid: boolean;
  normalizedContent: PlatformHomepageContent;
  errors: PlatformHomepageValidationError[];
};

type ArrayLimit = {
  min: number;
  max: number;
};

export const platformHomepageContentArrayLimits = {
  navigation: { min: 1, max: 8 },
  stats: { min: 2, max: 6 },
  features: { min: 3, max: 8 },
  clients: { min: 1, max: 12 },
  plans: { min: 1, max: 4 },
  planFeatures: { min: 1, max: 8 },
  footerSections: { min: 1, max: 6 },
  footerLinks: { min: 1, max: 8 },
  seoKeywords: { min: 1, max: 10 },
} as const satisfies Record<string, ArrayLimit>;

export const platformHomepageSeoLengthLimits = {
  title: 80,
  description: 180,
  keyword: 24,
} as const;

export const platformHomepageContentFieldSchema = {
  sections: ['header', 'hero', 'stats', 'features', 'clients', 'plans', 'footer', 'seo'],
  metadata: [
    'contentId',
    'version',
    'status',
    'updatedAt',
    'updatedBy',
    'publishedAt',
    'publishedBy',
    'changeSummary',
  ],
  imageFields: ['imageUrl', 'assetId'],
} as const;

const knowledgeBaseSensitiveFields = [
  'uploadUrl',
  'downloadUrl',
  'fileContent',
  'embedding',
  'chunkText',
] as const;

const defaultPublishedPlatformHomepageContent: PlatformHomepageContent = {
  contentId: 'platform-homepage-default',
  version: 1,
  status: 'published',
  updatedAt: '2026-06-13T00:00:00.000Z',
  updatedBy: 'system',
  publishedAt: '2026-06-13T00:00:00.000Z',
  publishedBy: 'system',
  changeSummary: '默认发布首页内容',
  header: {
    brandName: '智美天工',
    logo: {
      alt: '智美天工标识',
      assetId: 'brand-logo-zmtg',
    },
    navigation: [
      { id: 'nav-product', label: '产品', href: '/#features' },
      { id: 'nav-clients', label: '客户', href: '/#clients' },
      { id: 'nav-plans', label: '套餐', href: '/#plans' },
    ],
    primaryAction: {
      id: 'header-console',
      label: '进入平台',
      href: '/open-platform',
    },
  },
  hero: {
    eyebrow: '医美机构增长与运营平台',
    title: '智美天工，让医美经营闭环更清晰',
    subtitle: '连接客户经营、预约转化、智能随访和平台治理，为机构沉淀可持续增长能力。',
    primaryAction: {
      id: 'hero-console',
      label: '进入开放平台',
      href: '/open-platform',
    },
    secondaryAction: {
      id: 'hero-plans',
      label: '查看套餐',
      href: '/#plans',
    },
    image: {
      alt: '平台首页运营看板示意',
      imageUrl: '/images/platform-homepage/hero-dashboard.png',
    },
  },
  stats: [
    {
      id: 'stat-followups',
      value: '10k+',
      label: '随访触达',
      description: '围绕治疗节点沉淀标准化客户经营动作。',
    },
    {
      id: 'stat-appointments',
      value: '2k+',
      label: '预约协同',
      description: '统一跟进、预约和转化节奏，降低跨角色沟通成本。',
    },
    {
      id: 'stat-governance',
      value: '100%',
      label: '治理可追踪',
      description: '关键配置、配额和审计信息可回看、可解释。',
    },
  ],
  features: [
    {
      id: 'feature-customer-loop',
      title: '客户经营闭环',
      description: '把客户分层、预约、复购和沉睡唤醒纳入同一套运营视图。',
      icon: 'users',
    },
    {
      id: 'feature-smart-followup',
      title: '智能随访建议',
      description: '围绕治疗路径生成低敏摘要和建议，辅助机构做精细化服务。',
      icon: 'sparkles',
    },
    {
      id: 'feature-platform-governance',
      title: '平台治理底座',
      description: '通过租户、套餐、配额和审计能力支撑规模化运营管理。',
      icon: 'shield-check',
    },
  ],
  clients: [
    {
      id: 'client-demo-medical-aesthetic',
      name: '澄境医美',
      industry: '连锁医美机构',
      quote: '首页、平台端和机构端信息统一后，经营节奏更容易被团队理解和执行。',
      logo: {
        alt: '澄境医美标识',
        assetId: 'client-logo-chengjing',
      },
    },
  ],
  plans: [
    {
      id: 'plan-starter',
      name: '标准版',
      summary: '适合单院区启动客户经营闭环。',
      priceLabel: '按机构规模报价',
      highlight: false,
      features: ['客户经营看板', '预约与随访协同', '基础审计记录'],
      action: {
        id: 'plan-starter-contact',
        label: '了解标准版',
        href: '/contact',
      },
    },
    {
      id: 'plan-growth',
      name: '成长版',
      summary: '适合多角色协同和持续增长运营。',
      priceLabel: '推荐方案',
      highlight: true,
      features: ['智能随访建议', '租户套餐管理', '配额与商业健康看板'],
      action: {
        id: 'plan-growth-contact',
        label: '预约演示',
        href: '/contact',
      },
    },
  ],
  footer: {
    slogan: '智美天工，沉淀可治理的医美增长能力。',
    contactEmail: 'hello@zmtg.example',
    sections: [
      {
        id: 'footer-product',
        title: '产品',
        links: [
          { id: 'footer-features', label: '核心能力', href: '/#features' },
          { id: 'footer-plans', label: '套餐方案', href: '/#plans' },
        ],
      },
      {
        id: 'footer-company',
        title: '公司',
        links: [
          { id: 'footer-contact', label: '联系我们', href: '/contact' },
          { id: 'footer-console', label: '开放平台', href: '/open-platform' },
        ],
      },
    ],
    copyright: 'Copyright 2026 智美天工',
  },
  seo: {
    title: '智美天工 - 医美机构增长与运营平台',
    description: '智美天工为医美机构提供客户经营、预约转化、智能随访和平台治理的一体化能力。',
    keywords: ['智美天工', '医美运营', '客户经营', '智能随访', '平台治理'],
    canonicalUrl: '/',
    ogImage: {
      alt: '智美天工首页分享图',
      imageUrl: '/images/platform-homepage/og.png',
    },
  },
};

function cloneContent(content: PlatformHomepageContent): PlatformHomepageContent {
  return JSON.parse(JSON.stringify(content)) as PlatformHomepageContent;
}

function pushError(
  errors: PlatformHomepageValidationError[],
  path: string,
  code: PlatformHomepageValidationErrorCode,
  message: string,
): void {
  errors.push({ path, code, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasInvalidUtf8Text(value: string): boolean {
  return /(?:\uFFFD|ï¿½|Ã.|Â.|æ™|ç¾|å¤|å·)/.test(value);
}

function normalizeText(
  value: string,
  path: string,
  errors: PlatformHomepageValidationError[],
  maxLength?: number,
): string {
  const normalized = value.trim().replace(/\s+/g, ' ');

  if (normalized.length === 0) {
    pushError(errors, path, 'empty_text', '文案不能为空');
  }

  if (typeof maxLength === 'number' && normalized.length > maxLength) {
    pushError(errors, path, 'text_too_long', `文案长度不能超过 ${maxLength}`);
  }

  if (hasInvalidUtf8Text(normalized)) {
    pushError(errors, path, 'invalid_utf8_text', '文案疑似 UTF-8 乱码');
  }

  return normalized;
}

function normalizeUrl(
  value: string,
  path: string,
  errors: PlatformHomepageValidationError[],
): string {
  const normalized = value.trim();
  const lower = normalized.toLowerCase();

  if (normalized.length === 0) {
    pushError(errors, path, 'empty_url', '链接不能为空');
    return normalized;
  }

  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    normalized.startsWith('//')
  ) {
    pushError(errors, path, 'unsafe_url', '链接只允许相对路径或 http/https');
    return normalized;
  }

  const protocolMatch = normalized.match(/^([a-z][a-z0-9+.-]*):/i);

  if (protocolMatch && protocolMatch[1].toLowerCase() !== 'http' && protocolMatch[1].toLowerCase() !== 'https') {
    pushError(errors, path, 'unsafe_url', '链接只允许相对路径或 http/https');
  }

  return normalized;
}

function validateArrayLength(
  value: readonly unknown[],
  path: string,
  limit: ArrayLimit,
  errors: PlatformHomepageValidationError[],
): void {
  if (value.length < limit.min || value.length > limit.max) {
    pushError(
      errors,
      path,
      'array_length',
      `数组长度必须在 ${limit.min} 到 ${limit.max} 之间`,
    );
  }
}

function normalizeLink(
  link: PlatformHomepageLink,
  path: string,
  errors: PlatformHomepageValidationError[],
): PlatformHomepageLink {
  return {
    id: normalizeText(link.id, `${path}.id`, errors),
    label: normalizeText(link.label, `${path}.label`, errors),
    href: normalizeUrl(link.href, `${path}.href`, errors),
  };
}

function normalizeImage(
  image: PlatformHomepageImage,
  path: string,
  errors: PlatformHomepageValidationError[],
): PlatformHomepageImage {
  const normalized: PlatformHomepageImage = {
    alt: normalizeText(image.alt, `${path}.alt`, errors),
  };

  if (typeof image.imageUrl === 'string') {
    const imageUrl = normalizeUrl(image.imageUrl, `${path}.imageUrl`, errors);
    const lower = imageUrl.toLowerCase();

    if (lower.startsWith('data:image/') || lower.includes(';base64,')) {
      pushError(errors, `${path}.imageUrl`, 'base64_image', '图片字段禁止 Base64');
    }

    normalized.imageUrl = imageUrl;
  }

  if (typeof image.assetId === 'string') {
    const assetId = image.assetId.trim();

    if (assetId.length === 0) {
      pushError(errors, `${path}.assetId`, 'empty_asset_id', 'assetId 不能为空');
    }

    if (assetId.toLowerCase().startsWith('data:') || assetId.toLowerCase().includes('base64')) {
      pushError(errors, `${path}.assetId`, 'base64_image', '图片字段禁止 Base64');
    }

    normalized.assetId = assetId;
  }

  if (!normalized.imageUrl && !normalized.assetId) {
    pushError(errors, path, 'empty_asset_id', '图片必须提供 imageUrl 或 assetId');
  }

  return normalized;
}

function scanForbiddenKnowledgeBaseFields(
  value: unknown,
  path: string,
  errors: PlatformHomepageValidationError[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      scanForbiddenKnowledgeBaseFields(item, `${path}[${index}]`, errors);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  Object.entries(value).forEach(([field, fieldValue]) => {
    const fieldPath = path === '$' ? `$.${field}` : `${path}.${field}`;

    if (knowledgeBaseSensitiveFields.includes(field as (typeof knowledgeBaseSensitiveFields)[number])) {
      pushError(
        errors,
        fieldPath,
        'forbidden_knowledge_base_field',
        '首页内容合同禁止包含知识库敏感字段',
      );
    }

    scanForbiddenKnowledgeBaseFields(fieldValue, fieldPath, errors);
  });
}

export function getDefaultPublishedPlatformHomepageContent(): PlatformHomepageContent {
  return cloneContent(defaultPublishedPlatformHomepageContent);
}

export function generateNextPlatformHomepageMetadata(
  previous: PlatformHomepageMetadata,
  input: PlatformHomepageMetadataInput,
): PlatformHomepageMetadata {
  const status = input.status ?? 'draft';

  return {
    contentId: previous.contentId,
    version: previous.version + 1,
    status,
    updatedAt: input.now,
    updatedBy: input.actorId,
    publishedAt: status === 'published' ? input.now : null,
    publishedBy: status === 'published' ? input.actorId : null,
    changeSummary: input.changeSummary.trim(),
  };
}

export function createPlatformHomepageDraft(
  publishedContent: PlatformHomepageContent,
  input: Omit<PlatformHomepageMetadataInput, 'status'>,
): PlatformHomepageContent {
  return {
    ...cloneContent(publishedContent),
    ...generateNextPlatformHomepageMetadata(publishedContent, {
      ...input,
      status: 'draft',
    }),
  };
}

export function validatePlatformHomepageDraftContent(
  draftContent: PlatformHomepageContent,
): PlatformHomepageValidationResult {
  const errors: PlatformHomepageValidationError[] = [];
  const normalizedContent = cloneContent(draftContent);

  if (normalizedContent.status !== 'draft') {
    pushError(errors, '$.status', 'invalid_status', '只能校验 draft 首页内容');
  }

  scanForbiddenKnowledgeBaseFields(normalizedContent, '$', errors);

  normalizedContent.contentId = normalizeText(normalizedContent.contentId, '$.contentId', errors);
  normalizedContent.updatedAt = normalizeText(normalizedContent.updatedAt, '$.updatedAt', errors);
  normalizedContent.updatedBy = normalizeText(normalizedContent.updatedBy, '$.updatedBy', errors);
  normalizedContent.changeSummary = normalizeText(
    normalizedContent.changeSummary,
    '$.changeSummary',
    errors,
    200,
  );

  normalizedContent.header = {
    brandName: normalizeText(normalizedContent.header.brandName, '$.header.brandName', errors),
    logo: normalizeImage(normalizedContent.header.logo, '$.header.logo', errors),
    navigation: normalizedContent.header.navigation.map((link, index) =>
      normalizeLink(link, `$.header.navigation[${index}]`, errors),
    ),
    primaryAction: normalizeLink(
      normalizedContent.header.primaryAction,
      '$.header.primaryAction',
      errors,
    ),
  };
  validateArrayLength(
    normalizedContent.header.navigation,
    '$.header.navigation',
    platformHomepageContentArrayLimits.navigation,
    errors,
  );

  normalizedContent.hero = {
    eyebrow: normalizeText(normalizedContent.hero.eyebrow, '$.hero.eyebrow', errors),
    title: normalizeText(normalizedContent.hero.title, '$.hero.title', errors),
    subtitle: normalizeText(normalizedContent.hero.subtitle, '$.hero.subtitle', errors),
    primaryAction: normalizeLink(
      normalizedContent.hero.primaryAction,
      '$.hero.primaryAction',
      errors,
    ),
    secondaryAction: normalizeLink(
      normalizedContent.hero.secondaryAction,
      '$.hero.secondaryAction',
      errors,
    ),
    image: normalizeImage(normalizedContent.hero.image, '$.hero.image', errors),
  };

  validateArrayLength(
    normalizedContent.stats,
    '$.stats',
    platformHomepageContentArrayLimits.stats,
    errors,
  );
  normalizedContent.stats = normalizedContent.stats.map((item, index) => ({
    id: normalizeText(item.id, `$.stats[${index}].id`, errors),
    value: normalizeText(item.value, `$.stats[${index}].value`, errors),
    label: normalizeText(item.label, `$.stats[${index}].label`, errors),
    description: normalizeText(item.description, `$.stats[${index}].description`, errors),
  }));

  validateArrayLength(
    normalizedContent.features,
    '$.features',
    platformHomepageContentArrayLimits.features,
    errors,
  );
  normalizedContent.features = normalizedContent.features.map((item, index) => ({
    id: normalizeText(item.id, `$.features[${index}].id`, errors),
    title: normalizeText(item.title, `$.features[${index}].title`, errors),
    description: normalizeText(item.description, `$.features[${index}].description`, errors),
    icon: normalizeText(item.icon, `$.features[${index}].icon`, errors),
    ...(item.image
      ? {
          image: normalizeImage(item.image, `$.features[${index}].image`, errors),
        }
      : {}),
  }));

  validateArrayLength(
    normalizedContent.clients,
    '$.clients',
    platformHomepageContentArrayLimits.clients,
    errors,
  );
  normalizedContent.clients = normalizedContent.clients.map((item, index) => ({
    id: normalizeText(item.id, `$.clients[${index}].id`, errors),
    name: normalizeText(item.name, `$.clients[${index}].name`, errors),
    industry: normalizeText(item.industry, `$.clients[${index}].industry`, errors),
    quote: normalizeText(item.quote, `$.clients[${index}].quote`, errors),
    logo: normalizeImage(item.logo, `$.clients[${index}].logo`, errors),
  }));

  validateArrayLength(
    normalizedContent.plans,
    '$.plans',
    platformHomepageContentArrayLimits.plans,
    errors,
  );
  normalizedContent.plans = normalizedContent.plans.map((item, index) => {
    validateArrayLength(
      item.features,
      `$.plans[${index}].features`,
      platformHomepageContentArrayLimits.planFeatures,
      errors,
    );

    return {
      id: normalizeText(item.id, `$.plans[${index}].id`, errors),
      name: normalizeText(item.name, `$.plans[${index}].name`, errors),
      summary: normalizeText(item.summary, `$.plans[${index}].summary`, errors),
      priceLabel: normalizeText(item.priceLabel, `$.plans[${index}].priceLabel`, errors),
      highlight: item.highlight,
      features: item.features.map((feature, featureIndex) =>
        normalizeText(feature, `$.plans[${index}].features[${featureIndex}]`, errors),
      ),
      action: normalizeLink(item.action, `$.plans[${index}].action`, errors),
    };
  });

  validateArrayLength(
    normalizedContent.footer.sections,
    '$.footer.sections',
    platformHomepageContentArrayLimits.footerSections,
    errors,
  );
  normalizedContent.footer = {
    slogan: normalizeText(normalizedContent.footer.slogan, '$.footer.slogan', errors),
    contactEmail: normalizeText(
      normalizedContent.footer.contactEmail,
      '$.footer.contactEmail',
      errors,
      120,
    ),
    sections: normalizedContent.footer.sections.map((section, sectionIndex) => {
      validateArrayLength(
        section.links,
        `$.footer.sections[${sectionIndex}].links`,
        platformHomepageContentArrayLimits.footerLinks,
        errors,
      );

      return {
        id: normalizeText(section.id, `$.footer.sections[${sectionIndex}].id`, errors),
        title: normalizeText(section.title, `$.footer.sections[${sectionIndex}].title`, errors),
        links: section.links.map((link, linkIndex) =>
          normalizeLink(link, `$.footer.sections[${sectionIndex}].links[${linkIndex}]`, errors),
        ),
      };
    }),
    copyright: normalizeText(normalizedContent.footer.copyright, '$.footer.copyright', errors),
  };

  validateArrayLength(
    normalizedContent.seo.keywords,
    '$.seo.keywords',
    platformHomepageContentArrayLimits.seoKeywords,
    errors,
  );
  normalizedContent.seo = {
    title: normalizeText(
      normalizedContent.seo.title,
      '$.seo.title',
      errors,
      platformHomepageSeoLengthLimits.title,
    ),
    description: normalizeText(
      normalizedContent.seo.description,
      '$.seo.description',
      errors,
      platformHomepageSeoLengthLimits.description,
    ),
    keywords: normalizedContent.seo.keywords.map((keyword, index) =>
      normalizeText(
        keyword,
        `$.seo.keywords[${index}]`,
        errors,
        platformHomepageSeoLengthLimits.keyword,
      ),
    ),
    canonicalUrl: normalizeUrl(normalizedContent.seo.canonicalUrl, '$.seo.canonicalUrl', errors),
    ogImage: normalizeImage(normalizedContent.seo.ogImage, '$.seo.ogImage', errors),
  };

  return {
    valid: errors.length === 0,
    normalizedContent,
    errors,
  };
}
