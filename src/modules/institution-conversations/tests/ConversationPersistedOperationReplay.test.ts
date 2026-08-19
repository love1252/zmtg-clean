import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { readConversationAssignmentReplayV1 } from '@/modules/institution-conversations/server/conversation-command-repository';
import type { TenantDatabase } from '@/server/db/client';
import {
  conversationAssignments,
  conversationRisks,
  conversationSegments,
  conversations,
} from '@/server/db/schema';

const scope = {
  tenantId: 'tenant-a',
  institutionId: 'institution-a',
  conversationId: 'conversation-a',
  segmentId: 'segment-a',
} as const;

type AssignmentRow = typeof conversationAssignments.$inferSelect;
type SegmentRow = typeof conversationSegments.$inferSelect;
type RootRow = typeof conversations.$inferSelect;

function hash(prefix: 'ase' | 'asn', seed: string): string {
  const digest = createHash('sha256')
    .update(`${prefix}\n${seed}`, 'utf8')
    .digest('hex');
  return `${prefix}_a${digest.slice(1, 32)}`;
}

function idem(
  requestId: string,
  kind: 'takeover' | 'release_takeover' | 'close',
): string {
  const seed = `${requestId}\n${kind}\n${scope.conversationId}\n${scope.segmentId}`;
  const digest = createHash('sha256')
    .update(`idem\n${seed}`, 'utf8')
    .digest('hex');
  return `idem_a${digest.slice(1, 32)}`;
}

const baseAssignmentId = 'asn_accccccccccccccccccccccccccccccc';
const seedIdempotency = 'idem_abbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function assignedRow(): AssignmentRow {
  const at = new Date('2026-08-19T01:01:00.000Z');
  return {
    tenantId: scope.tenantId,
    institutionId: scope.institutionId,
    eventId: 'ase_addddddddddddddddddddddddddddddd',
    assignmentId: baseAssignmentId,
    conversationId: scope.conversationId,
    segmentId: scope.segmentId,
    revision: 1,
    status: 'assigned',
    assigneeUserId: 'agent-a',
    assigneeRole: 'customer_service',
    actorUserId: 'admin-a',
    actorRole: 'tenant_admin',
    reasonCode: 'manual_assign',
    sourceSegmentState: 'awaiting_human',
    occurredAt: at,
    idempotencyKey: seedIdempotency,
    createdAt: at,
  };
}

function acceptedSeedRow(): AssignmentRow {
  const at = new Date('2026-08-19T01:02:00.000Z');
  return {
    tenantId: scope.tenantId,
    institutionId: scope.institutionId,
    eventId: 'ase_aeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    assignmentId: baseAssignmentId,
    conversationId: scope.conversationId,
    segmentId: scope.segmentId,
    revision: 2,
    status: 'accepted',
    assigneeUserId: 'agent-a',
    assigneeRole: 'customer_service',
    actorUserId: 'agent-a',
    actorRole: 'customer_service',
    reasonCode: 'manual_assign',
    sourceSegmentState: 'awaiting_human',
    occurredAt: at,
    idempotencyKey: 'idem_afffffffffffffffffffffffffffffff',
    createdAt: at,
  };
}

function root(
  activeSegmentId: string | null,
  revision: number,
): RootRow {
  return {
    tenantId: scope.tenantId,
    institutionId: scope.institutionId,
    id: scope.conversationId,
    activeSegmentId,
    lastClosedSegmentId: activeSegmentId ? null : scope.segmentId,
    lastSegmentClosedAt: activeSegmentId
      ? null
      : new Date('2026-08-19T01:05:00.000Z'),
    lastClosedSegmentInboundMessageId: activeSegmentId ? null : 'message-a',
    lastClosedSegmentInboundAt: activeSegmentId
      ? null
      : new Date('2026-08-19T01:04:30.000Z'),
    lastClosedSegmentInboundRevision: activeSegmentId ? null : 1,
    segmentUpdatedAt: new Date('2026-08-19T01:05:00.000Z'),
    revision,
    updatedAt: new Date('2026-08-19T01:05:00.000Z'),
    createdAt: new Date('2026-08-19T01:00:00.000Z'),
  } as unknown as RootRow;
}

