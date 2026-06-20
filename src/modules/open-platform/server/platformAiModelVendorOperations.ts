import { decryptSecret } from '@/modules/security/server/secretEncryption';
import type { SupportedVendor } from '@/modules/open-platform/domain/vendor-catalog';
import type { VendorProviderConfigRepository } from './vendorProviderConfigRepository';

export type AiModelVendorOperationStatus =
  | 'success'
  | 'failed'
  | 'timeout'
  | 'not_configured'
  | 'rate_limited'
  | 'provider_unavailable';

export type AiModelVendorOperationErrorCode =
  | 'NOT_CONFIGURED'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_TIMEOUT'
  | 'VALIDATION_FAILED'
  | null;

export type AiModelVendorSyncedModel = {
  modelId: string;
  displayName: string;
  category?: 'reasoning' | 'text' | 'vision' | 'embedding';
  capabilityIds?: Array<'reasoning' | 'text' | 'vision' | 'embedding'>;
};

export type AiModelVendorSyncPayload = {
  ok: boolean;
  status: AiModelVendorOperationStatus;
  vendor: SupportedVendor;
  syncedModels: AiModelVendorSyncedModel[];
  latencyMs: number;
  checkedAt: string;
  errorCode: AiModelVendorOperationErrorCode;
  retryAfterMs?: number;
};

export type AiModelVendorTestPayload = {
  ok: boolean;
  status: AiModelVendorOperationStatus;
  vendor: SupportedVendor;
  modelId: string;
  latencyMs: number;
  checkedAt: string;
  errorCode: AiModelVendorOperationErrorCode;
  retryAfterMs?: number;
};

export type AiModelVendorOperationResult<TPayload> =
  | { status: 'completed'; payload: TPayload }
  | { status: 'validation_failed'; payload: TPayload };

export type AiModelVendorAdapter = {
  syncModels(input: {
    vendor: SupportedVendor;
    baseUrl: string;
    apiKey: string;
  }): Promise<AiModelVendorSyncPayload>;
  testModel(input: {
    vendor: SupportedVendor;
    baseUrl: string;
    apiKey: string;
    modelId: string;
  }): Promise<AiModelVendorTestPayload>;
};

export type AiModelVendorRateLimiter = {
  check(input: {
    vendor: SupportedVendor;
    operation: 'sync' | 'test';
  }): { allowed: boolean; retryAfterMs: number };
};

type VendorFetcher = (input: string, init?: RequestInit) => Promise<Response>;
type AiModelVendorSyncStrategy = 'official_models_api' | 'static_official_catalog';

function nowIso() {
  return new Date().toISOString();
}

function elapsedSince(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '');
}

function buildModelListEndpoint(vendor: SupportedVendor, baseUrl: string) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (vendor === 'deepseek' && normalizedBaseUrl === 'https://api.deepseek.com/v1') {
    return 'https://api.deepseek.com/models';
  }
  return `${normalizedBaseUrl}/models`;
}

function getVendorSyncStrategy(vendor: SupportedVendor): AiModelVendorSyncStrategy {
  if (vendor === 'deepseek' || vendor === 'kimi') return 'official_models_api';
  return 'static_official_catalog';
}

function buildSyncPayload(input: Omit<AiModelVendorSyncPayload, 'checkedAt'>): AiModelVendorSyncPayload {
  return {
    ...input,
    checkedAt: nowIso(),
  };
}

function buildTestPayload(input: Omit<AiModelVendorTestPayload, 'checkedAt'>): AiModelVendorTestPayload {
  return {
    ...input,
    checkedAt: nowIso(),
  };
}

function createAbortTimeout(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeout };
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

type BusinessModelCategory = NonNullable<AiModelVendorSyncedModel['category']>;

