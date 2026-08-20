import { createHash, randomUUID } from 'node:crypto';
import { isProxy } from 'node:util/types';

import { createAccessControlAuthoritativeMembershipFactReaderV1 } from '@/modules/access-control/application/authoritative-membership-reader';
import {
  createVerifiedInstitutionAttributedTenantAuditEventV1,
  type AuditReason,
  type VerifiedInstitutionAuditAttributionHandleV1,
} from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import type { ConversationControlledDtoV1 } from '@/modules/institution-conversations/application/conversation-controlled-view';
import {
  executeConversationCommandV1,
  isConversationCommandConflictError,
  readConversationAssignmentReplayV1,
  readScopedConversationCommandRecordV1,
  type ConversationCommandOperationV1,
  type ConversationCommandRecordV1,
} from '@/modules/institution-conversations/server/conversation-command-repository';
import type { CapabilityStatusV1 } from '@/modules/institution-contracts/v1/institution-capability';
import { isInstitutionRoleV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import { getDatabase, type TenantDatabase } from '@/server/db/client';
import { resolveInstitutionAuditWriterVerifiedAttributionV1 } from '@/server/orchestration/institution-audit-writer-scope';
import { resolveInstitutionCapabilityAuthorityStatusV1 } from '@/server/orchestration/institution-capability-authority';
import {
  consumeInstitutionConversationWriteAuthorizationV1,
  resolveInstitutionConversationWriteAuthorizationV1,
  type InstitutionConversationWriteAuthorizationConsumptionV1,
} from '@/server/orchestration/institution-conversation-write-authorization';

const stableIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;

export type ConversationControlledReadResultV1 =
  | Readonly<{ kind: 'ready'; record: ConversationControlledDtoV1 }>
  | Readonly<{ kind: 'forbidden' | 'not_found' | 'unavailable' }>;

export type ConversationControlledMutationResultV1 =
  | Readonly<{ kind: 'ready'; record: ConversationControlledDtoV1 }>
  | Readonly<{
      kind: 'invalid' | 'forbidden' | 'not_found' | 'conflict' | 'unavailable';
      code?: string;
    }>;

type Actor = InstitutionConversationWriteAuthorizationConsumptionV1;
type Authorization =
  | Readonly<{ kind: 'allowed'; actor: Actor }>
  | Readonly<{ kind: 'forbidden' }>
  | Readonly<{ kind: 'unavailable' }>;

const AUTH_FORBIDDEN = Object.freeze({ kind: 'forbidden' as const });
const AUTH_UNAVAILABLE = Object.freeze({ kind: 'unavailable' as const });

function isManagement(role: Actor['role']): boolean {
  return role === 'tenant_admin' || role === 'tenant_operator';
}

function releasedCapability(status: CapabilityStatusV1 | null): boolean {
  if (
    !status ||
    status.contractVersion !== 'v1' ||
    status.readiness !== 'ready' ||
    status.failureCode !== null ||
    !status.data
  ) return false;

  const capabilities = status.data.capabilities.filter(
    (item) => item.key === 'page_conversation_queue',
  );
  const partitions = status.partitions.filter(
    (item) => item.key === 'page_conversation_queue',
  );

  return (
    capabilities.length === 1 &&
    partitions.length === 1 &&
    capabilities[0]?.decision === 'operational' &&
    capabilities[0].dimensions.codeMaturity === 'verified' &&
    capabilities[0].dimensions.institutionAuthorization === 'authorized' &&
    capabilities[0].dimensions.connectionAvailability === 'not_required' &&
    capabilities[0].dimensions.dataReadiness === 'ready' &&
    capabilities[0].dimensions.productionRelease === 'pilot_released' &&
    capabilities[0].safeSummary === '会话队列可用' &&
    partitions[0]?.readiness === 'ready' &&
    partitions[0].failureCode === null
  );
}

async function authorize(): Promise<Authorization> {
  const resolution = await resolveInstitutionConversationWriteAuthorizationV1();
  if (resolution.kind === 'forbidden') return AUTH_FORBIDDEN;
  if (resolution.kind !== 'allowed') return AUTH_UNAVAILABLE;

  const actor = consumeInstitutionConversationWriteAuthorizationV1(
    resolution.authorization,
  );
  if (!actor) return AUTH_UNAVAILABLE;

  const status = await resolveInstitutionCapabilityAuthorityStatusV1();
  if (
    status?.scope.tenantId !== actor.tenantId ||
    status.scope.institutionId !== actor.institutionId ||
    !releasedCapability(status)
  ) return AUTH_UNAVAILABLE;

  return Object.freeze({ kind: 'allowed' as const, actor });
}

function snapshot(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Reflect.ownKeys(descriptors).length !== keys.length ||
      keys.some((key) => !Object.hasOwn(descriptors, key))
    ) return null;
    const result: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return null;
      Object.defineProperty(result, key, { value: descriptor.value, enumerable: true });
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function safeRevision(value: unknown, allowZero = false): number | null {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < (allowZero ? 0 : 1)
  ) return null;
  return value;
}

