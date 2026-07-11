import type { AuditReason } from '@/modules/audit/domain/audit-events';
import type { FollowUpMessageDraft } from '@/modules/institution/domain/followup-message-drafts';
import type { MessageDelivery } from '@/modules/institution/domain/followup-message-deliveries';
import type { WeComReachOutConsentStatus } from '@/modules/institution/domain/trusted-reachout-safety';
import { createWeComReachOutOperationRef } from '@/modules/institution/domain/trusted-reachout-safety';
import type {
  CustomerChannelFrequencyState,
  InstitutionChannelDryRunSnapshot,
} from '@/modules/institution/server/trusted-reachout-safety-repository';
import type { WeComCustomerMappingState } from '@/modules/institution/server/wecom-customer-mapping-repository';

export const WE_COM_CONTROLLED_REACH_OUT_ACTION = 'prepare_no_send' as const;
export const WE_COM_CONTROLLED_REACH_OUT_CONFIRMATION = 'CONFIRM_SINGLE_CUSTOMER_WECOM_NO_SEND' as const;
export const WE_COM_CONTROLLED_REACH_OUT_PROOF_CONTACT_ID = 'live-contact-proof-01' as const;

export const weComControlledReachOutFailureCodes = [
  'draft_not_found',
  'draft_not_approved',
  'delivery_missing',
  'delivery_not_unique',
  'delivery_customer_mismatch',
  'delivery_not_internal_mock',
  'mapping_not_confirmed',
  'mapping_customer_mismatch',
  'customer_not_found',
  'consent_missing',
  'consent_revoked',
  'opt_out',
  'frequency_cap_reached',
  'dry_run_not_ready',
  'manual_confirmation_invalid',
  'conflict',
] as const;

export type WeComControlledReachOutFailureCode = (typeof weComControlledReachOutFailureCodes)[number];
export type WeComControlledReachOutStatus = 'ready_no_send';
export type WeComControlledReachOutFrequencyDecision = 'reserved' | 'idempotent';

export type WeComControlledReachOutMetadata = {
  controlledReachOutId: string;
  messageDraftId: string;
  messageDeliveryId: string;
  customerId: string;
  proofContactId: typeof WE_COM_CONTROLLED_REACH_OUT_PROOF_CONTACT_ID;
  status: WeComControlledReachOutStatus;
  consentStatus: 'consented';
  frequencyDecision: WeComControlledReachOutFrequencyDecision;
  dryRunStatus: 'dry_run_ready';
  preparedBy: string;
  preparedAt: string;
  realSendEnabled: false;
  noRealSend: true;
  noRealNetwork: true;
};

export type WeComControlledReachOutFrequencySummary = {
  status: 'available' | 'reserved' | 'cap_reached';
  preparedCount: number;
  maxPreparedCount: 1;
  nextAllowedAt: string | null;
};

export type WeComControlledReachOutDryRunSummary = {
  status: 'dry_run_ready' | 'not_ready';
  configStatus: InstitutionChannelDryRunSnapshot['configStatus'] | 'missing';
  officialRoute: string | null;
  preflightStatus: InstitutionChannelDryRunSnapshot['preflightStatus'] | 'missing';
  proofEligibleMock: boolean;
  allowRealSend: false;
  externalChannelEnabled: false;
  realSendAllowed: false;
  dryRunOnly: true;
};

export type WeComControlledReachOutPreflight = {
  draft: {
    draftId: string;
    status: FollowUpMessageDraft['status'];
    customerId: string;
    updatedAt: string;
  };
  delivery: {
    messageDeliveryId: string;
    customerId: string;
    channelType: MessageDelivery['channelType'];
    deliveryMode: MessageDelivery['deliveryMode'];
    status: MessageDelivery['status'];
  } | null;
  mapping: {
    proofContactId: typeof WE_COM_CONTROLLED_REACH_OUT_PROOF_CONTACT_ID;
    status: WeComCustomerMappingState['status'] | 'missing';
    customerMatchesDraft: boolean;
  };
  consent: { status: WeComReachOutConsentStatus };
  frequency: WeComControlledReachOutFrequencySummary;
  dryRun: WeComControlledReachOutDryRunSummary;
  controlledReachOut: WeComControlledReachOutMetadata | null;
  canPrepare: boolean;
  blockReason: WeComControlledReachOutFailureCode | null;
  readOnly: boolean;
  boundary: {
    singleCustomerOnly: true;
    manualConfirmationRequired: true;
    preparationOnly: true;
    noRealWeComCall: true;
    noCustomerVisibleMessage: true;
    notSent: true;
    allowRealSend: false;
    externalChannelEnabled: false;
    realSendAllowed: false;
  };
};

