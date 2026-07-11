import { describe, expect, it } from 'vitest';
import {
  auditReasonForWeComControlledReachOutFailure,
  createWeComControlledReachOutMetadata,
  createWeComControlledReachOutOperationRef,
  failureCodeFromConsent,
  isEligibleControlledReachOutMockDelivery,
  parseWeComControlledReachOutRequest,
  readWeComControlledReachOutMetadata,
  summarizeControlledReachOutDryRun,
  summarizeControlledReachOutFrequency,
} from '@/modules/institution/domain/wecom-controlled-reachout';
import type { FollowUpMessageDraft } from '@/modules/institution/domain/followup-message-drafts';
import {
  createMessageDeliveryFromApprovedDraft,
  type MessageDelivery,
} from '@/modules/institution/domain/followup-message-deliveries';
import type {
  CustomerChannelFrequencyState,
  InstitutionChannelDryRunSnapshot,
} from '@/modules/institution/server/trusted-reachout-safety-repository';

function draft(metadataJson: Record<string, unknown> = {}): FollowUpMessageDraft {
  return {
    id: 'draft-a', tenantId: 'tenant-a', institutionId: 'inst-a', followUpTaskId: 'task-a',
    enrollmentId: null, stageId: null, customerId: 'customer-a', customerDisplayName: '低敏客户',
    templateId: null, channelType: 'manual', status: 'approved', draftContent: '低敏草稿',
    editedContent: null, safePreview: '低敏草稿', approvedBy: 'admin-a',
    approvedAt: '2026-07-11T08:00:00.000Z', rejectedBy: null, rejectedAt: null,
    markedSentBy: null, markedSentAt: null, safeReasonCode: 'draft_approved', metadataJson,
    createdAt: '2026-07-11T07:00:00.000Z', updatedAt: '2026-07-11T08:00:00.000Z',
  };
}

function delivery(overrides: Partial<MessageDelivery> = {}): MessageDelivery {
  const result = createMessageDeliveryFromApprovedDraft({
    draft: draft(),
    actorId: 'admin-a',
    occurredAt: '2026-07-11T08:00:00.000Z',
  });
  if (result.kind !== 'created') throw new Error('approved draft must create an internal mock delivery');
  return { ...result.delivery, ...overrides };
}

function dryRun(overrides: Partial<InstitutionChannelDryRunSnapshot> = {}): InstitutionChannelDryRunSnapshot {
  return {
    id: 'snapshot-a', tenantId: 'tenant-a', institutionId: 'inst-a', channelType: 'wechat_work',
    officialRoute: 'official_wecom_self_built', proofInstitutionRef: 'proof-inst',
    callbackPlaceholderRef: 'callback-placeholder', configStatus: 'dry_run_ready',
    preflightStatus: 'mock_ready', proofEligibleMock: true, evaluatedBy: 'admin-a',
    evaluatedAt: '2026-07-11T08:00:00.000Z', allowRealSend: false,
    externalChannelEnabled: false, realSendAllowed: false, dryRunOnly: true, version: 1,
    ...overrides,
  };
}

function frequency(overrides: Partial<CustomerChannelFrequencyState> = {}): CustomerChannelFrequencyState {
  return {
    id: 'frequency-a', tenantId: 'tenant-a', institutionId: 'inst-a', customerId: 'customer-a',
    channelType: 'wechat_work', windowStartedAt: '2026-07-11T08:00:00.000Z',
    windowEndsAt: '2026-07-12T08:00:00.000Z', preparedCount: 1, completedCount: 0,
    maxPreparedCount: 1, maxCompletedCount: 1, nextAllowedAt: '2026-07-12T08:00:00.000Z',
    lastPreparedRef: 'wrop_delivery_msg-delivery_draft-a', lastCompletedRef: null, version: 1,
    ...overrides,
  };
}

