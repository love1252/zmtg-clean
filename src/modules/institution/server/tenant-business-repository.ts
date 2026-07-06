import { and, asc, desc, eq, inArray, isNotNull } from 'drizzle-orm';
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
import type {
  FollowUpPathEnrollment,
  FollowUpPathEnrollmentSourceType,
  FollowUpPathEnrollmentStatus,
  FollowUpPathStageInstance,
} from '@/modules/institution/domain/followup-path-enrollment';
import type { TreatmentPathHandlerRole, TreatmentPathTemplateKey } from '@/modules/institution/domain/treatment-path-templates';
import type {
  FollowUpMessageDraft,
  FollowUpMessageDraftStatus,
  FollowUpMessageSafeReasonCode,
  FollowUpMessageTemplate,
  FollowUpMessageTemplateType,
  FollowUpTaskPathContext,
} from '@/modules/institution/domain/followup-message-drafts';
import type {
  FollowUpCustomerOverview,
  FollowUpCustomerTimelineEvent,
  FollowUpCustomerTimelineEventType,
  FollowUpCustomerTimelineSourceType,
} from '@/modules/institution/domain/followup-customer-timeline';
import type { TenantDatabase } from '@/server/db/client';
import {
  followUpMessageDrafts,
  followUpMessageTemplates,
  appointments,
  customers,
  followUpCustomerTimelineEvents,
  followUpPathEnrollments,
  followUpPathStages,
  followUpTasks,
  treatmentSummaries,
} from '@/server/db/schema';
import type { FollowUpTaskListFilters } from '@/modules/institution/server/follow-up-task-query-parser';

type CustomerRow = typeof customers.$inferSelect;
type AppointmentRow = typeof appointments.$inferSelect;
type FollowUpTaskRow = typeof followUpTasks.$inferSelect;
type FollowUpMessageTemplateRow = typeof followUpMessageTemplates.$inferSelect;
type FollowUpMessageDraftRow = typeof followUpMessageDrafts.$inferSelect;
type FollowUpPathEnrollmentRow = typeof followUpPathEnrollments.$inferSelect;
type FollowUpPathStageRow = typeof followUpPathStages.$inferSelect;
type FollowUpCustomerTimelineEventRow = typeof followUpCustomerTimelineEvents.$inferSelect;
type CreateFollowUpPathEnrollmentInput = typeof followUpPathEnrollments.$inferInsert;
type CreateFollowUpCustomerTimelineEventInput = Omit<
  typeof followUpCustomerTimelineEvents.$inferInsert,
  'occurredAt' | 'createdAt' | 'updatedAt'
> & {
  occurredAt: string;
  createdAt?: string;
  updatedAt?: string;
};
type CreateFollowUpMessageDraftInput = Omit<
  typeof followUpMessageDrafts.$inferInsert,
  | 'createdAt'
  | 'updatedAt'
  | 'approvedAt'
  | 'rejectedAt'
  | 'markedSentAt'
> & {
  createdAt: string;
  updatedAt: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  markedSentAt?: string | null;
};
type CreateFollowUpPathStageInput = Omit<
  typeof followUpPathStages.$inferInsert,
  'dueAt' | 'createdAt' | 'updatedAt'
> & {
  dueAt: string;
  createdAt: string;
  updatedAt: string;
};
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
  skipActiveSourceConflict?: boolean;
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

type ListFollowUpPathEnrollmentsByTenantInput = {
  tenantId: string;
  institutionId?: string | null;
  status?: FollowUpPathEnrollmentStatus | null;
};

type FollowUpPathEnrollmentSourceLookupInput = {
  tenantId: string;
  institutionId?: string | null;
  sourceType: FollowUpPathEnrollmentSourceType;
  sourceId: string;
  templateKey: TreatmentPathTemplateKey;
};

type FollowUpPathEnrollmentLookupInput = {
  tenantId: string;
  institutionId?: string | null;
  enrollmentId: string;
};

type CreateFollowUpPathEnrollmentResult =
  | { kind: 'created'; enrollment: FollowUpPathEnrollment }
  | { kind: 'conflict'; resourceId: string; reason: 'active_follow_up_path_enrollment_exists' }
  | { kind: 'invalid_source'; reason: 'source_treatment_summary_not_found_or_cross_tenant' }
  | { kind: 'customer_not_found' };

type CancelFollowUpPathEnrollmentResult =
  | { kind: 'cancelled'; enrollment: FollowUpPathEnrollment }
  | { kind: 'not_found' }
  | { kind: 'conflict'; resourceId: string; reason: 'follow_up_path_enrollment_not_active' };

