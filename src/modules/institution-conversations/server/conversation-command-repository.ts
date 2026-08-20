import { createHash } from 'node:crypto';

import { and, asc, eq, inArray } from 'drizzle-orm';

import {
  acceptConversationAssignment,
  assignConversationSegment,
  projectConversationAssignments,
  reassignConversationSegment,
  releaseConversationAssignment,
  type ConversationAssignmentActorRole,
  type ConversationAssignmentFact,
  type ConversationAssignmentHistory,
  type ConversationAssignmentProjection,
} from '@/modules/institution-conversations/domain/conversation-assignments';
import {
  acceptHumanHandling,
  closeConversationSegmentManually,
  markWaitingForCustomer,
  releaseHumanHandling,
  requestHumanHandling,
  segmentLocalBlockingReasonCodes,
  type ConversationSegment,
  type SegmentManualCloseResultCode,
} from '@/modules/institution-conversations/domain/conversation-segments';
import type { InstitutionRoleV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import type { TenantDatabase } from '@/server/db/client';
import {
  conversationAssignments,
  conversationRisks,
  conversationSegments,
  conversations,
} from '@/server/db/schema';

type RootRow = typeof conversations.$inferSelect;
type SegmentRow = typeof conversationSegments.$inferSelect;
type AssignmentRow = typeof conversationAssignments.$inferSelect;

export type ConversationCommandActorV1 = Readonly<{
  userId: string;
  role: InstitutionRoleV1;
}>;

export type ConversationCommandOperationV1 =
  | Readonly<{ kind: 'request_human' }>
  | Readonly<{
      kind: 'assign';
      assigneeUserId: string;
      assigneeRole: InstitutionRoleV1;
    }>
  | Readonly<{
      kind: 'reassign';
      assigneeUserId: string;
      assigneeRole: InstitutionRoleV1;
    }>
  | Readonly<{ kind: 'takeover' }>
  | Readonly<{ kind: 'release_takeover' }>
  | Readonly<{ kind: 'waiting_customer' }>
  | Readonly<{
      kind: 'close';
      closeResultCode: SegmentManualCloseResultCode;
    }>;

export type ConversationCommandInputV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  conversationId: string;
  expectedConversationRevision: number;
  expectedSegmentRevision: number;
  expectedAssignmentRevision: number;
  requestId: string;
  actor: ConversationCommandActorV1;
  operation: ConversationCommandOperationV1;
}>;

export type ConversationCommandRecordV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  conversationId: string;
  conversationRevision: number;
  updatedAt: string;
  segment: null | Readonly<{
    value: ConversationSegment;
    revision: number;
    assignmentRevision: number;
    hasRiskFacts?: boolean | null;
    assignment: null | Readonly<{
      assignmentId: string;
      assigneeUserId: string;
      assigneeRole: InstitutionRoleV1;
      status: 'assigned' | 'accepted';
    }>;
  }>;
}>;

export type ConversationCommandResultV1 =
  | Readonly<{
      kind: 'applied' | 'replayed';
      record: ConversationCommandRecordV1;
      occurredAt: string;
    }>
  | Readonly<{ kind: 'not_found_or_not_owned' }>
  | Readonly<{ kind: 'blocked'; code: string }>;

export type ConversationAssignmentReplayProbeInputV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  conversationId: string;
  expectedConversationRevision?: number;
  expectedAssignmentRevision?: number;
  requestId: string;
  actorUserId: string;
  operation:
    | Readonly<{ kind: 'assign' | 'reassign'; assigneeUserId: string }>
    | Readonly<{ kind: 'takeover' | 'release_takeover' }>
    | Readonly<{ kind: 'close'; closeResultCode: SegmentManualCloseResultCode }>;
}>;

export type ConversationAssignmentReplayProbeResultV1 =
  | Readonly<{ kind: 'replayed'; record: ConversationCommandRecordV1; occurredAt: string }>
  | Readonly<{ kind: 'not_replayed' | 'idempotency_conflict' | 'not_found_or_not_owned' }>;

class ConversationCommandConflictError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function iso(value: Date): string {
  return value.toISOString();
}

function domainRef(prefix: 'ten' | 'ins' | 'con' | 'seg' | 'usr', value: string): string {
  const digest = createHash('sha256').update(`${prefix}\n${value}`, 'utf8').digest('hex');
  return `${prefix}_a${digest.slice(1, 32)}`;
}

function operationRef(prefix: 'ase' | 'asn', seed: string): string {
  const digest = createHash('sha256').update(`${prefix}\n${seed}`, 'utf8').digest('hex');
  return `${prefix}_a${digest.slice(1, 32)}`;
}

function idempotencyRef(seed: string): string {
  const digest = createHash('sha256').update(`idem\n${seed}`, 'utf8').digest('hex');
  return `idem_a${digest.slice(1, 32)}`;
}

