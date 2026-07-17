import { describe, expect, it } from 'vitest';

import {
  projectConversationActionSource,
  type ConversationActionProjectionInput,
} from '@/modules/institution-conversations/domain/conversation-action-projection';

const scope = {
  tenantId: 'ten_aaaaaaaaaaaaaaaa',
  institutionId: 'ins_aaaaaaaaaaaaaaaa',
} as const;
const conversationId = 'con_aaaaaaaaaaaaaaaa';
const segmentId = 'seg_aaaaaaaaaaaaaaaa';
const assigneeId = 'usr_aaaaaaaaaaaaaaaa';
const sourceVersion = 'srcv_aaaaaaaaaaaaaaaa';
const at = '2026-07-18T01:00:00.000Z';
const freshUntil = '2026-07-18T01:10:00.000Z';

const sourceOf = (result: ReturnType<typeof projectConversationActionSource>) => {
  expect(result.kind).toBe('projected');
  if (result.kind !== 'projected') {
    throw new Error('expected projected conversation action source');
  }
  return result.source;
};

const input = (
  overrides: Partial<ConversationActionProjectionInput> = {},
): ConversationActionProjectionInput => ({
  scope,
  viewer: {
    authority: 'server_authorized',
    role: 'tenant_admin',
    userId: 'usr_bbbbbbbbbbbbbbbb',
  },
  freshness: { observedAt: at, freshUntil },
  partitions: [
    {
      key: 'waiting_human',
      readiness: 'ready',
      freshness: { observedAt: at, freshUntil },
      failureCode: null,
    },
    {
      key: 'unresolved_risk',
      readiness: 'ready',
      freshness: { observedAt: at, freshUntil },
      failureCode: null,
    },
  ],
  candidates: [
    {
      productionEvidence: {
        kind: 'server_persisted_current',
        tenantId: scope.tenantId,
        institutionId: scope.institutionId,
        conversationId,
        segmentId,
        sourceVersion,
      },
      conversation: {
        conversationId,
        ...scope,
        channelType: 'approved_channel',
        serviceProviderType: 'approved_service',
        connectionInstanceId: 'connection-safe',
        channelConversationRef: 'conversation-ref-safe',
        customerReference: {
          contractVersion: 'v1',
          customerId: 'customer-safe',
          displayName: '客户',
          maskedReference: '客户-001',
        },
        identityState: 'matched',
        activeSegmentId: segmentId,
        latestCustomerInboundMessageId: 'message-safe',
        latestCustomerInboundAt: at,
        latestCustomerInboundRevision: 1,
        lastClosedSegmentId: null,
        lastSegmentClosedAt: null,
        lastClosedSegmentInboundMessageId: null,
        lastClosedSegmentInboundAt: null,
        lastClosedSegmentInboundRevision: null,
        identityUpdatedAt: at,
        segmentUpdatedAt: at,
        createdAt: at,
        updatedAt: at,
      },
      segment: {
        ...scope,
        segmentId,
        conversationId,
        sequenceNo: 1,
        state: 'awaiting_human',
        currentHandlerId: null,
        everHumanHandled: false,
        openedByCustomerMessageId: 'message-safe',
        openedAt: at,
        lastCustomerMessageId: 'message-safe',
        lastCustomerMessageAt: at,
        latestInboundRevision: 1,
        waitingAfterCustomerMessageId: null,
        waitingAfterCustomerMessageAt: null,
        waitingAfterInboundRevision: null,
        stateChangedAt: at,
        closedAt: null,
        segmentCloseKind: 'open',
        resolutionState: 'open',
        resolvedAt: null,
        blockingReasonCodes: [],
      },
      assignment: {
        ...scope,
        conversationId,
        segmentId,
        revision: 1,
        assignmentId: 'asn_aaaaaaaaaaaaaaaa',
        assigneeRole: 'consultant',
        assignmentStatus: 'accepted',
        activeAssignmentCount: 1,
        assigneeId,
      },
      risk: {
        state: 'confirmed',
        riskId: 'risk-safe',
        ...scope,
        conversationId,
        segmentId,
        sourceMessageId: 'message-safe',
        riskDomain: 'non_clinical',
        riskCode: 'risk_safe',
        detectedAt: at,
        confirmedAt: at,
        resolvedAt: null,
        clinicalClosureReferenceId: null,
      },
      lastCustomerMessage: {
        ...scope,
        messageId: 'message-safe',
        conversationId,
        segmentId,
        direction: 'inbound',
        senderKind: 'customer',
        occurredAt: at,
        receivedAt: at,
        authorizedContentReference: 'content:authorized:ref_aaaaaaaaaaaaaaaa',
        safeSummary: {
          code: 'customer_message_received',
          text: '已收到客户消息。',
        },
        sourceMessageRef: 'source:message:ref_aaaaaaaaaaaaaaaa',
        idempotencyKey: 'idempotency-safe-key-0001',
      },
      approved: {
        sourceVersion,
        sortSignals: ['urgent', 'sla_due'],
        slaAt: '2026-07-18T01:05:00.000Z',
        priority: 'high',
        assignee: { userId: assigneeId, displayName: '机构成员' },
      },
    },
  ],
  ...overrides,
});

