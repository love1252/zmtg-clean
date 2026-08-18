
import { randomUUID } from 'node:crypto';

import {
  createVerifiedInstitutionAttributedTenantAuditEventV1,
  type AuditReason,
} from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { createAccessControlAuthoritativeMembershipFactReaderV1 } from '@/modules/access-control/application/authoritative-membership-reader';
import {
  appointmentCommandStatuses,
  createAppointmentCommandService,
  type AppointmentCommandRecord,
  type AppointmentCommandStatus,
} from '@/modules/care/application/appointment-command-service';
import type { AppointmentControlledDtoV1 } from '@/modules/care/application/appointment-controlled-view';
import {
  canAppointmentControlledCancelV1,
  canAppointmentControlledRescheduleV1,
  canAppointmentControlledTransitionV1,
} from '@/modules/care/domain/appointment-controlled-write';
import {
  createAppointmentCommandRepository,
  readScopedAppointmentCommandRecordV1,
} from '@/modules/care/server/appointment-command-repository';
import type { CapabilityStatusV1 } from '@/modules/institution-contracts/v1/institution-capability';
import { getDatabase, type TenantDatabase } from '@/server/db/client';
import { resolveInstitutionAuditWriterVerifiedAttributionV1 } from '@/server/orchestration/institution-audit-writer-scope';
import {
  consumeInstitutionCareWriteAuthorizationV1,
  resolveInstitutionCareWriteAuthorizationV1,
  type InstitutionCareWriteAuthorizationConsumptionV1,
} from '@/server/orchestration/institution-care-write-authorization';
import { resolveInstitutionCapabilityAuthorityStatusV1 } from '@/server/orchestration/institution-capability-authority';

const stableIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;
const canonicalInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export type AppointmentControlledReadResultV1 =
  | Readonly<{
      kind: 'ready';
      record: AppointmentControlledDtoV1;
    }>
  | Readonly<{
      kind: 'forbidden' | 'not_found' | 'unavailable';
    }>;

export type AppointmentControlledMutationResultV1 =
  | Readonly<{
      kind: 'ready';
      record: AppointmentControlledDtoV1;
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

type Authorization =
  | Readonly<{
      kind: 'allowed';
      actor: InstitutionCareWriteAuthorizationConsumptionV1;
    }>
  | Readonly<{ kind: 'forbidden' }>
  | Readonly<{ kind: 'unavailable' }>;

const AUTH_FORBIDDEN = Object.freeze({ kind: 'forbidden' as const });
const AUTH_UNAVAILABLE = Object.freeze({ kind: 'unavailable' as const });

function isManagement(
  role: InstitutionCareWriteAuthorizationConsumptionV1['role'],
): boolean {
  return role === 'tenant_admin' || role === 'tenant_operator';
}

function releasedCapability(
  status: CapabilityStatusV1 | null,
  key: 'page_care_appointments' | 'action_care_appointment_create',
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
    && capabilities[0].dimensions.institutionAuthorization === 'authorized'
    && capabilities[0].dimensions.connectionAvailability === 'not_required'
    && capabilities[0].dimensions.dataReadiness === 'ready'
    && capabilities[0].dimensions.productionRelease === 'pilot_released'
    && (
      key === 'page_care_appointments'
        ? capabilities[0].safeSummary === '预约管理可用'
        : capabilities[0].safeSummary === null
    )
    && partitions[0]?.readiness === 'ready'
    && partitions[0].failureCode === null
  );
}

