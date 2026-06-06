import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  HisConnectionCredentialCompensationJobQueueRepository,
  HisConnectionCredentialCompensationJobReadModel,
} from '@/modules/institution/server/his-connection-credential-compensation-job-queue-repository';
import type {
  HisConnectionCredentialCompensationOperationReadModel,
  HisConnectionCredentialCompensationOperationRepository,
} from '@/modules/institution/server/his-connection-credential-compensation-operation-repository';
import { createHisConnectionCredentialCompensationWorker } from '@/modules/institution/server/his-connection-credential-compensation-worker';

const now = new Date('2026-06-07T08:00:00.000Z');
const staleBefore = new Date('2026-06-07T07:45:00.000Z');
const lockDurationMs = 60_000;
const tenantId = 'demo-tenant-001';
const connectionId = 'his_conn_001';
const operationId = 'his_cred_comp_op_123e4567e89b12d3a456426614174000';

const dueJob = {
  id: 'his_cred_comp_job_001',
  tenantId,
  connectionId,
  operationId,
  operationType: 'credential_compensation',
  jobState: 'queued',
  failureCategory: 'repository_after_provider_failed',
  retryCount: 0,
  maxRetryCount: 3,
  nextAttemptAt: '2026-06-07T07:55:00.000Z',
  lockedUntil: null,
  claimId: null,
  claimVersion: 0,
  claimedBy: null,
  claimedAt: null,
  lastHeartbeatAt: null,
  deadLetterReason: null,
  manualReviewRequired: false,
  createdAt: '2026-06-07T07:55:00.000Z',
  updatedAt: '2026-06-07T07:55:00.000Z',
  completedAt: null,
} satisfies HisConnectionCredentialCompensationJobReadModel;

const claimedJob = {
  ...dueJob,
  jobState: 'claimed',
  claimId: 'claim-returned',
  claimVersion: 7,
  claimedBy: 'worker-001',
  claimedAt: now.toISOString(),
  lockedUntil: '2026-06-07T08:01:00.000Z',
  updatedAt: now.toISOString(),
} satisfies HisConnectionCredentialCompensationJobReadModel;

const runningJob = {
  ...claimedJob,
  jobState: 'running',
  lastHeartbeatAt: now.toISOString(),
} satisfies HisConnectionCredentialCompensationJobReadModel;

const activeLockedJob = {
  ...claimedJob,
  lockedUntil: '2026-06-07T08:10:00.000Z',
} satisfies HisConnectionCredentialCompensationJobReadModel;

const expiredClaimedJob = {
  ...claimedJob,
  lockedUntil: '2026-06-07T07:50:00.000Z',
} satisfies HisConnectionCredentialCompensationJobReadModel;

const expiredRunningJob = {
  ...runningJob,
  lockedUntil: '2026-06-07T07:50:00.000Z',
} satisfies HisConnectionCredentialCompensationJobReadModel;

const manualReviewJob = {
  ...expiredRunningJob,
  jobState: 'manual_review_required',
  lockedUntil: null,
  manualReviewRequired: true,
  completedAt: now.toISOString(),
} satisfies HisConnectionCredentialCompensationJobReadModel;

const runningOperation = {
  operationId,
  tenantId,
  connectionId,
  operationType: 'credential_compensation',
  state: 'compensation_running',
  failureCategory: 'repository_after_provider_failed',
  retryCount: 0,
  manualReviewRequired: false,
  createdAt: '2026-06-07T07:55:00.000Z',
  updatedAt: '2026-06-07T07:55:00.000Z',
  lastAttemptAt: '2026-06-07T07:40:00.000Z',
  completedAt: null,
} satisfies HisConnectionCredentialCompensationOperationReadModel;

const manualReviewOperation = {
  ...runningOperation,
  state: 'manual_review_required',
  manualReviewRequired: true,
  updatedAt: now.toISOString(),
  completedAt: now.toISOString(),
} satisfies HisConnectionCredentialCompensationOperationReadModel;

const forbiddenSensitivePattern =
  /DATABASE_URL|postgres:\/\/|mysql:\/\/|select \* from|SQL|stack/i;

function expectNoSensitiveData(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(forbiddenSensitivePattern);
}

