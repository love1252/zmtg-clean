import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { readConversationAssignmentReplayV1 } from '@/modules/institution-conversations/server/conversation-command-repository';
import type { TenantDatabase } from '@/server/db/client';
import { conversationAssignments, conversationRisks, conversationSegments, conversations } from '@/server/db/schema';

const scope = { tenantId: 'tenant-a', institutionId: 'institution-a', conversationId: 'conversation-a', segmentId: 'segment-a' } as const;
const hash = (prefix: 'ase' | 'asn', seed: string) => { const d = createHash('sha256').update(`${prefix}\n${seed}`, 'utf8').digest('hex'); return `${prefix}_a${d.slice(1, 32)}`; };
const idem = (requestId: string) => { const seed = `${requestId}\nassign\n${scope.conversationId}\n${scope.segmentId}`; const d = createHash('sha256').update(`idem\n${seed}`, 'utf8').digest('hex'); return `idem_a${d.slice(1, 32)}`; };
const root = () => ({ ...scope, id: scope.conversationId, activeSegmentId: scope.segmentId, lastClosedSegmentId: null, lastSegmentClosedAt: null, lastClosedSegmentInboundMessageId: null, lastClosedSegmentInboundAt: null, lastClosedSegmentInboundRevision: null, revision: 2, updatedAt: new Date('2026-08-19T01:02:00.000Z') });
const segment = () => ({ ...scope, id: scope.segmentId, sequenceNo: 1, state: 'awaiting_human', currentHandlerId: null, everHumanHandled: false, openedByCustomerMessageId: 'message-a', openedAt: new Date('2026-08-19T01:00:00.000Z'), lastCustomerMessageId: 'message-a', lastCustomerMessageAt: new Date('2026-08-19T01:00:00.000Z'), latestInboundRevision: 1, waitingAfterCustomerMessageId: null, waitingAfterCustomerMessageAt: null, waitingAfterInboundRevision: null, stateChangedAt: new Date('2026-08-19T01:01:00.000Z'), closedAt: null, segmentCloseKind: 'open', resolutionState: 'open', resolvedAt: null, blockingReasonCodes: [], revision: 2, updatedAt: new Date('2026-08-19T01:02:00.000Z') });
function dbMock(rows: readonly (typeof conversationAssignments.$inferSelect)[]) { const select = vi.fn(() => ({ from(table: unknown) { if (table === conversations) return { where: vi.fn(async () => [root()]) }; if (table === conversationSegments) return { where: vi.fn(async () => [segment()]) }; if (table === conversationAssignments) return { where: vi.fn(() => ({ orderBy: vi.fn(async () => [...rows]) })) }; if (table === conversationRisks) return { where: vi.fn(() => ({ limit: vi.fn(async () => []) })) }; throw new Error('unexpected_select_table'); } })); return { database: { select } as unknown as TenantDatabase }; }

describe('Conversation assignment persisted replay probe', () => {
  it('replays persisted assign without requiring current target Membership or role', async () => {
    const requestId = 'request-assign-probe-001'; const key = idem(requestId); const at = new Date('2026-08-19T01:01:30.000Z');
    const db = dbMock([{ ...scope, eventId: hash('ase', `${key}\nassign`), assignmentId: hash('asn', `${key}\nassign`), revision: 1, status: 'assigned', assigneeUserId: 'consultant-a', assigneeRole: 'consultant', actorUserId: 'admin-a', actorRole: 'tenant_admin', reasonCode: 'manual_assign', sourceSegmentState: 'awaiting_human', occurredAt: at, idempotencyKey: key, createdAt: at }]);
    await expect(readConversationAssignmentReplayV1(db.database, { tenantId: scope.tenantId, institutionId: scope.institutionId, conversationId: scope.conversationId, requestId, actorUserId: 'admin-a', operation: { kind: 'assign', assigneeUserId: 'consultant-a' } })).resolves.toMatchObject({ kind: 'replayed', record: { segment: { hasRiskFacts: false, assignment: { assigneeUserId: 'consultant-a', assigneeRole: 'consultant' } } } });
    await expect(readConversationAssignmentReplayV1(db.database, { tenantId: scope.tenantId, institutionId: scope.institutionId, conversationId: scope.conversationId, requestId, actorUserId: 'admin-a', operation: { kind: 'assign', assigneeUserId: 'other-user' } })).resolves.toEqual({ kind: 'idempotency_conflict' });
  });
});