function mapSegment(row: SegmentRow): ConversationSegment | null {
  const blockers = Array.isArray(row.blockingReasonCodes)
    ? row.blockingReasonCodes
    : null;
  if (
    !blockers ||
    blockers.some(
      (code) =>
        typeof code !== 'string' ||
        !segmentLocalBlockingReasonCodes.some((candidate) => candidate === code),
    )
  ) {
    return null;
  }

  return {
    tenantId: row.tenantId,
    institutionId: row.institutionId,
    segmentId: row.id,
    conversationId: row.conversationId,
    sequenceNo: row.sequenceNo,
    state: row.state,
    currentHandlerId: row.currentHandlerId,
    everHumanHandled: row.everHumanHandled,
    openedByCustomerMessageId: row.openedByCustomerMessageId,
    openedAt: iso(row.openedAt),
    lastCustomerMessageId: row.lastCustomerMessageId,
    lastCustomerMessageAt: iso(row.lastCustomerMessageAt),
    latestInboundRevision: row.latestInboundRevision,
    waitingAfterCustomerMessageId: row.waitingAfterCustomerMessageId,
    waitingAfterCustomerMessageAt: row.waitingAfterCustomerMessageAt
      ? iso(row.waitingAfterCustomerMessageAt)
      : null,
    waitingAfterInboundRevision: row.waitingAfterInboundRevision,
    stateChangedAt: iso(row.stateChangedAt),
    closedAt: row.closedAt ? iso(row.closedAt) : null,
    segmentCloseKind: row.segmentCloseKind,
    resolutionState: row.resolutionState,
    resolvedAt: row.resolvedAt ? iso(row.resolvedAt) : null,
    blockingReasonCodes: blockers as ConversationSegment['blockingReasonCodes'],
  };
}

function toDomainFact(row: AssignmentRow): ConversationAssignmentFact {
  return {
    eventId: row.eventId,
    assignmentId: row.assignmentId,
    tenantId: domainRef('ten', row.tenantId),
    institutionId: domainRef('ins', row.institutionId),
    conversationId: domainRef('con', row.conversationId),
    segmentId: domainRef('seg', row.segmentId),
    revision: row.revision,
    status: row.status,
    assigneeUserId: domainRef('usr', row.assigneeUserId),
    assigneeRole: row.assigneeRole as ConversationAssignmentActorRole,
    actorUserId: domainRef('usr', row.actorUserId),
    actorRole: row.actorRole as ConversationAssignmentActorRole,
    reasonCode: row.reasonCode,
    sourceSegmentState: row.sourceSegmentState,
    occurredAt: iso(row.occurredAt),
    idempotencyKey: row.idempotencyKey,
  };
}

function toDomainHistory(rows: readonly AssignmentRow[]): ConversationAssignmentHistory {
  return rows.map(toDomainFact);
}

function domainTarget(input: Readonly<{
  tenantId: string;
  institutionId: string;
  conversationId: string;
  segmentId: string;
}>) {
  return {
    tenantId: domainRef('ten', input.tenantId),
    institutionId: domainRef('ins', input.institutionId),
    conversationId: domainRef('con', input.conversationId),
    segmentId: domainRef('seg', input.segmentId),
  } as const;
}

type ActiveAssignmentRecordV1 = Readonly<{
  assignmentId: string;
  assigneeUserId: string;
  assigneeRole: InstitutionRoleV1;
  status: 'assigned' | 'accepted';
}> | null;

function activeAssignment(
  projection: ConversationAssignmentProjection,
  rows: readonly AssignmentRow[],
): ActiveAssignmentRecordV1 {
  if (
    projection.activeAssignmentCount !== 1 ||
    projection.assignmentId === null ||
    projection.assignmentStatus === null ||
    projection.assigneeId === null ||
    projection.assigneeRole === null
  ) {
    return null;
  }

  const actualUsers = new Map<string, string>();
  for (const row of rows) {
    actualUsers.set(domainRef('usr', row.assigneeUserId), row.assigneeUserId);
    actualUsers.set(domainRef('usr', row.actorUserId), row.actorUserId);
  }
  const assigneeUserId = actualUsers.get(projection.assigneeId);
  if (!assigneeUserId) {
    throw new Error('conversation_assignment_assignee_projection_unavailable');
  }

  return {
    assignmentId: projection.assignmentId,
    assigneeUserId,
    assigneeRole: projection.assigneeRole,
    status: projection.assignmentStatus,
  };
}

