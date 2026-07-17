import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, expectTypeOf, it } from 'vitest';

import type { CapabilityStatusV1 } from '@/modules/institution-contracts/v1/institution-capability';
import {
  buildWorkbenchCapabilityProjection,
  type BuildWorkbenchCapabilityProjectionInput,
} from '@/modules/institution-workbench/domain/workbench-capability-projection';
import type {
  WorkbenchCapabilityProjection,
  WorkbenchCapabilitySummaryViewModel,
  WorkbenchQuickCreateItemViewModel,
} from '@/modules/institution-workbench/domain/workbench-capability-view-models';

const currentFreshness = {
  observedAt: '2026-07-18T01:00:00.000Z',
  freshUntil: '2026-07-18T01:05:00.000Z',
};

const referenceTime = '2026-07-18T01:02:00.000Z';

function sourceWithUntrustedExtras(): CapabilityStatusV1 {
  return {
    contractVersion: 'v1',
    scope: {
      tenantId: 'tenant-safe-reference',
      institutionId: 'institution-safe-reference',
      accessToken: 'must-not-leak',
    },
    readiness: 'ready',
    freshness: currentFreshness,
    partitions: [
      {
        key: 'page_workbench',
        readiness: 'ready',
        freshness: currentFreshness,
        failureCode: null,
        providerDiagnostic: 'must-not-leak',
      },
      {
        key: 'action_customer_create',
        readiness: 'ready',
        freshness: currentFreshness,
        failureCode: null,
        credentialState: 'must-not-leak',
      },
    ],
    data: {
      capabilities: [
        {
          key: 'page_workbench',
          decision: 'read_only',
          dimensions: {
            codeMaturity: 'verified',
            institutionAuthorization: 'authorized',
            connectionAvailability: 'available',
            dataReadiness: 'ready',
            productionRelease: 'released',
            endpoint: 'https://malicious.invalid/dimensions',
          },
          safeSummary: '工作台业务可用',
          diagnosticTargetKey: 'page_system_overview',
          href: 'https://malicious.invalid/summary',
          customerName: 'must-not-leak',
          rawError: 'must-not-leak',
        },
        {
          key: 'action_customer_create',
          decision: 'operational',
          dimensions: {
            codeMaturity: 'verified',
            institutionAuthorization: 'authorized',
            connectionAvailability: 'not_required',
            dataReadiness: 'not_required',
            productionRelease: 'released',
          },
          safeSummary: null,
          diagnosticTargetKey: null,
          href: 'https://malicious.invalid/create',
          url: 'https://malicious.invalid/url',
        },
      ],
      providerPayload: 'must-not-leak',
    },
    failureCode: null,
    adapter: 'must-not-leak',
  } as unknown as CapabilityStatusV1;
}

function collectObjectKeys(value: unknown, result = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectObjectKeys(item, result);
    }
    return result;
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, nestedValue] of Object.entries(value)) {
      result.add(key);
      collectObjectKeys(nestedValue, result);
    }
  }

  return result;
}

function isDeeplyFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return true;
  }

  return (
    Object.isFrozen(value) &&
    Object.values(value as Record<string, unknown>).every(isDeeplyFrozen)
  );
}

