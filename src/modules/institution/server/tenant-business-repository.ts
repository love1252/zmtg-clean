import { and, eq } from 'drizzle-orm';
import type {
  AppointmentRecordSummary,
  AppointmentStatus,
} from '@/modules/institution/domain/appointment-records';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';
import {
  transitionFollowUpTask as transitionFollowUpTaskDomain,
  type FollowUpStatus,
  type TenantFollowUpTask,
} from '@/modules/institution/domain/followup-workflow';
import type { TenantDatabase } from '@/server/db/client';
import { appointments, customers, followUpTasks } from '@/server/db/schema';

type CustomerRow = typeof customers.$inferSelect;
type AppointmentRow = typeof appointments.$inferSelect;
type FollowUpTaskRow = typeof followUpTasks.$inferSelect;
type CreateCustomerInput = typeof customers.$inferInsert;
type MutableCustomerUpdateValues = Pick<
  typeof customers.$inferInsert,
  | 'displayName'
  | 'lifecycle'
  | 'priority'
  | 'ownerUserId'
  | 'projectInterest'
  | 'maskedPhone'
  | 'maskedMedicalRecordNo'
  | 'lastTouchSummary'
  | 'nextAction'
  | 'tags'
>;
type UpdateCustomerInput = Partial<MutableCustomerUpdateValues> & {
  tenantId: string;
  id: string;
};
type CreateAppointmentInput = typeof appointments.$inferInsert;
type CustomerLookupInput = {
  tenantId: string;
  id: string;
};
type UpdateAppointmentInput = {
  tenantId: string;
  id: string;
  status: AppointmentStatus;
  note: string;
};
type TransitionFollowUpTaskInput = {
  tenantId: string;
  id: string;
  nextStatus: FollowUpStatus;
  actorId: string;
  occurredAt: string;
};
type TransitionFollowUpTaskPersistenceResult =
  | { kind: 'updated'; task: TenantFollowUpTask }
  | { kind: 'not_found' }
  | { kind: 'conflict'; reason: 'stale_transition' }
  | { kind: 'invalid_transition'; from: FollowUpStatus; to: FollowUpStatus };