type FollowUpTaskPathContextLookupInput = {
  tenantId: string;
  institutionId?: string | null;
  followUpTaskId: string;
};

type FollowUpMessageDraftLookupInput = {
  tenantId: string;
  institutionId?: string | null;
  draftId: string;
};

type ListFollowUpMessageDraftsInput = {
  tenantId: string;
  institutionId?: string | null;
  followUpTaskId: string;
};

type CreateFollowUpMessageDraftResult =
  | { kind: 'created'; draft: FollowUpMessageDraft }
  | { kind: 'conflict'; resourceId: string; reason: 'follow_up_message_draft_exists' };

type UpdateFollowUpMessageDraftContentResult =
  | { kind: 'updated'; draft: FollowUpMessageDraft }
  | { kind: 'not_found' }
  | { kind: 'conflict'; resourceId: string; reason: 'follow_up_message_draft_not_draft' };

type FollowUpMessageDraftTransitionResult =
  | { kind: 'updated'; draft: FollowUpMessageDraft }
  | { kind: 'not_found' }
  | {
      kind: 'conflict';
      resourceId: string;
      reason: 'follow_up_message_draft_not_draft' | 'follow_up_message_draft_not_approved';
    };

type RecordFollowUpCustomerTimelineEventResult =
  | { kind: 'created'; event: FollowUpCustomerTimelineEvent }
  | { kind: 'exists'; event: FollowUpCustomerTimelineEvent }
  | { kind: 'customer_not_found' };

type CustomerFollowUpTimelineLookupInput = {
  tenantId: string;
  institutionId?: string | null;
  customerId: string;
};

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
    requiresHumanHandling: true,
    forbidAutoReachOut: true,
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