describe('conversation action projection', () => {
  it('从可信生产事实投影单条双分区 action，并使用 canonical href', () => {
    const source = sourceOf(projectConversationActionSource(input()));

    expect(source).toMatchObject({
      contractVersion: 'v1',
      scope,
      readiness: 'ready',
      data: {
        actions: [{
          conversationId,
          segmentId,
          sourceVersion,
          production: true,
          subject: { kind: 'customer' },
          conversationState: 'awaiting_human',
          riskState: 'confirmed',
          partitions: ['waiting_human', 'unresolved_risk'],
          sortSignals: ['urgent', 'sla_due'],
          safeSummary: '已收到客户消息。',
          detailHref: `/hospital/conversations/${conversationId}`,
        }],
      },
    });
    expect(source.data?.actions).toHaveLength(1);
  });

  it('身份未匹配时只输出固定标签，不输出渠道或消息身份', () => {
    const candidate = input().candidates[0]!;
    const source = sourceOf(projectConversationActionSource(input({
      candidates: [{
        ...candidate,
        conversation: {
          ...candidate.conversation,
          customerReference: null,
          identityState: 'unmatched',
        },
      }],
    })));

    expect(source.data?.actions[0]?.subject).toEqual({
      kind: 'unmatched_contact',
      label: '待匹配联系人',
    });
  });

  it.each([
    ['tenant_admin', 'usr_bbbbbbbbbbbbbbbb', true],
    ['tenant_operator', 'usr_bbbbbbbbbbbbbbbb', true],
    ['consultant', assigneeId, true],
    ['customer_service', assigneeId, false],
    ['consultant', 'usr_bbbbbbbbbbbbbbbb', false],
  ] as const)('只消费服务端角色范围：%s/%s', (role, userId, visible) => {
    const source = sourceOf(projectConversationActionSource(input({
      viewer: { authority: 'server_authorized', role, userId },
    })));

    expect(source.data?.actions).toHaveLength(visible ? 1 : 0);
  });

  it('未提供显式可信 production evidence 时 fail-closed', () => {
    const candidate = input().candidates[0]!;
    const source = sourceOf(projectConversationActionSource(input({
      candidates: [{
        ...candidate,
        productionEvidence: { ...candidate.productionEvidence, kind: 'untrusted' } as never,
      }],
    })));

    expect(source).toMatchObject({
      readiness: 'unavailable',
      data: null,
      failureCode: 'invalid_payload',
    });
  });

  it('只原样消费批准的排序信号，不从风险或正文推导排序', () => {
    const candidate = input().candidates[0]!;
    const source = sourceOf(projectConversationActionSource(input({
      candidates: [{
        ...candidate,
        approved: { ...candidate.approved, sortSignals: ['today'] },
      }],
    })));

    expect(source.data?.actions[0]?.sortSignals).toEqual(['today']);
    expect(source.data?.actions[0]?.priority).toBe('high');
  });
});
