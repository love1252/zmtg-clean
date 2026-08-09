import { and, asc, desc, eq, gt, gte, lt, lte, or } from 'drizzle-orm';
import {
  deriveTreatmentSummaryStatus,
  mapTreatmentSummaryRecordToListItem,
  type InstitutionTreatmentSummaryListItem,
  type InstitutionTreatmentSummaryListResponse,
  type TreatmentSummaryListQuery,
  type TreatmentSummaryRecord,
  type TreatmentSummaryVoidReasonCode,
} from '@/modules/institution/domain/treatment-summaries';
import { createTreatmentSummaryCursor } from '@/modules/institution/server/treatment-summary-query-parser';
import type { TenantDatabase } from '@/server/db/client';
import { appointments, customers, treatmentSummaries } from '@/server/db/schema';

type TreatmentSummaryRow = typeof treatmentSummaries.$inferSelect;
type TreatmentSummaryLookupInput = {
  tenantId: string;
  customerId: string;
};
type InstitutionTreatmentSummaryLookupInput = TreatmentSummaryLookupInput & {
  institutionId: string;
};
type TreatmentSummaryByTenantInput = {
  tenantId: string;
  id: string;
};
type TreatmentSummaryListInput = {
  tenantId: string;
  query: TreatmentSummaryListQuery;
};
export type FollowUpPathAnalysisTreatmentSummaryReadModel = {
  summaryId: string;
  tenantId: string;
  status: TreatmentSummaryRecord['status'];
  voidedAt: string | null;
  customerId: string;
  appointmentId: string | null;
  treatmentDate: string;
  treatmentProject: string;
  treatmentCategory: string;
  treatmentStage: string;
  recoveryStage: string;
  riskLevel: TreatmentSummaryRecord['riskLevel'];
  nextCareAction: string;
  tags: string[];
};
export type CreateTreatmentSummaryInput = Omit<
  TreatmentSummaryRecord,
  | 'createdAt'
  | 'updatedAt'
  | 'treatmentDate'
  | 'status'
  | 'voidedAt'
  | 'voidedBy'
  | 'voidReasonCode'
  | 'voidReason'
> & {
  treatmentDate: Date;
};
export type UpdateTreatmentSummaryValues = Partial<
  Omit<CreateTreatmentSummaryInput, 'id' | 'tenantId' | 'customerId'>
>;
export type UpdateTreatmentSummaryInput = {
  tenantId: string;
  summaryId: string;
  values: UpdateTreatmentSummaryValues;
};
export type UpdateTreatmentSummaryResult =
  | { kind: 'updated'; record: TreatmentSummaryRecord }
  | { kind: 'not_found_or_not_owned' }
  | {
      kind: 'invalid_reference';
      reason: Exclude<TreatmentSummaryAppointmentOwnershipResult['kind'], 'matched'>;
    };
