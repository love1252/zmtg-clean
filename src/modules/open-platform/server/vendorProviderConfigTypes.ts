import type { EncryptedSecretEnvelope } from '@/modules/security/server/secretEncryption';
import type { SupportedVendor } from '@/modules/open-platform/domain/vendor-catalog';
import type { PlatformAiRuntimeProvider } from './platformAiRuntimeConfig';

export type VendorProviderConfigLastCheckStatus = 'not_checked' | 'ok' | 'failed' | 'skipped';

export type VendorProviderConfigRecord = {
  id: string;
  vendor: SupportedVendor;
  baseUrl: string;
  model: string;
  encryptedApiKey: EncryptedSecretEnvelope;
  configured: boolean;
  lastCheckStatus: VendorProviderConfigLastCheckStatus;
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type VendorProviderConfigUpsertInput = {
  id: string;
  vendor: SupportedVendor;
  baseUrl: string;
  model: string;
  encryptedApiKey: EncryptedSecretEnvelope;
  configured: boolean;
  updatedAt: Date;
};

export type VendorProviderConfigSafeView = {
  id: string;
  vendor: SupportedVendor;
  displayName: string;
  provider: PlatformAiRuntimeProvider;
  baseUrl: string;
  model: string;
  configured: boolean;
  lastCheckStatus: VendorProviderConfigLastCheckStatus;
  lastCheckedAt: string | null;
  updatedAt: string | null;
};

export type VendorProviderConfigSaveInput = {
  vendor: unknown;
  baseUrl: unknown;
  model: unknown;
  apiKey: unknown;
};

export type VendorProviderConfigSaveResult =
  | { status: 'saved'; payload: VendorProviderConfigSafeView }
  | { status: 'validation_failed'; payload: { ok: false; errorCode: 'VALIDATION_FAILED' } }
  | { status: 'encryption_unavailable'; payload: { ok: false; errorCode: 'ENCRYPTION_NOT_CONFIGURED' } };

export type VendorProviderConfigListResult = {
  configs: VendorProviderConfigSafeView[];
};

export type VendorProviderConfigDeleteResult =
  | { status: 'deleted' }
  | { status: 'not_found'; payload: { ok: false; errorCode: 'NOT_FOUND' } };