function mapFollowUpMessageTemplateRowToRecord(row: FollowUpMessageTemplateRow): FollowUpMessageTemplate {
  return {
    id: row.id,
    tenantId: row.tenantId,
    institutionId: row.institutionId,
    templateKey: row.templateKey,
    templateName: row.templateName,
    templateType: row.templateType as FollowUpMessageTemplateType,
    applicableTemplateKey: row.applicableTemplateKey as TreatmentPathTemplateKey | null,
    applicableNodeKey: row.applicableNodeKey,
    channelType: 'manual',
    contentTemplate: row.contentTemplate,
    variablesJson: row.variablesJson,
    status: row.status,
    requiresHumanApproval: true,
    forbidAutoSend: true,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapFollowUpMessageDraftRowToRecord(input: {
  row: FollowUpMessageDraftRow;
  task: FollowUpTaskRow;
}): FollowUpMessageDraft {
  return {
    id: input.row.id,
    tenantId: input.row.tenantId,
    institutionId: input.row.institutionId,
    followUpTaskId: input.row.followUpTaskId,
    enrollmentId: input.row.enrollmentId,
    stageId: input.row.stageId,
    customerId: input.row.customerId,
    customerDisplayName: input.task.customerDisplayName,
    templateId: input.row.templateId,
    channelType: 'manual',
    status: input.row.status as FollowUpMessageDraftStatus,
    draftContent: input.row.draftContent,
    editedContent: input.row.editedContent,
    safePreview: input.row.safePreview,
    approvedBy: input.row.approvedBy,
    approvedAt: input.row.approvedAt?.toISOString() ?? null,
    rejectedBy: input.row.rejectedBy,
    rejectedAt: input.row.rejectedAt?.toISOString() ?? null,
    markedSentBy: input.row.markedSentBy,
    markedSentAt: input.row.markedSentAt?.toISOString() ?? null,
    safeReasonCode: input.row.safeReasonCode as FollowUpMessageSafeReasonCode,
    metadataJson: input.row.metadataJson,
    createdAt: input.row.createdAt.toISOString(),
    updatedAt: input.row.updatedAt.toISOString(),
  };
}

function mapFollowUpCustomerTimelineEventRowToRecord(
  row: FollowUpCustomerTimelineEventRow,
): FollowUpCustomerTimelineEvent {
  return {
    id: row.id,
    tenantId: row.tenantId,
    institutionId: row.institutionId,
    customerId: row.customerId,
    sourceType: row.sourceType as FollowUpCustomerTimelineSourceType,
    sourceId: row.sourceId,
    eventType: row.eventType as FollowUpCustomerTimelineEventType,
    eventTitle: row.eventTitle,
    safeSummary: row.safeSummary,
    riskLevel: row.riskLevel,
    occurredAt: row.occurredAt.toISOString(),
    safeActorRole: row.safeActorRole,
    safeReasonCode: row.safeReasonCode,
    metadataJson: row.metadataJson,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapFollowUpPathStageRowToRecord(row: FollowUpPathStageRow): FollowUpPathStageInstance {
  return {
    id: row.id,
    tenantId: row.tenantId,
    institutionId: row.institutionId,
    enrollmentId: row.enrollmentId,
    nodeKey: row.nodeKey,
    stageKey: row.stageKey,
    dueAt: row.dueAt.toISOString(),
    status: row.status,
    followUpTaskId: row.followUpTaskId,
    handlerRole: row.handlerRole as TreatmentPathHandlerRole,
    riskLevel: row.riskLevel,
    safeMessage: row.safeMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function createEmptyEnrollmentRecord(row: FollowUpPathEnrollmentRow): FollowUpPathEnrollment {
  return {
    id: row.id,
    tenantId: row.tenantId,
    institutionId: row.institutionId,
    customerId: row.customerId,
    customerDisplayName: '客户',
    treatmentSummaryId: row.treatmentSummaryId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    templateKey: row.templateKey as TreatmentPathTemplateKey,
    templateVersion: row.templateVersion,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    safeReasonCode: row.safeReasonCode,
    metadataJson: row.metadataJson,
    stageCount: 0,
    taskCount: 0,
    dueAt: null,
    safeMessage: '路径任务需人工处理，不会主动向客户发送消息。',
    taskIds: [],
    stages: [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function hydrateFollowUpPathEnrollments(input: {
  rows: FollowUpPathEnrollmentRow[];
  customersById: Map<string, CustomerRow>;
  stagesByEnrollmentId: Map<string, FollowUpPathStageRow[]>;
}): FollowUpPathEnrollment[] {
  return input.rows.map((row) => {
    const stages = (input.stagesByEnrollmentId.get(row.id) ?? []).map(mapFollowUpPathStageRowToRecord);
    const taskIds = stages
      .map((stage) => stage.followUpTaskId)
      .filter((taskId): taskId is string => Boolean(taskId));
    const dueAt = stages
      .filter((stage) => stage.status !== 'completed' && stage.status !== 'cancelled')
      .sort((left, right) => Date.parse(left.dueAt) - Date.parse(right.dueAt))[0]?.dueAt ??
      stages.sort((left, right) => Date.parse(left.dueAt) - Date.parse(right.dueAt))[0]?.dueAt ??
      null;

    return {
      ...createEmptyEnrollmentRecord(row),
      customerDisplayName: input.customersById.get(row.customerId)?.displayName ?? '客户',
      stageCount: stages.length,
      taskCount: taskIds.length,
      dueAt,
      taskIds,
      stages,
    };
  });
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

function normalizeDateInput(input: string | Date | null | undefined) {
  if (!input) return null;
  return input instanceof Date ? input : new Date(input);
}

function followUpMessageDraftInsertValues(input: CreateFollowUpMessageDraftInput) {
  return {
    ...input,
    createdAt: new Date(input.createdAt),
    updatedAt: new Date(input.updatedAt),
    approvedAt: normalizeDateInput(input.approvedAt),
    rejectedAt: normalizeDateInput(input.rejectedAt),
    markedSentAt: normalizeDateInput(input.markedSentAt),
  };
}

function followUpCustomerTimelineInsertValues(input: CreateFollowUpCustomerTimelineEventInput) {
  const occurredAt = new Date(input.occurredAt);

  return {
    ...input,
    occurredAt,
    createdAt: input.createdAt ? new Date(input.createdAt) : occurredAt,
    updatedAt: input.updatedAt ? new Date(input.updatedAt) : occurredAt,
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

      const existingSourceRows = input.skipActiveSourceConflict
        ? []
        : await database
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
    async findActiveFollowUpPathEnrollmentBySource(
      input: FollowUpPathEnrollmentSourceLookupInput,
    ): Promise<FollowUpPathEnrollment | null> {
      const rows = await database
        .select()
        .from(followUpPathEnrollments)
        .where(
          and(
            eq(followUpPathEnrollments.tenantId, input.tenantId),
            eq(followUpPathEnrollments.sourceType, input.sourceType),
            eq(followUpPathEnrollments.sourceId, input.sourceId),
            eq(followUpPathEnrollments.templateKey, input.templateKey),
            eq(followUpPathEnrollments.status, 'active'),
          ),
        );
      const row = rows.find((candidate) => {
        if (candidate.tenantId !== input.tenantId) return false;
        if (candidate.sourceType !== input.sourceType) return false;
        if (candidate.sourceId !== input.sourceId) return false;
        if (candidate.templateKey !== input.templateKey) return false;
        if (candidate.status !== 'active') return false;
        if (input.institutionId && candidate.institutionId !== input.institutionId) return false;
        return true;
      });

      if (!row) return null;

      const [enrollment] = await this.getHydratedFollowUpPathEnrollments({
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        rows: [row],
      });
      return enrollment ?? null;
    },
    async getHydratedFollowUpPathEnrollments(input: {
      tenantId: string;
      institutionId?: string | null;
      rows: FollowUpPathEnrollmentRow[];
    }): Promise<FollowUpPathEnrollment[]> {
      const visibleRows = input.rows.filter((row) => {
        if (row.tenantId !== input.tenantId) return false;
        if (input.institutionId && row.institutionId !== input.institutionId) return false;
        return true;
      });

      if (visibleRows.length === 0) return [];

      const customerIds = [...new Set(visibleRows.map((row) => row.customerId))];
      const enrollmentIds = visibleRows.map((row) => row.id);
      const customerRows = await database
        .select()
        .from(customers)
        .where(
          and(eq(customers.tenantId, input.tenantId), inArray(customers.id, customerIds)),
        );
      const stageRows = await database
        .select()
        .from(followUpPathStages)
        .where(
          and(
            eq(followUpPathStages.tenantId, input.tenantId),
            inArray(followUpPathStages.enrollmentId, enrollmentIds),
          ),
        );
      const customersById = new Map(customerRows.map((row) => [row.id, row]));
      const stagesByEnrollmentId = new Map<string, FollowUpPathStageRow[]>();

      for (const stageRow of stageRows) {
        if (stageRow.tenantId !== input.tenantId) continue;
        if (!enrollmentIds.includes(stageRow.enrollmentId)) continue;
        const current = stagesByEnrollmentId.get(stageRow.enrollmentId) ?? [];
        current.push(stageRow);
        stagesByEnrollmentId.set(stageRow.enrollmentId, current);
      }

      return hydrateFollowUpPathEnrollments({
        rows: visibleRows,
        customersById,
        stagesByEnrollmentId,
      });
    },
    async createFollowUpPathEnrollment(
      input: CreateFollowUpPathEnrollmentInput,
    ): Promise<CreateFollowUpPathEnrollmentResult> {
      const existing = await this.findActiveFollowUpPathEnrollmentBySource({
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        templateKey: input.templateKey as TreatmentPathTemplateKey,
      });

      if (existing) {
        return {
          kind: 'conflict',
          resourceId: existing.id,
          reason: 'active_follow_up_path_enrollment_exists',
        };
      }

      const [customer] = await database
        .select()
        .from(customers)
        .where(and(eq(customers.tenantId, input.tenantId), eq(customers.id, input.customerId)));

      if (!customer) {
        return { kind: 'customer_not_found' };
      }

      if (input.sourceType === 'treatment_summary') {
        const [summary] = await database
          .select({ id: treatmentSummaries.id, customerId: treatmentSummaries.customerId })
          .from(treatmentSummaries)
          .where(
            and(
              eq(treatmentSummaries.tenantId, input.tenantId),
              eq(treatmentSummaries.id, input.sourceId),
              eq(treatmentSummaries.customerId, input.customerId),
            ),
          );

        if (!summary) {
          return {
            kind: 'invalid_source',
            reason: 'source_treatment_summary_not_found_or_cross_tenant',
          };
        }
      }

      const [row] = await database.insert(followUpPathEnrollments).values(input).returning();
      const [enrollment] = await this.getHydratedFollowUpPathEnrollments({
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        rows: [row],
      });

      return { kind: 'created', enrollment: enrollment ?? createEmptyEnrollmentRecord(row) };
    },
    async createFollowUpPathStages(
      input: CreateFollowUpPathStageInput[],
    ): Promise<FollowUpPathStageInstance[]> {
      if (input.length === 0) return [];

      const rows = await database
        .insert(followUpPathStages)
        .values(
          input.map((stage) => ({
            ...stage,
            dueAt: new Date(stage.dueAt),
            createdAt: new Date(stage.createdAt),
            updatedAt: new Date(stage.updatedAt),
          })),
        )
        .returning();
      return rows.map(mapFollowUpPathStageRowToRecord);
    },
    async listFollowUpPathEnrollmentsByTenant(
      input: ListFollowUpPathEnrollmentsByTenantInput,
    ): Promise<FollowUpPathEnrollment[]> {
      const conditions = [eq(followUpPathEnrollments.tenantId, input.tenantId)];
      if (input.status) {
        conditions.push(eq(followUpPathEnrollments.status, input.status));
      }

      const rows = await database
        .select()
        .from(followUpPathEnrollments)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions));
      return this.getHydratedFollowUpPathEnrollments({
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        rows,
      });
    },
    async getFollowUpPathEnrollmentByTenant(
      input: FollowUpPathEnrollmentLookupInput,
    ): Promise<FollowUpPathEnrollment | null> {
      const rows = await database
        .select()
        .from(followUpPathEnrollments)
        .where(
          and(
            eq(followUpPathEnrollments.tenantId, input.tenantId),
            eq(followUpPathEnrollments.id, input.enrollmentId),
          ),
        );
      const [enrollment] = await this.getHydratedFollowUpPathEnrollments({
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        rows,
      });

      return enrollment ?? null;
    },
    async cancelFollowUpPathEnrollment(
      input: FollowUpPathEnrollmentLookupInput,
    ): Promise<CancelFollowUpPathEnrollmentResult> {
      const current = await this.getFollowUpPathEnrollmentByTenant(input);
      if (!current) {
        return { kind: 'not_found' };
      }

      if (current.status !== 'active') {
        return {
          kind: 'conflict',
          resourceId: current.id,
          reason: 'follow_up_path_enrollment_not_active',
        };
      }

      const now = new Date();
      const [row] = await database
        .update(followUpPathEnrollments)
        .set({
          status: 'cancelled',
          completedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(followUpPathEnrollments.tenantId, input.tenantId),
            eq(followUpPathEnrollments.id, input.enrollmentId),
            eq(followUpPathEnrollments.status, 'active'),
          ),
        )
        .returning();

      if (!row) {
        return {
          kind: 'conflict',
          resourceId: current.id,
          reason: 'follow_up_path_enrollment_not_active',
        };
      }

      const [enrollment] = await this.getHydratedFollowUpPathEnrollments({
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        rows: [row],
      });

      return { kind: 'cancelled', enrollment: enrollment ?? createEmptyEnrollmentRecord(row) };
    },
    async recordFollowUpCustomerTimelineEvent(
      input: CreateFollowUpCustomerTimelineEventInput,
    ): Promise<RecordFollowUpCustomerTimelineEventResult> {
      const customerExists = await this.customerExistsByTenant({
        tenantId: input.tenantId,
        id: input.customerId,
      });

      if (!customerExists) {
        return { kind: 'customer_not_found' };
      }

      const [existing] = await database
        .select()
        .from(followUpCustomerTimelineEvents)
        .where(
          and(
            eq(followUpCustomerTimelineEvents.tenantId, input.tenantId),
            eq(followUpCustomerTimelineEvents.sourceType, input.sourceType),
            eq(followUpCustomerTimelineEvents.sourceId, input.sourceId),
            eq(followUpCustomerTimelineEvents.eventType, input.eventType),
          ),
        );

      if (existing) {
        return { kind: 'exists', event: mapFollowUpCustomerTimelineEventRowToRecord(existing) };
      }

      const [row] = await database
        .insert(followUpCustomerTimelineEvents)
        .values(followUpCustomerTimelineInsertValues(input))
        .onConflictDoNothing()
        .returning();

      if (row) {
        return { kind: 'created', event: mapFollowUpCustomerTimelineEventRowToRecord(row) };
      }

      const [createdByConcurrentRequest] = await database
        .select()
        .from(followUpCustomerTimelineEvents)
        .where(
          and(
            eq(followUpCustomerTimelineEvents.tenantId, input.tenantId),
            eq(followUpCustomerTimelineEvents.sourceType, input.sourceType),
            eq(followUpCustomerTimelineEvents.sourceId, input.sourceId),
            eq(followUpCustomerTimelineEvents.eventType, input.eventType),
          ),
        );

      return createdByConcurrentRequest
        ? { kind: 'exists', event: mapFollowUpCustomerTimelineEventRowToRecord(createdByConcurrentRequest) }
        : { kind: 'customer_not_found' };
    },
    async listCustomerFollowUpTimelineEvents(
      input: CustomerFollowUpTimelineLookupInput,
    ): Promise<FollowUpCustomerTimelineEvent[]> {
      const rows = await database
        .select()
        .from(followUpCustomerTimelineEvents)
        .where(
          and(
            eq(followUpCustomerTimelineEvents.tenantId, input.tenantId),
            eq(followUpCustomerTimelineEvents.customerId, input.customerId),
          ),
        )
        .orderBy(desc(followUpCustomerTimelineEvents.occurredAt), asc(followUpCustomerTimelineEvents.id));

      return rows
        .filter((row) => {
          if (row.tenantId !== input.tenantId) return false;
          if (row.customerId !== input.customerId) return false;
          if (input.institutionId && row.institutionId && row.institutionId !== input.institutionId) return false;
          return true;
        })
        .map(mapFollowUpCustomerTimelineEventRowToRecord);
    },
    async getCustomerFollowUpOverview(
      input: CustomerFollowUpTimelineLookupInput,
    ): Promise<FollowUpCustomerOverview> {
      const pendingTaskStatuses: FollowUpStatus[] = ['scheduled', 'due', 'in_progress'];
      const now = new Date();
      const enrollmentRows = await database
        .select()
        .from(followUpPathEnrollments)
        .where(
          and(
            eq(followUpPathEnrollments.tenantId, input.tenantId),
            eq(followUpPathEnrollments.customerId, input.customerId),
          ),
        );
      const taskRows = await database
        .select()
        .from(followUpTasks)
        .where(
          and(
            eq(followUpTasks.tenantId, input.tenantId),
            eq(followUpTasks.customerId, input.customerId),
          ),
        );
      const draftRows = await database
        .select()
        .from(followUpMessageDrafts)
        .where(
          and(
            eq(followUpMessageDrafts.tenantId, input.tenantId),
            eq(followUpMessageDrafts.customerId, input.customerId),
          ),
        );
      const visibleEnrollments = enrollmentRows.filter((row) => {
        if (row.tenantId !== input.tenantId) return false;
        if (row.customerId !== input.customerId) return false;
        if (input.institutionId && row.institutionId && row.institutionId !== input.institutionId) return false;
        return true;
      });
      const visibleDrafts = draftRows.filter((row) => {
        if (row.tenantId !== input.tenantId) return false;
        if (row.customerId !== input.customerId) return false;
        if (input.institutionId && row.institutionId && row.institutionId !== input.institutionId) return false;
        return true;
      });

      return {
        activeEnrollmentCount: visibleEnrollments.filter((row) => row.status === 'active').length,
        pendingTaskCount: taskRows.filter((row) => pendingTaskStatuses.includes(row.status)).length,
        overdueTaskCount: taskRows.filter(
          (row) => pendingTaskStatuses.includes(row.status) && row.dueAt < now,
        ).length,
        draftCount: visibleDrafts.length,
        approvedDraftCount: visibleDrafts.filter((row) => row.status === 'approved').length,
        markedSentCount: visibleDrafts.filter((row) => row.status === 'marked_sent').length,
        escalatedCount: taskRows.filter((row) => row.status === 'escalated').length,
      };
    },
    async listFollowUpMessageTemplatesByTenant(input: {
      tenantId: string;
      institutionId?: string | null;
    }): Promise<FollowUpMessageTemplate[]> {
      const rows = await database
        .select()
        .from(followUpMessageTemplates)
        .where(eq(followUpMessageTemplates.status, 'active'));

      return rows
        .filter((row) => {
          if (row.tenantId && row.tenantId !== input.tenantId) return false;
          if (input.institutionId && row.institutionId && row.institutionId !== input.institutionId) return false;
          return row.requiresHumanApproval && row.forbidAutoSend && row.channelType === 'manual';
        })
        .map(mapFollowUpMessageTemplateRowToRecord);
    },
    async getFollowUpTaskPathContextByTenant(
      input: FollowUpTaskPathContextLookupInput,
    ): Promise<FollowUpTaskPathContext | null> {
      const [taskRow] = await database
        .select()
        .from(followUpTasks)
        .where(and(eq(followUpTasks.tenantId, input.tenantId), eq(followUpTasks.id, input.followUpTaskId)));

      if (!taskRow) return null;

      const [stageRow] = await database
        .select()
        .from(followUpPathStages)
        .where(
          and(
            eq(followUpPathStages.tenantId, input.tenantId),
            eq(followUpPathStages.followUpTaskId, input.followUpTaskId),
          ),
        );

      if (input.institutionId && stageRow?.institutionId && stageRow.institutionId !== input.institutionId) {
        return null;
      }

      const [enrollmentRow] = stageRow
        ? await database
            .select()
            .from(followUpPathEnrollments)
            .where(
              and(
                eq(followUpPathEnrollments.tenantId, input.tenantId),
                eq(followUpPathEnrollments.id, stageRow.enrollmentId),
              ),
            )
        : [];

      if (input.institutionId && enrollmentRow?.institutionId && enrollmentRow.institutionId !== input.institutionId) {
        return null;
      }

      return {
        task: mapFollowUpTaskRowToRecord(taskRow),
        institutionId: stageRow?.institutionId ?? input.institutionId ?? null,
        enrollmentId: stageRow?.enrollmentId ?? null,
        stageId: stageRow?.id ?? null,
        templateKey: (enrollmentRow?.templateKey as TreatmentPathTemplateKey | undefined) ?? null,
        nodeKey: stageRow?.nodeKey ?? null,
        stageKey: stageRow?.stageKey ?? null,
      };
    },
    async listFollowUpMessageDraftsByTask(
      input: ListFollowUpMessageDraftsInput,
    ): Promise<FollowUpMessageDraft[]> {
      const rows = await database
        .select()
        .from(followUpMessageDrafts)
        .where(
          and(
            eq(followUpMessageDrafts.tenantId, input.tenantId),
            eq(followUpMessageDrafts.followUpTaskId, input.followUpTaskId),
          ),
        );
      const taskRows = await database
        .select()
        .from(followUpTasks)
        .where(and(eq(followUpTasks.tenantId, input.tenantId), eq(followUpTasks.id, input.followUpTaskId)));
      const taskRow = taskRows[0];

      if (!taskRow) return [];

      return rows
        .filter((row) => {
          if (row.tenantId !== input.tenantId) return false;
          if (input.institutionId && row.institutionId && row.institutionId !== input.institutionId) return false;
          return true;
        })
        .map((row) => mapFollowUpMessageDraftRowToRecord({ row, task: taskRow }));
    },
    async getFollowUpMessageDraftByTenant(
      input: FollowUpMessageDraftLookupInput,
    ): Promise<FollowUpMessageDraft | null> {
      const [row] = await database
        .select()
        .from(followUpMessageDrafts)
        .where(and(eq(followUpMessageDrafts.tenantId, input.tenantId), eq(followUpMessageDrafts.id, input.draftId)));

      if (!row) return null;
      if (input.institutionId && row.institutionId && row.institutionId !== input.institutionId) return null;

      const [taskRow] = await database
        .select()
        .from(followUpTasks)
        .where(and(eq(followUpTasks.tenantId, input.tenantId), eq(followUpTasks.id, row.followUpTaskId)));

      return taskRow ? mapFollowUpMessageDraftRowToRecord({ row, task: taskRow }) : null;
    },
    async createFollowUpMessageDraft(
      input: CreateFollowUpMessageDraftInput,
    ): Promise<CreateFollowUpMessageDraftResult> {
      const existing = await database
        .select()
        .from(followUpMessageDrafts)
        .where(
          and(
            eq(followUpMessageDrafts.tenantId, input.tenantId),
            eq(followUpMessageDrafts.followUpTaskId, input.followUpTaskId),
          ),
        );
      const activeDraft = existing.find((row) => row.status !== 'cancelled');
      if (activeDraft) {
        return {
          kind: 'conflict',
          resourceId: activeDraft.id,
          reason: 'follow_up_message_draft_exists',
        };
      }

      const [row] = await database
        .insert(followUpMessageDrafts)
        .values(followUpMessageDraftInsertValues(input))
        .returning();
      const draft = await this.getFollowUpMessageDraftByTenant({
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        draftId: row.id,
      });

      if (draft) {
        return { kind: 'created', draft };
      }

      const [taskRow] = await database
        .select()
        .from(followUpTasks)
        .where(
          and(
            eq(followUpTasks.tenantId, input.tenantId),
            eq(followUpTasks.id, input.followUpTaskId),
          ),
        );

      if (!taskRow) {
        throw new Error('follow_up_task_missing_after_message_draft_insert');
      }

      return { kind: 'created', draft: mapFollowUpMessageDraftRowToRecord({ row, task: taskRow }) };
    },
    async updateFollowUpMessageDraftContent(input: {
      tenantId: string;
      institutionId?: string | null;
      draftId: string;
      editedContent: string;
      safePreview: string;
      safeReasonCode: FollowUpMessageSafeReasonCode;
      occurredAt: string;
    }): Promise<UpdateFollowUpMessageDraftContentResult> {
      const current = await this.getFollowUpMessageDraftByTenant(input);
      if (!current) return { kind: 'not_found' };
      if (current.status !== 'draft') {
        return { kind: 'conflict', resourceId: current.id, reason: 'follow_up_message_draft_not_draft' };
      }

      const [row] = await database
        .update(followUpMessageDrafts)
        .set({
          editedContent: input.editedContent,
          safePreview: input.safePreview,
          safeReasonCode: input.safeReasonCode,
          updatedAt: new Date(input.occurredAt),
        })
        .where(
          and(
            eq(followUpMessageDrafts.tenantId, input.tenantId),
            eq(followUpMessageDrafts.id, input.draftId),
            eq(followUpMessageDrafts.status, 'draft'),
          ),
        )
        .returning();

      if (!row) return { kind: 'conflict', resourceId: current.id, reason: 'follow_up_message_draft_not_draft' };
      const draft = await this.getFollowUpMessageDraftByTenant(input);
      return draft ? { kind: 'updated', draft } : { kind: 'not_found' };
    },
    async approveFollowUpMessageDraft(input: {
      tenantId: string;
      institutionId?: string | null;
      draftId: string;
      actorId: string;
      occurredAt: string;
    }): Promise<FollowUpMessageDraftTransitionResult> {
      const current = await this.getFollowUpMessageDraftByTenant(input);
      if (!current) return { kind: 'not_found' };
      if (current.status !== 'draft') {
        return { kind: 'conflict', resourceId: current.id, reason: 'follow_up_message_draft_not_draft' };
      }

      const [row] = await database
        .update(followUpMessageDrafts)
        .set({
          status: 'approved',
          approvedBy: input.actorId,
          approvedAt: new Date(input.occurredAt),
          safeReasonCode: 'draft_approved',
          updatedAt: new Date(input.occurredAt),
        })
        .where(
          and(
            eq(followUpMessageDrafts.tenantId, input.tenantId),
            eq(followUpMessageDrafts.id, input.draftId),
            eq(followUpMessageDrafts.status, 'draft'),
          ),
        )
        .returning();
      if (!row) return { kind: 'conflict', resourceId: current.id, reason: 'follow_up_message_draft_not_draft' };
      const draft = await this.getFollowUpMessageDraftByTenant(input);
      return draft ? { kind: 'updated', draft } : { kind: 'not_found' };
    },
    async rejectFollowUpMessageDraft(input: {
      tenantId: string;
      institutionId?: string | null;
      draftId: string;
      actorId: string;
      occurredAt: string;
    }): Promise<FollowUpMessageDraftTransitionResult> {
      const current = await this.getFollowUpMessageDraftByTenant(input);
      if (!current) return { kind: 'not_found' };
      if (current.status !== 'draft') {
        return { kind: 'conflict', resourceId: current.id, reason: 'follow_up_message_draft_not_draft' };
      }

      const [row] = await database
        .update(followUpMessageDrafts)
        .set({
          status: 'rejected',
          rejectedBy: input.actorId,
          rejectedAt: new Date(input.occurredAt),
          safeReasonCode: 'draft_rejected',
          updatedAt: new Date(input.occurredAt),
        })
        .where(
          and(
            eq(followUpMessageDrafts.tenantId, input.tenantId),
            eq(followUpMessageDrafts.id, input.draftId),
            eq(followUpMessageDrafts.status, 'draft'),
          ),
        )
        .returning();
      if (!row) return { kind: 'conflict', resourceId: current.id, reason: 'follow_up_message_draft_not_draft' };
      const draft = await this.getFollowUpMessageDraftByTenant(input);
      return draft ? { kind: 'updated', draft } : { kind: 'not_found' };
    },
    async markFollowUpMessageDraftAsSent(input: {
      tenantId: string;
      institutionId?: string | null;
      draftId: string;
      actorId: string;
      occurredAt: string;
    }): Promise<FollowUpMessageDraftTransitionResult> {
      const current = await this.getFollowUpMessageDraftByTenant(input);
      if (!current) return { kind: 'not_found' };
      if (current.status !== 'approved') {
        return { kind: 'conflict', resourceId: current.id, reason: 'follow_up_message_draft_not_approved' };
      }

      const [row] = await database
        .update(followUpMessageDrafts)
        .set({
          status: 'marked_sent',
          markedSentBy: input.actorId,
          markedSentAt: new Date(input.occurredAt),
          safeReasonCode: 'draft_marked_sent',
          updatedAt: new Date(input.occurredAt),
        })
        .where(
          and(
            eq(followUpMessageDrafts.tenantId, input.tenantId),
            eq(followUpMessageDrafts.id, input.draftId),
            eq(followUpMessageDrafts.status, 'approved'),
          ),
        )
        .returning();
      if (!row) return { kind: 'conflict', resourceId: current.id, reason: 'follow_up_message_draft_not_approved' };
      const draft = await this.getFollowUpMessageDraftByTenant(input);
      return draft ? { kind: 'updated', draft } : { kind: 'not_found' };
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
