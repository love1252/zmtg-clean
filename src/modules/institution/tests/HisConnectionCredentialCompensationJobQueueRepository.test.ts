import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';
import type { TenantDatabase } from '@/server/db/client';
import {
  auditEvents,
  hisConnectionCredentialCompensationJobs,
  treatmentSummaries,
} from '@/server/db/schema';
import {
  createHisConnectionCredentialCompensationJobQueueRepository,
  mapHisConnectionCredentialCompensationJobRowToReadModel,
} from '@/modules/institution/server/his-connection-credential-compensation-job-queue-repository';

type CompensationJobRow = typeof hisConnectionCredentialCompensationJobs.$inferSelect;

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
const now = new Date('2026-06-07T08:00:00.000Z');
const past = new Date('2026-06-07T07:55:00.000Z');
const future = new Date('2026-06-07T08:10:00.000Z');
const completedAt = new Date('2026-06-07T08:20:00.000Z');

const baseJobRow = {
  id: 'his_cred_comp_job_001',
  tenantId: 'demo-tenant-001',
  connectionId: 'his_conn_001',
  operationId: safeOperationId,
  operationType: 'credential_compensation',
  jobState: 'queued',
  failureCategory: 'repository_after_provider_failed',
  retryCount: 0,
  maxRetryCount: 3,
  nextAttemptAt: past,
  lockedUntil: null,
  claimId: null,
  claimVersion: 0,
  claimedBy: null,
  claimedAt: null,
  lastHeartbeatAt: null,
  deadLetterReason: null,
  manualReviewRequired: false,
  createdAt: past,
  updatedAt: past,
  completedAt: null,
} satisfies CompensationJobRow;

const claimedJobRow = {
  ...baseJobRow,
  jobState: 'claimed',
  claimId: 'claim-001',
  claimVersion: 1,
  claimedBy: 'worker-001',
  claimedAt: now,
  lockedUntil: future,
  updatedAt: now,
} satisfies CompensationJobRow;

const expiredClaimedJobRow = {
  ...claimedJobRow,
  lockedUntil: past,
} satisfies CompensationJobRow;

const runningJobRow = {
  ...claimedJobRow,
  jobState: 'running',
  lastHeartbeatAt: now,
} satisfies CompensationJobRow;

const failedJobRow = {
  ...runningJobRow,
  jobState: 'failed',
  completedAt,
} satisfies CompensationJobRow;

const succeededJobRow = {
  ...runningJobRow,
  jobState: 'succeeded',
  completedAt,
} satisfies CompensationJobRow;

const deadLetteredJobRow = {
  ...runningJobRow,
  jobState: 'dead_lettered',
  deadLetterReason: 'retry_exhausted',
  completedAt,
} satisfies CompensationJobRow;

const manualReviewJobRow = {
  ...runningJobRow,
  jobState: 'manual_review_required',
  manualReviewRequired: true,
  completedAt,
} satisfies CompensationJobRow;

const cancelledJobRow = {
  ...runningJobRow,
  jobState: 'cancelled',
  completedAt,
} satisfies CompensationJobRow;

const uniqueJobConflictError = {
  code: '23505',
  constraint: 'his_conn_cred_comp_jobs_operation_id_unique_idx',
  message: 'duplicate key value violates unique constraint',
};

const forbiddenSensitivePattern =
  /providerPath|secretPath|credentialRef|credential_ref|cred_ref_|idempotencyKey|idem_|scoped|synthetic_placeholder|token|secret|apiKey|api_key|connectionString|connection_string|rawCredential|raw_credential|rawPayload|raw_payload|DATABASE_URL|postgres:\/\/|mysql:\/\/|select \* from|SQL|stack|requestBody|request_body|responseBody|response_body/i;

function expectNoSensitiveData(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(forbiddenSensitivePattern);
}