function parseOperation(value: unknown): ConversationCommandOperationV1 | null {
  const kindRecord = snapshot(value, ['kind']);
  if (kindRecord) {
    if (
      kindRecord.kind === 'request_human' ||
      kindRecord.kind === 'takeover' ||
      kindRecord.kind === 'release_takeover' ||
      kindRecord.kind === 'waiting_customer'
    ) return Object.freeze({ kind: kindRecord.kind });
    return null;
  }

  const assignment = snapshot(value, ['kind', 'assigneeUserId']);
  if (
    assignment &&
    (assignment.kind === 'assign' || assignment.kind === 'reassign') &&
    typeof assignment.assigneeUserId === 'string' &&
    stableIdPattern.test(assignment.assigneeUserId)
  ) {
    return Object.freeze({
      kind: assignment.kind,
      assigneeUserId: assignment.assigneeUserId,
      assigneeRole: 'customer_service' as const,
    });
  }

  const close = snapshot(value, ['kind', 'closeResultCode']);
  if (
    close &&
    close.kind === 'close' &&
    (close.closeResultCode === 'resolved' || close.closeResultCode === 'unresolved')
  ) {
    return Object.freeze({
      kind: 'close' as const,
      closeResultCode: close.closeResultCode,
    });
  }

  return null;
}

function parseMutation(value: unknown): Readonly<{
  expectedConversationRevision: number;
  expectedSegmentRevision: number;
  expectedAssignmentRevision: number;
  requestId: string;
  operation: ConversationCommandOperationV1;
}> | null {
  const input = snapshot(value, [
    'expectedConversationRevision',
    'expectedSegmentRevision',
    'expectedAssignmentRevision',
    'requestId',
    'operation',
  ]);
  if (!input) return null;

  const expectedConversationRevision = safeRevision(input.expectedConversationRevision);
  const expectedSegmentRevision = safeRevision(input.expectedSegmentRevision);
  const expectedAssignmentRevision = safeRevision(input.expectedAssignmentRevision, true);
  const operation = parseOperation(input.operation);
  if (
    expectedConversationRevision === null ||
    expectedSegmentRevision === null ||
    expectedAssignmentRevision === null ||
    typeof input.requestId !== 'string' ||
    !requestIdPattern.test(input.requestId) ||
    !operation
  ) return null;

  return Object.freeze({
    expectedConversationRevision,
    expectedSegmentRevision,
    expectedAssignmentRevision,
    requestId: input.requestId,
    operation,
  });
}

async function resolveCurrentAssignee(
  actor: Actor,
  accountId: string,
): Promise<Readonly<{ accountId: string; role: Actor['role'] }> | null> {
  const resolution = await createAccessControlAuthoritativeMembershipFactReaderV1().resolve({
    accountId,
    tenantId: actor.tenantId,
    institutionId: actor.institutionId,
  });
  if (
    resolution.kind !== 'current_membership_fact' ||
    !isInstitutionRoleV1(resolution.role)
  ) return null;
  return Object.freeze({ accountId: resolution.accountId, role: resolution.role });
}

