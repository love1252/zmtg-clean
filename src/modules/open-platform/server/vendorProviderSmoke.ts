import { decryptSecret } from '@/modules/security/server/secretEncryption';
import { type SupportedVendor } from '@/modules/open-platform/domain/vendor-catalog';
import { type VendorProviderConfigRepository } from './vendorProviderConfigRepository';

export type PlatformAiRuntimeSmokeResult = {
  ok: boolean;
  status: 'skipped' | 'ok' | 'failed';
  latencyMs: number;
  provider: 'openai_compatible' | null;
  model: string | null;
  checkedAt: string;
  errorCode: 'NOT_CONFIGURED' | 'PROVIDER_REQUEST_FAILED' | 'PROVIDER_TIMEOUT' | null;
};

export type MultiVendorSmokeResult =
  | { status: 'vendor_not_configured'; payload: PlatformAiRuntimeSmokeResult }
  | { status: 'completed'; payload: PlatformAiRuntimeSmokeResult };

const SMOKE_PROMPT = 'Return OK only.';
const SMOKE_TIMEOUT_MS = 8000;

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

export async function runMultiVendorSmokeTest(input: {
  repository: Pick<VendorProviderConfigRepository, 'findByVendor'>;
  vendor: SupportedVendor;
}): Promise<MultiVendorSmokeResult> {
  const startedAt = Date.now();
  const record = await input.repository.findByVendor(input.vendor);

  if (!record || !record.configured) {
    return {
      status: 'vendor_not_configured',
      payload: buildResult({
        ok: false,
        status: 'skipped',
        latencyMs: 0,
        provider: null,
        model: null,
        errorCode: 'NOT_CONFIGURED',
      }),
    };
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret(record.encryptedApiKey);
  } catch {
    return {
      status: 'vendor_not_configured',
      payload: buildResult({
        ok: false,
        status: 'skipped',
        latencyMs: 0,
        provider: null,
        model: null,
        errorCode: 'NOT_CONFIGURED',
      }),
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SMOKE_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${normalizeBaseUrl(record.baseUrl)}/chat/completions`,
      {
        method: 'POST',
        headers: new Headers({
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          model: record.model,
          messages: [{ role: 'user', content: SMOKE_PROMPT }],
          temperature: 0,
          max_tokens: 4,
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        status: 'completed',
        payload: buildResult({
          ok: false,
          status: 'failed',
          latencyMs: Math.max(0, Date.now() - startedAt),
          provider: 'openai_compatible',
          model: record.model,
          errorCode: 'PROVIDER_REQUEST_FAILED',
        }),
      };
    }

    return {
      status: 'completed',
      payload: buildResult({
        ok: true,
        status: 'ok',
        latencyMs: Math.max(0, Date.now() - startedAt),
        provider: 'openai_compatible',
        model: record.model,
        errorCode: null,
      }),
    };
  } catch (error) {
    clearTimeout(timeoutId);

    return {
      status: 'completed',
      payload: buildResult({
        ok: false,
        status: 'failed',
        latencyMs: Math.max(0, Date.now() - startedAt),
        provider: 'openai_compatible',
        model: record.model,
        errorCode:
          error instanceof DOMException && error.name === 'AbortError'
            ? 'PROVIDER_TIMEOUT'
            : 'PROVIDER_REQUEST_FAILED',
      }),
    };
  }
}
