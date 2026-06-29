import { and, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';

import type { AiCreditMeteringRuleInput } from '@/modules/institution/domain/ai-credits-metering';
import type { TenantDatabase } from '@/server/db/client';
import { platformAiCreditMeteringRules } from '@/server/db/schema';

type PlatformAiCreditMeteringRuleRow = typeof platformAiCreditMeteringRules.$inferSelect;

export type AiCreditMeteringRuleNoRuleReason = 'missing_metering_rule';

export type SelectedAiCreditMeteringRuleMetadata = {
  id: string;
  provider: string;
  model: string;
  meteringVersion: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
};

export type AiCreditMeteringRuleLookupResult =
  | {
      status: 'found';
      rule: AiCreditMeteringRuleInput;
      selectedRule: SelectedAiCreditMeteringRuleMetadata;
    }
  | {
      status: 'no_rule';
      reason: AiCreditMeteringRuleNoRuleReason;
      rule: null;
    };

function toRuleNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

function toIsoString(value: Date): string {
  return value.toISOString();
}

export function mapPlatformAiCreditMeteringRuleRowToDomainRule(
  row: PlatformAiCreditMeteringRuleRow,
): AiCreditMeteringRuleInput {
  return {
    enabled: row.enabled,
    meteringVersion: row.meteringVersion,
    inputTokenWeight: toRuleNumber(row.inputTokenWeight),
    outputTokenWeight: toRuleNumber(row.outputTokenWeight),
    modelMultiplier: toRuleNumber(row.modelMultiplier),
    creditsPerStandardTokenUnit: row.creditsPerStandardTokenUnit,
    ragCreditSurcharge: row.ragCreditSurcharge,
  };
}

function mapSelectedRuleMetadata(
  row: PlatformAiCreditMeteringRuleRow,
): SelectedAiCreditMeteringRuleMetadata {
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    meteringVersion: row.meteringVersion,
    effectiveFrom: toIsoString(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? toIsoString(row.effectiveTo) : null,
    createdAt: toIsoString(row.createdAt),
  };
}

function isEffectiveRuleRow(input: {
  row: PlatformAiCreditMeteringRuleRow;
  provider: string;
  model: string;
  at: Date;
}) {
  const { row, provider, model, at } = input;
  const atTime = at.getTime();

  return row.provider === provider
    && row.model === model
    && row.enabled
    && row.effectiveFrom.getTime() <= atTime
    && (row.effectiveTo === null || row.effectiveTo.getTime() > atTime);
}

export function selectCurrentAiCreditMeteringRule(input: {
  rows: PlatformAiCreditMeteringRuleRow[];
  provider: string;
  model: string;
  at: Date;
}): AiCreditMeteringRuleLookupResult {
  const selected = input.rows
    .filter((row) => isEffectiveRuleRow({ row, provider: input.provider, model: input.model, at: input.at }))
    .sort((left, right) => {
      const effectiveFromDiff = right.effectiveFrom.getTime() - left.effectiveFrom.getTime();
      if (effectiveFromDiff !== 0) return effectiveFromDiff;

      return right.createdAt.getTime() - left.createdAt.getTime();
    })[0];

  if (!selected) {
    return {
      status: 'no_rule',
      reason: 'missing_metering_rule',
      rule: null,
    };
  }

  return {
    status: 'found',
    rule: mapPlatformAiCreditMeteringRuleRowToDomainRule(selected),
    selectedRule: mapSelectedRuleMetadata(selected),
  };
}

export function createAiCreditMeteringRulesRepository(database: TenantDatabase) {
  return {
    async findCurrentRuleForProviderModel(input: {
      provider: string;
      model: string;
      at?: Date;
    }): Promise<AiCreditMeteringRuleLookupResult> {
      const at = input.at ?? new Date();
      const rows = await database
        .select()
        .from(platformAiCreditMeteringRules)
        .where(
          and(
            eq(platformAiCreditMeteringRules.provider, input.provider),
            eq(platformAiCreditMeteringRules.model, input.model),
            eq(platformAiCreditMeteringRules.enabled, true),
            lte(platformAiCreditMeteringRules.effectiveFrom, at),
            or(
              isNull(platformAiCreditMeteringRules.effectiveTo),
              gt(platformAiCreditMeteringRules.effectiveTo, at),
            ),
          ),
        )
        .orderBy(
          desc(platformAiCreditMeteringRules.effectiveFrom),
          desc(platformAiCreditMeteringRules.createdAt),
        )
        .limit(1);

      return selectCurrentAiCreditMeteringRule({
        rows: rows as PlatformAiCreditMeteringRuleRow[],
        provider: input.provider,
        model: input.model,
        at,
      });
    },
  };
}

export type AiCreditMeteringRulesRepository = ReturnType<
  typeof createAiCreditMeteringRulesRepository
>;
