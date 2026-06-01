import { and, asc, desc, eq, gt, gte, lt, lte, or } from 'drizzle-orm';
import {
  mapTreatmentSummaryRecordToListItem,
  type InstitutionTreatmentSummaryListResponse,
  type TreatmentSummaryListQuery,
  type TreatmentSummaryRecord,
} from '@/modules/institution/domain/treatment-summaries';
import { createTreatmentSummaryCursor } from '@/modules/institution/server/treatment-summary-query-parser';
import type { TenantDatabase } from '@/server/db/client';
import { appointments, treatmentSummaries } from '@/server/db/schema';

type TreatmentSummaryRow = typeof treatmentSummaries.$inferSelect;
type TreatmentSummaryLookupInput = {
  tenantId: string;
  customerId: string;
};
type TreatmentSummaryListInput = {
  tenantId: string;
  query: TreatmentSummaryListQuery;
};
export type CreateTreatmentSummaryInput = Omit<
  TreatmentSummaryRecord,
  'createdAt' | 'updatedAt' | 'treatmentDate'
> & {
  treatmentDate: Date;
};

export type TreatmentSummaryAppointmentOwnershipInput = {
  tenantId: string;
  customerId: string;
  appointmentId: string;
};

export type TreatmentSummaryAppointmentOwnershipResult =
  | { kind: 'matched' }
  | { kind: 'customer_mismatch' }
  | { kind: 'not_found_or_not_owned' };

export function mapTreatmentSummaryRowToRecord(row: TreatmentSummaryRow): TreatmentSummaryRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    customerId: row.customerId,
    appointmentId: row.appointmentId,
    treatmentDate: row.treatmentDate.toISOString(),
    treatmentProject: row.treatmentProject,
    treatmentCategory: row.treatmentCategory,
    treatmentStage: row.treatmentStage,
    recoveryStage: row.recoveryStage,
    riskLevel: row.riskLevel,
    ownerUserId: row.ownerUserId,
    summary: row.summary,
    nextCareAction: row.nextCareAction,
    tags: [...row.tags],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildTreatmentSummaryListConditions(input: TreatmentSummaryListInput) {
  const conditions = [eq(treatmentSummaries.tenantId, input.tenantId)];
  const { filters, cursor } = input.query;

  if (filters.customerId) {
    conditions.push(eq(treatmentSummaries.customerId, filters.customerId));
  }

  if (filters.treatmentProject) {
    conditions.push(eq(treatmentSummaries.treatmentProject, filters.treatmentProject));
  }

  if (filters.riskLevel) {
    conditions.push(eq(treatmentSummaries.riskLevel, filters.riskLevel));
  }

  if (filters.from) {
    conditions.push(gte(treatmentSummaries.treatmentDate, new Date(filters.from)));
  }

  if (filters.to) {
    conditions.push(lte(treatmentSummaries.treatmentDate, new Date(filters.to)));
  }

  if (cursor) {
    const cursorTreatmentDate = new Date(cursor.treatmentDate);
    const cursorCondition = or(
      lt(treatmentSummaries.treatmentDate, cursorTreatmentDate),
      and(
        eq(treatmentSummaries.treatmentDate, cursorTreatmentDate),
        gt(treatmentSummaries.id, cursor.id),
      ),
    );
    if (cursorCondition) {
      conditions.push(cursorCondition);
    }
  }

  return and(...conditions);
}

function treatmentSummaryRowMatchesInput(row: TreatmentSummaryRow, input: TreatmentSummaryListInput) {
  const { filters, cursor } = input.query;

  if (row.tenantId !== input.tenantId) return false;
  if (filters.customerId && row.customerId !== filters.customerId) return false;
  if (filters.treatmentProject && row.treatmentProject !== filters.treatmentProject) return false;
  if (filters.riskLevel && row.riskLevel !== filters.riskLevel) return false;
  if (filters.from && row.treatmentDate.getTime() < Date.parse(filters.from)) return false;
  if (filters.to && row.treatmentDate.getTime() > Date.parse(filters.to)) return false;

  if (cursor) {
    const rowTime = row.treatmentDate.getTime();
    const cursorTime = Date.parse(cursor.treatmentDate);
    if (rowTime > cursorTime) return false;
    if (rowTime === cursorTime && row.id <= cursor.id) return false;
  }

  return true;
}

