import {
  createAuditEvent,
  createVerifiedInstitutionAttributedTenantAuditEventV1,
} from '@/modules/audit/domain/audit-events';
import {
  createWeComRealSendConfirmationToken,
  createWeComRealSendProofDigest,
  createWeComRealSendSourceBinding,
  evaluateProductionAttestation,
  evaluateRealSendProofControls,
  evaluateWeComRealSendProofPermission,
  transitionWeComRealSendProofStatus,
  WE_COM_REAL_SEND_PROOF_CONFIRMATION_TTL_MS,
  WE_COM_REAL_SEND_PROOF_MIGRATION_TARGET,
  type WeComRealSendProofFailureCode,
  type WeComRealSendProofOperation,
  type WeComRealSendProofProviderResultCategory,
  type WeComRealSendProductionAttestation,
  type WeComRealSendReadySource,
  type WeComRealSendSourceBinding,
} from '@/modules/institution/domain/wecom-real-send-proof';
import type {
  WeComRealSendProofRepository,
  WeComRealSendProofTransactionRepository,
} from '@/modules/institution/server/wecom-real-send-proof-repository';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';

export type WeComRealSendProofEnvironment = {
  hardStopAllowsProof: boolean;
  environmentRef: string;
  databaseIdentityRef: string;
  migrationHash: string;
  journalLatest: string;
};

type RealSendProofContext = AccessContext & {
  tenantId: string;
  institutionId: string;
  source: 'server_session';
};

type ServiceFailure = { kind: 'failed'; reason: WeComRealSendProofFailureCode };

export class WeComRealSendProofTransactionAbort extends Error {
  constructor(readonly reason: WeComRealSendProofFailureCode) {
    super(`wecom_real_send_proof_transaction_abort:${reason}`);
    this.name = 'WeComRealSendProofTransactionAbort';
  }
}

function validateContext(context: AccessContext):
  | { ok: true; context: RealSendProofContext }
  | { ok: false; reason: WeComRealSendProofFailureCode } {
  const permission = evaluateWeComRealSendProofPermission(context);
  if (!permission.allowed) return { ok: false, reason: permission.reason };
  const access = canAccessResource({
    context,
    resource: 'real_channel',
    action: 'execute_once',
    targetTenantId: context.tenantId,
  });
  if (!access.allowed) return { ok: false, reason: 'execute_once_permission_required' };
  return { ok: true, context: context as RealSendProofContext };
}

function audit(
  repository: Pick<WeComRealSendProofTransactionRepository, 'auditAttribution'>,
  input: {
  context: RealSendProofContext;
  createId: () => string;
  operationRef: string;
  occurredAt: string;
  result: 'denied' | 'transitioned';
  reason:
    | 'wecom_real_send_proof_operation_requested'
    | 'wecom_real_send_proof_operation_aborted'
    | 'wecom_real_send_proof_operation_attempted'
    | 'wecom_real_send_proof_operation_succeeded'
    | 'wecom_real_send_proof_operation_failed'
    | 'wecom_real_send_proof_operation_unknown'
    | 'wecom_real_send_proof_control_blocked'
    | 'wecom_real_send_proof_environment_blocked'
    | 'wecom_real_send_proof_ready_source_blocked'
    | 'wecom_real_send_proof_attestation_blocked'
    | 'wecom_real_send_proof_readiness_changed'
    | 'wecom_real_send_proof_confirmation_consumed'
    | 'wecom_real_send_proof_confirmation_expired'
    | 'wecom_real_send_proof_completed_count_recorded';
  },
) {
  const event = createVerifiedInstitutionAttributedTenantAuditEventV1({
    event: createAuditEvent({
      eventId: input.createId(),
      context: input.context,
      resource: 'real_channel',
      resourceId: input.operationRef,
      action: 'execute_once',
      result: input.result,
      reason: input.reason,
      occurredAt: input.occurredAt,
    }),
    attribution: repository.auditAttribution,
  });
  if (!event) throw new Error('invalid_wecom_real_send_audit_attribution');
  return event;
}

function runInAttributedTransaction<T>(
  repository: WeComRealSendProofRepository,
  context: RealSendProofContext,
  operation: (repository: WeComRealSendProofTransactionRepository) => Promise<T>,
): Promise<T> {
  return repository.runInTransaction(
    { tenantId: context.tenantId, institutionId: context.institutionId },
    operation,
  );
}