function segment(input: {
  state: 'human_handling' | 'awaiting_human' | 'closed';
  currentHandlerId: string | null;
  resolutionState?: 'open' | 'resolved';
  closedAt?: Date | null;
}): SegmentRow {
  const closedAt = input.closedAt ?? null;
  return {
    tenantId: scope.tenantId,
    institutionId: scope.institutionId,
    id: scope.segmentId,
    conversationId: scope.conversationId,
    sequenceNo: 1,
    state: input.state,
    currentHandlerId: input.currentHandlerId,
    everHumanHandled: true,
    openedByCustomerMessageId: 'message-a',
    openedAt: new Date('2026-08-19T01:00:00.000Z'),
    lastCustomerMessageId: 'message-a',
    lastCustomerMessageAt: new Date('2026-08-19T01:00:30.000Z'),
    latestInboundRevision: 1,
    waitingAfterCustomerMessageId: null,
    waitingAfterCustomerMessageAt: null,
    waitingAfterInboundRevision: null,
    stateChangedAt: closedAt ?? new Date('2026-08-19T01:04:00.000Z'),
    closedAt,
    segmentCloseKind: input.state === 'closed' ? 'normal' : 'open',
    resolutionState: input.resolutionState ?? 'open',
    resolvedAt:
      (input.resolutionState ?? 'open') === 'resolved'
        ? new Date('2026-08-19T01:03:30.000Z')
        : null,
    blockingReasonCodes: [],
    revision: 5,
    updatedAt: new Date('2026-08-19T01:05:00.000Z'),
    createdAt: new Date('2026-08-19T01:00:00.000Z'),
  } as unknown as SegmentRow;
}

function candidateRow(input: {
  requestId: string;
  kind: 'takeover' | 'release_takeover' | 'close';
  revision: number;
  status: 'accepted' | 'released';
  sourceSegmentState: 'awaiting_human' | 'human_handling';
  occurredAt: Date;
}): AssignmentRow {
  const key = idem(input.requestId, input.kind);
  const slot =
    input.kind === 'takeover'
      ? 'takeover'
      : input.kind === 'close'
        ? 'close-release'
        : 'release-takeover';
  return {
    tenantId: scope.tenantId,
    institutionId: scope.institutionId,
    eventId: hash('ase', `${key}\n${slot}`),
    assignmentId: baseAssignmentId,
    conversationId: scope.conversationId,
    segmentId: scope.segmentId,
    revision: input.revision,
    status: input.status,
    assigneeUserId: 'agent-a',
    assigneeRole: 'customer_service',
    actorUserId: 'agent-a',
    actorRole: 'customer_service',
    reasonCode: input.status === 'released' ? 'handler_release' : 'manual_assign',
    sourceSegmentState: input.sourceSegmentState,
    occurredAt: input.occurredAt,
    idempotencyKey: key,
    createdAt: input.occurredAt,
  };
}

function databaseMock(input: {
  rootRow: RootRow;
  segmentRow: SegmentRow;
  candidateRows: readonly AssignmentRow[];
  fullHistory: readonly AssignmentRow[];
}) {
  let segmentReads = 0;
  let assignmentReads = 0;

  const select = vi.fn(() => ({
    from(table: unknown) {
      if (table === conversations) {
        return { where: vi.fn(async () => [input.rootRow]) };
      }
      if (table === conversationSegments) {
        segmentReads += 1;
        if (segmentReads === 1) {
          return {
            where: vi.fn(() => ({
              orderBy: vi.fn(async () => [{
                segmentId: input.segmentRow.id,
                state: input.segmentRow.state,
                segmentCloseKind: input.segmentRow.segmentCloseKind,
                resolutionState: input.segmentRow.resolutionState,
                closedAt: input.segmentRow.closedAt,
              }]),
            })),
          };
        }
        return { where: vi.fn(async () => [input.segmentRow]) };
      }
      if (table === conversationAssignments) {
        assignmentReads += 1;
        return {
          where: vi.fn(() => ({
            orderBy: vi.fn(async () =>
              assignmentReads === 1
                ? [...input.candidateRows]
                : [...input.fullHistory]),
          })),
        };
      }
      if (table === conversationRisks) {
        return {
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        };
      }
      throw new Error('unexpected_select_table');
    },
  }));

  return { select } as unknown as TenantDatabase;
}

