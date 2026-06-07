import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';
import type { TenantDatabase } from '@/server/db/client';
import {
  auditEvents,
  hisConnectionCredentialCompensationOperations,
  treatmentSummaries,
} from '@/server/db/schema';
import {
  createHisConnectionCredentialCompensationOperationRepository,
  mapHisConnectionCredentialCompensationOperationRowToReadModel,
} from '@/modules/institution/server/his-connection-credential-compensation-operation-repository';

type CompensationOperationRow =
  typeof hisConnectionCredentialCompensationOperations.$inferSelect;

const andMock = vi.hoisted(() =>
  vi.fn((...conditions: unknown[]) => ({
    conditions,
    operator: 'and',
  })),
);
const ascMock = vi.hoisted(() =>
  vi.fn((column: unknown) => ({
    column,
    direction: 'asc',
  })),
);
const eqMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({
    column,
    operator: 'eq',
    value,
  })),
);
const lteMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({
    column,
    operator: 'lte',
    value,
  })),
);

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: andMock,
    asc: ascMock,
    eq: eqMock,
    lte: lteMock,
  };
});

const safeOperationId = 'his_cred_comp_op_123e4567e89b12d3a456426614174000';
const secondSafeOperationId = 'his_cred_comp_op_223e4567e89b12d3a456426614174000';
const now = new Date('2026-06-06T08:00:00.000Z');
const later = new Date('2026-06-06T08:10:00.000Z');
const staleCutoff = new Date('2026-06-06T08:15:00.000Z');

const compensationOperationRow = {
  id: 'his_cred_comp_operation_001',
  tenantId: 'demo-tenant-001',
  connectionId: 'his_conn_001',
  operationId: safeOperationId,
  operationType: 'credential_compensation',
  state: 'compensation_pending',
  failureCategory: 'repository_after_provider_failed',
  retryCount: 0,
  manualReviewRequired: false,
  createdAt: now,
  updatedAt: now,
  lastAttemptAt: null,
  completedAt: null,
} satisfies CompensationOperationRow;

const runningOperationRow = {
  ...compensationOperationRow,
  state: 'compensation_running',
  updatedAt: later,
  lastAttemptAt: later,
} satisfies CompensationOperationRow;

const succeededOperationRow = {
  ...runningOperationRow,
  state: 'compensation_succeeded',
  completedAt: new Date('2026-06-06T08:20:00.000Z'),
} satisfies CompensationOperationRow;

const failedOperationRow = {
  ...runningOperationRow,
  state: 'compensation_failed',
  retryCount: 1,
  completedAt: new Date('2026-06-06T08:20:00.000Z'),
} satisfies CompensationOperationRow;

const manualReviewOperationRow = {
  ...runningOperationRow,
  state: 'manual_review_required',
  manualReviewRequired: true,
  completedAt: new Date('2026-06-06T08:20:00.000Z'),
} satisfies CompensationOperationRow;

const forbiddenSensitivePattern =
  /providerPath|secretPath|credentialRef|credential_ref|cred_ref_|idempotencyKey|idem_|scoped|synthetic_placeholder|token|secret|apiKey|api_key|connectionString|connection_string|rawCredential|raw_credential|rawPayload|raw_payload|DATABASE_URL|postgres:\/\/|mysql:\/\/|select \* from|SQL|stack|requestBody|request_body|responseBody|response_body/i;

const uniqueOperationConflictError = {
  code: '23505',
  constraint: 'his_conn_cred_comp_ops_operation_id_unique_idx',
  message: 'duplicate key value violates unique constraint',
};

function expectNoSensitiveData(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(forbiddenSensitivePattern);
}