const failureAuditReasons = {
  draft_not_found: 'wecom_controlled_reachout_draft_not_found',
  draft_not_approved: 'wecom_controlled_reachout_draft_not_approved',
  delivery_missing: 'wecom_controlled_reachout_delivery_missing',
  delivery_not_unique: 'wecom_controlled_reachout_delivery_not_unique',
  delivery_customer_mismatch: 'wecom_controlled_reachout_delivery_customer_mismatch',
  delivery_not_internal_mock: 'wecom_controlled_reachout_delivery_not_internal_mock',
  mapping_not_confirmed: 'wecom_controlled_reachout_mapping_not_confirmed',
  mapping_customer_mismatch: 'wecom_controlled_reachout_mapping_customer_mismatch',
  customer_not_found: 'wecom_controlled_reachout_customer_not_found',
  consent_missing: 'wecom_controlled_reachout_consent_missing',
  consent_revoked: 'wecom_controlled_reachout_consent_revoked',
  opt_out: 'wecom_controlled_reachout_opt_out',
  frequency_cap_reached: 'wecom_controlled_reachout_frequency_cap_reached',
  dry_run_not_ready: 'wecom_controlled_reachout_dry_run_not_ready',
  manual_confirmation_invalid: 'wecom_controlled_reachout_manual_confirmation_invalid',
  conflict: 'wecom_controlled_reachout_conflict',
} as const satisfies Record<WeComControlledReachOutFailureCode, AuditReason>;

function isRecord(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

function hasExactKeys(input: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(input).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function parseWeComControlledReachOutRequest(input: unknown):
  | { ok: true; value: { action: typeof WE_COM_CONTROLLED_REACH_OUT_ACTION; confirmation: typeof WE_COM_CONTROLLED_REACH_OUT_CONFIRMATION } }
  | { ok: false; reason: 'invalid_request' | 'manual_confirmation_invalid' } {
  if (!isRecord(input) || !hasExactKeys(input, ['action', 'confirmation'])) {
    return { ok: false, reason: 'invalid_request' };
  }
  if (input.action !== WE_COM_CONTROLLED_REACH_OUT_ACTION) {
    return { ok: false, reason: 'invalid_request' };
  }
  if (input.confirmation !== WE_COM_CONTROLLED_REACH_OUT_CONFIRMATION) {
    return { ok: false, reason: 'manual_confirmation_invalid' };
  }
  return {
    ok: true,
    value: {
      action: WE_COM_CONTROLLED_REACH_OUT_ACTION,
      confirmation: WE_COM_CONTROLLED_REACH_OUT_CONFIRMATION,
    },
  };
}

export function readWeComControlledReachOutMetadata(
  metadataJson: Record<string, unknown>,
): WeComControlledReachOutMetadata | null {
  const raw = metadataJson.weComControlledReachOut;
  if (!isRecord(raw)) return null;
  if (
    typeof raw.controlledReachOutId !== 'string' ||
    typeof raw.messageDraftId !== 'string' ||
    typeof raw.messageDeliveryId !== 'string' ||
    typeof raw.customerId !== 'string' ||
    raw.proofContactId !== WE_COM_CONTROLLED_REACH_OUT_PROOF_CONTACT_ID ||
    raw.status !== 'ready_no_send' ||
    raw.consentStatus !== 'consented' ||
    (raw.frequencyDecision !== 'reserved' && raw.frequencyDecision !== 'idempotent') ||
    raw.dryRunStatus !== 'dry_run_ready' ||
    typeof raw.preparedBy !== 'string' ||
    typeof raw.preparedAt !== 'string' ||
    raw.realSendEnabled !== false ||
    raw.noRealSend !== true ||
    raw.noRealNetwork !== true
  ) return null;

  return {
    controlledReachOutId: raw.controlledReachOutId,
    messageDraftId: raw.messageDraftId,
    messageDeliveryId: raw.messageDeliveryId,
    customerId: raw.customerId,
    proofContactId: raw.proofContactId,
    status: raw.status,
    consentStatus: raw.consentStatus,
    frequencyDecision: raw.frequencyDecision,
    dryRunStatus: raw.dryRunStatus,
    preparedBy: raw.preparedBy,
    preparedAt: raw.preparedAt,
    realSendEnabled: false,
    noRealSend: true,
    noRealNetwork: true,
  };
}

export function failureCodeFromConsent(
  status: WeComReachOutConsentStatus,
): WeComControlledReachOutFailureCode | null {
  if (status === 'opted_out') return 'opt_out';
  if (status === 'consent_revoked') return 'consent_revoked';
  if (status !== 'consented') return 'consent_missing';
  return null;
}

export function isEligibleControlledReachOutMockDelivery(delivery: MessageDelivery) {
  return (
    delivery.channelType === 'mock' &&
    delivery.deliveryMode === 'mock' &&
    delivery.status === 'mock_sent' &&
    typeof delivery.sentAt === 'string' &&
    Number.isFinite(Date.parse(delivery.sentAt)) &&
    delivery.failureReason === null &&
    delivery.weComMockReachOut === null &&
    delivery.contactSafetyDecision.allowed === true &&
    delivery.contactSafetyDecision.status === 'mock_sent' &&
    delivery.contactSafetyDecision.deliveryMode === 'mock'
  );
}

export function createWeComControlledReachOutOperationRef(messageDeliveryId: string) {
  const lowSensitiveId = `delivery_${messageDeliveryId}`
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9_-]/gu, '_')
    .slice(0, 80);
  return createWeComReachOutOperationRef(lowSensitiveId);
}

