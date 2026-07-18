import { describe, expect, it, vi } from 'vitest';
import {
  getCustomerImportRowsForExecution,
  previewLowSensitiveCustomerImport,
} from '@/modules/institution/server/customer-import';

const occurredAt = '2026-07-18T08:00:00.000Z';

function validRow(overrides: Record<string, unknown> = {}) {
  return {
    customerDisplayName: '示例客户',
    treatmentProject: '皮肤管理',
    lastVisitDate: '2026-07-01',
    importedCustomerRef: 'import-ref-fixture',
    ...overrides,
  };
}

function preview(rows: unknown[]) {
  return previewLowSensitiveCustomerImport({
    tenantId: 'tenant-fixture',
    institutionId: 'institution-fixture',
    operatorRef: 'operator-fixture',
    rows,
    occurredAt,
  });
}

function expectUnsafeOnly(result: ReturnType<typeof previewLowSensitiveCustomerImport>) {
  expect(result.canExecute).toBe(false);
  expect(result.successCount).toBe(0);
  expect(result.importBatch.rows).toHaveLength(1);
  expect(result.importBatch.rows[0]).toMatchObject({
    status: 'skipped',
    customerDisplayName: null,
    importedCustomerRef: null,
    issues: [expect.objectContaining({ reason: 'unsafe_payload' })],
  });
}