async function authorize(
  requireCreate: boolean,
): Promise<Authorization> {
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
    || !releasedCapability(status, 'page_care_appointments')
  ) {
    return AUTH_UNAVAILABLE;
  }

  if (
    requireCreate
    && !releasedCapability(
      status,
      'action_care_appointment_create',
    )
  ) {
    return AUTH_UNAVAILABLE;
  }

  return Object.freeze({
    kind: 'allowed' as const,
    actor,
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

    const descriptors = Object.getOwnPropertyDescriptors(value);
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

function readStatus(value: unknown): AppointmentCommandStatus | null {
  return (
    typeof value === 'string'
    && appointmentCommandStatuses.includes(
      value as AppointmentCommandStatus,
    )
  )
    ? value as AppointmentCommandStatus
    : null;
}

function parseCreate(value: unknown) {
  const input = snapshot(value, [
    'customerId',
    'project',
    'scheduledAt',
    'consultantUserId',
    'note',
  ]);
  if (
    !input
    || typeof input.customerId !== 'string'
    || !stableIdPattern.test(input.customerId)
    || typeof input.consultantUserId !== 'string'
    || !stableIdPattern.test(input.consultantUserId)
    || typeof input.project !== 'string'
    || input.project.length < 1
    || input.project.length > 120
    || input.project.trim() !== input.project
    || typeof input.note !== 'string'
    || input.note.length > 240
  ) {
    return null;
  }

  const scheduledAt = readInstant(input.scheduledAt);
  if (!scheduledAt) return null;

  return Object.freeze({
    customerId: input.customerId,
    project: input.project,
    scheduledAt,
    consultantUserId: input.consultantUserId,
    note: input.note,
  });
}

function parseMutation(value: unknown) {
  if (
    value === null
    || typeof value !== 'object'
    || Array.isArray(value)
  ) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const command = raw.command;
  const keys =
    command === 'transition'
      ? ['command', 'expectedUpdatedAt', 'targetStatus']
      : command === 'reschedule'
        ? ['command', 'expectedUpdatedAt', 'scheduledAt']
        : command === 'cancel'
          ? ['command', 'expectedUpdatedAt']
          : null;

  if (!keys) return null;
  const input = snapshot(value, keys);
  if (!input) return null;

  const expectedUpdatedAt =
    readInstant(input.expectedUpdatedAt);
  if (!expectedUpdatedAt) return null;

  if (command === 'transition') {
    const targetStatus = readStatus(input.targetStatus);
    if (!targetStatus) return null;
    return Object.freeze({
      command: 'transition' as const,
      expectedUpdatedAt,
      targetStatus,
    });
  }

  if (command === 'reschedule') {
    const scheduledAt = readInstant(input.scheduledAt);
    if (!scheduledAt) return null;
    return Object.freeze({
      command: 'reschedule' as const,
      expectedUpdatedAt,
      scheduledAt,
    });
  }

  return Object.freeze({
    command: 'cancel' as const,
    expectedUpdatedAt,
  });
}

function permissions(
  record: AppointmentCommandRecord,
  actor: InstitutionCareWriteAuthorizationConsumptionV1,
): AppointmentControlledDtoV1['permissions'] {
  const own = record.consultantUserId === actor.accountId;
  const canOperate =
    (isManagement(actor.role) || own)
    && record.status !== 'completed'
    && record.status !== 'cancelled';

  return Object.freeze({
    canOperate,
    canReschedule:
      canOperate
      && canAppointmentControlledRescheduleV1(
        record.status,
      ),
    canCancel:
      canOperate
      && canAppointmentControlledCancelV1(
        record.status,
      ),
  });
}

function toDto(
  record: AppointmentCommandRecord,
  actor: InstitutionCareWriteAuthorizationConsumptionV1,
): AppointmentControlledDtoV1 {
  return Object.freeze({
    contractVersion: 'v1' as const,
    appointmentId: record.id,
    scheduledAt: record.scheduledAt,
    status: record.status,
    updatedAt: record.updatedAt,
    permissions: permissions(record, actor),
  });
}

async function targetConsultant(
  actor: InstitutionCareWriteAuthorizationConsumptionV1,
  accountId: string,
) {
  const resolution =
    await createAccessControlAuthoritativeMembershipFactReaderV1()
      .resolve({
        accountId,
        tenantId: actor.tenantId,
        institutionId: actor.institutionId,
      });

  if (
    resolution.kind !== 'current_membership_fact'
    || resolution.role !== 'consultant'
  ) {
    return null;
  }

  return Object.freeze({
    accountId: resolution.accountId,
    displayName: resolution.membershipDisplayName,
  });
}

async function auditChanged(
  database: TenantDatabase,
  actor: InstitutionCareWriteAuthorizationConsumptionV1,
  appointmentId: string,
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
      'care_appointment_audit_attribution_unavailable',
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
        resource: 'appointment',
        resourceId: appointmentId,
        action,
        result: 'transitioned',
        reason,
        occurredAt,
        source: 'server_session',
      },
      attribution,
    });
  if (!event) {
    throw new Error(
      'care_appointment_audit_event_invalid',
    );
  }

  await createAuditEventRepository(
    database,
  ).recordAttributed(event);
}

