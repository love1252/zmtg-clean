import {
  readPlatformAiRuntimeConfig,
  type PlatformAiRuntimeProvider,
} from '@/modules/open-platform/server/platformAiRuntimeConfig';

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

export async function runPlatformAiRuntimeSmokeTest(): Promise<PlatformAiRuntimeSmokeResult> {
  const startedAt = Date.now();
  const config = readPlatformAiRuntimeConfig();
  const baseUrl = readEnvValue('ZMTG_AI_BASE_URL');
  const authValue = readEnvValue('ZMTG_AI_API_KEY');

  if (!config.enabled || !config.configured || !baseUrl || !authValue || !config.model) {
    return buildResult({
      ok: false,
      status: 'skipped',
      latencyMs: 0,
      provider: config.provider,
      model: config.model,
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
        model: config.model,
        messages: [{ role: 'user', content: SMOKE_PROMPT }],
        temperature: 0,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return buildResult({
        ok: false,
        status: 'failed',
        latencyMs: Math.max(0, Date.now() - startedAt),
        provider: config.provider,
        model: config.model,
        errorCode: 'PROVIDER_REQUEST_FAILED',
      });
    }

    return buildResult({
      ok: true,
      status: 'ok',
      latencyMs: Math.max(0, Date.now() - startedAt),
      provider: config.provider,
      model: config.model,
      errorCode: null,
    });
  } catch (error) {
    clearTimeout(timeoutId);

    return buildResult({
      ok: false,
      status: 'failed',
      latencyMs: Math.max(0, Date.now() - startedAt),
      provider: config.provider,
      model: config.model,
      errorCode: error instanceof DOMException && error.name === 'AbortError'
        ? 'PROVIDER_TIMEOUT'
        : 'PROVIDER_REQUEST_FAILED',
    });
  }
}