async function readScopedState(
  database: TenantDatabase,
  input: Readonly<{
    tenantId: string;
    institutionId: string;
    conversationId: string;
  }>,
): Promise<ConversationCommandRecordV1 | null> {
  const [root] = await database
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.tenantId, input.tenantId),
        eq(conversations.institutionId, input.institutionId),
        eq(conversations.id, input.conversationId),
      ),
    );
  if (!root) return null;

  const segmentId = root.activeSegmentId ?? root.lastClosedSegmentId;
  if (!segmentId) {
    return {
      tenantId: root.tenantId,
      institutionId: root.institutionId,
      conversationId: root.id,
      conversationRevision: root.revision,
      updatedAt: iso(root.updatedAt),
      segment: null,
    };
  }

  const [segmentRow] = await database
    .select()
    .from(conversationSegments)
    .where(
      and(
        eq(conversationSegments.tenantId, input.tenantId),
        eq(conversationSegments.institutionId, input.institutionId),
        eq(conversationSegments.conversationId, input.conversationId),
        eq(conversationSegments.id, segmentId),
      ),
    );
  if (!segmentRow) throw new Error('conversation_active_segment_unavailable');

  const segment = mapSegment(segmentRow);
  if (!segment) throw new Error('conversation_segment_invalid');
  if (
    root.activeSegmentId !== null && segment.state === 'closed'
  ) throw new Error('conversation_active_segment_closed');
  if (
    root.activeSegmentId === null && root.lastClosedSegmentId === segment.segmentId && segment.state !== 'closed'
  ) throw new Error('conversation_last_closed_segment_not_closed');

  const assignmentRows = await database
    .select()
    .from(conversationAssignments)
    .where(
      and(
        eq(conversationAssignments.tenantId, input.tenantId),
        eq(conversationAssignments.institutionId, input.institutionId),
        eq(conversationAssignments.conversationId, input.conversationId),
        eq(conversationAssignments.segmentId, segment.segmentId),
      ),
    )
    .orderBy(asc(conversationAssignments.revision));

  const projected = projectConversationAssignments(
    toDomainHistory(assignmentRows),
    domainTarget({ ...input, segmentId: segment.segmentId }),
  );
  if (projected.kind !== 'projected') {
    throw new Error(`conversation_assignment_history_${projected.code}`);
  }

  const riskFree = await noRiskFacts(database, {
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    conversationId: input.conversationId,
    segmentId: segment.segmentId,
  });

  return {
    tenantId: root.tenantId,
    institutionId: root.institutionId,
    conversationId: root.id,
    conversationRevision: root.revision,
    updatedAt: iso(root.updatedAt),
    segment: {
      value: segment,
      revision: segmentRow.revision,
      assignmentRevision: projected.projection.revision,
      hasRiskFacts: !riskFree,
      assignment: activeAssignment(projected.projection, assignmentRows),
    },
  };
}

export async function readScopedConversationCommandRecordV1(
  database: TenantDatabase,
  input: Readonly<{
    tenantId: string;
    institutionId: string;
    conversationId: string;
  }>,
): Promise<ConversationCommandRecordV1 | null> {
  return readScopedState(database, input);
}

function serverOccurredAt(
  root: RootRow,
  segment: SegmentRow,
  assignments: readonly AssignmentRow[],
): string {
  const lastAssignmentAt = assignments.at(-1)?.occurredAt.getTime() ?? 0;
  const epoch = Math.max(
    Date.now(),
    root.updatedAt.getTime() + 1,
    segment.updatedAt.getTime() + 1,
    lastAssignmentAt + 1,
  );
  return new Date(epoch).toISOString();
}

function domainUserMap(
  rows: readonly AssignmentRow[],
  input: ConversationCommandInputV1,
): Map<string, string> {
  const result = new Map<string, string>();
  const add = (actual: string) => result.set(domainRef('usr', actual), actual);
  for (const row of rows) {
    add(row.assigneeUserId);
    add(row.actorUserId);
  }
  add(input.actor.userId);
  if (input.operation.kind === 'assign' || input.operation.kind === 'reassign') {
    add(input.operation.assigneeUserId);
  }
  return result;
}

async function noRiskFacts(
  database: TenantDatabase,
  input: Readonly<{
    tenantId: string;
    institutionId: string;
    conversationId: string;
    segmentId: string;
  }>,
): Promise<boolean> {
  const rows = await database
    .select({ riskId: conversationRisks.riskId })
    .from(conversationRisks)
    .where(
      and(
        eq(conversationRisks.tenantId, input.tenantId),
        eq(conversationRisks.institutionId, input.institutionId),
        eq(conversationRisks.conversationId, input.conversationId),
        eq(conversationRisks.segmentId, input.segmentId),
      ),
    )
    .limit(1);
  return rows.length === 0;
}

