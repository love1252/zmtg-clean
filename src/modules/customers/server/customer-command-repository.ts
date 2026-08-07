import { and, eq } from 'drizzle-orm';

import type { TenantDatabase } from '@/server/db/client';
import { customers } from '@/server/db/schema';
import type {
  CustomerCommandRecord,
  CustomerCommandRepository,
  CustomerMutableFields,
  CustomerRepositoryCreateInput,
  CustomerRepositoryUpdateInput,
} from '@/modules/customers/application/customer-command-service';

type CustomerRow = typeof customers.$inferSelect;

function mapCustomerRow(row: CustomerRow): CustomerCommandRecord {
  if (!row.institutionId) {
    throw new Error('customer_institution_attribution_missing');
  }

  return {
    id: row.id,
    tenantId: row.tenantId,
    institutionId: row.institutionId,
    displayName: row.displayName,
    lifecycle: row.lifecycle,
    priority: row.priority,
    ownerUserId: row.ownerUserId,
    projectInterest: row.projectInterest,
    maskedPhone: row.maskedPhone,
    maskedMedicalRecordNo: row.maskedMedicalRecordNo,
    lastTouchSummary: row.lastTouchSummary,
    nextAction: row.nextAction,
    tags: Array.isArray(row.tags) ? [...row.tags] : [],
    gender: row.gender ?? '',
    birthDate: row.birthDate ?? '',
    referralSource: row.referralSource ?? '',
    notes: row.notes ?? '',
  };
}

function pickUpdateChanges(
  changes: Partial<CustomerMutableFields>,
): Partial<CustomerMutableFields> {
  const result: Partial<CustomerMutableFields> = {};

  if (changes.displayName !== undefined) result.displayName = changes.displayName;
  if (changes.lifecycle !== undefined) result.lifecycle = changes.lifecycle;
  if (changes.priority !== undefined) result.priority = changes.priority;
  if (changes.ownerUserId !== undefined) result.ownerUserId = changes.ownerUserId;
  if (changes.projectInterest !== undefined) result.projectInterest = changes.projectInterest;
  if (changes.maskedPhone !== undefined) result.maskedPhone = changes.maskedPhone;
  if (changes.maskedMedicalRecordNo !== undefined) {
    result.maskedMedicalRecordNo = changes.maskedMedicalRecordNo;
  }
  if (changes.lastTouchSummary !== undefined) result.lastTouchSummary = changes.lastTouchSummary;
  if (changes.nextAction !== undefined) result.nextAction = changes.nextAction;
  if (changes.tags !== undefined) result.tags = [...changes.tags];
  if (changes.gender !== undefined) result.gender = changes.gender;
  if (changes.birthDate !== undefined) result.birthDate = changes.birthDate;
  if (changes.referralSource !== undefined) result.referralSource = changes.referralSource;
  if (changes.notes !== undefined) result.notes = changes.notes;

  return result;
}

export function createCustomerCommandRepository(
  database: TenantDatabase,
): CustomerCommandRepository {
  return Object.freeze({
    async create(input: CustomerRepositoryCreateInput): Promise<CustomerCommandRecord> {
      const [row] = await database
        .insert(customers)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          displayName: input.displayName,
          lifecycle: input.lifecycle,
          priority: input.priority,
          ownerUserId: input.ownerUserId,
          projectInterest: input.projectInterest,
          maskedPhone: input.maskedPhone,
          maskedMedicalRecordNo: input.maskedMedicalRecordNo,
          lastTouchSummary: input.lastTouchSummary,
          nextAction: input.nextAction,
          tags: [...input.tags],
          gender: input.gender,
          birthDate: input.birthDate,
          referralSource: input.referralSource,
          notes: input.notes,
        })
        .returning();

      if (!row) {
        throw new Error('customer_create_returning_missing');
      }

      return mapCustomerRow(row);
    },

    async update(input: CustomerRepositoryUpdateInput): Promise<CustomerCommandRecord | null> {
      const [row] = await database
        .update(customers)
        .set({
          ...pickUpdateChanges(input.changes),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(customers.tenantId, input.tenantId),
            eq(customers.institutionId, input.institutionId),
            eq(customers.id, input.id),
          ),
        )
        .returning();

      return row ? mapCustomerRow(row) : null;
    },
  });
}