async function evaluateIssueGates(input: {
  context: RealSendProofContext;
  draftId: string;
  repository: WeComRealSendProofTransactionRepository;
  environment: WeComRealSendProofEnvironment;
  occurredAt: string;
}) {
  if (!input.environment.hardStopAllowsProof) {
    return {
      ok: false as const,
      reason: 'environment_hard_stop' as const,
      auditReason: 'wecom_real_send_proof_environment_blocked' as const,
    };
  }
  const source = await input.repository.loadReadySource({
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId,
    draftId: input.draftId,
  });
  if (!source) return {
    ok: false as const,
    reason: 'ready_source_invalid' as const,
    auditReason: 'wecom_real_send_proof_ready_source_blocked' as const,
  };
  const binding = createWeComRealSendSourceBinding(source);
  if (!binding) return {
    ok: false as const,
    reason: 'ready_source_invalid' as const,
    auditReason: 'wecom_real_send_proof_ready_source_blocked' as const,
  };

  const controls = await input.repository.listControls({
    tenantId: source.tenantId,
    institutionId: source.institutionId,
    customerId: source.customerId,
    operatorId: input.context.userId,
    role: input.context.role,
  });
  const controlsDecision = evaluateRealSendProofControls({
    controls,
    scope: {
      tenantId: source.tenantId,
      institutionId: source.institutionId,
      customerId: source.customerId,
      operatorId: input.context.userId,
      role: input.context.role,
    },
    now: input.occurredAt,
  });
  if (!controlsDecision.allowed) return {
    ok: false as const,
    reason: controlsDecision.reason,
    auditReason: 'wecom_real_send_proof_control_blocked' as const,
  };

  const attestation = await input.repository.findProductionAttestation({
    environmentRef: input.environment.environmentRef,
    databaseIdentityRef: input.environment.databaseIdentityRef,
    migrationTarget: WE_COM_REAL_SEND_PROOF_MIGRATION_TARGET,
  });
  const attestationDecision = evaluateProductionAttestation({
    attestation,
    expected: {
      environmentRef: input.environment.environmentRef,
      databaseIdentityRef: input.environment.databaseIdentityRef,
      migrationTarget: WE_COM_REAL_SEND_PROOF_MIGRATION_TARGET,
      migrationHash: input.environment.migrationHash,
      journalLatest: input.environment.journalLatest,
    },
    now: input.occurredAt,
  });
  if (!attestationDecision.allowed) return {
    ok: false as const,
    reason: attestationDecision.reason,
    auditReason: 'wecom_real_send_proof_attestation_blocked' as const,
  };

  return { ok: true as const, source, binding, attestation };
}

function operationMatchesCurrentProof(
  operation: WeComRealSendProofOperation,
  current: {
    source: WeComRealSendReadySource;
    binding: WeComRealSendSourceBinding;
    attestation: WeComRealSendProductionAttestation | null;
  },
) {
  return Boolean(
    current.attestation &&
    operation.tenantId === current.source.tenantId &&
    operation.institutionId === current.source.institutionId &&
    operation.customerId === current.source.customerId &&
    operation.draftId === current.source.draftId &&
    operation.deliveryId === current.source.deliveryId &&
    operation.operationRef === current.source.operationRef &&
    operation.mappingId === current.source.mapping.id &&
    operation.consentId === current.source.consent.id &&
    operation.frequencyStateId === current.source.frequency.id &&
    operation.dryRunSnapshotId === current.source.dryRunSnapshot.id &&
    operation.productionAttestationId === current.attestation.id &&
    operation.sourceReadyNoSendRef === current.binding.sourceReadyNoSendRef &&
    operation.sourceReadyNoSendDigest === current.binding.sourceReadyNoSendDigest &&
    operation.readinessFingerprint === current.binding.readinessFingerprint &&
    operation.contentHash === current.binding.contentHash &&
    operation.recipientBindingRef === current.binding.recipientBindingRef &&
    operation.recipientBindingDigest === current.binding.recipientBindingDigest
  );
}

export async function issueRealSendProofOperation(input: {
  context: AccessContext;
  draftId: string;
  repository: WeComRealSendProofRepository;
  environment: WeComRealSendProofEnvironment;
  occurredAt: string;
  createId: () => string;
}): Promise<
  | { kind: 'issued'; operationRef: string; confirmationToken: string; expiresAt: string; idempotent: false }
  | { kind: 'existing'; operationRef: string; status: string; idempotent: true }
  | ServiceFailure
