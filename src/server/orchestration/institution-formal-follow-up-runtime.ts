import { createHash, randomUUID } from 'node:crypto';

import {
  createVerifiedInstitutionAttributedTenantAuditEventV1,
  type AuditReason,
} from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { createAccessControlAuthoritativeMembershipFactReaderV1 } from '@/modules/access-control/application/authoritative-membership-reader';
import {
  claimFollowUpRolePoolAssignment,
  isFollowUpAssignmentAdministrativeRole,
  isFollowUpRolePoolRole,
  reassignFollowUpAssignment,
  unclaimFollowUpAssignment,
  type FollowUpAssignment,
  type FollowUpRolePoolRole,
} from '@/modules/care/domain/follow-up-assignment';
import {
  isFollowUpControlledActionCode,
  isFollowUpControlledStageCode,
} from '@/modules/care/domain/follow-up-controlled-create';
import {
  cancelFollowUpTask,
  completeFollowUpTask,
  escalateFollowUpTask,
  transitionFollowUpTask,
  type FollowUpCancellationReason,
  type FollowUpRiskEscalationKind,
  type FollowUpTask,
  type FollowUpTaskState,
} from '@/modules/care/domain/follow-up-task';
import type { FormalFollowUpDtoV1 } from '@/modules/care/application/formal-follow-up-view';
import type {
  FormalFollowUpAssignmentV1,
  FormalFollowUpEventTypeV1,
  FormalFollowUpTaskRecordV1,
} from '@/modules/care/ports/formal-follow-up-store';
import { createFormalFollowUpRepositoryV1 } from '@/modules/care/server/formal-follow-up-repository';
import { createCustomerReferenceRepositoryV1 } from '@/modules/customer-center/server/customer-reference-repository';
import type { CapabilityStatusV1 } from '@/modules/institution-contracts/v1/institution-capability';
import { getDatabase, type TenantDatabase } from '@/server/db/client';
import { resolveInstitutionAuditWriterVerifiedAttributionV1 } from '@/server/orchestration/institution-audit-writer-scope';
import {
  consumeInstitutionCareWriteAuthorizationV1,
  resolveInstitutionCareWriteAuthorizationV1,
  type InstitutionCareWriteAuthorizationConsumptionV1,
} from '@/server/orchestration/institution-care-write-authorization';
import { resolveInstitutionCapabilityAuthorityStatusV1 } from '@/server/orchestration/institution-capability-authority';

const idempotencyPattern =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const stableIdPattern =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;
const canonicalInstant =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export type FormalFollowUpListResultV1 =
  | Readonly<{
      kind: 'ready';
      records: readonly FormalFollowUpDtoV1[];
      canCreate: boolean;
      hasMore: boolean;
    }>
  | Readonly<{
      kind: 'forbidden' | 'unavailable';
    }>;

export type FormalFollowUpReadResultV1 =
  | Readonly<{
      kind: 'ready';
      record: FormalFollowUpDtoV1;
      canCreate: boolean;
    }>
  | Readonly<{
      kind: 'forbidden' | 'not_found' | 'unavailable';
    }>;

export type FormalFollowUpMutationResultV1 =
  | Readonly<{
      kind: 'ready';
      record: FormalFollowUpDtoV1;
      idempotent?: true;
    }>
  | Readonly<{
      kind:
        | 'invalid'
        | 'forbidden'
        | 'not_found'
        | 'conflict'
        | 'unavailable';
      code?: string;
    }>;

function isManagement(
  role: InstitutionCareWriteAuthorizationConsumptionV1['role'],
): boolean {
  return isFollowUpAssignmentAdministrativeRole(role);
}

function releasedCapability(
  status: CapabilityStatusV1 | null,
  key:
    | 'page_care_followups'
    | 'action_care_followup_create',
): boolean {
  if (
    !status
    || status.contractVersion !== 'v1'
    || status.readiness !== 'ready'
    || status.failureCode !== null
    || !status.data
  ) {
    return false;
  }

  const capabilities = status.data.capabilities.filter(
    (item) => item.key === key,
  );
  const partitions = status.partitions.filter(
    (item) => item.key === key,
  );

  return (
    capabilities.length === 1
    && partitions.length === 1
    && capabilities[0]?.decision === 'operational'
    && capabilities[0].dimensions.codeMaturity === 'verified'
    && capabilities[0].dimensions.institutionAuthorization
      === 'authorized'
    && capabilities[0].dimensions.connectionAvailability
      === 'not_required'
    && capabilities[0].dimensions.dataReadiness === 'ready'
    && capabilities[0].dimensions.productionRelease
      === 'pilot_released'
    && (
      key === 'page_care_followups'
        ? capabilities[0].safeSummary === '随访任务可用'
        : capabilities[0].safeSummary === null
    )
    && partitions[0]?.readiness === 'ready'
    && partitions[0].failureCode === null
  );
}