function mapRowsToTreatmentSummaryListResponse(
  rows: TreatmentSummaryRow[],
  input: TreatmentSummaryListInput,
): InstitutionTreatmentSummaryListResponse {
  const visibleRows = rows.filter((row) => treatmentSummaryRowMatchesInput(row, input));
  const pageRows = visibleRows.slice(0, input.query.limit);
  const records = pageRows
    .map(mapTreatmentSummaryRowToRecord)
    .map(mapTreatmentSummaryRecordToListItem);
  const lastRecord = records.at(-1);

  return {
    records,
    pageInfo: {
      hasMore: visibleRows.length > input.query.limit,
      limit: input.query.limit,
      nextCursor:
        visibleRows.length > input.query.limit && lastRecord
          ? createTreatmentSummaryCursor({
              id: lastRecord.id,
              treatmentDate: lastRecord.treatmentDate,
            })
          : null,
    },
  };
}

export function createTreatmentSummaryRepository(database: TenantDatabase) {
  return {
    async createTreatmentSummary(
      input: CreateTreatmentSummaryInput,
    ): Promise<TreatmentSummaryRecord> {
      const [row] = await database
        .insert(treatmentSummaries)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          customerId: input.customerId,
          appointmentId: input.appointmentId,
          treatmentDate: input.treatmentDate,
          treatmentProject: input.treatmentProject,
          treatmentCategory: input.treatmentCategory,
          treatmentStage: input.treatmentStage,
          recoveryStage: input.recoveryStage,
          riskLevel: input.riskLevel,
          ownerUserId: input.ownerUserId,
          summary: input.summary,
          nextCareAction: input.nextCareAction,
          tags: [...input.tags],
        })
        .returning();

      if (!row) {
        throw new Error('Failed to create treatment summary');
      }

      return mapTreatmentSummaryRowToRecord(row);
    },

    async checkAppointmentBelongsToTenantAndCustomer(
      input: TreatmentSummaryAppointmentOwnershipInput,
    ): Promise<TreatmentSummaryAppointmentOwnershipResult> {
      const [appointment] = await database
        .select({ customerId: appointments.customerId })
        .from(appointments)
        .where(
          and(
            eq(appointments.tenantId, input.tenantId),
            eq(appointments.id, input.appointmentId),
          ),
        );

      if (!appointment) {
        return { kind: 'not_found_or_not_owned' };
      }

      if (appointment.customerId !== input.customerId) {
        return { kind: 'customer_mismatch' };
      }

      return { kind: 'matched' };
    },

    async listTreatmentSummariesByTenantAndCustomer(
      input: TreatmentSummaryLookupInput,
    ): Promise<TreatmentSummaryRecord[]> {
      const rows = await database
        .select()
        .from(treatmentSummaries)
        .where(
          and(
            eq(treatmentSummaries.tenantId, input.tenantId),
            eq(treatmentSummaries.customerId, input.customerId),
          ),
        )
        .orderBy(desc(treatmentSummaries.treatmentDate), asc(treatmentSummaries.id));

      return rows
        .filter(
          (row) => row.tenantId === input.tenantId && row.customerId === input.customerId,
        )
        .map(mapTreatmentSummaryRowToRecord);
    },

    async listTreatmentSummariesByTenant(
      input: TreatmentSummaryListInput,
    ): Promise<InstitutionTreatmentSummaryListResponse> {
      const rows = await database
        .select()
        .from(treatmentSummaries)
        .where(buildTreatmentSummaryListConditions(input))
        .orderBy(desc(treatmentSummaries.treatmentDate), asc(treatmentSummaries.id))
        .limit(input.query.limit + 1);

      return mapRowsToTreatmentSummaryListResponse(rows, input);
    },
  };
}