function permissions(record: ConversationCommandRecordV1, actor: Actor) {
  const segment = record.segment;
  const assignment = segment?.assignment ?? null;
  const isAssignee = assignment?.assigneeUserId === actor.accountId;
  const isCurrentHandler = segment?.value.currentHandlerId === actor.accountId;
  const state = segment?.value.state ?? null;

  return Object.freeze({
    canRequestHuman: isManagement(actor.role) && state === 'ai_handling',
    canAssign:
      isManagement(actor.role) &&
      state === 'awaiting_human' &&
      assignment === null,
    canReassign:
      isManagement(actor.role) &&
      (
        (state === 'awaiting_human' && assignment?.status === 'assigned')
        || (
          (state === 'human_handling' || state === 'waiting_customer')
          && assignment?.status === 'accepted'
          && assignment.assigneeUserId === segment?.value.currentHandlerId
        )
      ),
    canTakeover:
      state === 'awaiting_human' &&
      assignment?.status === 'assigned' &&
      isAssignee,
    canReleaseTakeover:
      (state === 'human_handling' || state === 'waiting_customer') &&
      assignment?.status === 'accepted' &&
      isAssignee &&
      isCurrentHandler,
    canMarkWaitingCustomer:
      state === 'human_handling' &&
      assignment?.status === 'accepted' &&
      isAssignee &&
      isCurrentHandler,
    canClose:
      (state === 'human_handling' || state === 'waiting_customer') &&
      assignment?.status === 'accepted' &&
      isAssignee &&
      isCurrentHandler &&
      (segment?.value.blockingReasonCodes.length ?? 1) === 0 &&
      segment?.hasRiskFacts === false,
  });
}

function toDto(
  record: ConversationCommandRecordV1,
  actor: Actor,
): ConversationControlledDtoV1 {
  return Object.freeze({
    contractVersion: 'v1' as const,
    conversationId: record.conversationId,
    conversationRevision: record.conversationRevision,
    updatedAt: record.updatedAt,
    activeSegment: record.segment
      ? Object.freeze({
          segmentId: record.segment.value.segmentId,
          state: record.segment.value.state,
          revision: record.segment.revision,
          currentHandlerId: record.segment.value.currentHandlerId,
          everHumanHandled: record.segment.value.everHumanHandled,
          resolutionState: record.segment.value.resolutionState,
          segmentCloseKind: record.segment.value.segmentCloseKind,
          blockingReasonCodes: Object.freeze([
            ...record.segment.value.blockingReasonCodes,
          ]),
          assignmentRevision: record.segment.assignmentRevision,
          assignment: record.segment.assignment
            ? Object.freeze({ ...record.segment.assignment })
            : null,
        })
      : null,
    permissions: permissions(record, actor),
  });
}

function auditReason(operation: ConversationCommandOperationV1): AuditReason {
  switch (operation.kind) {
    case 'request_human': return 'conversation_human_requested';
    case 'assign': return 'conversation_assigned';
    case 'reassign': return 'conversation_reassigned';
    case 'takeover': return 'conversation_takeover_started';
    case 'release_takeover': return 'conversation_takeover_released';
    case 'waiting_customer': return 'conversation_waiting_customer';
    case 'close': return 'conversation_closed';
  }
}

type ConversationStateOperationV1 = Extract<
  ConversationCommandOperationV1,
  { kind: 'request_human' | 'waiting_customer' }
>;

function isConversationStateOperationV1(
  operation: ConversationCommandOperationV1,
): operation is ConversationStateOperationV1 {
  return operation.kind === 'request_human' || operation.kind === 'waiting_customer';
}

function recordInActorScope(
  record: ConversationCommandRecordV1,
  actor: Actor,
): boolean {
  if (isManagement(actor.role)) return true;
  const assignment = record.segment?.assignment ?? null;
  return (
    assignment !== null
    && assignment.assigneeUserId === actor.accountId
    && (assignment.status === 'assigned' || assignment.status === 'accepted')
  );
}

function safeSuccessorRevision(value: number): number | null {
  const next = value + 1;
  return Number.isSafeInteger(next) ? next : null;
}

function replayRecordVisibleToActor(
  record: ConversationCommandRecordV1,
  actor: Actor,
  expectedConversationRevision: number,
  expectedSegmentRevision: number,
  expectedAssignmentRevision: number,
  operation: ConversationCommandOperationV1,
): boolean {
  if (recordInActorScope(record, actor)) return true;

  if (operation.kind !== 'release_takeover' && operation.kind !== 'close') {
    return false;
  }

  const segment = record.segment;
  const nextConversationRevision = safeSuccessorRevision(
    expectedConversationRevision,
  );
  const nextSegmentRevision = safeSuccessorRevision(expectedSegmentRevision);
  const nextAssignmentRevision = safeSuccessorRevision(
    expectedAssignmentRevision,
  );
  if (
    !segment
    || nextConversationRevision === null
    || nextSegmentRevision === null
    || nextAssignmentRevision === null
    || record.conversationRevision !== nextConversationRevision
    || segment.revision !== nextSegmentRevision
    || segment.assignmentRevision !== nextAssignmentRevision
    || segment.assignment !== null
  ) {
    return false;
  }

  if (operation.kind === 'release_takeover') {
    return (
      segment.value.state === 'awaiting_human'
      && segment.value.currentHandlerId === null
    );
  }

  return segment.value.state === 'closed';
}