export async function readConversationAssignmentReplayV1(
  database: TenantDatabase,
  input: ConversationAssignmentReplayProbeInputV1,
): Promise<ConversationAssignmentReplayProbeResultV1> {
  const [root] = await database
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.tenantId, input.tenantId),
        eq(conversations.institutionId, input.institutionId),
        eq(conversations.id, input.conversationId),
      ),
    );
  if (!root) return { kind: 'not_found_or_not_owned' };

  const segmentRows = await database
    .select({
      segmentId: conversationSegments.id,
      state: conversationSegments.state,
      segmentCloseKind: conversationSegments.segmentCloseKind,
      resolutionState: conversationSegments.resolutionState,
      closedAt: conversationSegments.closedAt,
    })
    .from(conversationSegments)
    .where(
      and(
        eq(conversationSegments.tenantId, input.tenantId),
        eq(conversationSegments.institutionId, input.institutionId),
        eq(conversationSegments.conversationId, input.conversationId),
      ),
    )
    .orderBy(asc(conversationSegments.sequenceNo));

  if (segmentRows.length === 0) return { kind: 'not_replayed' };

  const segmentById = new Map(segmentRows.map((row) => [row.segmentId, row] as const));
  const idempotencyBySegment = new Map<string, string>();
  const segmentByIdempotency = new Map<string, string>();
  for (const row of segmentRows) {
    const idempotencyKey = idempotencyRef(
      `${input.requestId}\n${input.operation.kind}\n${input.conversationId}\n${row.segmentId}`,
    );
    const existingSegmentId = segmentByIdempotency.get(idempotencyKey);
    if (existingSegmentId && existingSegmentId !== row.segmentId) {
      return { kind: 'idempotency_conflict' };
    }
    idempotencyBySegment.set(row.segmentId, idempotencyKey);
    segmentByIdempotency.set(idempotencyKey, row.segmentId);
  }

  const candidateKeys = [...segmentByIdempotency.keys()];
  const candidateRows = await database
    .select()
    .from(conversationAssignments)
    .where(
      and(
        eq(conversationAssignments.tenantId, input.tenantId),
        eq(conversationAssignments.institutionId, input.institutionId),
        eq(conversationAssignments.conversationId, input.conversationId),
        inArray(conversationAssignments.idempotencyKey, candidateKeys),
      ),
    )
    .orderBy(
      asc(conversationAssignments.segmentId),
      asc(conversationAssignments.revision),
    );

  const rowsBySegment = new Map<string, AssignmentRow[]>();
  for (const row of candidateRows) {
    const expectedKey = idempotencyBySegment.get(row.segmentId);
    if (!expectedKey || row.idempotencyKey !== expectedKey) continue;
    const rows = rowsBySegment.get(row.segmentId) ?? [];
    rows.push(row);
    rowsBySegment.set(row.segmentId, rows);
  }

  if (rowsBySegment.size === 0) return { kind: 'not_replayed' };

  const replayOccurredAt = (
    segmentId: string,
    rows: readonly AssignmentRow[],
  ): Date | null => {
    const idem = idempotencyBySegment.get(segmentId);
    if (!idem || rows.some((row) => row.actorUserId !== input.actorUserId)) return null;
    const event = (slot: string) => operationRef('ase', `${idem}\n${slot}`);
    const assignment = (slot: string) => operationRef('asn', `${idem}\n${slot}`);
    const revisionOk = (revision: number, offset: number) =>
      input.expectedAssignmentRevision === undefined
      || revision === input.expectedAssignmentRevision + offset;

    if (input.operation.kind === 'assign') {
      const row = rows.length === 1 ? rows[0] : null;
      return row
        && row.eventId === event('assign')
        && row.assignmentId === assignment('assign')
        && revisionOk(row.revision, 1)
        && row.status === 'assigned'
        && row.reasonCode === 'manual_assign'
        && row.sourceSegmentState === 'awaiting_human'
        && row.assigneeUserId === input.operation.assigneeUserId
        ? row.occurredAt : null;
    }

    if (input.operation.kind === 'reassign') {
      if (rows.length !== 2) return null;
      const released = rows.find((row) =>
        row.eventId === event('reassign-release')
        && row.status === 'released'
        && row.reasonCode === 'manual_reassign');
      const assigned = rows.find((row) =>
        row.eventId === event('reassign-assign')
        && row.assignmentId === assignment('reassign')
        && row.status === 'assigned'
        && row.reasonCode === 'manual_reassign');
      return released && assigned
        && revisionOk(released.revision, 1)
        && revisionOk(assigned.revision, 2)
        && released.sourceSegmentState === 'awaiting_human'
        && assigned.sourceSegmentState === 'awaiting_human'
        && released.occurredAt.getTime() === assigned.occurredAt.getTime()
        && assigned.assigneeUserId === input.operation.assigneeUserId
        ? assigned.occurredAt : null;
    }

    const row = rows.length === 1 ? rows[0] : null;
    if (!row || !revisionOk(row.revision, 1)
      || row.actorUserId !== row.assigneeUserId) return null;

    if (input.operation.kind === 'takeover') {
      return row.eventId === event('takeover')
        && row.status === 'accepted'
        && row.sourceSegmentState === 'awaiting_human'
        && (row.reasonCode === 'manual_assign'
          || row.reasonCode === 'manual_reassign'
          || row.reasonCode === 'manual_fallback')
        ? row.occurredAt : null;
    }

    const slot = input.operation.kind === 'close' ? 'close-release' : 'release-takeover';
    if (row.eventId !== event(slot)
      || row.status !== 'released'
      || row.reasonCode !== 'handler_release'
      || (row.sourceSegmentState !== 'human_handling'
        && row.sourceSegmentState !== 'waiting_customer')) return null;

    if (input.operation.kind === 'release_takeover') return row.occurredAt;
    if (input.operation.kind !== 'close') return null;

    const seg = segmentById.get(segmentId);
    if (!seg || seg.state !== 'closed' || seg.segmentCloseKind !== 'normal'
      || seg.closedAt === null || seg.closedAt.getTime() !== row.occurredAt.getTime()) return null;
    const code = seg.resolutionState === 'resolved' ? 'resolved' : 'unresolved';
    return code === input.operation.closeResultCode ? row.occurredAt : null;
  };

  if (root.activeSegmentId) {
    const activeRows = rowsBySegment.get(root.activeSegmentId);
    if (activeRows) {
      const occurredAt = replayOccurredAt(root.activeSegmentId, activeRows);
      if (!occurredAt) return { kind: 'idempotency_conflict' };
      const record = await readScopedState(database, {
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        conversationId: input.conversationId,
      });
      return record
        ? { kind: 'replayed', record, occurredAt: iso(occurredAt) }
        : { kind: 'not_found_or_not_owned' };
    }
  }

  if (
    root.activeSegmentId
    && input.expectedConversationRevision !== undefined
    && input.expectedConversationRevision === root.revision
  ) return { kind: 'not_replayed' };

  const historicalMatches: Date[] = [];
  let historicalCandidateCount = 0;
  for (const [segmentId, rows] of rowsBySegment) {
    if (segmentId === root.activeSegmentId) continue;
    historicalCandidateCount += 1;
    const occurredAt = replayOccurredAt(segmentId, rows);
    if (occurredAt) historicalMatches.push(occurredAt);
  }

  if (historicalMatches.length > 1) return { kind: 'idempotency_conflict' };
  if (historicalMatches.length === 0) {
    return input.expectedConversationRevision !== undefined
      && historicalCandidateCount > 0
      ? { kind: 'idempotency_conflict' }
      : { kind: 'not_replayed' };
  }

  const record = await readScopedState(database, {
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    conversationId: input.conversationId,
  });
  if (!record) return { kind: 'not_found_or_not_owned' };
  return {
    kind: 'replayed',
    record,
    occurredAt: iso(historicalMatches[0]!),
  };
}

