import { describe, expect, it, vi } from 'vitest';

import {
  createInstitutionAiUsageMetricsReader,
  type InstitutionAiUsageMetricsRecordSource,
} from '@/modules/institution-system/server/institution-ai-usage-metrics-reader';

const scope = { tenantId: 'tenant-a', institutionId: 'institution-a' } as const;
const timeWindow = { startInclusiveEpochMs: 1_000, endExclusiveEpochMs: 5_000 } as const;
const maximumRecords = 10_000;

function sourceWithRows(
  rows: Awaited<ReturnType<InstitutionAiUsageMetricsRecordSource['listInstitutionUsageMetricRecords']>>,
): InstitutionAiUsageMetricsRecordSource {
  return { listInstitutionUsageMetricRecords: vi.fn().mockResolvedValue(rows) };
}

describe('Institution AI usage metrics reader', () => {
  it('reads only scoped records and returns the strict low-sensitivity metrics projection', async () => {
    const source = sourceWithRows([
      { tenantId: 'tenant-a', institutionId: 'institution-a', status: 'succeeded', serviceCategory: 'ai_qa', serviceAction: 'direct_answer', createdAt: new Date(1_000) },
      { tenantId: 'tenant-a', institutionId: 'institution-a', status: 'failed', serviceCategory: 'knowledge_base_qa', serviceAction: 'rag_answer', createdAt: new Date(2_000) },
      { tenantId: 'tenant-a', institutionId: 'institution-a', status: 'rejected', serviceCategory: 'ai_qa', serviceAction: 'quota_rejected', createdAt: new Date(3_000) },
      { tenantId: 'tenant-a', institutionId: 'institution-a', status: 'unknown_status', serviceCategory: 'ai_qa', serviceAction: 'direct_answer', createdAt: new Date(4_000) },
    ]);
    const reader = createInstitutionAiUsageMetricsReader(source);

    const result = await reader.read({ scope, timeWindow });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected metrics');
    expect(Object.isFrozen(result.metrics)).toBe(true);
    expect(Object.isFrozen(result.metrics.byServiceKey)).toBe(true);
    expect(result).toEqual({
      ok: true,
      metrics: {
        totalCallCount: 4,
        serviceUnits: null,
        failureCount: 1,
        rejectionCount: 1,
        incompleteCount: 1,
        successRate: { numerator: 1, denominator: 3, value: 1 / 3 },
        byServiceKey: [
          { serviceKey: 'conversation_ai', totalCallCount: 3, serviceUnits: null, failureCount: 0, rejectionCount: 1, incompleteCount: 1, successRate: { numerator: 1, denominator: 2, value: 1 / 2 } },
          { serviceKey: 'knowledge_qa', totalCallCount: 1, serviceUnits: null, failureCount: 1, rejectionCount: 0, incompleteCount: 0, successRate: { numerator: 0, denominator: 1, value: 0 } },
        ],
      },
    });
    expect(source.listInstitutionUsageMetricRecords).toHaveBeenCalledWith({
      tenantId: 'tenant-a', institutionId: 'institution-a', startInclusiveEpochMs: 1_000, endExclusiveEpochMs: 5_000,
    });
    expect(JSON.stringify(result)).not.toMatch(/prompt|answer|model|token|provider|price|cost|quota|trend|serviceName/i);
  });

  it('fails closed when a persistent record cannot map to an approved business service key', async () => {
    const reader = createInstitutionAiUsageMetricsReader(sourceWithRows([
      { tenantId: 'tenant-a', institutionId: 'institution-a', status: 'succeeded', serviceCategory: 'openai_gpt_5', serviceAction: 'provider_cost', createdAt: new Date(1_000) },
    ]));

    await expect(reader.read({ scope, timeWindow }))
      .resolves.toEqual({ ok: false, code: 'invalid_service_key' });
  });

  it('rejects caller-provided service or terminal policies before querying the source', async () => {
    const source = sourceWithRows([]);
    const reader = createInstitutionAiUsageMetricsReader(source);

    await expect(reader.read({
      scope,
      timeWindow,
      serviceKeyMappings: [{
        serviceCategory: 'openai_gpt_5',
        serviceAction: 'provider_cost',
        serviceKey: 'provider_cost',
      }],
    } as never)).resolves.toEqual({ ok: false, code: 'invalid_input' });
    await expect(reader.read({
      scope,
      timeWindow,
      terminalStatusPolicy: { succeeded: 'failure' },
    } as never)).resolves.toEqual({ ok: false, code: 'invalid_input' });
    expect(source.listInstitutionUsageMetricRecords).not.toHaveBeenCalled();
  });

  it('fails closed when the record source returns a cross-institution row or is unavailable', async () => {
    const mismatchReader = createInstitutionAiUsageMetricsReader(sourceWithRows([
      { tenantId: 'tenant-a', institutionId: 'institution-b', status: 'succeeded', serviceCategory: 'ai_qa', serviceAction: 'direct_answer', createdAt: new Date(1_000) },
    ]));
    const unavailableReader = createInstitutionAiUsageMetricsReader({
      listInstitutionUsageMetricRecords: vi.fn().mockRejectedValue(new Error('database unavailable')),
    });

    await expect(mismatchReader.read({ scope, timeWindow }))
      .resolves.toEqual({ ok: false, code: 'scope_mismatch' });
    await expect(unavailableReader.read({ scope, timeWindow }))
      .resolves.toEqual({ ok: false, code: 'source_unavailable' });
  });

  it('accepts the fixed maximum record count but rejects the MAX + 1 sentinel without returning partial metrics', async () => {
    const row = {
      tenantId: 'tenant-a', institutionId: 'institution-a', status: 'succeeded',
      serviceCategory: 'ai_qa', serviceAction: 'direct_answer', createdAt: new Date(1_000),
    };
    const maximumReader = createInstitutionAiUsageMetricsReader(sourceWithRows(
      Array.from({ length: maximumRecords }, () => row),
    ));
    const sentinelReader = createInstitutionAiUsageMetricsReader(sourceWithRows(
      Array.from({ length: maximumRecords + 1 }, () => row),
    ));

    const maximumResult = await maximumReader.read({ scope, timeWindow });
    const sentinelResult = await sentinelReader.read({ scope, timeWindow });

    expect(maximumResult).toEqual(expect.objectContaining({
      ok: true,
      metrics: expect.objectContaining({ totalCallCount: maximumRecords }),
    }));
    expect(sentinelResult).toEqual({ ok: false, code: 'too_many_records' });
    expect(JSON.stringify(sentinelResult)).not.toMatch(/tenant|institution|conversation|assist/i);
  });

  it('snapshots the caller scope before querying and never rereads it after the source returns', async () => {
    const mutableScope = { tenantId: 'tenant-a', institutionId: 'institution-a' };
    const source = {
      listInstitutionUsageMetricRecords: vi.fn(async () => {
        mutableScope.tenantId = 'tenant-b';
        mutableScope.institutionId = 'institution-b';
        return [{
          tenantId: 'tenant-a', institutionId: 'institution-a', status: 'succeeded',
          serviceCategory: 'ai_qa', serviceAction: 'direct_answer', createdAt: new Date(1_000),
        }];
      }),
    } satisfies InstitutionAiUsageMetricsRecordSource;

    const result = await createInstitutionAiUsageMetricsReader(source).read({
      scope: mutableScope,
      timeWindow,
    });

    expect(result).toEqual({
      ok: true,
      metrics: {
        totalCallCount: 1,
        serviceUnits: null,
        failureCount: 0,
        rejectionCount: 0,
        incompleteCount: 0,
        successRate: { numerator: 1, denominator: 1, value: 1 },
        byServiceKey: [{
          serviceKey: 'conversation_ai', totalCallCount: 1, serviceUnits: null,
          failureCount: 0, rejectionCount: 0, incompleteCount: 0,
          successRate: { numerator: 1, denominator: 1, value: 1 },
        }],
      },
    });
  });

  it('snapshots the time window before querying and never rereads it after the source returns', async () => {
    const mutableTimeWindow = { startInclusiveEpochMs: 1_000, endExclusiveEpochMs: 5_000 };
    const source = {
      listInstitutionUsageMetricRecords: vi.fn(async () => {
        mutableTimeWindow.endExclusiveEpochMs = 1_000;
        return [{
          tenantId: 'tenant-a', institutionId: 'institution-a', status: 'succeeded',
          serviceCategory: 'ai_qa', serviceAction: 'direct_answer', createdAt: new Date(1_000),
        }];
      }),
    } satisfies InstitutionAiUsageMetricsRecordSource;

    const result = await createInstitutionAiUsageMetricsReader(source).read({
      scope,
      timeWindow: mutableTimeWindow,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      metrics: expect.objectContaining({
        successRate: { numerator: 1, denominator: 1, value: 1 },
      }),
    }));
  });

  it('rejects hostile caller inputs without invoking accessors or querying the source', async () => {
    let getterReads = 0;
    const accessorScope = { institutionId: 'institution-a' } as Record<string, unknown>;
    Object.defineProperty(accessorScope, 'tenantId', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('do not read');
      },
    });
    const source = sourceWithRows([]);
    const reader = createInstitutionAiUsageMetricsReader(source);
    const common = { timeWindow };

    await expect(reader.read({ ...common, scope: accessorScope as typeof scope }))
      .resolves.toEqual({ ok: false, code: 'invalid_input' });
    expect(getterReads).toBe(0);
    expect(source.listInstitutionUsageMetricRecords).not.toHaveBeenCalled();

    const accessorTerminalPolicyInput = { ...common, scope } as Record<string, unknown>;
    Object.defineProperty(accessorTerminalPolicyInput, 'terminalStatusPolicy', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('do not read');
      },
    });
    await expect(reader.read(accessorTerminalPolicyInput as never))
      .resolves.toEqual({ ok: false, code: 'invalid_input' });
    expect(getterReads).toBe(0);

    const accessorWindow = { endExclusiveEpochMs: 5_000 } as Record<string, unknown>;
    Object.defineProperty(accessorWindow, 'startInclusiveEpochMs', {
      enumerable: true,
      get() { throw new Error('do not read'); },
    });
    await expect(reader.read({ ...common, scope, timeWindow: accessorWindow as never }))
      .resolves.toEqual({ ok: false, code: 'invalid_input' });

    await expect(reader.read(new Proxy({ ...common, scope }, {}) as never))
      .resolves.toEqual({ ok: false, code: 'invalid_input' });
    await expect(reader.read({ ...common, scope: { ...scope, extra: 'no' } } as never))
      .resolves.toEqual({ ok: false, code: 'invalid_input' });
    await expect(reader.read({ ...common, scope: Object.assign(Object.create(null), scope) } as never))
      .resolves.toEqual({ ok: false, code: 'invalid_input' });
    await expect(reader.read({ ...common, scope: { ...scope, [Symbol('hidden')]: 'no' } } as never))
      .resolves.toEqual({ ok: false, code: 'invalid_input' });
  });

  it('fails closed for malformed, sparse, accessor, symbol, or proxy source rows without leaking source errors', async () => {
    const validRow = {
      tenantId: 'tenant-a', institutionId: 'institution-a', status: 'succeeded',
      serviceCategory: 'ai_qa', serviceAction: 'direct_answer', createdAt: new Date(1_000),
    };
    const accessorRow = { ...validRow } as Record<string, unknown>;
    Object.defineProperty(accessorRow, 'status', {
      enumerable: true,
      get() { throw new Error('raw persistent value'); },
    });
    const hiddenRow = { ...validRow } as Record<string, unknown>;
    Object.defineProperty(hiddenRow, 'status', { enumerable: false, value: 'succeeded' });
    const sparseRows = new Array(1) as unknown[];
    const malformedRowSets: unknown[] = [
      [{ ...validRow, unexpected: 'no' }],
      [accessorRow],
      [hiddenRow],
      [{ ...validRow, [Symbol('hidden')]: 'no' }],
      [new Proxy(validRow, {})],
      sparseRows,
      new Proxy([validRow], {}),
      new (class extends Array<unknown> {
        constructor() {
          super();
          this.push(validRow);
        }
      })(),
    ];

    for (const rows of malformedRowSets) {
      const reader = createInstitutionAiUsageMetricsReader({
        listInstitutionUsageMetricRecords: vi.fn().mockResolvedValue(rows),
      } as InstitutionAiUsageMetricsRecordSource);
      await expect(reader.read({ scope, timeWindow }))
        .resolves.toEqual({ ok: false, code: 'source_unavailable' });
    }

    const reader = createInstitutionAiUsageMetricsReader(Object.defineProperty({}, 'listInstitutionUsageMetricRecords', {
      enumerable: true,
      get() { throw new Error('source failure'); },
    }) as InstitutionAiUsageMetricsRecordSource);
    await expect(reader.read({ scope, timeWindow }))
      .resolves.toEqual({ ok: false, code: 'source_unavailable' });
  });
});