export function summarizeControlledReachOutFrequency(input: {
  state: CustomerChannelFrequencyState | null;
  operationRef: string | null;
  occurredAt: string;
}): WeComControlledReachOutFrequencySummary {
  if (!input.state) {
    return { status: 'available', preparedCount: 0, maxPreparedCount: 1, nextAllowedAt: null };
  }
  if (input.operationRef && input.state.lastPreparedRef === input.operationRef) {
    return {
      status: 'reserved',
      preparedCount: input.state.preparedCount,
      maxPreparedCount: 1,
      nextAllowedAt: input.state.nextAllowedAt,
    };
  }
  const windowActive = Date.parse(input.state.windowEndsAt) > Date.parse(input.occurredAt);
  return {
    status: windowActive && input.state.preparedCount >= input.state.maxPreparedCount ? 'cap_reached' : 'available',
    preparedCount: input.state.preparedCount,
    maxPreparedCount: 1,
    nextAllowedAt: input.state.nextAllowedAt,
  };
}

export function summarizeControlledReachOutDryRun(
  snapshot: InstitutionChannelDryRunSnapshot | null,
): WeComControlledReachOutDryRunSummary {
  const ready = Boolean(
    snapshot &&
    snapshot.channelType === 'wechat_work' &&
    snapshot.configStatus === 'dry_run_ready' &&
    snapshot.officialRoute === 'official_wecom_self_built' &&
    snapshot.preflightStatus === 'mock_ready' &&
    snapshot.proofEligibleMock === true &&
    snapshot.allowRealSend === false &&
    snapshot.externalChannelEnabled === false &&
    snapshot.realSendAllowed === false &&
    snapshot.dryRunOnly === true
  );
  return {
    status: ready ? 'dry_run_ready' : 'not_ready',
    configStatus: snapshot?.configStatus ?? 'missing',
    officialRoute: snapshot?.officialRoute ?? null,
    preflightStatus: snapshot?.preflightStatus ?? 'missing',
    proofEligibleMock: snapshot?.proofEligibleMock ?? false,
    allowRealSend: false,
    externalChannelEnabled: false,
    realSendAllowed: false,
    dryRunOnly: true,
  };
}

export function auditReasonForWeComControlledReachOutFailure(
  code: WeComControlledReachOutFailureCode,
): AuditReason {
  return failureAuditReasons[code];
}

export function createWeComControlledReachOutMetadata(input: {
  draft: FollowUpMessageDraft;
  delivery: MessageDelivery;
  frequencyDecision: WeComControlledReachOutFrequencyDecision;
  preparedBy: string;
  preparedAt: string;
}): WeComControlledReachOutMetadata {
  const controlledReachOutId = `wecom-controlled-reachout-${input.draft.id}`
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9_-]/gu, '_')
    .slice(0, 128);
  return {
    controlledReachOutId,
    messageDraftId: input.draft.id,
    messageDeliveryId: input.delivery.id,
    customerId: input.draft.customerId,
    proofContactId: WE_COM_CONTROLLED_REACH_OUT_PROOF_CONTACT_ID,
    status: 'ready_no_send',
    consentStatus: 'consented',
    frequencyDecision: input.frequencyDecision,
    dryRunStatus: 'dry_run_ready',
    preparedBy: input.preparedBy,
    preparedAt: input.preparedAt,
    realSendEnabled: false,
    noRealSend: true,
    noRealNetwork: true,
  };
}

export function createWeComControlledReachOutBoundary(): WeComControlledReachOutPreflight['boundary'] {
  return {
    singleCustomerOnly: true,
    manualConfirmationRequired: true,
    preparationOnly: true,
    noRealWeComCall: true,
    noCustomerVisibleMessage: true,
    notSent: true,
    allowRealSend: false,
    externalChannelEnabled: false,
    realSendAllowed: false,
  };
}