type FormalFollowUpAuthorizationV1 =
  | Readonly<{
      kind: 'allowed';
      actor: InstitutionCareWriteAuthorizationConsumptionV1;
    }>
  | Readonly<{ kind: 'forbidden' }>
  | Readonly<{ kind: 'unavailable' }>;

const AUTH_FORBIDDEN = Object.freeze({
  kind: 'forbidden' as const,
});
const AUTH_UNAVAILABLE = Object.freeze({
  kind: 'unavailable' as const,
});

async function authorize(
  requireCreate: boolean,
): Promise<FormalFollowUpAuthorizationV1> {
  const resolution =
    await resolveInstitutionCareWriteAuthorizationV1();

  if (resolution.kind === 'forbidden') {
    return AUTH_FORBIDDEN;
  }
  if (resolution.kind !== 'allowed') {
    return AUTH_UNAVAILABLE;
  }

  const actor =
    consumeInstitutionCareWriteAuthorizationV1(
      resolution.authorization,
    );
  if (!actor) return AUTH_UNAVAILABLE;

  const status =
    await resolveInstitutionCapabilityAuthorityStatusV1();
  if (
    status?.scope.tenantId !== actor.tenantId
    || status.scope.institutionId !== actor.institutionId
    || !releasedCapability(status, 'page_care_followups')
  ) {
    return AUTH_UNAVAILABLE;
  }
  if (
    requireCreate
    && !releasedCapability(
      status,
      'action_care_followup_create',
    )
  ) {
    return AUTH_UNAVAILABLE;
  }

  return Object.freeze({
    kind: 'allowed' as const,
    actor,
  });
}

function permissions(
  record: FormalFollowUpTaskRecordV1,
  actor: InstitutionCareWriteAuthorizationConsumptionV1,
): FormalFollowUpDtoV1['permissions'] {
  const management = isManagement(actor.role);
  const assignmentMutable =
    record.state !== 'completed'
    && record.state !== 'cancelled';
  const canClaim =
    assignmentMutable
    && record.assignment.kind === 'role_pool'
    && record.assignment.role === actor.role;
  const own =
    record.assignment.kind === 'user'
    && record.assignment.userId === actor.accountId;

  return Object.freeze({
    canClaim,
    canOperate: own,
    canReassign: management && assignmentMutable,
    canUnclaim:
      management
      && assignmentMutable
      && record.assignment.kind === 'user'
      && record.assignment.claimedFromRolePool !== null,
    canCancel: management,
  });
}

function toDto(
  record: FormalFollowUpTaskRecordV1,
  actor: InstitutionCareWriteAuthorizationConsumptionV1,
): FormalFollowUpDtoV1 {
  return Object.freeze({
    taskId: record.taskId,
    customer: Object.freeze({
      customerId: record.customerId,
      displayName: record.customerDisplayName,
      maskedReference: record.customerMaskedReference,
    }),
    stageCode: record.stageCode,
    actionCode: record.actionCode,
    dueAt: record.dueAt,
    state: record.state,
    revision: record.revision,
    riskLevel: record.riskLevel,
    riskKind: record.riskKind,
    completionCode: record.completionCode,
    cancellationReason: record.cancellationReason,
    assignment:
      record.assignment.kind === 'role_pool'
        ? Object.freeze({
            kind: 'role_pool' as const,
            role: record.assignment.role,
          })
        : Object.freeze({
            kind: 'user' as const,
            displayName: record.assignment.displayName,
            claimedFromRolePool:
              record.assignment.claimedFromRolePool,
          }),
    permissions: permissions(record, actor),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function snapshot(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      value === null
      || typeof value !== 'object'
      || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return null;
    }

    const descriptors =
      Object.getOwnPropertyDescriptors(value);
    if (
      Reflect.ownKeys(descriptors).length !== keys.length
      || keys.some((key) => !Object.hasOwn(descriptors, key))
    ) {
      return null;
    }

    const result: Record<string, unknown> =
      Object.create(null);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (
        !descriptor
        || !descriptor.enumerable
        || !('value' in descriptor)
      ) {
        return null;
      }
      Object.defineProperty(result, key, {
        value: descriptor.value,
        enumerable: true,
      });
    }

    return Object.freeze(result);
  } catch {
    return null;
  }
}

function readInstant(value: unknown): string | null {
  if (
    typeof value !== 'string'
    || !canonicalInstant.test(value)
  ) {
    return null;
  }

  const epochMs = Date.parse(value);
  return (
    Number.isFinite(epochMs)
    && new Date(epochMs).toISOString() === value
  )
    ? value
    : null;
}

