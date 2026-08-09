import { and, eq } from 'drizzle-orm';
import {
  CareFollowUpMessageDraftAtomicWriteError,
  type CareFollowUpMessageDraftRecord,
  type CareFollowUpMessageSafeReasonCode,
  type CreateCareFollowUpMessageDraftResult,
  type FollowUpMessageDraftCommandRepository,
  type TransitionCareFollowUpMessageDraftResult,
  type UpdateCareFollowUpMessageDraftContentResult,
  type UpdateControlledReachOutMetadataResult,
} from '@/modules/care/application/follow-up-message-draft-command-service';
import type { TenantDatabase } from '@/server/db/client';
import {
  customers,
  followUpCustomerTimelineEvents,
  followUpMessageDrafts,
  followUpPathEnrollments,
  followUpPathStages,
  followUpTasks,
} from '@/server/db/schema';

type DraftRow = typeof followUpMessageDrafts.$inferSelect;
type TaskRow = typeof followUpTasks.$inferSelect;

type LifecycleEventType =
  | 'message_draft_created'
  | 'message_draft_updated'
  | 'message_draft_approved'
  | 'message_draft_rejected'
  | 'message_draft_marked_sent';

const lifecycleTitle: Record<LifecycleEventType, string> = {
  message_draft_created: '消息草稿已生成',
  message_draft_updated: '消息草稿已编辑',
  message_draft_approved: '消息草稿已人工确认',
  message_draft_rejected: '消息草稿已拒绝',
  message_draft_marked_sent: '消息草稿标记已人工发送',
};