> {
  const context = validateContext(input.context);
  if (!context.ok) return { kind: 'failed', reason: context.reason };

  return runInAttributedTransaction(input.repository, context.context, async (repository) => {
    const gates = await evaluateIssueGates({
      context: context.context,
      draftId: input.draftId,
      repository,
      environment: input.environment,
      occurredAt: input.occurredAt,
    });
    if (!gates.ok) {
      await repository.recordAudit(audit(repository, {
        context: context.context,
        createId: input.createId,
        operationRef: `draft-${input.draftId}`.slice(0, 96),
        occurredAt: input.occurredAt,
        result: 'denied',
        reason: gates.auditReason,
      }));
      return { kind: 'failed' as const, reason: gates.reason };
    }

    const existing = await repository.findOperationBySource({
      tenantId: gates.source.tenantId,
      institutionId: gates.source.institutionId,
      draftId: gates.source.draftId,
      sourceReadyNoSendRef: gates.binding.sourceReadyNoSendRef,
    });
    if (existing) {
      return { kind: 'existing' as const, operationRef: existing.operationRef, status: existing.status, idempotent: true as const };
    }

    const operationRef = gates.source.operationRef;
    const token = createWeComRealSendConfirmationToken();
    const issuedAt = new Date(input.occurredAt);
    const expiresAt = new Date(issuedAt.getTime() + WE_COM_REAL_SEND_PROOF_CONFIRMATION_TTL_MS);
    const created = await repository.createOperation({
      id: input.createId(),
      tenantId: gates.source.tenantId,
      institutionId: gates.source.institutionId,
      customerId: gates.source.customerId,
      channelType: 'wechat_work',
      draftId: gates.source.draftId,
      deliveryId: gates.source.deliveryId,
      ...gates.binding,
      mappingId: gates.source.mapping.id,
      consentId: gates.source.consent.id,
      frequencyStateId: gates.source.frequency.id,
      dryRunSnapshotId: gates.source.dryRunSnapshot.id,
      productionAttestationId: gates.attestation!.id,
      operationRef,
      confirmationTokenDigest: token.digest,
      confirmationIssuedAt: issuedAt,
      confirmationExpiresAt: expiresAt,
      operatorId: context.context.userId,
      sessionProvenance: context.context.source,
      requestedAt: issuedAt,
    });
    if (!created) return { kind: 'failed' as const, reason: 'duplicate_operation' as const };

    await repository.recordAudit(audit(repository, {
      context: context.context,
      createId: input.createId,
      operationRef,
      occurredAt: input.occurredAt,
      result: 'transitioned',
      reason: 'wecom_real_send_proof_operation_requested',
    }));
    return {
      kind: 'issued' as const,
      operationRef,
      confirmationToken: token.token,
      expiresAt: expiresAt.toISOString(),
      idempotent: false as const,
    };
  });
}

