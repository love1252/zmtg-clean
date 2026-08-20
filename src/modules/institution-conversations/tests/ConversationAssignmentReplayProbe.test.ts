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
} as const;

function opaque(prefix: 'ase' | 'asn', seed: string): string {
  const digest = createHash('sha256')
    .update(`${prefix}\n${seed}`, 'utf8')
    .digest('hex');
  return `${prefix}_a${digest.slice(1, 32)}`;
}

function idem(requestId: string, segmentId: string): string {
  const seed = `${requestId}\nassign\n${scope.conversationId}\n${segmentId}`;
  const digest = createHash('sha256')
    .update(`idem\n${seed}`, 'utf8')
    .digest('hex');
  return `idem_a${digest.slice(1, 32)}`;
}

function root(activeSegmentId: string | null, lastClosedSegmentId: string | null) {
  return {
    tenantId: scope.tenantId,
    institutionId: scope.institutionId,
    id: scope.conversationId,
    activeSegmentId,
    lastClosedSegmentId,
    lastSegmentClosedAt: lastClosedSegmentId
      ? new Date('2026-08-19T01:03:00.000Z')
      : null,
    lastClosedSegmentInboundMessageId: lastClosedSegmentId ? 'message-a' : null,
    lastClosedSegmentInboundAt: lastClosedSegmentId
      ? new Date('2026-08-19T01:02:30.000Z')
      : null,
    lastClosedSegmentInboundRevision: lastClosedSegmentId ? 1 : null,
    revision: 4,
    updatedAt: new Date('2026-08-19T01:04:00.000Z'),
  };
}

function segment(
  segmentId: string,
  sequenceNo: number,
  state: 'awaiting_human' | 'closed',
) {
  const closed = state === 'closed';
  return {
    tenantId: scope.tenantId,
    institutionId: scope.institutionId,
    id: segmentId,
    conversationId: scope.conversationId,
    sequenceNo,
    state,
    currentHandlerId: null,
    everHumanHandled: closed,
    openedByCustomerMessageId: `message-${sequenceNo}`,
    openedAt: new Date(`2026-08-19T01:0${sequenceNo}:00.000Z`),
    lastCustomerMessageId: `message-${sequenceNo}`,
    lastCustomerMessageAt: new Date(`2026-08-19T01:0${sequenceNo}:00.000Z`),
    latestInboundRevision: 1,
    waitingAfterCustomerMessageId: null,
    waitingAfterCustomerMessageAt: null,
    waitingAfterInboundRevision: null,
    stateChangedAt: new Date(`2026-08-19T01:0${sequenceNo}:30.000Z`),
    closedAt: closed ? new Date('2026-08-19T01:03:00.000Z') : null,
    segmentCloseKind: closed ? 'normal' : 'open',
    resolutionState: closed ? 'resolved' : 'open',
    resolvedAt: closed ? new Date('2026-08-19T01:03:00.000Z') : null,
    blockingReasonCodes: [],
    revision: 2,
    updatedAt: new Date('2026-08-19T01:04:00.000Z'),
  };
}

function assignFact(input: {
  requestId: string;
  segmentId: string;
  assigneeUserId: string;
  actorUserId?: string;
  occurredAt?: Date;
}): typeof conversationAssignments.$inferSelect {
  const key = idem(input.requestId, input.segmentId);
  const occurredAt =
    input.occurredAt ?? new Date('2026-08-19T01:01:30.000Z');
  return {
    tenantId: scope.tenantId,
    institutionId: scope.institutionId,
    eventId: opaque('ase', `${key}\nassign`),
    assignmentId: opaque('asn', `${key}\nassign`),
    conversationId: scope.conversationId,
    segmentId: input.segmentId,
    revision: 1,
    status: 'assigned',
    assigneeUserId: input.assigneeUserId,
    assigneeRole: 'consultant',
    actorUserId: input.actorUserId ?? 'admin-a',
    actorRole: 'tenant_admin',
    reasonCode: 'manual_assign',
    sourceSegmentState: 'awaiting_human',
    occurredAt,
    idempotencyKey: key,
    createdAt: occurredAt,
  };
}

