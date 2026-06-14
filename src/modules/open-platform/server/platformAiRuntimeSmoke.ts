import {
  readPlatformAiRuntimeConfig,
  type PlatformAiRuntimeProvider,
} from '@/modules/open-platform/server/platformAiRuntimeConfig';
import {
  readSavedPlatformAiRuntimeConfig,
  type PlatformAiProviderConfigRepository,
} from '@/modules/open-platform/server/platformAiProviderConfig';

export type PlatformAiRuntimeSmokeResult = {
  ok: boolean;
  status: 'skipped' | 'ok' | 'failed';
  latencyMs: number;
  provider: PlatformAiRuntimeProvider | 'unsupported' | null;
  model: string | null;
  checkedAt: string;
  errorCode: 'RUNTIME_NOT_CONFIGURED' | 'PROVIDER_REQUEST_FAILED' | 'PROVIDER_TIMEOUT' | null;
};

const SMOKE_PROMPT = 'Return OK only.';
const SMOKE_TIMEOUT_MS = 8000;

function readEnvValue(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '');
}

function buildResult(
  result: Omit<PlatformAiRuntimeSmokeResult, 'checkedAt'>,
): PlatformAiRuntimeSmokeResult {
  return {
    ...result,
    checkedAt: new Date().toISOString(),
  };
}

async function readSavedRuntimeConfig(input?: {
  providerConfigRepository?: Pick<PlatformAiProviderConfigRepository, 'findProviderConfig'>;
}) {
  if (!input?.providerConfigRepository) return null;

  try {
    return await readSavedPlatformAiRuntimeConfig({ repository: input.providerConfigRepository });
  } catch {
    return null;
  }
}

export async function runPlatformAiRuntimeSmokeTest(input?: {
  providerConfigRepository?: Pick<PlatformAiProviderConfigRepository, 'findProviderConfig'>;
}): Promise<PlatformAiRuntimeSmokeResult> {
  const startedAt = Date.now();
  const savedConfig = await readSavedRuntimeConfig(input);
  const config = readPlatformAiRuntimeConfig();
  const baseUrl = savedConfig?.baseUrl ?? readEnvValue('ZMTG_AI_BASE_URL');
  const authValue = savedConfig?.apiKey ?? readEnvValue('ZMTG_AI_API_KEY');
  const provider = savedConfig?.provider ?? config.provider;
  const model = savedConfig?.model ?? config.model;
  const configured = savedConfig
    ? true
    : config.enabled && config.configured && Boolean(baseUrl && authValue && model);

  if (!configured || !baseUrl || !authValue || !model) {
    return buildResult({
      ok: false,
      status: 'skipped',
      latencyMs: 0,
      provider,
      model,
      errorCode: 'RUNTIME_NOT_CONFIGURED',
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SMOKE_TIMEOUT_MS);

  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: new Headers({
        Authorization: `Bearer ${authValue}`,
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: SMOKE_PROMPT }],
        temperature: 0,
        max_tokens: 4,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return buildResult({
        ok: false,
        status: 'failed',
        latencyMs: Math.max(0, Date.now() - startedAt),
        provider,
        model,
        errorCode: 'PROVIDER_REQUEST_FAILED',
      });
    }

    return buildResult({
      ok: true,
      status: 'ok',
      latencyMs: Math.max(0, Date.now() - startedAt),
      provider,
      model,
      errorCode: null,
    });
  } catch (error) {
    clearTimeout(timeoutId);

    return buildResult({
      ok: false,
      status: 'failed',
      latencyMs: Math.max(0, Date.now() - startedAt),
      provider,
      model,
      errorCode: error instanceof DOMException && error.name === 'AbortError'
        ? 'PROVIDER_TIMEOUT'
        : 'PROVIDER_REQUEST_FAILED',
    });
  }
}
