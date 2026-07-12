import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import {
  markManualReviewRequired,
  recordAwaitingMemberConfirmation,
  recordTargetFailed,
  recordTargetSentCandidate,
  recordTargetUnknown,
  recordTaskCreateAttempted,
  recordTaskCreateFailed,
  recordTaskCreated,
  recordTaskCreateUnknown,
  type WeComCustomerBroadcastTaskOutcomeTransition,
  type WeComCustomerBroadcastTaskProviderAttempt,
} from '@/modules/institution/domain/wecom-customer-broadcast-task-outcome';
import {
  createWeComCustomerBroadcastTaskOutcomeRepository,
  type WeComCustomerBroadcastTaskOutcomeRepository,
} from '@/modules/institution/server/wecom-customer-broadcast-task-outcome-repository';
import {
  applyWeComCustomerBroadcastTaskOutcomeAction,
  persistWeComCustomerBroadcastTaskOutcomeAction,
  type WeComCustomerBroadcastTaskOutcomeAction,
} from '@/modules/institution/server/wecom-customer-broadcast-task-outcome-service';
import type { TenantDatabase } from '@/server/db/client';

const occurredAt = '2026-07-12T08:00:00.000Z';
const later = '2026-07-12T08:01:00.000Z';
const afterLater = '2026-07-12T08:02:00.000Z';
const latest = '2026-07-12T08:03:00.000Z';

function attempt(
  overrides: Partial<WeComCustomerBroadcastTaskProviderAttempt> = {},
): WeComCustomerBroadcastTaskProviderAttempt {
  return {
    id: 'attempt-a',
    operationId: 'operation-id-a',
    operationRef: 'operation-ref-a',
    tenantId: 'tenant-a',
    institutionId: 'institution-a',
    customerId: 'customer-a',
    capabilityKind: 'customer_broadcast_task',
    providerKind: 'wecom_official_customer_broadcast',
    dispatchState: 'not_started',
    dispatchCount: 0,
    dispatchStartedAt: null,
    dispatchTerminalAt: null,
    taskRefDigest: null,
    memberConfirmationRequired: true,
    providerResultCategory: null,
    sendResultStatus: 'not_checked',
    sendResultCheckedAt: null,
    finalizeState: 'not_finalized',
    reconciliationState: 'none',
    manualReviewRequired: false,
    automaticRetryAllowed: false,
    version: 1,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    ...overrides,
  };
}

function transitioned(
  result: WeComCustomerBroadcastTaskOutcomeTransition,
): Extract<WeComCustomerBroadcastTaskOutcomeTransition, { kind: 'transitioned' }> {
  expect(result.kind).toBe('transitioned');
  if (result.kind !== 'transitioned') throw new Error(result.reason);
  return result;
}

function taskCreated() {
  const attempted = transitioned(recordTaskCreateAttempted(attempt(), occurredAt));
  return transitioned(recordTaskCreated(attempted.outcome, {
    occurredAt: later,
    taskRefDigest: 'a'.repeat(64),
  })).outcome;
}

