import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createWeComRealSendSourceBinding,
  createWeComRealSendProofDigest,
  type WeComRealSendProofControl,
  type WeComRealSendProofOperation,
  type WeComRealSendProductionAttestation,
  type WeComRealSendReadySource,
} from '@/modules/institution/domain/wecom-real-send-proof';
import type {
  WeComRealSendProofRepository,
  WeComRealSendProofTransactionRepository,
} from '@/modules/institution/server/wecom-real-send-proof-repository';
import {
  abortRealSendProofOperation,
  consumeRealSendProofConfirmation,
  finalizeRealSendProofFailure,
  finalizeRealSendProofSuccess,
  finalizeRealSendProofUnknownOutcome,
  issueRealSendProofOperation,
} from '@/modules/institution/server/wecom-real-send-proof-service';
import type { AccessContext } from '@/modules/security/domain/access-control';
import { mintVerifiedInstitutionAuditAttributionForOrchestrationV1 } from '@/modules/audit/domain/audit-events';

const occurredAt = '2026-07-12T08:00:00.000Z';
const context: AccessContext = {
  userId: 'admin-a', role: 'tenant_admin', scope: 'tenant', tenantId: 'tenant-a', institutionId: 'inst-a', source: 'server_session',
};
const environment = {
  hardStopAllowsProof: true,
  environmentRef: 'production-ref',
  databaseIdentityRef: 'database-ref',
  migrationHash: 'a'.repeat(64),
  journalLatest: '0036_v08_05b_a_single_real_send_proof_foundation',
};
const auditAttribution = mintVerifiedInstitutionAuditAttributionForOrchestrationV1({
  formalPair: { tenantId: 'tenant-a', institutionId: 'inst-a', observedAt: occurredAt },
  businessPair: { tenantId: 'tenant-a', institutionId: 'inst-a' },
})!;
if (!auditAttribution) throw new Error('test audit attribution unavailable');

const source: WeComRealSendReadySource = {
  tenantId: 'tenant-a', institutionId: 'inst-a', customerId: 'customer-a', draftId: 'draft-a', deliveryId: 'delivery-a',
  approvedContent: '低敏已批准内容', deliveryContentSnapshot: '低敏已批准内容', operationRef: 'wrsproof-a',
  readyNoSendMetadata: {
    controlledReachOutId: 'ready-a', messageDraftId: 'draft-a', messageDeliveryId: 'delivery-a', customerId: 'customer-a',
    status: 'ready_no_send', realSendEnabled: false, noRealSend: true, noRealNetwork: true,
  },
  mapping: { id: 'mapping-a', version: 1, status: 'confirmed', customerId: 'customer-a' },
  consent: { id: 'consent-a', version: 1, status: 'consented', customerId: 'customer-a' },
  frequency: { id: 'frequency-a', version: 1, customerId: 'customer-a', lastPreparedRef: 'wrsproof-a', preparedCount: 1, completedCount: 0 },
  dryRunSnapshot: { id: 'snapshot-a', version: 1, status: 'dry_run_ready' },
  recipientBinding: {
    mappingId: 'mapping-a',
    mappingVersion: 1,
    proofContactRef: 'proof-contact-a',
    proofEmployeeRef: 'proof-employee-a',
  },
};

function controlRows(): WeComRealSendProofControl[] {
  const base = {
    tenantId: null, institutionId: null, customerId: null, channelType: null, operatorId: null, role: null,
    proofEnabled: true, killSwitchEngaged: false, effectiveAt: '2026-07-12T07:00:00.000Z', expiresAt: '2026-07-12T09:00:00.000Z',
    approvalRef: 'approval-a', approvedBy: 'reviewer-a', updatedBy: 'reviewer-a', version: 1,
  } as const;
  return [
    { ...base, id: 'global', scopeKind: 'global' },
    { ...base, id: 'tenant', scopeKind: 'tenant', tenantId: 'tenant-a' },
    { ...base, id: 'institution', scopeKind: 'institution', tenantId: 'tenant-a', institutionId: 'inst-a' },
    { ...base, id: 'channel', scopeKind: 'channel', channelType: 'wechat_work' },
    { ...base, id: 'customer', scopeKind: 'customer', tenantId: 'tenant-a', institutionId: 'inst-a', customerId: 'customer-a' },
    { ...base, id: 'operator', scopeKind: 'operator_role', tenantId: 'tenant-a', institutionId: 'inst-a', operatorId: 'admin-a', role: 'tenant_admin' },
  ] as WeComRealSendProofControl[];
}