describe('customer import parser boundary', () => {
  it('rejects an accessor-backed top-level payload before reading business values', () => {
    const input: Record<string, unknown> = {
      institutionId: 'institution-fixture',
      operatorRef: 'operator-fixture',
      rows: [validRow()],
      occurredAt,
    };
    Object.defineProperty(input, 'tenantId', {
      enumerable: true,
      get() {
        throw new Error('top-level marker must not escape');
      },
    });

    expectUnsafeOnly(previewLowSensitiveCustomerImport(input as never));
  });

  it('rejects Proxy and sparse rows arrays without invoking row business parsing', () => {
    const proxiedRows = new Proxy([validRow()], {});
    expectUnsafeOnly(preview(proxiedRows));

    const sparseRows = [validRow(), ,] as unknown[];
    expectUnsafeOnly(preview(sparseRows));
  });

  it('rejects accessor, hidden, symbol, and extra row keys without echoing markers', () => {
    const accessorRow: Record<string, unknown> = validRow();
    Object.defineProperty(accessorRow, 'noteSummary', {
      enumerable: true,
      get() {
        throw new Error('row marker must not escape');
      },
    });

    const hiddenRow = validRow();
    Object.defineProperty(hiddenRow, 'hiddenMarker', {
      enumerable: false,
      value: 'hidden-fixture-marker',
    });

    const symbolRow = validRow();
    Object.defineProperty(symbolRow, Symbol('symbol-marker'), {
      enumerable: true,
      value: 'symbol-fixture-marker',
    });

    const extraRow = validRow({ unknownColumn: 'extra-fixture-marker' });

    for (const row of [accessorRow, hiddenRow, symbolRow, extraRow]) {
      const result = preview([row]);
      expect(result.canExecute).toBe(false);
      expect(result.successCount).toBe(0);
      expect(result.importBatch.rows[0]).toMatchObject({
        status: 'skipped',
        customerDisplayName: null,
        importedCustomerRef: null,
      });
      expect(result.importBatch.rows[0]?.issues).not.toHaveLength(0);
      expect(JSON.stringify(result)).not.toContain('marker');
      expect(JSON.stringify(result)).not.toContain('import-ref-fixture');
    }
  });

  it('rejects null-prototype, nested, oversized, and malformed scalar inputs fail-closed', () => {
    const nullPrototypeRow = Object.assign(Object.create(null), validRow());
    const nestedRow = validRow({ tagSummary: ['nested'] });
    const oversizedRow = validRow({ noteSummary: 'x'.repeat(4097) });
    const malformedScalarRow = validRow({ birthYear: 1994 });

    for (const row of [nullPrototypeRow, nestedRow, oversizedRow, malformedScalarRow]) {
      expectUnsafeOnly(preview([row]));
    }
  });

  it('does not mutate accepted input and execution reuses the validated immutable snapshot', () => {
    const row = Object.freeze(validRow());
    const rows = Object.freeze([row]);
    const input = Object.freeze({
      tenantId: 'tenant-fixture',
      institutionId: 'institution-fixture',
      operatorRef: 'operator-fixture',
      rows,
      occurredAt,
    });

    const before = JSON.stringify(input);
    const { preview: result, drafts } = getCustomerImportRowsForExecution(input);

    expect(result.successCount).toBe(1);
    expect(drafts).toHaveLength(1);
    expect(JSON.stringify(input)).toBe(before);
    expect(Object.isFrozen(input)).toBe(true);
    expect(Object.isFrozen(rows)).toBe(true);
    expect(Object.isFrozen(row)).toBe(true);
  });

  it('rejects a Proxy before any prototype, own-key, or descriptor trap runs', () => {
    const calls = { prototype: 0, keys: 0, descriptor: 0 };
    const hostile = new Proxy(validRow(), {
      getPrototypeOf() { calls.prototype += 1; return Object.prototype; },
      ownKeys() { calls.keys += 1; return []; },
      getOwnPropertyDescriptor() { calls.descriptor += 1; return undefined; },
    });

    expectUnsafeOnly(preview([hostile]));
    expect(calls).toEqual({ prototype: 0, keys: 0, descriptor: 0 });
  });

  it('rejects oversize containers before reading an element descriptor', () => {
    const descriptor = vi.spyOn(Object, 'getOwnPropertyDescriptor');
    const rows = Array.from({ length: 257 }, () => validRow());
    expectUnsafeOnly(preview(rows));
    expect(descriptor).not.toHaveBeenCalledWith(rows, 'length');

    const existingCustomers = Array.from({ length: 10_001 }, () => ({
      id: 'customer-fixture', tenantId: 'tenant-fixture', institutionId: 'institution-fixture',
      displayName: '示例客户', lifecycle: 'consulting' as const, priority: 'observe' as const, ownerUserId: 'owner-fixture',
      projectInterest: '皮肤管理', maskedPhone: 'masked', maskedMedicalRecordNo: 'masked',
      lastTouchSummary: '', nextAction: '', tags: [], gender: '', birthDate: '', referralSource: '', notes: '',
    }));
    expectUnsafeOnly(previewLowSensitiveCustomerImport({
      tenantId: 'tenant-fixture', institutionId: 'institution-fixture', operatorRef: 'operator-fixture',
      rows: [validRow()], existingCustomers, occurredAt,
    }));
    descriptor.mockRestore();
  });

  it('bounds metadata and nested tags without echoing values', () => {
    expectUnsafeOnly(previewLowSensitiveCustomerImport({
      tenantId: 't'.repeat(257), institutionId: 'institution-fixture', operatorRef: 'operator-fixture', rows: [validRow()], occurredAt,
    }));
    const existingCustomer = {
      id: 'customer-fixture', tenantId: 'tenant-fixture', institutionId: 'institution-fixture', displayName: '示例客户',
      lifecycle: 'consulting' as const, priority: 'observe' as const, ownerUserId: 'owner-fixture', projectInterest: '皮肤管理',
      maskedPhone: 'masked', maskedMedicalRecordNo: 'masked', lastTouchSummary: '', nextAction: '',
      tags: Array.from({ length: 65 }, (_, index) => `tag-${index}`), gender: '', birthDate: '', referralSource: '', notes: '',
    };
    expectUnsafeOnly(previewLowSensitiveCustomerImport({
      tenantId: 'tenant-fixture', institutionId: 'institution-fixture', operatorRef: 'operator-fixture', rows: [validRow()], existingCustomers: [existingCustomer], occurredAt,
    }));
  });
});
