import { isProxy } from 'node:util/types';

const SOURCE_STATES = [
  'complete',
  'unknown',
  'partial',
  'stale',
  'unavailable',
] as const;
const FACT_STATES = ['present', 'empty', 'unknown'] as const;
const QUALITY_STATES = ['present', 'absent', 'unknown'] as const;
const ROOT_KEYS = ['partitions'] as const;
const PARTITION_KEYS = [
  'currency',
  'sourceState',
  'financialFacts',
  'quality',
] as const;
const QUALITY_KEYS = [
  'duplicateExcluded',
  'orphanRefund',
  'unmatchedCustomer',
  'unmappedProject',
] as const;

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
  financialFacts: AnalyticsDataIntegrityFactState;
  quality: AnalyticsDataIntegrityQuality;
}>;

export type AnalyticsDataIntegrityInput = Readonly<{
  partitions: readonly AnalyticsDataIntegrityPartitionInput[];
}>;

declare const futureAnalyticsPartitionAuthorityEvidence: unique symbol;

/**
 * Reserved owner-sealed evidence for a future server adapter. This slice has
 * no constructor, validator, or promotion path for it.
 */
export type FutureAnalyticsPartitionAuthorityEvidence = Readonly<{
  readonly [futureAnalyticsPartitionAuthorityEvidence]: Readonly<{
    tenantId: string;
    institutionId: string;
    currency: string;
    timeWindow: Readonly<{
      startInclusive: string;
      endExclusive: string;
    }>;
    sourceRevision: string;
    coverage: 'complete';
  }>;
}>;

export type AnalyticsDataIntegrityPartitionDecision = Readonly<{
  currency: string;
  availability: AnalyticsDataIntegritySourceState;
  financialFacts: AnalyticsDataIntegrityFactState;
  zeroDisplay: 'authority_required' | 'withheld';
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

function includesValue<T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

function isRuntimeProxy(value: object): boolean {
  try {
    return typeof isProxy !== 'function' || isProxy(value);
  } catch {
    return true;
  }
}

function snapshotExactPlainDataObject(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      typeof value !== 'object' ||
      value === null ||
      isRuntimeProxy(value) ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return null;
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
    ) {
      return null;
    }

    const snapshot: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !('value' in descriptor) ||
        !descriptor.enumerable
      ) {
        return null;
      }
      Object.defineProperty(snapshot, key, {
        value: descriptor.value,
        enumerable: true,
        writable: false,
        configurable: false,
      });
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function snapshotDenseExactArray(value: unknown): readonly unknown[] | null {
  try {
    if (
      typeof value !== 'object' ||
      value === null ||
      isRuntimeProxy(value) ||
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) {
      return null;
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    const lengthDescriptor = descriptors['length'] as
      | PropertyDescriptor
      | undefined;
    if (
      lengthDescriptor === undefined ||
      !('value' in lengthDescriptor) ||
      typeof lengthDescriptor.value !== 'number' ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    ) {
      return null;
    }
    const length = lengthDescriptor.value;
    if (keys.length !== length + 1) return null;

    const snapshot: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (
        descriptor === undefined ||
        !('value' in descriptor) ||
        !descriptor.enumerable
      ) {
        return null;
      }
      snapshot.push(descriptor.value);
    }
    if (
      keys.some(
        (key) =>
          key !== 'length' &&
          (typeof key !== 'string' || !/^0$|^[1-9]\d*$/.test(key)),
      )
    ) {
      return null;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function isCurrency(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[A-Z]{3}$/.test(value) &&
    ISO_4217_CURRENCIES.has(value)
  );
}

function snapshotQuality(value: unknown): AnalyticsDataIntegrityQuality | null {
  const snapshot = snapshotExactPlainDataObject(value, QUALITY_KEYS);
  if (
    snapshot === null ||
    !includesValue(QUALITY_STATES, snapshot.duplicateExcluded) ||
    !includesValue(QUALITY_STATES, snapshot.orphanRefund) ||
    !includesValue(QUALITY_STATES, snapshot.unmatchedCustomer) ||
    !includesValue(QUALITY_STATES, snapshot.unmappedProject)
  ) {
    return null;
  }

  return Object.freeze({
    duplicateExcluded: snapshot.duplicateExcluded,
    orphanRefund: snapshot.orphanRefund,
    unmatchedCustomer: snapshot.unmatchedCustomer,
    unmappedProject: snapshot.unmappedProject,
  });
}

function snapshotPartition(
  value: unknown,
): AnalyticsDataIntegrityPartitionInput | null {
  const snapshot = snapshotExactPlainDataObject(value, PARTITION_KEYS);
  if (
    snapshot === null ||
    !isCurrency(snapshot.currency) ||
    !includesValue(SOURCE_STATES, snapshot.sourceState) ||
    !includesValue(FACT_STATES, snapshot.financialFacts)
  ) {
    return null;
  }

  const quality = snapshotQuality(snapshot.quality);
  if (quality === null) return null;

  return Object.freeze({
    currency: snapshot.currency,
    sourceState: snapshot.sourceState,
    financialFacts: snapshot.financialFacts,
    quality,
  });
}

function unknownQuality(): AnalyticsDataIntegrityQuality {
  return Object.freeze({
    duplicateExcluded: 'unknown',
    orphanRefund: 'unknown',
    unmatchedCustomer: 'unknown',
    unmappedProject: 'unknown',
  });
}

function createDecision(
  partition: AnalyticsDataIntegrityPartitionInput,
): AnalyticsDataIntegrityPartitionDecision {
  const authorityRequired =
    partition.sourceState === 'complete' && partition.financialFacts === 'empty';

  return Object.freeze({
    currency: partition.currency,
    availability: partition.sourceState,
    financialFacts: 'unknown',
    zeroDisplay: authorityRequired ? 'authority_required' : 'withheld',
    quality: unknownQuality(),
  });
}

function failure(
  reasonCode: Extract<AnalyticsDataIntegrityResult, { ok: false }>['reasonCode'],
): AnalyticsDataIntegrityResult {
  return Object.freeze({ ok: false, reasonCode });
}

/**
 * Produces only per-currency candidate integrity decisions. It never carries
 * monetary values or a cross-currency total, and cannot display zero. A future
 * server adapter may consume owner-sealed scope-bound evidence to promote one
 * partition after BASE scope guards exist; that path is intentionally absent.
 */
export function adjudicateAnalyticsDataIntegrity(
  input: unknown,
): AnalyticsDataIntegrityResult {
  const root = snapshotExactPlainDataObject(input, ROOT_KEYS);
  if (root === null) return failure('invalid_input');

  const rawPartitions = snapshotDenseExactArray(root.partitions);
  if (rawPartitions === null || rawPartitions.length === 0) {
    return failure('invalid_partition_set');
  }

  const currencies = new Set<string>();
  const decisions: AnalyticsDataIntegrityPartitionDecision[] = [];

  for (const rawPartition of rawPartitions) {
    const partition = snapshotPartition(rawPartition);
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