export async function consumeRealSendProofConfirmation(input: {
  context: AccessContext;
  operationRef: string;
  confirmationToken: string;
  repository: WeComRealSendProofRepository;
  environment: WeComRealSendProofEnvironment;
  occurredAt: string;
  createId: () => string;
}): Promise<{ kind: 'attempted'; operationRef: string } | ServiceFailure> {
  const context = validateContext(input.context);
  if (!context.ok) return { kind: 'failed', reason: context.reason };

  return runInAttributedTransaction(input.repository, context.context, async (repository) => {
    const before = await repository.lockOperation({
      tenantId: context.context.tenantId,
      institutionId: context.context.institutionId,
      operationRef: input.operationRef,
    });
    if (!before) return { kind: 'failed' as const, reason: 'confirmation_invalid' as const };
    if (
      before.tenantId !== context.context.tenantId ||
      before.institutionId !== context.context.institutionId
    ) return { kind: 'failed' as const, reason: 'operation_scope_mismatch' as const };
    if (before.operatorId !== context.context.userId) return { kind: 'failed' as const, reason: 'operator_mismatch' as const };
    if (before.confirmationConsumedAt) return { kind: 'failed' as const, reason: 'confirmation_consumed' as const };
    const occurredAt = Date.parse(input.occurredAt);
    const issuedAt = Date.parse(before.confirmationIssuedAt);
    const expiresAt = Date.parse(before.confirmationExpiresAt);
    if (!Number.isFinite(occurredAt) || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) {
      return { kind: 'failed' as const, reason: 'confirmation_invalid' as const };
    }
    if (expiresAt <= occurredAt) {
      await repository.recordAudit(audit(repository, {
        context: context.context,
        createId: input.createId,
        operationRef: input.operationRef,
        occurredAt: input.occurredAt,
        result: 'denied',
        reason: 'wecom_real_send_proof_confirmation_expired',
      }));
      return { kind: 'failed' as const, reason: 'confirmation_expired' as const };
    }
    if (occurredAt <= issuedAt) {
      return { kind: 'failed' as const, reason: 'confirmation_invalid' as const };
    }

    const gates = await evaluateIssueGates({
      context: context.context,
      draftId: before.draftId,
      repository,
      environment: input.environment,
      occurredAt: input.occurredAt,
    });
    if (!gates.ok) {
      await repository.recordAudit(audit(repository, {
        context: context.context,
        createId: input.createId,
        operationRef: input.operationRef,
        occurredAt: input.occurredAt,
        result: 'denied',
        reason: gates.auditReason,
      }));
      return { kind: 'failed' as const, reason: gates.reason };
    }
    if (!operationMatchesCurrentProof(before, gates)) {
      await repository.recordAudit(audit(repository, {
        context: context.context,
        createId: input.createId,
        operationRef: input.operationRef,
        occurredAt: input.occurredAt,
        result: 'denied',
        reason: 'wecom_real_send_proof_readiness_changed',
      }));
      return { kind: 'failed' as const, reason: 'readiness_changed' as const };
    }
    const transition = transitionWeComRealSendProofStatus({
      from: before.status,
      to: 'attempted',
      confirmationConsumed: true,
    });
    if (!transition.ok) return { kind: 'failed' as const, reason: transition.reason };

    const consumed = await repository.consumeConfirmation({
      operationRef: input.operationRef,
      tenantId: context.context.tenantId,
      institutionId: context.context.institutionId,
      tokenDigest: createWeComRealSendProofDigest(input.confirmationToken),
      operatorId: context.context.userId,
      now: new Date(input.occurredAt),
    });
    if (!consumed) return { kind: 'failed' as const, reason: 'confirmation_invalid' as const };
    await repository.recordAudit(audit(repository, {
      context: context.context,
      createId: input.createId,
      operationRef: input.operationRef,
      occurredAt: input.occurredAt,
      result: 'transitioned',
      reason: 'wecom_real_send_proof_confirmation_consumed',
    }));
    await repository.recordAudit(audit(repository, {
      context: context.context,
      createId: input.createId,
      operationRef: input.operationRef,
      occurredAt: input.occurredAt,
      result: 'transitioned',
      reason: 'wecom_real_send_proof_operation_attempted',
    }));
    return { kind: 'attempted' as const, operationRef: consumed.operationRef };
  });
}

export async function abortRealSendProofOperation(input: {
  context: AccessContext;
  operationRef: string;
  repository: WeComRealSendProofRepository;
  occurredAt: string;
  createId: () => string;
}): Promise<{ kind: 'aborted'; operationRef: string } | ServiceFailure> {
  const context = validateContext(input.context);
  if (!context.ok) return { kind: 'failed', reason: context.reason };
  return runInAttributedTransaction(input.repository, context.context, async (repository) => {
    const operation = await repository.abortOperation({
      operationRef: input.operationRef,
      tenantId: context.context.tenantId,
      institutionId: context.context.institutionId,
      operatorId: context.context.userId,
      now: new Date(input.occurredAt),
    });
    if (!operation) return { kind: 'failed' as const, reason: 'operation_not_requested' as const };
    await repository.recordAudit(audit(repository, {
      context: context.context,
      createId: input.createId,
      operationRef: input.operationRef,
      occurredAt: input.occurredAt,
      result: 'transitioned',
      reason: 'wecom_real_send_proof_operation_aborted',
    }));
    return { kind: 'aborted' as const, operationRef: operation.operationRef };
  });
}

