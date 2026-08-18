import { and, eq } from 'drizzle-orm';

import type {
  AppointmentCommandAttribution,
  AppointmentCommandRecord,
  AppointmentCommandRepository,
  CreateAppointmentCommandResult,
  UpdateAppointmentCommandResult,
} from '@/modules/care/application/appointment-command-service';
import type { TenantDatabase } from '@/server/db/client';
import { appointments, customers } from '@/server/db/schema';

type AppointmentRow = typeof appointments.$inferSelect;

function mapScopedRow(
  row: AppointmentRow,
  expectedInstitutionId: string,
): AppointmentCommandRecord | null {
  if (row.institutionId !== expectedInstitutionId) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    institutionId: row.institutionId,
    customerId: row.customerId,
    customerDisplayName: row.customerDisplayName,
    project: row.project,
    scheduledAt: row.scheduledAt.toISOString(),
    consultantUserId: row.consultantUserId,
    status: row.status,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function findOwnedCustomer(
  database: TenantDatabase,
  input: AppointmentCommandAttribution & Readonly<{ customerId: string }>,
): Promise<{ id: string; displayName: string } | null> {
  const [row] = await database
    .select({ id: customers.id, displayName: customers.displayName })
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, input.tenantId),
        eq(customers.institutionId, input.institutionId),
        eq(customers.id, input.customerId),
      ),
    );
  return row ?? null;
}

async function findScopedAppointment(
  database: TenantDatabase,
  input: AppointmentCommandAttribution & Readonly<{ appointmentId: string }>,
): Promise<AppointmentRow | null> {
  const [row] = await database
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, input.tenantId),
        eq(appointments.institutionId, input.institutionId),
        eq(appointments.id, input.appointmentId),
      ),
    );
  return row ?? null;
}

export async function readScopedAppointmentCommandRecordV1(
  database: TenantDatabase,
  input: AppointmentCommandAttribution & Readonly<{ appointmentId: string }>,
): Promise<AppointmentCommandRecord | null> {
  const row = await findScopedAppointment(database, input);
  return row ? mapScopedRow(row, input.institutionId) : null;
}

export function createAppointmentCommandRepository(
  database: TenantDatabase,
): AppointmentCommandRepository {
  return Object.freeze({
    async create(
      input: Parameters<AppointmentCommandRepository['create']>[0],
    ): Promise<CreateAppointmentCommandResult> {
      const customer = await findOwnedCustomer(database, input);
      if (!customer) {
        return { kind: 'invalid_reference', reason: 'customer_not_found_or_not_owned' };
      }

      const [row] = await database
        .insert(appointments)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          customerId: customer.id,
          customerDisplayName: customer.displayName,
          project: input.project,
          scheduledAt: input.scheduledAt,
          consultantUserId: input.consultantUserId,
          status: input.status,
          note: input.note,
        })
        .returning();

      if (!row) {
        return { kind: 'conflict', resourceId: input.id, reason: 'appointment_conflict' };
      }

      const record = mapScopedRow(row, input.institutionId);
      return record
        ? { kind: 'created', record }
        : { kind: 'conflict', resourceId: input.id, reason: 'appointment_conflict' };
    },

    async update(
      input: Parameters<AppointmentCommandRepository['update']>[0],
    ): Promise<UpdateAppointmentCommandResult> {
      const current = await findScopedAppointment(database, input);
      if (!current) return { kind: 'not_found_or_not_owned' };

      const customer = await findOwnedCustomer(database, {
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        customerId: current.customerId,
      });
      if (!customer) return { kind: 'not_found_or_not_owned' };

      if (current.updatedAt.toISOString() !== input.expectedUpdatedAt) {
        return { kind: 'conflict', resourceId: input.appointmentId, reason: 'stale_update' };
      }

      const [row] = await database
        .update(appointments)
        .set({
          scheduledAt: input.scheduledAt ?? current.scheduledAt,
          status: input.status,
          note: input.note,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(appointments.tenantId, input.tenantId),
            eq(appointments.institutionId, input.institutionId),
            eq(appointments.customerId, current.customerId),
            eq(appointments.id, input.appointmentId),
            eq(appointments.updatedAt, new Date(input.expectedUpdatedAt)),
          ),
        )
        .returning();

      if (!row) {
        return { kind: 'conflict', resourceId: input.appointmentId, reason: 'stale_update' };
      }

      const record = mapScopedRow(row, input.institutionId);
      return record ? { kind: 'updated', record } : { kind: 'not_found_or_not_owned' };
    },
  });
}
