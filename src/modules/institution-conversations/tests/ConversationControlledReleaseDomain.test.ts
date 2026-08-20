import { describe, expect, it } from 'vitest';

import { recoverHumanHandlingForReassignment, releaseHumanHandling } from '@/modules/institution-conversations/domain/conversation-segments';
import type { ConversationSegment } from '@/modules/institution-conversations/domain/conversation-segments';

const base: ConversationSegment = {
  tenantId: 'tenant-1',
  institutionId: 'institution-1',
  segmentId: 'segment-1',
  conversationId: 'conversation-1',
  sequenceNo: 1,
  state: 'human_handling',
  currentHandlerId: 'operator-1',
  everHumanHandled: true,
  openedByCustomerMessageId: 'message-1',
  openedAt: '2026-08-19T01:00:00.000Z',
  lastCustomerMessageId: 'message-1',
  lastCustomerMessageAt: '2026-08-19T01:00:00.000Z',
  latestInboundRevision: 1,
  waitingAfterCustomerMessageId: null,
  waitingAfterCustomerMessageAt: null,
  waitingAfterInboundRevision: null,
  stateChangedAt: '2026-08-19T01:01:00.000Z',
  closedAt: null,
  segmentCloseKind: 'open',
  resolutionState: 'open',
  resolvedAt: null,
  blockingReasonCodes: [],
};

describe('conversation controlled release domain', () => {
  it('current handler can release human handling back to awaiting_human without enabling AI', () => {
    const result = releaseHumanHandling(base, {
      operatorId: 'operator-1',
      occurredAt: '2026-08-19T01:02:00.000Z',
    });
    expect(result).toMatchObject({
      kind: 'applied',
      segment: {
        state: 'awaiting_human',
        currentHandlerId: null,
        everHumanHandled: true,
      },
    });
  });

  it('non-handler and AI/closed states fail closed', () => {
    expect(releaseHumanHandling(base, {
      operatorId: 'operator-2',
      occurredAt: '2026-08-19T01:02:00.000Z',
    })).toEqual({ kind: 'blocked', code: 'operator_not_current_handler' });

    expect(releaseHumanHandling({ ...base, state: 'ai_handling', currentHandlerId: null }, {
      operatorId: 'operator-1',
      occurredAt: '2026-08-19T01:02:00.000Z',
    })).toEqual({ kind: 'blocked', code: 'transition_not_allowed' });
  });
  it.each(['human_handling', 'waiting_customer'] as const)(
    '管理恢复改派可从 %s 清除旧 handler 并返回 awaiting_human',
    (state) => {
      const result = recoverHumanHandlingForReassignment(
        {
          ...base,
          state,
          waitingAfterCustomerMessageId: state === 'waiting_customer' ? 'message-1' : null,
          waitingAfterCustomerMessageAt: state === 'waiting_customer'
            ? '2026-08-19T01:00:00.000Z'
            : null,
          waitingAfterInboundRevision: state === 'waiting_customer' ? 1 : null,
        },
        {
          expectedHandlerId: 'operator-1',
          occurredAt: '2026-08-19T01:02:00.000Z',
        },
      );
      expect(result).toMatchObject({
        kind: 'applied',
        segment: {
          state: 'awaiting_human',
          currentHandlerId: null,
          everHumanHandled: true,
          waitingAfterCustomerMessageId: null,
          waitingAfterCustomerMessageAt: null,
          waitingAfterInboundRevision: null,
        },
      });
    },
  );

  it('管理恢复改派要求旧 active assignee 与 current handler 精确一致', () => {
    expect(recoverHumanHandlingForReassignment(base, {
      expectedHandlerId: 'operator-2',
      occurredAt: '2026-08-19T01:02:00.000Z',
    })).toEqual({ kind: 'blocked', code: 'operator_not_active_assignee' });
  });

});
