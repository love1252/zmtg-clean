import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  INSTITUTION_OPERATING_CONTEXT_PARTITION_KEY_V1,
  INSTITUTION_OPERATING_CONTEXT_PRODUCT_DEFAULT_V1,
  INSTITUTION_OPERATING_CONTEXT_SOURCE_VALUES_V1,
  isInstitutionOperatingContextSourceV1,
  type InstitutionOperatingContextCurrentV1,
  type InstitutionOperatingContextPartitionKeyV1,
  type InstitutionOperatingContextPayloadV1,
  type InstitutionOperatingContextPendingV1,
  type InstitutionOperatingContextSourceV1,
  type InstitutionOperatingContextV1,
} from '@/modules/institution-contracts/v1/institution-operating-context';
import type { InstitutionSourceEnvelopeV1 } from '@/modules/institution-contracts/v1/institution-source';

describe('InstitutionOperatingContextContractV1', () => {
  it('freezes the partition key and two-source vocabulary', () => {
    expect(INSTITUTION_OPERATING_CONTEXT_PARTITION_KEY_V1).toBe('operating_context');
    expect(INSTITUTION_OPERATING_CONTEXT_SOURCE_VALUES_V1).toEqual([
      'institution_config',
      'product_default',
    ]);
    expect(Object.isFrozen(INSTITUTION_OPERATING_CONTEXT_SOURCE_VALUES_V1)).toBe(true);

    for (const source of INSTITUTION_OPERATING_CONTEXT_SOURCE_VALUES_V1) {
      expect(isInstitutionOperatingContextSourceV1(source)).toBe(true);
    }

    expect(isInstitutionOperatingContextSourceV1('fixture_default')).toBe(false);
    expect(isInstitutionOperatingContextSourceV1('tenant_config')).toBe(false);
    expect(isInstitutionOperatingContextSourceV1(null)).toBe(false);
    expectTypeOf<InstitutionOperatingContextPartitionKeyV1>().toEqualTypeOf<'operating_context'>();
    expectTypeOf<InstitutionOperatingContextSourceV1>().toEqualTypeOf<
      'institution_config' | 'product_default'
    >();
  });

  it('declares the explicit product-default source and current values', () => {
    expect(INSTITUTION_OPERATING_CONTEXT_PRODUCT_DEFAULT_V1).toEqual({
      source: 'product_default',
      current: {
        timeZone: 'Asia/Shanghai',
        defaultCurrency: 'CNY',
      },
    });
    expect(Object.isFrozen(INSTITUTION_OPERATING_CONTEXT_PRODUCT_DEFAULT_V1)).toBe(true);
    expect(Object.isFrozen(INSTITUTION_OPERATING_CONTEXT_PRODUCT_DEFAULT_V1.current)).toBe(
      true,
    );
  });

  it('locks the exact payload, current and pending key sets and scalar types', () => {
    expectTypeOf<keyof InstitutionOperatingContextPayloadV1>().toEqualTypeOf<
      'version' | 'source' | 'current' | 'pending' | 'updatedAt' | 'updatedBy'
    >();
    expectTypeOf<keyof InstitutionOperatingContextCurrentV1>().toEqualTypeOf<
      'timeZone' | 'defaultCurrency'
    >();
    expectTypeOf<keyof InstitutionOperatingContextPendingV1>().toEqualTypeOf<
      'timeZone' | 'defaultCurrency' | 'requestedVersion' | 'effectiveFromBusinessDate'
    >();
    expectTypeOf<InstitutionOperatingContextPayloadV1>().toEqualTypeOf<{
      version: string;
      source: 'institution_config' | 'product_default';
      current: {
        timeZone: string;
        defaultCurrency: string;
      };
      pending: {
        timeZone: string;
        defaultCurrency: string;
        requestedVersion: string;
        effectiveFromBusinessDate: string;
      } | null;
      updatedAt: string | null;
      updatedBy: string | null;
    }>();
  });

  it('uses the shared source envelope as the only result alias', () => {
    expectTypeOf<InstitutionOperatingContextV1>().toEqualTypeOf<
      InstitutionSourceEnvelopeV1<
        InstitutionOperatingContextPayloadV1,
        'operating_context'
      >
    >();
    expectTypeOf<InstitutionOperatingContextV1['partitions'][number]['key']>().toEqualTypeOf<'operating_context'>();
  });
});
