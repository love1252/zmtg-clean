import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  CAPABILITY_STATUS_CODE_MATURITY_VALUES_V1,
  CAPABILITY_STATUS_CONNECTION_AVAILABILITY_VALUES_V1,
  CAPABILITY_STATUS_DATA_READINESS_VALUES_V1,
  CAPABILITY_STATUS_DECISIONS_V1,
  CAPABILITY_STATUS_INSTITUTION_AUTHORIZATION_VALUES_V1,
  CAPABILITY_STATUS_PRODUCTION_RELEASE_VALUES_V1,
  CAPABILITY_STATUS_SAFE_SUMMARY_MAX_LENGTH_V1,
  isCapabilityStatusCodeMaturityV1,
  isCapabilityStatusConnectionAvailabilityV1,
  isCapabilityStatusDataReadinessV1,
  isCapabilityStatusDecisionV1,
  isCapabilityStatusInstitutionAuthorizationV1,
  isCapabilityStatusProductionReleaseV1,
  type CapabilityStatusDimensionsV1,
  type CapabilityStatusItemV1,
  type CapabilityStatusPayloadV1,
  type CapabilityStatusV1,
} from '@/modules/institution-contracts/v1/institution-capability';
import {
  INSTITUTION_CAPABILITY_REGISTRY_V1,
  INSTITUTION_DIAGNOSTIC_TARGET_CAPABILITY_KEYS_V1,
  type InstitutionCapabilityKeyV1,
  type InstitutionDiagnosticTargetCapabilityKeyV1,
} from '@/modules/institution-contracts/v1/institution-capability-registry';
import type { InstitutionSourceEnvelopeV1 } from '@/modules/institution-contracts/v1/institution-source';

const scope = {
  tenantId: 'tenant-safe-reference',
  institutionId: 'institution-safe-reference',
};

const freshness = {
  observedAt: '2026-07-17T02:00:00.000Z',
  freshUntil: '2026-07-17T02:05:00.000Z',
};

const firstCapabilityKey = INSTITUTION_CAPABILITY_REGISTRY_V1[0].key;
const secondCapabilityKey = INSTITUTION_CAPABILITY_REGISTRY_V1[1].key;
const firstDiagnosticTargetKey = INSTITUTION_DIAGNOSTIC_TARGET_CAPABILITY_KEYS_V1[0];

