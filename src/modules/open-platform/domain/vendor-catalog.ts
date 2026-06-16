export type SupportedVendor = 'doubao' | 'deepseek' | 'qwen' | 'chatglm' | 'kimi';

export type SupportedVendorConfig = {
  vendor: SupportedVendor;
  displayName: string;
  defaultBaseUrl: string;
  defaultModel: string;
};

const SUPPORTED_VENDOR_CONFIGS: Record<SupportedVendor, Omit<SupportedVendorConfig, 'vendor'>> = {
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
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'kimi-k2-5-260127',
  },
} as const;

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