export async function readCurrentInstitutionAppointmentControlledV1(
  appointmentId: string,
): Promise<AppointmentControlledReadResultV1> {
  if (!stableIdPattern.test(appointmentId)) {
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
      await readScopedAppointmentCommandRecordV1(
        getDatabase(),
        {
          tenantId: actor.tenantId,
          institutionId: actor.institutionId,
          appointmentId,
        },
      );

    return record
      ? Object.freeze({
          kind: 'ready' as const,
          record: toDto(record, actor),
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

export async function createCurrentInstitutionAppointmentControlledV1(
  value: unknown,
): Promise<AppointmentControlledMutationResultV1> {
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
      code: 'invalid_appointment_create',
    });
  }

  const consultant =
    await targetConsultant(
      actor,
      input.consultantUserId,
    ).catch(() => null);
  if (!consultant) {
    return Object.freeze({
      kind: 'invalid' as const,
      code: 'invalid_consultant',
    });
  }

  const database = getDatabase();
  const now = new Date(Date.now()).toISOString();

  try {
    return await database.transaction(
      async (transactionDatabase) => {
        const transactionDb =
          transactionDatabase as unknown as TenantDatabase;
        const service =
          createAppointmentCommandService(
            createAppointmentCommandRepository(
              transactionDb,
            ),
          );

        const created =
          await service.createAppointment({
            attribution: {
              tenantId: actor.tenantId,
              institutionId: actor.institutionId,
            },
            appointment: {
              id: randomUUID(),
              customerId: input.customerId,
              project: input.project,
              scheduledAt: new Date(
                input.scheduledAt,
              ),
              consultantUserId:
                consultant.accountId,
              status: 'pending_confirmation',
              note: input.note,
            },
          });

        if (created.kind === 'invalid_reference') {
          return Object.freeze({
            kind: 'not_found' as const,
          });
        }
        if (created.kind !== 'created') {
          return Object.freeze({
            kind: 'conflict' as const,
            code: created.reason,
          });
        }

        await auditChanged(
          transactionDb,
          actor,
          created.record.id,
          'create',
          'care_appointment_created',
          now,
        );

        return Object.freeze({
          kind: 'ready' as const,
          record: toDto(created.record, actor),
        });
      },
    );
  } catch {
    return Object.freeze({
      kind: 'unavailable' as const,
    });
  }
}

export async function mutateCurrentInstitutionAppointmentControlledV1(
  appointmentId: string,
  value: unknown,
): Promise<AppointmentControlledMutationResultV1> {
  if (!stableIdPattern.test(appointmentId)) {
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

  const command = parseMutation(value);
  if (!command) {
    return Object.freeze({
      kind: 'invalid' as const,
      code: 'invalid_appointment_command',
    });
  }

  const database = getDatabase();

  try {
    return await database.transaction(
      async (transactionDatabase) => {
        const transactionDb =
          transactionDatabase as unknown as TenantDatabase;
        const current =
          await readScopedAppointmentCommandRecordV1(
            transactionDb,
            {
              tenantId: actor.tenantId,
              institutionId: actor.institutionId,
              appointmentId,
            },
          );

        if (!current) {
          return Object.freeze({
            kind: 'not_found' as const,
          });
        }

        if (
          current.updatedAt
          !== command.expectedUpdatedAt
        ) {
          return Object.freeze({
            kind: 'conflict' as const,
            code: 'stale_update',
          });
        }

        const own =
          current.consultantUserId
          === actor.accountId;
        if (!isManagement(actor.role) && !own) {
          return Object.freeze({
            kind: 'forbidden' as const,
          });
        }

        let nextStatus: AppointmentCommandStatus;
        let nextScheduledAt: Date | undefined;
        let reason: AuditReason;

        if (command.command === 'transition') {
          if (
            command.targetStatus === 'cancelled'
            || !canAppointmentControlledTransitionV1(
              current.status,
              command.targetStatus,
            )
          ) {
            return Object.freeze({
              kind: 'invalid' as const,
              code: 'invalid_appointment_transition',
            });
          }

          nextStatus = command.targetStatus;
          reason = 'care_appointment_state_changed';
        } else if (
          command.command === 'reschedule'
        ) {
          if (
            !canAppointmentControlledRescheduleV1(
              current.status,
            )
          ) {
            return Object.freeze({
              kind: 'invalid' as const,
              code: 'invalid_appointment_reschedule',
            });
          }

          nextStatus = 'confirmed';
          nextScheduledAt =
            new Date(command.scheduledAt);
          reason = 'care_appointment_rescheduled';
        } else {
          if (
            !canAppointmentControlledCancelV1(
              current.status,
            )
          ) {
            return Object.freeze({
              kind: 'invalid' as const,
              code: 'invalid_appointment_cancel',
            });
          }

          nextStatus = 'cancelled';
          reason = 'care_appointment_cancelled';
        }

        const service =
          createAppointmentCommandService(
            createAppointmentCommandRepository(
              transactionDb,
            ),
          );
        const updated =
          await service.updateAppointment({
            attribution: {
              tenantId: actor.tenantId,
              institutionId: actor.institutionId,
            },
            appointmentId,
            expectedUpdatedAt:
              command.expectedUpdatedAt,
            scheduledAt: nextScheduledAt,
            status: nextStatus,
            note: current.note,
          });

        if (updated.kind === 'not_found_or_not_owned') {
          return Object.freeze({
            kind: 'not_found' as const,
          });
        }
        if (updated.kind !== 'updated') {
          return Object.freeze({
            kind: 'conflict' as const,
            code: updated.reason,
          });
        }

        await auditChanged(
          transactionDb,
          actor,
          appointmentId,
          'update',
          reason,
          updated.record.updatedAt,
        );

        return Object.freeze({
          kind: 'ready' as const,
          record: toDto(updated.record, actor),
        });
      },
    );
  } catch {
    return Object.freeze({
      kind: 'unavailable' as const,
    });
  }
}
