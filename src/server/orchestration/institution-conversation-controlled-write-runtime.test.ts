import { beforeEach, describe, expect, it, vi } from 'vitest';

const authorizationHandle = Object.freeze({});
const attributionHandle = Object.freeze({});
const transactionDatabase = Object.freeze({ kind: 'transaction-database' });

const mocks = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  consumeAuthorization: vi.fn(),
  resolveCapability: vi.fn(),
  getDatabase: vi.fn(),
  executeCommand: vi.fn(),
  isConflictError: vi.fn(),
  readAssignmentReplay: vi.fn(),
  readScopedRecord: vi.fn(),
  resolveMembership: vi.fn(),
  resolveAttribution: vi.fn(),
  createAuditRepository: vi.fn(),
  readAuditEvent: vi.fn(),
  recordAuditEvent: vi.fn(),
  createAttributedAuditEvent: vi.fn(),
}));

vi.mock(
  '@/server/orchestration/institution-conversation-write-authorization',
  () => ({
    resolveInstitutionConversationWriteAuthorizationV1: mocks.resolveAuthorization,
    consumeInstitutionConversationWriteAuthorizationV1: mocks.consumeAuthorization,
  }),
);

vi.mock('@/server/orchestration/institution-capability-authority', () => ({
  resolveInstitutionCapabilityAuthorityStatusV1: mocks.resolveCapability,
}));

vi.mock('@/server/db/client', () => ({
  getDatabase: mocks.getDatabase,
}));

vi.mock(
  '@/modules/institution-conversations/server/conversation-command-repository',
  () => ({
    executeConversationCommandV1: mocks.executeCommand,
    isConversationCommandConflictError: mocks.isConflictError,
    readConversationAssignmentReplayV1: mocks.readAssignmentReplay,
    readScopedConversationCommandRecordV1: mocks.readScopedRecord,
  }),
);

vi.mock(
  '@/modules/access-control/application/authoritative-membership-reader',
  () => ({
    createAccessControlAuthoritativeMembershipFactReaderV1: () => ({
      resolve: mocks.resolveMembership,
    }),
  }),
);

vi.mock('@/server/orchestration/institution-audit-writer-scope', () => ({
  resolveInstitutionAuditWriterVerifiedAttributionV1: mocks.resolveAttribution,
}));

vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: mocks.createAuditRepository,
}));

vi.mock('@/modules/audit/domain/audit-events', () => ({
  createVerifiedInstitutionAttributedTenantAuditEventV1:
    mocks.createAttributedAuditEvent,
}));

import { mutateCurrentInstitutionConversationControlledV1 } from '@/server/orchestration/institution-conversation-controlled-write-runtime';

const database = {
  transaction: vi.fn(),
};

function actor(
  role: 'tenant_admin' | 'tenant_operator' | 'consultant' | 'customer_service',
  accountId = 'actor-a',
) {
  return {
    accountId,
    displayName: '当前成员',
    role,
    tenantId: 'tenant-a',
    institutionId: 'institution-a',
    observedAt: '2026-08-20T01:00:00.000Z',
  } as const;
}

function capabilityStatus() {
  return {
    contractVersion: 'v1',
    readiness: 'ready',
    failureCode: null,
    scope: { tenantId: 'tenant-a', institutionId: 'institution-a' },
    data: {
      capabilities: [{
        key: 'page_conversation_queue',
        decision: 'operational',
        dimensions: {
          codeMaturity: 'verified',
          institutionAuthorization: 'authorized',
          connectionAvailability: 'not_required',
          dataReadiness: 'ready',
          productionRelease: 'pilot_released',
        },
        safeSummary: '会话队列可用',
      }],
    },
    partitions: [{
      key: 'page_conversation_queue',
      readiness: 'ready',
      failureCode: null,
    }],
  };
}

function record(input: {
  conversationRevision: number;
  segmentRevision: number;
  assignmentRevision: number;
  state: 'ai_handling' | 'awaiting_human' | 'human_handling' | 'waiting_customer' | 'closed';
  currentHandlerId?: string | null;
  assignment?: null | {
    assignmentId: string;
    assigneeUserId: string;
    assigneeRole: 'tenant_admin' | 'tenant_operator' | 'consultant' | 'customer_service';
    status: 'assigned' | 'accepted';
  };
}) {
  return {
    tenantId: 'tenant-a',
    institutionId: 'institution-a',
    conversationId: 'conversation-a',
    conversationRevision: input.conversationRevision,
    updatedAt: '2026-08-20T01:00:00.000Z',
    segment: {
      value: {
        segmentId: 'segment-a',
        state: input.state,
        currentHandlerId: input.currentHandlerId ?? null,
        everHumanHandled: input.state !== 'ai_handling',
        resolutionState: input.state === 'closed' ? 'resolved' : 'open',
        segmentCloseKind: input.state === 'closed' ? 'normal' : 'open',
        blockingReasonCodes: [],
      },
      revision: input.segmentRevision,
      assignmentRevision: input.assignmentRevision,
      hasRiskFacts: false,
      assignment: input.assignment ?? null,
    },
  };
}