const attestation: WeComRealSendProductionAttestation = {
  id: 'attestation-a', environmentRef: environment.environmentRef, databaseIdentityRef: environment.databaseIdentityRef,
  migrationTarget: '0036_v08_05b_a_single_real_send_proof_foundation', migrationHash: environment.migrationHash,
  journalLatest: environment.journalLatest, postcheckStatus: 'ready', approvalRef: 'approval-a', reviewedBy: 'reviewer-a', attestedBy: 'attestor-a',
  attestedAt: '2026-07-12T07:00:00.000Z', expiresAt: '2026-07-12T09:00:00.000Z', version: 1,
};

function operation(overrides: Partial<WeComRealSendProofOperation> = {}): WeComRealSendProofOperation {
  const binding = createWeComRealSendSourceBinding(source);
  if (!binding) throw new Error('invalid proof test source');
  return {
    id: 'operation-a', tenantId: 'tenant-a', institutionId: 'inst-a', customerId: 'customer-a', channelType: 'wechat_work', draftId: 'draft-a', deliveryId: 'delivery-a',
    ...binding,
    mappingId: 'mapping-a', consentId: 'consent-a', frequencyStateId: 'frequency-a', dryRunSnapshotId: 'snapshot-a', productionAttestationId: 'attestation-a',
    operationRef: 'wrsproof-a',
    status: 'requested', confirmationTokenDigest: 'e'.repeat(64), confirmationIssuedAt: '2026-07-12T07:59:00.000Z', confirmationExpiresAt: '2026-07-12T08:04:00.000Z',
    confirmationConsumedAt: null, operatorId: 'admin-a', sessionProvenance: 'server_session', requestedAt: occurredAt, attemptedAt: null, terminalAt: null,
    attemptCount: 0, providerResultCategory: null, completedFrequencyRef: null, version: 1, ...overrides,
  };
}