function mapDraft(row: DraftRow, task: TaskRow, institutionId: string): CareFollowUpMessageDraftRecord | null {
  if (row.tenantId !== task.tenantId || row.institutionId !== institutionId || task.institutionId !== institutionId) return null;
  if (row.followUpTaskId !== task.id || row.customerId !== task.customerId) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    institutionId,
    followUpTaskId: row.followUpTaskId,
    enrollmentId: row.enrollmentId,
    stageId: row.stageId,
    customerId: row.customerId,
    customerDisplayName: task.customerDisplayName,
    templateId: row.templateId,
    channelType: 'manual',
    status: row.status,
    draftContent: row.draftContent,
    editedContent: row.editedContent,
    safePreview: row.safePreview,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedBy: row.rejectedBy,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    markedSentBy: row.markedSentBy,
    markedSentAt: row.markedSentAt?.toISOString() ?? null,
    safeReasonCode: row.safeReasonCode as CareFollowUpMessageSafeReasonCode,
    metadataJson: row.metadataJson,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function customerOwned(database: TenantDatabase, input: { tenantId: string; institutionId: string; customerId: string }) {
  const [row] = await database.select({ id: customers.id }).from(customers).where(and(
    eq(customers.tenantId, input.tenantId),
    eq(customers.institutionId, input.institutionId),
    eq(customers.id, input.customerId),
  ));
  return Boolean(row);
}

async function loadOwnedDraft(database: TenantDatabase, input: { tenantId: string; institutionId: string; draftId: string }) {
  const [row] = await database.select().from(followUpMessageDrafts).where(and(
    eq(followUpMessageDrafts.tenantId, input.tenantId),
    eq(followUpMessageDrafts.institutionId, input.institutionId),
    eq(followUpMessageDrafts.id, input.draftId),
  ));
  if (!row) return null;
  const [task] = await database.select().from(followUpTasks).where(and(
    eq(followUpTasks.tenantId, input.tenantId),
    eq(followUpTasks.institutionId, input.institutionId),
    eq(followUpTasks.id, row.followUpTaskId),
    eq(followUpTasks.customerId, row.customerId),
  ));
  if (!task || !(await customerOwned(database, { ...input, customerId: row.customerId }))) return null;
  const draft = mapDraft(row, task, input.institutionId);
  return draft ? { row, task, draft } : null;
}

async function validatePathScope(database: TenantDatabase, input: {
  tenantId: string;
  institutionId: string;
  customerId: string;
  followUpTaskId: string;
  enrollmentId: string | null;
  stageId: string | null;
}) {
  if ((input.enrollmentId === null) !== (input.stageId === null)) return false;
  if (!input.enrollmentId || !input.stageId) return true;
  const [enrollment] = await database.select({ id: followUpPathEnrollments.id }).from(followUpPathEnrollments).where(and(
    eq(followUpPathEnrollments.tenantId, input.tenantId),
    eq(followUpPathEnrollments.institutionId, input.institutionId),
    eq(followUpPathEnrollments.id, input.enrollmentId),
    eq(followUpPathEnrollments.customerId, input.customerId),
  ));
  if (!enrollment) return false;
  const [stage] = await database.select({ id: followUpPathStages.id }).from(followUpPathStages).where(and(
    eq(followUpPathStages.tenantId, input.tenantId),
    eq(followUpPathStages.institutionId, input.institutionId),
    eq(followUpPathStages.id, input.stageId),
    eq(followUpPathStages.enrollmentId, input.enrollmentId),
    eq(followUpPathStages.followUpTaskId, input.followUpTaskId),
  ));
  return Boolean(stage);
}

async function requireLifecycleTimeline(database: TenantDatabase, input: {
  draft: CareFollowUpMessageDraftRecord;
  eventType: LifecycleEventType;
  actorRole: string;
  occurredAt: string;
}) {
  const sourceId = `${input.draft.id}:${input.eventType}`;
  const where = and(
    eq(followUpCustomerTimelineEvents.tenantId, input.draft.tenantId),
    eq(followUpCustomerTimelineEvents.institutionId, input.draft.institutionId),
    eq(followUpCustomerTimelineEvents.customerId, input.draft.customerId),
    eq(followUpCustomerTimelineEvents.sourceType, 'message_draft'),
    eq(followUpCustomerTimelineEvents.sourceId, sourceId),
    eq(followUpCustomerTimelineEvents.eventType, input.eventType),
  );
  const [existing] = await database.select({ id: followUpCustomerTimelineEvents.id }).from(followUpCustomerTimelineEvents).where(where);
  if (existing) return;
  const occurredAt = new Date(input.occurredAt);
  const title = lifecycleTitle[input.eventType];
  const [created] = await database.insert(followUpCustomerTimelineEvents).values({
    id: globalThis.crypto.randomUUID(),
    tenantId: input.draft.tenantId,
    institutionId: input.draft.institutionId,
    customerId: input.draft.customerId,
    sourceType: 'message_draft',
    sourceId,
    eventType: input.eventType,
    eventTitle: title,
    safeSummary: `${title}：${input.draft.safePreview}。标记已发送仅代表人工记录，不代表系统自动发送。`,
    riskLevel: null,
    occurredAt,
    safeActorRole: input.actorRole,
    safeReasonCode: input.eventType,
    metadataJson: {
      status: input.draft.status,
      channelType: input.draft.channelType,
      followUpTaskId: input.draft.followUpTaskId,
      forbidAutoSend: true,
    },
    createdAt: occurredAt,
    updatedAt: occurredAt,
  }).onConflictDoNothing().returning({ id: followUpCustomerTimelineEvents.id });
  if (created) return;
  const [concurrent] = await database.select({ id: followUpCustomerTimelineEvents.id }).from(followUpCustomerTimelineEvents).where(where);
  if (!concurrent) throw new CareFollowUpMessageDraftAtomicWriteError(input.draft.id);
}

function conflictNotDraft(resourceId: string): TransitionCareFollowUpMessageDraftResult {
  return { kind: 'conflict', resourceId, reason: 'follow_up_message_draft_not_draft' };
}

export function createFollowUpMessageDraftCommandRepository(database: TenantDatabase): FollowUpMessageDraftCommandRepository {
  return Object.freeze({
    async createDraftWithTimeline(
      input: Parameters<FollowUpMessageDraftCommandRepository['createDraftWithTimeline']>[0],
    ): Promise<CreateCareFollowUpMessageDraftResult> {
      const lockedTasks = await database.select().from(followUpTasks).where(and(
        eq(followUpTasks.tenantId, input.tenantId),
        eq(followUpTasks.institutionId, input.institutionId),
        eq(followUpTasks.id, input.draft.followUpTaskId),
        eq(followUpTasks.customerId, input.draft.customerId),
      )).for('update');
      const task = lockedTasks[0];
      if (!task) return { kind: 'not_found_or_not_owned' };
      if (!(await customerOwned(database, { tenantId: input.tenantId, institutionId: input.institutionId, customerId: input.draft.customerId }))) {
        return { kind: 'not_found_or_not_owned' };
      }
      if (!(await validatePathScope(database, {
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        customerId: input.draft.customerId,
        followUpTaskId: input.draft.followUpTaskId,
        enrollmentId: input.draft.enrollmentId,
        stageId: input.draft.stageId,
      }))) return { kind: 'not_found_or_not_owned' };

      const existing = await database.select().from(followUpMessageDrafts).where(and(
        eq(followUpMessageDrafts.tenantId, input.tenantId),
        eq(followUpMessageDrafts.institutionId, input.institutionId),
        eq(followUpMessageDrafts.followUpTaskId, input.draft.followUpTaskId),
      ));
      const active = existing.find((row) => row.status !== 'cancelled');
      if (active) return { kind: 'conflict', resourceId: active.id, reason: 'follow_up_message_draft_exists' };

      const [row] = await database.insert(followUpMessageDrafts).values({
        id: input.draft.id,
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        followUpTaskId: input.draft.followUpTaskId,
        enrollmentId: input.draft.enrollmentId,
        stageId: input.draft.stageId,
        customerId: input.draft.customerId,
        templateId: input.draft.templateId,
        channelType: 'manual',
        status: 'draft',
        draftContent: input.draft.draftContent,
        editedContent: input.draft.editedContent,
        safePreview: input.draft.safePreview,
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        markedSentBy: null,
        markedSentAt: null,
        safeReasonCode: input.draft.safeReasonCode,
        metadataJson: input.draft.metadataJson,
        createdAt: new Date(input.draft.createdAt),
        updatedAt: new Date(input.draft.updatedAt),
      }).returning();
      if (!row) return { kind: 'conflict', resourceId: input.draft.id, reason: 'follow_up_message_draft_exists' };
      const draft = mapDraft(row, task, input.institutionId);
      if (!draft) return { kind: 'not_found_or_not_owned' };
      await requireLifecycleTimeline(database, { draft, eventType: 'message_draft_created', actorRole: input.actorRole, occurredAt: input.draft.createdAt });
      return { kind: 'created', draft };
    },

    async updateDraftContentWithTimeline(
      input: Parameters<FollowUpMessageDraftCommandRepository['updateDraftContentWithTimeline']>[0],
    ): Promise<UpdateCareFollowUpMessageDraftContentResult> {
      const loaded = await loadOwnedDraft(database, input);
      if (!loaded) return { kind: 'not_found_or_not_owned' };
      if (loaded.draft.status !== 'draft') {
        return { kind: 'conflict', resourceId: loaded.draft.id, reason: 'follow_up_message_draft_not_draft' };
      }
      const [row] = await database.update(followUpMessageDrafts).set({
        editedContent: input.editedContent,
        safePreview: input.safePreview,
        safeReasonCode: input.safeReasonCode,
        updatedAt: new Date(input.occurredAt),
      }).where(and(
        eq(followUpMessageDrafts.tenantId, input.tenantId),
        eq(followUpMessageDrafts.institutionId, input.institutionId),
        eq(followUpMessageDrafts.id, input.draftId),
        eq(followUpMessageDrafts.status, 'draft'),
        eq(followUpMessageDrafts.updatedAt, new Date(input.expectedUpdatedAt)),
      )).returning();
      if (!row) return { kind: 'conflict', resourceId: input.draftId, reason: 'follow_up_message_draft_not_draft' };
      const draft = mapDraft(row, loaded.task, input.institutionId);
      if (!draft) return { kind: 'not_found_or_not_owned' };
      await requireLifecycleTimeline(database, { draft, eventType: 'message_draft_updated', actorRole: input.actorRole, occurredAt: input.occurredAt });
      return { kind: 'updated', draft };
    },

    async approveDraftWithTimeline(
      input: Parameters<FollowUpMessageDraftCommandRepository['approveDraftWithTimeline']>[0],
    ): Promise<TransitionCareFollowUpMessageDraftResult> {
      const loaded = await loadOwnedDraft(database, input);
      if (!loaded) return { kind: 'not_found_or_not_owned' };
      if (loaded.draft.status !== 'draft') return conflictNotDraft(input.draftId);
      const [row] = await database.update(followUpMessageDrafts).set({
        status: 'approved', approvedBy: input.actorId, approvedAt: new Date(input.occurredAt),
        safeReasonCode: 'draft_approved', updatedAt: new Date(input.occurredAt),
      }).where(and(
        eq(followUpMessageDrafts.tenantId, input.tenantId), eq(followUpMessageDrafts.institutionId, input.institutionId),
        eq(followUpMessageDrafts.id, input.draftId), eq(followUpMessageDrafts.status, 'draft'),
        eq(followUpMessageDrafts.updatedAt, new Date(input.expectedUpdatedAt)),
      )).returning();
      if (!row) return conflictNotDraft(input.draftId);
      const draft = mapDraft(row, loaded.task, input.institutionId);
      if (!draft) return { kind: 'not_found_or_not_owned' };
      await requireLifecycleTimeline(database, { draft, eventType: 'message_draft_approved', actorRole: input.actorRole, occurredAt: input.occurredAt });
      return { kind: 'updated', draft };
    },

    async rejectDraftWithTimeline(
      input: Parameters<FollowUpMessageDraftCommandRepository['rejectDraftWithTimeline']>[0],
    ): Promise<TransitionCareFollowUpMessageDraftResult> {
      const loaded = await loadOwnedDraft(database, input);
      if (!loaded) return { kind: 'not_found_or_not_owned' };
      if (loaded.draft.status !== 'draft') return conflictNotDraft(input.draftId);
      const [row] = await database.update(followUpMessageDrafts).set({
        status: 'rejected', rejectedBy: input.actorId, rejectedAt: new Date(input.occurredAt),
        safeReasonCode: 'draft_rejected', updatedAt: new Date(input.occurredAt),
      }).where(and(
        eq(followUpMessageDrafts.tenantId, input.tenantId), eq(followUpMessageDrafts.institutionId, input.institutionId),
        eq(followUpMessageDrafts.id, input.draftId), eq(followUpMessageDrafts.status, 'draft'),
        eq(followUpMessageDrafts.updatedAt, new Date(input.expectedUpdatedAt)),
      )).returning();
      if (!row) return conflictNotDraft(input.draftId);
      const draft = mapDraft(row, loaded.task, input.institutionId);
      if (!draft) return { kind: 'not_found_or_not_owned' };
      await requireLifecycleTimeline(database, { draft, eventType: 'message_draft_rejected', actorRole: input.actorRole, occurredAt: input.occurredAt });
      return { kind: 'updated', draft };
    },

    async markDraftSentWithTimeline(
      input: Parameters<FollowUpMessageDraftCommandRepository['markDraftSentWithTimeline']>[0],
    ): Promise<TransitionCareFollowUpMessageDraftResult> {
      const loaded = await loadOwnedDraft(database, input);
      if (!loaded) return { kind: 'not_found_or_not_owned' };
      if (loaded.draft.status !== 'approved') {
        return { kind: 'conflict', resourceId: input.draftId, reason: 'follow_up_message_draft_not_approved' };
      }
      const [row] = await database.update(followUpMessageDrafts).set({
        status: 'marked_sent', markedSentBy: input.actorId, markedSentAt: new Date(input.occurredAt),
        safeReasonCode: 'draft_marked_sent', updatedAt: new Date(input.occurredAt),
      }).where(and(
        eq(followUpMessageDrafts.tenantId, input.tenantId), eq(followUpMessageDrafts.institutionId, input.institutionId),
        eq(followUpMessageDrafts.id, input.draftId), eq(followUpMessageDrafts.status, 'approved'),
        eq(followUpMessageDrafts.updatedAt, new Date(input.expectedUpdatedAt)),
      )).returning();
      if (!row) return { kind: 'conflict', resourceId: input.draftId, reason: 'follow_up_message_draft_not_approved' };
      const draft = mapDraft(row, loaded.task, input.institutionId);
      if (!draft) return { kind: 'not_found_or_not_owned' };
      await requireLifecycleTimeline(database, { draft, eventType: 'message_draft_marked_sent', actorRole: input.actorRole, occurredAt: input.occurredAt });
      return { kind: 'updated', draft };
    },

    async updateControlledReachOutMetadata(
      input: Parameters<FollowUpMessageDraftCommandRepository['updateControlledReachOutMetadata']>[0],
    ): Promise<UpdateControlledReachOutMetadataResult> {
      const loaded = await loadOwnedDraft(database, input);
      if (!loaded) return { kind: 'not_found_or_not_owned' };
      if (loaded.draft.status !== 'approved') return { kind: 'conflict', resourceId: input.draftId, reason: 'conflict' };
      const [row] = await database.update(followUpMessageDrafts).set({
        metadataJson: input.metadataJson,
        updatedAt: new Date(input.occurredAt),
      }).where(and(
        eq(followUpMessageDrafts.tenantId, input.tenantId),
        eq(followUpMessageDrafts.institutionId, input.institutionId),
        eq(followUpMessageDrafts.id, input.draftId),
        eq(followUpMessageDrafts.status, 'approved'),
        eq(followUpMessageDrafts.updatedAt, new Date(input.expectedUpdatedAt)),
        eq(followUpMessageDrafts.metadataJson, input.expectedMetadataJson),
      )).returning();
      if (!row) return { kind: 'conflict', resourceId: input.draftId, reason: 'conflict' };
      const draft = mapDraft(row, loaded.task, input.institutionId);
      return draft ? { kind: 'updated', draft } : { kind: 'not_found_or_not_owned' };
    },
  });
}
