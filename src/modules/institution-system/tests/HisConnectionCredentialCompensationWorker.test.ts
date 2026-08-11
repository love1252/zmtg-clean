import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  HisConnectionCredentialCompensationJobQueueRepository,
  HisConnectionCredentialCompensationJobReadModel,
} from '@/modules/institution-system/server/his-connection-credential-compensation-job-queue-repository';
import type {
  HisConnectionCredentialCompensationOperationReadModel,
  HisConnectionCredentialCompensationOperationRepository,
} from '@/modules/institution-system/server/his-connection-credential-compensation-operation-repository';
import {
  createHisConnectionCredentialCompensationWorker,
  type HisConnectionCredentialCompensationProviderExecutor,
  type HisConnectionCredentialCompensationProviderExecutorInput,
} from '@/modules/institution-system/application/his-connection-credential-compensation-worker';

const now = new Date('2026-06-07T08:00:00.000Z');
const staleBefore = new Date('2026-06-07T07:45:00.000Z');
const retryNextAttemptAt = new Date('2026-06-07T08:01:00.000Z');
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

const succeededJob = {
  ...runningJob,
  jobState: 'succeeded',
  lockedUntil: null,
  completedAt: now.toISOString(),
  updatedAt: now.toISOString(),
} satisfies HisConnectionCredentialCompensationJobReadModel;