const businessModelCategoryOrder: BusinessModelCategory[] = ['reasoning', 'text', 'vision', 'embedding'];
const businessModelCategoryLimits: Record<BusinessModelCategory, number> = {
  reasoning: 3,
  text: 3,
  vision: 3,
  embedding: 2,
};
const businessModelPreferences: Partial<Record<SupportedVendor, Partial<Record<BusinessModelCategory, string[]>>>> = {
  doubao: {
    reasoning: ['doubao-seed-2-0-pro-260215'],
    text: ['doubao-seed-2-0-lite-260215', 'doubao-seed-2-0-mini-260215', 'doubao-seed-1-6-lite-251015'],
    vision: ['doubao-seed-1-8-251228', 'doubao-seed-2-0-pro-260215'],
    embedding: ['doubao-embedding-v2'],
  },
  deepseek: {
    reasoning: ['deepseek-r1-260101', 'deepseek-v4-260101', 'deepseek-v4-pro'],
    text: ['deepseek-v4-flash', 'deepseek-v3-2-251201', 'deepseek-v4-260101'],
    embedding: ['deepseek-embedding-v3', 'deepseek-embedding'],
  },
  qwen: {
    reasoning: ['qwen3-max-preview', 'qvq-plus', 'qwq-plus'],
    text: ['qwen-max-latest', 'qwen-plus-latest', 'qwen-turbo-latest'],
    vision: ['qwen-vl-ocr-latest', 'qwen3-vl-plus', 'qwen3-vl-flash', 'qwen-vl-plus-latest'],
    embedding: ['text-embedding-v4'],
  },
  chatglm: {
    reasoning: ['glm-5.1'],
    text: ['glm-4.7', 'glm-4.7-flash'],
    embedding: ['embedding-3'],
  },
  kimi: {
    reasoning: ['kimi-k2-5-260127'],
    embedding: ['kimi-embedding-v2'],
  },
};

const staticOfficialCatalogModels: Partial<Record<SupportedVendor, AiModelVendorSyncedModel[]>> = {
  doubao: [
    { modelId: 'doubao-seed-2-0-pro-260215', displayName: 'Seed Pro 2.0', category: 'reasoning', capabilityIds: ['reasoning', 'text'] },
    { modelId: 'doubao-seed-2-0-lite-260215', displayName: 'Seed Lite 2.0', category: 'text', capabilityIds: ['text'] },
    { modelId: 'doubao-seed-2-0-mini-260215', displayName: 'Seed Mini 2.0', category: 'text', capabilityIds: ['text'] },
    { modelId: 'doubao-seed-1-8-251228', displayName: 'Seed 1.8', category: 'vision', capabilityIds: ['vision', 'text'] },
    { modelId: 'doubao-seed-1-6-lite-251015', displayName: 'Seed Lite 1.6', category: 'text', capabilityIds: ['text'] },
    { modelId: 'doubao-embedding-v2', displayName: 'Doubao Embedding V2', category: 'embedding', capabilityIds: ['embedding'] },
  ],
  qwen: [
    { modelId: 'qwen-plus-latest', displayName: 'Qwen Plus', category: 'text', capabilityIds: ['text'] },
    { modelId: 'qwen-max-latest', displayName: 'Qwen Max Latest', category: 'text', capabilityIds: ['text'] },
    { modelId: 'qwen-turbo-latest', displayName: 'Qwen Turbo Latest', category: 'text', capabilityIds: ['text'] },
    { modelId: 'qwen3-vl-plus', displayName: 'Qwen3-VL Plus', category: 'vision', capabilityIds: ['vision', 'text'] },
    { modelId: 'qwen3-vl-flash', displayName: 'Qwen3-VL Flash', category: 'vision', capabilityIds: ['vision', 'text'] },
    { modelId: 'qwen-vl-ocr-latest', displayName: 'Qwen VL OCR', category: 'vision', capabilityIds: ['vision'] },
    { modelId: 'text-embedding-v4', displayName: 'Text Embedding V4', category: 'embedding', capabilityIds: ['embedding'] },
  ],
  chatglm: [
    { modelId: 'glm-5.1', displayName: 'GLM-5.1', category: 'reasoning', capabilityIds: ['reasoning', 'text'] },
    { modelId: 'glm-4.7', displayName: 'GLM-4.7', category: 'text', capabilityIds: ['text', 'reasoning'] },
    { modelId: 'glm-4.7-flash', displayName: 'GLM-4.7 Flash', category: 'text', capabilityIds: ['text'] },
    { modelId: 'embedding-3', displayName: 'Embedding-3', category: 'embedding', capabilityIds: ['embedding'] },
  ],
};

function readModelRecords(payload: unknown): unknown[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const record = payload as { data?: unknown; models?: unknown };
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.models)) return record.models;
  if (
    typeof record.data === 'object'
    && record.data !== null
    && Array.isArray((record.data as { models?: unknown }).models)
  ) {
    // Defensive compatibility for providers/proxies that wrap model arrays under data.models.
    return (record.data as { models: unknown[] }).models;
  }
  return [];
}

function extractModelId(record: unknown) {
  if (typeof record === 'string') return record.trim();
  if (typeof record !== 'object' || record === null) return '';

  const candidate = (record as {
    id?: unknown;
    model?: unknown;
    modelId?: unknown;
    name?: unknown;
  }).id ?? (record as { model?: unknown }).model ?? (record as { modelId?: unknown }).modelId ?? (record as { name?: unknown }).name;

  return typeof candidate === 'string' ? candidate.trim() : '';
}