export type VoidTreatmentSummaryInput = {
  tenantId: string;
  summaryId: string;
  voidedBy: string;
  reasonCode: TreatmentSummaryVoidReasonCode;
  reasonText: string;
};
export type VoidTreatmentSummaryResult =
  | { kind: 'voided'; record: InstitutionTreatmentSummaryListItem }
  | { kind: 'already_voided'; record: InstitutionTreatmentSummaryListItem }
  | { kind: 'not_found_or_not_owned' };

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
  const voidedAt = row.voidedAt?.toISOString() ?? null;

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
    status: deriveTreatmentSummaryStatus(voidedAt),
    voidedAt,
    voidedBy: row.voidedBy,
    voidReasonCode: row.voidReasonCode,
    voidReason: row.voidReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function checkAppointmentBelongsToTenantAndCustomer(
  database: TenantDatabase,
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
      void input;
      throw new Error('legacy_treatment_summary_writer_disabled');
    },

    async checkAppointmentBelongsToTenantAndCustomer(
      input: TreatmentSummaryAppointmentOwnershipInput,
    ): Promise<TreatmentSummaryAppointmentOwnershipResult> {
      return checkAppointmentBelongsToTenantAndCustomer(database, input);
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

    async listTreatmentSummariesByTenantInstitutionAndCustomer(
      input: InstitutionTreatmentSummaryLookupInput,
    ): Promise<TreatmentSummaryRecord[]> {
      const rows = await database
        .select({ treatmentSummary: treatmentSummaries })
        .from(treatmentSummaries)
        .innerJoin(
          customers,
          and(
            eq(treatmentSummaries.tenantId, customers.tenantId),
            eq(treatmentSummaries.customerId, customers.id),
          ),
        )
        .where(
          and(
            eq(treatmentSummaries.tenantId, input.tenantId),
            eq(treatmentSummaries.customerId, input.customerId),
            eq(customers.tenantId, input.tenantId),
            eq(customers.institutionId, input.institutionId),
            eq(customers.id, input.customerId),
          ),
        )
        .orderBy(desc(treatmentSummaries.treatmentDate), asc(treatmentSummaries.id));

      return rows.map((row) => mapTreatmentSummaryRowToRecord(row.treatmentSummary));
    },

    async getTreatmentSummaryByTenant(
      input: TreatmentSummaryByTenantInput,
    ): Promise<TreatmentSummaryRecord | null> {
      const rows = await database
        .select()
        .from(treatmentSummaries)
        .where(
          and(
            eq(treatmentSummaries.tenantId, input.tenantId),
            eq(treatmentSummaries.id, input.id),
          ),
        );
      const row = rows.find((candidate) => candidate.tenantId === input.tenantId && candidate.id === input.id);

      return row ? mapTreatmentSummaryRowToRecord(row) : null;
    },

    async updateTreatmentSummaryByTenant(
      input: UpdateTreatmentSummaryInput,
    ): Promise<UpdateTreatmentSummaryResult> {
      void input;
      throw new Error('legacy_treatment_summary_writer_disabled');
    },

    async voidTreatmentSummaryByTenant(
      input: VoidTreatmentSummaryInput,
    ): Promise<VoidTreatmentSummaryResult> {
      void input;
      throw new Error('legacy_treatment_summary_writer_disabled');
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

    async listFollowUpPathAnalysisTreatmentSummariesByTenant(
      tenantId: string,
    ): Promise<FollowUpPathAnalysisTreatmentSummaryReadModel[]> {
      const rows = await database
        .select({
          id: treatmentSummaries.id,
          tenantId: treatmentSummaries.tenantId,
          customerId: treatmentSummaries.customerId,
          appointmentId: treatmentSummaries.appointmentId,
          treatmentDate: treatmentSummaries.treatmentDate,
          treatmentProject: treatmentSummaries.treatmentProject,
          treatmentCategory: treatmentSummaries.treatmentCategory,
          treatmentStage: treatmentSummaries.treatmentStage,
          recoveryStage: treatmentSummaries.recoveryStage,
          riskLevel: treatmentSummaries.riskLevel,
          nextCareAction: treatmentSummaries.nextCareAction,
          tags: treatmentSummaries.tags,
          voidedAt: treatmentSummaries.voidedAt,
        })
        .from(treatmentSummaries)
        .where(eq(treatmentSummaries.tenantId, tenantId));

      return rows
        .filter((row) => row.tenantId === tenantId)
        .map((row) => {
          const voidedAt = row.voidedAt?.toISOString() ?? null;

          return {
            summaryId: row.id,
            tenantId: row.tenantId,
            status: deriveTreatmentSummaryStatus(voidedAt),
            voidedAt,
            customerId: row.customerId,
            appointmentId: row.appointmentId,
            treatmentDate: row.treatmentDate.toISOString(),
            treatmentProject: row.treatmentProject,
            treatmentCategory: row.treatmentCategory,
            treatmentStage: row.treatmentStage,
            recoveryStage: row.recoveryStage,
            riskLevel: row.riskLevel,
            nextCareAction: row.nextCareAction,
            tags: [...row.tags],
          };
        });
    },
  };
}

export type TreatmentSummaryRepository = ReturnType<typeof createTreatmentSummaryRepository>;
