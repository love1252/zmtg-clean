import { and, eq, isNotNull } from 'drizzle-orm';
import type {
  AppointmentRecordSummary,
  AppointmentStatus,
} from '@/modules/institution/domain/appointment-records';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';
import {
  transitionFollowUpTask as transitionFollowUpTaskDomain,
  type FollowUpRiskLevel,
  type FollowUpStatus,
  type TenantFollowUpTaskFromTreatmentSummarySuggestion,
  type TenantFollowUpTask,
} from '@/modules/institution/domain/followup-workflow';
import type { TenantDatabase } from '@/server/db/client';
import { appointments, customers, followUpTasks, treatmentSummaries } from '@/server/db/schema';
import type { FollowUpTaskListFilters } from '@/modules/institution/server/follow-up-task-query-parser';

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
  | 'gender'
  | 'birthDate'
  | 'referralSource'
  | 'notes'
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
type CustomerTimelineRelatedLookupInput = {
  tenantId: string;
  customerId: string;
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
type CreateFollowUpTaskFromTreatmentSummarySuggestionInput = {
  id: string;
  tenantId: string;
  customerId: string;
  customerDisplayName: string;
  journeyId: string;
  stage: string;
  status?: Extract<FollowUpStatus, 'scheduled' | 'due'>;
  dueAt: string;
  suggestedAction: string;
  riskLevel: FollowUpRiskLevel;
  sourceTreatmentSummaryId: string;
  sourceSuggestionKey: string;
};
type ListFollowUpTasksByTenantInput =
  | string
  | {
      tenantId: string;
      filters?: FollowUpTaskListFilters;
    };
export type FollowUpPathAnalysisSourceTaskReadModel = {
  taskId: string;
  tenantId: string;
  source: 'treatment_summary';
  sourceTreatmentSummaryId: string;
  sourceSuggestionKey: string;
  taskStatus: FollowUpStatus;
  dueAt: string;
  updatedAt: string | null;
};
type TransitionFollowUpTaskPersistenceResult =
  | { kind: 'updated'; task: TenantFollowUpTask }
  | { kind: 'not_found' }
  | { kind: 'conflict'; resourceId: string; reason: 'stale_transition' }
  | { kind: 'invalid_transition'; resourceId: string; from: FollowUpStatus; to: FollowUpStatus };
type CreateFollowUpTaskFromTreatmentSummarySuggestionResult =
  | { kind: 'created'; task: TenantFollowUpTaskFromTreatmentSummarySuggestion }
  | { kind: 'conflict'; resourceId: string; reason: 'active_source_follow_up_exists' }
  | { kind: 'invalid_source'; reason: 'source_treatment_summary_not_found_or_cross_tenant' };

type CreateManualFollowUpTaskInput = {
  id: string;
  tenantId: string;
  customerId: string;
  customerDisplayName: string;
  stage: string;
  status: FollowUpStatus;
  dueAt: string;
  suggestedAction: string;
  riskLevel: FollowUpRiskLevel;
};

type CreateManualFollowUpTaskResult =
  | { kind: 'created'; task: TenantFollowUpTask }
  | { kind: 'customer_not_found' };

const activeSourceFollowUpStatuses = new Set<FollowUpStatus>([
  'scheduled',
  'due',
  'in_progress',
  'escalated',
]);

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
    gender: input.gender,
    birthDate: input.birthDate,
    referralSource: input.referralSource,
    notes: input.notes,
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
    gender: row.gender,
    birthDate: row.birthDate,
    referralSource: row.referralSource,
    notes: row.notes,
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
  const hasTreatmentSummarySource = Boolean(row.sourceTreatmentSummaryId && row.sourceSuggestionKey);

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
    source: hasTreatmentSummarySource ? 'treatment_summary' : null,
    sourceTreatmentSummaryId: hasTreatmentSummarySource ? row.sourceTreatmentSummaryId : null,
    sourceSuggestionKey: hasTreatmentSummarySource ? row.sourceSuggestionKey : null,
  };
}

