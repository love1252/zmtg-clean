import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { executeConversationCommandV1 } from '@/modules/institution-conversations/server/conversation-command-repository';
import type { TenantDatabase } from '@/server/db/client';
import {
  conversationAssignments,
  conversationSegments,
  conversations,
} from '@/server/db/schema';

const scope = {
  tenantId: 'tenant-a',
  institutionId: 'institution-a',
  conversationId: 'conversation-a',
  segmentId: 'segment-a',
} as const;

function opaque(prefix: 'ase' | 'asn', seed: string): string {
  const digest = createHash('sha256').update(`${prefix}\n${seed}`, 'utf8').digest('hex');
  return `${prefix}_a${digest.slice(1, 32)}`;
}

function idem(requestId: string, kind: 'assign' | 'reassign'): string {
  const seed = `${requestId}\n${kind}\n${scope.conversationId}\n${scope.segmentId}`;
  const digest = createHash('sha256').update(`idem\n${seed}`, 'utf8').digest('hex');
  return `idem_a${digest.slice(1, 32)}`;
}

function event(key: string, slot: string): string {
  return opaque('ase', `${key}\n${slot}`);
}

function assignment(key: string, slot: string): string {
  return opaque('asn', `${key}\n${slot}`);
}

function root() {
  return {
    tenantId: scope.tenantId,
    institutionId: scope.institutionId,
    id: scope.conversationId,
    activeSegmentId: scope.segmentId,
    lastClosedSegmentId: null,
    lastSegmentClosedAt: null,
    lastClosedSegmentInboundMessageId: null,
    lastClosedSegmentInboundAt: null,
    lastClosedSegmentInboundRevision: null,
    revision: 2,
    updatedAt: new Date('2026-08-19T01:02:00.000Z'),
  };
}

function segment() {
  return {
    tenantId: scope.tenantId,
    institutionId: scope.institutionId,
    id: scope.segmentId,
    conversationId: scope.conversationId,
    sequenceNo: 1,
    state: 'awaiting_human',
    currentHandlerId: null,
    everHumanHandled: false,
    openedByCustomerMessageId: 'message-inbound-a',
    openedAt: new Date('2026-08-19T01:00:00.000Z'),
    lastCustomerMessageId: 'message-inbound-a',
    lastCustomerMessageAt: new Date('2026-08-19T01:00:00.000Z'),
    latestInboundRevision: 1,
    waitingAfterCustomerMessageId: null,
    waitingAfterCustomerMessageAt: null,
    waitingAfterInboundRevision: null,
    stateChangedAt: new Date('2026-08-19T01:01:00.000Z'),
    closedAt: null,
    segmentCloseKind: 'open',
    resolutionState: 'open',
    resolvedAt: null,
    blockingReasonCodes: [],
    revision: 2,
    updatedAt: new Date('2026-08-19T01:02:00.000Z'),
  };
}

type AssignmentRow = {
  tenantId: string;
  institutionId: string;
  eventId: string;
  assignmentId: string;
  conversationId: string;
  segmentId: string;
  revision: number;
  status: 'assigned' | 'accepted' | 'rejected' | 'released';
  assigneeUserId: string;
  assigneeRole: 'tenant_admin' | 'tenant_operator' | 'consultant' | 'customer_service';
  actorUserId: string;
  actorRole: 'tenant_admin' | 'tenant_operator' | 'consultant' | 'customer_service';
  reasonCode: 'manual_assign' | 'manual_reassign' | 'manual_fallback' | 'assignee_reject' | 'handler_release';
  sourceSegmentState: 'ai_handling' | 'awaiting_human' | 'human_handling' | 'waiting_customer' | 'closed';
  occurredAt: Date;
  idempotencyKey: string;
};

function dbMock(rows: readonly AssignmentRow[]) {
  const update = vi.fn();
  const insert = vi.fn();
  const select = vi.fn(() => ({
    from(table: unknown) {
      if (table === conversations) {
        return { where: vi.fn(async () => [root()]) };
      }
      if (table === conversationSegments) {
        return { where: vi.fn(async () => [segment()]) };
      }
      if (table === conversationAssignments) {
        return {
          where: vi.fn(() => ({
            orderBy: vi.fn(async () => [...rows]),
          })),
        };
      }
      throw new Error('unexpected_select_table');
    },
  }));
  return {
    database: { select, update, insert } as unknown as TenantDatabase,
    update,
    insert,
  };
}