describe('weComControlledReachOut domain', () => {
  it('严格接受固定 action/confirmation 且拒绝额外字段', () => {
    expect(parseWeComControlledReachOutRequest({
      action: 'prepare_no_send', confirmation: 'CONFIRM_SINGLE_CUSTOMER_WECOM_NO_SEND',
    })).toMatchObject({ ok: true });
    expect(parseWeComControlledReachOutRequest({
      action: 'prepare_no_send', confirmation: 'CONFIRM_SINGLE_CUSTOMER_WECOM_NO_SEND', tenantId: 'tenant-b',
    })).toEqual({ ok: false, reason: 'invalid_request' });
    expect(parseWeComControlledReachOutRequest({
      action: 'prepare_no_send', confirmation: 'confirm',
    })).toEqual({ ok: false, reason: 'manual_confirmation_invalid' });
  });

  it.each([
    ['unknown', 'consent_missing'],
    ['consent_revoked', 'consent_revoked'],
    ['opted_out', 'opt_out'],
    ['consented', null],
  ] as const)('可信 consent %s 映射为 %s', (status, expected) => {
    expect(failureCodeFromConsent(status)).toBe(expected);
  });

  it('frequency 同 operation 幂等，不同 operation 在窗口内阻断', () => {
    expect(summarizeControlledReachOutFrequency({
      state: frequency(), operationRef: 'wrop_delivery_msg-delivery_draft-a',
      occurredAt: '2026-07-11T09:00:00.000Z',
    }).status).toBe('reserved');
    expect(summarizeControlledReachOutFrequency({
      state: frequency(), operationRef: 'wrop_delivery_other',
      occurredAt: '2026-07-11T09:00:00.000Z',
    }).status).toBe('cap_reached');
    expect(summarizeControlledReachOutFrequency({
      state: frequency(), operationRef: 'wrop_delivery_other',
      occurredAt: '2026-07-12T09:00:00.000Z',
    }).status).toBe('available');
  });

  it('只允许正式 approved draft 产生的内部 mock delivery 进入受控准备', () => {
    expect(isEligibleControlledReachOutMockDelivery(delivery())).toBe(true);
    expect(isEligibleControlledReachOutMockDelivery(delivery({ status: 'pending', sentAt: null }))).toBe(false);
    expect(isEligibleControlledReachOutMockDelivery(delivery({ channelType: 'wechat_work' }))).toBe(false);
    expect(isEligibleControlledReachOutMockDelivery(delivery({ channelType: 'sms' }))).toBe(false);
    expect(isEligibleControlledReachOutMockDelivery(delivery({
      deliveryMode: 'external_disabled', status: 'external_disabled',
    }))).toBe(false);
    expect(isEligibleControlledReachOutMockDelivery(delivery({ status: 'real_sent' as never }))).toBe(false);
    expect(isEligibleControlledReachOutMockDelivery(delivery({ status: 'send_succeeded' as never }))).toBe(false);
  });

  it.each([
    [{}, 'dry_run_ready'],
    [{ officialRoute: 'official_wecom_third_party' }, 'not_ready'],
    [{ officialRoute: 'official_wecom_service_provider' }, 'not_ready'],
    [{ preflightStatus: 'blocked_safety_switch' }, 'not_ready'],
    [{ proofEligibleMock: false }, 'not_ready'],
    [{ configStatus: 'blocked' }, 'not_ready'],
  ] as const)('dry-run snapshot 严格门禁 %j', (override, expected) => {
    expect(summarizeControlledReachOutDryRun(dryRun(override as Partial<InstitutionChannelDryRunSnapshot>)).status).toBe(expected);
  });

  it('只生成固定低敏 ready_no_send metadata，且 reader 拒绝开关篡改', () => {
    const metadata = createWeComControlledReachOutMetadata({
      draft: draft(), delivery: delivery(), frequencyDecision: 'reserved', preparedBy: 'admin-a',
      preparedAt: '2026-07-11T09:00:00.000Z',
    });
    const serialized = JSON.stringify(metadata);

    expect(metadata).toMatchObject({
      status: 'ready_no_send', consentStatus: 'consented', frequencyDecision: 'reserved',
      dryRunStatus: 'dry_run_ready', realSendEnabled: false, noRealSend: true, noRealNetwork: true,
    });
    expect(createWeComControlledReachOutOperationRef(delivery().id)).toBe('wrop_delivery_msg-delivery_draft-a');
    expect(serialized).not.toMatch(/external_userid|UserID|corpId|agentId|Secret|token|https?:|phone|payload/i);
    expect(readWeComControlledReachOutMetadata({ weComControlledReachOut: metadata })).toEqual(metadata);
    expect(readWeComControlledReachOutMetadata({
      weComControlledReachOut: { ...metadata, realSendEnabled: true },
    })).toBeNull();
  });

  it.each([
    ['draft_not_found', 'wecom_controlled_reachout_draft_not_found'],
    ['draft_not_approved', 'wecom_controlled_reachout_draft_not_approved'],
    ['delivery_missing', 'wecom_controlled_reachout_delivery_missing'],
    ['delivery_not_unique', 'wecom_controlled_reachout_delivery_not_unique'],
    ['delivery_customer_mismatch', 'wecom_controlled_reachout_delivery_customer_mismatch'],
    ['delivery_not_internal_mock', 'wecom_controlled_reachout_delivery_not_internal_mock'],
    ['mapping_not_confirmed', 'wecom_controlled_reachout_mapping_not_confirmed'],
    ['mapping_customer_mismatch', 'wecom_controlled_reachout_mapping_customer_mismatch'],
    ['customer_not_found', 'wecom_controlled_reachout_customer_not_found'],
    ['consent_missing', 'wecom_controlled_reachout_consent_missing'],
    ['consent_revoked', 'wecom_controlled_reachout_consent_revoked'],
    ['opt_out', 'wecom_controlled_reachout_opt_out'],
    ['frequency_cap_reached', 'wecom_controlled_reachout_frequency_cap_reached'],
    ['dry_run_not_ready', 'wecom_controlled_reachout_dry_run_not_ready'],
    ['manual_confirmation_invalid', 'wecom_controlled_reachout_manual_confirmation_invalid'],
    ['conflict', 'wecom_controlled_reachout_conflict'],
  ] as const)('失败原因 %s 只映射到固定 AuditReason %s', (failure, reason) => {
    expect(auditReasonForWeComControlledReachOutFailure(failure)).toBe(reason);
  });
});