function body(
  operation: Record<string, unknown>,
  revisions = { conversation: 2, segment: 2, assignment: 1 },
) {
  return {
    expectedConversationRevision: revisions.conversation,
    expectedSegmentRevision: revisions.segment,
    expectedAssignmentRevision: revisions.assignment,
    requestId: 'request-replay-protocol-001',
    operation,
  };
}

describe('Institution conversation controlled-write replay protocol', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    database.transaction.mockReset();
    database.transaction.mockImplementation(
      async (callback: (db: unknown) => Promise<unknown>) =>
        await callback(transactionDatabase),
    );

    mocks.resolveAuthorization.mockResolvedValue({
      kind: 'allowed',
      authorization: authorizationHandle,
    });
    mocks.consumeAuthorization.mockReturnValue(actor('tenant_operator'));
    mocks.resolveCapability.mockResolvedValue(capabilityStatus());
    mocks.getDatabase.mockReturnValue(database);
    mocks.resolveAttribution.mockResolvedValue(attributionHandle);
    mocks.resolveMembership.mockResolvedValue({
      kind: 'current_membership_fact',
      accountId: 'assignee-a',
      role: 'customer_service',
    });
    mocks.createAuditRepository.mockImplementation(() => ({
      readVerifiedInstitutionAuditEventById: mocks.readAuditEvent,
      recordAttributed: mocks.recordAuditEvent,
    }));
    mocks.readAuditEvent.mockResolvedValue(null);
    mocks.recordAuditEvent.mockResolvedValue(undefined);
    mocks.createAttributedAuditEvent.mockImplementation((input) => input.event);
    mocks.readAssignmentReplay.mockResolvedValue({ kind: 'not_replayed' });
    mocks.readScopedRecord.mockResolvedValue(record({
      conversationRevision: 2,
      segmentRevision: 2,
      assignmentRevision: 0,
      state: 'ai_handling',
    }));
    mocks.executeCommand.mockResolvedValue({
      kind: 'applied',
      occurredAt: '2026-08-20T01:00:01.000Z',
      record: record({
        conversationRevision: 3,
        segmentRevision: 3,
        assignmentRevision: 0,
        state: 'awaiting_human',
      }),
    });
    mocks.isConflictError.mockImplementation(
      (value) => value instanceof Error && 'code' in value,
    );
  });

  it('rechecks request_human audit fact inside the transaction before CAS', async () => {
    const before = record({
      conversationRevision: 2,
      segmentRevision: 2,
      assignmentRevision: 0,
      state: 'ai_handling',
    });
    const after = record({
      conversationRevision: 3,
      segmentRevision: 3,
      assignmentRevision: 0,
      state: 'awaiting_human',
    });
    mocks.readScopedRecord
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);
    mocks.readAuditEvent
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(async (input: { eventId: string }) => ({
        eventId: input.eventId,
        actorId: 'actor-a',
        actorRole: 'tenant_operator',
        resource: 'ai_conversation',
        resourceId: 'conversation-a',
        action: 'update',
        result: 'transitioned',
        reason: 'conversation_human_requested',
        occurredAt: '2026-08-20T01:00:01.000Z',
        source: 'server_session',
      }));

    await expect(mutateCurrentInstitutionConversationControlledV1(
      'conversation-a',
      body(
        { kind: 'request_human' },
        { conversation: 2, segment: 2, assignment: 0 },
      ),
    )).resolves.toMatchObject({ kind: 'ready' });

    expect(mocks.readAuditEvent).toHaveBeenCalledTimes(2);
    expect(mocks.executeCommand).not.toHaveBeenCalled();
    expect(mocks.recordAuditEvent).not.toHaveBeenCalled();
  });

  it('rechecks release_takeover before an early actor-scope not_found', async () => {
    mocks.consumeAuthorization.mockReturnValue(
      actor('customer_service', 'handler-a'),
    );
    const released = record({
      conversationRevision: 4,
      segmentRevision: 5,
      assignmentRevision: 3,
      state: 'awaiting_human',
      currentHandlerId: null,
      assignment: null,
    });
    mocks.readScopedRecord.mockResolvedValueOnce(released);
    mocks.readAssignmentReplay
      .mockResolvedValueOnce({ kind: 'not_replayed' })
      .mockResolvedValueOnce({
        kind: 'replayed',
        record: released,
        occurredAt: '2026-08-20T01:00:01.000Z',
      });

    await expect(mutateCurrentInstitutionConversationControlledV1(
      'conversation-a',
      body(
        { kind: 'release_takeover' },
        { conversation: 3, segment: 4, assignment: 2 },
      ),
    )).resolves.toMatchObject({ kind: 'ready' });

    expect(mocks.readAssignmentReplay).toHaveBeenCalledTimes(2);
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('replays an already committed assign before returning invalid assignee', async () => {
    const awaiting = record({
      conversationRevision: 2,
      segmentRevision: 2,
      assignmentRevision: 0,
      state: 'awaiting_human',
    });
    const assigned = record({
      conversationRevision: 3,
      segmentRevision: 3,
      assignmentRevision: 1,
      state: 'awaiting_human',
      assignment: {
        assignmentId: 'assignment-a',
        assigneeUserId: 'assignee-a',
        assigneeRole: 'customer_service',
        status: 'assigned',
      },
    });
    mocks.readScopedRecord.mockResolvedValueOnce(awaiting);
    mocks.resolveMembership.mockResolvedValueOnce(null);
    mocks.readAssignmentReplay
      .mockResolvedValueOnce({ kind: 'not_replayed' })
      .mockResolvedValueOnce({
        kind: 'replayed',
        record: assigned,
        occurredAt: '2026-08-20T01:00:01.000Z',
      });

    await expect(mutateCurrentInstitutionConversationControlledV1(
      'conversation-a',
      body(
        { kind: 'assign', assigneeUserId: 'assignee-a' },
        { conversation: 2, segment: 2, assignment: 0 },
      ),
    )).resolves.toMatchObject({ kind: 'ready' });

    expect(mocks.readAssignmentReplay).toHaveBeenCalledTimes(2);
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('applies the common visibility guard to repository-internal replay', async () => {
    mocks.consumeAuthorization.mockReturnValue(
      actor('customer_service', 'handler-a'),
    );
    const owned = record({
      conversationRevision: 2,
      segmentRevision: 2,
      assignmentRevision: 1,
      state: 'awaiting_human',
      assignment: {
        assignmentId: 'assignment-a',
        assigneeUserId: 'handler-a',
        assigneeRole: 'customer_service',
        status: 'assigned',
      },
    });
    const reassigned = record({
      conversationRevision: 4,
      segmentRevision: 4,
      assignmentRevision: 3,
      state: 'human_handling',
      currentHandlerId: 'handler-b',
      assignment: {
        assignmentId: 'assignment-b',
        assigneeUserId: 'handler-b',
        assigneeRole: 'customer_service',
        status: 'accepted',
      },
    });
    mocks.readScopedRecord.mockResolvedValueOnce(owned);
    mocks.readAssignmentReplay
      .mockResolvedValueOnce({ kind: 'not_replayed' })
      .mockResolvedValueOnce({ kind: 'not_replayed' });
    mocks.executeCommand.mockResolvedValueOnce({
      kind: 'replayed',
      record: reassigned,
      occurredAt: '2026-08-20T01:00:01.000Z',
    });

    await expect(mutateCurrentInstitutionConversationControlledV1(
      'conversation-a',
      body({ kind: 'takeover' }),
    )).resolves.toEqual({ kind: 'not_found' });

    expect(mocks.recordAuditEvent).not.toHaveBeenCalled();
  });

  it('reconciles a CAS loser with the winner persisted replay fact', async () => {
    mocks.consumeAuthorization.mockReturnValue(
      actor('customer_service', 'handler-a'),
    );
    const owned = record({
      conversationRevision: 2,
      segmentRevision: 2,
      assignmentRevision: 1,
      state: 'awaiting_human',
      assignment: {
        assignmentId: 'assignment-a',
        assigneeUserId: 'handler-a',
        assigneeRole: 'customer_service',
        status: 'assigned',
      },
    });
    const accepted = record({
      conversationRevision: 3,
      segmentRevision: 3,
      assignmentRevision: 2,
      state: 'human_handling',
      currentHandlerId: 'handler-a',
      assignment: {
        assignmentId: 'assignment-a',
        assigneeUserId: 'handler-a',
        assigneeRole: 'customer_service',
        status: 'accepted',
      },
    });
    const conflict = Object.assign(new Error('revision_conflict'), {
      code: 'revision_conflict',
    });
    mocks.readScopedRecord.mockResolvedValueOnce(owned);
    mocks.readAssignmentReplay
      .mockResolvedValueOnce({ kind: 'not_replayed' })
      .mockResolvedValueOnce({ kind: 'not_replayed' })
      .mockResolvedValueOnce({
        kind: 'replayed',
        record: accepted,
        occurredAt: '2026-08-20T01:00:01.000Z',
      });
    mocks.executeCommand.mockRejectedValueOnce(conflict);

    await expect(mutateCurrentInstitutionConversationControlledV1(
      'conversation-a',
      body({ kind: 'takeover' }),
    )).resolves.toMatchObject({ kind: 'ready' });

    expect(mocks.readAssignmentReplay).toHaveBeenCalledTimes(3);
    expect(mocks.recordAuditEvent).not.toHaveBeenCalled();
  });
});