function parseCreate(value: unknown) {
  const input = snapshot(value, [
    'idempotencyKey',
    'customerId',
    'stageCode',
    'actionCode',
    'dueAt',
    'assignment',
  ]);
  if (
    !input
    || typeof input.idempotencyKey !== 'string'
    || !idempotencyPattern.test(input.idempotencyKey)
    || typeof input.customerId !== 'string'
    || !stableIdPattern.test(input.customerId)
    || !isFollowUpControlledStageCode(input.stageCode)
    || !isFollowUpControlledActionCode(input.actionCode)
  ) {
    return null;
  }

  const dueAt = readInstant(input.dueAt);
  if (!dueAt) return null;

  const rolePool = snapshot(
    input.assignment,
    ['kind', 'role'],
  );
  const user = snapshot(
    input.assignment,
    ['kind', 'userId'],
  );

  if (
    rolePool
    && rolePool.kind === 'role_pool'
    && isFollowUpRolePoolRole(rolePool.role)
  ) {
    return Object.freeze({
      idempotencyKey: input.idempotencyKey,
      customerId: input.customerId,
      stageCode: input.stageCode,
      actionCode: input.actionCode,
      dueAt,
      assignment: Object.freeze({
        kind: 'role_pool' as const,
        role: rolePool.role,
      }),
    });
  }

  if (
    user
    && user.kind === 'user'
    && typeof user.userId === 'string'
    && stableIdPattern.test(user.userId)
  ) {
    return Object.freeze({
      idempotencyKey: input.idempotencyKey,
      customerId: input.customerId,
      stageCode: input.stageCode,
      actionCode: input.actionCode,
      dueAt,
      assignment: Object.freeze({
        kind: 'user' as const,
        userId: user.userId,
      }),
    });
  }

  return null;
}

function requestDigest(
  value: NonNullable<ReturnType<typeof parseCreate>>,
): string {
  return createHash('sha256')
    .update(JSON.stringify(value), 'utf8')
    .digest('hex');
}

function readMutation(value: unknown) {
  if (
    value === null
    || typeof value !== 'object'
    || Array.isArray(value)
  ) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const command = raw.command;
  const expectedKeys =
    command === 'claim'
      ? ['command', 'expectedRevision']
      : command === 'transition'
        ? ['command', 'expectedRevision', 'targetState']
        : command === 'escalate'
          ? ['command', 'expectedRevision', 'kind']
          : command === 'complete'
            ? [
                'command',
                'expectedRevision',
                'code',
                'feedback',
              ]
            : command === 'cancel'
                || command === 'unclaim'
              ? ['command', 'expectedRevision', 'reason']
              : command === 'reassign'
                ? [
                    'command',
                    'expectedRevision',
                    'target',
                    'reason',
                  ]
                : null;

  if (!expectedKeys) return null;
  const exact = snapshot(value, expectedKeys);
  if (!exact) return null;

  const expectedRevision = exact.expectedRevision;
  if (
    typeof expectedRevision !== 'number'
    || !Number.isSafeInteger(expectedRevision)
    || expectedRevision < 1
  ) {
    return null;
  }

  return Object.freeze({
    command: command as string,
    expectedRevision,
    raw: exact,
  });
}

function assignmentForDomain(
  record: FormalFollowUpTaskRecordV1,
): FollowUpAssignment {
  return record.assignment.kind === 'role_pool'
    ? {
        kind: 'role_pool',
        institutionId: record.institutionId,
        revision: record.revision,
        role: record.assignment.role,
      }
    : {
        kind: 'user',
        institutionId: record.institutionId,
        revision: record.revision,
        assigneeUserId: record.assignment.userId,
        claimedFromRolePool:
          record.assignment.claimedFromRolePool,
      };
}

function taskForDomain(
  record: FormalFollowUpTaskRecordV1,
): FollowUpTask {
  return {
    taskId: record.taskId,
    institutionId: record.institutionId,
    state: record.state,
    revision: record.revision,
    riskLevel: record.riskLevel,
    riskEscalation:
      record.state === 'escalated'
      && record.riskKind
      && record.riskEventId
        ? {
            level: 'high',
            kind: record.riskKind,
            riskEventId: record.riskEventId,
          }
        : null,
    completionResult:
      record.state === 'completed'
      && record.completionCode
        ? {
            code: record.completionCode,
            feedback:
              record.completionFeedback === null
                ? null
                : {
                    kind: 'manual_low_sensitivity',
                    summary: record.completionFeedback,
                  },
          }
        : null,
    cancellationReason: record.cancellationReason,
  };
}

