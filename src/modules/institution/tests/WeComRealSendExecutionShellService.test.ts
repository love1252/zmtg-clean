import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  WE_COM_CUSTOMER_BROADCAST_TASK_ACCEPTANCE_KIND,
  WE_COM_CUSTOMER_BROADCAST_TASK_MESSAGE_KIND,
  type WeComCustomerBroadcastTaskProviderInput,
} from '@/modules/institution/domain/wecom-customer-broadcast-task-provider';
import type { WeComCustomerBroadcastTaskProviderAttempt } from '@/modules/institution/domain/wecom-customer-broadcast-task-outcome';
import { createWeComCustomerBroadcastTaskMockProvider } from '@/modules/institution/server/wecom-customer-broadcast-task-mock-provider';
import {
  createExplicitlyInjectedWeComCustomerBroadcastTaskRuntimeAdapter,
  createFailClosedWeComCustomerBroadcastTaskRuntimeAdapter,
} from '@/modules/institution/server/wecom-customer-broadcast-task-provider-runtime';
import type { WeComCustomerBroadcastTaskOutcomeRepository } from '@/modules/institution/server/wecom-customer-broadcast-task-outcome-repository';
import type { WeComRealSendProofRepository } from '@/modules/institution/server/wecom-real-send-proof-repository';
import type { WeComRealSendProofEnvironment } from '@/modules/institution/server/wecom-real-send-proof-service';
import {
  evaluateBroadcastTaskPreflight,
  executeInjectedBroadcastTaskForControlledWorkflow,
  executeMockBroadcastTaskForTestOnly,
  issueBroadcastTaskConfirmation,
  rejectBroadcastTaskExecutionBecauseProviderDisabled,
} from '@/modules/institution/server/wecom-real-send-execution-shell-service';
import type { AccessContext } from '@/modules/security/domain/access-control';

const context: AccessContext = {
  userId: 'admin-a',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'tenant-a',
  institutionId: 'institution-a',
  source: 'server_session',
};
const repository = {
  runInTransaction: vi.fn(),
} as unknown as WeComRealSendProofRepository;
const environment: WeComRealSendProofEnvironment = {
  hardStopAllowsProof: true,
  environmentRef: 'production-ref',
  databaseIdentityRef: 'database-ref',
  migrationHash: 'a'.repeat(64),
  journalLatest: '0036_v08_05b_a_single_real_send_proof_foundation',
};
const occurredAt = '2026-07-12T08:00:00.000Z';
const providerInput = {
  operationRef: 'operation-a',
  recipientBindingRef: 'binding-a',
  recipientBindingDigest: 'a'.repeat(64),
  recipientBindingVersion: 'version-a',
  contentRef: 'content-a',
  contentHash: 'b'.repeat(64),
  messageKind: WE_COM_CUSTOMER_BROADCAST_TASK_MESSAGE_KIND,
  acceptanceKind: WE_COM_CUSTOMER_BROADCAST_TASK_ACCEPTANCE_KIND,
} satisfies WeComCustomerBroadcastTaskProviderInput;

afterEach(() => vi.unstubAllGlobals());

