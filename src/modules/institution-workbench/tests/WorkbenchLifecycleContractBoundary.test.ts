import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  CUSTOMER_LIFECYCLE_VALUES_V1,
  type CustomerLifecycleSummaryV1,
} from '@/modules/institution-contracts/v1/customer';
import {
  buildWorkbenchLifecycleProjection,
  type BuildWorkbenchLifecycleProjectionInput,
} from '@/modules/institution-workbench/domain/workbench-lifecycle-projection';
import type {
  WorkbenchLifecycleItemViewModel,
  WorkbenchLifecycleProjection,
} from '@/modules/institution-workbench/domain/workbench-lifecycle-view-models';

const scope = {
  tenantId: 'tenant-safe-reference',
  institutionId: 'institution-safe-reference',
};

const currentFreshness = {
  observedAt: '2026-07-17T01:00:00.000Z',
  freshUntil: '2026-07-17T01:05:00.000Z',
};

function readySourceWithExtras(): CustomerLifecycleSummaryV1 {
  return {
    contractVersion: 'v1',
    scope: {
      ...scope,
      accessToken: 'must-not-leak',
    },
    readiness: 'ready',
    freshness: currentFreshness,
    partitions: CUSTOMER_LIFECYCLE_VALUES_V1.map((key) => ({
      key,
      readiness: 'ready' as const,
      freshness: currentFreshness,
      failureCode: null,
      diagnostic: 'must-not-leak',
    })),
    data: {
      buckets: CUSTOMER_LIFECYCLE_VALUES_V1.map((key, index) => ({
        key,
        count: index + 1,
        nextAction: 'must-not-leak',
        customerId: 'must-not-leak',
        href: 'https://malicious.invalid/customer',
        canonicalHref: 'https://malicious.invalid/canonical',
        url: 'https://malicious.invalid/url',
      })),
      total: 15,
    },
    failureCode: null,
    providerDiagnostic: 'must-not-leak',
  } as unknown as CustomerLifecycleSummaryV1;
}

function collectObjectKeys(value: unknown, result = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectObjectKeys(item, result);
    }
    return result;
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      result.add(key);
      collectObjectKeys(nested, result);
    }
  }

  return result;
}

describe('WorkbenchLifecycleContractBoundary typed consumer projection', () => {
  it('consumes the exact public summary type and returns only the local display model', () => {
    expectTypeOf<Parameters<typeof buildWorkbenchLifecycleProjection>[0]>().toEqualTypeOf<
      BuildWorkbenchLifecycleProjectionInput
    >();
    expectTypeOf<keyof BuildWorkbenchLifecycleProjectionInput>().toEqualTypeOf<'lifecycle'>();
    expectTypeOf<BuildWorkbenchLifecycleProjectionInput['lifecycle']>().toEqualTypeOf<
      CustomerLifecycleSummaryV1
    >();
    expectTypeOf<ReturnType<typeof buildWorkbenchLifecycleProjection>>().toEqualTypeOf<
      WorkbenchLifecycleProjection
    >();
    expectTypeOf<keyof WorkbenchLifecycleItemViewModel>().toEqualTypeOf<
      'key' | 'label' | 'status' | 'count' | 'canonicalHref'
    >();
  });

  it('keeps runtime imports inside the public declaration and local view-model boundary', () => {
    const implementation = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/institution-workbench/domain/workbench-lifecycle-projection.ts',
      ),
      'utf8',
    );
    const importSpecifiers = Array.from(
      implementation.matchAll(/from ['"]([^'"]+)['"]/g),
      (match) => match[1],
    );

    expect(importSpecifiers).toEqual([
      '@/modules/institution-contracts/v1/customer',
      '@/modules/institution-contracts/v1/institution-source',
      './workbench-lifecycle-view-models',
    ]);
    expect(importSpecifiers.some((specifier) => specifier.includes('/server/'))).toBe(false);
    expect(importSpecifiers.some((specifier) => specifier.includes('/api/'))).toBe(false);
    expect(importSpecifiers.some((specifier) => specifier.includes('/workspace/'))).toBe(false);
    expect(implementation).not.toContain('CapabilityStatusV1');
    expect(implementation).not.toContain('nextAction');
    expect(implementation).not.toContain('buildWorkbenchActionProjection');
    expect(implementation).not.toContain('workbench-action-aggregation');

    const viewModels = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/institution-workbench/domain/workbench-lifecycle-view-models.ts',
      ),
      'utf8',
    );
    const viewModelImportSpecifiers = Array.from(
      viewModels.matchAll(/from ['"]([^'"]+)['"]/g),
      (match) => match[1],
    );
    expect(viewModelImportSpecifiers).toEqual([
      '@/modules/institution-contracts/v1/customer',
      '@/modules/institution-contracts/v1/institution-source',
    ]);
  });

  it('recursively strips source scope, failures, hidden lifecycle data, and injected extras', () => {
    const result = buildWorkbenchLifecycleProjection({ lifecycle: readySourceWithExtras() });

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    expect([...collectObjectKeys(result)].sort()).toEqual(
      [
        'canonicalHref',
        'count',
        'items',
        'key',
        'label',
        'sourceReadiness',
        'status',
      ].sort(),
    );
    expect(result.items.map((item) => item.canonicalHref)).toEqual([
      '/hospital/customers?lifecycle=consulting',
      '/hospital/customers?lifecycle=scheduled',
      '/hospital/customers?lifecycle=post_care',
      '/hospital/customers?lifecycle=repurchase_window',
    ]);
    const serialized = JSON.stringify(result);
    for (const forbidden of [
      'tenantId',
      'institutionId',
      'failureCode',
      'silent_reactivation',
      'nextAction',
      'customerId',
      'accessToken',
      'providerDiagnostic',
      'diagnostic',
      'total',
      'malicious.invalid',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('keeps lifecycle data out of the WB-01A action aggregation boundary', () => {
    const actionAggregation = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/institution-workbench/domain/workbench-action-aggregation.ts',
      ),
      'utf8',
    );
    const lifecycleProjection = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/institution-workbench/domain/workbench-lifecycle-projection.ts',
      ),
      'utf8',
    );

    expect(actionAggregation).not.toContain('CustomerLifecycleSummaryV1');
    expect(actionAggregation).not.toContain('workbench-lifecycle');
    expect(lifecycleProjection).not.toMatch(/desktopActions|mobileActions|sortSignals|filter:/);
  });

  it('documents that this function is not an integration or authorization boundary', () => {
    const implementation = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/institution-workbench/domain/workbench-lifecycle-projection.ts',
      ),
      'utf8',
    );

    expect(implementation).toContain('pure display consumer');
    expect(implementation).toContain('not a provider, wire parser, reader, or authorizer');
    expect(implementation).toContain('BASE-02');
  });
});