export async function finalizeRealSendProofSuccess(input: {
  context: AccessContext;
  operationRef: string;
  providerOutcome: 'accepted';
  repository: WeComRealSendProofRepository;
  occurredAt: string;
  createId: () => string;
}): Promise<{ kind: 'succeeded'; operationRef: string; idempotent: boolean } | ServiceFailure> {
  const context = validateContext(input.context);
  if (!context.ok) return { kind: 'failed', reason: context.reason };
  if (input.providerOutcome !== 'accepted') return { kind: 'failed', reason: 'provider_outcome_not_accepted' };

  return runInAttributedTransaction(input.repository, context.context, async (repository) => {
    const operation = await repository.lockOperation({
      tenantId: context.context.tenantId,
      institutionId: context.context.institutionId,
      operationRef: input.operationRef,
    });
    if (!operation) return { kind: 'failed' as const, reason: 'conflict' as const };
    if (operation.operatorId !== context.context.userId) return { kind: 'failed' as const, reason: 'operator_mismatch' as const };
    if (operation.status === 'succeeded') {
      return { kind: 'succeeded' as const, operationRef: operation.operationRef, idempotent: true as const };
    }
    const transition = transitionWeComRealSendProofStatus({
      from: operation.status,
      to: 'succeeded',
      confirmationConsumed: Boolean(operation.confirmationConsumedAt),
    });
    if (!transition.ok) return { kind: 'failed' as const, reason: transition.reason };

    const completed = await repository.recordCompletedFrequency({
      operation,
      now: new Date(input.occurredAt),
    });
    if (!completed) throw new WeComRealSendProofTransactionAbort('frequency_invariant_failed');
    const succeeded = await repository.markSucceeded({
      operationRef: operation.operationRef,
      tenantId: context.context.tenantId,
      institutionId: context.context.institutionId,
      operatorId: context.context.userId,
      completedFrequencyRef: operation.operationRef,
      now: new Date(input.occurredAt),
    });
    if (!succeeded) throw new WeComRealSendProofTransactionAbort('conflict');

    await repository.recordAudit(audit(repository, {
      context: context.context,
      createId: input.createId,
      operationRef: input.operationRef,
      occurredAt: input.occurredAt,
      result: 'transitioned',
      reason: 'wecom_real_send_proof_completed_count_recorded',
    }));
    await repository.recordAudit(audit(repository, {
      context: context.context,
      createId: input.createId,
      operationRef: input.operationRef,
      occurredAt: input.occurredAt,
      result: 'transitioned',
      reason: 'wecom_real_send_proof_operation_succeeded',
    }));
    return { kind: 'succeeded' as const, operationRef: succeeded.operationRef, idempotent: false as const };
  });
}

async function finalizeNonSuccess(input: {
  context: AccessContext;
  operationRef: string;
  repository: WeComRealSendProofRepository;
  occurredAt: string;
  createId: () => string;
  status: 'failed' | 'unknown_outcome';
  providerResultCategory: Exclude<WeComRealSendProofProviderResultCategory, 'accepted'>;
}) {
  const context = validateContext(input.context);
  if (!context.ok) return { kind: 'failed' as const, reason: context.reason };
  const validCategory = input.status === 'unknown_outcome'
    ? ['transport_error', 'timeout', 'indeterminate'].includes(input.providerResultCategory)
    : input.providerResultCategory === 'rejected';
  if (!validCategory) return { kind: 'failed' as const, reason: 'conflict' as const };

  return runInAttributedTransaction(input.repository, context.context, async (repository) => {
    const operation = await repository.finalizeNonSuccess({
      operationRef: input.operationRef,
      tenantId: context.context.tenantId,
      institutionId: context.context.institutionId,
      operatorId: context.context.userId,
      status: input.status,
      providerResultCategory: input.providerResultCategory as 'rejected' | 'transport_error' | 'timeout' | 'indeterminate',
      now: new Date(input.occurredAt),
    });
    if (!operation) return { kind: 'failed' as const, reason: 'invalid_transition' as const };
    await repository.recordAudit(audit(repository, {
      context: context.context,
      createId: input.createId,
      operationRef: input.operationRef,
      occurredAt: input.occurredAt,
      result: 'transitioned',
      reason: input.status === 'failed'
        ? 'wecom_real_send_proof_operation_failed'
        : 'wecom_real_send_proof_operation_unknown',
    }));
    return { kind: input.status, operationRef: operation.operationRef } as const;
  });
}

export function finalizeRealSendProofFailure(input: {
  context: AccessContext;
  operationRef: string;
  providerResultCategory: 'rejected';
  repository: WeComRealSendProofRepository;
  occurredAt: string;
  createId: () => string;
}) {
  return finalizeNonSuccess({ ...input, status: 'failed' });
}

export function finalizeRealSendProofUnknownOutcome(input: {
  context: AccessContext;
  operationRef: string;
  providerResultCategory: 'transport_error' | 'timeout' | 'indeterminate';
  repository: WeComRealSendProofRepository;
  occurredAt: string;
  createId: () => string;
}) {
  return finalizeNonSuccess({ ...input, status: 'unknown_outcome' });
}