function createJobQueueRepositoryMock(
  overrides: Partial<Record<keyof HisConnectionCredentialCompensationJobQueueRepository, unknown>> = {},
) {
  return {
    createCredentialCompensationJob: vi.fn(async () => ({ status: 'ok', record: dueJob })),
    getCredentialCompensationJobByOperation: vi.fn(async () => ({
      status: 'ok',
      record: runningJob,
    })),
    getCredentialCompensationJobByConnection: vi.fn(async () => ({
      status: 'ok',
      record: runningJob,
    })),
    listDueCredentialCompensationJobs: vi.fn(async () => ({
      status: 'ok',
      records: [dueJob],
    })),
    claimDueCredentialCompensationJob: vi.fn(async () => ({
      status: 'ok',
      record: claimedJob,
    })),
    markCredentialCompensationJobRunning: vi.fn(async () => ({
      status: 'ok',
      record: runningJob,
    })),
    markCredentialCompensationJobSucceeded: vi.fn(async () => ({
      status: 'ok',
      record: runningJob,
    })),
    markCredentialCompensationJobFailed: vi.fn(async () => ({
      status: 'ok',
      record: runningJob,
    })),
    requeueCredentialCompensationJob: vi.fn(async () => ({
      status: 'ok',
      record: dueJob,
    })),
    markCredentialCompensationJobDeadLettered: vi.fn(async () => ({
      status: 'ok',
      record: runningJob,
    })),
    markCredentialCompensationJobManualReviewRequired: vi.fn(async () => ({
      status: 'ok',
      record: manualReviewJob,
    })),
    listExpiredLockedCredentialCompensationJobs: vi.fn(async () => ({
      status: 'ok',
      records: [],
    })),
    ...overrides,
  } as unknown as HisConnectionCredentialCompensationJobQueueRepository;
}

function createOperationRepositoryMock(
  overrides: Partial<Record<keyof HisConnectionCredentialCompensationOperationRepository, unknown>> = {},
) {
  return {
    createCredentialCompensationOperation: vi.fn(async () => ({
      status: 'ok',
      record: runningOperation,
    })),
    getCredentialCompensationOperationByOperationId: vi.fn(async () => ({
      status: 'ok',
      record: runningOperation,
    })),
    getCredentialCompensationOperationByConnection: vi.fn(async () => ({
      status: 'ok',
      record: runningOperation,
    })),
    markCredentialCompensationOperationRunning: vi.fn(async () => ({
      status: 'ok',
      record: runningOperation,
    })),
    markCredentialCompensationOperationSucceeded: vi.fn(async () => ({
      status: 'ok',
      record: runningOperation,
    })),
    markCredentialCompensationOperationFailed: vi.fn(async () => ({
      status: 'ok',
      record: runningOperation,
    })),
    markCredentialCompensationOperationManualReviewRequired: vi.fn(async () => ({
      status: 'ok',
      record: manualReviewOperation,
    })),
    incrementCredentialCompensationOperationRetryCount: vi.fn(async () => ({
      status: 'ok',
      record: runningOperation,
    })),
    listPendingCredentialCompensationOperations: vi.fn(async () => ({
      status: 'ok',
      records: [],
    })),
    listStaleRunningCredentialCompensationOperations: vi.fn(async () => ({
      status: 'ok',
      records: [],
    })),
    ...overrides,
  } as unknown as HisConnectionCredentialCompensationOperationRepository;
}

