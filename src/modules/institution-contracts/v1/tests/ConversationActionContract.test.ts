import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  CONVERSATION_ACTION_PARTITION_KEYS_V1,
  CONVERSATION_ACTION_PRIORITIES_V1,
  CONVERSATION_ACTION_RISK_STATES_V1,
  CONVERSATION_ACTION_SAFE_SUMMARY_MAX_LENGTH_V1,
  CONVERSATION_ACTION_STATES_V1,
  isConversationActionPartitionKeyV1,
  isConversationActionRiskStateV1,
  isConversationActionStateV1,
  type ConversationActionAssigneeV1,
  type ConversationActionItemV1,
  type ConversationActionPartitionKeyV1,
  type ConversationActionPayloadV1,
  type ConversationActionSourceV1,
  type ConversationActionSubjectV1,
} from '@/modules/institution-contracts/v1/conversation-action';
import type { CustomerReferenceV1 } from '@/modules/institution-contracts/v1/customer';
import type { InstitutionActionSortSignalV1 } from '@/modules/institution-contracts/v1/institution-action';
import type { InstitutionSourceEnvelopeV1 } from '@/modules/institution-contracts/v1/institution-source';

describe('ConversationActionContractV1', () => {
  it('freezes the exact partition, active-state, risk and priority vocabularies', () => {
    expect(CONVERSATION_ACTION_PARTITION_KEYS_V1).toEqual([
      'waiting_human',
      'unresolved_risk',
    ]);
    expect(CONVERSATION_ACTION_STATES_V1).toEqual([
      'ai_handling',
      'awaiting_human',
      'human_handling',
      'waiting_customer',
    ]);
    expect(CONVERSATION_ACTION_RISK_STATES_V1).toEqual([
      'none',
      'unconfirmed',
      'confirmed',
      'resolved',
    ]);
    expect(CONVERSATION_ACTION_PRIORITIES_V1).toEqual(['normal', 'high']);
    expect(CONVERSATION_ACTION_SAFE_SUMMARY_MAX_LENGTH_V1).toBe(120);

    for (const values of [
      CONVERSATION_ACTION_PARTITION_KEYS_V1,
      CONVERSATION_ACTION_STATES_V1,
      CONVERSATION_ACTION_RISK_STATES_V1,
      CONVERSATION_ACTION_PRIORITIES_V1,
    ]) {
      expect(Object.isFrozen(values)).toBe(true);
    }
  });

  it('keeps scalar guards shallow and excludes closed from the action state', () => {
    expect(isConversationActionPartitionKeyV1('waiting_human')).toBe(true);
    expect(isConversationActionPartitionKeyV1('unknown')).toBe(false);
    expect(isConversationActionStateV1('awaiting_human')).toBe(true);
    expect(isConversationActionStateV1('closed')).toBe(false);
    expect(isConversationActionRiskStateV1('confirmed')).toBe(true);
    expect(isConversationActionRiskStateV1('dismissed')).toBe(false);
  });

  it('declares exact customer and unmatched-contact subject variants', () => {
    expectTypeOf<ConversationActionSubjectV1>().toEqualTypeOf<
      | { kind: 'customer'; customer: CustomerReferenceV1 }
      | { kind: 'unmatched_contact'; label: '待匹配联系人' }
    >();
    expectTypeOf<keyof Extract<ConversationActionSubjectV1, { kind: 'customer' }>>().toEqualTypeOf<
      'kind' | 'customer'
    >();
    expectTypeOf<
      keyof Extract<ConversationActionSubjectV1, { kind: 'unmatched_contact' }>
    >().toEqualTypeOf<'kind' | 'label'>();
  });

  it('declares the exact low-sensitivity assignee shape', () => {
    expectTypeOf<ConversationActionAssigneeV1>().toEqualTypeOf<{
      userId: string;
      displayName: string;
    }>();
    expectTypeOf<keyof ConversationActionAssigneeV1>().toEqualTypeOf<
      'userId' | 'displayName'
    >();
  });

  it('locks all fifteen item fields and their exact public types', () => {
    expectTypeOf<keyof ConversationActionItemV1>().toEqualTypeOf<
      | 'conversationId'
      | 'segmentId'
      | 'sourceVersion'
      | 'production'
      | 'subject'
      | 'conversationState'
      | 'riskState'
      | 'partitions'
      | 'sortSignals'
      | 'lastCustomerMessageAt'
      | 'slaAt'
      | 'priority'
      | 'assignee'
      | 'safeSummary'
      | 'detailHref'
    >();
    expectTypeOf<ConversationActionItemV1['conversationId']>().toEqualTypeOf<string>();
    expectTypeOf<ConversationActionItemV1['segmentId']>().toEqualTypeOf<string>();
    expectTypeOf<ConversationActionItemV1['sourceVersion']>().toEqualTypeOf<string>();
    expectTypeOf<ConversationActionItemV1['production']>().toEqualTypeOf<true>();
    expectTypeOf<ConversationActionItemV1['subject']>().toEqualTypeOf<
      ConversationActionSubjectV1
    >();
    expectTypeOf<ConversationActionItemV1['conversationState']>().toEqualTypeOf<
      'ai_handling' | 'awaiting_human' | 'human_handling' | 'waiting_customer'
    >();
    expectTypeOf<ConversationActionItemV1['riskState']>().toEqualTypeOf<
      'none' | 'unconfirmed' | 'confirmed' | 'resolved'
    >();
    expectTypeOf<ConversationActionItemV1['partitions']>().toEqualTypeOf<
      ConversationActionPartitionKeyV1[]
    >();
    expectTypeOf<ConversationActionItemV1['sortSignals']>().toEqualTypeOf<
      InstitutionActionSortSignalV1[]
    >();
    expectTypeOf<ConversationActionItemV1['lastCustomerMessageAt']>().toEqualTypeOf<string>();
    expectTypeOf<ConversationActionItemV1['slaAt']>().toEqualTypeOf<string | null>();
    expectTypeOf<ConversationActionItemV1['priority']>().toEqualTypeOf<'normal' | 'high'>();
    expectTypeOf<ConversationActionItemV1['assignee']>().toEqualTypeOf<
      ConversationActionAssigneeV1 | null
    >();
    expectTypeOf<ConversationActionItemV1['safeSummary']>().toEqualTypeOf<string | null>();
    expectTypeOf<ConversationActionItemV1['detailHref']>().toEqualTypeOf<
      `/hospital/conversations/${string}`
    >();
  });

  it('keeps payload and source declarations structurally exact', () => {
    expectTypeOf<keyof ConversationActionPayloadV1>().toEqualTypeOf<'actions'>();
    expectTypeOf<ConversationActionPayloadV1['actions']>().toEqualTypeOf<
      ConversationActionItemV1[]
    >();
    expectTypeOf<ConversationActionSourceV1>().toEqualTypeOf<
      InstitutionSourceEnvelopeV1<
        ConversationActionPayloadV1,
        ConversationActionPartitionKeyV1
      >
    >();
  });

  it('provides declaration fixtures for customer and unmatched-contact actions', () => {
    const customer = {
      contractVersion: 'v1',
      customerId: 'customer-safe-reference',
      displayName: '客户',
      maskedReference: '客户-001',
    } satisfies CustomerReferenceV1;

    const waitingHuman = {
      conversationId: 'conversation-safe-reference',
      segmentId: 'segment-safe-reference',
      sourceVersion: 'source-version-safe-reference',
      production: true,
      subject: { kind: 'customer', customer },
      conversationState: 'awaiting_human',
      riskState: 'none',
      partitions: ['waiting_human'],
      sortSignals: ['sla_due'],
      lastCustomerMessageAt: '2026-07-17T02:00:00.000Z',
      slaAt: '2026-07-17T02:05:00.000Z',
      priority: 'high',
      assignee: null,
      safeSummary: null,
      detailHref: '/hospital/conversations/conversation-safe-reference',
    } satisfies ConversationActionItemV1;

    const unmatchedRisk = {
      conversationId: 'conversation-unmatched-safe-reference',
      segmentId: 'segment-unmatched-safe-reference',
      sourceVersion: 'source-version-safe-reference',
      production: true,
      subject: { kind: 'unmatched_contact', label: '待匹配联系人' },
      conversationState: 'human_handling',
      riskState: 'confirmed',
      partitions: ['unresolved_risk'],
      sortSignals: ['urgent'],
      lastCustomerMessageAt: '2026-07-17T02:00:00.000Z',
      slaAt: null,
      priority: 'high',
      assignee: { userId: 'user-safe-reference', displayName: '机构成员' },
      safeSummary: '需要人工确认风险',
      detailHref: '/hospital/conversations/conversation-unmatched-safe-reference',
    } satisfies ConversationActionItemV1;

    expect(Object.keys(waitingHuman).sort()).toEqual(Object.keys(unmatchedRisk).sort());
    expect(waitingHuman.subject.kind).toBe('customer');
    expect(unmatchedRisk.subject).toEqual({
      kind: 'unmatched_contact',
      label: '待匹配联系人',
    });
  });
});