function replayReadyMutationResult(
  record: ConversationCommandRecordV1,
  actor: Actor,
  expectedConversationRevision: number,
  expectedSegmentRevision: number,
  expectedAssignmentRevision: number,
  operation: ConversationCommandOperationV1,
): ConversationControlledMutationResultV1 {
  if (
    !replayRecordVisibleToActor(
      record,
      actor,
      expectedConversationRevision,
      expectedSegmentRevision,
      expectedAssignmentRevision,
      operation,
    )
  ) {
    return Object.freeze({ kind: 'not_found' as const });
  }

  return Object.freeze({
    kind: 'ready' as const,
    record: toDto(record, actor),
  });
}

function conversationStateOperationAuditEventId(
  actor: Actor,
  conversationId: string,
  requestId: string,
  expectedConversationRevision: number,
  expectedSegmentRevision: number,
  expectedAssignmentRevision: number,
  operation: ConversationStateOperationV1,
): string {
  const digest = createHash('sha256')
    .update(
      [
        'conversation-controlled-state-operation-v2',
        actor.tenantId,
        actor.institutionId,
        actor.accountId,
        conversationId,
        requestId,
        operation.kind,
        String(expectedConversationRevision),
        String(expectedSegmentRevision),
        String(expectedAssignmentRevision),
      ].join('\n'),
      'utf8',
    )
    .digest('hex');
  return `cwo_${digest.slice(0, 60)}`;
}

type ConversationStateOperationReplayResultV1 =
  | Readonly<{ kind: 'replayed'; record: ConversationCommandRecordV1 }>
  | Readonly<{ kind: 'not_replayed' | 'idempotency_conflict' | 'not_found' }>;

async function readConversationStateOperationReplayV1(
  database: TenantDatabase,
  actor: Actor,
  conversationId: string,
  requestId: string,
  expectedConversationRevision: number,
  expectedSegmentRevision: number,
  expectedAssignmentRevision: number,
  operation: ConversationStateOperationV1,
): Promise<ConversationStateOperationReplayResultV1> {
  const eventId = conversationStateOperationAuditEventId(
    actor,
    conversationId,
    requestId,
    expectedConversationRevision,
    expectedSegmentRevision,
    expectedAssignmentRevision,
    operation,
  );
  const fact = await createAuditEventRepository(database)
    .readVerifiedInstitutionAuditEventById({
      eventId,
      tenantId: actor.tenantId,
      institutionId: actor.institutionId,
    });

  if (!fact) return Object.freeze({ kind: 'not_replayed' as const });

  if (
    fact.eventId !== eventId
    || fact.actorId !== actor.accountId
    || fact.resource !== 'ai_conversation'
    || fact.resourceId !== conversationId
    || fact.action !== 'update'
    || fact.result !== 'transitioned'
    || fact.reason !== auditReason(operation)
    || fact.source !== 'server_session'
  ) {
    return Object.freeze({ kind: 'idempotency_conflict' as const });
  }

  const record = await readScopedConversationCommandRecordV1(database, {
    tenantId: actor.tenantId,
    institutionId: actor.institutionId,
    conversationId,
  });
  if (!record || !recordInActorScope(record, actor)) {
    return Object.freeze({ kind: 'not_found' as const });
  }

  return Object.freeze({ kind: 'replayed' as const, record });
}

async function auditChanged(
  database: TenantDatabase,
  actor: Actor,
  conversationId: string,
  reason: AuditReason,
  occurredAt: string,
  attribution: VerifiedInstitutionAuditAttributionHandleV1,
  eventId: string,
) {
  const event = createVerifiedInstitutionAttributedTenantAuditEventV1({
    event: {
      eventId,
      actorId: actor.accountId,
      actorRole: actor.role,
      tenantId: actor.tenantId,
      scope: 'tenant',
      resource: 'ai_conversation',
      resourceId: conversationId,
      action: 'update',
      result: 'transitioned',
      reason,
      occurredAt,
      source: 'server_session',
    },
    attribution,
  });
  if (!event) throw new Error('conversation_audit_event_invalid');
  await createAuditEventRepository(database).recordAttributed(event);
}

