import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  CUSTOMER_LIFECYCLE_VALUES_V1,
  isCustomerLifecycleV1,
  type CustomerLifecycleV1,
  type CustomerLifecycleSummaryPayloadV1,
  type CustomerLifecycleSummaryV1,
  type CustomerReferenceV1,
} from '@/modules/institution-contracts/v1/customer';

describe('CustomerContractV1', () => {
  it('freezes the five customer lifecycle keys', () => {
    expect(CUSTOMER_LIFECYCLE_VALUES_V1).toEqual([
      'consulting',
      'scheduled',
      'post_care',
      'repurchase_window',
      'silent_reactivation',
    ]);
    expect(Object.isFrozen(CUSTOMER_LIFECYCLE_VALUES_V1)).toBe(true);

    for (const lifecycle of CUSTOMER_LIFECYCLE_VALUES_V1) {
      expect(isCustomerLifecycleV1(lifecycle)).toBe(true);
    }

    expect(isCustomerLifecycleV1('unknown')).toBe(false);
  });

  it('declares the exact four-field CustomerReferenceV1 type', () => {
    const reference = {
      contractVersion: 'v1',
      customerId: 'customer-safe-reference',
      displayName: '客户甲',
      maskedReference: '客户编号…01',
    } satisfies CustomerReferenceV1;

    expect(Object.keys(reference).sort()).toEqual(
      ['contractVersion', 'customerId', 'displayName', 'maskedReference'].sort(),
    );
    expectTypeOf(reference).toMatchTypeOf<CustomerReferenceV1>();
    expectTypeOf<keyof CustomerReferenceV1>().toEqualTypeOf<
      'contractVersion' | 'customerId' | 'displayName' | 'maskedReference'
    >();
    expectTypeOf<CustomerReferenceV1>().toEqualTypeOf<{
      contractVersion: 'v1';
      customerId: string;
      displayName: string;
      maskedReference: string | null;
    }>();
  });

  it('declares lifecycle summary buckets and partitions with the same five-key type', () => {
    const summary = {
      contractVersion: 'v1',
      scope: {
        tenantId: 'tenant-safe-reference',
        institutionId: 'institution-safe-reference',
      },
      readiness: 'empty',
      freshness: null,
      partitions: CUSTOMER_LIFECYCLE_VALUES_V1.map((key) => ({
        key,
        readiness: 'empty' as const,
        freshness: null,
        failureCode: null,
      })),
      data: {
        buckets: CUSTOMER_LIFECYCLE_VALUES_V1.map((key) => ({
          key,
          count: 0,
        })),
      },
      failureCode: null,
    } satisfies CustomerLifecycleSummaryV1;

    const unknownCount: CustomerLifecycleSummaryPayloadV1['buckets'][number]['count'] = null;

    expect(summary.data.buckets.map(({ key }) => key)).toEqual(CUSTOMER_LIFECYCLE_VALUES_V1);
    expect(unknownCount).toBeNull();
    expect(Object.keys(summary.data).sort()).toEqual(['buckets']);
    expectTypeOf(summary).toMatchTypeOf<CustomerLifecycleSummaryV1>();
    expectTypeOf<keyof CustomerLifecycleSummaryPayloadV1>().toEqualTypeOf<'buckets'>();
    expectTypeOf<CustomerLifecycleSummaryPayloadV1>().toEqualTypeOf<{
      buckets: Array<{
        key: CustomerLifecycleV1;
        count: number | null;
      }>;
    }>();
    expectTypeOf<
      keyof CustomerLifecycleSummaryPayloadV1['buckets'][number]
    >().toEqualTypeOf<'key' | 'count'>();
    expectTypeOf<
      CustomerLifecycleSummaryV1['partitions'][number]['key']
    >().toEqualTypeOf<CustomerLifecycleV1>();
    expectTypeOf<CustomerLifecycleSummaryV1>().toEqualTypeOf<
      import('@/modules/institution-contracts/v1/institution-source').InstitutionSourceEnvelopeV1<
        CustomerLifecycleSummaryPayloadV1,
        CustomerLifecycleV1
      >
    >();
  });
});
