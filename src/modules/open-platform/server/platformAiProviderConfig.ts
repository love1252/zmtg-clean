import { decryptSecret, encryptSecret, type EncryptedSecretEnvelope } from '@/modules/security/server/secretEncryption';
import type { PlatformAiRuntimeProvider } from './platformAiRuntimeConfig';

export type PlatformAiProviderConfigLastCheckStatus = 'not_checked' | 'ok' | 'failed' | 'skipped';

export type PlatformAiProviderConfigRecord = {
  id: string;
  provider: PlatformAiRuntimeProvider;
  baseUrl: string;
  model: string;
  encryptedApiKey: EncryptedSecretEnvelope;
  configured: boolean;
  lastCheckStatus: PlatformAiProviderConfigLastCheckStatus;
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PlatformAiProviderConfigUpsertInput = {
  provider: PlatformAiRuntimeProvider;
  baseUrl: string;
  model: string;
  encryptedApiKey: EncryptedSecretEnvelope;
  configured: boolean;
  updatedAt: Date;
};

export type PlatformAiProviderConfigSafeStatus = {
  configured: boolean;
  provider: PlatformAiRuntimeProvider | null;
  model: string | null;
  baseUrlConfigured: boolean;
  lastCheckStatus: PlatformAiProviderConfigLastCheckStatus;
  lastCheckedAt: string | null;
  updatedAt: string | null;
};

export type PlatformAiProviderConfigRepository = {
  findProviderConfig(): Promise<PlatformAiProviderConfigRecord | null>;
  upsertProviderConfig(input: PlatformAiProviderConfigUpsertInput): Promise<PlatformAiProviderConfigRecord>;
};

export type PlatformAiProviderConfigSaveInput = {
  provider: unknown;
  baseUrl: unknown;
  model: unknown;
  apiKey: unknown;
};

export type PlatformAiProviderConfigSaveResult =
  | { status: 'saved'; payload: PlatformAiProviderConfigSafeStatus }
  | { status: 'validation_failed'; payload: { ok: false; errorCode: 'VALIDATION_FAILED' } }
  | { status: 'encryption_unavailable'; payload: { ok: false; errorCode: 'ENCRYPTION_NOT_CONFIGURED' } };

export type PlatformAiSavedRuntimeConfig = {
  provider: PlatformAiRuntimeProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
};

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) return null;
  return normalized;
}

function normalizeProvider(value: unknown): PlatformAiRuntimeProvider | null {
  return value === 'openai_compatible' ? 'openai_compatible' : null;
}

function mapRecordToSafeStatus(
  record: PlatformAiProviderConfigRecord | null,
): PlatformAiProviderConfigSafeStatus {
  if (!record || !record.configured) {
    return {
      configured: false,
      provider: null,
      model: null,
      baseUrlConfigured: false,
      lastCheckStatus: 'not_checked',
      lastCheckedAt: null,
      updatedAt: null,
    };
  }

  return {
    configured: true,
    provider: record.provider,
    model: record.model,
    baseUrlConfigured: Boolean(record.baseUrl),
    lastCheckStatus: record.lastCheckStatus,
    lastCheckedAt: record.lastCheckedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function getPlatformAiProviderConfigStatus(input: {
  repository: Pick<PlatformAiProviderConfigRepository, 'findProviderConfig'>;
}) {
  return mapRecordToSafeStatus(await input.repository.findProviderConfig());
}

export async function savePlatformAiProviderConfig(input: {
  repository: Pick<PlatformAiProviderConfigRepository, 'upsertProviderConfig'>;
  input: PlatformAiProviderConfigSaveInput;
  now?: Date;
}): Promise<PlatformAiProviderConfigSaveResult> {
  const provider = normalizeProvider(input.input.provider);
  const baseUrl = normalizeText(input.input.baseUrl, 256);
  const model = normalizeText(input.input.model, 128);
  const apiKey = normalizeText(input.input.apiKey, 4096);

  if (!provider || !baseUrl || !model || !apiKey) {
    return { status: 'validation_failed', payload: { ok: false, errorCode: 'VALIDATION_FAILED' } };
  }

  let encryptedApiKey: EncryptedSecretEnvelope;
  try {
    encryptedApiKey = encryptSecret(apiKey);
  } catch {
    return {
      status: 'encryption_unavailable',
      payload: { ok: false, errorCode: 'ENCRYPTION_NOT_CONFIGURED' },
    };
  }

  const saved = await input.repository.upsertProviderConfig({
    provider,
    baseUrl,
    model,
    encryptedApiKey,
    configured: true,
    updatedAt: input.now ?? new Date(),
  });

  return { status: 'saved', payload: mapRecordToSafeStatus(saved) };
}

export async function readSavedPlatformAiRuntimeConfig(input: {
  repository: Pick<PlatformAiProviderConfigRepository, 'findProviderConfig'>;
}): Promise<PlatformAiSavedRuntimeConfig | null> {
  const record = await input.repository.findProviderConfig();
  if (!record || !record.configured) return null;

  try {
    return {
      provider: record.provider,
      baseUrl: record.baseUrl,
      model: record.model,
      apiKey: decryptSecret(record.encryptedApiKey),
    };
  } catch {
    return null;
  }
}
