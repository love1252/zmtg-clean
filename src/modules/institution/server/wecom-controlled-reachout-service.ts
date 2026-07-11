import type { AuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  createWeComControlledReachOutBoundary,
  createWeComControlledReachOutMetadata,
  createWeComControlledReachOutOperationRef,
  failureCodeFromConsent,
  isEligibleControlledReachOutMockDelivery,
  readWeComControlledReachOutMetadata,
  summarizeControlledReachOutDryRun,
  summarizeControlledReachOutFrequency,
  WE_COM_CONTROLLED_REACH_OUT_PROOF_CONTACT_ID,
  type WeComControlledReachOutFailureCode,
  type WeComControlledReachOutPreflight,
} from '@/modules/institution/domain/wecom-controlled-reachout';
import type { FollowUpMessageDraft } from '@/modules/institution/domain/followup-message-drafts';
import type { MessageDelivery } from '@/modules/institution/domain/followup-message-deliveries';
import type { TenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import {
  reservePreparedAttempt,
} from '@/modules/institution/server/trusted-reachout-safety-service';
import type { TrustedReachOutSafetyRepository } from '@/modules/institution/server/trusted-reachout-safety-repository';
import type {
  WeComCustomerMappingRepository,
  WeComCustomerMappingState,
} from '@/modules/institution/server/wecom-customer-mapping-repository';
import type { AccessContext } from '@/modules/security/domain/access-control';

export type WeComControlledReachOutRepository = Pick<
  TenantBusinessRepository,
  | 'getFollowUpMessageDraftByTenantAndInstitution'
  | 'listMessageDeliveriesForDraft'
  | 'getCustomerByTenantAndInstitution'
  | 'updateFollowUpMessageDraftControlledReachOut'
>;

export type WeComControlledReachOutMappingRepository = Pick<
  WeComCustomerMappingRepository,
  'findByScope' | 'findByScopeForUpdate'
>;

export type WeComControlledReachOutSafetyRepository = Pick<
  TrustedReachOutSafetyRepository,
  | 'findConsent'
  | 'findConsentForUpdate'
  | 'findFrequency'
  | 'createFrequencyIfAbsent'
  | 'updateFrequencyWhenVersion'
  | 'findDryRunSnapshot'
  | 'findDryRunSnapshotForUpdate'
>;

export type GetWeComControlledReachOutResult =
  | { kind: 'success'; preflight: WeComControlledReachOutPreflight }
  | { kind: 'failed'; reason: WeComControlledReachOutFailureCode };

export type PrepareWeComControlledReachOutResult =
  | { kind: 'ready'; preflight: WeComControlledReachOutPreflight; idempotent: boolean }
  | { kind: 'failed'; reason: WeComControlledReachOutFailureCode };

export class WeComControlledReachOutTransactionAbort extends Error {
  constructor(readonly reason: WeComControlledReachOutFailureCode) {
    super(`wecom_controlled_reachout_transaction_abort:${reason}`);
    this.name = 'WeComControlledReachOutTransactionAbort';
  }
}

type InstitutionContext = AccessContext & { tenantId: string; institutionId: string };

type LoadedPrerequisites = {
  draft: FollowUpMessageDraft;
  deliveries: MessageDelivery[];
  delivery: MessageDelivery | null;
  mapping: WeComCustomerMappingState | null;
  customerExists: boolean;
};

function hasInstitutionContext(context: AccessContext): context is InstitutionContext {
  return Boolean(context.tenantId && context.institutionId);
}

function failureBeforeSafety(input: LoadedPrerequisites): WeComControlledReachOutFailureCode | null {
  if (input.draft.status !== 'approved') return 'draft_not_approved';
  if (input.deliveries.length === 0) return 'delivery_missing';
  if (input.deliveries.length !== 1) return 'delivery_not_unique';
  if (
    !input.delivery ||
    input.delivery.tenantId !== input.draft.tenantId ||
    input.delivery.institutionId !== input.draft.institutionId ||
    input.delivery.messageDraftId !== input.draft.id ||
    input.delivery.customerId !== input.draft.customerId ||
    input.delivery.followUpTaskId !== input.draft.followUpTaskId
  ) return 'delivery_customer_mismatch';
  if (input.delivery.id !== `msg-delivery:${input.draft.id}`.slice(0, 96)) {
    return 'delivery_not_internal_mock';
  }
  if (!isEligibleControlledReachOutMockDelivery(input.delivery)) {
    return 'delivery_not_internal_mock';
  }
  if (!input.mapping || input.mapping.status !== 'confirmed') return 'mapping_not_confirmed';
  if (
    input.mapping.tenantId !== input.draft.tenantId ||
    input.mapping.institutionId !== input.draft.institutionId ||
    input.mapping.proofContactId !== WE_COM_CONTROLLED_REACH_OUT_PROOF_CONTACT_ID ||
    input.mapping.customerId !== input.draft.customerId
  ) return 'mapping_customer_mismatch';
  if (!input.customerExists) return 'customer_not_found';
  return null;
}

function controlledReachOutMatches(input: {
  controlledReachOut: ReturnType<typeof readWeComControlledReachOutMetadata>;
  draft: FollowUpMessageDraft;
  delivery: MessageDelivery | null;
}) {
  return !input.controlledReachOut || Boolean(
    input.delivery &&
    input.controlledReachOut.messageDraftId === input.draft.id &&
    input.controlledReachOut.messageDeliveryId === input.delivery.id &&
    input.controlledReachOut.customerId === input.draft.customerId &&
    input.controlledReachOut.proofContactId === WE_COM_CONTROLLED_REACH_OUT_PROOF_CONTACT_ID
  );
}

function hasControlledReachOutMetadata(draft: FollowUpMessageDraft) {
  return Object.prototype.hasOwnProperty.call(draft.metadataJson, 'weComControlledReachOut');
}

async function loadPrerequisites(input: {
  context: InstitutionContext;
  draftId: string;
  repository: WeComControlledReachOutRepository;
  mappingRepository: WeComControlledReachOutMappingRepository;
  lockMapping: boolean;
}): Promise<LoadedPrerequisites | null> {
  const draft = await input.repository.getFollowUpMessageDraftByTenantAndInstitution({
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId,
    draftId: input.draftId,
  });
  if (!draft) return null;

  const deliveries = await input.repository.listMessageDeliveriesForDraft({
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId,
    draftId: input.draftId,
  });
  const delivery = deliveries.length === 1 ? deliveries[0] : null;
  const mappingScope = {
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId,
    proofContactId: WE_COM_CONTROLLED_REACH_OUT_PROOF_CONTACT_ID,
  };
  const mapping = input.lockMapping
    ? await input.mappingRepository.findByScopeForUpdate(mappingScope)
    : await input.mappingRepository.findByScope(mappingScope);
  const customer = await input.repository.getCustomerByTenantAndInstitution({
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId,
    id: draft.customerId,
  });

  return { draft, deliveries, delivery, mapping, customerExists: Boolean(customer) };
}

async function createPreflight(input: {
  context: InstitutionContext;
  loaded: LoadedPrerequisites;
  safetyRepository: WeComControlledReachOutSafetyRepository;
  occurredAt: string;
}): Promise<WeComControlledReachOutPreflight> {
  const scope = {
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId,
    customerId: input.loaded.draft.customerId,
  };
  const [consent, frequencyState, snapshot] = await Promise.all([
    input.safetyRepository.findConsent(scope),
    input.safetyRepository.findFrequency(scope),
    input.safetyRepository.findDryRunSnapshot({
      tenantId: input.context.tenantId,
      institutionId: input.context.institutionId,
    }),
  ]);
  const controlledReachOut = readWeComControlledReachOutMetadata(input.loaded.draft.metadataJson);
  const controlledReachOutInvalid = hasControlledReachOutMetadata(input.loaded.draft) && !controlledReachOut;
  const operationRef = input.loaded.delivery
    ? createWeComControlledReachOutOperationRef(input.loaded.delivery.id)
    : null;
  const frequency = summarizeControlledReachOutFrequency({
    state: frequencyState,
    operationRef,
    occurredAt: input.occurredAt,
  });
  const dryRun = summarizeControlledReachOutDryRun(snapshot);
  const prerequisiteFailure = failureBeforeSafety(input.loaded);
  const consentFailure = failureCodeFromConsent(consent?.status ?? 'unknown');
  const blockReason = prerequisiteFailure ??
    consentFailure ??
    (frequency.status === 'cap_reached' ? 'frequency_cap_reached' : null) ??
    (dryRun.status === 'dry_run_ready' ? null : 'dry_run_not_ready');
  const finalBlockReason = controlledReachOutInvalid || !controlledReachOutMatches({
    controlledReachOut,
    draft: input.loaded.draft,
    delivery: input.loaded.delivery,
  }) ? 'conflict' : blockReason;

  return {
    draft: {
      draftId: input.loaded.draft.id,
      status: input.loaded.draft.status,
      customerId: input.loaded.draft.customerId,
      updatedAt: input.loaded.draft.updatedAt,
    },
    delivery: input.loaded.delivery
      ? {
          messageDeliveryId: input.loaded.delivery.id,
          customerId: input.loaded.delivery.customerId,
          channelType: input.loaded.delivery.channelType,
          deliveryMode: input.loaded.delivery.deliveryMode,
          status: input.loaded.delivery.status,
        }
      : null,
    mapping: {
      proofContactId: WE_COM_CONTROLLED_REACH_OUT_PROOF_CONTACT_ID,
      status: input.loaded.mapping?.status ?? 'missing',
      customerMatchesDraft: Boolean(
        input.loaded.mapping && input.loaded.mapping.customerId === input.loaded.draft.customerId
      ),
    },
    consent: { status: consent?.status ?? 'unknown' },
    frequency,
    dryRun,
    controlledReachOut,
    canPrepare: !finalBlockReason && !controlledReachOut,
    blockReason: finalBlockReason,
    readOnly: input.context.role !== 'tenant_admin',
    boundary: createWeComControlledReachOutBoundary(),
  };
}

export async function getWeComControlledReachOut(input: {
  context: AccessContext;
  draftId: string;
  repository: WeComControlledReachOutRepository;
  mappingRepository: WeComControlledReachOutMappingRepository;
  safetyRepository: WeComControlledReachOutSafetyRepository;
  occurredAt: string;
}): Promise<GetWeComControlledReachOutResult> {
  if (!hasInstitutionContext(input.context)) return { kind: 'failed', reason: 'draft_not_found' };
  const loaded = await loadPrerequisites({ ...input, context: input.context, lockMapping: false });
  if (!loaded) return { kind: 'failed', reason: 'draft_not_found' };
  return {
    kind: 'success',
    preflight: await createPreflight({
      context: input.context,
      loaded,
      safetyRepository: input.safetyRepository,
      occurredAt: input.occurredAt,
    }),
  };
}

export async function prepareWeComControlledReachOut(input: {
  context: AccessContext;
  draftId: string;
  repository: WeComControlledReachOutRepository;
  mappingRepository: WeComControlledReachOutMappingRepository;
  safetyRepository: WeComControlledReachOutSafetyRepository;
  auditRepository: Pick<AuditEventRepository, 'record'>;
  occurredAt: string;
  createId: () => string;
}): Promise<PrepareWeComControlledReachOutResult> {
  if (!hasInstitutionContext(input.context)) return { kind: 'failed', reason: 'draft_not_found' };
  const loaded = await loadPrerequisites({ ...input, context: input.context, lockMapping: true });
  if (!loaded) return { kind: 'failed', reason: 'draft_not_found' };

  const prerequisiteFailure = failureBeforeSafety(loaded);
  if (prerequisiteFailure) return { kind: 'failed', reason: prerequisiteFailure };
  if (!loaded.delivery) return { kind: 'failed', reason: 'delivery_missing' };

  const controlledReachOut = readWeComControlledReachOutMetadata(loaded.draft.metadataJson);
  if (
    (hasControlledReachOutMetadata(loaded.draft) && !controlledReachOut) ||
    !controlledReachOutMatches({ controlledReachOut, draft: loaded.draft, delivery: loaded.delivery })
  ) {
    return { kind: 'failed', reason: 'conflict' };
  }

  const scope = {
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId,
    customerId: loaded.draft.customerId,
  };
  const consent = await input.safetyRepository.findConsent(scope);
  const consentFailure = failureCodeFromConsent(consent?.status ?? 'unknown');
  if (consentFailure) return { kind: 'failed', reason: consentFailure };

  const operationRef = createWeComControlledReachOutOperationRef(loaded.delivery.id);
  if (!operationRef) return { kind: 'failed', reason: 'conflict' };
  const frequencyReservation = await reservePreparedAttempt({
    context: input.context,
    scope,
    systemOperationId: operationRef.slice('wrop_'.length),
    occurredAt: input.occurredAt,
    createId: input.createId,
    repositories: {
      safetyRepository: input.safetyRepository as TrustedReachOutSafetyRepository,
      auditRepository: input.auditRepository,
    },
  });
  if (frequencyReservation.kind === 'frequency_cap_reached') {
    return { kind: 'failed', reason: 'frequency_cap_reached' };
  }
  if (frequencyReservation.kind === 'opted_out') return { kind: 'failed', reason: 'opt_out' };
  if (frequencyReservation.kind === 'consent_required') {
    const lockedConsent = await input.safetyRepository.findConsent(scope);
    const lockedConsentFailure = failureCodeFromConsent(lockedConsent?.status ?? 'unknown');
    return { kind: 'failed', reason: lockedConsentFailure ?? 'conflict' };
  }
  if (frequencyReservation.kind === 'conflict' || frequencyReservation.kind === 'invalid_operation') {
    return { kind: 'failed', reason: 'conflict' };
  }

  const snapshot = await input.safetyRepository.findDryRunSnapshotForUpdate({
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId,
  });
  const dryRun = summarizeControlledReachOutDryRun(snapshot);
  if (dryRun.status !== 'dry_run_ready') {
    if (frequencyReservation.kind === 'reserved') {
      throw new WeComControlledReachOutTransactionAbort('dry_run_not_ready');
    }
    return { kind: 'failed', reason: 'dry_run_not_ready' };
  }

  const basePreflight = await createPreflight({
    context: input.context,
    loaded,
    safetyRepository: input.safetyRepository,
    occurredAt: input.occurredAt,
  });
  if (controlledReachOut) {
    return {
      kind: 'ready',
      idempotent: true,
      preflight: {
        ...basePreflight,
        controlledReachOut,
        canPrepare: false,
        blockReason: null,
      },
    };
  }

  const nextControlledReachOut = createWeComControlledReachOutMetadata({
    draft: loaded.draft,
    delivery: loaded.delivery,
    frequencyDecision: frequencyReservation.kind,
    preparedBy: input.context.userId,
    preparedAt: input.occurredAt,
  });
  const update = await input.repository.updateFollowUpMessageDraftControlledReachOut({
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId,
    draftId: input.draftId,
    expectedUpdatedAt: loaded.draft.updatedAt,
    expectedMetadataJson: loaded.draft.metadataJson,
    metadataJson: {
      ...loaded.draft.metadataJson,
      weComControlledReachOut: nextControlledReachOut,
    },
    occurredAt: input.occurredAt,
  });
  if (update.kind === 'conflict') {
    throw new WeComControlledReachOutTransactionAbort('conflict');
  }

  const reservedState = frequencyReservation.state;
  if (!reservedState) {
    if (frequencyReservation.kind === 'reserved') {
      throw new WeComControlledReachOutTransactionAbort('conflict');
    }
    return { kind: 'failed', reason: 'conflict' };
  }

  return {
    kind: 'ready',
    idempotent: false,
    preflight: {
      ...basePreflight,
      draft: { ...basePreflight.draft, updatedAt: update.draft.updatedAt },
      consent: { status: 'consented' },
      frequency: {
        status: 'reserved',
        preparedCount: reservedState.preparedCount,
        maxPreparedCount: 1,
        nextAllowedAt: reservedState.nextAllowedAt,
      },
      dryRun,
      controlledReachOut: nextControlledReachOut,
      canPrepare: false,
      blockReason: null,
    },
  };
}