describe('WeCom real-send execution shell service', () => {
  it('缺少可信 proof preflight 依赖时默认 fail-closed，且不签发 token', async () => {
    const evaluator = vi.fn();
    const result = await evaluateBroadcastTaskPreflight({
      context,
      draftId: 'draft-a',
      occurredAt,
      proofPreflightEvaluator: evaluator,
    });

    expect(result).toEqual({
      status: 'blocked',
      proofKind: 'customer_broadcast_task',
      directSend: false,
      requiresEmployeeConfirmation: true,
      reasonCode: 'proof_environment_unavailable',
    });
    expect(evaluator).not.toHaveBeenCalled();
  });

  it('显式注入的只读 evaluator 可给出 ready，但不会调用 issue service', async () => {
    const evaluator = vi.fn().mockResolvedValue({
      kind: 'ready',
      operationStatus: 'requested',
    });
    const result = await evaluateBroadcastTaskPreflight({
      context,
      draftId: 'draft-a',
      occurredAt,
      proofPreflightEvaluator: evaluator,
      proofRepository: repository,
      proofEnvironment: environment,
    });

    expect(evaluator).toHaveBeenCalledWith({
      context,
      draftId: 'draft-a',
      repository,
      environment,
      occurredAt,
    });
    expect(result).toEqual({
      status: 'ready',
      proofKind: 'customer_broadcast_task',
      directSend: false,
      requiresEmployeeConfirmation: true,
      reasonCode: 'confirmation_available',
      operationStatus: 'requested',
    });
  });

  it('demo_session 在 evaluator/repository 前 fail-closed', async () => {
    const evaluator = vi.fn();
    const result = await evaluateBroadcastTaskPreflight({
      context: { ...context, source: 'demo_session' },
      draftId: 'draft-a',
      occurredAt,
      proofPreflightEvaluator: evaluator,
      proofRepository: repository,
      proofEnvironment: environment,
    });

    expect(result).toMatchObject({ status: 'blocked', reasonCode: 'formal_session_required' });
    expect(evaluator).not.toHaveBeenCalled();
  });

  it('显式依赖齐备时委托 0036 issue，且参数不含 provider 或 recipient', async () => {
    const issueProofOperation = vi.fn().mockResolvedValue({
      kind: 'issued',
      operationRef: 'wrsproof-a',
      confirmationToken: 'opaque-token-once',
      expiresAt: '2026-07-12T08:04:00.000Z',
      idempotent: false,
    });
    const createId = vi.fn(() => 'operation-a');
    const result = await issueBroadcastTaskConfirmation({
      context,
      draftId: 'draft-a',
      occurredAt,
      createId,
      proofRepository: repository,
      proofEnvironment: environment,
      issueProofOperation,
    });

    expect(result).toMatchObject({
      kind: 'issued',
      operationRef: 'wrsproof-a',
      confirmationToken: 'opaque-token-once',
      idempotent: false,
    });
    expect(issueProofOperation).toHaveBeenCalledWith({
      context,
      draftId: 'draft-a',
      repository,
      environment,
      occurredAt,
      createId,
    });
    expect(issueProofOperation.mock.calls[0]?.[0]).not.toHaveProperty('provider');
    expect(issueProofOperation.mock.calls[0]?.[0]).not.toHaveProperty('recipient');
  });

  it('已有 operation 只返回低敏状态，不返回旧 token', async () => {
    const result = await issueBroadcastTaskConfirmation({
      context,
      draftId: 'draft-a',
      occurredAt,
      createId: () => 'operation-a',
      proofRepository: repository,
      proofEnvironment: environment,
      issueProofOperation: vi.fn().mockResolvedValue({
        kind: 'existing',
        operationRef: 'wrsproof-a',
        status: 'requested',
        idempotent: true,
      }),
    });

    expect(result).toEqual({
      kind: 'existing',
      operationRef: 'wrsproof-a',
      operationStatus: 'requested',
      idempotent: true,
    });
    expect(result).not.toHaveProperty('confirmationToken');
  });

  it('create_task_once 的 disabled 壳是纯函数，不接收或消费 token', () => {
    const result = rejectBroadcastTaskExecutionBecauseProviderDisabled({
      operationRef: 'wrsproof-a',
    });

    expect(result).toEqual({
      kind: 'blocked',
      operationRef: 'wrsproof-a',
      reasonCode: 'provider_disabled',
    });
    expect(result).not.toHaveProperty('confirmationToken');
    expect(result).not.toHaveProperty('operationStatus');
  });

  it('只有显式注入 mock provider 才得到 task_created_mock，且不写真实状态', async () => {
    const provider = createWeComCustomerBroadcastTaskMockProvider('accepted');
    const createTask = vi.fn(provider.createTask);
    const result = await executeMockBroadcastTaskForTestOnly({
      mockProvider: { ...provider, createTask },
      providerInput,
    });

    expect(createTask).toHaveBeenCalledTimes(1);
    expect(createTask).toHaveBeenCalledWith(providerInput);
    expect(result).toEqual({
      mockOnly: true,
      operationTransition: 'none',
      completedCountDelta: 0,
      automaticRetryAllowed: false,
      kind: 'task_created_mock',
      providerResultKind: 'accepted',
      acceptanceKind: 'task_created',
      requiresEmployeeConfirmation: true,
    });
    expect(result).not.toHaveProperty('status', 'succeeded');
    expect(result).not.toHaveProperty('operationStatus');
  });

  it('mock rejected 与 unknown 分类均不写 completedCount 或自动重试', async () => {
    const cases = [
      ['rejected', 'mock_rejected'],
      ['timeout', 'mock_unknown_outcome'],
      ['transport_error', 'mock_unknown_outcome'],
      ['indeterminate', 'mock_unknown_outcome'],
    ] as const;

    for (const [providerResultKind, expectedKind] of cases) {
      const provider = createWeComCustomerBroadcastTaskMockProvider(providerResultKind);
      const createTask = vi.fn(provider.createTask);
      const result = await executeMockBroadcastTaskForTestOnly({
        mockProvider: { ...provider, createTask },
        providerInput,
      });

      expect(createTask).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        mockOnly: true,
        operationTransition: 'none',
        completedCountDelta: 0,
        automaticRetryAllowed: false,
        kind: expectedKind,
        providerResultKind,
      });
      expect(result).not.toHaveProperty('status', 'succeeded');
      expect(result).not.toHaveProperty('operationStatus');
    }
  });

  it('受控执行服务默认 provider_disabled，且不进入 task_create_attempted', async () => {
    const repository = {
      findByScope: vi.fn(),
      createNotStarted: vi.fn(),
      updateWhenVersionMatches: vi.fn(),
    } satisfies WeComCustomerBroadcastTaskOutcomeRepository;
    const result = await executeInjectedBroadcastTaskForControlledWorkflow({
      runtimeAdapter: createFailClosedWeComCustomerBroadcastTaskRuntimeAdapter(),
      outcomeRepository: repository,
      outcomeScope: {
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
        customerId: 'customer-a',
        operationId: 'operation-id-a',
        operationRef: providerInput.operationRef,
      },
      providerInput,
      occurredAt,
    });

    expect(result).toEqual({
      kind: 'blocked',
      reasonCode: 'provider_disabled',
      completedCountDelta: 0,
      automaticRetryAllowed: false,
    });
    expect(repository.findByScope).not.toHaveBeenCalled();
    expect(repository.updateWhenVersionMatches).not.toHaveBeenCalled();
  });

  it('显式注入 adapter 只推进 task_created / awaiting_member_confirmation', async () => {
    let current: WeComCustomerBroadcastTaskProviderAttempt = {
      id: 'attempt-a',
      operationId: 'operation-id-a',
      operationRef: providerInput.operationRef,
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      customerId: 'customer-a',
      capabilityKind: 'customer_broadcast_task' as const,
      providerKind: 'wecom_official_customer_broadcast' as const,
      dispatchState: 'not_started' as const,
      dispatchCount: 0 as const,
      dispatchStartedAt: null,
      dispatchTerminalAt: null,
      taskRefDigest: null,
      memberConfirmationRequired: true as const,
      providerResultCategory: null,
      sendResultStatus: 'not_checked' as const,
      sendResultCheckedAt: null,
      finalizeState: 'not_finalized' as const,
      reconciliationState: 'none' as const,
      manualReviewRequired: false,
      automaticRetryAllowed: false as const,
      version: 1,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    };
    const repository = {
      findByScope: vi.fn(async () => current),
      createNotStarted: vi.fn(),
      updateWhenVersionMatches: vi.fn(async (input) => {
        if (input.expectedVersion !== current.version) return null;
        current = input.outcome;
        return current;
      }),
    } satisfies WeComCustomerBroadcastTaskOutcomeRepository;
    const result = await executeInjectedBroadcastTaskForControlledWorkflow({
      runtimeAdapter: createExplicitlyInjectedWeComCustomerBroadcastTaskRuntimeAdapter({
        fetcher: {},
        tokenProvider: { acquire: async () => ({ kind: 'available', leaseId: 'lease-a' }) },
        recipientResolver: { resolve: async () => ({ kind: 'resolved', opaqueHandle: 'handle-a' }) },
        executor: { execute: async () => ({ kind: 'task_created', taskRefDigest: 'c'.repeat(64) }) },
      }),
      outcomeRepository: repository,
      outcomeScope: {
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
        customerId: 'customer-a',
        operationId: 'operation-id-a',
        operationRef: providerInput.operationRef,
      },
      providerInput,
      occurredAt,
    });

    expect(result).toEqual({
      kind: 'task_created',
      sendResultStatus: 'awaiting_member_confirmation',
      completedCountDelta: 0,
      automaticRetryAllowed: false,
    });
    expect(current).toMatchObject({
      dispatchState: 'task_created',
      sendResultStatus: 'awaiting_member_confirmation',
      finalizeState: 'not_finalized',
      automaticRetryAllowed: false,
    });
    expect(JSON.stringify(current)).not.toContain('succeeded');
  });

  it('execution shell 不实现 provider、consume、网络或环境读取，运行时 fetch=0', async () => {
    const source = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        '../server/wecom-real-send-execution-shell-service.ts',
      ),
      'utf8',
    );
    expect(source).not.toMatch(
      /\bfetch\s*\(|consumeRealSendProofConfirmation|finalizeRealSendProofSuccess|recordCompletedFrequency|markSucceeded|markAttempted|https?:\/\/|process\.env|add_msg_template/iu,
    );

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await evaluateBroadcastTaskPreflight({ context, draftId: 'draft-a', occurredAt });
    rejectBroadcastTaskExecutionBecauseProviderDisabled({ operationRef: 'wrsproof-a' });
    await executeMockBroadcastTaskForTestOnly({
      mockProvider: createWeComCustomerBroadcastTaskMockProvider('indeterminate'),
      providerInput,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
