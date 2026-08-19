import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows only server-authorized controls and keeps message automation absent', () => {
    render(<ConversationControlledDetailShell record={record} />);
    expect(screen.getByRole('heading', { name: '会话处置' })).toBeInTheDocument();
    expect(screen.getByText('会话受控处置')).toBeInTheDocument();
    expect(screen.getByText('会话编号')).toBeInTheDocument();
    expect(screen.getByText('account-1 / 已分配')).toBeInTheDocument();
    expect(screen.queryByText('CONVERSATION CONTROLLED WRITE')).not.toBeInTheDocument();
    expect(screen.queryByText('Conversation')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '接管会话' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '解除接管' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '发送消息' })).not.toBeInTheDocument();
  });

  it('maps a known server error code to Chinese without rendering the raw contract value', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(
        JSON.stringify({ kind: 'conflict', code: 'revision_conflict' }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      )),
    );

    render(<ConversationControlledDetailShell record={record} />);
    fireEvent.click(screen.getByRole('button', { name: '接管会话' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        '会话状态已变化，请刷新后重试。',
      );
    });
    expect(screen.queryByText('revision_conflict')).not.toBeInTheDocument();
  });

  it('uses a Chinese fallback for an unknown server error code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(
        JSON.stringify({ kind: 'unavailable', code: 'future_internal_code' }),
        { status: 503, headers: { 'content-type': 'application/json' } },
      )),
    );

    render(<ConversationControlledDetailShell record={record} />);
    fireEvent.click(screen.getByRole('button', { name: '接管会话' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        '当前无法完成操作，请刷新后重试。',
      );
    });
    expect(screen.queryByText('future_internal_code')).not.toBeInTheDocument();
  });

  it('reuses the exact request id and body after an uncertain transport failure', async () => {
    const bodies: string[] = [];
    let attempt = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: unknown, init?: RequestInit) => {
        bodies.push(String(init?.body ?? ''));
        attempt += 1;
        if (attempt === 1) {
          throw new TypeError('simulated_transport_loss');
        }
        return new Response(
          JSON.stringify({ kind: 'ready', record }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );

    render(<ConversationControlledDetailShell record={record} />);
    const button = screen.getByRole('button', { name: '接管会话' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        '操作结果尚未确认，请再次执行相同操作。',
      );
    });

    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('操作已完成。');
    });

    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toBe(bodies[0]);
    const first = JSON.parse(bodies[0]!) as { requestId?: unknown };
    const second = JSON.parse(bodies[1]!) as { requestId?: unknown };
    expect(typeof first.requestId).toBe('string');
    expect(second.requestId).toBe(first.requestId);
  });

});
