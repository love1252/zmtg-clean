import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  INSTITUTION_SOURCE_FAILURE_CODES_V1,
  INSTITUTION_SOURCE_PARTITION_READINESS_VALUES_V1,
  INSTITUTION_SOURCE_READINESS_VALUES_V1,
  isInstitutionSourceFailureCodeV1,
  isInstitutionSourcePartitionReadinessV1,
  isInstitutionSourceReadinessV1,
  type InstitutionSourceEnvelopeV1,
  type InstitutionSourceFreshnessV1,
  type InstitutionSourcePartitionV1,
} from '@/modules/institution-contracts/v1/institution-source';

describe('InstitutionSourceContractV1', () => {
  it('freezes the seven top-level readiness values', () => {
    expect(INSTITUTION_SOURCE_READINESS_VALUES_V1).toEqual([
      'ready',
      'empty',
      'partial',
      'stale',
      'unavailable',
      'denied',
      'disabled',
    ]);
    expect(Object.isFrozen(INSTITUTION_SOURCE_READINESS_VALUES_V1)).toBe(true);

    for (const readiness of INSTITUTION_SOURCE_READINESS_VALUES_V1) {
      expect(isInstitutionSourceReadinessV1(readiness)).toBe(true);
    }

    expect(isInstitutionSourceReadinessV1('unknown')).toBe(false);
  });

  it('keeps partial out of the six partition readiness values', () => {
    expect(INSTITUTION_SOURCE_PARTITION_READINESS_VALUES_V1).toEqual([
      'ready',
      'empty',
      'stale',
      'unavailable',
      'denied',
      'disabled',
    ]);
    expect(Object.isFrozen(INSTITUTION_SOURCE_PARTITION_READINESS_VALUES_V1)).toBe(true);
    expect(isInstitutionSourcePartitionReadinessV1('partial')).toBe(false);
    expect(isInstitutionSourcePartitionReadinessV1('unknown')).toBe(false);
    expect(isInstitutionSourcePartitionReadinessV1(1)).toBe(false);

    for (const readiness of INSTITUTION_SOURCE_PARTITION_READINESS_VALUES_V1) {
      expect(isInstitutionSourcePartitionReadinessV1(readiness)).toBe(true);
    }
  });

  it('freezes the shared seven-code failure vocabulary', () => {
    expect(INSTITUTION_SOURCE_FAILURE_CODES_V1).toEqual([
      'upstream_unavailable',
      'timeout',
      'invalid_payload',
      'scope_mismatch',
      'permission_denied',
      'not_released',
      'data_incomplete',
    ]);
    expect(Object.isFrozen(INSTITUTION_SOURCE_FAILURE_CODES_V1)).toBe(true);

    for (const failureCode of INSTITUTION_SOURCE_FAILURE_CODES_V1) {
      expect(isInstitutionSourceFailureCodeV1(failureCode)).toBe(true);
    }

    expect(isInstitutionSourceFailureCodeV1('provider_error')).toBe(false);
  });

  it('declares the exact frozen public envelope fields and types', () => {
    type PartitionKey = 'first' | 'second';
    type Payload = { value: number };

    const partition = {
      key: 'first',
      readiness: 'ready',
      freshness: {
        observedAt: '2026-07-17T01:00:00.000Z',
        freshUntil: '2026-07-17T01:05:00.000Z',
      },
      failureCode: null,
    } satisfies InstitutionSourcePartitionV1<PartitionKey>;

    const envelope = {
      contractVersion: 'v1',
      scope: {
        tenantId: 'tenant-safe-reference',
        institutionId: 'institution-safe-reference',
      },
      readiness: 'ready',
      freshness: partition.freshness,
      partitions: [partition],
      data: { value: 1 },
      failureCode: null,
    } satisfies InstitutionSourceEnvelopeV1<Payload, PartitionKey>;

    expect(Object.keys(envelope).sort()).toEqual(
      [
        'contractVersion',
        'scope',
        'readiness',
        'freshness',
        'partitions',
        'data',
        'failureCode',
      ].sort(),
    );
    expect(Object.keys(partition).sort()).toEqual(
      ['key', 'readiness', 'freshness', 'failureCode'].sort(),
    );
    expectTypeOf(envelope).toMatchTypeOf<InstitutionSourceEnvelopeV1<Payload, PartitionKey>>();
    expectTypeOf<keyof InstitutionSourceEnvelopeV1<Payload, PartitionKey>>().toEqualTypeOf<
      | 'contractVersion'
      | 'scope'
      | 'readiness'
      | 'freshness'
      | 'partitions'
      | 'data'
      | 'failureCode'
    >();
    expectTypeOf<
      keyof InstitutionSourceEnvelopeV1<Payload, PartitionKey>['scope']
    >().toEqualTypeOf<'tenantId' | 'institutionId'>();
    expectTypeOf<keyof InstitutionSourcePartitionV1<PartitionKey>>().toEqualTypeOf<
      'key' | 'readiness' | 'freshness' | 'failureCode'
    >();
    expectTypeOf<keyof InstitutionSourceFreshnessV1>().toEqualTypeOf<
      'observedAt' | 'freshUntil'
    >();
    expectTypeOf<InstitutionSourceEnvelopeV1<Payload, PartitionKey>>().toEqualTypeOf<{
      contractVersion: 'v1';
      scope: {
        tenantId: string;
        institutionId: string;
      };
      readiness:
        | 'ready'
        | 'empty'
        | 'partial'
        | 'stale'
        | 'unavailable'
        | 'denied'
        | 'disabled';
      freshness: {
        observedAt: string;
        freshUntil: string;
      } | null;
      partitions: Array<{
        key: PartitionKey;
        readiness: 'ready' | 'empty' | 'stale' | 'unavailable' | 'denied' | 'disabled';
        freshness: {
          observedAt: string;
          freshUntil: string;
        } | null;
        failureCode:
          | 'upstream_unavailable'
          | 'timeout'
          | 'invalid_payload'
          | 'scope_mismatch'
          | 'permission_denied'
          | 'not_released'
          | 'data_incomplete'
          | null;
      }>;
      data: Payload | null;
      failureCode:
        | 'upstream_unavailable'
        | 'timeout'
        | 'invalid_payload'
        | 'scope_mismatch'
        | 'permission_denied'
        | 'not_released'
        | 'data_incomplete'
        | null;
    }>();
  });
});