function nextRecord(
  record: FormalFollowUpTaskRecordV1,
  actor: InstitutionCareWriteAuthorizationConsumptionV1,
  patch: Partial<FormalFollowUpTaskRecordV1>,
): FormalFollowUpTaskRecordV1 {
  return {
    ...record,
    ...patch,
    updatedBy: actor.accountId,
    updatedAt: new Date(Date.now()).toISOString(),
  };
}

function assignmentFromDomain(
  record: FormalFollowUpTaskRecordV1,
  next: FollowUpAssignment,
  displayName: string | null,
): FormalFollowUpAssignmentV1 {
  if (next.kind === 'role_pool') {
    return {
      kind: 'role_pool',
      role: next.role,
    };
  }

  return {
    kind: 'user',
    userId: next.assigneeUserId,
    displayName:
      displayName
      ?? (
        record.assignment.kind === 'user'
        && record.assignment.userId
          === next.assigneeUserId
          ? record.assignment.displayName
          : next.assigneeUserId
      ),
    claimedFromRolePool: next.claimedFromRolePool,
  };
}

function taskPatchFromDomain(
  record: FormalFollowUpTaskRecordV1,
  task: FollowUpTask,
  actor: InstitutionCareWriteAuthorizationConsumptionV1,
): FormalFollowUpTaskRecordV1 {
  return nextRecord(record, actor, {
    state: task.state,
    revision: task.revision,
    riskLevel: task.riskLevel,
    riskKind: task.riskEscalation?.kind ?? null,
    riskEventId:
      task.riskEscalation?.riskEventId ?? null,
    completionCode:
      task.completionResult?.code ?? null,
    completionFeedback:
      task.completionResult?.feedback?.summary ?? null,
    cancellationReason: task.cancellationReason,
  });
}

async function targetMember(
  actor: InstitutionCareWriteAuthorizationConsumptionV1,
  userId: string,
) {
  const resolution =
    await createAccessControlAuthoritativeMembershipFactReaderV1()
      .resolve({
        accountId: userId,
        tenantId: actor.tenantId,
        institutionId: actor.institutionId,
      });

  if (
    resolution.kind !== 'current_membership_fact'
    || !isFollowUpRolePoolRole(resolution.role)
  ) {
    return null;
  }

  return Object.freeze({
    institutionId: actor.institutionId,
    userId: resolution.accountId,
    role: resolution.role,
    active: true,
    displayName: resolution.membershipDisplayName,
  });
}

async function auditChanged(
  database: TenantDatabase,
  actor: InstitutionCareWriteAuthorizationConsumptionV1,
  taskId: string,
  action: 'create' | 'update',
  reason: AuditReason,
  occurredAt: string,
) {
  const attribution =
    await resolveInstitutionAuditWriterVerifiedAttributionV1({
      tenantId: actor.tenantId,
      institutionId: actor.institutionId,
    });
  if (!attribution) {
    throw new Error(
      'care_follow_up_audit_attribution_unavailable',
    );
  }

  const event =
    createVerifiedInstitutionAttributedTenantAuditEventV1({
      event: {
        eventId: randomUUID(),
        actorId: actor.accountId,
        actorRole: actor.role,
        tenantId: actor.tenantId,
        scope: 'tenant',
        resource: 'follow_up',
        resourceId: taskId,
        action,
        result: 'transitioned',
        reason,
        occurredAt,
        source: 'server_session',
      },
      attribution,
    });
  if (!event) {
    throw new Error('care_follow_up_audit_event_invalid');
  }

  await createAuditEventRepository(
    database,
  ).recordAttributed(event);
}

export async function readCurrentInstitutionFormalFollowUpsV1(): Promise<
  FormalFollowUpListResultV1
> {
  const authorization =
    await authorize(false).catch(
      () => AUTH_UNAVAILABLE,
    );
  if (authorization.kind !== 'allowed') {
    return Object.freeze({
      kind: authorization.kind,
    });
  }
  const actor = authorization.actor;

  try {
    const records =
      await createFormalFollowUpRepositoryV1(
        getDatabase(),
      ).listVisible({
        tenantId: actor.tenantId,
        institutionId: actor.institutionId,
        actorId: actor.accountId,
        actorRole: actor.role,
        limit: 101,
      });

    if (records.length > 101) {
      return Object.freeze({
        kind: 'unavailable' as const,
      });
    }

    return Object.freeze({
      kind: 'ready' as const,
      records: Object.freeze(
        records
          .slice(0, 100)
          .map((record) => toDto(record, actor)),
      ),
      canCreate: isManagement(actor.role),
      hasMore: records.length > 100,
    });
  } catch {
    return Object.freeze({
      kind: 'unavailable' as const,
    });
  }
}