function mapRawModelResponse(payload: unknown): AiModelVendorSyncedModel[] {
  return readModelRecords(payload)
    .map((record) => {
      const modelId = extractModelId(record);
      return modelId.length > 0
        ? { modelId, displayName: modelId }
        : null;
    })
    .filter((model): model is AiModelVendorSyncedModel => model !== null);
}

function inferBusinessModelCategory(vendor: SupportedVendor, modelId: string): BusinessModelCategory | null {
  const normalized = modelId.toLowerCase();
  if (normalized.includes('embedding') || normalized.includes('embed')) return 'embedding';
  if (normalized.includes('tts') || normalized.includes('asr') || normalized.includes('speech') || normalized.includes('audio')) return null;
  if (normalized.includes('image') || normalized.includes('video') || normalized.includes('wan') || normalized.includes('z-image')) return null;
  if (normalized.includes('ocr') || normalized.includes('vl') || normalized.includes('vision') || normalized.includes('visual')) return 'vision';
  if (
    normalized.includes('reason')
    || normalized.includes('thinking')
    || normalized.includes('r1')
    || normalized.includes('k2')
    || normalized.includes('qvq')
    || normalized.includes('qwq')
    || normalized.includes('max-preview')
    || (vendor === 'deepseek' && normalized.includes('v4-pro'))
  ) {
    return 'reasoning';
  }
  return 'text';
}

function isProviderNativeBusinessModel(vendor: SupportedVendor, modelId: string) {
  const normalized = modelId.toLowerCase();
  if (
    normalized.includes('/')
    || normalized.includes('siliconflow')
    || normalized.includes('vanchin')
    || normalized.includes('minimax')
    || /(\b|[-_])(free|distill|instruct|open)(\b|[-_])/.test(normalized)
  ) {
    return false;
  }

  if (vendor === 'qwen') {
    return normalized.startsWith('qwen') || normalized.startsWith('qvq') || normalized.startsWith('qwq') || normalized.startsWith('text-embedding');
  }
  if (vendor === 'deepseek') return normalized.startsWith('deepseek');
  if (vendor === 'doubao') return normalized.startsWith('doubao') || normalized.startsWith('seed');
  if (vendor === 'chatglm') return normalized.startsWith('glm') || normalized.startsWith('chatglm');
  if (vendor === 'kimi') return normalized.startsWith('kimi');
  return true;
}

function capabilityIdsForCategory(category: BusinessModelCategory): NonNullable<AiModelVendorSyncedModel['capabilityIds']> {
  if (category === 'embedding') return ['embedding'];
  if (category === 'vision') return ['vision', 'text'];
  if (category === 'reasoning') return ['reasoning', 'text'];
  return ['text'];
}

function scoreBusinessModel(vendor: SupportedVendor, category: BusinessModelCategory, modelId: string) {
  const normalized = modelId.toLowerCase();
  const preferences = businessModelPreferences[vendor]?.[category] ?? [];
  const preferenceIndex = preferences.findIndex((item) => item.toLowerCase() === normalized);
  let score = preferenceIndex >= 0 ? 100_000 - preferenceIndex * 1_000 : 0;
  if (normalized.includes('latest')) score += 500;
  if (normalized.includes('ocr') && category === 'vision') score += 240;
  if (normalized.includes('embedding') && category === 'embedding') score += 300;
  if (normalized.includes('plus')) score += 180;
  if (normalized.includes('pro')) score += 160;
  if (normalized.includes('max')) score += 150;
  if (normalized.includes('flash')) score += 100;
  if (normalized.includes('turbo')) score += 70;
  if (normalized.includes('preview')) score -= 80;
  return score;
}

function selectBusinessModels(vendor: SupportedVendor, models: AiModelVendorSyncedModel[]) {
  const groupedModels = new Map<BusinessModelCategory, AiModelVendorSyncedModel[]>();

  for (const model of models) {
    if (!isProviderNativeBusinessModel(vendor, model.modelId)) continue;
    const category = inferBusinessModelCategory(vendor, model.modelId);
    if (!category) continue;
    groupedModels.set(category, [
      ...(groupedModels.get(category) ?? []),
      {
        ...model,
        category,
        capabilityIds: capabilityIdsForCategory(category),
      },
    ]);
  }

  return businessModelCategoryOrder.flatMap((category) => {
    const limit = businessModelCategoryLimits[category];
    return (groupedModels.get(category) ?? [])
      .sort((left, right) => scoreBusinessModel(vendor, category, right.modelId) - scoreBusinessModel(vendor, category, left.modelId))
      .slice(0, limit);
  });
}