export async function readCurrentInstitutionConversationControlledV1(
  conversationId: string,
): Promise<ConversationControlledReadResultV1> {
  if (!stableIdPattern.test(conversationId)) {
    return Object.freeze({ kind: 'not_found' as const });
  }
  const authorization = await authorize().catch(() => AUTH_UNAVAILABLE);
  if (authorization.kind !== 'allowed') {
    return Object.freeze({ kind: authorization.kind });
  }

  try {
    const record = await readScopedConversationCommandRecordV1(getDatabase(), {
      tenantId: authorization.actor.tenantId,
      institutionId: authorization.actor.institutionId,
      conversationId,
    });
    if (!record || !recordInActorScope(record, authorization.actor)) {
      return Object.freeze({ kind: 'not_found' as const });
    }
    return Object.freeze({
      kind: 'ready' as const,
      record: toDto(record, authorization.actor),
    });
  } catch {
    return Object.freeze({ kind: 'unavailable' as const });
  }
}

export async function mutateCurrentInstitutionConversationControlledV1(
  conversationId: string,
  value: unknown,
): Promise<ConversationControlledMutationResultV1> {
  if (!stableIdPattern.test(conversationId)) {
    return Object.freeze({ kind: 'not_found' as const });
  }

  const authorization = await authorize().catch(() => AUTH_UNAVAILABLE);
  if (authorization.kind !== 'allowed') {
    return Object.freeze({ kind: authorization.kind });
  }
  const actor = authorization.actor;
  const parsed = parseMutation(value);
  if (!parsed) {
    return Object.freeze({
      kind: 'invalid' as const,
      code: 'invalid_conversation_update',
    });
  }

  const database = getDatabase();
  let operation = parsed.operation;

  if (isConversationStateOperationV1(operation)) {
    const replay = await readConversationStateOperationReplayV1(
      database,
      actor,
      conversationId,
      parsed.requestId,
      parsed.expectedConversationRevision,
      parsed.expectedSegmentRevision,
      parsed.expectedAssignmentRevision,
      operation,
    ).catch(() => null);
    if (!replay) return Object.freeze({ kind: 'unavailable' as const });
    if (replay.kind === 'replayed') {
      return replayReadyMutationResult(
        replay.record,
        actor,
        parsed.expectedConversationRevision,
        parsed.expectedSegmentRevision,
        parsed.expectedAssignmentRevision,
        operation,
      );
    }
    if (replay.kind === 'idempotency_conflict') {
      return Object.freeze({
        kind: 'conflict' as const,
        code: 'idempotency_conflict',
      });
    }
    if (replay.kind === 'not_found') {
      return Object.freeze({ kind: 'not_found' as const });
    }
  }

  if (operation.kind === 'assign' || operation.kind === 'reassign') {
    const replay = await readConversationAssignmentReplayV1(database, {
      tenantId: actor.tenantId,
      institutionId: actor.institutionId,
      conversationId,
      expectedConversationRevision: parsed.expectedConversationRevision,
      expectedAssignmentRevision: parsed.expectedAssignmentRevision,
      requestId: parsed.requestId,
      actorUserId: actor.accountId,
      operation: {
        kind: operation.kind,
        assigneeUserId: operation.assigneeUserId,
      },
    }).catch(() => null);
    if (!replay) return Object.freeze({ kind: 'unavailable' as const });
    if (replay.kind === 'replayed') {
      return replayReadyMutationResult(
        replay.record,
        actor,
        parsed.expectedConversationRevision,
        parsed.expectedSegmentRevision,
        parsed.expectedAssignmentRevision,
        operation,
      );
    }
    if (replay.kind === 'idempotency_conflict') {
      return Object.freeze({
        kind: 'conflict' as const,
        code: 'idempotency_conflict',
      });
    }
    if (replay.kind === 'not_found_or_not_owned') {
      return Object.freeze({ kind: 'not_found' as const });
    }
  }

  if (
    operation.kind === 'takeover'
    || operation.kind === 'release_takeover'
    || operation.kind === 'close'
  ) {
    const replay = await readConversationAssignmentReplayV1(database, {
      tenantId: actor.tenantId,
      institutionId: actor.institutionId,
      conversationId,
      expectedConversationRevision: parsed.expectedConversationRevision,
      expectedAssignmentRevision: parsed.expectedAssignmentRevision,
      requestId: parsed.requestId,
      actorUserId: actor.accountId,
      operation,
    }).catch(() => null);
    if (!replay) return Object.freeze({ kind: 'unavailable' as const });
    if (replay.kind === 'replayed') {
      return replayReadyMutationResult(
        replay.record,
        actor,
        parsed.expectedConversationRevision,
        parsed.expectedSegmentRevision,
        parsed.expectedAssignmentRevision,
        operation,
      );
    }
    if (replay.kind === 'idempotency_conflict') {
      return Object.freeze({
        kind: 'conflict' as const,
        code: 'idempotency_conflict',
      });
    }
    if (replay.kind === 'not_found_or_not_owned') {
      return Object.freeze({ kind: 'not_found' as const });
    }
  }

  let currentRecord: ConversationCommandRecordV1 | null;
  try {
    currentRecord = await readScopedConversationCommandRecordV1(database, {
      tenantId: actor.tenantId,
      institutionId: actor.institutionId,
      conversationId,
    });
  } catch {
    return Object.freeze({ kind: 'unavailable' as const });
  }

  if (!currentRecord || !recordInActorScope(currentRecord, actor)) {
    return Object.freeze({ kind: 'not_found' as const });
  }

  if (operation.kind === 'request_human' && !isManagement(actor.role)) {
    return Object.freeze({ kind: 'forbidden' as const });
  }

  if (operation.kind === 'assign' || operation.kind === 'reassign') {
    if (!isManagement(actor.role)) {
      return Object.freeze({ kind: 'forbidden' as const });
    }
    const assignee = await resolveCurrentAssignee(
      actor,
      operation.assigneeUserId,
    ).catch(() => null);
    if (!assignee) {
      return Object.freeze({
        kind: 'invalid' as const,
        code: 'invalid_conversation_assignee',
      });
    }
    operation = Object.freeze({
      kind: operation.kind,
      assigneeUserId: assignee.accountId,
      assigneeRole: assignee.role,
    });
  }

  const auditAttribution =
    await resolveInstitutionAuditWriterVerifiedAttributionV1({
      tenantId: actor.tenantId,
      institutionId: actor.institutionId,
    }).catch(() => null);
  if (!auditAttribution) {
    return Object.freeze({ kind: 'unavailable' as const });
  }

  const auditEventId = isConversationStateOperationV1(operation)
    ? conversationStateOperationAuditEventId(
        actor,
        conversationId,
        parsed.requestId,
        parsed.expectedConversationRevision,
        parsed.expectedSegmentRevision,
        parsed.expectedAssignmentRevision,
        operation,
      )
    : randomUUID();

  try {
    return await database.transaction(async (transactionDatabase) => {
      const transactionDb = transactionDatabase as unknown as TenantDatabase;
      const result = await executeConversationCommandV1(transactionDb, {
        tenantId: actor.tenantId,
        institutionId: actor.institutionId,
        conversationId,
        expectedConversationRevision: parsed.expectedConversationRevision,
        expectedSegmentRevision: parsed.expectedSegmentRevision,
        expectedAssignmentRevision: parsed.expectedAssignmentRevision,
        requestId: parsed.requestId,
        actor: { userId: actor.accountId, role: actor.role },
        operation,
      });

      if (result.kind === 'not_found_or_not_owned') {
        return Object.freeze({ kind: 'not_found' as const });
      }
      if (result.kind === 'blocked') {
        const forbiddenCodes = new Set([
          'actor_role_not_allowed',
          'actor_not_assignee',
          'operator_not_current_handler',
          'operator_not_active_assignee',
        ]);
        return Object.freeze({
          kind: forbiddenCodes.has(result.code) ? 'forbidden' as const : 'conflict' as const,
          code: result.code,
        });
      }

      if (result.kind === 'applied') {
        await auditChanged(
          transactionDb,
          actor,
          conversationId,
          auditReason(operation),
          result.occurredAt,
          auditAttribution,
          auditEventId,
        );
      }

      return Object.freeze({
        kind: 'ready' as const,
        record: toDto(result.record, actor),
      });
    });
  } catch (error) {
    if (isConversationCommandConflictError(error)) {
      return Object.freeze({ kind: 'conflict' as const, code: error.code });
    }
    return Object.freeze({ kind: 'unavailable' as const });
  }
}