export function mapFollowUpTaskSourceRowToRecord(
  row: FollowUpTaskRow,
): TenantFollowUpTaskFromTreatmentSummarySuggestion {
  return {
    ...mapFollowUpTaskRowToRecord(row),
    source: 'treatment_summary',
    sourceTreatmentSummaryId: row.sourceTreatmentSummaryId ?? '',
    sourceSuggestionKey: row.sourceSuggestionKey ?? '',
  };
}

function normalizeFollowUpTaskListInput(input: ListFollowUpTasksByTenantInput): {
  tenantId: string;
  filters: FollowUpTaskListFilters;
} {
  if (typeof input === 'string') {
    return {
      tenantId: input,
      filters: {
        source: null,
        sourceTreatmentSummaryId: null,
      },
    };
  }

  return {
    tenantId: input.tenantId,
    filters: input.filters ?? {
      source: null,
      sourceTreatmentSummaryId: null,
    },
  };
}

function buildFollowUpTaskListWhere(input: {
  tenantId: string;
  filters: FollowUpTaskListFilters;
}) {
  const conditions = [eq(followUpTasks.tenantId, input.tenantId)];

  if (input.filters.sourceTreatmentSummaryId) {
    conditions.push(
      eq(followUpTasks.sourceTreatmentSummaryId, input.filters.sourceTreatmentSummaryId),
      isNotNull(followUpTasks.sourceSuggestionKey),
    );
  } else if (input.filters.source === 'treatment_summary') {
    conditions.push(
      isNotNull(followUpTasks.sourceTreatmentSummaryId),
      isNotNull(followUpTasks.sourceSuggestionKey),
    );
  }

  return conditions.length === 1 ? conditions[0] : and(...conditions);
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
    async createFollowUpTaskFromTreatmentSummarySuggestion(
      input: CreateFollowUpTaskFromTreatmentSummarySuggestionInput,
    ): Promise<CreateFollowUpTaskFromTreatmentSummarySuggestionResult> {
      const [sourceSummary] = await database
        .select({ id: treatmentSummaries.id, customerId: treatmentSummaries.customerId })
        .from(treatmentSummaries)
        .where(
          and(
            eq(treatmentSummaries.tenantId, input.tenantId),
            eq(treatmentSummaries.id, input.sourceTreatmentSummaryId),
            eq(treatmentSummaries.customerId, input.customerId),
          ),
        );

      if (!sourceSummary) {
        return {
          kind: 'invalid_source',
          reason: 'source_treatment_summary_not_found_or_cross_tenant',
        };
      }

      const existingSourceRows = await database
        .select()
        .from(followUpTasks)
        .where(
          and(
            eq(followUpTasks.tenantId, input.tenantId),
            eq(followUpTasks.sourceTreatmentSummaryId, input.sourceTreatmentSummaryId),
            eq(followUpTasks.sourceSuggestionKey, input.sourceSuggestionKey),
          ),
        );
      const activeSourceTask = existingSourceRows.find(
        (row) =>
          row.tenantId === input.tenantId &&
          row.sourceTreatmentSummaryId === input.sourceTreatmentSummaryId &&
          row.sourceSuggestionKey === input.sourceSuggestionKey &&
          activeSourceFollowUpStatuses.has(row.status),
      );

      if (activeSourceTask) {
        return {
          kind: 'conflict',
          resourceId: activeSourceTask.id,
          reason: 'active_source_follow_up_exists',
        };
      }

      // Phase 15 PR3 只提供 repository 地基；真实 API 接入前必须单独决定 follow-up quota。
      const [row] = await database
        .insert(followUpTasks)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          customerId: input.customerId,
          customerDisplayName: input.customerDisplayName,
          journeyId: input.journeyId,
          stage: input.stage,
          status: input.status ?? 'scheduled',
          dueAt: new Date(input.dueAt),
          suggestedAction: input.suggestedAction,
          riskLevel: input.riskLevel,
          sourceTreatmentSummaryId: input.sourceTreatmentSummaryId,
          sourceSuggestionKey: input.sourceSuggestionKey,
        })
        .returning();

      return { kind: 'created', task: mapFollowUpTaskSourceRowToRecord(row) };
    },
    async createManualFollowUpTask(
      input: CreateManualFollowUpTaskInput,
    ): Promise<CreateManualFollowUpTaskResult> {
      const customerExists = await database
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, input.tenantId), eq(customers.id, input.customerId)))
        .limit(1);

      if (customerExists.length === 0) {
        return { kind: 'customer_not_found' };
      }

      // 手动创建随访：不关联治疗摘要来源，source 字段为 null
      const [row] = await database
        .insert(followUpTasks)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          customerId: input.customerId,
          customerDisplayName: input.customerDisplayName,
          journeyId: `manual-${Date.now()}`,
          stage: input.stage,
          status: input.status,
          dueAt: new Date(input.dueAt),
          suggestedAction: input.suggestedAction,
          riskLevel: input.riskLevel,
          sourceTreatmentSummaryId: null,
          sourceSuggestionKey: null,
        })
        .returning();

      return { kind: 'created', task: mapFollowUpTaskRowToRecord(row) };
    },
    async customerExistsByTenant(input: CustomerLookupInput): Promise<boolean> {
      const [row] = await database
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, input.tenantId), eq(customers.id, input.id)));

      return Boolean(row);
    },
    async getCustomerByTenant(input: CustomerLookupInput): Promise<CustomerRecordSummary | null> {
      const [row] = await database
        .select()
        .from(customers)
        .where(and(eq(customers.tenantId, input.tenantId), eq(customers.id, input.id)));

      return row ? mapCustomerRowToRecord(row) : null;
    },
    async listAppointmentsByTenantAndCustomer(
      input: CustomerTimelineRelatedLookupInput,
    ): Promise<AppointmentRecordSummary[]> {
      const rows = await database
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.tenantId, input.tenantId),
            eq(appointments.customerId, input.customerId),
          ),
        );

      return rows.map(mapAppointmentRowToRecord);
    },
    async listFollowUpTasksByTenantAndCustomer(
      input: CustomerTimelineRelatedLookupInput,
    ): Promise<TenantFollowUpTask[]> {
      const rows = await database
        .select()
        .from(followUpTasks)
        .where(
          and(
            eq(followUpTasks.tenantId, input.tenantId),
            eq(followUpTasks.customerId, input.customerId),
          ),
        );

      return rows.map(mapFollowUpTaskRowToRecord);
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
          resourceId: currentRow.id,
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
        : { kind: 'conflict', resourceId: currentRow.id, reason: 'stale_transition' };
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
    async listFollowUpTasksByTenant(input: ListFollowUpTasksByTenantInput) {
      const normalized = normalizeFollowUpTaskListInput(input);
      const rows = await database
        .select()
        .from(followUpTasks)
        .where(buildFollowUpTaskListWhere(normalized));
      return rows.map(mapFollowUpTaskRowToRecord);
    },
    async listFollowUpPathAnalysisSourceTasksByTenant(
      tenantId: string,
    ): Promise<FollowUpPathAnalysisSourceTaskReadModel[]> {
      const rows = await database
        .select({
          id: followUpTasks.id,
          tenantId: followUpTasks.tenantId,
          sourceTreatmentSummaryId: followUpTasks.sourceTreatmentSummaryId,
          sourceSuggestionKey: followUpTasks.sourceSuggestionKey,
          status: followUpTasks.status,
          dueAt: followUpTasks.dueAt,
          updatedAt: followUpTasks.updatedAt,
        })
        .from(followUpTasks)
        .where(
          and(
            eq(followUpTasks.tenantId, tenantId),
            isNotNull(followUpTasks.sourceTreatmentSummaryId),
            isNotNull(followUpTasks.sourceSuggestionKey),
          ),
        );

      return rows
        .filter((row) => (
          row.tenantId === tenantId &&
          row.sourceTreatmentSummaryId !== null &&
          row.sourceSuggestionKey !== null
        ))
        .map((row) => ({
          taskId: row.id,
          tenantId: row.tenantId,
          source: 'treatment_summary',
          sourceTreatmentSummaryId: row.sourceTreatmentSummaryId ?? '',
          sourceSuggestionKey: row.sourceSuggestionKey ?? '',
          taskStatus: row.status,
          dueAt: row.dueAt.toISOString(),
          updatedAt: row.updatedAt?.toISOString() ?? null,
        }));
    },
  };
}

export type TenantBusinessRepository = ReturnType<typeof createTenantBusinessRepository>;