describe('WeCom customer broadcast task outcome sidecar', () => {
  it('只允许一次 task create attempt', () => {
    const result = transitioned(recordTaskCreateAttempted(attempt(), occurredAt));

    expect(result.outcome).toMatchObject({
      dispatchState: 'task_create_attempted',
      dispatchCount: 1,
      dispatchStartedAt: occurredAt,
    });
    expect(recordTaskCreateAttempted(result.outcome, later)).toEqual({
      kind: 'blocked',
      reason: 'invalid_transition',
    });
  });

  it('task_created 只保存 digest，不代表 succeeded 或 completedCount', () => {
    const attempted = transitioned(recordTaskCreateAttempted(attempt(), occurredAt));
    const createdResult = transitioned(recordTaskCreated(attempted.outcome, {
      occurredAt: later,
      taskRefDigest: 'a'.repeat(64),
    }));
    const created = createdResult.outcome;

    expect(created).toMatchObject({
      dispatchState: 'task_created',
      taskRefDigest: 'a'.repeat(64),
      providerResultCategory: 'accepted',
      finalizeState: 'not_finalized',
    });
    expect(createdResult.completedCountDelta).toBe(0);
    expect(createdResult.targetSentCandidate).toBe(false);
    expect(createdResult.automaticRetryAllowed).toBe(false);
    const result = transitioned(recordAwaitingMemberConfirmation(created, later));
    expect(result.outcome.sendResultStatus).toBe('awaiting_member_confirmation');
    expect(result.outcome.finalizeState).toBe('not_finalized');
    expect(result.completedCountDelta).toBe(0);
    expect(result.targetSentCandidate).toBe(false);
  });

  it('拒绝非 64 位十六进制 task reference digest', () => {
    const attempted = transitioned(recordTaskCreateAttempted(attempt(), occurredAt));
    expect(recordTaskCreated(attempted.outcome, {
      occurredAt: later,
      taskRefDigest: 'raw-task-reference',
    })).toEqual({ kind: 'blocked', reason: 'invalid_task_ref_digest' });
  });

  it('target_sent 只产生候选，不直接 finalize 或增加 completedCount', () => {
    const awaiting = transitioned(
      recordAwaitingMemberConfirmation(taskCreated(), afterLater),
    ).outcome;
    const result = transitioned(recordTargetSentCandidate(awaiting, latest));

    expect(result.outcome).toMatchObject({
      sendResultStatus: 'target_sent',
      finalizeState: 'not_finalized',
    });
    expect(result.targetSentCandidate).toBe(true);
    expect(result.completedCountDelta).toBe(0);
    expect(result.automaticRetryAllowed).toBe(false);
  });

  it('target_failed 与 target_unknown 都不增加 completedCount', () => {
    const awaiting = transitioned(
      recordAwaitingMemberConfirmation(taskCreated(), afterLater),
    ).outcome;
    const failed = transitioned(recordTargetFailed(awaiting, latest));
    const unknown = transitioned(recordTargetUnknown(awaiting, latest));

    expect(failed.outcome.sendResultStatus).toBe('target_failed');
    expect(failed.completedCountDelta).toBe(0);
    expect(unknown.outcome).toMatchObject({
      sendResultStatus: 'target_unknown',
      reconciliationState: 'manual_review_required',
      manualReviewRequired: true,
    });
    expect(unknown.completedCountDelta).toBe(0);
    expect(unknown.automaticRetryAllowed).toBe(false);
  });

  it('task create failed 与 unknown 使用固定低敏分类', () => {
    const current = transitioned(recordTaskCreateAttempted(attempt(), occurredAt)).outcome;
    const failed = transitioned(recordTaskCreateFailed(current, later));
    const unknown = transitioned(recordTaskCreateUnknown(current, {
      occurredAt: later,
      providerResultCategory: 'timeout',
    }));

    expect(failed.outcome).toMatchObject({
      dispatchState: 'task_create_failed',
      providerResultCategory: 'rejected',
    });
    expect(unknown.outcome).toMatchObject({
      dispatchState: 'task_create_unknown',
      providerResultCategory: 'timeout',
      manualReviewRequired: true,
      reconciliationState: 'manual_review_required',
    });
    expect(unknown.automaticRetryAllowed).toBe(false);
  });

  it('可显式标记 manual review 且始终禁止自动重试', () => {
    const result = transitioned(markManualReviewRequired(attempt(), later));
    expect(result.outcome).toMatchObject({
      manualReviewRequired: true,
      reconciliationState: 'manual_review_required',
    });
    expect(result.automaticRetryAllowed).toBe(false);
  });

  it('拒绝早于当前 sidecar updatedAt 的倒序事件时间', () => {
    const current = attempt({ updatedAt: later });
    expect(recordTaskCreateAttempted(current, occurredAt)).toEqual({
      kind: 'blocked',
      reason: 'invalid_time',
    });
  });

  it('accepted 后 sidecar CAS 失败归为 manual review，不调用 success finalizer', async () => {
    const current = transitioned(recordTaskCreateAttempted(attempt(), occurredAt)).outcome;
    const repository = {
      findByScope: vi.fn().mockResolvedValue(current),
      createNotStarted: vi.fn(),
      updateWhenVersionMatches: vi.fn().mockRejectedValue(new Error('storage unavailable')),
    } satisfies WeComCustomerBroadcastTaskOutcomeRepository;

    const result = await persistWeComCustomerBroadcastTaskOutcomeAction({
      repository,
      scope: {
        tenantId: current.tenantId,
        institutionId: current.institutionId,
        customerId: current.customerId,
        operationId: current.operationId,
        operationRef: current.operationRef,
      },
      action: {
        action: 'record_task_created',
        occurredAt: later,
        taskRefDigest: 'b'.repeat(64),
      },
    });

    expect(result).toEqual({
      kind: 'manual_review_required',
      reason: 'persistence_unknown',
      completedCountDelta: 0,
      automaticRetryAllowed: false,
    });
  });

  it('service 仅接受闭合 action，未知 action 与非法边均阻断', () => {
    expect(applyWeComCustomerBroadcastTaskOutcomeAction(
      attempt(),
      { action: 'bypass_finalize', occurredAt } as unknown as
        WeComCustomerBroadcastTaskOutcomeAction,
    )).toEqual({ kind: 'blocked', reason: 'invalid_transition' });
    expect(applyWeComCustomerBroadcastTaskOutcomeAction(attempt(), {
      action: 'record_target_sent_candidate',
      occurredAt,
    })).toEqual({ kind: 'blocked', reason: 'invalid_transition' });
  });

  it('concrete repository 的读取绑定 scope，更新额外绑定 expectedVersion CAS', async () => {
    const current = attempt();
    const row = {
      ...current,
      dispatchStartedAt: null,
      dispatchTerminalAt: null,
      sendResultCheckedAt: null,
      createdAt: new Date(current.createdAt),
      updatedAt: new Date(current.updatedAt),
    };
    const readLimit = vi.fn().mockResolvedValue([row]);
    const readWhere = vi.fn().mockReturnValue({ limit: readLimit });
    const readFrom = vi.fn().mockReturnValue({ where: readWhere });
    const updateReturning = vi.fn().mockResolvedValue([{
      ...row,
      dispatchState: 'task_create_attempted',
      dispatchCount: 1,
      dispatchStartedAt: new Date(later),
      version: 2,
      updatedAt: new Date(later),
    }]);
    const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const database = {
      select: vi.fn().mockReturnValue({ from: readFrom }),
      update: vi.fn().mockReturnValue({ set: updateSet }),
    } as unknown as TenantDatabase;
    const repository = createWeComCustomerBroadcastTaskOutcomeRepository(database);

    await expect(repository.findByScope({
      tenantId: current.tenantId,
      institutionId: current.institutionId,
      customerId: current.customerId,
      operationId: current.operationId,
      operationRef: current.operationRef,
    })).resolves.toMatchObject({ id: current.id, version: 1 });
    expect(readLimit).toHaveBeenCalledWith(1);

    const next = transitioned(recordTaskCreateAttempted(current, later)).outcome;
    await expect(repository.updateWhenVersionMatches({
      tenantId: current.tenantId,
      institutionId: current.institutionId,
      customerId: current.customerId,
      operationId: current.operationId,
      operationRef: current.operationRef,
      expectedVersion: current.version,
      outcome: next,
    })).resolves.toMatchObject({
      dispatchState: 'task_create_attempted',
      dispatchCount: 1,
      version: 2,
    });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      automaticRetryAllowed: false,
      version: 2,
    }));
    expect(updateWhere).toHaveBeenCalledTimes(1);
  });

  it('concrete repository 只创建 scoped not_started sidecar', async () => {
    const current = attempt();
    const row = {
      ...current,
      dispatchStartedAt: null,
      dispatchTerminalAt: null,
      sendResultCheckedAt: null,
      createdAt: new Date(current.createdAt),
      updatedAt: new Date(current.updatedAt),
    };
    const returning = vi.fn().mockResolvedValue([row]);
    const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    const database = {
      insert: vi.fn().mockReturnValue({ values }),
    } as unknown as TenantDatabase;
    const repository = createWeComCustomerBroadcastTaskOutcomeRepository(database);

    await expect(repository.createNotStarted({
      id: current.id,
      operationId: current.operationId,
      operationRef: current.operationRef,
      tenantId: current.tenantId,
      institutionId: current.institutionId,
      customerId: current.customerId,
      occurredAt: current.createdAt,
    })).resolves.toMatchObject({
      dispatchState: 'not_started',
      dispatchCount: 0,
      automaticRetryAllowed: false,
      version: 1,
    });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      operationId: current.operationId,
      operationRef: current.operationRef,
      tenantId: current.tenantId,
      institutionId: current.institutionId,
      customerId: current.customerId,
      dispatchState: 'not_started',
      dispatchCount: 0,
      automaticRetryAllowed: false,
    }));
    expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
  });

  it('concrete repository 在 outcome scope/version 不匹配时不发出 update', async () => {
    const update = vi.fn();
    const repository = createWeComCustomerBroadcastTaskOutcomeRepository({
      update,
    } as unknown as TenantDatabase);
    const current = attempt();
    const next = transitioned(recordTaskCreateAttempted(current, later)).outcome;

    await expect(repository.updateWhenVersionMatches({
      tenantId: current.tenantId,
      institutionId: current.institutionId,
      customerId: current.customerId,
      operationId: current.operationId,
      operationRef: current.operationRef,
      expectedVersion: 99,
      outcome: next,
    })).resolves.toBeNull();
    await expect(repository.updateWhenVersionMatches({
      tenantId: current.tenantId,
      institutionId: current.institutionId,
      customerId: current.customerId,
      operationId: current.operationId,
      operationRef: current.operationRef,
      expectedVersion: current.version,
      outcome: { ...next, finalizeState: 'success_recorded' },
    })).resolves.toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it('outcome domain/service 不包含 provider、网络、敏感原文或 finalizer', () => {
    const source = [
      '../domain/wecom-customer-broadcast-task-outcome.ts',
      '../server/wecom-customer-broadcast-task-outcome-repository.ts',
      '../server/wecom-customer-broadcast-task-outcome-service.ts',
    ].map((path) => readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), path),
      'utf8',
    )).join('\n');

    expect(source).not.toMatch(
      /\bfetch\s*\(|process\.env|finalizeRealSendProofSuccess|consumeRealSendProofConfirmation|wecom-real-send-execution-shell-service|wecom-customer-broadcast-task-provider|external_userid|\bUserID\b|access_token|rawResponse|rawMsgid|providerUrl|messageContent|recipientValue/iu,
    );
    expect(source).not.toMatch(/\binput\.transition\b|OutcomeTransitioner/u);
    expect(source).toMatch(
      /tenantId[\s\S]*institutionId[\s\S]*operationRef[\s\S]*expectedVersion/u,
    );
    expect(source).toMatch(
      /weComCustomerBroadcastTaskProviderAttempts\.finalizeState,[\s\S]*'not_finalized'/u,
    );
  });
});
