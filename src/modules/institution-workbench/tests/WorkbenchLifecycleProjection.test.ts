import { describe, expect, it } from 'vitest';

import {
  CUSTOMER_LIFECYCLE_VALUES_V1,
  type CustomerLifecycleSummaryV1,
  type CustomerLifecycleV1,
} from '@/modules/institution-contracts/v1/customer';
import { buildWorkbenchLifecycleProjection } from '@/modules/institution-workbench/domain/workbench-lifecycle-projection';
import { WORKBENCH_LIFECYCLE_KEYS } from '@/modules/institution-workbench/domain/workbench-lifecycle-view-models';

const scope = {
  tenantId: 'tenant-safe-reference',
  institutionId: 'institution-safe-reference',
};

const currentFreshness = {
  observedAt: '2026-07-17T01:00:00.000Z',
  freshUntil: '2026-07-17T01:05:00.000Z',
};

type PartitionReadiness = CustomerLifecycleSummaryV1['partitions'][number]['readiness'];

type SourceOptions = {
  readiness?: CustomerLifecycleSummaryV1['readiness'];
  freshness?: CustomerLifecycleSummaryV1['freshness'];
  partitionReadiness?: Partial<Record<CustomerLifecycleV1, PartitionReadiness>>;
  partitionFreshness?: Partial<
    Record<CustomerLifecycleV1, CustomerLifecycleSummaryV1['partitions'][number]['freshness']>
  >;
  partitionFailureCode?: Partial<
    Record<CustomerLifecycleV1, CustomerLifecycleSummaryV1['partitions'][number]['failureCode']>
  >;
  counts?: Partial<Record<CustomerLifecycleV1, number | null>>;
  data?: CustomerLifecycleSummaryV1['data'];
  failureCode?: CustomerLifecycleSummaryV1['failureCode'];
};

function lifecycleSource(options: SourceOptions = {}): CustomerLifecycleSummaryV1 {
  const partitionReadiness = options.partitionReadiness ?? {};
  const partitionFreshness = options.partitionFreshness ?? {};
  const partitionFailureCode = options.partitionFailureCode ?? {};
  const counts = options.counts ?? {};

  return {
    contractVersion: 'v1',
    scope: { ...scope },
    readiness: options.readiness ?? 'ready',
    freshness: options.freshness === undefined ? currentFreshness : options.freshness,
    partitions: CUSTOMER_LIFECYCLE_VALUES_V1.map((key) => ({
      key,
      readiness: partitionReadiness[key] ?? 'ready',
      freshness:
        key in partitionFreshness ? (partitionFreshness[key] ?? null) : currentFreshness,
      failureCode: partitionFailureCode[key] ?? null,
    })),
    data:
      options.data === undefined
        ? {
            buckets: CUSTOMER_LIFECYCLE_VALUES_V1.map((key) => ({
              key,
              count: key in counts ? (counts[key] ?? null) : 1,
            })),
          }
        : options.data,
    failureCode: options.failureCode ?? null,
  };
}