describe('InstitutionCapabilityContractV1', () => {
  it('freezes the exact decision and five-dimension vocabularies', () => {
    expect(CAPABILITY_STATUS_DECISIONS_V1).toEqual([
      'hidden',
      'read_only',
      'operational',
    ]);
    expect(CAPABILITY_STATUS_CODE_MATURITY_VALUES_V1).toEqual([
      'unverified',
      'verified',
    ]);
    expect(CAPABILITY_STATUS_INSTITUTION_AUTHORIZATION_VALUES_V1).toEqual([
      'not_authorized',
      'authorized',
    ]);
    expect(CAPABILITY_STATUS_CONNECTION_AVAILABILITY_VALUES_V1).toEqual([
      'not_required',
      'unavailable',
      'available',
    ]);
    expect(CAPABILITY_STATUS_DATA_READINESS_VALUES_V1).toEqual([
      'not_required',
      'ready',
      'empty',
      'partial',
      'stale',
      'unavailable',
    ]);
    expect(CAPABILITY_STATUS_PRODUCTION_RELEASE_VALUES_V1).toEqual([
      'not_released',
      'pilot_released',
      'released',
      'suspended',
    ]);
    expect(CAPABILITY_STATUS_SAFE_SUMMARY_MAX_LENGTH_V1).toBe(120);

    for (const vocabulary of [
      CAPABILITY_STATUS_DECISIONS_V1,
      CAPABILITY_STATUS_CODE_MATURITY_VALUES_V1,
      CAPABILITY_STATUS_INSTITUTION_AUTHORIZATION_VALUES_V1,
      CAPABILITY_STATUS_CONNECTION_AVAILABILITY_VALUES_V1,
      CAPABILITY_STATUS_DATA_READINESS_VALUES_V1,
      CAPABILITY_STATUS_PRODUCTION_RELEASE_VALUES_V1,
    ]) {
      expect(Object.isFrozen(vocabulary)).toBe(true);
    }
  });

  it('keeps all exported guards scalar and fail-closed for unknown values', () => {
    expect(isCapabilityStatusDecisionV1('operational')).toBe(true);
    expect(isCapabilityStatusDecisionV1('Operational')).toBe(false);
    expect(isCapabilityStatusDecisionV1({ decision: 'operational' })).toBe(false);
    expect(isCapabilityStatusCodeMaturityV1('verified')).toBe(true);
    expect(isCapabilityStatusCodeMaturityV1('ready')).toBe(false);
    expect(isCapabilityStatusInstitutionAuthorizationV1('authorized')).toBe(true);
    expect(isCapabilityStatusInstitutionAuthorizationV1(true)).toBe(false);
    expect(isCapabilityStatusConnectionAvailabilityV1('not_required')).toBe(true);
    expect(isCapabilityStatusConnectionAvailabilityV1(null)).toBe(false);
    expect(isCapabilityStatusDataReadinessV1('partial')).toBe(true);
    expect(isCapabilityStatusDataReadinessV1('denied')).toBe(false);
    expect(isCapabilityStatusProductionReleaseV1('pilot_released')).toBe(true);
    expect(isCapabilityStatusProductionReleaseV1(1)).toBe(false);
  });

  it('locks the exact dimensions, item and payload keys', () => {
    expectTypeOf<keyof CapabilityStatusDimensionsV1>().toEqualTypeOf<
      | 'codeMaturity'
      | 'institutionAuthorization'
      | 'connectionAvailability'
      | 'dataReadiness'
      | 'productionRelease'
    >();
    expectTypeOf<CapabilityStatusDimensionsV1>().toEqualTypeOf<{
      codeMaturity: 'unverified' | 'verified';
      institutionAuthorization: 'not_authorized' | 'authorized';
      connectionAvailability: 'not_required' | 'unavailable' | 'available';
      dataReadiness:
        | 'not_required'
        | 'ready'
        | 'empty'
        | 'partial'
        | 'stale'
        | 'unavailable';
      productionRelease: 'not_released' | 'pilot_released' | 'released' | 'suspended';
    }>();

    expectTypeOf<keyof CapabilityStatusItemV1>().toEqualTypeOf<
      'key' | 'decision' | 'dimensions' | 'safeSummary' | 'diagnosticTargetKey'
    >();
    expectTypeOf<CapabilityStatusItemV1['key']>().toEqualTypeOf<
      InstitutionCapabilityKeyV1
    >();
    expectTypeOf<CapabilityStatusItemV1['decision']>().toEqualTypeOf<
      'hidden' | 'read_only' | 'operational'
    >();
    expectTypeOf<CapabilityStatusItemV1['dimensions']>().toEqualTypeOf<
      CapabilityStatusDimensionsV1
    >();
    expectTypeOf<CapabilityStatusItemV1['safeSummary']>().toEqualTypeOf<string | null>();
    expectTypeOf<CapabilityStatusItemV1['diagnosticTargetKey']>().toEqualTypeOf<
      InstitutionDiagnosticTargetCapabilityKeyV1 | null
    >();
    expectTypeOf<keyof CapabilityStatusPayloadV1>().toEqualTypeOf<'capabilities'>();
    expectTypeOf<CapabilityStatusPayloadV1['capabilities']>().toEqualTypeOf<
      CapabilityStatusItemV1[]
    >();
  });

  it('reuses the unified source envelope with registry capability partition keys', () => {
    expectTypeOf<CapabilityStatusV1>().toEqualTypeOf<
      InstitutionSourceEnvelopeV1<CapabilityStatusPayloadV1, InstitutionCapabilityKeyV1>
    >();
  });

  it('documents ready operational and ready hidden declarations without parsing them', () => {
    const readyOperational = {
      contractVersion: 'v1',
      scope,
      readiness: 'ready',
      freshness,
      partitions: [
        {
          key: firstCapabilityKey,
          readiness: 'ready',
          freshness,
          failureCode: null,
        },
      ],
      data: {
        capabilities: [
          {
            key: firstCapabilityKey,
            decision: 'operational',
            dimensions: {
              codeMaturity: 'verified',
              institutionAuthorization: 'authorized',
              connectionAvailability: 'available',
              dataReadiness: 'ready',
              productionRelease: 'released',
            },
            safeSummary: '当前能力已放行',
            diagnosticTargetKey: null,
          },
        ],
      },
      failureCode: null,
    } satisfies CapabilityStatusV1;

    const readyHidden = {
      contractVersion: 'v1',
      scope,
      readiness: 'ready',
      freshness,
      partitions: [
        {
          key: secondCapabilityKey,
          readiness: 'ready',
          freshness,
          failureCode: null,
        },
      ],
      data: {
        capabilities: [
          {
            key: secondCapabilityKey,
            decision: 'hidden',
            dimensions: {
              codeMaturity: 'verified',
              institutionAuthorization: 'authorized',
              connectionAvailability: 'not_required',
              dataReadiness: 'not_required',
              productionRelease: 'not_released',
            },
            safeSummary: null,
            diagnosticTargetKey: null,
          },
        ],
      },
      failureCode: null,
    } satisfies CapabilityStatusV1;

    expect(readyOperational.data.capabilities[0].decision).toBe('operational');
    expect(readyHidden.data.capabilities[0].decision).toBe('hidden');
    expect(Object.keys(readyOperational.data.capabilities[0]).sort()).toEqual(
      ['key', 'decision', 'dimensions', 'safeSummary', 'diagnosticTargetKey'].sort(),
    );
  });

  it('documents partial and stale-at-most-read-only declarations without parsing them', () => {
    const partial = {
      contractVersion: 'v1',
      scope,
      readiness: 'partial',
      freshness: null,
      partitions: [
        {
          key: firstCapabilityKey,
          readiness: 'ready',
          freshness,
          failureCode: null,
        },
        {
          key: secondCapabilityKey,
          readiness: 'unavailable',
          freshness: null,
          failureCode: 'upstream_unavailable',
        },
      ],
      data: {
        capabilities: [
          {
            key: firstCapabilityKey,
            decision: 'read_only',
            dimensions: {
              codeMaturity: 'verified',
              institutionAuthorization: 'authorized',
              connectionAvailability: 'available',
              dataReadiness: 'partial',
              productionRelease: 'pilot_released',
            },
            safeSummary: '部分业务数据可用',
            diagnosticTargetKey: firstDiagnosticTargetKey,
          },
        ],
      },
      failureCode: 'upstream_unavailable',
    } satisfies CapabilityStatusV1;

    const staleReadOnly = {
      contractVersion: 'v1',
      scope,
      readiness: 'stale',
      freshness,
      partitions: [
        {
          key: firstCapabilityKey,
          readiness: 'stale',
          freshness,
          failureCode: 'data_incomplete',
        },
      ],
      data: {
        capabilities: [
          {
            key: firstCapabilityKey,
            decision: 'read_only',
            dimensions: {
              codeMaturity: 'verified',
              institutionAuthorization: 'authorized',
              connectionAvailability: 'available',
              dataReadiness: 'stale',
              productionRelease: 'released',
            },
            safeSummary: '业务数据已过期，仅供查看',
            diagnosticTargetKey: firstDiagnosticTargetKey,
          },
        ],
      },
      failureCode: 'data_incomplete',
    } satisfies CapabilityStatusV1;

    expect(partial.data.capabilities).toHaveLength(1);
    expect(partial.partitions[1].readiness).toBe('unavailable');
    expect(staleReadOnly.data.capabilities[0].decision).toBe('read_only');
    expect(staleReadOnly.data.capabilities[0].dimensions.dataReadiness).toBe('stale');
  });

  it('documents unavailable, disabled and denied declarations with null data without parsing them', () => {
    const unavailable = {
      contractVersion: 'v1',
      scope,
      readiness: 'unavailable',
      freshness: null,
      partitions: [
        {
          key: firstCapabilityKey,
          readiness: 'unavailable',
          freshness: null,
          failureCode: 'upstream_unavailable',
        },
      ],
      data: null,
      failureCode: 'upstream_unavailable',
    } satisfies CapabilityStatusV1;

    const disabledNotReleased = {
      contractVersion: 'v1',
      scope,
      readiness: 'disabled',
      freshness: null,
      partitions: [
        {
          key: firstCapabilityKey,
          readiness: 'disabled',
          freshness: null,
          failureCode: 'not_released',
        },
      ],
      data: null,
      failureCode: 'not_released',
    } satisfies CapabilityStatusV1;

    const deniedPermission = {
      contractVersion: 'v1',
      scope,
      readiness: 'denied',
      freshness: null,
      partitions: [
        {
          key: firstCapabilityKey,
          readiness: 'denied',
          freshness: null,
          failureCode: 'permission_denied',
        },
      ],
      data: null,
      failureCode: 'permission_denied',
    } satisfies CapabilityStatusV1;

    const deniedScopeMismatch = {
      contractVersion: 'v1',
      scope,
      readiness: 'denied',
      freshness: null,
      partitions: [
        {
          key: firstCapabilityKey,
          readiness: 'denied',
          freshness: null,
          failureCode: 'scope_mismatch',
        },
      ],
      data: null,
      failureCode: 'scope_mismatch',
    } satisfies CapabilityStatusV1;

    expect(unavailable.data).toBeNull();
    expect(disabledNotReleased.data).toBeNull();
    expect(deniedPermission.data).toBeNull();
    expect(deniedScopeMismatch.data).toBeNull();
  });
});