describe('WorkbenchCapabilityContractBoundary typed consumer projection', () => {
  it('consumes the exact public capability type and returns only local view models', () => {
    expectTypeOf<Parameters<typeof buildWorkbenchCapabilityProjection>[0]>().toEqualTypeOf<
      BuildWorkbenchCapabilityProjectionInput
    >();
    expectTypeOf<BuildWorkbenchCapabilityProjectionInput>().toEqualTypeOf<
      Readonly<{ capabilities: CapabilityStatusV1; referenceTime: string }>
    >();
    expectTypeOf<ReturnType<typeof buildWorkbenchCapabilityProjection>>().toEqualTypeOf<
      WorkbenchCapabilityProjection
    >();
    expectTypeOf<keyof WorkbenchCapabilitySummaryViewModel>().toEqualTypeOf<
      | 'key'
      | 'kind'
      | 'label'
      | 'decision'
      | 'safeSummary'
      | 'dataStatus'
      | 'observedAt'
      | 'diagnosticTarget'
    >();
    expectTypeOf<WorkbenchQuickCreateItemViewModel['key']>().toEqualTypeOf<
      | 'action_customer_create'
      | 'action_care_appointment_create'
      | 'action_care_followup_create'
    >();
    expectTypeOf<WorkbenchQuickCreateItemViewModel['href']>().toEqualTypeOf<
      | '/hospital/customers?create=1'
      | '/hospital/care/appointments?create=1'
      | '/hospital/care/followups?create=1'
    >();
  });

  it('keeps runtime imports inside public contracts and the local view-model boundary', () => {
    const implementation = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/institution-workbench/domain/workbench-capability-projection.ts',
      ),
      'utf8',
    );
    const importSpecifiers = Array.from(
      implementation.matchAll(/from ['"]([^'"]+)['"]/g),
      (match) => match[1],
    );

    expect(importSpecifiers).toEqual([
      '@/modules/institution-contracts/v1/institution-capability',
      '@/modules/institution-contracts/v1/institution-capability-registry',
      '@/modules/institution-contracts/v1/institution-source',
      './workbench-capability-view-models',
    ]);
    expect(importSpecifiers.some((specifier) => specifier.includes('/server/'))).toBe(false);
    expect(importSpecifiers.some((specifier) => specifier.includes('/api/'))).toBe(false);
    expect(importSpecifiers.some((specifier) => specifier.includes('/repository'))).toBe(false);
    expect(implementation).not.toContain('workbench-action-aggregation');
    expect(implementation).not.toContain('workbench-lifecycle-projection');
    expect(implementation).not.toContain('InstitutionSourceEnvelopeV1');
    expect(implementation).not.toContain('/hospital/customers?create=1');
    expect(implementation).not.toContain('/hospital/care/appointments?create=1');
    expect(implementation).not.toContain('/hospital/care/followups?create=1');
  });

  it('projects a strict low-sensitivity whitelist and resolves all links from the registry', () => {
    const source = sourceWithUntrustedExtras();
    const result = buildWorkbenchCapabilityProjection({ capabilities: source, referenceTime });

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    expect(result.summaries).toEqual([
      {
        key: 'page_workbench',
        kind: 'page',
        label: '工作台',
        decision: 'read_only',
        safeSummary: '工作台业务可用',
        dataStatus: 'current',
        observedAt: null,
        diagnosticTarget: {
          key: 'page_system_overview',
          label: '系统概览',
          href: '/hospital/system',
        },
      },
    ]);
    expect(result.quickCreateMenu?.items).toEqual([
      {
        key: 'action_customer_create',
        label: '新建客户',
        href: '/hospital/customers?create=1',
      },
    ]);

    const resultKeys = collectObjectKeys(result);
    expect(resultKeys).toEqual(
      new Set([
        'status',
        'sourceReadiness',
        'summaries',
        'quickCreateMenu',
        'key',
        'kind',
        'label',
        'decision',
        'safeSummary',
        'dataStatus',
        'observedAt',
        'diagnosticTarget',
        'href',
        'items',
      ]),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /must-not-leak|malicious|accessToken|provider|adapter|credential|customerName|rawError/,
    );
  });

  it('does not mutate the input and returns a deeply frozen projection', () => {
    const source = sourceWithUntrustedExtras();
    const before = structuredClone(source);

    const result = buildWorkbenchCapabilityProjection({ capabilities: source, referenceTime });

    expect(source).toEqual(before);
    expect(Object.isFrozen(source)).toBe(false);
    expect(isDeeplyFrozen(result)).toBe(true);
    expect(Reflect.set(result, 'status', 'blocked')).toBe(false);

    if (result.status === 'projected') {
      expect(Reflect.set(result.summaries, '0', null)).toBe(false);
      expect(Reflect.set(result.summaries[0], 'label', '被篡改')).toBe(false);
      expect(Reflect.set(result.summaries[0].diagnosticTarget!, 'href', '/unsafe')).toBe(
        false,
      );
      expect(Reflect.set(result.quickCreateMenu!.items[0], 'href', '/unsafe')).toBe(false);
    }
  });

  it('fails closed without throwing when an accessor or proxy rejects inspection', () => {
    const source = sourceWithUntrustedExtras();
    Object.defineProperty(source, 'readiness', {
      configurable: true,
      enumerable: true,
      get() {
        throw new Error('must not escape');
      },
    });
    const proxied = new Proxy(sourceWithUntrustedExtras(), {
      getOwnPropertyDescriptor() {
        throw new Error('must not escape');
      },
    });

    expect(() =>
      buildWorkbenchCapabilityProjection({ capabilities: source, referenceTime }),
    ).not.toThrow();
    expect(buildWorkbenchCapabilityProjection({ capabilities: source, referenceTime })).toEqual({
      status: 'blocked',
      summaries: [],
      quickCreateMenu: null,
    });
    expect(() =>
      buildWorkbenchCapabilityProjection({ capabilities: proxied, referenceTime }),
    ).not.toThrow();
    expect(buildWorkbenchCapabilityProjection({ capabilities: proxied, referenceTime })).toEqual({
      status: 'blocked',
      summaries: [],
      quickCreateMenu: null,
    });
  });

  it('snapshots consumed fields once and rejects stateful accessors before they can escalate or leak', () => {
    const source = sourceWithUntrustedExtras();
    const item = source.data!.capabilities[1];
    let decisionReads = 0;
    let summaryReads = 0;

    Object.defineProperty(item, 'decision', {
      configurable: true,
      enumerable: true,
      get() {
        decisionReads += 1;
        return decisionReads === 1 ? 'read_only' : 'operational';
      },
    });
    Object.defineProperty(item, 'safeSummary', {
      configurable: true,
      enumerable: true,
      get() {
        summaryReads += 1;
        return summaryReads === 1 ? '新建客户仅供查看' : 'secret=must-not-leak';
      },
    });

    const result = buildWorkbenchCapabilityProjection({ capabilities: source, referenceTime });

    expect(result).toEqual({
      status: 'blocked',
      summaries: [],
      quickCreateMenu: null,
    });
    expect(decisionReads).toBe(0);
    expect(summaryReads).toBe(0);
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
  });

  it('rejects sparse arrays and extra symbol properties without mutating the input', () => {
    const sparse = sourceWithUntrustedExtras();
    sparse.partitions.length = 3;

    const withSymbol = sourceWithUntrustedExtras();
    const marker = Symbol('untrusted');
    Object.defineProperty(withSymbol.data!.capabilities[0], marker, {
      enumerable: true,
      value: 'must-not-leak',
    });

    for (const source of [sparse, withSymbol]) {
      expect(buildWorkbenchCapabilityProjection({ capabilities: source, referenceTime })).toEqual({
        status: 'blocked',
        summaries: [],
        quickCreateMenu: null,
      });
      expect(Object.isFrozen(source)).toBe(false);
    }
  });
});