describe('WorkbenchLifecycleProjection', () => {
  it('projects the first four lifecycle buckets in fixed order with fixed labels and URLs', () => {
    const source = lifecycleSource({
      counts: {
        consulting: 4,
        scheduled: 3,
        post_care: 2,
        repurchase_window: 1,
        silent_reactivation: 99,
      },
    });
    if (source.data !== null) {
      source.data.buckets.reverse();
    }
    source.partitions.reverse();

    const result = buildWorkbenchLifecycleProjection({ lifecycle: source });

    expect(WORKBENCH_LIFECYCLE_KEYS).toEqual([
      'consulting',
      'scheduled',
      'post_care',
      'repurchase_window',
    ]);
    expect(result).toEqual({
      status: 'projected',
      sourceReadiness: 'ready',
      items: [
        {
          key: 'consulting',
          label: '咨询中',
          status: 'ready',
          count: 4,
          canonicalHref: '/hospital/customers?lifecycle=consulting',
        },
        {
          key: 'scheduled',
          label: '已预约',
          status: 'ready',
          count: 3,
          canonicalHref: '/hospital/customers?lifecycle=scheduled',
        },
        {
          key: 'post_care',
          label: '术后关怀',
          status: 'ready',
          count: 2,
          canonicalHref: '/hospital/customers?lifecycle=post_care',
        },
        {
          key: 'repurchase_window',
          label: '复购窗口',
          status: 'ready',
          count: 1,
          canonicalHref: '/hospital/customers?lifecycle=repurchase_window',
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('silent_reactivation');
    expect(JSON.stringify(result)).not.toContain('99');
  });

  it('shows zero only for authoritative empty and degrades invalid current counts', () => {
    const result = buildWorkbenchLifecycleProjection({
      lifecycle: lifecycleSource({
        readiness: 'ready',
        partitionReadiness: {
          consulting: 'empty',
          scheduled: 'ready',
          post_care: 'empty',
          repurchase_window: 'ready',
          silent_reactivation: 'empty',
        },
        partitionFreshness: {
          consulting: null,
          post_care: null,
          silent_reactivation: null,
        },
        counts: {
          consulting: 0,
          scheduled: 0,
          post_care: 2,
          repurchase_window: null,
          silent_reactivation: 0,
        },
      }),
    });

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    expect(result.items).toEqual([
      {
        key: 'consulting',
        label: '咨询中',
        status: 'empty',
        count: 0,
        canonicalHref: '/hospital/customers?lifecycle=consulting',
      },
      {
        key: 'scheduled',
        label: '已预约',
        status: 'unavailable',
        count: null,
        canonicalHref: null,
      },
      {
        key: 'post_care',
        label: '术后关怀',
        status: 'unavailable',
        count: null,
        canonicalHref: null,
      },
      {
        key: 'repurchase_window',
        label: '复购窗口',
        status: 'unavailable',
        count: null,
        canonicalHref: null,
      },
    ]);
  });

  it('accepts the frozen authoritative empty shape with null freshness', () => {
    const result = buildWorkbenchLifecycleProjection({
      lifecycle: lifecycleSource({
        readiness: 'empty',
        freshness: null,
        partitionReadiness: {
          consulting: 'empty',
          scheduled: 'empty',
          post_care: 'empty',
          repurchase_window: 'empty',
          silent_reactivation: 'empty',
        },
        partitionFreshness: {
          consulting: null,
          scheduled: null,
          post_care: null,
          repurchase_window: null,
          silent_reactivation: null,
        },
        counts: {
          consulting: 0,
          scheduled: 0,
          post_care: 0,
          repurchase_window: 0,
          silent_reactivation: 0,
        },
      }),
    });

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    expect(result.sourceReadiness).toBe('empty');
    expect(result.items).toHaveLength(4);
    expect(result.items.every((item) => item.status === 'empty' && item.count === 0)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('observedAt');
  });

  it('preserves valid partial partitions and omits denied or disabled lifecycle items', () => {
    const result = buildWorkbenchLifecycleProjection({
      lifecycle: lifecycleSource({
        readiness: 'partial',
        partitionReadiness: {
          consulting: 'ready',
          scheduled: 'empty',
          post_care: 'stale',
          repurchase_window: 'unavailable',
          silent_reactivation: 'disabled',
        },
        partitionFreshness: {
          post_care: {
            observedAt: '2026-07-16T03:00:00.000Z',
            freshUntil: '2026-07-16T03:05:00.000Z',
          },
          repurchase_window: null,
          silent_reactivation: null,
        },
        counts: {
          consulting: 8,
          scheduled: 0,
          post_care: 5,
          repurchase_window: null,
          silent_reactivation: null,
        },
      }),
    });

    expect(result).toEqual({
      status: 'projected',
      sourceReadiness: 'partial',
      items: [
        {
          key: 'consulting',
          label: '咨询中',
          status: 'ready',
          count: 8,
          canonicalHref: '/hospital/customers?lifecycle=consulting',
        },
        {
          key: 'scheduled',
          label: '已预约',
          status: 'empty',
          count: 0,
          canonicalHref: '/hospital/customers?lifecycle=scheduled',
        },
        {
          key: 'post_care',
          label: '术后关怀',
          status: 'stale',
          count: 5,
          observedAt: '2026-07-16T03:00:00.000Z',
          canonicalHref: '/hospital/customers?lifecycle=post_care',
        },
        {
          key: 'repurchase_window',
          label: '复购窗口',
          status: 'unavailable',
          count: null,
          canonicalHref: null,
        },
      ],
    });
  });

  it('omits denied and disabled visible partitions while stripping unavailable payload values', () => {
    const result = buildWorkbenchLifecycleProjection({
      lifecycle: lifecycleSource({
        readiness: 'partial',
        partitionReadiness: {
          consulting: 'denied',
          scheduled: 'disabled',
          post_care: 'unavailable',
          repurchase_window: 'ready',
          silent_reactivation: 'unavailable',
        },
        counts: {
          consulting: 101,
          scheduled: 102,
          post_care: 103,
          repurchase_window: 4,
          silent_reactivation: 104,
        },
      }),
    });

    expect(result).toEqual({
      status: 'projected',
      sourceReadiness: 'partial',
      items: [
        {
          key: 'post_care',
          label: '术后关怀',
          status: 'unavailable',
          count: null,
          canonicalHref: null,
        },
        {
          key: 'repurchase_window',
          label: '复购窗口',
          status: 'ready',
          count: 4,
          canonicalHref: '/hospital/customers?lifecycle=repurchase_window',
        },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(/101|102|103|104/);
  });

  it('uses only a valid partition freshness for stale snapshots', () => {
    const result = buildWorkbenchLifecycleProjection({
      lifecycle: lifecycleSource({
        readiness: 'stale',
        partitionReadiness: {
          consulting: 'stale',
          scheduled: 'stale',
          post_care: 'stale',
          repurchase_window: 'stale',
          silent_reactivation: 'stale',
        },
        partitionFreshness: {
          consulting: {
            observedAt: '2026-07-15T02:00:00.000Z',
            freshUntil: '2026-07-15T02:05:00.000Z',
          },
          scheduled: null,
          post_care: {
            observedAt: 'not-a-timestamp',
            freshUntil: '2026-07-15T02:05:00.000Z',
          },
          repurchase_window: {
            observedAt: '2026-07-15T03:00:00.000Z',
            freshUntil: '2026-07-15T02:59:59.000Z',
          },
        },
        counts: {
          consulting: 0,
          scheduled: 2,
          post_care: 3,
          repurchase_window: 4,
          silent_reactivation: 5,
        },
      }),
    });

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    expect(result.items[0]).toEqual({
      key: 'consulting',
      label: '咨询中',
      status: 'stale',
      count: 0,
      observedAt: '2026-07-15T02:00:00.000Z',
      canonicalHref: '/hospital/customers?lifecycle=consulting',
    });
    expect(result.items.slice(1)).toEqual([
      {
        key: 'scheduled',
        label: '已预约',
        status: 'stale',
        count: null,
        observedAt: null,
        canonicalHref: null,
      },
      {
        key: 'post_care',
        label: '术后关怀',
        status: 'stale',
        count: null,
        observedAt: null,
        canonicalHref: null,
      },
      {
        key: 'repurchase_window',
        label: '复购窗口',
        status: 'stale',
        count: null,
        observedAt: null,
        canonicalHref: null,
      },
    ]);
  });

  it('renders unavailable or stale placeholders without inventing data when payload is absent', () => {
    const unavailable = lifecycleSource({
      readiness: 'unavailable',
      partitionReadiness: Object.fromEntries(
        CUSTOMER_LIFECYCLE_VALUES_V1.map((key) => [key, 'unavailable']),
      ),
      data: null,
    });
    const stale = lifecycleSource({
      readiness: 'stale',
      partitionReadiness: Object.fromEntries(
        CUSTOMER_LIFECYCLE_VALUES_V1.map((key) => [key, 'stale']),
      ),
      partitionFreshness: Object.fromEntries(
        CUSTOMER_LIFECYCLE_VALUES_V1.map((key) => [key, null]),
      ),
      data: null,
    });

    const unavailableResult = buildWorkbenchLifecycleProjection({ lifecycle: unavailable });
    const staleResult = buildWorkbenchLifecycleProjection({ lifecycle: stale });

    expect(unavailableResult.status).toBe('projected');
    expect(staleResult.status).toBe('projected');
    if (unavailableResult.status !== 'projected' || staleResult.status !== 'projected') {
      return;
    }

    expect(unavailableResult.items).toHaveLength(4);
    expect(unavailableResult.items.every((item) => item.status === 'unavailable')).toBe(true);
    expect(unavailableResult.items.every((item) => item.count === null)).toBe(true);
    expect(staleResult.items).toHaveLength(4);
    expect(staleResult.items.every((item) => item.status === 'stale')).toBe(true);
    expect(staleResult.items.every((item) => item.count === null)).toBe(true);
  });

  it('blocks denied, disabled, empty scope, and any scope mismatch without business output', () => {
    const denied = lifecycleSource({ readiness: 'denied', data: null });
    const disabled = lifecycleSource({ readiness: 'disabled', data: null });
    const topScopeMismatch = lifecycleSource({
      readiness: 'unavailable',
      data: null,
      failureCode: 'scope_mismatch',
    });
    const partitionScopeMismatch = lifecycleSource({
      readiness: 'partial',
      partitionFailureCode: { consulting: 'scope_mismatch' },
    });
    const emptyScope = lifecycleSource();
    emptyScope.scope.institutionId = '   ';
    const invalidVersion = lifecycleSource();
    (invalidVersion as unknown as { contractVersion: string }).contractVersion = 'v2';
    const invalidTopReadiness = lifecycleSource();
    (invalidTopReadiness as unknown as { readiness: string }).readiness = 'unknown';
    const invalidPartitionReadiness = lifecycleSource();
    (
      invalidPartitionReadiness.partitions[0] as unknown as {
        readiness: string;
      }
    ).readiness = 'partial';

    for (const source of [
      denied,
      disabled,
      topScopeMismatch,
      partitionScopeMismatch,
      emptyScope,
      invalidVersion,
      invalidTopReadiness,
      invalidPartitionReadiness,
    ]) {
      expect(buildWorkbenchLifecycleProjection({ lifecycle: source })).toEqual({
        status: 'blocked',
        items: [],
      });
    }
  });

  it('blocks incomplete, duplicate, or unknown partition and bucket key sets', () => {
    const missingPartition = lifecycleSource();
    missingPartition.partitions.pop();

    const duplicatePartition = lifecycleSource();
    duplicatePartition.partitions[4] = duplicatePartition.partitions[0];

    const unknownPartition = lifecycleSource();
    unknownPartition.partitions[4] = {
      ...unknownPartition.partitions[4],
      key: 'unknown_lifecycle' as CustomerLifecycleV1,
    };

    const missingBucket = lifecycleSource();
    missingBucket.data?.buckets.pop();

    const duplicateBucket = lifecycleSource();
    if (duplicateBucket.data !== null) {
      duplicateBucket.data.buckets[4] = duplicateBucket.data.buckets[0];
    }

    const unknownBucket = lifecycleSource();
    if (unknownBucket.data !== null) {
      unknownBucket.data.buckets[4] = {
        key: 'unknown_lifecycle' as CustomerLifecycleV1,
        count: 1,
      };
    }

    for (const source of [
      missingPartition,
      duplicatePartition,
      unknownPartition,
      missingBucket,
      duplicateBucket,
      unknownBucket,
    ]) {
      expect(buildWorkbenchLifecycleProjection({ lifecycle: source })).toEqual({
        status: 'blocked',
        items: [],
      });
    }
  });

  it('fails individual invalid numeric values closed without clearing valid sibling buckets', () => {
    const source = lifecycleSource({
        counts: {
          consulting: -1,
          scheduled: 1.5,
          post_care: Number.NaN,
          repurchase_window: 7,
          silent_reactivation: null,
        },
    });
    const result = buildWorkbenchLifecycleProjection({ lifecycle: source });

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    expect(result.items.map(({ status, count }) => [status, count])).toEqual([
      ['unavailable', null],
      ['unavailable', null],
      ['unavailable', null],
      ['ready', 7],
    ]);
  });
});
