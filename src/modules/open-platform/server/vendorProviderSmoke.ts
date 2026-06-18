import { type SupportedVendor } from '@/modules/open-platform/domain/vendor-catalog';
import { type VendorProviderConfigRepository } from './vendorProviderConfigRepository';

export type PlatformAiRuntimeSmokeResult = {
  ok: boolean;
  status: 'ready' | 'skipped' | 'failed';
  latencyMs: number;
  provider: 'openai_compatible' | null;
  model: string | null;
  checkedAt: string;
  errorCode: 'NOT_CONFIGURED' | 'INCOMPLETE_CONFIG' | null;
};

export type MultiVendorSmokeResult =
  | { status: 'vendor_not_configured'; payload: PlatformAiRuntimeSmokeResult }
  | { status: 'completed'; payload: PlatformAiRuntimeSmokeResult };

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function buildResult(
  result: Omit<PlatformAiRuntimeSmokeResult, 'checkedAt'>,
): PlatformAiRuntimeSmokeResult {
  return {
    ...result,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Dry-run smoke readiness check.
 * No decryption, no outbound fetch, no Bearer token, no real smoke.
 */
export async function runMultiVendorSmokeTest(input: {
  repository: Pick<VendorProviderConfigRepository, 'findByVendor'>;
  vendor: SupportedVendor;
}): Promise<MultiVendorSmokeResult> {
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

  const isComplete =
    hasNonEmptyString(record.baseUrl) &&
    hasNonEmptyString(record.model) &&
    record.encryptedApiKey !== null &&
    typeof record.encryptedApiKey === 'object' &&
    hasNonEmptyString((record.encryptedApiKey as Record<string, unknown>).ciphertext);

  if (!isComplete) {
    return {
      status: 'completed',
      payload: buildResult({
        ok: false,
        status: 'failed',
        latencyMs: 0,
        provider: 'openai_compatible',
        model: record.model ?? null,
        errorCode: 'INCOMPLETE_CONFIG',
      }),
    };
  }

  return {
    status: 'completed',
    payload: buildResult({
      ok: true,
      status: 'ready',
      latencyMs: 0,
      provider: 'openai_compatible',
      model: record.model,
      errorCode: null,
    }),
  };
}