function createWorker(input: {
  jobQueueRepository?: HisConnectionCredentialCompensationJobQueueRepository;
  operationRepository?: HisConnectionCredentialCompensationOperationRepository;
} = {}) {
  const jobQueueRepository = input.jobQueueRepository ?? createJobQueueRepositoryMock();
  const operationRepository = input.operationRepository ?? createOperationRepositoryMock();

  return {
    jobQueueRepository,
    operationRepository,
    worker: createHisConnectionCredentialCompensationWorker({
      jobQueueRepository,
      operationRepository,
      nowProvider: () => now,
      claimIdFactory: () => 'claim-generated',
      workerId: 'worker-001',
      lockDurationMs,
      maxBatchSize: 10,
    }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HIS 连接配置凭证补偿 worker claim / lock / stale recovery 最小边界', () => {
  it('due job claim 成功后返回稳定 ok 结果', async () => {
    const { worker } = createWorker();

    const result = await worker.claimDueCredentialCompensationJobs({ tenantId });

    expect(result.status).toBe('ok');
    expect(result.items).toEqual([
      expect.objectContaining({
        status: 'ok',
        tenantId,
        connectionId,
        operationId,
        claimId: 'claim-returned',
        claimVersion: 7,
      }),
    ]);
    expectNoSensitiveData(result);
  });

  it('claim 成功后使用返回记录的 claimId 和 claimVersion 写回 job running', async () => {
    const { worker, jobQueueRepository } = createWorker();

    await worker.claimDueCredentialCompensationJobs({ tenantId });

    expect(jobQueueRepository.markCredentialCompensationJobRunning).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });
  });

  it('job running 成功后再推进 operation running', async () => {
    const { worker, jobQueueRepository, operationRepository } = createWorker();

    await worker.claimDueCredentialCompensationJobs({ tenantId });

    expect(operationRepository.markCredentialCompensationOperationRunning).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
    });
    expect(
      vi.mocked(jobQueueRepository.markCredentialCompensationJobRunning).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(operationRepository.markCredentialCompensationOperationRunning).mock
        .invocationCallOrder[0],
    );
  });

  it('claim conflict 时不写 job running', async () => {
    const jobQueueRepository = createJobQueueRepositoryMock({
      claimDueCredentialCompensationJob: vi.fn(async () => ({ status: 'conflict' })),
    });
    const { worker } = createWorker({ jobQueueRepository });

    const result = await worker.claimDueCredentialCompensationJobs({ tenantId });

    expect(result.items).toEqual([
      expect.objectContaining({ status: 'conflict', tenantId, connectionId, operationId }),
    ]);
    expect(jobQueueRepository.markCredentialCompensationJobRunning).not.toHaveBeenCalled();
  });

  it('job running 失败时不推进 operation running', async () => {
    const jobQueueRepository = createJobQueueRepositoryMock({
      markCredentialCompensationJobRunning: vi.fn(async () => ({
        status: 'repository_error',
      })),
    });
    const operationRepository = createOperationRepositoryMock();
    const { worker } = createWorker({ jobQueueRepository, operationRepository });

    const result = await worker.claimDueCredentialCompensationJobs({ tenantId });

    expect(result.items).toEqual([
      expect.objectContaining({ status: 'repository_error', tenantId, connectionId, operationId }),
    ]);
    expect(operationRepository.markCredentialCompensationOperationRunning).not.toHaveBeenCalled();
  });

  it('operation running 失败时返回稳定结果且不调用 provider', async () => {
    const operationRepository = createOperationRepositoryMock({
      markCredentialCompensationOperationRunning: vi.fn(async () => ({
        status: 'invalid_state_transition',
      })),
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const { worker } = createWorker({ operationRepository });

    const result = await worker.claimDueCredentialCompensationJobs({ tenantId });

    expect(result.items).toEqual([
      expect.objectContaining({
        status: 'invalid_state_transition',
        tenantId,
        connectionId,
        operationId,
      }),
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expectNoSensitiveData(result);
  });

  it('old claim 写回被 repository 拒绝时 worker 收敛为 conflict', async () => {
    const jobQueueRepository = createJobQueueRepositoryMock({
      markCredentialCompensationJobRunning: vi.fn(async () => ({ status: 'conflict' })),
    });
    const operationRepository = createOperationRepositoryMock();
    const { worker } = createWorker({ jobQueueRepository, operationRepository });

    const result = await worker.claimDueCredentialCompensationJobs({ tenantId });

    expect(result.items).toEqual([
      expect.objectContaining({ status: 'conflict', tenantId, connectionId, operationId }),
    ]);
    expect(operationRepository.markCredentialCompensationOperationRunning).not.toHaveBeenCalled();
  });

  it('list due repository_error 时返回 repository_error', async () => {
    const jobQueueRepository = createJobQueueRepositoryMock({
      listDueCredentialCompensationJobs: vi.fn(async () => ({ status: 'repository_error' })),
    });
    const { worker } = createWorker({ jobQueueRepository });

    const result = await worker.claimDueCredentialCompensationJobs({ tenantId });

    expect(result).toEqual({ status: 'repository_error', items: [] });
    expectNoSensitiveData(result);
  });

  it('active lock 不抢占', async () => {
    const jobQueueRepository = createJobQueueRepositoryMock({
      listDueCredentialCompensationJobs: vi.fn(async () => ({
        status: 'ok',
        records: [activeLockedJob],
      })),
      claimDueCredentialCompensationJob: vi.fn(async () => ({ status: 'conflict' })),
    });
    const { worker } = createWorker({ jobQueueRepository });

    const result = await worker.claimDueCredentialCompensationJobs({ tenantId });

    expect(jobQueueRepository.claimDueCredentialCompensationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        connectionId,
        operationId,
        claimId: 'claim-generated',
        claimedBy: 'worker-001',
        lockedUntil: new Date(now.getTime() + lockDurationMs),
        now,
      }),
    );
    expect(result.items).toEqual([
      expect.objectContaining({ status: 'conflict', tenantId, connectionId, operationId }),
    ]);
    expect(jobQueueRepository.markCredentialCompensationJobRunning).not.toHaveBeenCalled();
  });

  it('expired claimed job recovery 走保守 skipped 路径', async () => {
    const jobQueueRepository = createJobQueueRepositoryMock({
      listExpiredLockedCredentialCompensationJobs: vi.fn(async () => ({
        status: 'ok',
        records: [expiredClaimedJob],
      })),
    });
    const { worker } = createWorker({ jobQueueRepository });

    const result = await worker.recoverExpiredLockedCredentialCompensationJobs({ tenantId });

    expect(result.items).toEqual([
      expect.objectContaining({ status: 'skipped', tenantId, connectionId, operationId }),
    ]);
    expect(jobQueueRepository.markCredentialCompensationJobManualReviewRequired).not.toHaveBeenCalled();
  });

  it('expired running job recovery 先标记 job manual review，再标记 operation manual review', async () => {
    const jobQueueRepository = createJobQueueRepositoryMock({
      listExpiredLockedCredentialCompensationJobs: vi.fn(async () => ({
        status: 'ok',
        records: [expiredRunningJob],
      })),
    });
    const operationRepository = createOperationRepositoryMock();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const { worker } = createWorker({ jobQueueRepository, operationRepository });

    const result = await worker.recoverExpiredLockedCredentialCompensationJobs({ tenantId });

    expect(jobQueueRepository.markCredentialCompensationJobManualReviewRequired).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });
    expect(operationRepository.markCredentialCompensationOperationManualReviewRequired).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
    });
    expect(
      vi.mocked(jobQueueRepository.markCredentialCompensationJobManualReviewRequired).mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(operationRepository.markCredentialCompensationOperationManualReviewRequired).mock
        .invocationCallOrder[0],
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        status: 'manual_review_required',
        tenantId,
        connectionId,
        operationId,
      }),
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('expired running job manual review 失败时不推进 operation manual review', async () => {
    const jobQueueRepository = createJobQueueRepositoryMock({
      listExpiredLockedCredentialCompensationJobs: vi.fn(async () => ({
        status: 'ok',
        records: [expiredRunningJob],
      })),
      markCredentialCompensationJobManualReviewRequired: vi.fn(async () => ({
        status: 'repository_error',
      })),
    });
    const operationRepository = createOperationRepositoryMock();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const { worker } = createWorker({ jobQueueRepository, operationRepository });

    const result = await worker.recoverExpiredLockedCredentialCompensationJobs({ tenantId });

    expect(result.items).toEqual([
      expect.objectContaining({ status: 'repository_error', tenantId, connectionId, operationId }),
    ]);
    expect(operationRepository.markCredentialCompensationOperationManualReviewRequired).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expectNoSensitiveData(result);
  });

  it('expired running operation manual review 失败时返回稳定结果', async () => {
    const jobQueueRepository = createJobQueueRepositoryMock({
      listExpiredLockedCredentialCompensationJobs: vi.fn(async () => ({
        status: 'ok',
        records: [expiredRunningJob],
      })),
    });
    const operationRepository = createOperationRepositoryMock({
      markCredentialCompensationOperationManualReviewRequired: vi.fn(async () => ({
        status: 'invalid_state_transition',
      })),
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const { worker } = createWorker({ jobQueueRepository, operationRepository });

    const result = await worker.recoverExpiredLockedCredentialCompensationJobs({ tenantId });

    expect(jobQueueRepository.markCredentialCompensationJobManualReviewRequired).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });
    expect(operationRepository.markCredentialCompensationOperationManualReviewRequired).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        status: 'invalid_state_transition',
        tenantId,
        connectionId,
        operationId,
      }),
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expectNoSensitiveData(result);
  });

  it('stale running operation 找不到 job 时进入 manual review', async () => {
    const jobQueueRepository = createJobQueueRepositoryMock({
      getCredentialCompensationJobByConnection: vi.fn(async () => ({ status: 'not_found' })),
    });
    const operationRepository = createOperationRepositoryMock({
      listStaleRunningCredentialCompensationOperations: vi.fn(async () => ({
        status: 'ok',
        records: [runningOperation],
      })),
    });
    const { worker } = createWorker({ jobQueueRepository, operationRepository });

    const result = await worker.recoverStaleRunningCredentialCompensationOperations({
      tenantId,
      staleBefore,
    });

    expect(operationRepository.markCredentialCompensationOperationManualReviewRequired).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        status: 'manual_review_required',
        tenantId,
        connectionId,
        operationId,
      }),
    ]);
  });

  it('stale running operation 不自动创建新 job', async () => {
    const jobQueueRepository = createJobQueueRepositoryMock({
      getCredentialCompensationJobByConnection: vi.fn(async () => ({ status: 'not_found' })),
    });
    const operationRepository = createOperationRepositoryMock({
      listStaleRunningCredentialCompensationOperations: vi.fn(async () => ({
        status: 'ok',
        records: [runningOperation],
      })),
    });
    const { worker } = createWorker({ jobQueueRepository, operationRepository });

    await worker.recoverStaleRunningCredentialCompensationOperations({
      tenantId,
      staleBefore,
    });

    expect(jobQueueRepository.createCredentialCompensationJob).not.toHaveBeenCalled();
  });

  it('worker 不写 audit', async () => {
    const { worker } = createWorker();

    await worker.claimDueCredentialCompensationJobs({ tenantId });

    const source = readFileSync(
      `${process.cwd()}/src/modules/institution/server/his-connection-credential-compensation-worker.ts`,
      'utf8',
    );
    expect(source).not.toMatch(/auditEvents|tenantBusinessAudit|auditRepository/i);
  });

  it('worker 不调用 provider / fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const { worker } = createWorker();

    await worker.claimDueCredentialCompensationJobs({ tenantId });
    await worker.recoverExpiredLockedCredentialCompensationJobs({ tenantId });
    await worker.recoverStaleRunningCredentialCompensationOperations({ tenantId, staleBefore });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('worker 不读取 request / header / query / localStorage', async () => {
    const source = readFileSync(
      `${process.cwd()}/src/modules/institution/server/his-connection-credential-compensation-worker.ts`,
      'utf8',
    );

    for (const forbiddenSourceToken of [
      ['request', 'body'].join(''),
      ['headers'].join(''),
      ['query', 'params'].join(''),
      ['local', 'Storage'].join(''),
    ]) {
      expect(source).not.toMatch(new RegExp(forbiddenSourceToken, 'i'));
    }
  });

  it('result 不暴露 SQL / stack / DATABASE_URL', async () => {
    const jobQueueRepository = createJobQueueRepositoryMock({
      markCredentialCompensationJobRunning: vi.fn(async () => ({
        status: 'repository_error',
      })),
    });
    const { worker } = createWorker({ jobQueueRepository });

    const result = await worker.claimDueCredentialCompensationJobs({ tenantId });

    expect(result.items).toEqual([
      expect.objectContaining({ status: 'repository_error', tenantId, connectionId, operationId }),
    ]);
    expectNoSensitiveData(result);
  });

  it('tenant / connection / operationId 全链路透传', async () => {
    const { worker, jobQueueRepository, operationRepository } = createWorker();

    await worker.claimDueCredentialCompensationJobs({ tenantId });

    expect(jobQueueRepository.claimDueCredentialCompensationJob).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, connectionId, operationId }),
    );
    expect(jobQueueRepository.markCredentialCompensationJobRunning).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, connectionId, operationId }),
    );
    expect(operationRepository.markCredentialCompensationOperationRunning).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
    });
  });

  it('worker 不导入 schema 或 migration', async () => {
    const source = readFileSync(
      `${process.cwd()}/src/modules/institution/server/his-connection-credential-compensation-worker.ts`,
      'utf8',
    );

    expect(source).not.toMatch(/@\/server\/db\/schema|drizzle|migration/i);
  });
});
