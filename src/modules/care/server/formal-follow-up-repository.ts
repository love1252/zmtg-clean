import { and, asc, eq, or } from 'drizzle-orm';

import type { FollowUpRolePoolRole } from '@/modules/care/domain/follow-up-assignment';
import type {
  FormalFollowUpCreateV1,
  FormalFollowUpEventV1,
  FormalFollowUpStoreV1,
  FormalFollowUpTaskRecordV1,
  FormalFollowUpUpdateV1,
  FormalFollowUpVisibilityV1,
} from '@/modules/care/ports/formal-follow-up-store';
import type { TenantDatabase } from '@/server/db/client';
import {
  careFormalFollowUpEvents,
  careFormalFollowUpTasks,
} from '@/server/db/schema';

type TaskRow = typeof careFormalFollowUpTasks.$inferSelect;

function mapRow(row: TaskRow): FormalFollowUpTaskRecordV1 {
  return Object.freeze({
    tenantId: row.tenantId,
    institutionId: row.institutionId,
    taskId: row.id,
    customerId: row.customerId,
    customerDisplayName: row.customerDisplayName,
    customerMaskedReference: row.customerMaskedReference,
    stageCode: row.stageCode as FormalFollowUpTaskRecordV1['stageCode'],
    actionCode: row.actionCode as FormalFollowUpTaskRecordV1['actionCode'],
    dueAt: row.dueAt.toISOString(),
    state: row.state,
    revision: row.revision,
    riskLevel: row.riskLevel,
    riskKind: row.riskKind,
    riskEventId: row.riskEventId,
    completionCode: row.completionCode,
    completionFeedback: row.completionFeedback,
    cancellationReason: row.cancellationReason,
    assignment:
      row.assigneeKind === 'role_pool'
        ? Object.freeze({
            kind: 'role_pool' as const,
            role: row.assigneeRole as FollowUpRolePoolRole,
          })
        : Object.freeze({
            kind: 'user' as const,
            userId: row.assigneeUserId as string,
            displayName: row.assigneeDisplayName as string,
            claimedFromRolePool:
              row.claimedFromRolePool as FollowUpRolePoolRole | null,
          }),
    idempotencyKey: row.idempotencyKey,
    requestDigest: row.requestDigest,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function isManagement(role: FormalFollowUpVisibilityV1['actorRole']) {
  return role === 'tenant_admin' || role === 'tenant_operator';
}

function visibility(input: FormalFollowUpVisibilityV1) {
  const scope = and(
    eq(careFormalFollowUpTasks.tenantId, input.tenantId),
    eq(careFormalFollowUpTasks.institutionId, input.institutionId),
  );

  if (isManagement(input.actorRole)) return scope;

  return and(
    scope,
    or(
      and(
        eq(careFormalFollowUpTasks.assigneeKind, 'user'),
        eq(careFormalFollowUpTasks.assigneeUserId, input.actorId),
      ),
      and(
        eq(careFormalFollowUpTasks.assigneeKind, 'role_pool'),
        eq(careFormalFollowUpTasks.assigneeRole, input.actorRole),
      ),
    ),
  );
}

function assignmentValues(
  assignment: FormalFollowUpTaskRecordV1['assignment'],
) {
  return assignment.kind === 'role_pool'
    ? {
        assigneeKind: 'role_pool' as const,
        assigneeUserId: null,
        assigneeDisplayName: null,
        assigneeRole: assignment.role,
        claimedFromRolePool: null,
      }
    : {
        assigneeKind: 'user' as const,
        assigneeUserId: assignment.userId,
        assigneeDisplayName: assignment.displayName,
        assigneeRole: null,
        claimedFromRolePool: assignment.claimedFromRolePool,
      };
}

export function createFormalFollowUpRepositoryV1(
  database: TenantDatabase,
): FormalFollowUpStoreV1 {
  return Object.freeze({
    async listVisible(
      input: FormalFollowUpVisibilityV1 & Readonly<{ limit: 101 }>,
    ) {
      const rows = await database
        .select()
        .from(careFormalFollowUpTasks)
        .where(visibility(input))
        .orderBy(
          asc(careFormalFollowUpTasks.dueAt),
          asc(careFormalFollowUpTasks.id),
        )
        .limit(input.limit);

      return Object.freeze(rows.map(mapRow));
    },

    async getVisible(
      input: FormalFollowUpVisibilityV1 & Readonly<{ taskId: string }>,
    ) {
      const rows = await database
        .select()
        .from(careFormalFollowUpTasks)
        .where(
          and(
            visibility(input),
            eq(careFormalFollowUpTasks.id, input.taskId),
          ),
        )
        .limit(2);

      return rows.length === 1 ? mapRow(rows[0]!) : null;
    },

    async getScopedCurrent(
      input: Readonly<{
        tenantId: string;
        institutionId: string;
        taskId: string;
      }>,
    ) {
      const rows = await database
        .select()
        .from(careFormalFollowUpTasks)
        .where(
          and(
            eq(careFormalFollowUpTasks.tenantId, input.tenantId),
            eq(careFormalFollowUpTasks.institutionId, input.institutionId),
            eq(careFormalFollowUpTasks.id, input.taskId),
          ),
        )
        .limit(2);

      return rows.length === 1 ? mapRow(rows[0]!) : null;
    },

    async getByIdempotency(
      input: Readonly<{
        tenantId: string;
        institutionId: string;
        idempotencyKey: string;
      }>,
    ) {
      const rows = await database
        .select()
        .from(careFormalFollowUpTasks)
        .where(
          and(
            eq(careFormalFollowUpTasks.tenantId, input.tenantId),
            eq(careFormalFollowUpTasks.institutionId, input.institutionId),
            eq(
              careFormalFollowUpTasks.idempotencyKey,
              input.idempotencyKey,
            ),
          ),
        )
        .limit(2);

      return rows.length === 1 ? mapRow(rows[0]!) : null;
    },

    async createWithEvent(
      input: FormalFollowUpCreateV1,
      event: FormalFollowUpEventV1,
    ) {
      const occurredAt = new Date(input.occurredAt);
      const rows = await database
        .insert(careFormalFollowUpTasks)
        .values({
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          id: input.taskId,
          customerId: input.customerId,
          customerDisplayName: input.customerDisplayName,
          customerMaskedReference: input.customerMaskedReference,
          stageCode: input.stageCode,
          actionCode: input.actionCode,
          dueAt: new Date(input.dueAt),
          state: 'pending',
          revision: 1,
          riskLevel: 'none',
          riskKind: null,
          riskEventId: null,
          completionCode: null,
          completionFeedback: null,
          cancellationReason: null,
          ...assignmentValues(input.assignment),
          idempotencyKey: input.idempotencyKey,
          requestDigest: input.requestDigest,
          sourceKind: 'manual_controlled_create',
          createdBy: input.actorId,
          updatedBy: input.actorId,
          createdAt: occurredAt,
          updatedAt: occurredAt,
        })
        .onConflictDoNothing()
        .returning();

      if (rows.length !== 1) return null;

      await database.insert(careFormalFollowUpEvents).values({
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        id: event.eventId,
        taskId: input.taskId,
        taskRevision: 1,
        eventType: event.eventType,
        actorId: event.actorId,
        actorRole: event.actorRole,
        fromState: event.fromState,
        toState: event.toState,
        reasonCode: event.reasonCode,
        occurredAt,
        createdAt: occurredAt,
      });

      return mapRow(rows[0]!);
    },

    async updateWithEvent(input: FormalFollowUpUpdateV1) {
      const next = input.next;
      const occurredAt = new Date(input.event.occurredAt);
      const rows = await database
        .update(careFormalFollowUpTasks)
        .set({
          stageCode: next.stageCode,
          actionCode: next.actionCode,
          dueAt: new Date(next.dueAt),
          state: next.state,
          revision: next.revision,
          riskLevel: next.riskLevel,
          riskKind: next.riskKind,
          riskEventId: next.riskEventId,
          completionCode: next.completionCode,
          completionFeedback: next.completionFeedback,
          cancellationReason: next.cancellationReason,
          ...assignmentValues(next.assignment),
          updatedBy: next.updatedBy,
          updatedAt: new Date(next.updatedAt),
        })
        .where(
          and(
            eq(careFormalFollowUpTasks.tenantId, input.tenantId),
            eq(careFormalFollowUpTasks.institutionId, input.institutionId),
            eq(careFormalFollowUpTasks.id, input.taskId),
            eq(
              careFormalFollowUpTasks.revision,
              input.expectedRevision,
            ),
          ),
        )
        .returning();

      if (rows.length !== 1) return null;

      await database.insert(careFormalFollowUpEvents).values({
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        id: input.event.eventId,
        taskId: input.taskId,
        taskRevision: next.revision,
        eventType: input.event.eventType,
        actorId: input.event.actorId,
        actorRole: input.event.actorRole,
        fromState: input.event.fromState,
        toState: input.event.toState,
        reasonCode: input.event.reasonCode,
        occurredAt,
        createdAt: occurredAt,
      });

      return mapRow(rows[0]!);
    },
  });
}
