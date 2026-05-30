import { eq } from 'drizzle-orm';
import type { AppointmentRecordSummary } from '@/modules/institution/domain/appointment-records';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';
import type { TenantFollowUpTask } from '@/modules/institution/domain/followup-workflow';
import type { TenantDatabase } from '@/server/db/client';
import { appointments, customers, followUpTasks } from '@/server/db/schema';

type CustomerRow = typeof customers.$inferSelect;
type AppointmentRow = typeof appointments.$inferSelect;
type FollowUpTaskRow = typeof followUpTasks.$inferSelect;

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
