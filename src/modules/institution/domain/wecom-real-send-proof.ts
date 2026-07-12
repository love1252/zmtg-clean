import { createHash, randomBytes } from 'node:crypto';

import type { AccessContext } from '@/modules/security/domain/access-control';

export const WE_COM_REAL_SEND_PROOF_CONFIRMATION_TTL_MS = 4 * 60 * 1000;
export const WE_COM_REAL_SEND_PROOF_MIGRATION_TARGET = '0036_v08_05b_a_single_real_send_proof_foundation';

export const weComRealSendProofStatuses = [
  'requested',
  'aborted',
  'attempted',
  'succeeded',
  'failed',
  'unknown_outcome',
] as const;

export type WeComRealSendProofStatus = (typeof weComRealSendProofStatuses)[number];
export type WeComRealSendProofScopeKind =
  | 'global'
  | 'tenant'
  | 'institution'
  | 'channel'
  | 'customer'
  | 'operator_role';
export type WeComRealSendProofProviderResultCategory =
  | 'accepted'
  | 'rejected'
  | 'transport_error'
  | 'timeout'
  | 'indeterminate';
export type WeComRealSendProofPostcheckStatus = 'ready' | 'blocked' | 'expired';

export type WeComRealSendProofOperation = {
  id: string;
  tenantId: string;
  institutionId: string;
  customerId: string;
  channelType: 'wechat_work';
  draftId: string;
  deliveryId: string;
  sourceReadyNoSendRef: string;
  sourceReadyNoSendDigest: string;
  readinessFingerprint: string;
  mappingId: string;
  consentId: string;
  frequencyStateId: string;
  dryRunSnapshotId: string;
  productionAttestationId: string;
  operationRef: string;
  contentHash: string;
  recipientBindingRef: string;
  recipientBindingDigest: string;
  status: WeComRealSendProofStatus;
  confirmationTokenDigest: string;
  confirmationIssuedAt: string;
  confirmationExpiresAt: string;
  confirmationConsumedAt: string | null;
  operatorId: string;
  sessionProvenance: 'server_session' | 'formal_session';
  requestedAt: string;
  attemptedAt: string | null;
  terminalAt: string | null;
  attemptCount: 0 | 1;
  providerResultCategory: WeComRealSendProofProviderResultCategory | null;
  completedFrequencyRef: string | null;
  version: number;
};

export type WeComRealSendProofControl = {
  id: string;
  scopeKind: WeComRealSendProofScopeKind;
  tenantId: string | null;
  institutionId: string | null;
  customerId: string | null;
  channelType: 'wechat_work' | null;
  operatorId: string | null;
  role: AccessContext['role'] | null;
  proofEnabled: boolean;
  killSwitchEngaged: boolean;
  effectiveAt: string;
  expiresAt: string;
  approvalRef: string;
  approvedBy: string;
  updatedBy: string;
  version: number;
};

export type WeComRealSendProductionAttestation = {
  id: string;
  environmentRef: string;
  databaseIdentityRef: string;
  migrationTarget: string;
  migrationHash: string;
  journalLatest: string;
  postcheckStatus: WeComRealSendProofPostcheckStatus;
  approvalRef: string;
  reviewedBy: string;
  attestedBy: string;
  attestedAt: string;
  expiresAt: string;
  version: number;
};

export type WeComRealSendRecipientBinding = {
  mappingId: string;
  mappingVersion: string | number;
  proofContactRef: string;
  proofEmployeeRef: string;
};

export type WeComRealSendReadySource = {
  tenantId: string;
  institutionId: string;
  customerId: string;
  draftId: string;
  deliveryId: string;
  approvedContent: string;
  deliveryContentSnapshot: string;
  operationRef: string;
  readyNoSendMetadata: Record<string, unknown>;
  mapping: { id: string; version: string | number; status: string; customerId: string };
  consent: { id: string; version: string | number; status: string; customerId: string };
  frequency: {
    id: string;
    version: string | number;
    customerId: string;
    lastPreparedRef: string | null;
    preparedCount: number;
    completedCount: number;
  };
  dryRunSnapshot: { id: string; version: string | number; status: string };
  recipientBinding: WeComRealSendRecipientBinding;
};

export type WeComRealSendSourceBinding = {
  sourceReadyNoSendRef: string;
  sourceReadyNoSendDigest: string;
  readinessFingerprint: string;
  contentHash: string;
  recipientBindingRef: string;
  recipientBindingDigest: string;
};

export type WeComRealSendProofFailureCode =
  | 'environment_hard_stop'
  | 'formal_session_required'
  | 'execute_once_permission_required'
  | 'institution_context_required'
  | 'ready_source_invalid'
  | 'control_missing'
  | 'control_expired'
  | 'control_not_effective'
  | 'control_time_invalid'
  | 'control_scope_mismatch'
  | 'control_disabled'
  | 'kill_switch_engaged'
  | 'control_self_approved'
  | 'attestation_missing'
  | 'attestation_mismatch'
  | 'attestation_time_invalid'
  | 'attestation_not_effective'
  | 'attestation_expired'
  | 'attestation_not_ready'
  | 'duplicate_operation'
  | 'operation_not_requested'
  | 'confirmation_expired'
  | 'confirmation_invalid'
  | 'confirmation_consumed'
  | 'operator_mismatch'
  | 'invalid_transition'
  | 'unknown_outcome_manual_review_required'
  | 'provider_outcome_not_accepted'
  | 'frequency_invariant_failed'
  | 'operation_scope_mismatch'
  | 'readiness_changed'
  | 'conflict';