function dependencies() {
  let current: WeComRealSendProofOperation | null = null;
  let completedCount = 0;
  const matchesScope = (input: { tenantId: string; institutionId: string }) =>
    current?.tenantId === input.tenantId && current.institutionId === input.institutionId;
  const tx: WeComRealSendProofTransactionRepository = {
    auditAttribution,
    loadReadySource: vi.fn(async () => source),
    listControls: vi.fn(async () => controlRows()),
    findProductionAttestation: vi.fn(async () => attestation),
    findOperationBySource: vi.fn(async () => current),
    findOperationByRef: vi.fn(async (input) => matchesScope(input) ? current : null),
    createOperation: vi.fn(async (input) => {
      current = operation({
        id: input.id, operationRef: input.operationRef, confirmationTokenDigest: input.confirmationTokenDigest,
        confirmationIssuedAt: (input.confirmationIssuedAt as Date).toISOString(),
        confirmationExpiresAt: (input.confirmationExpiresAt as Date).toISOString(),
      });
      return current;
    }),
    consumeConfirmation: vi.fn(async (input) => {
      if (
        !current ||
        !matchesScope(input) ||
        current.operationRef !== input.operationRef ||
        current.confirmationTokenDigest !== input.tokenDigest ||
        current.operatorId !== input.operatorId ||
        current.status !== 'requested' ||
        current.confirmationConsumedAt ||
        Date.parse(current.confirmationIssuedAt) >= input.now.getTime() ||
        Date.parse(current.confirmationExpiresAt) <= input.now.getTime()
      ) return null;
      current = operation({ ...current, status: 'attempted', confirmationConsumedAt: input.now.toISOString(), attemptedAt: input.now.toISOString(), attemptCount: 1 });
      return current;
    }),
    abortOperation: vi.fn(async (input) => {
      current = matchesScope(input) && current?.status === 'requested'
        ? operation({ ...current, status: 'aborted', terminalAt: occurredAt })
        : null;
      return current;
    }),
    finalizeNonSuccess: vi.fn(async (input) => {
      current = matchesScope(input) && current?.status === 'attempted'
        ? operation({ ...current, status: input.status, providerResultCategory: input.providerResultCategory, terminalAt: occurredAt })
        : null;
      return current;
    }),
    lockOperation: vi.fn(async (input) => matchesScope(input) ? current : null),
    recordCompletedFrequency: vi.fn(async () => {
      completedCount += 1;
      return ({ id: 'frequency-a' }) as never;
    }),
    markSucceeded: vi.fn(async (input) => {
      if (!current || !matchesScope(input)) return null;
      current = operation({ ...current, status: 'succeeded', providerResultCategory: 'accepted', completedFrequencyRef: current.operationRef, terminalAt: occurredAt });
      return current;
    }),
    recordAudit: vi.fn(async () => undefined),
  };
  const repository: WeComRealSendProofRepository = {
    runInTransaction: vi.fn(async (_businessPair, callback) => {
      const operationSnapshot = current ? { ...current } : null;
      const completedCountSnapshot = completedCount;
      try {
        return await callback(tx);
      } catch (error) {
        current = operationSnapshot;
        completedCount = completedCountSnapshot;
        throw error;
      }
    }),
  };
  let id = 0;
  return {
    tx,
    repository,
    setOperation: (value: WeComRealSendProofOperation | null) => { current = value; },
    getState: () => ({ operation: current, completedCount }),
    createId: () => `generated-${++id}`,
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('WeComRealSendProof service', () => {
  it('签发 operation，仅返回一次 token 明文且持久化 digest', async () => {
    const deps = dependencies();
    const result = await issueRealSendProofOperation({ context, draftId: 'draft-a', environment, occurredAt, ...deps });

    expect(result).toMatchObject({ kind: 'issued', operationRef: 'wrsproof-a', idempotent: false });
    expect(deps.repository.runInTransaction).toHaveBeenCalledWith(
      { tenantId: 'tenant-a', institutionId: 'inst-a' },
      expect.any(Function),
    );
    expect(result.kind === 'issued' && result.confirmationToken).toBeTruthy();
    const insert = vi.mocked(deps.tx.createOperation).mock.calls[0][0];
    expect(insert.confirmationTokenDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(insert)).not.toContain(result.kind === 'issued' ? result.confirmationToken : 'never');
    expect(deps.tx.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: 'wecom_real_send_proof_operation_requested' }));
    expect(JSON.stringify(vi.mocked(deps.tx.recordAudit).mock.calls)).not.toMatch(
      /opaque|external_userid|userid|providerRaw|rawResponse|access_token|secret|https?:\/\//iu,
    );
    expect(JSON.stringify(vi.mocked(deps.tx.recordAudit).mock.calls))
      .not.toContain(result.kind === 'issued' ? result.confirmationToken : 'never');
  });

  it('同 draft/source 已有 operation 时幂等返回且不签发新 token', async () => {
    const deps = dependencies();
    deps.setOperation(operation());
    const result = await issueRealSendProofOperation({ context, draftId: 'draft-a', environment, occurredAt, ...deps });

    expect(result).toEqual({ kind: 'existing', operationRef: 'wrsproof-a', status: 'requested', idempotent: true });
    expect(deps.tx.createOperation).not.toHaveBeenCalled();
  });

  it('环境 hard stop、controls 空表、attestation 缺失均 fail-closed', async () => {
    const hardStop = dependencies();
    await expect(issueRealSendProofOperation({ context, draftId: 'draft-a', environment: { ...environment, hardStopAllowsProof: false }, occurredAt, ...hardStop }))
      .resolves.toMatchObject({ kind: 'failed', reason: 'environment_hard_stop' });

    const controlsMissing = dependencies();
    vi.mocked(controlsMissing.tx.listControls).mockResolvedValue([]);
    await expect(issueRealSendProofOperation({ context, draftId: 'draft-a', environment, occurredAt, ...controlsMissing }))
      .resolves.toMatchObject({ kind: 'failed', reason: 'control_missing' });

    const attestationMissing = dependencies();
    vi.mocked(attestationMissing.tx.findProductionAttestation).mockResolvedValue(null);
    await expect(issueRealSendProofOperation({ context, draftId: 'draft-a', environment, occurredAt, ...attestationMissing }))
      .resolves.toMatchObject({ kind: 'failed', reason: 'attestation_missing' });
  });

  it('demo_session 在 repository 之前被拒绝，approve 不能替代 execute_once', async () => {
    const deps = dependencies();
    const demo = { ...context, source: 'demo_session' as const };
    await expect(issueRealSendProofOperation({ context: demo, draftId: 'draft-a', environment, occurredAt, ...deps }))
      .resolves.toEqual({ kind: 'failed', reason: 'formal_session_required' });
    expect(deps.repository.runInTransaction).not.toHaveBeenCalled();
  });

  it('consume 成功进入 attempted；过期、已消费、wrong operator 均拒绝', async () => {
    const success = dependencies();
    success.setOperation(operation({
      confirmationTokenDigest: createWeComRealSendProofDigest('opaque-once'),
    }));
    await expect(consumeRealSendProofConfirmation({ context, operationRef: 'wrsproof-a', confirmationToken: 'opaque-once', environment, occurredAt, ...success }))
      .resolves.toEqual({ kind: 'attempted', operationRef: 'wrsproof-a' });
    expect(success.tx.consumeConfirmation).toHaveBeenCalledWith(expect.objectContaining({ tokenDigest: expect.stringMatching(/^[a-f0-9]{64}$/u) }));

    const wrongToken = dependencies();
    wrongToken.setOperation(operation({
      confirmationTokenDigest: createWeComRealSendProofDigest('expected-token'),
    }));
    await expect(consumeRealSendProofConfirmation({
      context,
      operationRef: 'wrsproof-a',
      confirmationToken: 'wrong-token',
      environment,
      occurredAt,
      ...wrongToken,
    })).resolves.toEqual({ kind: 'failed', reason: 'confirmation_invalid' });

    const expired = dependencies();
    expired.setOperation(operation({ confirmationExpiresAt: occurredAt }));
    await expect(consumeRealSendProofConfirmation({ context, operationRef: 'wrsproof-a', confirmationToken: 'opaque-once', environment, occurredAt, ...expired }))
      .resolves.toEqual({ kind: 'failed', reason: 'confirmation_expired' });

    const consumed = dependencies();
    consumed.setOperation(operation({ confirmationConsumedAt: occurredAt }));
    await expect(consumeRealSendProofConfirmation({ context, operationRef: 'wrsproof-a', confirmationToken: 'opaque-once', environment, occurredAt, ...consumed }))
      .resolves.toEqual({ kind: 'failed', reason: 'confirmation_consumed' });

    const wrongActor = dependencies();
    wrongActor.setOperation(operation({ operatorId: 'other-admin' }));
    await expect(consumeRealSendProofConfirmation({ context, operationRef: 'wrsproof-a', confirmationToken: 'opaque-once', environment, occurredAt, ...wrongActor }))
      .resolves.toEqual({ kind: 'failed', reason: 'operator_mismatch' });
  });

  it('token 签发后 hard stop、controls、attestation 或 readiness 变化均阻断 consume', async () => {
    const hardStop = dependencies();
    hardStop.setOperation(operation({ confirmationTokenDigest: createWeComRealSendProofDigest('token-a') }));
    await expect(consumeRealSendProofConfirmation({
      context, operationRef: 'wrsproof-a', confirmationToken: 'token-a',
      environment: { ...environment, hardStopAllowsProof: false }, occurredAt, ...hardStop,
    })).resolves.toEqual({ kind: 'failed', reason: 'environment_hard_stop' });

    const controlsChanged = dependencies();
    controlsChanged.setOperation(operation({ confirmationTokenDigest: createWeComRealSendProofDigest('token-b') }));
    vi.mocked(controlsChanged.tx.listControls).mockResolvedValue(
      controlRows().map((control) => control.scopeKind === 'customer'
        ? { ...control, killSwitchEngaged: true }
        : control),
    );
    await expect(consumeRealSendProofConfirmation({
      context, operationRef: 'wrsproof-a', confirmationToken: 'token-b', environment, occurredAt, ...controlsChanged,
    })).resolves.toEqual({ kind: 'failed', reason: 'kill_switch_engaged' });

    const attestationExpired = dependencies();
    attestationExpired.setOperation(operation({ confirmationTokenDigest: createWeComRealSendProofDigest('token-c') }));
    vi.mocked(attestationExpired.tx.findProductionAttestation).mockResolvedValue({
      ...attestation,
      expiresAt: occurredAt,
    });
    await expect(consumeRealSendProofConfirmation({
      context, operationRef: 'wrsproof-a', confirmationToken: 'token-c', environment, occurredAt, ...attestationExpired,
    })).resolves.toEqual({ kind: 'failed', reason: 'attestation_expired' });

    const contentChanged = dependencies();
    contentChanged.setOperation(operation({ confirmationTokenDigest: createWeComRealSendProofDigest('token-d') }));
    vi.mocked(contentChanged.tx.loadReadySource).mockResolvedValue({
      ...source,
      approvedContent: '变更后的批准内容',
      deliveryContentSnapshot: '变更后的批准内容',
    });
    await expect(consumeRealSendProofConfirmation({
      context, operationRef: 'wrsproof-a', confirmationToken: 'token-d', environment, occurredAt, ...contentChanged,
    })).resolves.toEqual({ kind: 'failed', reason: 'readiness_changed' });

    for (const blocked of [hardStop, controlsChanged, attestationExpired, contentChanged]) {
      expect(blocked.tx.consumeConfirmation).not.toHaveBeenCalled();
    }
  });

  it('operation consume 严格绑定 tenant 与 institution，不泄露跨机构存在性', async () => {
    const tenantMismatch = dependencies();
    tenantMismatch.setOperation(operation({ confirmationTokenDigest: createWeComRealSendProofDigest('token-a') }));
    await expect(consumeRealSendProofConfirmation({
      context: { ...context, tenantId: 'tenant-b' },
      operationRef: 'wrsproof-a', confirmationToken: 'token-a', environment, occurredAt, ...tenantMismatch,
    })).resolves.toEqual({ kind: 'failed', reason: 'confirmation_invalid' });

    const institutionMismatch = dependencies();
    institutionMismatch.setOperation(operation({ confirmationTokenDigest: createWeComRealSendProofDigest('token-b') }));
    await expect(consumeRealSendProofConfirmation({
      context: { ...context, institutionId: 'inst-b' },
      operationRef: 'wrsproof-a', confirmationToken: 'token-b', environment, occurredAt, ...institutionMismatch,
    })).resolves.toEqual({ kind: 'failed', reason: 'confirmation_invalid' });
    expect(tenantMismatch.tx.consumeConfirmation).not.toHaveBeenCalled();
    expect(institutionMismatch.tx.consumeConfirmation).not.toHaveBeenCalled();
  });

  it('abort 与 finalize 同样绑定 tenant + institution', async () => {
    const otherContext = { ...context, institutionId: 'inst-b' };

    const abortMismatch = dependencies();
    abortMismatch.setOperation(operation());
    await expect(abortRealSendProofOperation({
      context: otherContext, operationRef: 'wrsproof-a', occurredAt, ...abortMismatch,
    })).resolves.toEqual({ kind: 'failed', reason: 'operation_not_requested' });

    const successMismatch = dependencies();
    successMismatch.setOperation(operation({ status: 'attempted', confirmationConsumedAt: occurredAt, attemptedAt: occurredAt, attemptCount: 1 }));
    await expect(finalizeRealSendProofSuccess({
      context: otherContext, operationRef: 'wrsproof-a', providerOutcome: 'accepted', occurredAt, ...successMismatch,
    })).resolves.toEqual({ kind: 'failed', reason: 'conflict' });

    const failureMismatch = dependencies();
    failureMismatch.setOperation(operation({ status: 'attempted', confirmationConsumedAt: occurredAt, attemptedAt: occurredAt, attemptCount: 1 }));
    await expect(finalizeRealSendProofFailure({
      context: otherContext, operationRef: 'wrsproof-a', providerResultCategory: 'rejected', occurredAt, ...failureMismatch,
    })).resolves.toEqual({ kind: 'failed', reason: 'invalid_transition' });
  });

  it('并发 duplicate insert race 拒绝且不返回第二个 token', async () => {
    const deps = dependencies();
    vi.mocked(deps.tx.createOperation).mockResolvedValue(null);
    const result = await issueRealSendProofOperation({ context, draftId: 'draft-a', environment, occurredAt, ...deps });
    expect(result).toEqual({ kind: 'failed', reason: 'duplicate_operation' });
    expect(result).not.toHaveProperty('confirmationToken');
  });

  it('只有 attempted + accepted 才增加 completedCount，success finalize 重复幂等', async () => {
    const deps = dependencies();
    deps.setOperation(operation({ status: 'attempted', confirmationConsumedAt: occurredAt, attemptedAt: occurredAt, attemptCount: 1 }));
    await expect(finalizeRealSendProofSuccess({ context, operationRef: 'wrsproof-a', providerOutcome: 'accepted', occurredAt, ...deps }))
      .resolves.toEqual({ kind: 'succeeded', operationRef: 'wrsproof-a', idempotent: false });
    expect(deps.tx.recordCompletedFrequency).toHaveBeenCalledTimes(1);
    expect(deps.tx.markSucceeded).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deps.tx.lockOperation).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(deps.tx.recordCompletedFrequency).mock.invocationCallOrder[0]);
    expect(vi.mocked(deps.tx.recordCompletedFrequency).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(deps.tx.recordAudit).mock.invocationCallOrder[0]);

    await expect(finalizeRealSendProofSuccess({ context, operationRef: 'wrsproof-a', providerOutcome: 'accepted', occurredAt, ...deps }))
      .resolves.toEqual({ kind: 'succeeded', operationRef: 'wrsproof-a', idempotent: true });
    expect(deps.tx.recordCompletedFrequency).toHaveBeenCalledTimes(1);
  });

  it('failed、unknown、aborted 都不增加 completedCount，unknown 后不可再次 finalize success', async () => {
    const failed = dependencies();
    failed.setOperation(operation({ status: 'attempted', confirmationConsumedAt: occurredAt, attemptedAt: occurredAt, attemptCount: 1 }));
    await finalizeRealSendProofFailure({ context, operationRef: 'wrsproof-a', providerResultCategory: 'rejected', occurredAt, ...failed });
    expect(failed.tx.recordCompletedFrequency).not.toHaveBeenCalled();

    const timeoutCannotFail = dependencies();
    timeoutCannotFail.setOperation(operation({ status: 'attempted', confirmationConsumedAt: occurredAt, attemptedAt: occurredAt, attemptCount: 1 }));
    await expect(finalizeRealSendProofFailure({
      context,
      operationRef: 'wrsproof-a',
      providerResultCategory: 'timeout' as 'rejected',
      occurredAt,
      ...timeoutCannotFail,
    })).resolves.toEqual({ kind: 'failed', reason: 'conflict' });

    const unknown = dependencies();
    unknown.setOperation(operation({ status: 'attempted', confirmationConsumedAt: occurredAt, attemptedAt: occurredAt, attemptCount: 1 }));
    await finalizeRealSendProofUnknownOutcome({ context, operationRef: 'wrsproof-a', providerResultCategory: 'indeterminate', occurredAt, ...unknown });
    expect(unknown.tx.recordCompletedFrequency).not.toHaveBeenCalled();
    await expect(finalizeRealSendProofSuccess({ context, operationRef: 'wrsproof-a', providerOutcome: 'accepted', occurredAt, ...unknown }))
      .resolves.toEqual({ kind: 'failed', reason: 'unknown_outcome_manual_review_required' });

    const aborted = dependencies();
    aborted.setOperation(operation());
    await abortRealSendProofOperation({ context, operationRef: 'wrsproof-a', occurredAt, ...aborted });
    expect(aborted.tx.recordCompletedFrequency).not.toHaveBeenCalled();

    for (const category of ['transport_error', 'timeout'] as const) {
      const transportUnknown = dependencies();
      transportUnknown.setOperation(operation({ status: 'attempted', confirmationConsumedAt: occurredAt, attemptedAt: occurredAt, attemptCount: 1 }));
      await expect(finalizeRealSendProofUnknownOutcome({
        context, operationRef: 'wrsproof-a', providerResultCategory: category, occurredAt, ...transportUnknown,
      })).resolves.toEqual({ kind: 'unknown_outcome', operationRef: 'wrsproof-a' });
      expect(transportUnknown.tx.recordCompletedFrequency).not.toHaveBeenCalled();
    }
  });

  it('audit 失败向上抛出，由 transaction 回滚状态或 completedCount', async () => {
    const deps = dependencies();
    deps.setOperation(operation({ status: 'attempted', confirmationConsumedAt: occurredAt, attemptedAt: occurredAt, attemptCount: 1 }));
    vi.mocked(deps.tx.recordAudit).mockRejectedValue(new Error('audit unavailable'));

    await expect(finalizeRealSendProofSuccess({ context, operationRef: 'wrsproof-a', providerOutcome: 'accepted', occurredAt, ...deps }))
      .rejects.toThrow('audit unavailable');
    expect(deps.repository.runInTransaction).toHaveBeenCalledTimes(1);
    expect(deps.getState()).toEqual({
      operation: expect.objectContaining({ status: 'attempted', completedFrequencyRef: null }),
      completedCount: 0,
    });
  });

  it('service 全流程 fetch=0，不依赖 provider client', async () => {
    const serviceSource = readFileSync(
      join(process.cwd(), 'src/modules/institution/server/wecom-real-send-proof-service.ts'),
      'utf8',
    );
    expect(serviceSource).not.toMatch(/\bfetch\s*\(|https?:\/\/|process\.env|access_token|providerClient/iu);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const deps = dependencies();
    const issued = await issueRealSendProofOperation({ context, draftId: 'draft-a', environment, occurredAt, ...deps });
    expect(issued.kind).toBe('issued');
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
