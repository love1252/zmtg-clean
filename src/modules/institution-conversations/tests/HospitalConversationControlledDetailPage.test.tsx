import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ConversationControlledDetailShell } from '@/modules/institution-conversations/components/ConversationControlledDetailShell';

const record = {
  contractVersion: 'v1' as const,
  conversationId: 'conversation-1',
  conversationRevision: 3,
  updatedAt: '2026-08-19T01:00:00.000Z',
  activeSegment: {
    segmentId: 'segment-1',
    state: 'awaiting_human' as const,
    revision: 4,
    currentHandlerId: null,
    everHumanHandled: false,
    resolutionState: 'open' as const,
    segmentCloseKind: 'open' as const,
    blockingReasonCodes: [],
    assignmentRevision: 1,
    assignment: {
      assignmentId: 'assignment-1',
      assigneeUserId: 'account-1',
      assigneeRole: 'customer_service' as const,
      status: 'assigned' as const,
    },
  },
  permissions: {
    canRequestHuman: false,
    canAssign: false,
    canReassign: false,
    canTakeover: true,
    canReleaseTakeover: false,
    canMarkWaitingCustomer: false,
    canClose: false,
  },
};

describe('Hospital Conversation controlled detail', () => {
  it('shows only server-authorized controls and keeps message automation absent', () => {
    render(<ConversationControlledDetailShell record={record} />);
    expect(screen.getByRole('heading', { name: '会话处置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '接管会话' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '解除接管' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '发送消息' })).not.toBeInTheDocument();
  });
});
