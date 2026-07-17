import { describe, expect, it } from 'vitest';

import {
  INSTITUTION_OPERATING_CONTEXT_PRODUCT_DEFAULT_V1,
  type InstitutionOperatingContextPayloadV1,
  type InstitutionOperatingContextV1,
} from '@/modules/institution-contracts/v1/institution-operating-context';

const scope = {
  tenantId: 'tenant-safe-reference',
  institutionId: 'institution-safe-reference',
};

const currentFreshness = {
  observedAt: '2026-07-17T01:00:00.000Z',
  freshUntil: '2026-07-17T01:05:00.000Z',
};

describe('InstitutionOperatingContextContractBoundaryV1 declaration examples', () => {
  it('documents explicit product defaults without impersonating institution configuration', () => {
    const productDefault = {
      contractVersion: 'v1',
      scope,
      readiness: 'ready',
      freshness: currentFreshness,
      partitions: [
        {
          key: 'operating_context',
          readiness: 'ready',
          freshness: currentFreshness,
          failureCode: null,
        },
      ],
      data: {
        version: 'operating-context-default-v1',
        source: INSTITUTION_OPERATING_CONTEXT_PRODUCT_DEFAULT_V1.source,
        current: INSTITUTION_OPERATING_CONTEXT_PRODUCT_DEFAULT_V1.current,
        pending: null,
        updatedAt: null,
        updatedBy: null,
      },
      failureCode: null,
    } satisfies InstitutionOperatingContextV1;

    expect(productDefault.data.source).toBe('product_default');
    expect(productDefault.data.current).toEqual({
      timeZone: 'Asia/Shanghai',
      defaultCurrency: 'CNY',
    });
    expect(productDefault.data.updatedAt).toBeNull();
    expect(productDefault.data.updatedBy).toBeNull();
  });

  it('documents current and next-period pending institution configuration separately', () => {
    const configured = {
      contractVersion: 'v1',
      scope,
      readiness: 'ready',
      freshness: currentFreshness,
      partitions: [
        {
          key: 'operating_context',
          readiness: 'ready',
          freshness: currentFreshness,
          failureCode: null,
        },
      ],
      data: {
        version: 'operating-context-version-7',
        source: 'institution_config',
        current: {
          timeZone: 'Asia/Shanghai',
          defaultCurrency: 'CNY',
        },
        pending: {
          timeZone: 'Asia/Hong_Kong',
          defaultCurrency: 'HKD',
          requestedVersion: 'operating-context-version-8',
          effectiveFromBusinessDate: '2026-08-01',
        },
        updatedAt: '2026-07-17T01:00:00.000Z',
        updatedBy: 'member-safe-reference',
      },
      failureCode: null,
    } satisfies InstitutionOperatingContextV1;

    expect(configured.data.current.defaultCurrency).toBe('CNY');
    expect(configured.data.pending?.defaultCurrency).toBe('HKD');
    expect(configured.data.pending?.effectiveFromBusinessDate).toBe('2026-08-01');
  });

  it('documents denied, disabled and scope-mismatch fail-closed declarations', () => {
    const denied = {
      contractVersion: 'v1',
      scope,
      readiness: 'denied',
      freshness: null,
      partitions: [
        {
          key: 'operating_context',
          readiness: 'denied',
          freshness: null,
          failureCode: 'permission_denied',
        },
      ],
      data: null,
      failureCode: 'permission_denied',
    } satisfies InstitutionOperatingContextV1;

    const disabled = {
      contractVersion: 'v1',
      scope,
      readiness: 'disabled',
      freshness: null,
      partitions: [
        {
          key: 'operating_context',
          readiness: 'disabled',
          freshness: null,
          failureCode: 'not_released',
        },
      ],
      data: null,
      failureCode: 'not_released',
    } satisfies InstitutionOperatingContextV1;

    const scopeMismatch = {
      contractVersion: 'v1',
      scope,
      readiness: 'denied',
      freshness: null,
      partitions: [
        {
          key: 'operating_context',
          readiness: 'denied',
          freshness: null,
          failureCode: 'scope_mismatch',
        },
      ],
      data: null,
      failureCode: 'scope_mismatch',
    } satisfies InstitutionOperatingContextV1;

    expect(denied.data).toBeNull();
    expect(disabled.data).toBeNull();
    expect(scopeMismatch.data).toBeNull();
  });

  it('keeps competing version, scope and sensitive implementation fields out of the payload', () => {
    const payload = {
      version: 'operating-context-version-7',
      source: 'institution_config',
      current: {
        timeZone: 'Asia/Shanghai',
        defaultCurrency: 'CNY',
      },
      pending: {
        timeZone: 'Asia/Hong_Kong',
        defaultCurrency: 'HKD',
        requestedVersion: 'operating-context-version-8',
        effectiveFromBusinessDate: '2026-08-01',
      },
      updatedAt: '2026-07-17T01:00:00.000Z',
      updatedBy: 'member-safe-reference',
    } satisfies InstitutionOperatingContextPayloadV1;

    expect(Object.keys(payload).sort()).toEqual(
      ['version', 'source', 'current', 'pending', 'updatedAt', 'updatedBy'].sort(),
    );
    expect(Object.keys(payload.current).sort()).toEqual(
      ['timeZone', 'defaultCurrency'].sort(),
    );
    expect(Object.keys(payload.pending).sort()).toEqual(
      [
        'timeZone',
        'defaultCurrency',
        'requestedVersion',
        'effectiveFromBusinessDate',
      ].sort(),
    );

    for (const forbiddenKey of [
      'timezoneVersion',
      'timeZoneVersion',
      'operatingContextVersion',
      'contractVersion',
      'tenantId',
      'institutionId',
      'provider',
      'adapter',
      'endpoint',
      'credential',
      'password',
      'accessToken',
      'refreshToken',
      'operatorName',
      'operatorPhone',
    ]) {
      expect(payload).not.toHaveProperty(forbiddenKey);
    }
  });
});