function createInsertDatabase(input: {
  insertedRow?: CompensationJobRow | null;
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
  currentRow?: CompensationJobRow | null;
  updatedRow?: CompensationJobRow | null;
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

describe('HIS 连接配置凭证补偿 job queue repository 最小边界', () => {
  it('create job success 只写 job queue 表并返回安全 read model', async () => {
    const query = createInsertDatabase({ insertedRow: baseJobRow });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

    const result = await createHisConnectionCredentialCompensationJobQueueRepository(
      query.database,
    ).createCredentialCompensationJob({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
      failureCategory: 'repository_after_provider_failed',
      nextAttemptAt: past,
    });

    expect(query.insert).toHaveBeenCalledWith(hisConnectionCredentialCompensationJobs);
    expect(query.insert).not.toHaveBeenCalledWith(auditEvents);
    expect(query.insert).not.toHaveBeenCalledWith(treatmentSummaries);
    expect(query.values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        operationId: safeOperationId,
        operationType: 'credential_compensation',
        jobState: 'queued',
        failureCategory: 'repository_after_provider_failed',
        retryCount: 0,
        maxRetryCount: 3,
        nextAttemptAt: past,
        claimVersion: 0,
        manualReviewRequired: false,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );
    expect(result).toEqual({
      status: 'ok',
      record: mapHisConnectionCredentialCompensationJobRowToReadModel(baseJobRow),
    });
    expectNoSensitiveData(result);
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('operationId unique conflict 返回 conflict，不暴露 constraint 细节', async () => {
    const query = createInsertDatabase({ error: uniqueJobConflictError });

    const result = await createHisConnectionCredentialCompensationJobQueueRepository(
      query.database,
    ).createCredentialCompensationJob({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
      failureCategory: 'provider_write_failed',
      nextAttemptAt: past,
    });

    expect(result).toEqual({ status: 'conflict' });
    expect(JSON.stringify(result)).not.toMatch(/constraint|his_conn_cred_comp_jobs/i);
  });

  it('tenant isolation 和 connection mismatch 统一 not_found', async () => {
    const tenantQuery = createLookupDatabase([{ ...baseJobRow, tenantId: 'other-tenant' }]);
    const connectionQuery = createLookupDatabase([
      { ...baseJobRow, connectionId: 'his_conn_other' },
    ]);

    const tenantResult = await createHisConnectionCredentialCompensationJobQueueRepository(
      tenantQuery.database,
    ).getCredentialCompensationJobByOperation({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
    });
    const connectionResult = await createHisConnectionCredentialCompensationJobQueueRepository(
      connectionQuery.database,
    ).getCredentialCompensationJobByConnection({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
    });

    expect(tenantResult).toEqual({ status: 'not_found' });
    expect(connectionResult).toEqual({ status: 'not_found' });
  });

  it('operation scope 绑定必须使用 tenant + connection + operationId', async () => {
    const query = createLookupDatabase([baseJobRow]);

    const result = await createHisConnectionCredentialCompensationJobQueueRepository(
      query.database,
    ).getCredentialCompensationJobByConnection({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
    });

    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        {
          column: hisConnectionCredentialCompensationJobs.tenantId,
          operator: 'eq',
          value: 'demo-tenant-001',
        },
        {
          column: hisConnectionCredentialCompensationJobs.connectionId,
          operator: 'eq',
          value: 'his_conn_001',
        },
        {
          column: hisConnectionCredentialCompensationJobs.operationId,
          operator: 'eq',
          value: safeOperationId,
        },
      ],
      operator: 'and',
    });
    expect(result).toEqual({
      status: 'ok',
      record: mapHisConnectionCredentialCompensationJobRowToReadModel(baseJobRow),
    });
  });

  it('list due queued jobs 只返回到期 job，nextAttemptAt 未到不返回', async () => {
    const futureJob = { ...baseJobRow, operationId: secondSafeOperationId, nextAttemptAt: future };
    const otherTenantJob = { ...baseJobRow, tenantId: 'other-tenant' };
    const query = createListDatabase([baseJobRow, futureJob, otherTenantJob, runningJobRow]);

    const result = await createHisConnectionCredentialCompensationJobQueueRepository(
      query.database,
    ).listDueCredentialCompensationJobs({
      tenantId: 'demo-tenant-001',
      now,
    });

    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        {
          column: hisConnectionCredentialCompensationJobs.tenantId,
          operator: 'eq',
          value: 'demo-tenant-001',
        },
        {
          column: hisConnectionCredentialCompensationJobs.jobState,
          operator: 'eq',
          value: 'queued',
        },
        {
          column: hisConnectionCredentialCompensationJobs.nextAttemptAt,
          operator: 'lte',
          value: now,
        },
      ],
      operator: 'and',
    });
    expect(result).toEqual({
      status: 'ok',
      records: [mapHisConnectionCredentialCompensationJobRowToReadModel(baseJobRow)],
    });
  });

  it('claim due job success 写入 claim / lock 字段并递增 claimVersion', async () => {
    const query = createStateDatabase({
      currentRow: baseJobRow,
      updatedRow: claimedJobRow,
    });

    const result = await createHisConnectionCredentialCompensationJobQueueRepository(
      query.database,
    ).claimDueCredentialCompensationJob({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
      claimId: 'claim-001',
      claimedBy: 'worker-001',
      lockedUntil: future,
      now,
    });

    expect(query.set).toHaveBeenCalledWith({
      jobState: 'claimed',
      claimId: 'claim-001',
      claimVersion: 1,
      claimedBy: 'worker-001',
      claimedAt: now,
      lockedUntil: future,
      updatedAt: now,
    });
    expect(result).toMatchObject({ status: 'ok' });
  });

  it('lockedUntil 未过期时 claim 失败，过期 lock 可以重新 claim', async () => {
    const lockedQuery = createStateDatabase({
      currentRow: claimedJobRow,
      updatedRow: { ...claimedJobRow, claimVersion: 2 },
    });
    const expiredQuery = createStateDatabase({
      currentRow: expiredClaimedJobRow,
      updatedRow: { ...expiredClaimedJobRow, claimId: 'claim-002', claimVersion: 2 },
    });

    const locked = await createHisConnectionCredentialCompensationJobQueueRepository(
      lockedQuery.database,
    ).claimDueCredentialCompensationJob({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
      claimId: 'claim-002',
      claimedBy: 'worker-002',
      lockedUntil: future,
      now,
    });
    const expired = await createHisConnectionCredentialCompensationJobQueueRepository(
      expiredQuery.database,
    ).claimDueCredentialCompensationJob({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
      claimId: 'claim-002',
      claimedBy: 'worker-002',
      lockedUntil: future,
      now,
    });

    expect(locked).toEqual({ status: 'conflict' });
    expect(lockedQuery.update).not.toHaveBeenCalled();
    expect(expired).toMatchObject({ status: 'ok' });
    expect(expiredQuery.set).toHaveBeenCalledWith(
      expect.objectContaining({ claimId: 'claim-002', claimVersion: 2 }),
    );
  });

  it('old claim 写回被拒绝为 conflict', async () => {
    const query = createStateDatabase({
      currentRow: claimedJobRow,
      updatedRow: runningJobRow,
    });

    const result = await createHisConnectionCredentialCompensationJobQueueRepository(
      query.database,
    ).markCredentialCompensationJobRunning({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
      claimId: 'old-claim',
      claimVersion: 0,
      now,
    });

    expect(result).toEqual({ status: 'conflict' });
    expect(query.update).not.toHaveBeenCalled();
  });

  it('mark running / succeeded / failed 按 claim 写回并限制状态流转', async () => {
    const runningQuery = createStateDatabase({
      currentRow: claimedJobRow,
      updatedRow: runningJobRow,
    });
    const succeededQuery = createStateDatabase({
      currentRow: runningJobRow,
      updatedRow: succeededJobRow,
    });
    const failedQuery = createStateDatabase({
      currentRow: runningJobRow,
      updatedRow: failedJobRow,
    });

    await expect(
      createHisConnectionCredentialCompensationJobQueueRepository(
        runningQuery.database,
      ).markCredentialCompensationJobRunning({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        operationId: safeOperationId,
        claimId: 'claim-001',
        claimVersion: 1,
        now,
      }),
    ).resolves.toMatchObject({ status: 'ok' });
    expect(runningQuery.set).toHaveBeenCalledWith({
      jobState: 'running',
      lastHeartbeatAt: now,
      updatedAt: now,
    });

    await expect(
      createHisConnectionCredentialCompensationJobQueueRepository(
        succeededQuery.database,
      ).markCredentialCompensationJobSucceeded({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        operationId: safeOperationId,
        claimId: 'claim-001',
        claimVersion: 1,
        now,
      }),
    ).resolves.toMatchObject({ status: 'ok' });
    expect(succeededQuery.set).toHaveBeenCalledWith({
      jobState: 'succeeded',
      lockedUntil: null,
      updatedAt: now,
      completedAt: now,
    });

    await expect(
      createHisConnectionCredentialCompensationJobQueueRepository(
        failedQuery.database,
      ).markCredentialCompensationJobFailed({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        operationId: safeOperationId,
        claimId: 'claim-001',
        claimVersion: 1,
        now,
      }),
    ).resolves.toMatchObject({ status: 'ok' });
    expect(failedQuery.set).toHaveBeenCalledWith({
      jobState: 'failed',
      lockedUntil: null,
      updatedAt: now,
      completedAt: now,
    });
  });

  it('requeue failed job 递增 retryCount 并写入 nextAttemptAt', async () => {
    const requeuedRow = {
      ...failedJobRow,
      jobState: 'queued',
      retryCount: 1,
      nextAttemptAt: future,
      lockedUntil: null,
      completedAt: null,
    } satisfies CompensationJobRow;
    const query = createStateDatabase({ currentRow: failedJobRow, updatedRow: requeuedRow });

    const result = await createHisConnectionCredentialCompensationJobQueueRepository(
      query.database,
    ).requeueCredentialCompensationJob({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
      claimId: 'claim-001',
      claimVersion: 1,
      nextAttemptAt: future,
      now,
    });

    expect(query.set).toHaveBeenCalledWith({
      jobState: 'queued',
      retryCount: 1,
      nextAttemptAt: future,
      lockedUntil: null,
      deadLetterReason: null,
      manualReviewRequired: false,
      updatedAt: now,
      completedAt: null,
    });
    expect(result).toMatchObject({ status: 'ok' });
  });

  it('mark dead letter 和 manual review 使用 claim 校验并写入安全枚举', async () => {
    const deadLetterQuery = createStateDatabase({
      currentRow: runningJobRow,
      updatedRow: deadLetteredJobRow,
    });
    const manualReviewQuery = createStateDatabase({
      currentRow: failedJobRow,
      updatedRow: manualReviewJobRow,
    });

    await expect(
      createHisConnectionCredentialCompensationJobQueueRepository(
        deadLetterQuery.database,
      ).markCredentialCompensationJobDeadLettered({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        operationId: safeOperationId,
        claimId: 'claim-001',
        claimVersion: 1,
        deadLetterReason: 'retry_exhausted',
        now,
      }),
    ).resolves.toMatchObject({ status: 'ok' });
    expect(deadLetterQuery.set).toHaveBeenCalledWith({
      jobState: 'dead_lettered',
      deadLetterReason: 'retry_exhausted',
      lockedUntil: null,
      updatedAt: now,
      completedAt: now,
    });

    await expect(
      createHisConnectionCredentialCompensationJobQueueRepository(
        manualReviewQuery.database,
      ).markCredentialCompensationJobManualReviewRequired({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        operationId: safeOperationId,
        claimId: 'claim-001',
        claimVersion: 1,
        now,
      }),
    ).resolves.toMatchObject({ status: 'ok' });
    expect(manualReviewQuery.set).toHaveBeenCalledWith({
      jobState: 'manual_review_required',
      manualReviewRequired: true,
      lockedUntil: null,
      updatedAt: now,
      completedAt: now,
    });
  });

  it('succeeded / dead_lettered / cancelled 不自动回退', async () => {
    for (const currentRow of [succeededJobRow, deadLetteredJobRow, cancelledJobRow]) {
      const query = createStateDatabase({
        currentRow,
        updatedRow: { ...currentRow, jobState: 'queued' },
      });

      await expect(
        createHisConnectionCredentialCompensationJobQueueRepository(
          query.database,
        ).requeueCredentialCompensationJob({
          tenantId: 'demo-tenant-001',
          connectionId: 'his_conn_001',
          operationId: safeOperationId,
          claimId: 'claim-001',
          claimVersion: 1,
          nextAttemptAt: future,
          now,
        }),
      ).resolves.toEqual({ status: 'invalid_state_transition' });

      expect(query.update).not.toHaveBeenCalled();
    }
  });

  it('forbidden job state / dead letter reason 拒绝，read model 不含敏感字段', async () => {
    const invalidStateQuery = createLookupDatabase([
      { ...baseJobRow, jobState: 'free_text_state' },
    ]);
    const invalidReasonQuery = createStateDatabase({
      currentRow: runningJobRow,
      updatedRow: deadLetteredJobRow,
    });

    const getResult = await createHisConnectionCredentialCompensationJobQueueRepository(
      invalidStateQuery.database,
    ).getCredentialCompensationJobByConnection({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
    });
    const deadLetterResult = await createHisConnectionCredentialCompensationJobQueueRepository(
      invalidReasonQuery.database,
    ).markCredentialCompensationJobDeadLettered({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
      claimId: 'claim-001',
      claimVersion: 1,
      deadLetterReason: 'free_text_reason' as never,
      now,
    });

    expect(getResult).toEqual({ status: 'not_found' });
    expect(deadLetterResult).toEqual({ status: 'validation_failed' });
    expect(invalidReasonQuery.update).not.toHaveBeenCalled();
    expectNoSensitiveData(
      mapHisConnectionCredentialCompensationJobRowToReadModel(baseJobRow),
    );
  });

  it('list expired locked jobs 只返回锁过期且仍处于 claimed / running 的 job', async () => {
    const query = createListDatabase([
      expiredClaimedJobRow,
      runningJobRow,
      { ...runningJobRow, lockedUntil: past },
      failedJobRow,
    ]);

    const result = await createHisConnectionCredentialCompensationJobQueueRepository(
      query.database,
    ).listExpiredLockedCredentialCompensationJobs({
      tenantId: 'demo-tenant-001',
      now,
    });

    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        {
          column: hisConnectionCredentialCompensationJobs.tenantId,
          operator: 'eq',
          value: 'demo-tenant-001',
        },
        {
          column: hisConnectionCredentialCompensationJobs.lockedUntil,
          operator: 'lte',
          value: now,
        },
      ],
      operator: 'and',
    });
    expect(result).toEqual({
      status: 'ok',
      records: [
        mapHisConnectionCredentialCompensationJobRowToReadModel(expiredClaimedJobRow),
        mapHisConnectionCredentialCompensationJobRowToReadModel({
          ...runningJobRow,
          lockedUntil: past,
        }),
      ],
    });
  });

  it('repository_error 不暴露 SQL / stack / DATABASE_URL', async () => {
    const query = createStateDatabase({
      currentRow: runningJobRow,
      updateError: new Error(
        'DATABASE_URL=postgres://tenant:secret@localhost select * from audit_events stack',
      ),
    });

    const result = await createHisConnectionCredentialCompensationJobQueueRepository(
      query.database,
    ).markCredentialCompensationJobSucceeded({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
      claimId: 'claim-001',
      claimVersion: 1,
      now,
    });

    expect(result).toEqual({ status: 'repository_error' });
    expectNoSensitiveData(result);
  });

  it('repository 不写 audit、不调用 provider、不读取 request / header / query / localStorage', async () => {
    const query = createStateDatabase({
      currentRow: claimedJobRow,
      updatedRow: runningJobRow,
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const source = readFileSync(
      `${process.cwd()}/src/modules/institution/server/his-connection-credential-compensation-job-queue-repository.ts`,
      'utf8',
    );

    await createHisConnectionCredentialCompensationJobQueueRepository(
      query.database,
    ).markCredentialCompensationJobRunning({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operationId: safeOperationId,
      claimId: 'claim-001',
      claimVersion: 1,
      now,
    });

    expect(query.insert).not.toHaveBeenCalledWith(auditEvents);
    expect(query.update).toHaveBeenCalledWith(hisConnectionCredentialCompensationJobs);
    expect(query.update).not.toHaveBeenCalledWith(auditEvents);
    expect(query.update).not.toHaveBeenCalledWith(treatmentSummaries);
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