describe('Conversation persisted non-assign operation replay', () => {
  it('replays takeover from its persisted accepted fact', async () => {
    const requestId = 'request-takeover-replay-001';
    const at = new Date('2026-08-19T01:02:30.000Z');
    const candidate = candidateRow({
      requestId,
      kind: 'takeover',
      revision: 2,
      status: 'accepted',
      sourceSegmentState: 'awaiting_human',
      occurredAt: at,
    });
    const db = databaseMock({
      rootRow: root(scope.segmentId, 3),
      segmentRow: segment({
        state: 'human_handling',
        currentHandlerId: 'agent-a',
      }),
      candidateRows: [candidate],
      fullHistory: [assignedRow(), candidate],
    });

    await expect(readConversationAssignmentReplayV1(db, {
      tenantId: scope.tenantId,
      institutionId: scope.institutionId,
      conversationId: scope.conversationId,
      expectedConversationRevision: 2,
      expectedAssignmentRevision: 1,
      requestId,
      actorUserId: 'agent-a',
      operation: { kind: 'takeover' },
    })).resolves.toMatchObject({ kind: 'replayed' });
  });

  it('replays release_takeover from its persisted release fact', async () => {
    const requestId = 'request-release-replay-001';
    const at = new Date('2026-08-19T01:04:00.000Z');
    const candidate = candidateRow({
      requestId,
      kind: 'release_takeover',
      revision: 3,
      status: 'released',
      sourceSegmentState: 'human_handling',
      occurredAt: at,
    });
    const db = databaseMock({
      rootRow: root(scope.segmentId, 4),
      segmentRow: segment({
        state: 'awaiting_human',
        currentHandlerId: null,
      }),
      candidateRows: [candidate],
      fullHistory: [assignedRow(), acceptedSeedRow(), candidate],
    });

    await expect(readConversationAssignmentReplayV1(db, {
      tenantId: scope.tenantId,
      institutionId: scope.institutionId,
      conversationId: scope.conversationId,
      expectedConversationRevision: 3,
      expectedAssignmentRevision: 2,
      requestId,
      actorUserId: 'agent-a',
      operation: { kind: 'release_takeover' },
    })).resolves.toMatchObject({ kind: 'replayed' });
  });

  it('replays close after active segment is cleared and rejects changed close result', async () => {
    const requestId = 'request-close-replay-001';
    const at = new Date('2026-08-19T01:05:00.000Z');
    const candidate = candidateRow({
      requestId,
      kind: 'close',
      revision: 3,
      status: 'released',
      sourceSegmentState: 'human_handling',
      occurredAt: at,
    });
    const makeDb = () => databaseMock({
      rootRow: root(null, 5),
      segmentRow: segment({
        state: 'closed',
        currentHandlerId: 'agent-a',
        resolutionState: 'resolved',
        closedAt: at,
      }),
      candidateRows: [candidate],
      fullHistory: [assignedRow(), acceptedSeedRow(), candidate],
    });

    await expect(readConversationAssignmentReplayV1(makeDb(), {
      tenantId: scope.tenantId,
      institutionId: scope.institutionId,
      conversationId: scope.conversationId,
      expectedConversationRevision: 4,
      expectedAssignmentRevision: 2,
      requestId,
      actorUserId: 'agent-a',
      operation: { kind: 'close', closeResultCode: 'resolved' },
    })).resolves.toMatchObject({ kind: 'replayed' });

    await expect(readConversationAssignmentReplayV1(makeDb(), {
      tenantId: scope.tenantId,
      institutionId: scope.institutionId,
      conversationId: scope.conversationId,
      expectedConversationRevision: 4,
      expectedAssignmentRevision: 2,
      requestId,
      actorUserId: 'agent-a',
      operation: { kind: 'close', closeResultCode: 'unresolved' },
    })).resolves.toEqual({ kind: 'idempotency_conflict' });
  });
});