function canonicalize(input: unknown): string {
  if (input === null || typeof input !== 'object') return JSON.stringify(input);
  if (Array.isArray(input)) return `[${input.map(canonicalize).join(',')}]`;
  const record = input as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(',')}}`;
}

export function createWeComRealSendProofDigest(input: unknown) {
  return createHash('sha256').update(canonicalize(input)).digest('hex');
}

export function createWeComRealSendConfirmationToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, digest: createWeComRealSendProofDigest(token) };
}

export function createWeComRealSendSourceBinding(
  source: WeComRealSendReadySource,
): WeComRealSendSourceBinding | null {
  const metadata = source.readyNoSendMetadata;
  const recipientBinding = source.recipientBinding;
  const sourceRef = typeof metadata.controlledReachOutId === 'string'
    ? metadata.controlledReachOutId
    : null;
  if (
    !sourceRef ||
    metadata.status !== 'ready_no_send' ||
    metadata.messageDraftId !== source.draftId ||
    metadata.messageDeliveryId !== source.deliveryId ||
    metadata.customerId !== source.customerId ||
    metadata.realSendEnabled !== false ||
    metadata.noRealSend !== true ||
    metadata.noRealNetwork !== true ||
    source.mapping.status !== 'confirmed' ||
    source.mapping.customerId !== source.customerId ||
    source.consent.status !== 'consented' ||
    source.consent.customerId !== source.customerId ||
    source.frequency.customerId !== source.customerId ||
    source.frequency.lastPreparedRef !== source.operationRef ||
    source.operationRef.length === 0 ||
    source.frequency.preparedCount <= source.frequency.completedCount ||
    source.dryRunSnapshot.status !== 'dry_run_ready' ||
    source.approvedContent !== source.deliveryContentSnapshot ||
    !recipientBinding ||
    recipientBinding.mappingId !== source.mapping.id ||
    String(recipientBinding.mappingVersion) !== String(source.mapping.version) ||
    typeof recipientBinding.proofContactRef !== 'string' ||
    recipientBinding.proofContactRef.length === 0 ||
    typeof recipientBinding.proofEmployeeRef !== 'string' ||
    recipientBinding.proofEmployeeRef.length === 0
  ) return null;

  const contentHash = createWeComRealSendProofDigest(source.approvedContent);
  const sourceReadyNoSendDigest = createWeComRealSendProofDigest(metadata);
  const recipientBindingDigest = createWeComRealSendProofDigest(recipientBinding);
  const recipientBindingRef = `recipient-binding-${source.mapping.id}`.slice(0, 96);
  const readinessFingerprint = createWeComRealSendProofDigest({
    tenantId: source.tenantId,
    institutionId: source.institutionId,
    customerId: source.customerId,
    draftId: source.draftId,
    deliveryId: source.deliveryId,
    mapping: { id: source.mapping.id, version: source.mapping.version },
    consent: { id: source.consent.id, version: source.consent.version },
    frequency: { id: source.frequency.id, version: source.frequency.version },
    dryRunSnapshot: { id: source.dryRunSnapshot.id, version: source.dryRunSnapshot.version },
    readyNoSendMetadataDigest: sourceReadyNoSendDigest,
    approvedDraftContentHash: contentHash,
    recipientBindingDigest,
  });

  return {
    sourceReadyNoSendRef: sourceRef,
    sourceReadyNoSendDigest,
    readinessFingerprint,
    contentHash,
    recipientBindingRef,
    recipientBindingDigest,
  };
}

export function evaluateWeComRealSendProofPermission(context: AccessContext) {
  if (context.source !== 'server_session') return { allowed: false as const, reason: 'formal_session_required' as const };
  if (context.scope !== 'tenant' || !context.tenantId || !context.institutionId) {
    return { allowed: false as const, reason: 'institution_context_required' as const };
  }
  if (context.role !== 'tenant_admin') {
    return { allowed: false as const, reason: 'execute_once_permission_required' as const };
  }
  return { allowed: true as const };
}

function controlMatches(
  control: WeComRealSendProofControl,
  scope: { tenantId: string; institutionId: string; customerId: string; operatorId: string; role: AccessContext['role'] },
) {
  const empty = (value: string | null) => value === null;
  switch (control.scopeKind) {
    case 'global':
      return empty(control.tenantId) && empty(control.institutionId) && empty(control.customerId) && empty(control.channelType) && empty(control.operatorId) && empty(control.role);
    case 'tenant':
      return control.tenantId === scope.tenantId && empty(control.institutionId) && empty(control.customerId) && empty(control.channelType) && empty(control.operatorId) && empty(control.role);
    case 'institution':
      return control.tenantId === scope.tenantId && control.institutionId === scope.institutionId && empty(control.customerId) && empty(control.channelType) && empty(control.operatorId) && empty(control.role);
    case 'channel':
      return empty(control.tenantId) && empty(control.institutionId) && empty(control.customerId) && control.channelType === 'wechat_work' && empty(control.operatorId) && empty(control.role);
    case 'customer':
      return control.tenantId === scope.tenantId && control.institutionId === scope.institutionId && control.customerId === scope.customerId && empty(control.channelType) && empty(control.operatorId) && empty(control.role);
    case 'operator_role':
      return control.tenantId === scope.tenantId && control.institutionId === scope.institutionId && empty(control.customerId) && empty(control.channelType) && control.operatorId === scope.operatorId && control.role === scope.role;
  }
}

export function evaluateRealSendProofControls(input: {
  controls: WeComRealSendProofControl[];
  scope: { tenantId: string; institutionId: string; customerId: string; operatorId: string; role: AccessContext['role'] };
  now: string;
}) {
  const now = Date.parse(input.now);
  if (!Number.isFinite(now)) {
    return { allowed: false as const, reason: 'control_time_invalid' as const };
  }
  const expectedKinds: WeComRealSendProofScopeKind[] = [
    'global', 'tenant', 'institution', 'channel', 'customer', 'operator_role',
  ];
  for (const kind of expectedKinds) {
    const candidates = input.controls.filter((control) => control.scopeKind === kind);
    if (candidates.length !== 1) return { allowed: false as const, reason: 'control_missing' as const, scopeKind: kind };
    const control = candidates[0];
    if (!controlMatches(control, input.scope)) return { allowed: false as const, reason: 'control_scope_mismatch' as const, scopeKind: kind };
    const effectiveAt = Date.parse(control.effectiveAt);
    const expiresAt = Date.parse(control.expiresAt);
    if (!Number.isFinite(effectiveAt) || !Number.isFinite(expiresAt)) {
      return { allowed: false as const, reason: 'control_time_invalid' as const, scopeKind: kind };
    }
    if (effectiveAt > now) return { allowed: false as const, reason: 'control_not_effective' as const, scopeKind: kind };
    if (expiresAt <= now) return { allowed: false as const, reason: 'control_expired' as const, scopeKind: kind };
    if (control.killSwitchEngaged) return { allowed: false as const, reason: 'kill_switch_engaged' as const, scopeKind: kind };
    if (!control.proofEnabled) return { allowed: false as const, reason: 'control_disabled' as const, scopeKind: kind };
    if (
      (kind === 'global' || kind === 'tenant' || kind === 'channel' || kind === 'operator_role') &&
      control.approvedBy === input.scope.operatorId
    ) return { allowed: false as const, reason: 'control_self_approved' as const, scopeKind: kind };
  }
  return { allowed: true as const };
}

export function evaluateProductionAttestation(input: {
  attestation: WeComRealSendProductionAttestation | null;
  expected: { environmentRef: string; databaseIdentityRef: string; migrationTarget: string; migrationHash: string; journalLatest: string };
  now: string;
}) {
  const attestation = input.attestation;
  if (!attestation) return { allowed: false as const, reason: 'attestation_missing' as const };
  if (
    attestation.environmentRef !== input.expected.environmentRef ||
    attestation.databaseIdentityRef !== input.expected.databaseIdentityRef ||
    attestation.migrationTarget !== input.expected.migrationTarget ||
    attestation.migrationHash !== input.expected.migrationHash ||
    attestation.journalLatest !== input.expected.journalLatest
  ) return { allowed: false as const, reason: 'attestation_mismatch' as const };
  const now = Date.parse(input.now);
  const attestedAt = Date.parse(attestation.attestedAt);
  const expiresAt = Date.parse(attestation.expiresAt);
  if (!Number.isFinite(now) || !Number.isFinite(attestedAt) || !Number.isFinite(expiresAt)) {
    return { allowed: false as const, reason: 'attestation_time_invalid' as const };
  }
  if (attestedAt > now) {
    return { allowed: false as const, reason: 'attestation_not_effective' as const };
  }
  if (expiresAt <= now) {
    return { allowed: false as const, reason: 'attestation_expired' as const };
  }
  if (attestation.postcheckStatus !== 'ready') {
    return { allowed: false as const, reason: 'attestation_not_ready' as const };
  }
  return { allowed: true as const };
}

export function transitionWeComRealSendProofStatus(input: {
  from: WeComRealSendProofStatus;
  to: WeComRealSendProofStatus;
  confirmationConsumed: boolean;
}) {
  const allowed =
    (input.from === 'requested' && input.to === 'aborted') ||
    (input.from === 'requested' && input.to === 'attempted' && input.confirmationConsumed) ||
    (input.from === 'attempted' && input.confirmationConsumed && ['succeeded', 'failed', 'unknown_outcome'].includes(input.to));
  if (!allowed) return { ok: false as const, reason: input.from === 'unknown_outcome' ? 'unknown_outcome_manual_review_required' as const : 'invalid_transition' as const };
  return { ok: true as const, status: input.to };
}