function dbMock(input: {
  rootRow: ReturnType<typeof root>;
  segments: readonly ReturnType<typeof segment>[];
  assignments: readonly (typeof conversationAssignments.$inferSelect)[];
}) {
  let segmentSelectCount = 0;
  let assignmentSelectCount = 0;

  const select = vi.fn(() => ({
    from(table: unknown) {
      if (table === conversations) {
        return { where: vi.fn(async () => [input.rootRow]) };
      }
      if (table === conversationSegments) {
        segmentSelectCount += 1;
        if (segmentSelectCount === 1) {
          return {
            where: vi.fn(() => ({
              orderBy: vi.fn(async () =>
                input.segments.map((row) => ({ segmentId: row.id }))),
            })),
          };
        }
        const currentId =
          input.rootRow.activeSegmentId ?? input.rootRow.lastClosedSegmentId;
        return {
          where: vi.fn(async () =>
            input.segments.filter((row) => row.id === currentId)),
        };
      }
      if (table === conversationAssignments) {
        assignmentSelectCount += 1;
        if (assignmentSelectCount === 1) {
          return {
            where: vi.fn(() => ({
              orderBy: vi.fn(async () => [...input.assignments]),
            })),
          };
        }
        const currentId =
          input.rootRow.activeSegmentId ?? input.rootRow.lastClosedSegmentId;
        return {
          where: vi.fn(() => ({
            orderBy: vi.fn(async () =>
              input.assignments.filter((row) => row.segmentId === currentId)),
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

  return { database: { select } as unknown as TenantDatabase };
}

function probeInput(requestId: string, assigneeUserId: string) {
  return {
    tenantId: scope.tenantId,
    institutionId: scope.institutionId,
    conversationId: scope.conversationId,
    requestId,
    actorUserId: 'admin-a',
    operation: {
      kind: 'assign' as const,
      assigneeUserId,
    },
  };
}

describe('Conversation assignment persisted replay probe', () => {
  it('replays from the historical segment after a later active segment replaces it', async () => {
    const requestId = 'request-historical-active-001';
    const db = dbMock({
      rootRow: root('segment-b', 'segment-a'),
      segments: [
        segment('segment-a', 1, 'closed'),
        segment('segment-b', 2, 'awaiting_human'),
      ],
      assignments: [
        assignFact({
          requestId,
          segmentId: 'segment-a',
          assigneeUserId: 'consultant-a',
        }),
      ],
    });

    await expect(
      readConversationAssignmentReplayV1(
        db.database,
        probeInput(requestId, 'consultant-a'),
      ),
    ).resolves.toMatchObject({
      kind: 'replayed',
      record: {
        segment: {
          value: { segmentId: 'segment-b' },
          hasRiskFacts: false,
        },
      },
    });
  });

  it('replays from the closed historical segment when there is no active segment', async () => {
    const requestId = 'request-historical-closed-001';
    const db = dbMock({
      rootRow: root(null, 'segment-a'),
      segments: [segment('segment-a', 1, 'closed')],
      assignments: [
        assignFact({
          requestId,
          segmentId: 'segment-a',
          assigneeUserId: 'consultant-a',
        }),
      ],
    });

    await expect(
      readConversationAssignmentReplayV1(
        db.database,
        probeInput(requestId, 'consultant-a'),
      ),
    ).resolves.toMatchObject({
      kind: 'replayed',
      record: {
        segment: {
          value: { segmentId: 'segment-a', state: 'closed' },
        },
      },
    });
  });

  it('does not let a different historical payload block legal requestId reuse on a later segment', async () => {
    const requestId = 'request-reuse-new-segment-001';
    const db = dbMock({
      rootRow: root('segment-b', 'segment-a'),
      segments: [
        segment('segment-a', 1, 'closed'),
        segment('segment-b', 2, 'awaiting_human'),
      ],
      assignments: [
        assignFact({
          requestId,
          segmentId: 'segment-a',
          assigneeUserId: 'consultant-old',
        }),
      ],
    });

    await expect(
      readConversationAssignmentReplayV1(
        db.database,
        probeInput(requestId, 'consultant-new'),
      ),
    ).resolves.toEqual({ kind: 'not_replayed' });
  });

  it('fails closed when multiple historical segments are exact replay matches', async () => {
    const requestId = 'request-historical-ambiguous-001';
    const db = dbMock({
      rootRow: root('segment-c', 'segment-b'),
      segments: [
        segment('segment-a', 1, 'closed'),
        segment('segment-b', 2, 'closed'),
        segment('segment-c', 3, 'awaiting_human'),
      ],
      assignments: [
        assignFact({
          requestId,
          segmentId: 'segment-a',
          assigneeUserId: 'consultant-a',
          occurredAt: new Date('2026-08-19T01:01:30.000Z'),
        }),
        assignFact({
          requestId,
          segmentId: 'segment-b',
          assigneeUserId: 'consultant-a',
          occurredAt: new Date('2026-08-19T01:02:30.000Z'),
        }),
      ],
    });

    await expect(
      readConversationAssignmentReplayV1(
        db.database,
        probeInput(requestId, 'consultant-a'),
      ),
    ).resolves.toEqual({ kind: 'idempotency_conflict' });
  });

  it('active mismatch does not mask one exact historical replay', async () => {
    const requestId = 'request-active-mismatch-historical-exact-001';
    const db = dbMock({
      rootRow: root('segment-b', 'segment-a'),
      segments: [
        segment('segment-a', 1, 'closed'),
        segment('segment-b', 2, 'awaiting_human'),
      ],
      assignments: [
        assignFact({
          requestId,
          segmentId: 'segment-a',
          assigneeUserId: 'consultant-old',
        }),
        assignFact({
          requestId,
          segmentId: 'segment-b',
          assigneeUserId: 'consultant-new',
        }),
      ],
    });

    await expect(readConversationAssignmentReplayV1(db.database, {
      ...probeInput(requestId, 'consultant-old'),
      expectedConversationRevision: 1,
      expectedAssignmentRevision: 0,
    })).resolves.toMatchObject({
      kind: 'replayed',
      record: {
        segment: {
          value: { segmentId: 'segment-b' },
          assignment: { assigneeUserId: 'consultant-new' },
        },
      },
    });
  });

  it('active and historical exact matches remain ambiguous and fail closed', async () => {
    const requestId = 'request-active-historical-double-exact-001';
    const db = dbMock({
      rootRow: root('segment-b', 'segment-a'),
      segments: [
        segment('segment-a', 1, 'closed'),
        segment('segment-b', 2, 'awaiting_human'),
      ],
      assignments: [
        assignFact({
          requestId,
          segmentId: 'segment-a',
          assigneeUserId: 'consultant-a',
        }),
        assignFact({
          requestId,
          segmentId: 'segment-b',
          assigneeUserId: 'consultant-a',
        }),
      ],
    });

    await expect(readConversationAssignmentReplayV1(db.database, {
      ...probeInput(requestId, 'consultant-a'),
      expectedConversationRevision: 1,
      expectedAssignmentRevision: 0,
    })).resolves.toEqual({ kind: 'idempotency_conflict' });
  });

  it('current root revision treats a historical exact candidate as legal later-segment reuse', async () => {
    const requestId = 'request-current-write-intent-reuse-001';
    const db = dbMock({
      rootRow: root('segment-b', 'segment-a'),
      segments: [
        segment('segment-a', 1, 'closed'),
        segment('segment-b', 2, 'awaiting_human'),
      ],
      assignments: [
        assignFact({
          requestId,
          segmentId: 'segment-a',
          assigneeUserId: 'consultant-a',
        }),
      ],
    });

    await expect(readConversationAssignmentReplayV1(db.database, {
      ...probeInput(requestId, 'consultant-a'),
      expectedConversationRevision: 4,
      expectedAssignmentRevision: 0,
    })).resolves.toEqual({ kind: 'not_replayed' });
  });

});