export async function executeConversationCommandV1(
  database: TenantDatabase,
  input: ConversationCommandInputV1,
): Promise<ConversationCommandResultV1> {
  if (
    input.operation.kind === 'takeover'
    || input.operation.kind === 'release_takeover'
    || input.operation.kind === 'close'
  ) {
    const replay = await readConversationAssignmentReplayV1(database, {
      tenantId: input.tenantId,
      institutionId: input.institutionId,
      conversationId: input.conversationId,
      expectedConversationRevision: input.expectedConversationRevision,
      expectedAssignmentRevision: input.expectedAssignmentRevision,
      requestId: input.requestId,
      actorUserId: input.actor.userId,
      operation: input.operation,
    });
    if (replay.kind === 'replayed') return replay;
    if (replay.kind === 'idempotency_conflict') {
      return { kind: 'blocked', code: 'idempotency_conflict' };
    }
    if (replay.kind === 'not_found_or_not_owned') {
      return { kind: 'not_found_or_not_owned' };
    }
  }

  const [root] = await database
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.tenantId, input.tenantId),
        eq(conversations.institutionId, input.institutionId),
        eq(conversations.id, input.conversationId),
      ),
    );
  if (!root || !root.activeSegmentId) return { kind: 'not_found_or_not_owned' };

  const [segmentRow] = await database
    .select()
    .from(conversationSegments)
    .where(
      and(
        eq(conversationSegments.tenantId, input.tenantId),
        eq(conversationSegments.institutionId, input.institutionId),
        eq(conversationSegments.conversationId, input.conversationId),
        eq(conversationSegments.id, root.activeSegmentId),
      ),
    );
  if (!segmentRow) return { kind: 'not_found_or_not_owned' };

  const segment = mapSegment(segmentRow);
  if (!segment || segment.state === 'closed') {
    return { kind: 'blocked', code: 'segment_unavailable' };
  }

  const assignmentRows = await database
    .select()
    .from(conversationAssignments)
    .where(
      and(
        eq(conversationAssignments.tenantId, input.tenantId),
        eq(conversationAssignments.institutionId, input.institutionId),
        eq(conversationAssignments.conversationId, input.conversationId),
        eq(conversationAssignments.segmentId, segment.segmentId),
      ),
    )
    .orderBy(asc(conversationAssignments.revision));

  const history = toDomainHistory(assignmentRows);
  const target = domainTarget({
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    conversationId: input.conversationId,
    segmentId: segment.segmentId,
  });
  const projected = projectConversationAssignments(history, target);
  if (projected.kind !== 'projected') {
    return { kind: 'blocked', code: 'assignment_history_unavailable' };
  }

  const idem = idempotencyRef(
    `${input.requestId}\n${input.operation.kind}\n${input.conversationId}\n${segment.segmentId}`,
  );
  const event = (slot: string) => operationRef('ase', `${idem}\n${slot}`);
  const assignment = (slot: string) => operationRef('asn', `${idem}\n${slot}`);
  const actorUserId = domainRef('usr', input.actor.userId);
  const actorRole = input.actor.role as ConversationAssignmentActorRole;
  const existingIdempotentRows = assignmentRows.filter(
    (row) => row.idempotencyKey === idem,
  );

  const replayedRecord = (): ConversationCommandRecordV1 => ({
    tenantId: root.tenantId,
    institutionId: root.institutionId,
    conversationId: root.id,
    conversationRevision: root.revision,
    updatedAt: iso(root.updatedAt),
    segment: {
      value: segment,
      revision: segmentRow.revision,
      assignmentRevision: projected.projection.revision,
      assignment: activeAssignment(projected.projection, assignmentRows),
    },
  });

  if (
    existingIdempotentRows.length > 0 &&
    (input.operation.kind === 'assign' || input.operation.kind === 'reassign')
  ) {
    const replayAnchor = existingIdempotentRows[0]!;
    const replayOccurredAt = iso(replayAnchor.occurredAt);

    if (input.operation.kind === 'assign') {
      const replay = assignConversationSegment(history, {
        eventId: event('assign'),
        assignmentId: assignment('assign'),
        ...target,
        expectedRevision: input.expectedAssignmentRevision,
        idempotencyKey: idem,
        actorUserId,
        actorRole,
        assigneeUserId: domainRef('usr', input.operation.assigneeUserId),
        assigneeRole: input.operation.assigneeRole,
        sourceSegmentState: replayAnchor.sourceSegmentState,
        occurredAt: replayOccurredAt,
      });
      if (replay.kind === 'replayed') {
        return {
          kind: 'replayed',
          record: replayedRecord(),
          occurredAt: replayOccurredAt,
        };
      }
      if (replay.kind === 'blocked') {
        return { kind: 'blocked', code: replay.code };
      }
      return { kind: 'blocked', code: 'idempotency_conflict' };
    }

    const released = existingIdempotentRows.find(
      (row) =>
        row.status === 'released' &&
        row.reasonCode === 'manual_reassign',
    );
    if (!released) {
      return { kind: 'blocked', code: 'idempotency_conflict' };
    }
    const replay = reassignConversationSegment(history, {
      releaseEventId: event('reassign-release'),
      assignedEventId: event('reassign-assign'),
      currentAssignmentId: released.assignmentId,
      newAssignmentId: assignment('reassign'),
      ...target,
      expectedRevision: input.expectedAssignmentRevision,
      idempotencyKey: idem,
      actorUserId,
      actorRole,
      newAssigneeUserId: domainRef('usr', input.operation.assigneeUserId),
      newAssigneeRole: input.operation.assigneeRole,
      sourceSegmentState: replayAnchor.sourceSegmentState,
      occurredAt: replayOccurredAt,
    });
    if (replay.kind === 'replayed') {
      return {
        kind: 'replayed',
        record: replayedRecord(),
        occurredAt: replayOccurredAt,
      };
    }
    if (replay.kind === 'blocked') {
      return { kind: 'blocked', code: replay.code };
    }
    return { kind: 'blocked', code: 'idempotency_conflict' };
  }

  if (
    root.revision !== input.expectedConversationRevision ||
    segmentRow.revision !== input.expectedSegmentRevision ||
    projected.projection.revision !== input.expectedAssignmentRevision
  ) {
    return { kind: 'blocked', code: 'revision_conflict' };
  }

  const occurredAt = serverOccurredAt(root, segmentRow, assignmentRows);

  let nextSegment: ConversationSegment = segment;
  let operationFacts: ConversationAssignmentHistory = [];

  if (input.operation.kind === 'request_human') {
    const result = requestHumanHandling(segment, { occurredAt });
    if (result.kind !== 'applied') return { kind: 'blocked', code: result.code };
    nextSegment = result.segment;
  } else if (input.operation.kind === 'assign') {
    const result = assignConversationSegment(history, {
      eventId: event('assign'),
      assignmentId: assignment('assign'),
      ...target,
      expectedRevision: input.expectedAssignmentRevision,
      idempotencyKey: idem,
      actorUserId,
      actorRole,
      assigneeUserId: domainRef('usr', input.operation.assigneeUserId),
      assigneeRole: input.operation.assigneeRole,
      sourceSegmentState: segment.state,
      occurredAt,
    });
    if (result.kind === 'blocked') return { kind: 'blocked', code: result.code };
    operationFacts = result.operationFacts;
  } else if (input.operation.kind === 'reassign') {
    if (!projected.projection.assignmentId) {
      return { kind: 'blocked', code: 'active_assignment_missing' };
    }
    const result = reassignConversationSegment(history, {
      releaseEventId: event('reassign-release'),
      assignedEventId: event('reassign-assign'),
      currentAssignmentId: projected.projection.assignmentId,
      newAssignmentId: assignment('reassign'),
      ...target,
      expectedRevision: input.expectedAssignmentRevision,
      idempotencyKey: idem,
      actorUserId,
      actorRole,
      newAssigneeUserId: domainRef('usr', input.operation.assigneeUserId),
      newAssigneeRole: input.operation.assigneeRole,
      sourceSegmentState: segment.state,
      occurredAt,
    });
    if (result.kind === 'blocked') return { kind: 'blocked', code: result.code };
    operationFacts = result.operationFacts;
  } else if (input.operation.kind === 'takeover') {
    if (!projected.projection.assignmentId) {
      return { kind: 'blocked', code: 'active_assignment_missing' };
    }
    const assigned = activeAssignment(projected.projection, assignmentRows);
    const result = acceptConversationAssignment(history, {
      eventId: event('takeover'),
      assignmentId: projected.projection.assignmentId,
      ...target,
      expectedRevision: input.expectedAssignmentRevision,
      idempotencyKey: idem,
      actorUserId,
      actorRole,
      sourceSegmentState: segment.state,
      occurredAt,
    });
    if (result.kind === 'blocked') return { kind: 'blocked', code: result.code };
    const transitioned = acceptHumanHandling(segment, {
      operatorId: input.actor.userId,
      occurredAt,
      assignment: {
        activeAssignmentCount: result.projection.activeAssignmentCount,
        assigneeId: assigned?.assigneeUserId ?? null,
      },
    });
    if (transitioned.kind !== 'applied') {
      return { kind: 'blocked', code: transitioned.code };
    }
    operationFacts = result.operationFacts;
    nextSegment = transitioned.segment;
  } else if (input.operation.kind === 'release_takeover') {
    if (!projected.projection.assignmentId) {
      return { kind: 'blocked', code: 'active_assignment_missing' };
    }
    const result = releaseConversationAssignment(history, {
      eventId: event('release-takeover'),
      assignmentId: projected.projection.assignmentId,
      ...target,
      expectedRevision: input.expectedAssignmentRevision,
      idempotencyKey: idem,
      actorUserId,
      actorRole,
      sourceSegmentState: segment.state,
      occurredAt,
    });
    if (result.kind === 'blocked') return { kind: 'blocked', code: result.code };
    const transitioned = releaseHumanHandling(segment, {
      operatorId: input.actor.userId,
      occurredAt,
    });
    if (transitioned.kind !== 'applied') {
      return { kind: 'blocked', code: transitioned.code };
    }
    operationFacts = result.operationFacts;
    nextSegment = transitioned.segment;
  } else if (input.operation.kind === 'waiting_customer') {
    const current = activeAssignment(projected.projection, assignmentRows);
    if (
      !current ||
      current.status !== 'accepted' ||
      current.assigneeUserId !== input.actor.userId
    ) {
      return { kind: 'blocked', code: 'actor_not_assignee' };
    }
    const transitioned = markWaitingForCustomer(segment, {
      operatorId: input.actor.userId,
      occurredAt,
    });
    if (transitioned.kind !== 'applied') {
      return { kind: 'blocked', code: transitioned.code };
    }
    nextSegment = transitioned.segment;
  } else {
    const current = activeAssignment(projected.projection, assignmentRows);
    if (
      !current ||
      current.status !== 'accepted' ||
      current.assigneeUserId !== input.actor.userId
    ) {
      return { kind: 'blocked', code: 'actor_not_assignee' };
    }
    if (segment.blockingReasonCodes.length > 0) {
      return { kind: 'blocked', code: 'blocking_reason_present' };
    }
    if (!await noRiskFacts(database, {
      tenantId: input.tenantId,
      institutionId: input.institutionId,
      conversationId: input.conversationId,
      segmentId: segment.segmentId,
    })) {
      return { kind: 'blocked', code: 'risk_status_requires_review' };
    }

    const release = releaseConversationAssignment(history, {
      eventId: event('close-release'),
      assignmentId: projected.projection.assignmentId!,
      ...target,
      expectedRevision: input.expectedAssignmentRevision,
      idempotencyKey: idem,
      actorUserId,
      actorRole,
      sourceSegmentState: segment.state,
      occurredAt,
    });
    if (release.kind === 'blocked') return { kind: 'blocked', code: release.code };

    const transitioned = closeConversationSegmentManually(segment, {
      operatorId: input.actor.userId,
      occurredAt,
      closeResultCode: input.operation.closeResultCode,
      blockingSnapshot: {
        readiness: 'ready',
        state: 'clear',
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        conversationId: input.conversationId,
        segmentId: segment.segmentId,
        checkedAt: occurredAt,
        validUntil: occurredAt,
      },
      riskSet: {
        readiness: 'ready',
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        conversationId: input.conversationId,
        segmentId: segment.segmentId,
        checkedAt: occurredAt,
        validUntil: occurredAt,
        histories: [],
        currentClinicalClosureChecks: [],
        completeness: 'authoritative_empty',
      },
    });
    if (transitioned.kind !== 'applied') {
      return { kind: 'blocked', code: transitioned.code };
    }
    operationFacts = release.operationFacts;
    nextSegment = transitioned.segment;
  }

  const nextSegmentRevision = segmentRow.revision + 1;
  const [segmentUpdated] = await database
    .update(conversationSegments)
    .set({
      state: nextSegment.state,
      currentHandlerId: nextSegment.currentHandlerId,
      everHumanHandled: nextSegment.everHumanHandled,
      waitingAfterCustomerMessageId: nextSegment.waitingAfterCustomerMessageId,
      waitingAfterCustomerMessageAt: nextSegment.waitingAfterCustomerMessageAt
        ? new Date(nextSegment.waitingAfterCustomerMessageAt)
        : null,
      waitingAfterInboundRevision: nextSegment.waitingAfterInboundRevision,
      stateChangedAt: new Date(nextSegment.stateChangedAt),
      closedAt: nextSegment.closedAt ? new Date(nextSegment.closedAt) : null,
      segmentCloseKind: nextSegment.segmentCloseKind,
      resolutionState: nextSegment.resolutionState,
      resolvedAt: nextSegment.resolvedAt ? new Date(nextSegment.resolvedAt) : null,
      blockingReasonCodes: [...nextSegment.blockingReasonCodes],
      revision: nextSegmentRevision,
      updatedAt: new Date(occurredAt),
    })
    .where(
      and(
        eq(conversationSegments.tenantId, input.tenantId),
        eq(conversationSegments.institutionId, input.institutionId),
        eq(conversationSegments.conversationId, input.conversationId),
        eq(conversationSegments.id, segment.segmentId),
        eq(conversationSegments.revision, input.expectedSegmentRevision),
      ),
    )
    .returning({ revision: conversationSegments.revision });
  if (!segmentUpdated || segmentUpdated.revision !== nextSegmentRevision) {
    throw new ConversationCommandConflictError('revision_conflict');
  }

  const closing = nextSegment.state === 'closed';
  const [rootUpdated] = await database
    .update(conversations)
    .set({
      activeSegmentId: closing ? null : segment.segmentId,
      lastClosedSegmentId: closing ? segment.segmentId : root.lastClosedSegmentId,
      lastSegmentClosedAt: closing ? new Date(occurredAt) : root.lastSegmentClosedAt,
      lastClosedSegmentInboundMessageId: closing
        ? segment.lastCustomerMessageId
        : root.lastClosedSegmentInboundMessageId,
      lastClosedSegmentInboundAt: closing
        ? new Date(segment.lastCustomerMessageAt)
        : root.lastClosedSegmentInboundAt,
      lastClosedSegmentInboundRevision: closing
        ? segment.latestInboundRevision
        : root.lastClosedSegmentInboundRevision,
      segmentUpdatedAt: new Date(occurredAt),
      revision: root.revision + 1,
      updatedAt: new Date(occurredAt),
    })
    .where(
      and(
        eq(conversations.tenantId, input.tenantId),
        eq(conversations.institutionId, input.institutionId),
        eq(conversations.id, input.conversationId),
        eq(conversations.activeSegmentId, segment.segmentId),
        eq(conversations.revision, input.expectedConversationRevision),
      ),
    )
    .returning({ revision: conversations.revision });
  if (!rootUpdated || rootUpdated.revision !== root.revision + 1) {
    throw new ConversationCommandConflictError('revision_conflict');
  }

  if (operationFacts.length > 0) {
    const users = domainUserMap(assignmentRows, input);
    const values = operationFacts.map((fact) => {
      const assigneeUserId = users.get(fact.assigneeUserId);
      const actorActualUserId = users.get(fact.actorUserId);
      if (!assigneeUserId || !actorActualUserId) {
        throw new Error('conversation_assignment_user_mapping_unavailable');
      }
      return {
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        eventId: fact.eventId,
        assignmentId: fact.assignmentId,
        conversationId: input.conversationId,
        segmentId: segment.segmentId,
        revision: fact.revision,
        status: fact.status,
        assigneeUserId,
        assigneeRole: fact.assigneeRole,
        actorUserId: actorActualUserId,
        actorRole: fact.actorRole,
        reasonCode: fact.reasonCode,
        sourceSegmentState: fact.sourceSegmentState,
        occurredAt: new Date(fact.occurredAt),
        idempotencyKey: fact.idempotencyKey,
      };
    });
    await database.insert(conversationAssignments).values(values);
  }

  const record = await readScopedState(database, {
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    conversationId: input.conversationId,
  });
  if (!record) throw new Error('conversation_command_postwrite_read_unavailable');

  return { kind: 'applied', record, occurredAt };
}

export function isConversationCommandConflictError(
  value: unknown,
): value is ConversationCommandConflictError {
  return value instanceof ConversationCommandConflictError;
}
