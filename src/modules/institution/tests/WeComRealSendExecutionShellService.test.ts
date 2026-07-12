import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WeComRealSendProofRepository } from '@/modules/institution/server/wecom-real-send-proof-repository';
import type { WeComRealSendProofEnvironment } from '@/modules/institution/server/wecom-real-send-proof-service';
import {
  evaluateBroadcastTaskPreflight,
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

  it('execution shell 不实现 provider、consume、网络或环境读取，运行时 fetch=0', async () => {
    const source = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        '../server/wecom-real-send-execution-shell-service.ts',
      ),
      'utf8',
    );
    expect(source).not.toMatch(
      /\bfetch\s*\(|consumeRealSendProofConfirmation|https?:\/\/|process\.env|add_msg_template/iu,
    );

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await evaluateBroadcastTaskPreflight({ context, draftId: 'draft-a', occurredAt });
    rejectBroadcastTaskExecutionBecauseProviderDisabled({ operationRef: 'wrsproof-a' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
