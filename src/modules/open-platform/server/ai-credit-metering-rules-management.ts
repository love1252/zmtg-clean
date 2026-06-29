import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';

import type { TenantDatabase } from '@/server/db/client';
import { platformAiCreditMeteringRules } from '@/server/db/schema';

type PlatformAiCreditMeteringRuleRow = typeof platformAiCreditMeteringRules.$inferSelect;

export type PlatformAiCreditMeteringRuleDto = {
  id: string;
  provider: string;
  model: string;
  meteringVersion: string;
  inputTokenWeight: number;
  outputTokenWeight: number;
  modelMultiplier: number;
  ragCreditSurcharge: number;
  creditsPerStandardTokenUnit: number;
  enabled: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiCreditMeteringRuleListFilters = {
  provider?: string | null;
  model?: string | null;
  enabled?: boolean | null;
};

export type AiCreditMeteringRuleCreateInput = {
  provider?: unknown;
  model?: unknown;
  meteringVersion?: unknown;
  inputTokenWeight?: unknown;
  outputTokenWeight?: unknown;
  modelMultiplier?: unknown;
  ragCreditSurcharge?: unknown;
  creditsPerStandardTokenUnit?: unknown;
  enabled?: unknown;
  effectiveFrom?: unknown;
  effectiveTo?: unknown;
};

export type AiCreditMeteringRulePatchInput = {
  enabled?: unknown;
  effectiveFrom?: unknown;
  effectiveTo?: unknown;
};

export type CreateAiCreditMeteringRuleResult =
  | { status: 'created'; record: PlatformAiCreditMeteringRuleDto }
  | { status: 'validation_failed'; errors: string[] }
  | { status: 'conflict'; errorCode: 'METERING_RULE_VERSION_CONFLICT' };

export type PatchAiCreditMeteringRuleResult =
  | { status: 'updated'; record: PlatformAiCreditMeteringRuleDto }
  | { status: 'not_found'; errorCode: 'METERING_RULE_NOT_FOUND' }
  | { status: 'validation_failed'; errors: string[] };

type CreateAiCreditMeteringRuleValues = {
  id: string;
  provider: string;
  model: string;
  meteringVersion: string;
  inputTokenWeight: string;
  outputTokenWeight: string;
  modelMultiplier: string;
  ragCreditSurcharge: number;
  creditsPerStandardTokenUnit: number;
  enabled: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type PatchAiCreditMeteringRuleValues = {
  enabled?: boolean;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
  updatedAt: Date;
};

const textLimits = {
  provider: 64,
  model: 128,
  meteringVersion: 64,
} as const;

const forbiddenInputKeys = new Set([
  'apiKey',
  'encryptedApiKey',
  'baseUrl',
  'Authorization',
  'authorization',
  'prompt',
  'question',
  'answer',
  'rawResponse',
  'signedUrl',
  'storageKey',
]);

function toRuleNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

function formatNumeric(value: number) {
  return value.toFixed(6);
}

function normalizeRequiredText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

function normalizePositiveNumber(value: unknown) {
  const normalized = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

function normalizeNonNegativeInteger(value: unknown) {
  const normalized = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(normalized) && normalized >= 0 ? normalized : null;
}

function normalizePositiveInteger(value: unknown) {
  const normalized = normalizeNonNegativeInteger(value);
  return normalized !== null && normalized > 0 ? normalized : null;
}

function normalizeBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function normalizeDate(value: unknown) {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasForbiddenInputKeys(input: unknown) {
  if (!input || typeof input !== 'object') return false;
  return Object.keys(input).some((key) => forbiddenInputKeys.has(key));
}

function isUniqueConflict(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505',
  );
}

export function mapPlatformAiCreditMeteringRuleToDto(
  row: PlatformAiCreditMeteringRuleRow,
): PlatformAiCreditMeteringRuleDto {
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    meteringVersion: row.meteringVersion,
    inputTokenWeight: toRuleNumber(row.inputTokenWeight),
    outputTokenWeight: toRuleNumber(row.outputTokenWeight),
    modelMultiplier: toRuleNumber(row.modelMultiplier),
    ragCreditSurcharge: row.ragCreditSurcharge,
    creditsPerStandardTokenUnit: row.creditsPerStandardTokenUnit,
    enabled: row.enabled,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function validateCreateInput(
  input: AiCreditMeteringRuleCreateInput,
  now: Date,
): { ok: true; values: CreateAiCreditMeteringRuleValues } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (hasForbiddenInputKeys(input)) errors.push('forbidden_sensitive_field');

  const provider = normalizeRequiredText(input.provider, textLimits.provider);
  const model = normalizeRequiredText(input.model, textLimits.model);
  const meteringVersion = normalizeRequiredText(input.meteringVersion, textLimits.meteringVersion);
  const inputTokenWeight = normalizePositiveNumber(input.inputTokenWeight);
  const outputTokenWeight = normalizePositiveNumber(input.outputTokenWeight);
  const modelMultiplier = normalizePositiveNumber(input.modelMultiplier);
  const ragCreditSurcharge = normalizeNonNegativeInteger(input.ragCreditSurcharge);
  const creditsPerStandardTokenUnit = normalizePositiveInteger(input.creditsPerStandardTokenUnit);
  const enabled = input.enabled === undefined ? true : normalizeBoolean(input.enabled);
  const effectiveFrom = normalizeDate(input.effectiveFrom);
  const effectiveTo = input.effectiveTo === undefined || input.effectiveTo === null
    ? null
    : normalizeDate(input.effectiveTo);

  if (!provider) errors.push('provider_required');
  if (!model) errors.push('model_required');
  if (!meteringVersion) errors.push('metering_version_required');
  if (inputTokenWeight === null) errors.push('input_token_weight_invalid');
  if (outputTokenWeight === null) errors.push('output_token_weight_invalid');
  if (modelMultiplier === null) errors.push('model_multiplier_invalid');
  if (ragCreditSurcharge === null) errors.push('rag_credit_surcharge_invalid');
  if (creditsPerStandardTokenUnit === null) errors.push('credits_per_standard_token_unit_invalid');
  if (enabled === null) errors.push('enabled_invalid');
  if (!effectiveFrom) errors.push('effective_from_invalid');
  if (input.effectiveTo !== undefined && input.effectiveTo !== null && !effectiveTo) {
    errors.push('effective_to_invalid');
  }
  if (effectiveFrom && effectiveTo && effectiveTo.getTime() <= effectiveFrom.getTime()) {
    errors.push('effective_to_must_be_after_effective_from');
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    values: {
      id: `ai_credit_rule_${randomUUID()}`,
      provider: provider!,
      model: model!,
      meteringVersion: meteringVersion!,
      inputTokenWeight: formatNumeric(inputTokenWeight!),
      outputTokenWeight: formatNumeric(outputTokenWeight!),
      modelMultiplier: formatNumeric(modelMultiplier!),
      ragCreditSurcharge: ragCreditSurcharge!,
      creditsPerStandardTokenUnit: creditsPerStandardTokenUnit!,
      enabled: enabled!,
      effectiveFrom: effectiveFrom!,
      effectiveTo,
      createdAt: now,
      updatedAt: now,
    },
  };
}

function validatePatchInput(
  input: AiCreditMeteringRulePatchInput,
  current: PlatformAiCreditMeteringRuleRow,
  now: Date,
): { ok: true; values: PatchAiCreditMeteringRuleValues } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (hasForbiddenInputKeys(input)) errors.push('forbidden_sensitive_field');

  const values: PatchAiCreditMeteringRuleValues = { updatedAt: now };
  if (input.enabled !== undefined) {
    const enabled = normalizeBoolean(input.enabled);
    if (enabled === null) errors.push('enabled_invalid');
    else values.enabled = enabled;
  }
  if (input.effectiveFrom !== undefined) {
    const effectiveFrom = normalizeDate(input.effectiveFrom);
    if (!effectiveFrom) errors.push('effective_from_invalid');
    else values.effectiveFrom = effectiveFrom;
  }
  if (input.effectiveTo !== undefined) {
    if (input.effectiveTo === null) values.effectiveTo = null;
    else {
      const effectiveTo = normalizeDate(input.effectiveTo);
      if (!effectiveTo) errors.push('effective_to_invalid');
      else values.effectiveTo = effectiveTo;
    }
  }

  const effectiveFrom = values.effectiveFrom ?? current.effectiveFrom;
  const effectiveTo = values.effectiveTo !== undefined ? values.effectiveTo : current.effectiveTo;
  if (effectiveTo && effectiveTo.getTime() <= effectiveFrom.getTime()) {
    errors.push('effective_to_must_be_after_effective_from');
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, values };
}

export function createPlatformAiCreditMeteringRulesRepository(database: TenantDatabase) {
  return {
    async listRules(filters: AiCreditMeteringRuleListFilters = {}) {
      const conditions = [];
      if (filters.provider) conditions.push(eq(platformAiCreditMeteringRules.provider, filters.provider));
      if (filters.model) conditions.push(eq(platformAiCreditMeteringRules.model, filters.model));
      if (typeof filters.enabled === 'boolean') {
        conditions.push(eq(platformAiCreditMeteringRules.enabled, filters.enabled));
      }

      const query = database
        .select()
        .from(platformAiCreditMeteringRules)
        .$dynamic();

      const rows = await (conditions.length > 0
        ? query.where(and(...conditions))
        : query
      ).orderBy(
        desc(platformAiCreditMeteringRules.effectiveFrom),
        desc(platformAiCreditMeteringRules.createdAt),
      );

      return (rows as PlatformAiCreditMeteringRuleRow[]).map(mapPlatformAiCreditMeteringRuleToDto);
    },

    async findRuleById(id: string) {
      const rows = await database
        .select()
        .from(platformAiCreditMeteringRules)
        .where(eq(platformAiCreditMeteringRules.id, id))
        .limit(1);

      return (rows[0] as PlatformAiCreditMeteringRuleRow | undefined) ?? null;
    },

    async insertRule(values: CreateAiCreditMeteringRuleValues) {
      const rows = await database
        .insert(platformAiCreditMeteringRules)
        .values(values)
        .returning();

      const row = rows[0] as PlatformAiCreditMeteringRuleRow | undefined;
      if (!row) throw new Error('ai_credit_metering_rule_create_failed');
      return mapPlatformAiCreditMeteringRuleToDto(row);
    },

    async updateRule(id: string, values: PatchAiCreditMeteringRuleValues) {
      const rows = await database
        .update(platformAiCreditMeteringRules)
        .set(values)
        .where(eq(platformAiCreditMeteringRules.id, id))
        .returning();

      const row = rows[0] as PlatformAiCreditMeteringRuleRow | undefined;
      return row ? mapPlatformAiCreditMeteringRuleToDto(row) : null;
    },
  };
}

export type PlatformAiCreditMeteringRulesRepository = ReturnType<
  typeof createPlatformAiCreditMeteringRulesRepository
>;

export async function listPlatformAiCreditMeteringRules(input: {
  repository: PlatformAiCreditMeteringRulesRepository;
  filters?: AiCreditMeteringRuleListFilters;
}) {
  const records = await input.repository.listRules(input.filters ?? {});
  return {
    requestId: 'platform-ai-credit-metering-rules',
    records,
  };
}

export async function createPlatformAiCreditMeteringRule(input: {
  repository: PlatformAiCreditMeteringRulesRepository;
  payload: AiCreditMeteringRuleCreateInput;
  now?: Date;
}): Promise<CreateAiCreditMeteringRuleResult> {
  const validation = validateCreateInput(input.payload, input.now ?? new Date());
  if (!validation.ok) return { status: 'validation_failed', errors: validation.errors };

  try {
    const record = await input.repository.insertRule(validation.values);
    return { status: 'created', record };
  } catch (error) {
    if (isUniqueConflict(error)) {
      return { status: 'conflict', errorCode: 'METERING_RULE_VERSION_CONFLICT' };
    }
    throw error;
  }
}

export async function patchPlatformAiCreditMeteringRule(input: {
  repository: PlatformAiCreditMeteringRulesRepository;
  id: string;
  payload: AiCreditMeteringRulePatchInput;
  now?: Date;
}): Promise<PatchAiCreditMeteringRuleResult> {
  const current = await input.repository.findRuleById(input.id);
  if (!current) return { status: 'not_found', errorCode: 'METERING_RULE_NOT_FOUND' };

  const validation = validatePatchInput(input.payload, current, input.now ?? new Date());
  if (!validation.ok) return { status: 'validation_failed', errors: validation.errors };

  const record = await input.repository.updateRule(input.id, validation.values);
  if (!record) return { status: 'not_found', errorCode: 'METERING_RULE_NOT_FOUND' };
  return { status: 'updated', record };
}