export async function readCurrentInstitutionFormalFollowUpV1(
  taskId: string,
): Promise<FormalFollowUpReadResultV1> {
  if (!stableIdPattern.test(taskId)) {
    return Object.freeze({
      kind: 'not_found' as const,
    });
  }

  const authorization =
    await authorize(false).catch(
      () => AUTH_UNAVAILABLE,
    );
  if (authorization.kind !== 'allowed') {
    return Object.freeze({
      kind: authorization.kind,
    });
  }
  const actor = authorization.actor;

  try {
    const record =
      await createFormalFollowUpRepositoryV1(
        getDatabase(),
      ).getVisible({
        tenantId: actor.tenantId,
        institutionId: actor.institutionId,
        actorId: actor.accountId,
        actorRole: actor.role,
        taskId,
      });

    return record
      ? Object.freeze({
          kind: 'ready' as const,
          record: toDto(record, actor),
          canCreate: isManagement(actor.role),
        })
      : Object.freeze({
          kind: 'not_found' as const,
        });
  } catch {
    return Object.freeze({
      kind: 'unavailable' as const,
    });
  }
}

export async function createCurrentInstitutionFormalFollowUpV1(
  value: unknown,
): Promise<FormalFollowUpMutationResultV1> {
  const authorization =
    await authorize(true).catch(
      () => AUTH_UNAVAILABLE,
    );
  if (authorization.kind !== 'allowed') {
    return Object.freeze({
      kind: authorization.kind,
    });
  }
  const actor = authorization.actor;
  if (!isManagement(actor.role)) {
    return Object.freeze({
      kind: 'forbidden' as const,
    });
  }

  const input = parseCreate(value);
  if (!input) {
    return Object.freeze({
      kind: 'invalid' as const,
      code: 'invalid_follow_up_create',
    });
  }

  const database = getDatabase();
  const customer =
    await createCustomerReferenceRepositoryV1(
      database,
    ).resolve({
      tenantId: actor.tenantId,
      institutionId: actor.institutionId,
      customerId: input.customerId,
    }).catch(() => null);

  if (!customer) {
    return Object.freeze({
      kind: 'not_found' as const,
    });
  }

  let assignment: FormalFollowUpAssignmentV1;
  if (input.assignment.kind === 'role_pool') {
    assignment = {
      kind: 'role_pool',
      role: input.assignment.role,
    };
  } else {
    const member = await targetMember(
      actor,
      input.assignment.userId,
    ).catch(() => null);

    if (!member) {
      return Object.freeze({
        kind: 'invalid' as const,
        code: 'invalid_assignee',
      });
    }

    assignment = {
      kind: 'user',
      userId: member.userId,
      displayName: member.displayName,
      claimedFromRolePool: null,
    };
  }

  const digest = requestDigest(input);
  const now = new Date(Date.now()).toISOString();

  try {
    return await database.transaction(
      async (transactionDatabase) => {
        const transactionDb =
          transactionDatabase as unknown as TenantDatabase;
        const store =
          createFormalFollowUpRepositoryV1(
            transactionDb,
          );

        const existing =
          await store.getByIdempotency({
            tenantId: actor.tenantId,
            institutionId: actor.institutionId,
            idempotencyKey: input.idempotencyKey,
          });

        if (existing) {
          return existing.requestDigest === digest
            ? Object.freeze({
                kind: 'ready' as const,
                record: toDto(existing, actor),
                idempotent: true as const,
              })
            : Object.freeze({
                kind: 'conflict' as const,
                code: 'idempotency_conflict',
              });
        }

        const taskId = randomUUID();
        const created =
          await store.createWithEvent(
            {
              tenantId: actor.tenantId,
              institutionId: actor.institutionId,
              taskId,
              customerId: customer.customerId,
              customerDisplayName:
                customer.displayName,
              customerMaskedReference:
                customer.maskedReference,
              stageCode: input.stageCode,
              actionCode: input.actionCode,
              dueAt: input.dueAt,
              assignment,
              idempotencyKey: input.idempotencyKey,
              requestDigest: digest,
              actorId: actor.accountId,
              occurredAt: now,
            },
            {
              eventId: randomUUID(),
              eventType: 'created',
              actorId: actor.accountId,
              actorRole: actor.role,
              fromState: null,
              toState: 'pending',
              reasonCode: 'care_follow_up_created',
              occurredAt: now,
            },
          );

        if (!created) {
          const concurrent =
            await store.getByIdempotency({
              tenantId: actor.tenantId,
              institutionId: actor.institutionId,
              idempotencyKey: input.idempotencyKey,
            });

          if (
            concurrent
            && concurrent.requestDigest === digest
          ) {
            return Object.freeze({
              kind: 'ready' as const,
              record: toDto(concurrent, actor),
              idempotent: true as const,
            });
          }

          return Object.freeze({
            kind: 'conflict' as const,
            code: 'create_conflict',
          });
        }

        await auditChanged(
          transactionDb,
          actor,
          created.taskId,
          'create',
          'care_follow_up_created',
          now,
        );

        return Object.freeze({
          kind: 'ready' as const,
          record: toDto(created, actor),
        });
      },
    );
  } catch {
    return Object.freeze({
      kind: 'unavailable' as const,
    });
  }
}

