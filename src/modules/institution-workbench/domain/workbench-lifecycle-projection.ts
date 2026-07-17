import {
  CUSTOMER_LIFECYCLE_VALUES_V1,
  isCustomerLifecycleV1,
  type CustomerLifecycleSummaryV1,
  type CustomerLifecycleV1,
} from '@/modules/institution-contracts/v1/customer';
import {
  isInstitutionSourcePartitionReadinessV1,
  isInstitutionSourceReadinessV1,
} from '@/modules/institution-contracts/v1/institution-source';

import {
  type WorkbenchLifecycleCanonicalHref,
  type WorkbenchLifecycleItemViewModel,
  type WorkbenchLifecycleKey,
  type WorkbenchLifecycleLabelByKey,
  type WorkbenchLifecycleProjection,
} from './workbench-lifecycle-view-models';

export type BuildWorkbenchLifecycleProjectionInput = {
  lifecycle: CustomerLifecycleSummaryV1;
};

type LifecycleDefinition = {
  [K in WorkbenchLifecycleKey]: {
    key: K;
    label: WorkbenchLifecycleLabelByKey[K];
    canonicalHref: WorkbenchLifecycleCanonicalHref<K>;
  };
}[WorkbenchLifecycleKey];

type LifecyclePartition = CustomerLifecycleSummaryV1['partitions'][number];
type LifecycleBucket = NonNullable<
  CustomerLifecycleSummaryV1['data']
>['buckets'][number];

const LIFECYCLE_DEFINITIONS = Object.freeze([
  {
    key: 'consulting',
    label: '咨询中',
    canonicalHref: '/hospital/customers?lifecycle=consulting',
  },
  {
    key: 'scheduled',
    label: '已预约',
    canonicalHref: '/hospital/customers?lifecycle=scheduled',
  },
  {
    key: 'post_care',
    label: '术后关怀',
    canonicalHref: '/hospital/customers?lifecycle=post_care',
  },
  {
    key: 'repurchase_window',
    label: '复购窗口',
    canonicalHref: '/hospital/customers?lifecycle=repurchase_window',
  },
] as const satisfies readonly LifecycleDefinition[]);

