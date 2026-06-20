type SupportedVendorConfigFields = {
  displayName: string;
  defaultBaseUrl: string;
  defaultModel: string;
};

const SUPPORTED_VENDOR_CONFIGS = {
  doubao: {
    displayName: '豆包 (Volcengine)',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-seed-1-8-251228',
  },
  deepseek: {
    displayName: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-v4-flash',
  },
  qwen: {
    displayName: '通义千问',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus-latest',
  },
  chatglm: {
    displayName: '智谱 GLM',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4.7-flash',
  },
  kimi: {
    displayName: 'Kimi',
    defaultBaseUrl: 'https://api.moonshot.ai/v1',
    defaultModel: 'kimi-k2-5-260127',
  },
} as const satisfies Record<string, SupportedVendorConfigFields>;

export type SupportedVendor = keyof typeof SUPPORTED_VENDOR_CONFIGS;

export type SupportedVendorConfig = SupportedVendorConfigFields & {
  vendor: SupportedVendor;
};

const SUPPORTED_VENDOR_KEYS = Object.keys(SUPPORTED_VENDOR_CONFIGS) as SupportedVendor[];

export function listSupportedVendors(): SupportedVendor[] {
  return [...SUPPORTED_VENDOR_KEYS];
}

export function isSupportedVendor(value: unknown): value is SupportedVendor {
  return typeof value === 'string' && SUPPORTED_VENDOR_KEYS.includes(value as SupportedVendor);
}

export function getSupportedVendorConfig(vendor: SupportedVendor): SupportedVendorConfig {
  return { vendor, ...SUPPORTED_VENDOR_CONFIGS[vendor] };
}
