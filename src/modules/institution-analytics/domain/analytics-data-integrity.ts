const SOURCE_STATES = [
  'complete',
  'unknown',
  'partial',
  'stale',
  'unavailable',
] as const;

const FACT_STATES = ['present', 'empty', 'unknown'] as const;
const QUALITY_STATES = ['present', 'absent', 'unknown'] as const;

export type AnalyticsDataIntegritySourceState = (typeof SOURCE_STATES)[number];
export type AnalyticsDataIntegrityFactState = (typeof FACT_STATES)[number];
export type AnalyticsDataIntegrityQualityState = (typeof QUALITY_STATES)[number];

export type AnalyticsDataIntegrityQuality = Readonly<{
  duplicateExcluded: AnalyticsDataIntegrityQualityState;
  orphanRefund: AnalyticsDataIntegrityQualityState;
  unmatchedCustomer: AnalyticsDataIntegrityQualityState;
  unmappedProject: AnalyticsDataIntegrityQualityState;
}>;

export type AnalyticsDataIntegrityPartitionInput = Readonly<{
  currency: string;
  sourceState: AnalyticsDataIntegritySourceState;
  sourceIsAuthoritative: boolean;
  financialFacts: AnalyticsDataIntegrityFactState;
  quality: AnalyticsDataIntegrityQuality;
}>;

export type AnalyticsDataIntegrityInput = Readonly<{
  partitions: readonly AnalyticsDataIntegrityPartitionInput[];
}>;

export type AnalyticsDataIntegrityPartitionDecision = Readonly<{
  currency: string;
  availability: AnalyticsDataIntegritySourceState;
  financialFacts: AnalyticsDataIntegrityFactState;
  zeroDisplay: 'allowed' | 'withheld';
  quality: AnalyticsDataIntegrityQuality;
}>;

export type AnalyticsDataIntegrityResult =
  | Readonly<{
      ok: true;
      partitions: readonly AnalyticsDataIntegrityPartitionDecision[];
    }>
  | Readonly<{
      ok: false;
      reasonCode:
        | 'invalid_input'
        | 'invalid_partition_set'
        | 'invalid_partition'
        | 'duplicate_currency_partition';
    }>;

const ISO_4217_CURRENCIES = new Set(Intl.supportedValuesOf('currency'));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === keys.length &&
    actualKeys.every((key) => keys.includes(key))
  );
}

function includesValue<T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

function isCurrency(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[A-Z]{3}$/.test(value) &&
    ISO_4217_CURRENCIES.has(value)
  );
}

function parseQuality(value: unknown): AnalyticsDataIntegrityQuality | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'duplicateExcluded',
      'orphanRefund',
      'unmatchedCustomer',
      'unmappedProject',
    ]) ||
    !includesValue(QUALITY_STATES, value.duplicateExcluded) ||
    !includesValue(QUALITY_STATES, value.orphanRefund) ||
    !includesValue(QUALITY_STATES, value.unmatchedCustomer) ||
    !includesValue(QUALITY_STATES, value.unmappedProject)
  ) {
    return null;
  }

  return Object.freeze({
    duplicateExcluded: value.duplicateExcluded,
    orphanRefund: value.orphanRefund,
    unmatchedCustomer: value.unmatchedCustomer,
    unmappedProject: value.unmappedProject,
  });
}

function parsePartition(
  value: unknown,
): AnalyticsDataIntegrityPartitionInput | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'currency',
      'sourceState',
      'sourceIsAuthoritative',
      'financialFacts',
      'quality',
    ]) ||
    !isCurrency(value.currency) ||
    !includesValue(SOURCE_STATES, value.sourceState) ||
    typeof value.sourceIsAuthoritative !== 'boolean' ||
    !includesValue(FACT_STATES, value.financialFacts)
  ) {
    return null;
  }

  const quality = parseQuality(value.quality);
  if (quality === null) return null;

  return Object.freeze({
    currency: value.currency,
    sourceState: value.sourceState,
    sourceIsAuthoritative: value.sourceIsAuthoritative,
    financialFacts: value.financialFacts,
    quality,
  });
}

function createDecision(
  partition: AnalyticsDataIntegrityPartitionInput,
): AnalyticsDataIntegrityPartitionDecision {
  const authoritativeComplete =
    partition.sourceIsAuthoritative && partition.sourceState === 'complete';
  const availability: AnalyticsDataIntegritySourceState =
    partition.sourceIsAuthoritative ? partition.sourceState : 'unknown';
  const financialFacts: AnalyticsDataIntegrityFactState =
    authoritativeComplete || partition.financialFacts === 'present'
      ? partition.financialFacts
      : 'unknown';

  return Object.freeze({
    currency: partition.currency,
    availability,
    financialFacts,
    zeroDisplay:
      authoritativeComplete && partition.financialFacts === 'empty'
        ? 'allowed'
        : 'withheld',
    quality: partition.quality,
  });
}

function failure(
  reasonCode: Extract<AnalyticsDataIntegrityResult, { ok: false }>['reasonCode'],
): AnalyticsDataIntegrityResult {
  return Object.freeze({ ok: false, reasonCode });
}

/**
 * Adjudicates whether each currency partition can truthfully be rendered as
 * empty. It intentionally carries no monetary values or cross-currency total.
 */
export function adjudicateAnalyticsDataIntegrity(
  input: unknown,
): AnalyticsDataIntegrityResult {
  if (!isRecord(input) || !hasExactKeys(input, ['partitions'])) {
    return failure('invalid_input');
  }
  if (!Array.isArray(input.partitions) || input.partitions.length === 0) {
    return failure('invalid_partition_set');
  }

  const currencies = new Set<string>();
  const decisions: AnalyticsDataIntegrityPartitionDecision[] = [];

  for (const rawPartition of input.partitions) {
    const partition = parsePartition(rawPartition);
    if (partition === null) return failure('invalid_partition');
    if (currencies.has(partition.currency)) {
      return failure('duplicate_currency_partition');
    }
    currencies.add(partition.currency);
    decisions.push(createDecision(partition));
  }

  decisions.sort((left, right) => left.currency.localeCompare(right.currency));
  return Object.freeze({ ok: true, partitions: Object.freeze(decisions) });
}