function createInsertDatabase(input: {
  insertedRow?: CompensationOperationRow | null;
  error?: unknown;
} = {}) {
  const returning = vi.fn(async () => {
    if (input.error) throw input.error;
    return input.insertedRow ? [input.insertedRow] : [];
  });
  const values = vi.fn((value: unknown) => {
    void value;
    return { returning };
  });
  const insert = vi.fn((table: unknown) => {
    void table;
    return { values };
  });
  const update = vi.fn();
  const select = vi.fn();
  const deleteMock = vi.fn();

  return {
    database: { delete: deleteMock, insert, select, update } as unknown as TenantDatabase,
    deleteMock,
    insert,
    returning,
    select,
    update,
    values,
  };
}

function createLookupDatabase(rows: unknown[] = [], error?: unknown) {
  const where = vi.fn(async (condition: unknown) => {
    void condition;
    if (error) throw error;
    return rows;
  });
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const insert = vi.fn();
  const update = vi.fn();
  const deleteMock = vi.fn();

  return {
    database: { delete: deleteMock, insert, select, update } as unknown as TenantDatabase,
    deleteMock,
    from,
    insert,
    select,
    update,
    where,
  };
}

function createListDatabase(rows: unknown[] = [], error?: unknown) {
  const orderBy = vi.fn(async (...columns: unknown[]) => {
    void columns;
    if (error) throw error;
    return rows;
  });
  const where = vi.fn((condition: unknown) => {
    void condition;
    return { orderBy };
  });
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const insert = vi.fn();
  const update = vi.fn();
  const deleteMock = vi.fn();

  return {
    database: { delete: deleteMock, insert, select, update } as unknown as TenantDatabase,
    deleteMock,
    from,
    insert,
    orderBy,
    select,
    update,
    where,
  };
}

function createStateDatabase(input: {
  currentRow?: CompensationOperationRow | null;
  updatedRow?: CompensationOperationRow | null;
  lookupError?: unknown;
  updateError?: unknown;
} = {}) {
  const returning = vi.fn(async () => {
    if (input.updateError) throw input.updateError;
    return input.updatedRow ? [input.updatedRow] : [];
  });
  const updateWhere = vi.fn((condition: unknown) => {
    void condition;
    return { returning };
  });
  const set = vi.fn((values: Record<string, unknown>) => {
    void values;
    return { where: updateWhere };
  });
  const update = vi.fn((table: unknown) => {
    void table;
    return { set };
  });
  const lookupWhere = vi.fn(async (condition: unknown) => {
    void condition;
    if (input.lookupError) throw input.lookupError;
    return input.currentRow ? [input.currentRow] : [];
  });
  const from = vi.fn(() => ({ where: lookupWhere }));
  const select = vi.fn(() => ({ from }));
  const insert = vi.fn();
  const deleteMock = vi.fn();

  return {
    database: { delete: deleteMock, insert, select, update } as unknown as TenantDatabase,
    deleteMock,
    from,
    insert,
    lookupWhere,
    returning,
    select,
    set,
    update,
    updateWhere,
  };
}