function omitUndefinedValues<T extends Record<string, unknown>>(values: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

function pickCustomerUpdateValues(input: UpdateCustomerInput): Partial<MutableCustomerUpdateValues> {
  return omitUndefinedValues({
    displayName: input.displayName,
    lifecycle: input.lifecycle,
    priority: input.priority,
    ownerUserId: input.ownerUserId,
    projectInterest: input.projectInterest,
    maskedPhone: input.maskedPhone,
    maskedMedicalRecordNo: input.maskedMedicalRecordNo,
    lastTouchSummary: input.lastTouchSummary,
    nextAction: input.nextAction,
    tags: input.tags,
  });
}

export function mapCustomerRowToRecord(row: CustomerRow): CustomerRecordSummary {
  return {
    id: row.id,
    tenantId: row.tenantId,
    displayName: row.displayName,
    lifecycle: row.lifecycle,
    priority: row.priority,
    ownerUserId: row.ownerUserId,
    projectInterest: row.projectInterest,
    maskedPhone: row.maskedPhone,
    maskedMedicalRecordNo: row.maskedMedicalRecordNo,
    lastTouchSummary: row.lastTouchSummary,
    nextAction: row.nextAction,
    tags: row.tags,
  };
}

export function mapAppointmentRowToRecord(row: AppointmentRow): AppointmentRecordSummary {
  return {
    id: row.id,
    tenantId: row.tenantId,
    customerId: row.customerId,
    customerDisplayName: row.customerDisplayName,
    project: row.project,
    scheduledAt: row.scheduledAt.toISOString(),
    consultantUserId: row.consultantUserId,
    status: row.status,
    note: row.note,
  };
}

export function mapFollowUpTaskRowToRecord(row: FollowUpTaskRow): TenantFollowUpTask {
  return {
    id: row.id,
    tenantId: row.tenantId,
    customerId: row.customerId,
    customerDisplayName: row.customerDisplayName,
    journeyId: row.journeyId,
    stage: row.stage,
    status: row.status,
    dueAt: row.dueAt.toISOString(),
    suggestedAction: row.suggestedAction,
    riskLevel: row.riskLevel,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export function createTenantBusinessRepository(database: TenantDatabase) {
  return {
    async createCustomer(input: CreateCustomerInput): Promise<CustomerRecordSummary> {
      const [row] = await database.insert(customers).values(input).returning();
      return mapCustomerRowToRecord(row);
    },
    async updateCustomer(input: UpdateCustomerInput): Promise<CustomerRecordSummary | null> {
      const [row] = await database
        .update(customers)
        .set({
          ...pickCustomerUpdateValues(input),
          updatedAt: new Date(),
        })
        .where(and(eq(customers.tenantId, input.tenantId), eq(customers.id, input.id)))
        .returning();

      return row ? mapCustomerRowToRecord(row) : null;
    },
    async createAppointment(input: CreateAppointmentInput): Promise<AppointmentRecordSummary> {
      const [row] = await database.insert(appointments).values(input).returning();
      return mapAppointmentRowToRecord(row);
    },
    async customerExistsByTenant(input: CustomerLookupInput): Promise<boolean> {
      const [row] = await database
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, input.tenantId), eq(customers.id, input.id)));

      return Boolean(row);
    },
    async updateAppointment(
      input: UpdateAppointmentInput,
    ): Promise<AppointmentRecordSummary | null> {
      const [row] = await database
        .update(appointments)
        .set({
          status: input.status,
          note: input.note,
          updatedAt: new Date(),
        })
        .where(and(eq(appointments.tenantId, input.tenantId), eq(appointments.id, input.id)))
        .returning();

      return row ? mapAppointmentRowToRecord(row) : null;
    },
    async transitionFollowUpTask(
      input: TransitionFollowUpTaskInput,
    ): Promise<TransitionFollowUpTaskPersistenceResult> {
      const [currentRow] = await database
        .select()
        .from(followUpTasks)
        .where(and(eq(followUpTasks.tenantId, input.tenantId), eq(followUpTasks.id, input.id)));

      if (!currentRow) {
        return { kind: 'not_found' };
      }

      const transition = transitionFollowUpTaskDomain({
        task: mapFollowUpTaskRowToRecord(currentRow),
        nextStatus: input.nextStatus,
        actorId: input.actorId,
        occurredAt: input.occurredAt,
      });

      if (!transition.allowed) {
        return {
          kind: 'invalid_transition',
          from: transition.from,
          to: transition.to,
        };
      }

      const [updatedRow] = await database
        .update(followUpTasks)
        .set({
          status: transition.task.status,
          updatedBy: transition.task.updatedBy,
          updatedAt: transition.task.updatedAt ? new Date(transition.task.updatedAt) : null,
        })
        .where(
          and(
            eq(followUpTasks.tenantId, input.tenantId),
            eq(followUpTasks.id, input.id),
            eq(followUpTasks.status, currentRow.status),
          ),
        )
        .returning();

      return updatedRow
        ? { kind: 'updated', task: mapFollowUpTaskRowToRecord(updatedRow) }
        : { kind: 'conflict', reason: 'stale_transition' };
    },
    async listCustomersByTenant(tenantId: string) {
      const rows = await database.select().from(customers).where(eq(customers.tenantId, tenantId));
      return rows.map(mapCustomerRowToRecord);
    },
    async listAppointmentsByTenant(tenantId: string) {
      const rows = await database
        .select()
        .from(appointments)
        .where(eq(appointments.tenantId, tenantId));
      return rows.map(mapAppointmentRowToRecord);
    },
    async listFollowUpTasksByTenant(tenantId: string) {
      const rows = await database
        .select()
        .from(followUpTasks)
        .where(eq(followUpTasks.tenantId, tenantId));
      return rows.map(mapFollowUpTaskRowToRecord);
    },
  };
}

export type TenantBusinessRepository = ReturnType<typeof createTenantBusinessRepository>;
