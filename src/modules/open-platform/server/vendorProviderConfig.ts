import { encryptSecret, type EncryptedSecretEnvelope } from '@/modules/security/server/secretEncryption';
import { isSupportedVendor, getSupportedVendorConfig, type SupportedVendor } from '@/modules/open-platform/domain/vendor-catalog';
import type { PlatformAiRuntimeProvider } from './platformAiRuntimeConfig';
import { vendorProviderConfigId } from './vendorProviderConfigRepository';
import type { VendorProviderConfigRepository } from './vendorProviderConfigRepository';
import type {
  VendorProviderConfigSafeView,
  VendorProviderConfigSaveInput,
  VendorProviderConfigSaveResult,
  VendorProviderConfigListResult,
  VendorProviderConfigDeleteResult,
  VendorProviderConfigRecord,
} from './vendorProviderConfigTypes';

// --- Validation functions (same logic as platformAiProviderConfig.ts) ---

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) return null;
  return normalized;
}

function isBlockedHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  const ipv4Parts = normalized.split('.');
  const isIpv4Literal = ipv4Parts.length === 4 && ipv4Parts.every((part) => /^\d+$/.test(part));

  if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '0.0.0.0') {
    return true;
  }
  if (normalized === '::1' || normalized === '[::1]') return true;
  if (!isIpv4Literal) return false;

  const [first = '', second = ''] = ipv4Parts;
  const firstOctet = Number(first);
  const secondOctet = Number(second);

  return (
    firstOctet === 10
    || firstOctet === 127
    || (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31)
    || (firstOctet === 192 && secondOctet === 168)
    || (firstOctet === 169 && secondOctet === 254)
  );
}

function normalizeBaseUrl(value: unknown) {
  const rawValue = normalizeText(value, 256);
  if (!rawValue) return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawValue);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== 'https:') return null;
  if (parsedUrl.username || parsedUrl.password) return null;
  if (parsedUrl.search || parsedUrl.hash) return null;
  if (isBlockedHostname(parsedUrl.hostname)) return null;

  return parsedUrl.toString().replace(/\/+$/, '');
}

function normalizeVendor(value: unknown): SupportedVendor | null {
  return isSupportedVendor(value) ? value : null;
}

// --- Safe view mapper ---

function mapRecordToSafeView(record: VendorProviderConfigRecord): VendorProviderConfigSafeView {
  const vendorConfig = getSupportedVendorConfig(record.vendor);
  return {
    id: record.id,
    vendor: record.vendor,
    displayName: vendorConfig.displayName,
    provider: 'openai_compatible' as PlatformAiRuntimeProvider,
    baseUrl: record.baseUrl,
    model: record.model,
    configured: record.configured,
    lastCheckStatus: record.lastCheckStatus,
    lastCheckedAt: record.lastCheckedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
  };
}

// --- Service functions ---

export async function listVendorProviderConfigs(input: {
  repository: Pick<VendorProviderConfigRepository, 'findAll'>;
}): Promise<VendorProviderConfigListResult> {
  const records = await input.repository.findAll();
  return { configs: records.map(mapRecordToSafeView) };
}

export async function getVendorProviderConfig(input: {
  repository: Pick<VendorProviderConfigRepository, 'findByVendor'>;
  vendor: SupportedVendor;
}): Promise<VendorProviderConfigSafeView | null> {
  const record = await input.repository.findByVendor(input.vendor);
  return record ? mapRecordToSafeView(record) : null;
}

export async function saveVendorProviderConfig(input: {
  repository: Pick<VendorProviderConfigRepository, 'upsertVendorConfig'>;
  input: VendorProviderConfigSaveInput;
  now?: Date;
}): Promise<VendorProviderConfigSaveResult> {
  const vendor = normalizeVendor(input.input.vendor);
  const baseUrl = normalizeBaseUrl(input.input.baseUrl);
  const model = normalizeText(input.input.model, 128);
  const apiKey = normalizeText(input.input.apiKey, 4096);

  if (!vendor || !baseUrl || !model || !apiKey) {
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

  const saved = await input.repository.upsertVendorConfig({
    id: vendorProviderConfigId(vendor),
    vendor,
    baseUrl,
    model,
    encryptedApiKey,
    configured: true,
    updatedAt: input.now ?? new Date(),
  });

  return { status: 'saved', payload: mapRecordToSafeView(saved) };
}

export async function deleteVendorProviderConfig(input: {
  repository: Pick<VendorProviderConfigRepository, 'findByVendor' | 'deleteByVendor'>;
  vendor: SupportedVendor;
}): Promise<VendorProviderConfigDeleteResult> {
  const existing = await input.repository.findByVendor(input.vendor);
  if (!existing) {
    return { status: 'not_found', payload: { ok: false, errorCode: 'NOT_FOUND' } };
  }

  await input.repository.deleteByVendor(input.vendor);
  return { status: 'deleted' };
}