function blockedProjection(): WorkbenchLifecycleProjection {
  return {
    status: 'blocked',
    items: [],
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function toTimestamp(value: unknown): number | null {
  if (typeof value !== 'string' || !value.includes('T')) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isValidSnapshotFreshness(value: LifecyclePartition['freshness']): value is NonNullable<
  LifecyclePartition['freshness']
> {
  if (value === null) {
    return false;
  }

  const observedAt = toTimestamp(value.observedAt);
  const freshUntil = toTimestamp(value.freshUntil);
  return observedAt !== null && freshUntil !== null && observedAt <= freshUntil;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function hasCompleteUniqueLifecycleKeys(entries: unknown): entries is Array<{
  key: CustomerLifecycleV1;
}> {
  if (!Array.isArray(entries) || entries.length !== CUSTOMER_LIFECYCLE_VALUES_V1.length) {
    return false;
  }

  const keys = entries.map((entry) =>
    entry !== null && typeof entry === 'object' && 'key' in entry ? entry.key : null,
  );

  return (
    keys.every(isCustomerLifecycleV1) &&
    new Set(keys).size === CUSTOMER_LIFECYCLE_VALUES_V1.length &&
    CUSTOMER_LIFECYCLE_VALUES_V1.every((key) => keys.includes(key))
  );
}

function findUniquePartition(
  source: CustomerLifecycleSummaryV1,
  key: CustomerLifecycleV1,
): LifecyclePartition | null {
  const matches = source.partitions.filter((partition) => partition.key === key);
  return matches.length === 1 ? matches[0] : null;
}

function findUniqueBucket(
  source: CustomerLifecycleSummaryV1,
  key: CustomerLifecycleV1,
): LifecycleBucket | null {
  const matches = source.data?.buckets.filter((bucket) => bucket.key === key) ?? [];
  return matches.length === 1 ? matches[0] : null;
}

function unavailableItem(definition: LifecycleDefinition): WorkbenchLifecycleItemViewModel {
  return {
    key: definition.key,
    label: definition.label,
    status: 'unavailable',
    count: null,
    canonicalHref: null,
  } as WorkbenchLifecycleItemViewModel;
}

function staleUnknownItem(definition: LifecycleDefinition): WorkbenchLifecycleItemViewModel {
  return {
    key: definition.key,
    label: definition.label,
    status: 'stale',
    count: null,
    observedAt: null,
    canonicalHref: null,
  } as WorkbenchLifecycleItemViewModel;
}

function projectLifecycleItem(
  source: CustomerLifecycleSummaryV1,
  definition: LifecycleDefinition,
): WorkbenchLifecycleItemViewModel | null {
  const partition = findUniquePartition(source, definition.key);
  if (partition === null) {
    return null;
  }

  if (partition.readiness === 'denied' || partition.readiness === 'disabled') {
    return null;
  }

  if (partition.readiness === 'unavailable') {
    return unavailableItem(definition);
  }

  const bucket = findUniqueBucket(source, definition.key);

  if (partition.readiness === 'stale') {
    const topAllowsStale = source.readiness === 'stale' || source.readiness === 'partial';
    if (
      !topAllowsStale ||
      bucket === null ||
      !isNonNegativeInteger(bucket.count) ||
      !isValidSnapshotFreshness(partition.freshness)
    ) {
      return staleUnknownItem(definition);
    }

    return {
      key: definition.key,
      label: definition.label,
      status: 'stale',
      count: bucket.count,
      observedAt: partition.freshness.observedAt,
      canonicalHref: definition.canonicalHref,
    } as WorkbenchLifecycleItemViewModel;
  }

  const topAllowsCurrent =
    source.readiness === 'ready' ||
    source.readiness === 'empty' ||
    source.readiness === 'partial';
  if (!topAllowsCurrent || bucket === null) {
    return unavailableItem(definition);
  }

  if (partition.readiness === 'empty') {
    if (bucket.count !== 0) {
      return unavailableItem(definition);
    }

    return {
      key: definition.key,
      label: definition.label,
      status: 'empty',
      count: 0,
      canonicalHref: definition.canonicalHref,
    } as WorkbenchLifecycleItemViewModel;
  }

  if (!isPositiveInteger(bucket.count)) {
    return unavailableItem(definition);
  }

  return {
    key: definition.key,
    label: definition.label,
    status: 'ready',
    count: bucket.count,
    canonicalHref: definition.canonicalHref,
  } as WorkbenchLifecycleItemViewModel;
}

function sourceFailsClosed(source: CustomerLifecycleSummaryV1): boolean {
  if (
    source.contractVersion !== 'v1' ||
    !isInstitutionSourceReadinessV1(source.readiness) ||
    !isNonEmptyString(source.scope?.tenantId) ||
    !isNonEmptyString(source.scope?.institutionId) ||
    !hasCompleteUniqueLifecycleKeys(source.partitions) ||
    source.partitions.some(
      (partition) =>
        !isInstitutionSourcePartitionReadinessV1(partition.readiness) ||
        partition.failureCode === 'scope_mismatch',
    ) ||
    source.failureCode === 'scope_mismatch'
  ) {
    return true;
  }

  if (source.data !== null && !hasCompleteUniqueLifecycleKeys(source.data.buckets)) {
    return true;
  }

  return false;
}

/**
 * Low-sensitivity pure display consumer for a typed CustomerLifecycleSummaryV1 snapshot.
 * It is not a provider, wire parser, reader, or authorizer. BASE-02 must bind any future
 * production invocation to the current server-side scope before this projection runs.
 */
export function buildWorkbenchLifecycleProjection({
  lifecycle,
}: BuildWorkbenchLifecycleProjectionInput): WorkbenchLifecycleProjection {
  if (
    sourceFailsClosed(lifecycle) ||
    lifecycle.readiness === 'denied' ||
    lifecycle.readiness === 'disabled'
  ) {
    return blockedProjection();
  }

  return {
    status: 'projected',
    sourceReadiness: lifecycle.readiness,
    items: LIFECYCLE_DEFINITIONS.flatMap((definition) => {
      const item = projectLifecycleItem(lifecycle, definition);
      return item === null ? [] : [item];
    }),
  };
}