function mapModelsResponse(vendor: SupportedVendor, payload: unknown): AiModelVendorSyncedModel[] {
  const rawModels = mapRawModelResponse(payload);
  const businessModels = selectBusinessModels(vendor, rawModels);
  return businessModels.length > 0 ? businessModels : rawModels;
}

export function createAiModelVendorAdapter(input: {
  fetcher?: VendorFetcher;
  timeoutMs?: number;
} = {}): AiModelVendorAdapter {
  const fetcher = input.fetcher ?? fetch;
  const timeoutMs = input.timeoutMs ?? 8_000;

  return {
    async syncModels(operationInput) {
      const startedAt = Date.now();
      if (getVendorSyncStrategy(operationInput.vendor) === 'static_official_catalog') {
        return buildSyncPayload({
          ok: true,
          status: 'success',
          vendor: operationInput.vendor,
          syncedModels: staticOfficialCatalogModels[operationInput.vendor] ?? [],
          latencyMs: elapsedSince(startedAt),
          errorCode: null,
        });
      }

      const { controller, timeout } = createAbortTimeout(timeoutMs);

      try {
        const response = await fetcher(buildModelListEndpoint(operationInput.vendor, operationInput.baseUrl), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${operationInput.apiKey}`,
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          return buildSyncPayload({
            ok: false,
            status: 'failed',
            vendor: operationInput.vendor,
            syncedModels: [],
            latencyMs: elapsedSince(startedAt),
            errorCode: 'PROVIDER_UNAVAILABLE',
          });
        }

        const payload = await response.json().catch(() => ({}));

        return buildSyncPayload({
          ok: true,
          status: 'success',
          vendor: operationInput.vendor,
          syncedModels: mapModelsResponse(operationInput.vendor, payload),
          latencyMs: elapsedSince(startedAt),
          errorCode: null,
        });
      } catch (error) {
        return buildSyncPayload({
          ok: false,
          status: isAbortError(error) ? 'timeout' : 'provider_unavailable',
          vendor: operationInput.vendor,
          syncedModels: [],
          latencyMs: elapsedSince(startedAt),
          errorCode: isAbortError(error) ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE',
        });
      } finally {
        clearTimeout(timeout);
      }
    },

    async testModel(operationInput) {
      const startedAt = Date.now();
      const { controller, timeout } = createAbortTimeout(timeoutMs);

      try {
        const response = await fetcher(`${normalizeBaseUrl(operationInput.baseUrl)}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${operationInput.apiKey}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: operationInput.modelId,
            messages: [{ role: 'user', content: 'health check' }],
            temperature: 0,
            max_tokens: 4,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          return buildTestPayload({
            ok: false,
            status: 'failed',
            vendor: operationInput.vendor,
            modelId: operationInput.modelId,
            latencyMs: elapsedSince(startedAt),
            errorCode: 'PROVIDER_UNAVAILABLE',
          });
        }

        return buildTestPayload({
          ok: true,
          status: 'success',
          vendor: operationInput.vendor,
          modelId: operationInput.modelId,
          latencyMs: elapsedSince(startedAt),
          errorCode: null,
        });
      } catch (error) {
        return buildTestPayload({
          ok: false,
          status: isAbortError(error) ? 'timeout' : 'provider_unavailable',
          vendor: operationInput.vendor,
          modelId: operationInput.modelId,
          latencyMs: elapsedSince(startedAt),
          errorCode: isAbortError(error) ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE',
        });
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function createDefaultAiModelVendorAdapter() {
  return createAiModelVendorAdapter({ fetcher: fetch, timeoutMs: 8_000 });
}

export function createDryRunAiModelVendorAdapter(): AiModelVendorAdapter {
  return {
    async syncModels(operationInput) {
      return buildSyncPayload({
        ok: true,
        status: 'success',
        vendor: operationInput.vendor,
        syncedModels: [],
        latencyMs: 0,
        errorCode: null,
      });
    },
    async testModel(operationInput) {
      return buildTestPayload({
        ok: true,
        status: 'success',
        vendor: operationInput.vendor,
        modelId: operationInput.modelId,
        latencyMs: 0,
        errorCode: null,
      });
    },
  };
}

export function createInMemoryAiModelVendorRateLimiter(input: {
  maxAttempts?: number;
  windowMs?: number;
} = {}): AiModelVendorRateLimiter {
  const maxAttempts = input.maxAttempts ?? 30;
  const windowMs = input.windowMs ?? 60_000;
  const buckets = new Map<string, { count: number; windowStartedAt: number }>();

  return {
    check(rateInput) {
      const now = Date.now();
      const key = `${rateInput.operation}:${rateInput.vendor}`;
      const bucket = buckets.get(key);

      if (!bucket || now - bucket.windowStartedAt >= windowMs) {
        buckets.set(key, { count: 1, windowStartedAt: now });
        return { allowed: true, retryAfterMs: 0 };
      }

      if (bucket.count >= maxAttempts) {
        return {
          allowed: false,
          retryAfterMs: Math.max(1, windowMs - (now - bucket.windowStartedAt)),
        };
      }

      bucket.count += 1;
      return { allowed: true, retryAfterMs: 0 };
    },
  };
}

export const defaultAiModelVendorRateLimiter = createInMemoryAiModelVendorRateLimiter();

function notConfiguredSyncPayload(vendor: SupportedVendor): AiModelVendorSyncPayload {
  return buildSyncPayload({
    ok: false,
    status: 'not_configured',
    vendor,
    syncedModels: [],
    latencyMs: 0,
    errorCode: 'NOT_CONFIGURED',
  });
}

function notConfiguredTestPayload(vendor: SupportedVendor, modelId: string): AiModelVendorTestPayload {
  return buildTestPayload({
    ok: false,
    status: 'not_configured',
    vendor,
    modelId,
    latencyMs: 0,
    errorCode: 'NOT_CONFIGURED',
  });
}

export async function runAiModelVendorSync(input: {
  repository: Pick<VendorProviderConfigRepository, 'findByVendor'>;
  adapter: Pick<AiModelVendorAdapter, 'syncModels'>;
  rateLimiter: AiModelVendorRateLimiter;
  vendor: SupportedVendor;
}): Promise<AiModelVendorOperationResult<AiModelVendorSyncPayload>> {
  const rate = input.rateLimiter.check({ vendor: input.vendor, operation: 'sync' });
  if (!rate.allowed) {
    return {
      status: 'completed',
      payload: buildSyncPayload({
        ok: false,
        status: 'rate_limited',
        vendor: input.vendor,
        syncedModels: [],
        latencyMs: 0,
        errorCode: 'RATE_LIMITED',
        retryAfterMs: rate.retryAfterMs,
      }),
    };
  }

  const record = await input.repository.findByVendor(input.vendor);
  if (!record || !record.configured || !record.baseUrl) {
    return { status: 'completed', payload: notConfiguredSyncPayload(input.vendor) };
  }

  let plainCredential: string;
  try {
    plainCredential = decryptSecret(record.encryptedApiKey);
  } catch {
    return { status: 'completed', payload: notConfiguredSyncPayload(input.vendor) };
  }

  const payload = await input.adapter.syncModels({
    vendor: input.vendor,
    baseUrl: record.baseUrl,
    apiKey: plainCredential,
  });

  return { status: 'completed', payload };
}

export async function runAiModelVendorTest(input: {
  repository: Pick<VendorProviderConfigRepository, 'findByVendor'>;
  adapter: Pick<AiModelVendorAdapter, 'testModel'>;
  rateLimiter: AiModelVendorRateLimiter;
  vendor: SupportedVendor;
  modelId: string;
}): Promise<AiModelVendorOperationResult<AiModelVendorTestPayload>> {
  const modelId = input.modelId.trim();
  if (!modelId) {
    return {
      status: 'validation_failed',
      payload: buildTestPayload({
        ok: false,
        status: 'failed',
        vendor: input.vendor,
        modelId: '',
        latencyMs: 0,
        errorCode: 'VALIDATION_FAILED',
      }),
    };
  }

  const rate = input.rateLimiter.check({ vendor: input.vendor, operation: 'test' });
  if (!rate.allowed) {
    return {
      status: 'completed',
      payload: buildTestPayload({
        ok: false,
        status: 'rate_limited',
        vendor: input.vendor,
        modelId,
        latencyMs: 0,
        errorCode: 'RATE_LIMITED',
        retryAfterMs: rate.retryAfterMs,
      }),
    };
  }

  const record = await input.repository.findByVendor(input.vendor);
  if (!record || !record.configured || !record.baseUrl) {
    return { status: 'completed', payload: notConfiguredTestPayload(input.vendor, modelId) };
  }

  let plainCredential: string;
  try {
    plainCredential = decryptSecret(record.encryptedApiKey);
  } catch {
    return { status: 'completed', payload: notConfiguredTestPayload(input.vendor, modelId) };
  }

  const payload = await input.adapter.testModel({
    vendor: input.vendor,
    baseUrl: record.baseUrl,
    apiKey: plainCredential,
    modelId,
  });

  return { status: 'completed', payload };
}