describe('HIS 连接配置凭证补偿 operation repository 最小边界', () => {
  it('create operation success 只写 compensation operation 表并返回安全 read model', async () => {
    const query = createInsertDatabase({ insertedRow: compensationOperationRow });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

    const result = await createHisConnectionCredentialCompensationOperationRepository(
      query.database,
    ).createCredentialCompensationOperation({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
      failureCategory: 'repository_after_provider_failed',
    });

    expect(query.insert).toHaveBeenCalledWith(hisConnectionCredentialCompensationOperations);
    expect(query.insert).not.toHaveBeenCalledWith(auditEvents);
    expect(query.insert).not.toHaveBeenCalledWith(treatmentSummaries);
    expect(query.values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        operationId: safeOperationId,
        operationType: 'credential_compensation',
        state: 'compensation_pending',
        failureCategory: 'repository_after_provider_failed',
        retryCount: 0,
        manualReviewRequired: false,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );
    expect(result).toEqual({
      status: 'ok',
      record: mapHisConnectionCredentialCompensationOperationRowToReadModel(
        compensationOperationRow,
      ),
    });
    expect(JSON.stringify(result)).not.toMatch(/his_cred_comp_operation_001/);
    expectNoSensitiveData(result);
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('operationId unique conflict 返回 conflict，不暴露 constraint 细节', async () => {
    const query = createInsertDatabase({ error: uniqueOperationConflictError });

    const result = await createHisConnectionCredentialCompensationOperationRepository(
      query.database,
    ).createCredentialCompensationOperation({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
      failureCategory: 'provider_write_failed',
    });

    expect(result).toEqual({ status: 'conflict' });
    expect(JSON.stringify(result)).not.toMatch(/constraint|his_conn_cred_comp_ops/i);
  });

  it('get by tenant + operationId 绑定 tenant scope，跨租户统一 not_found', async () => {
    const query = createLookupDatabase([
      { ...compensationOperationRow, tenantId: 'other-tenant' },
    ]);

    const result = await createHisConnectionCredentialCompensationOperationRepository(
      query.database,
    ).getCredentialCompensationOperationByOperationId({
      tenantId: 'demo-tenant-001',
      operationId: safeOperationId,
    });

    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        {
          column: hisConnectionCredentialCompensationOperations.tenantId,
          operator: 'eq',
          value: 'demo-tenant-001',
        },
        {
          column: hisConnectionCredentialCompensationOperations.operationId,
          operator: 'eq',
          value: safeOperationId,
        },
      ],
      operator: 'and',
    });
    expect(result).toEqual({ status: 'not_found' });
  });

  it('get by tenant + connectionId + operationId 绑定 connection scope，连接不匹配统一 not_found', async () => {
    const query = createLookupDatabase([
      { ...compensationOperationRow, connectionId: 'his_conn_other' },
    ]);

    const result = await createHisConnectionCredentialCompensationOperationRepository(
      query.database,
    ).getCredentialCompensationOperationByConnection({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
    });

    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        {
          column: hisConnectionCredentialCompensationOperations.tenantId,
          operator: 'eq',
          value: 'demo-tenant-001',
        },
        {
          column: hisConnectionCredentialCompensationOperations.connectionId,
          operator: 'eq',
          value: 'his_conn_001',
        },
        {
          column: hisConnectionCredentialCompensationOperations.operationId,
          operator: 'eq',
          value: safeOperationId,
        },
      ],
      operator: 'and',
    });
    expect(result).toEqual({ status: 'not_found' });
  });

  it('valid state transition 更新状态、lastAttemptAt 和 completedAt 边界', async () => {
    const runningQuery = createStateDatabase({
      currentRow: compensationOperationRow,
      updatedRow: runningOperationRow,
    });
    const succeededQuery = createStateDatabase({
      currentRow: runningOperationRow,
      updatedRow: succeededOperationRow,
    });
    const failedQuery = createStateDatabase({
      currentRow: runningOperationRow,
      updatedRow: failedOperationRow,
    });

    await expect(
      createHisConnectionCredentialCompensationOperationRepository(
        runningQuery.database,
      ).markCredentialCompensationOperationRunning({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        operationId: safeOperationId,
      }),
    ).resolves.toMatchObject({ status: 'ok' });
    expect(runningQuery.set).toHaveBeenCalledWith({
      state: 'compensation_running',
      updatedAt: expect.any(Date),
      lastAttemptAt: expect.any(Date),
      completedAt: null,
    });

    await expect(
      createHisConnectionCredentialCompensationOperationRepository(
        succeededQuery.database,
      ).markCredentialCompensationOperationSucceeded({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        operationId: safeOperationId,
      }),
    ).resolves.toMatchObject({ status: 'ok' });
    expect(succeededQuery.set).toHaveBeenCalledWith({
      state: 'compensation_succeeded',
      updatedAt: expect.any(Date),
      completedAt: expect.any(Date),
      manualReviewRequired: false,
    });

    await expect(
      createHisConnectionCredentialCompensationOperationRepository(
        failedQuery.database,
      ).markCredentialCompensationOperationFailed({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        operationId: safeOperationId,
      }),
    ).resolves.toMatchObject({ status: 'ok' });
    expect(failedQuery.set).toHaveBeenCalledWith({
      state: 'compensation_failed',
      updatedAt: expect.any(Date),
      completedAt: expect.any(Date),
      manualReviewRequired: false,
    });
  });

  it('invalid state transition 和 succeeded rollback 均不写数据库', async () => {
    const invalidQuery = createStateDatabase({
      currentRow: compensationOperationRow,
      updatedRow: failedOperationRow,
    });
    const rollbackQuery = createStateDatabase({
      currentRow: succeededOperationRow,
      updatedRow: runningOperationRow,
    });

    await expect(
      createHisConnectionCredentialCompensationOperationRepository(
        invalidQuery.database,
      ).markCredentialCompensationOperationFailed({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        operationId: safeOperationId,
      }),
    ).resolves.toEqual({ status: 'invalid_state_transition' });
    await expect(
      createHisConnectionCredentialCompensationOperationRepository(
        rollbackQuery.database,
      ).markCredentialCompensationOperationRunning({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        operationId: safeOperationId,
      }),
    ).resolves.toEqual({ status: 'invalid_state_transition' });

    expect(invalidQuery.update).not.toHaveBeenCalled();
    expect(rollbackQuery.update).not.toHaveBeenCalled();
  });

  it('failed 状态可以显式递增 retry count，并在 retry 时更新 lastAttemptAt', async () => {
    const query = createStateDatabase({
      currentRow: failedOperationRow,
      updatedRow: { ...failedOperationRow, retryCount: 2, lastAttemptAt: later },
    });

    const result = await createHisConnectionCredentialCompensationOperationRepository(
      query.database,
    ).incrementCredentialCompensationOperationRetryCount({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
    });

    expect(query.set).toHaveBeenCalledWith({
      retryCount: 2,
      updatedAt: expect.any(Date),
      lastAttemptAt: expect.any(Date),
    });
    expect(result).toMatchObject({ status: 'ok' });
    expect(JSON.stringify(query.set.mock.calls)).not.toMatch(/maxRetry|retryLimit/i);
  });

  it('manual_review_required 状态可以显式递增 retry count', async () => {
    const query = createStateDatabase({
      currentRow: manualReviewOperationRow,
      updatedRow: { ...manualReviewOperationRow, retryCount: 1, lastAttemptAt: later },
    });

    const result = await createHisConnectionCredentialCompensationOperationRepository(
      query.database,
    ).incrementCredentialCompensationOperationRetryCount({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
    });

    expect(query.set).toHaveBeenCalledWith({
      retryCount: 1,
      updatedAt: expect.any(Date),
      lastAttemptAt: expect.any(Date),
    });
    expect(result).toMatchObject({ status: 'ok' });
  });

  it('pending、running、succeeded 状态不能递增 retry count，且不写数据库', async () => {
    for (const currentRow of [
      compensationOperationRow,
      runningOperationRow,
      succeededOperationRow,
    ]) {
      const query = createStateDatabase({
        currentRow,
        updatedRow: { ...currentRow, retryCount: currentRow.retryCount + 1 },
      });

      await expect(
        createHisConnectionCredentialCompensationOperationRepository(
          query.database,
        ).incrementCredentialCompensationOperationRetryCount({
          tenantId: 'demo-tenant-001',
          connectionId: 'his_conn_001',
          operationId: safeOperationId,
        }),
      ).resolves.toEqual({ status: 'invalid_state_transition' });

      expect(query.update).not.toHaveBeenCalled();
    }
  });

  it('manual review required 设置终态、completedAt 和 manualReviewRequired=true', async () => {
    const query = createStateDatabase({
      currentRow: runningOperationRow,
      updatedRow: manualReviewOperationRow,
    });

    const result = await createHisConnectionCredentialCompensationOperationRepository(
      query.database,
    ).markCredentialCompensationOperationManualReviewRequired({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
    });

    expect(query.set).toHaveBeenCalledWith({
      state: 'manual_review_required',
      manualReviewRequired: true,
      updatedAt: expect.any(Date),
      completedAt: expect.any(Date),
    });
    expect(result).toMatchObject({ status: 'ok' });
  });

  it('failed operation 可以通过专用方法推进 manual review，且不修改 retryCount 或 lastAttemptAt', async () => {
    const failedManualReviewRow = {
      ...failedOperationRow,
      state: 'manual_review_required',
      manualReviewRequired: true,
      updatedAt: new Date('2026-06-06T08:25:00.000Z'),
      completedAt: new Date('2026-06-06T08:25:00.000Z'),
    } satisfies CompensationOperationRow;
    const query = createStateDatabase({
      currentRow: failedOperationRow,
      updatedRow: failedManualReviewRow,
    });

    const result = await createHisConnectionCredentialCompensationOperationRepository(
      query.database,
    ).markFailedCredentialCompensationOperationManualReviewRequired({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
    });

    expect(query.lookupWhere).toHaveBeenCalledWith({
      conditions: [
        {
          column: hisConnectionCredentialCompensationOperations.tenantId,
          operator: 'eq',
          value: 'demo-tenant-001',
        },
        {
          column: hisConnectionCredentialCompensationOperations.connectionId,
          operator: 'eq',
          value: 'his_conn_001',
        },
        {
          column: hisConnectionCredentialCompensationOperations.operationId,
          operator: 'eq',
          value: safeOperationId,
        },
      ],
      operator: 'and',
    });
    expect(query.set).toHaveBeenCalledWith({
      state: 'manual_review_required',
      manualReviewRequired: true,
      updatedAt: expect.any(Date),
      completedAt: expect.any(Date),
    });
    expect(query.updateWhere).toHaveBeenCalledWith({
      conditions: [
        {
          column: hisConnectionCredentialCompensationOperations.tenantId,
          operator: 'eq',
          value: 'demo-tenant-001',
        },
        {
          column: hisConnectionCredentialCompensationOperations.connectionId,
          operator: 'eq',
          value: 'his_conn_001',
        },
        {
          column: hisConnectionCredentialCompensationOperations.operationId,
          operator: 'eq',
          value: safeOperationId,
        },
        {
          column: hisConnectionCredentialCompensationOperations.state,
          operator: 'eq',
          value: 'compensation_failed',
        },
      ],
      operator: 'and',
    });
    expect(result).toEqual({
      status: 'ok',
      record: mapHisConnectionCredentialCompensationOperationRowToReadModel(
        failedManualReviewRow,
      ),
    });
    if (result.status === 'ok') {
      expect(result.record.retryCount).toBe(failedOperationRow.retryCount);
      expect(result.record.lastAttemptAt).toBe(failedOperationRow.lastAttemptAt.toISOString());
    }
    expect(JSON.stringify(query.set.mock.calls)).not.toMatch(/retryCount|lastAttemptAt|claimId|claimVersion/i);
    expectNoSensitiveData(result);
  });

  it('failed operation manual review 专用方法跨 tenant / connection / operationId 统一 not_found 且不写数据库', async () => {
    for (const currentRow of [
      { ...failedOperationRow, tenantId: 'other-tenant' },
      { ...failedOperationRow, connectionId: 'his_conn_other' },
      { ...failedOperationRow, operationId: secondSafeOperationId },
    ]) {
      const query = createStateDatabase({
        currentRow,
        updatedRow: manualReviewOperationRow,
      });

      const result = await createHisConnectionCredentialCompensationOperationRepository(
        query.database,
      ).markFailedCredentialCompensationOperationManualReviewRequired({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        operationId: safeOperationId,
      });

      expect(result).toEqual({ status: 'not_found' });
      expect(query.update).not.toHaveBeenCalled();
    }
  });

  it('failed operation manual review 专用方法拒绝非 failed 状态', async () => {
    for (const currentRow of [
      compensationOperationRow,
      runningOperationRow,
      succeededOperationRow,
      manualReviewOperationRow,
    ]) {
      const query = createStateDatabase({
        currentRow,
        updatedRow: manualReviewOperationRow,
      });

      const result = await createHisConnectionCredentialCompensationOperationRepository(
        query.database,
      ).markFailedCredentialCompensationOperationManualReviewRequired({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        operationId: safeOperationId,
      });

      expect(result).toEqual({ status: 'invalid_state_transition' });
      expect(query.update).not.toHaveBeenCalled();
    }
  });

  it('failed operation manual review 专用方法非法输入返回 validation_failed 且不查库不写库', async () => {
    for (const input of [
      { tenantId: '', connectionId: 'his_conn_001', operationId: safeOperationId },
      {
        tenantId: 'demo-tenant-001',
        connectionId: 'x'.repeat(65),
        operationId: safeOperationId,
      },
      {
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        operationId: 'his_cred_comp_op_credentialRef_raw_payload_stack',
      },
    ]) {
      const query = createStateDatabase({
        currentRow: failedOperationRow,
        updatedRow: manualReviewOperationRow,
      });

      const result = await createHisConnectionCredentialCompensationOperationRepository(
        query.database,
      ).markFailedCredentialCompensationOperationManualReviewRequired(input);

      expect(result).toEqual({ status: 'validation_failed' });
      expect(query.select).not.toHaveBeenCalled();
      expect(query.update).not.toHaveBeenCalled();
    }
  });

  it('failed operation manual review 专用方法 repository_error 不暴露 SQL / stack / DATABASE_URL', async () => {
    const query = createStateDatabase({
      currentRow: failedOperationRow,
      updateError: new Error(
        'DATABASE_URL=postgres://tenant:secret@localhost select * from audit_events stack',
      ),
    });

    const result = await createHisConnectionCredentialCompensationOperationRepository(
      query.database,
    ).markFailedCredentialCompensationOperationManualReviewRequired({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
    });

    expect(result).toEqual({ status: 'repository_error' });
    expectNoSensitiveData(result);
  });

  it('现有 running manual review 方法保持不变，不接受 failed 状态', async () => {
    const query = createStateDatabase({
      currentRow: failedOperationRow,
      updatedRow: manualReviewOperationRow,
    });

    const result = await createHisConnectionCredentialCompensationOperationRepository(
      query.database,
    ).markCredentialCompensationOperationManualReviewRequired({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
    });

    expect(result).toEqual({ status: 'invalid_state_transition' });
    expect(query.update).not.toHaveBeenCalled();
  });

  it('pending query 和 stale running query 只按 tenant / state 安全读取', async () => {
    const pendingQuery = createListDatabase([
      compensationOperationRow,
      { ...compensationOperationRow, operationId: secondSafeOperationId, tenantId: 'other-tenant' },
    ]);
    const staleQuery = createListDatabase([
      runningOperationRow,
      { ...runningOperationRow, operationId: secondSafeOperationId, state: 'compensation_pending' },
    ]);

    const pending = await createHisConnectionCredentialCompensationOperationRepository(
      pendingQuery.database,
    ).listPendingCredentialCompensationOperations({ tenantId: 'demo-tenant-001' });
    const stale = await createHisConnectionCredentialCompensationOperationRepository(
      staleQuery.database,
    ).listStaleRunningCredentialCompensationOperations({
      tenantId: 'demo-tenant-001',
      staleBefore: staleCutoff,
    });

    expect(pendingQuery.where).toHaveBeenCalledWith({
      conditions: [
        {
          column: hisConnectionCredentialCompensationOperations.tenantId,
          operator: 'eq',
          value: 'demo-tenant-001',
        },
        {
          column: hisConnectionCredentialCompensationOperations.state,
          operator: 'eq',
          value: 'compensation_pending',
        },
      ],
      operator: 'and',
    });
    expect(staleQuery.where).toHaveBeenCalledWith({
      conditions: [
        {
          column: hisConnectionCredentialCompensationOperations.tenantId,
          operator: 'eq',
          value: 'demo-tenant-001',
        },
        {
          column: hisConnectionCredentialCompensationOperations.state,
          operator: 'eq',
          value: 'compensation_running',
        },
        {
          column: hisConnectionCredentialCompensationOperations.lastAttemptAt,
          operator: 'lte',
          value: staleCutoff,
        },
      ],
      operator: 'and',
    });
    expect(pending).toEqual({
      status: 'ok',
      records: [mapHisConnectionCredentialCompensationOperationRowToReadModel(compensationOperationRow)],
    });
    expect(stale).toEqual({
      status: 'ok',
      records: [mapHisConnectionCredentialCompensationOperationRowToReadModel(runningOperationRow)],
    });
  });

  it('forbidden operationId 和 forbidden failure category 返回 validation_failed 且不写数据库', async () => {
    const operationIdQuery = createInsertDatabase({ insertedRow: compensationOperationRow });
    const failureCategoryQuery = createInsertDatabase({ insertedRow: compensationOperationRow });

    await expect(
      createHisConnectionCredentialCompensationOperationRepository(
        operationIdQuery.database,
      ).createCredentialCompensationOperation({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        operationId: 'his_cred_comp_op_credentialRef_cred_ref_secret',
        failureCategory: 'repository_after_provider_failed',
      }),
    ).resolves.toEqual({ status: 'validation_failed' });
    await expect(
      createHisConnectionCredentialCompensationOperationRepository(
        failureCategoryQuery.database,
      ).createCredentialCompensationOperation({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        operationId: safeOperationId,
        failureCategory: 'credentialRef=cred_ref_demo_secret stack' as never,
      }),
    ).resolves.toEqual({ status: 'validation_failed' });

    expect(operationIdQuery.insert).not.toHaveBeenCalled();
    expect(failureCategoryQuery.insert).not.toHaveBeenCalled();
  });

  it('repository_error 不暴露 SQL / stack / DATABASE_URL', async () => {
    const query = createStateDatabase({
      currentRow: runningOperationRow,
      updateError: new Error(
        'DATABASE_URL=postgres://tenant:secret@localhost select * from audit_events stack',
      ),
    });

    const result = await createHisConnectionCredentialCompensationOperationRepository(
      query.database,
    ).markCredentialCompensationOperationSucceeded({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
    });

    expect(result).toEqual({ status: 'repository_error' });
    expectNoSensitiveData(result);
  });

  it('repository 不写 audit、不调用 provider、不读取 request / header / query / localStorage', async () => {
    const query = createStateDatabase({
      currentRow: compensationOperationRow,
      updatedRow: runningOperationRow,
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const source = readFileSync(
      `${process.cwd()}/src/modules/institution/server/his-connection-credential-compensation-operation-repository.ts`,
      'utf8',
    );

    await createHisConnectionCredentialCompensationOperationRepository(
      query.database,
    ).markCredentialCompensationOperationRunning({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
    });

    expect(query.insert).not.toHaveBeenCalledWith(auditEvents);
    expect(query.update).toHaveBeenCalledWith(hisConnectionCredentialCompensationOperations);
    expect(query.update).not.toHaveBeenCalledWith(auditEvents);
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const forbiddenSourceToken of [
      ['request', 'body'].join(''),
      ['headers'].join(''),
      ['query', 'params'].join(''),
      ['local', 'Storage'].join(''),
    ]) {
      expect(source).not.toMatch(new RegExp(forbiddenSourceToken, 'i'));
    }

    fetchSpy.mockRestore();
  });
});
