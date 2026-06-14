export type PlatformAiRuntimeProvider = 'openai_compatible';

export type PlatformAiRuntimeConfigStatus = {
  enabled: boolean;
  configured: boolean;
  provider: PlatformAiRuntimeProvider | 'unsupported' | null;
  model: string | null;
  baseUrlConfigured: boolean;
  missingKeys: string[];
};

export type PlatformAiRuntimeStatusResponse = PlatformAiRuntimeConfigStatus & {
  readonly: true;
  dataSource: 'env_only';
  safety: {
    title: 'AI Runtime env-only 可用性';
    keyPolicy: 'API Key 仅从服务端环境变量读取，不在页面输入、不回显、不保存。';
    smokePolicy: '真实调用仅用于固定 smoke test，不接收用户 prompt。';
  };
};

const RUNTIME_ENV_KEYS = {
  enabled: 'ZMTG_AI_RUNTIME_ENABLED',
  provider: 'ZMTG_AI_PROVIDER',
  baseUrl: 'ZMTG_AI_BASE_URL',
  auth: 'ZMTG_AI_API_KEY',
  model: 'ZMTG_AI_MODEL',
} as const;

function readEnvValue(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function normalizeProvider(value: string | null): PlatformAiRuntimeProvider | 'unsupported' | null {
  if (!value) return null;
  return value === 'openai_compatible' ? 'openai_compatible' : 'unsupported';
}

export function readPlatformAiRuntimeConfig(): PlatformAiRuntimeConfigStatus {
  const enabledValue = readEnvValue(RUNTIME_ENV_KEYS.enabled);
  const providerValue = readEnvValue(RUNTIME_ENV_KEYS.provider);
  const baseUrl = readEnvValue(RUNTIME_ENV_KEYS.baseUrl);
  const authValue = readEnvValue(RUNTIME_ENV_KEYS.auth);
  const model = readEnvValue(RUNTIME_ENV_KEYS.model);
  const provider = normalizeProvider(providerValue);
  const enabled = enabledValue === 'true';
  const missingKeys: string[] = [];

  if (!enabled) missingKeys.push(RUNTIME_ENV_KEYS.enabled);
  if (provider !== 'openai_compatible') missingKeys.push(RUNTIME_ENV_KEYS.provider);
  if (!baseUrl) missingKeys.push(RUNTIME_ENV_KEYS.baseUrl);
  if (!authValue) missingKeys.push(RUNTIME_ENV_KEYS.auth);
  if (!model) missingKeys.push(RUNTIME_ENV_KEYS.model);

  return {
    enabled,
    configured: provider === 'openai_compatible' && Boolean(baseUrl && authValue && model),
    provider,
    model,
    baseUrlConfigured: Boolean(baseUrl),
    missingKeys,
  };
}

export function getPlatformAiRuntimeStatus(): PlatformAiRuntimeStatusResponse {
  return {
    readonly: true,
    dataSource: 'env_only',
    ...readPlatformAiRuntimeConfig(),
    safety: {
      title: 'AI Runtime env-only 可用性',
      keyPolicy: 'API Key 仅从服务端环境变量读取，不在页面输入、不回显、不保存。',
      smokePolicy: '真实调用仅用于固定 smoke test，不接收用户 prompt。',
    },
  };
}