const failedJob = {
  ...runningJob,
  jobState: 'failed',
  lockedUntil: null,
  completedAt: now.toISOString(),
  updatedAt: now.toISOString(),
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
      record: failedJob,
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
    markFailedCredentialCompensationOperationManualReviewRequired: vi.fn(async () => ({
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
  providerExecutor?: HisConnectionCredentialCompensationProviderExecutor;
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
      providerExecutor: input.providerExecutor,
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

  it('provider result success 时先标记 job succeeded，再标记 operation succeeded', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'success' as const }));
    const jobQueueRepository = createJobQueueRepositoryMock({
      markCredentialCompensationJobSucceeded: vi.fn(async () => ({
        status: 'ok',
        record: succeededJob,
      })),
    });
    const operationRepository = createOperationRepositoryMock();
    const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

    const result = await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(providerExecutor).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      workerId: 'worker-001',
      now,
    });
    expect(jobQueueRepository.markCredentialCompensationJobSucceeded).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });
    expect(operationRepository.markCredentialCompensationOperationSucceeded).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
    });
    expect(
      vi.mocked(jobQueueRepository.markCredentialCompensationJobSucceeded).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(operationRepository.markCredentialCompensationOperationSucceeded).mock
        .invocationCallOrder[0],
    );
    expect(result).toEqual(expect.objectContaining({
      status: 'ok',
      providerResult: 'success',
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
    }));
  });

  it('success 中 job succeeded 失败时不推进 operation succeeded', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'success' as const }));
    const jobQueueRepository = createJobQueueRepositoryMock({
      markCredentialCompensationJobSucceeded: vi.fn(async () => ({ status: 'repository_error' })),
    });
    const operationRepository = createOperationRepositoryMock();
    const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

    const result = await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(result).toEqual(expect.objectContaining({
      status: 'repository_error',
      providerResult: 'success',
      tenantId,
      connectionId,
      operationId,
    }));
    expect(operationRepository.markCredentialCompensationOperationSucceeded).not.toHaveBeenCalled();
    expectNoSensitiveData(result);
  });

  it('success 中 operation succeeded 失败时返回稳定 status', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'success' as const }));
    const operationRepository = createOperationRepositoryMock({
      markCredentialCompensationOperationSucceeded: vi.fn(async () => ({
        status: 'invalid_state_transition',
      })),
    });
    const { worker } = createWorker({ operationRepository, providerExecutor });

    const result = await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(result).toEqual(expect.objectContaining({
      status: 'invalid_state_transition',
      providerResult: 'success',
      tenantId,
      connectionId,
      operationId,
    }));
    expectNoSensitiveData(result);
  });

  it('provider result retryable_failure 低于上限时接入 retry policy 并 requeue', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'retryable_failure' as const }));
    const jobQueueRepository = createJobQueueRepositoryMock({
      markCredentialCompensationJobFailed: vi.fn(async () => ({
        status: 'ok',
        record: failedJob,
      })),
    });
    const operationRepository = createOperationRepositoryMock();
    const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

    const result = await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(jobQueueRepository.markCredentialCompensationJobFailed).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });
    expect(operationRepository.markCredentialCompensationOperationFailed).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
    });
    expect(jobQueueRepository.requeueCredentialCompensationJob).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
      nextAttemptAt: retryNextAttemptAt,
    });
    expect(operationRepository.incrementCredentialCompensationOperationRetryCount).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
    });
    expect(
      vi.mocked(jobQueueRepository.requeueCredentialCompensationJob).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(operationRepository.incrementCredentialCompensationOperationRetryCount).mock
        .invocationCallOrder[0],
    );
    expect(jobQueueRepository.markCredentialCompensationJobDeadLettered).not.toHaveBeenCalled();
    expect(jobQueueRepository.markCredentialCompensationJobManualReviewRequired).not.toHaveBeenCalled();
    expect(
      operationRepository.markFailedCredentialCompensationOperationManualReviewRequired,
    ).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      status: 'ok',
      providerResult: 'retryable_failure',
    }));
  });

  it('requeue 成功后只对齐 operation retry count 且不 dead letter / manual review', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'retryable_failure' as const }));
    const jobQueueRepository = createJobQueueRepositoryMock();
    const operationRepository = createOperationRepositoryMock();
    const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

    await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(jobQueueRepository.requeueCredentialCompensationJob).toHaveBeenCalledTimes(1);
    expect(operationRepository.incrementCredentialCompensationOperationRetryCount).toHaveBeenCalledTimes(1);
    expect(operationRepository.incrementCredentialCompensationOperationRetryCount).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
    });
    expect(jobQueueRepository.markCredentialCompensationJobDeadLettered).not.toHaveBeenCalled();
    expect(jobQueueRepository.markCredentialCompensationJobManualReviewRequired).not.toHaveBeenCalled();
    expect(
      operationRepository.markFailedCredentialCompensationOperationManualReviewRequired,
    ).not.toHaveBeenCalled();
  });

  it('provider result unsafe_unknown 时 job manual review 后 operation manual review 且不 dead letter', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'unsafe_unknown' as const }));
    const jobQueueRepository = createJobQueueRepositoryMock();
    const operationRepository = createOperationRepositoryMock();
    const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

    const result = await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

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
    expect(jobQueueRepository.requeueCredentialCompensationJob).not.toHaveBeenCalled();
    expect(operationRepository.incrementCredentialCompensationOperationRetryCount).not.toHaveBeenCalled();
    expect(jobQueueRepository.markCredentialCompensationJobDeadLettered).not.toHaveBeenCalled();
    expect(
      operationRepository.markFailedCredentialCompensationOperationManualReviewRequired,
    ).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      status: 'manual_review_required',
      providerResult: 'unsafe_unknown',
    }));
  });

  it('validation_failed 输入不调用 providerExecutor 且不推进 job / operation', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'success' as const }));
    const jobQueueRepository = createJobQueueRepositoryMock();
    const operationRepository = createOperationRepositoryMock();
    const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

    const result = await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: '',
      claimVersion: 7,
      now,
    });

    expect(result).toEqual(expect.objectContaining({
      status: 'validation_failed',
      tenantId,
      connectionId,
      operationId,
    }));
    expect(providerExecutor).not.toHaveBeenCalled();
    expect(jobQueueRepository.markCredentialCompensationJobSucceeded).not.toHaveBeenCalled();
    expect(jobQueueRepository.markCredentialCompensationJobFailed).not.toHaveBeenCalled();
    expect(jobQueueRepository.markCredentialCompensationJobManualReviewRequired).not.toHaveBeenCalled();
    expect(operationRepository.markCredentialCompensationOperationSucceeded).not.toHaveBeenCalled();
    expect(operationRepository.markCredentialCompensationOperationFailed).not.toHaveBeenCalled();
    expect(operationRepository.markCredentialCompensationOperationManualReviewRequired).not.toHaveBeenCalled();
    expect(operationRepository.incrementCredentialCompensationOperationRetryCount).not.toHaveBeenCalled();
  });

  it('provider_unavailable 低于上限时接入 retry policy 并 requeue', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'provider_unavailable' as const }));
    const jobQueueRepository = createJobQueueRepositoryMock();
    const operationRepository = createOperationRepositoryMock();
    const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

    const result = await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(jobQueueRepository.markCredentialCompensationJobFailed).toHaveBeenCalled();
    expect(operationRepository.markCredentialCompensationOperationFailed).toHaveBeenCalled();
    expect(jobQueueRepository.requeueCredentialCompensationJob).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
      nextAttemptAt: retryNextAttemptAt,
    });
    expect(operationRepository.incrementCredentialCompensationOperationRetryCount).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
    });
    expect(jobQueueRepository.markCredentialCompensationJobDeadLettered).not.toHaveBeenCalled();
    expect(
      operationRepository.markFailedCredentialCompensationOperationManualReviewRequired,
    ).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      status: 'ok',
      providerResult: 'provider_unavailable',
    }));
  });

  it('retryable_failure 达到 maxRetryCount 时 dead letter 并返回 ok', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'retryable_failure' as const }));
    const jobQueueRepository = createJobQueueRepositoryMock({
      markCredentialCompensationJobFailed: vi.fn(async () => ({
        status: 'ok',
        record: {
          ...failedJob,
          retryCount: 3,
          maxRetryCount: 3,
        },
      })),
    });
    const operationRepository = createOperationRepositoryMock();
    const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

    const result = await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(operationRepository.markCredentialCompensationOperationFailed).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
    });
    expect(jobQueueRepository.markCredentialCompensationJobDeadLettered).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
      deadLetterReason: 'retry_exhausted',
    });
    expect(
      vi.mocked(jobQueueRepository.markCredentialCompensationJobFailed).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(operationRepository.markCredentialCompensationOperationFailed).mock
        .invocationCallOrder[0],
    );
    expect(
      vi.mocked(operationRepository.markCredentialCompensationOperationFailed).mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(jobQueueRepository.markCredentialCompensationJobDeadLettered).mock
        .invocationCallOrder[0],
    );
    expect(jobQueueRepository.requeueCredentialCompensationJob).not.toHaveBeenCalled();
    expect(operationRepository.incrementCredentialCompensationOperationRetryCount).not.toHaveBeenCalled();
    expect(jobQueueRepository.markCredentialCompensationJobManualReviewRequired).not.toHaveBeenCalled();
    expect(operationRepository.markCredentialCompensationOperationManualReviewRequired).not.toHaveBeenCalled();
    expect(
      operationRepository.markFailedCredentialCompensationOperationManualReviewRequired,
    ).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
    });
    expect(
      vi.mocked(jobQueueRepository.markCredentialCompensationJobDeadLettered).mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(
        operationRepository.markFailedCredentialCompensationOperationManualReviewRequired,
      ).mock.invocationCallOrder[0],
    );
    expect(result).toEqual(expect.objectContaining({
      status: 'ok',
      providerResult: 'retryable_failure',
    }));
  });

  it('provider_unavailable 达到 maxRetryCount 时 dead letter', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'provider_unavailable' as const }));
    const jobQueueRepository = createJobQueueRepositoryMock({
      markCredentialCompensationJobFailed: vi.fn(async () => ({
        status: 'ok',
        record: {
          ...failedJob,
          retryCount: 3,
          maxRetryCount: 3,
        },
      })),
    });
    const operationRepository = createOperationRepositoryMock();
    const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

    const result = await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(jobQueueRepository.markCredentialCompensationJobDeadLettered).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
      deadLetterReason: 'retry_exhausted',
    });
    expect(jobQueueRepository.requeueCredentialCompensationJob).not.toHaveBeenCalled();
    expect(operationRepository.incrementCredentialCompensationOperationRetryCount).not.toHaveBeenCalled();
    expect(jobQueueRepository.markCredentialCompensationJobManualReviewRequired).not.toHaveBeenCalled();
    expect(operationRepository.markCredentialCompensationOperationManualReviewRequired).not.toHaveBeenCalled();
    expect(
      operationRepository.markFailedCredentialCompensationOperationManualReviewRequired,
    ).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
    });
    expect(result).toEqual(expect.objectContaining({
      status: 'ok',
      providerResult: 'provider_unavailable',
    }));
  });

  for (const deadLetterStatus of [
    'repository_error',
    'conflict',
    'invalid_state_transition',
    'validation_failed',
    'not_found',
  ] as const) {
    it(`dead letter ${deadLetterStatus} 时返回稳定结果且不回滚 failed 写回`, async () => {
      const providerExecutor = vi.fn(async () => ({ status: 'retryable_failure' as const }));
      const jobQueueRepository = createJobQueueRepositoryMock({
        markCredentialCompensationJobFailed: vi.fn(async () => ({
          status: 'ok',
          record: {
            ...failedJob,
            retryCount: 3,
            maxRetryCount: 3,
          },
        })),
        markCredentialCompensationJobDeadLettered: vi.fn(async () => ({
          status: deadLetterStatus,
        })),
      });
      const operationRepository = createOperationRepositoryMock();
      const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

      const result = await worker.executeClaimedCredentialCompensationJob({
        tenantId,
        connectionId,
        operationId,
        claimId: 'claim-returned',
        claimVersion: 7,
        now,
      });

      expect(jobQueueRepository.markCredentialCompensationJobFailed).toHaveBeenCalled();
      expect(operationRepository.markCredentialCompensationOperationFailed).toHaveBeenCalledWith({
        tenantId,
        connectionId,
        operationId,
      });
      expect(jobQueueRepository.markCredentialCompensationJobDeadLettered).toHaveBeenCalledWith({
        tenantId,
        connectionId,
        operationId,
        claimId: 'claim-returned',
        claimVersion: 7,
        now,
        deadLetterReason: 'retry_exhausted',
      });
      expect(jobQueueRepository.requeueCredentialCompensationJob).not.toHaveBeenCalled();
      expect(operationRepository.incrementCredentialCompensationOperationRetryCount).not.toHaveBeenCalled();
      expect(jobQueueRepository.markCredentialCompensationJobManualReviewRequired).not.toHaveBeenCalled();
      expect(operationRepository.markCredentialCompensationOperationManualReviewRequired).not.toHaveBeenCalled();
      expect(
        operationRepository.markFailedCredentialCompensationOperationManualReviewRequired,
      ).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        status: deadLetterStatus,
        providerResult: 'retryable_failure',
      }));
      expectNoSensitiveData(result);
    });
  }

  for (const operationManualReviewStatus of [
    'repository_error',
    'invalid_state_transition',
    'not_found',
    'conflict',
    'validation_failed',
  ] as const) {
    it(`retry exhausted operation manual review ${operationManualReviewStatus} 时不回滚 dead letter`, async () => {
      const providerExecutor = vi.fn(async () => ({ status: 'retryable_failure' as const }));
      const jobQueueRepository = createJobQueueRepositoryMock({
        markCredentialCompensationJobFailed: vi.fn(async () => ({
          status: 'ok',
          record: {
            ...failedJob,
            retryCount: 3,
            maxRetryCount: 3,
          },
        })),
      });
      const operationRepository = createOperationRepositoryMock({
        markFailedCredentialCompensationOperationManualReviewRequired: vi.fn(async () => ({
          status: operationManualReviewStatus,
        })),
      });
      const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

      const result = await worker.executeClaimedCredentialCompensationJob({
        tenantId,
        connectionId,
        operationId,
        claimId: 'claim-returned',
        claimVersion: 7,
        now,
      });

      expect(jobQueueRepository.markCredentialCompensationJobDeadLettered).toHaveBeenCalledWith({
        tenantId,
        connectionId,
        operationId,
        claimId: 'claim-returned',
        claimVersion: 7,
        now,
        deadLetterReason: 'retry_exhausted',
      });
      expect(
        operationRepository.markFailedCredentialCompensationOperationManualReviewRequired,
      ).toHaveBeenCalledWith({
        tenantId,
        connectionId,
        operationId,
      });
      expect(jobQueueRepository.requeueCredentialCompensationJob).not.toHaveBeenCalled();
      expect(operationRepository.incrementCredentialCompensationOperationRetryCount).not.toHaveBeenCalled();
      expect(jobQueueRepository.markCredentialCompensationJobManualReviewRequired).not.toHaveBeenCalled();
      expect(operationRepository.markCredentialCompensationOperationManualReviewRequired).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        status: operationManualReviewStatus,
        providerResult: 'retryable_failure',
      }));
      expectNoSensitiveData(result);
    });
  }

  it('provider result validation_failed 时不 requeue', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'validation_failed' as const }));
    const jobQueueRepository = createJobQueueRepositoryMock();
    const operationRepository = createOperationRepositoryMock();
    const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

    const result = await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(jobQueueRepository.requeueCredentialCompensationJob).not.toHaveBeenCalled();
    expect(jobQueueRepository.markCredentialCompensationJobFailed).not.toHaveBeenCalled();
    expect(operationRepository.markCredentialCompensationOperationFailed).not.toHaveBeenCalled();
    expect(operationRepository.incrementCredentialCompensationOperationRetryCount).not.toHaveBeenCalled();
    expect(jobQueueRepository.markCredentialCompensationJobDeadLettered).not.toHaveBeenCalled();
    expect(
      operationRepository.markFailedCredentialCompensationOperationManualReviewRequired,
    ).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      status: 'validation_failed',
      providerResult: 'validation_failed',
    }));
  });

  it('retry policy 返回 validation_failed 时不 requeue', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'retryable_failure' as const }));
    const jobQueueRepository = createJobQueueRepositoryMock({
      markCredentialCompensationJobFailed: vi.fn(async () => ({
        status: 'ok',
        record: runningJob,
      })),
    });
    const operationRepository = createOperationRepositoryMock();
    const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

    const result = await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(jobQueueRepository.requeueCredentialCompensationJob).not.toHaveBeenCalled();
    expect(operationRepository.incrementCredentialCompensationOperationRetryCount).not.toHaveBeenCalled();
    expect(jobQueueRepository.markCredentialCompensationJobDeadLettered).not.toHaveBeenCalled();
    expect(
      operationRepository.markFailedCredentialCompensationOperationManualReviewRequired,
    ).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      status: 'validation_failed',
      providerResult: 'retryable_failure',
    }));
  });

  it('old claim requeue 被 repository 拒绝时 worker 收敛为 conflict', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'retryable_failure' as const }));
    const jobQueueRepository = createJobQueueRepositoryMock({
      requeueCredentialCompensationJob: vi.fn(async () => ({ status: 'conflict' })),
    });
    const operationRepository = createOperationRepositoryMock();
    const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

    const result = await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(jobQueueRepository.requeueCredentialCompensationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        claimId: 'claim-returned',
        claimVersion: 7,
      }),
    );
    expect(result).toEqual(expect.objectContaining({
      status: 'conflict',
      providerResult: 'retryable_failure',
    }));
    expect(operationRepository.incrementCredentialCompensationOperationRetryCount).not.toHaveBeenCalled();
  });

  it('requeue invalid_state_transition 时不调用 operation retry count', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'retryable_failure' as const }));
    const jobQueueRepository = createJobQueueRepositoryMock({
      requeueCredentialCompensationJob: vi.fn(async () => ({ status: 'invalid_state_transition' })),
    });
    const operationRepository = createOperationRepositoryMock();
    const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

    const result = await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(jobQueueRepository.requeueCredentialCompensationJob).toHaveBeenCalled();
    expect(operationRepository.incrementCredentialCompensationOperationRetryCount).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      status: 'invalid_state_transition',
      providerResult: 'retryable_failure',
    }));
  });

  it('requeue repository_error 时 worker 收敛为 repository_error', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'provider_unavailable' as const }));
    const jobQueueRepository = createJobQueueRepositoryMock({
      requeueCredentialCompensationJob: vi.fn(async () => ({ status: 'repository_error' })),
    });
    const operationRepository = createOperationRepositoryMock();
    const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

    const result = await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(result).toEqual(expect.objectContaining({
      status: 'repository_error',
      providerResult: 'provider_unavailable',
    }));
    expect(operationRepository.incrementCredentialCompensationOperationRetryCount).not.toHaveBeenCalled();
    expectNoSensitiveData(result);
  });

  it('operation retry count repository_error 时不回滚 requeue 并返回稳定结果', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'retryable_failure' as const }));
    const jobQueueRepository = createJobQueueRepositoryMock();
    const operationRepository = createOperationRepositoryMock({
      incrementCredentialCompensationOperationRetryCount: vi.fn(async () => ({
        status: 'repository_error',
      })),
    });
    const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

    const result = await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(jobQueueRepository.requeueCredentialCompensationJob).toHaveBeenCalled();
    expect(operationRepository.incrementCredentialCompensationOperationRetryCount).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
    });
    expect(jobQueueRepository.markCredentialCompensationJobDeadLettered).not.toHaveBeenCalled();
    expect(jobQueueRepository.markCredentialCompensationJobManualReviewRequired).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      status: 'repository_error',
      providerResult: 'retryable_failure',
    }));
    expectNoSensitiveData(result);
  });

  it('operation retry count invalid_state_transition 时不回滚 requeue 并返回稳定结果', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'provider_unavailable' as const }));
    const jobQueueRepository = createJobQueueRepositoryMock();
    const operationRepository = createOperationRepositoryMock({
      incrementCredentialCompensationOperationRetryCount: vi.fn(async () => ({
        status: 'invalid_state_transition',
      })),
    });
    const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

    const result = await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(jobQueueRepository.requeueCredentialCompensationJob).toHaveBeenCalled();
    expect(operationRepository.incrementCredentialCompensationOperationRetryCount).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
    });
    expect(jobQueueRepository.markCredentialCompensationJobDeadLettered).not.toHaveBeenCalled();
    expect(jobQueueRepository.markCredentialCompensationJobManualReviewRequired).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      status: 'invalid_state_transition',
      providerResult: 'provider_unavailable',
    }));
    expectNoSensitiveData(result);
  });

  for (const retryCountStatus of ['not_found', 'conflict', 'validation_failed'] as const) {
    it(`operation retry count ${retryCountStatus} 时返回稳定结果且不暴露敏感信息`, async () => {
      const providerExecutor = vi.fn(async () => ({ status: 'retryable_failure' as const }));
      const jobQueueRepository = createJobQueueRepositoryMock();
      const operationRepository = createOperationRepositoryMock({
        incrementCredentialCompensationOperationRetryCount: vi.fn(async () => ({
          status: retryCountStatus,
        })),
      });
      const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

      const result = await worker.executeClaimedCredentialCompensationJob({
        tenantId,
        connectionId,
        operationId,
        claimId: 'claim-returned',
        claimVersion: 7,
        now,
      });

      expect(jobQueueRepository.requeueCredentialCompensationJob).toHaveBeenCalled();
      expect(operationRepository.incrementCredentialCompensationOperationRetryCount).toHaveBeenCalledWith({
        tenantId,
        connectionId,
        operationId,
      });
      expect(result).toEqual(expect.objectContaining({
        status: retryCountStatus,
        providerResult: 'retryable_failure',
      }));
      expectNoSensitiveData(result);
    });
  }

  it('timeout 收口为 manual review 且不重复 provider 动作', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'timeout' as const }));
    const jobQueueRepository = createJobQueueRepositoryMock();
    const operationRepository = createOperationRepositoryMock();
    const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

    const result = await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(providerExecutor).toHaveBeenCalledTimes(1);
    expect(jobQueueRepository.markCredentialCompensationJobManualReviewRequired).toHaveBeenCalled();
    expect(operationRepository.markCredentialCompensationOperationManualReviewRequired).toHaveBeenCalled();
    expect(jobQueueRepository.requeueCredentialCompensationJob).not.toHaveBeenCalled();
    expect(jobQueueRepository.markCredentialCompensationJobDeadLettered).not.toHaveBeenCalled();
    expect(operationRepository.incrementCredentialCompensationOperationRetryCount).not.toHaveBeenCalled();
    expect(
      operationRepository.markFailedCredentialCompensationOperationManualReviewRequired,
    ).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      status: 'manual_review_required',
      providerResult: 'timeout',
    }));
  });

  it('providerExecutor 缺失时返回 validation_failed 且不使用 fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const jobQueueRepository = createJobQueueRepositoryMock();
    const operationRepository = createOperationRepositoryMock();
    const { worker } = createWorker({ jobQueueRepository, operationRepository });

    const result = await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(result).toEqual(expect.objectContaining({
      status: 'validation_failed',
      providerResult: 'validation_failed',
    }));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(jobQueueRepository.markCredentialCompensationJobSucceeded).not.toHaveBeenCalled();
    expect(operationRepository.markCredentialCompensationOperationSucceeded).not.toHaveBeenCalled();
  });

  it('providerExecutor 抛错时固定为 provider_unavailable 并走 failed 收口', async () => {
    const providerExecutor = vi.fn(async () => {
      throw new Error('SQL stack DATABASE_URL');
    });
    const jobQueueRepository = createJobQueueRepositoryMock();
    const operationRepository = createOperationRepositoryMock();
    const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

    const result = await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(jobQueueRepository.markCredentialCompensationJobFailed).toHaveBeenCalled();
    expect(operationRepository.markCredentialCompensationOperationFailed).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      status: 'ok',
      providerResult: 'provider_unavailable',
    }));
    expectNoSensitiveData(result);
  });

  it('completion 写回必须使用 claimId + claimVersion', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'success' as const }));
    const { worker, jobQueueRepository } = createWorker({ providerExecutor });

    await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(jobQueueRepository.markCredentialCompensationJobSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        claimId: 'claim-returned',
        claimVersion: 7,
      }),
    );
  });

  it('旧 claim 写回由 repository 返回 conflict 时 worker 收敛为 conflict', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'success' as const }));
    const jobQueueRepository = createJobQueueRepositoryMock({
      markCredentialCompensationJobSucceeded: vi.fn(async () => ({ status: 'conflict' })),
    });
    const operationRepository = createOperationRepositoryMock();
    const { worker } = createWorker({ jobQueueRepository, operationRepository, providerExecutor });

    const result = await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(result).toEqual(expect.objectContaining({ status: 'conflict' }));
    expect(operationRepository.markCredentialCompensationOperationSucceeded).not.toHaveBeenCalled();
  });

  it('providerExecutor 输入不含敏感字段', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'success' as const }));
    const { worker } = createWorker({ providerExecutor });

    await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    const [[executorInput]] =
      providerExecutor.mock.calls as unknown as [[
        HisConnectionCredentialCompensationProviderExecutorInput,
      ]];
    expect(Object.keys(executorInput ?? {}).sort()).toEqual([
      'claimId',
      'claimVersion',
      'connectionId',
      'now',
      'operationId',
      'tenantId',
      'workerId',
    ]);
    expect(JSON.stringify(executorInput)).not.toMatch(
      /credentialRef|secretPath|providerPath|rawPayload|requestBody|responseBody|idempotencyKey/i,
    );
  });

  it('tenant / connection / operationId 在 provider execution 全链路透传', async () => {
    const providerExecutor = vi.fn(async () => ({ status: 'retryable_failure' as const }));
    const { worker, jobQueueRepository, operationRepository } = createWorker({ providerExecutor });

    await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(providerExecutor).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      connectionId,
      operationId,
    }));
    expect(jobQueueRepository.markCredentialCompensationJobFailed).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, connectionId, operationId }),
    );
    expect(operationRepository.markCredentialCompensationOperationFailed).toHaveBeenCalledWith({
      tenantId,
      connectionId,
      operationId,
    });
  });

  it('provider execution 不调用 fetch / HTTP', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const providerExecutor = vi.fn(async () => ({ status: 'success' as const }));
    const { worker } = createWorker({ providerExecutor });

    await worker.executeClaimedCredentialCompensationJob({
      tenantId,
      connectionId,
      operationId,
      claimId: 'claim-returned',
      claimVersion: 7,
      now,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('worker 不写 audit', async () => {
    const { worker } = createWorker();

    await worker.claimDueCredentialCompensationJobs({ tenantId });

    const source = readFileSync(
      `${process.cwd()}/src/modules/institution-system/application/his-connection-credential-compensation-worker.ts`,
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
      `${process.cwd()}/src/modules/institution-system/application/his-connection-credential-compensation-worker.ts`,
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
      `${process.cwd()}/src/modules/institution-system/application/his-connection-credential-compensation-worker.ts`,
      'utf8',
    );

    expect(source).not.toMatch(/@\/server\/db\/schema|drizzle|migration/i);
  });
});
