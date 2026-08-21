import { describe, expect, it } from 'vitest';

import { projectConversationActionSource } from '@/modules/institution-conversations/domain/conversation-action-projection';

const observedAt = '2026-08-21T00:00:00.000Z';
const freshUntil = '2026-08-21T00:05:00.000Z';

describe('Conversation Action customer reference', () => {
  it('接受正式 CustomerReferenceV1 的 null maskedReference', () => {
    const sourceVersion = 'srcv_null_masked_reference_001';

    const result = projectConversationActionSource({
      scope: {
        tenantId: 'tenant-001',
        institutionId: 'institution-001',
      },
      viewer: {
        authority: 'server_authorized',
        role: 'tenant_admin',
        userId: 'account-001',
      },
      freshness: {
        observedAt,
        freshUntil,
      },
      partitions: [
        {
          key: 'waiting_human',
          readiness: 'ready',
          freshness: { observedAt, freshUntil },
          failureCode: null,
        },
        {
          key: 'unresolved_risk',
          readiness: 'ready',
          freshness: { observedAt, freshUntil },
          failureCode: null,
        },
      ],
      candidates: [
        {
          productionEvidence: {
            kind: 'server_persisted_current',
            tenantId: 'tenant-001',
            institutionId: 'institution-001',
            conversationId: 'conversation-001',
            segmentId: 'segment-001',
            sourceVersion,
          },
          conversation: {
            conversationId: 'conversation-001',
            tenantId: 'tenant-001',
            institutionId: 'institution-001',
            channelType: 'wechat_work',
            serviceProviderType: 'wecom',
            connectionInstanceId: 'connection-001',
            channelConversationRef: 'channel-conversation-001',
            customerReference: {
              contractVersion: 'v1',
              customerId: 'customer-001',
              displayName: '张女士',
              maskedReference: null,
            },
            identityState: 'matched',
            activeSegmentId: 'segment-001',
            latestCustomerInboundMessageId: 'message-001',
            latestCustomerInboundAt: observedAt,
            latestCustomerInboundRevision: 1,
            lastClosedSegmentId: null,
            lastSegmentClosedAt: null,
            lastClosedSegmentInboundMessageId: null,
            lastClosedSegmentInboundAt: null,
            lastClosedSegmentInboundRevision: null,
            identityUpdatedAt: observedAt,
            segmentUpdatedAt: observedAt,
            createdAt: observedAt,
            updatedAt: observedAt,
          },
          segment: {
            tenantId: 'tenant-001',
            institutionId: 'institution-001',
            segmentId: 'segment-001',
            conversationId: 'conversation-001',
            sequenceNo: 1,
            state: 'awaiting_human',
            currentHandlerId: null,
            everHumanHandled: false,
            openedByCustomerMessageId: 'message-001',
            openedAt: observedAt,
            lastCustomerMessageId: 'message-001',
            lastCustomerMessageAt: observedAt,
            latestInboundRevision: 1,
            waitingAfterCustomerMessageId: null,
            waitingAfterCustomerMessageAt: null,
            waitingAfterInboundRevision: null,
            stateChangedAt: observedAt,
            closedAt: null,
            segmentCloseKind: 'open',
            resolutionState: 'open',
            resolvedAt: null,
            blockingReasonCodes: [],
          },
          assignment: {
            tenantId: 'tenant-001',
            institutionId: 'institution-001',
            conversationId: 'conversation-001',
            segmentId: 'segment-001',
            revision: 0,
            assignmentId: null,
            assigneeRole: null,
            assignmentStatus: null,
            activeAssignmentCount: 0,
            assigneeId: null,
          },
          risk: {
            state: 'none',
          },
          lastCustomerMessage: {
            tenantId: 'tenant-001',
            institutionId: 'institution-001',
            messageId: 'message-001',
            conversationId: 'conversation-001',
            segmentId: 'segment-001',
            direction: 'inbound',
            senderKind: 'customer',
            occurredAt: observedAt,
            receivedAt: observedAt,
            authorizedContentReference:
              'content:authorized:ref_a123456789abcdef',
            safeSummary: {
              code: 'customer_message_received',
              text: '已收到客户消息。',
            },
            sourceMessageRef:
              'source:message:ref_a123456789abcdef',
            idempotencyKey: 'idem_action_source_001',
          },
          approved: {
            sourceVersion,
            sortSignals: [],
            slaAt: null,
            priority: 'normal',
            assignee: null,
          },
        },
      ],
    });

    expect(result.kind).toBe('projected');
    if (result.kind !== 'projected') {
      throw new Error('expected projected');
    }

    expect(result.source.readiness).toBe('ready');
    expect(result.source.data?.actions).toHaveLength(1);
    expect(result.source.data?.actions[0]?.subject).toEqual({
      kind: 'customer',
      customer: {
        contractVersion: 'v1',
        customerId: 'customer-001',
        displayName: '张女士',
        maskedReference: null,
      },
    });
  });
});