export async function mutateCurrentInstitutionFormalFollowUpV1(
  taskId: string,
  value: unknown,
): Promise<FormalFollowUpMutationResultV1> {
  if (!stableIdPattern.test(taskId)) {
    return Object.freeze({
      kind: 'not_found' as const,
    });
  }

  const authorization =
    await authorize(false).catch(
      () => AUTH_UNAVAILABLE,
    );
  if (authorization.kind !== 'allowed') {
    return Object.freeze({
      kind: authorization.kind,
    });
  }
  const actor = authorization.actor;

  const command = readMutation(value);
  if (!command) {
    return Object.freeze({
      kind: 'invalid' as const,
      code: 'invalid_follow_up_command',
    });
  }

  const database = getDatabase();

  try {
    return await database.transaction(
      async (transactionDatabase) => {
        const transactionDb =
          transactionDatabase as unknown as TenantDatabase;
        const store =
          createFormalFollowUpRepositoryV1(
            transactionDb,
          );

        const current =
          await store.getVisible({
            tenantId: actor.tenantId,
            institutionId: actor.institutionId,
            actorId: actor.accountId,
            actorRole: actor.role,
            taskId,
          });

        if (!current) {
          return Object.freeze({
            kind: 'not_found' as const,
          });
        }

        if (
          current.revision
          !== command.expectedRevision
        ) {
          return Object.freeze({
            kind: 'conflict' as const,
            code: 'revision_conflict',
          });
        }

        const management =
          isManagement(actor.role);
        const own =
          current.assignment.kind === 'user'
          && current.assignment.userId
            === actor.accountId;

        let next:
          | FormalFollowUpTaskRecordV1
          | null = null;
        let eventType:
          | FormalFollowUpEventTypeV1
          | null = null;
        let auditReason:
          | AuditReason
          | null = null;
        let reasonCode: string | null = null;
        let targetDisplayName:
          | string
          | null = null;

        const assignmentMutable =
          current.state !== 'completed'
          && current.state !== 'cancelled';
        if (
          (
            command.command === 'claim'
            || command.command === 'reassign'
            || command.command === 'unclaim'
          )
          && !assignmentMutable
        ) {
          return Object.freeze({
            kind: 'invalid' as const,
            code: 'terminal_state',
          });
        }

        if (command.command === 'claim') {
          const result =
            claimFollowUpRolePoolAssignment({
              assignment:
                assignmentForDomain(current),
              institutionId: actor.institutionId,
              actorUserId: actor.accountId,
              expectedRevision:
                command.expectedRevision,
              member: {
                institutionId:
                  actor.institutionId,
                userId: actor.accountId,
                role: actor.role,
                active: true,
              },
            });

          if (!result.ok) {
            return Object.freeze({
              kind:
                result.code.includes('conflict')
                  ? 'conflict' as const
                  : 'forbidden' as const,
              code: result.code,
            });
          }

          if (!result.changed) {
            return Object.freeze({
              kind: 'ready' as const,
              record: toDto(current, actor),
              idempotent: true as const,
            });
          }

          next = nextRecord(current, actor, {
            revision:
              result.assignment.revision,
            assignment: assignmentFromDomain(
              current,
              result.assignment,
              actor.displayName,
            ),
          });
          eventType = 'claimed';
          auditReason = 'care_follow_up_claimed';
          reasonCode = 'care_follow_up_claimed';
        } else if (
          command.command === 'reassign'
        ) {
          if (!management) {
            return Object.freeze({
              kind: 'forbidden' as const,
            });
          }

          const target =
            snapshot(
              command.raw.target,
              ['kind', 'role'],
            )
            ?? snapshot(
              command.raw.target,
              ['kind', 'userId'],
            );

          if (!target) {
            return Object.freeze({
              kind: 'invalid' as const,
              code: 'invalid_reassign_target',
            });
          }

          const reason = command.raw.reason;
          let domainTarget: unknown;
          let targetMemberValue: unknown = null;

          if (
            target.kind === 'role_pool'
            && isFollowUpRolePoolRole(
              target.role,
            )
          ) {
            domainTarget = {
              kind: 'role_pool',
              institutionId:
                actor.institutionId,
              role: target.role,
            };
          } else if (
            target.kind === 'user'
            && typeof target.userId === 'string'
            && stableIdPattern.test(
              target.userId,
            )
          ) {
            const member =
              await targetMember(
                actor,
                target.userId,
              );

            if (!member) {
              return Object.freeze({
                kind: 'invalid' as const,
                code: 'invalid_assignee',
              });
            }

            domainTarget = {
              kind: 'user',
              institutionId:
                actor.institutionId,
              assigneeUserId:
                member.userId,
            };
            targetMemberValue = {
              institutionId:
                member.institutionId,
              userId: member.userId,
              role: member.role,
              active: true,
            };
            targetDisplayName =
              member.displayName;
          } else {
            return Object.freeze({
              kind: 'invalid' as const,
              code: 'invalid_reassign_target',
            });
          }

          const result =
            reassignFollowUpAssignment({
              assignment:
                assignmentForDomain(current),
              target:
                domainTarget as never,
              targetMember:
                targetMemberValue,
              expectedRevision:
                command.expectedRevision,
              institutionId:
                actor.institutionId,
              actorRole: actor.role,
              reason,
            });

          if (!result.ok) {
            return Object.freeze({
              kind:
                result.code.includes('conflict')
                  ? 'conflict' as const
                  : 'invalid' as const,
              code: result.code,
            });
          }

          if (!result.changed) {
            return Object.freeze({
              kind: 'ready' as const,
              record: toDto(current, actor),
              idempotent: true as const,
            });
          }

          next = nextRecord(current, actor, {
            revision:
              result.assignment.revision,
            assignment: assignmentFromDomain(
              current,
              result.assignment,
              targetDisplayName,
            ),
          });
          eventType = 'reassigned';
          auditReason =
            'care_follow_up_reassigned';
          reasonCode =
            typeof reason === 'string'
              ? reason
              : 'assignment_correction';
        } else if (
          command.command === 'unclaim'
        ) {
          if (!management) {
            return Object.freeze({
              kind: 'forbidden' as const,
            });
          }

          const reason = command.raw.reason;
          const result =
            unclaimFollowUpAssignment({
              assignment:
                assignmentForDomain(current),
              expectedRevision:
                command.expectedRevision,
              institutionId:
                actor.institutionId,
              actorRole: actor.role,
              reason,
            });

          if (!result.ok) {
            return Object.freeze({
              kind: 'invalid' as const,
              code: result.code,
            });
          }

          if (!result.changed) {
            return Object.freeze({
              kind: 'ready' as const,
              record: toDto(current, actor),
              idempotent: true as const,
            });
          }

          next = nextRecord(current, actor, {
            revision:
              result.assignment.revision,
            assignment: assignmentFromDomain(
              current,
              result.assignment,
              null,
            ),
          });
          eventType = 'unclaimed';
          auditReason =
            'care_follow_up_unclaimed';
          reasonCode =
            typeof reason === 'string'
              ? reason
              : 'assignment_correction';
        } else {
          if (
            command.command !== 'cancel'
            && !own
          ) {
            return Object.freeze({
              kind: 'forbidden' as const,
            });
          }

          const task =
            taskForDomain(current);

          if (
            command.command === 'transition'
          ) {
            const result =
              transitionFollowUpTask({
                task,
                institutionId:
                  actor.institutionId,
                expectedRevision:
                  command.expectedRevision,
                targetState:
                  command.raw.targetState,
              });

            if (!result.ok) {
              return Object.freeze({
                kind:
                  result.code.includes('conflict')
                    ? 'conflict' as const
                    : 'invalid' as const,
                code: result.code,
              });
            }

            if (!result.changed) {
              return Object.freeze({
                kind: 'ready' as const,
                record: toDto(
                  current,
                  actor,
                ),
                idempotent: true as const,
              });
            }

            next = taskPatchFromDomain(
              current,
              result.task,
              actor,
            );
            eventType = 'state_changed';
            auditReason =
              'care_follow_up_state_changed';
            reasonCode =
              'care_follow_up_state_changed';
          } else if (
            command.command === 'escalate'
          ) {
            const result =
              escalateFollowUpTask({
                task,
                institutionId:
                  actor.institutionId,
                expectedRevision:
                  command.expectedRevision,
                escalation: {
                  level: 'high',
                  kind: command.raw.kind,
                  riskEventId:
                    `care-risk-${randomUUID()}`,
                },
              });

            if (!result.ok) {
              return Object.freeze({
                kind: 'invalid' as const,
                code: result.code,
              });
            }

            if (!result.changed) {
              return Object.freeze({
                kind: 'ready' as const,
                record: toDto(
                  current,
                  actor,
                ),
                idempotent: true as const,
              });
            }

            next = taskPatchFromDomain(
              current,
              result.task,
              actor,
            );
            eventType = 'risk_escalated';
            auditReason =
              'care_follow_up_risk_escalated';
            reasonCode =
              'care_follow_up_risk_escalated';
          } else if (
            command.command === 'complete'
          ) {
            if (
              command.raw.code
              === 'his_appointment_linked'
            ) {
              return Object.freeze({
                kind: 'invalid' as const,
                code:
                  'his_completion_not_released',
              });
            }

            const result =
              completeFollowUpTask({
                task,
                institutionId:
                  actor.institutionId,
                expectedRevision:
                  command.expectedRevision,
                result: {
                  code: command.raw.code,
                  feedback:
                    command.raw.feedback,
                },
              });

            if (!result.ok) {
              return Object.freeze({
                kind: 'invalid' as const,
                code: result.code,
              });
            }

            if (!result.changed) {
              return Object.freeze({
                kind: 'ready' as const,
                record: toDto(
                  current,
                  actor,
                ),
                idempotent: true as const,
              });
            }

            next = taskPatchFromDomain(
              current,
              result.task,
              actor,
            );
            eventType = 'completed';
            auditReason =
              'care_follow_up_completed';
            reasonCode =
              'care_follow_up_completed';
          } else if (
            command.command === 'cancel'
          ) {
            if (!management) {
              return Object.freeze({
                kind: 'forbidden' as const,
              });
            }

            const result =
              cancelFollowUpTask({
                task,
                institutionId:
                  actor.institutionId,
                expectedRevision:
                  command.expectedRevision,
                reason: command.raw.reason,
              });

            if (!result.ok) {
              return Object.freeze({
                kind: 'invalid' as const,
                code: result.code,
              });
            }

            if (!result.changed) {
              return Object.freeze({
                kind: 'ready' as const,
                record: toDto(
                  current,
                  actor,
                ),
                idempotent: true as const,
              });
            }

            next = taskPatchFromDomain(
              current,
              result.task,
              actor,
            );
            eventType = 'cancelled';
            auditReason =
              'care_follow_up_cancelled';
            reasonCode =
              'care_follow_up_cancelled';
          } else {
            return Object.freeze({
              kind: 'invalid' as const,
              code:
                'unknown_follow_up_command',
            });
          }
        }

        if (
          !next
          || !eventType
          || !auditReason
          || !reasonCode
        ) {
          return Object.freeze({
            kind: 'unavailable' as const,
          });
        }

        const occurredAt = next.updatedAt;
        const updated =
          await store.updateWithEvent({
            tenantId: actor.tenantId,
            institutionId:
              actor.institutionId,
            taskId,
            expectedRevision:
              current.revision,
            next: {
              stageCode: next.stageCode,
              actionCode: next.actionCode,
              dueAt: next.dueAt,
              state: next.state,
              revision: next.revision,
              riskLevel: next.riskLevel,
              riskKind: next.riskKind,
              riskEventId:
                next.riskEventId,
              completionCode:
                next.completionCode,
              completionFeedback:
                next.completionFeedback,
              cancellationReason:
                next.cancellationReason,
              assignment: next.assignment,
              updatedBy: next.updatedBy,
              updatedAt: next.updatedAt,
            },
            event: {
              eventId: randomUUID(),
              eventType,
              actorId: actor.accountId,
              actorRole: actor.role,
              fromState: current.state,
              toState: next.state,
              reasonCode,
              occurredAt,
            },
          });

        if (!updated) {
          const reread =
            await store.getScopedCurrent({
              tenantId: actor.tenantId,
              institutionId:
                actor.institutionId,
              taskId,
            });

          if (
            command.command === 'claim'
            && reread
            && reread.assignment.kind
              === 'user'
            && reread.assignment.userId
              !== actor.accountId
          ) {
            return Object.freeze({
              kind: 'conflict' as const,
              code: 'claim_conflict',
            });
          }

          return Object.freeze({
            kind: 'conflict' as const,
            code: 'revision_conflict',
          });
        }

        await auditChanged(
          transactionDb,
          actor,
          taskId,
          'update',
          auditReason,
          occurredAt,
        );

        return Object.freeze({
          kind: 'ready' as const,
          record: toDto(updated, actor),
        });
      },
    );
  } catch {
    return Object.freeze({
      kind: 'unavailable' as const,
    });
  }
}