describe('ConversationCommandRepository idempotent transport replay', () => {
  it('assign retry replays before stale revision and performs zero writes', async () => {
    const requestId = 'request-assign-001';
    const key = idem(requestId, 'assign');
    const occurredAt = new Date('2026-08-19T01:01:30.000Z');
    const db = dbMock([{
      ...scope,
      eventId: event(key, 'assign'),
      assignmentId: assignment(key, 'assign'),
      revision: 1,
      status: 'assigned',
      assigneeUserId: 'customer-service-a',
      assigneeRole: 'customer_service',
      actorUserId: 'admin-a',
      actorRole: 'tenant_admin',
      reasonCode: 'manual_assign',
      sourceSegmentState: 'awaiting_human',
      occurredAt,
      idempotencyKey: key,
    }]);

    await expect(executeConversationCommandV1(db.database, {
      tenantId: scope.tenantId,
      institutionId: scope.institutionId,
      conversationId: scope.conversationId,
      expectedConversationRevision: 1,
      expectedSegmentRevision: 1,
      expectedAssignmentRevision: 0,
      requestId,
      actor: { userId: 'admin-a', role: 'tenant_admin' },
      operation: {
        kind: 'assign',
        assigneeUserId: 'customer-service-a',
        assigneeRole: 'customer_service',
      },
    })).resolves.toMatchObject({
      kind: 'replayed',
      occurredAt: occurredAt.toISOString(),
      record: {
        conversationRevision: 2,
        segment: {
          revision: 2,
          assignmentRevision: 1,
          assignment: { assigneeUserId: 'customer-service-a', status: 'assigned' },
        },
      },
    });
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('reassign retry replays; changed payload returns idempotency_conflict before stale revision', async () => {
    const originalKey = 'idem_abbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const oldAssignmentId = 'asn_accccccccccccccccccccccccccccccc';
    const requestId = 'request-reassign-001';
    const key = idem(requestId, 'reassign');
    const occurredAt = new Date('2026-08-19T01:01:45.000Z');
    const rows: AssignmentRow[] = [
      {
        ...scope,
        eventId: 'ase_addddddddddddddddddddddddddddddd',
        assignmentId: oldAssignmentId,
        revision: 1,
        status: 'assigned',
        assigneeUserId: 'customer-service-a',
        assigneeRole: 'customer_service',
        actorUserId: 'admin-a',
        actorRole: 'tenant_admin',
        reasonCode: 'manual_assign',
        sourceSegmentState: 'awaiting_human',
        occurredAt: new Date('2026-08-19T01:01:20.000Z'),
        idempotencyKey: originalKey,
      },
      {
        ...scope,
        eventId: event(key, 'reassign-release'),
        assignmentId: oldAssignmentId,
        revision: 2,
        status: 'released',
        assigneeUserId: 'customer-service-a',
        assigneeRole: 'customer_service',
        actorUserId: 'admin-a',
        actorRole: 'tenant_admin',
        reasonCode: 'manual_reassign',
        sourceSegmentState: 'awaiting_human',
        occurredAt,
        idempotencyKey: key,
      },
      {
        ...scope,
        eventId: event(key, 'reassign-assign'),
        assignmentId: assignment(key, 'reassign'),
        revision: 3,
        status: 'assigned',
        assigneeUserId: 'customer-service-b',
        assigneeRole: 'customer_service',
        actorUserId: 'admin-a',
        actorRole: 'tenant_admin',
        reasonCode: 'manual_reassign',
        sourceSegmentState: 'awaiting_human',
        occurredAt,
        idempotencyKey: key,
      },
    ];
    const db = dbMock(rows);
    const base = {
      tenantId: scope.tenantId,
      institutionId: scope.institutionId,
      conversationId: scope.conversationId,
      expectedConversationRevision: 1,
      expectedSegmentRevision: 1,
      expectedAssignmentRevision: 1,
      requestId,
      actor: { userId: 'admin-a', role: 'tenant_admin' as const },
    };

    await expect(executeConversationCommandV1(db.database, {
      ...base,
      operation: {
        kind: 'reassign',
        assigneeUserId: 'customer-service-b',
        assigneeRole: 'customer_service',
      },
    })).resolves.toMatchObject({
      kind: 'replayed',
      occurredAt: occurredAt.toISOString(),
      record: {
        conversationRevision: 2,
        segment: {
          revision: 2,
          assignmentRevision: 3,
          assignment: { assigneeUserId: 'customer-service-b', status: 'assigned' },
        },
      },
    });

    await expect(executeConversationCommandV1(db.database, {
      ...base,
      operation: {
        kind: 'reassign',
        assigneeUserId: 'customer-service-c',
        assigneeRole: 'customer_service',
      },
    })).resolves.toEqual({ kind: 'blocked', code: 'idempotency_conflict' });

    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });
});
