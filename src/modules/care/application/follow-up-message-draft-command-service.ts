export const careFollowUpMessageDraftStatuses = [
  'draft', 'approved', 'rejected', 'marked_sent', 'cancelled',
] as const;
export type CareFollowUpMessageDraftStatus = (typeof careFollowUpMessageDraftStatuses)[number];
export type CareFollowUpMessageSafeReasonCode =
  | 'template_generated'
  | 'fallback_generated'
  | 'draft_content_updated'
  | 'draft_approved'
  | 'draft_rejected'
  | 'draft_marked_sent'
  | 'draft_cancelled';

export type CareFollowUpMessageAttribution = Readonly<{
  tenantId: string;
  institutionId: string;
}>;

export type CareFollowUpMessageDraftRecord = CareFollowUpMessageAttribution & Readonly<{
  id: string;
  followUpTaskId: string;
  enrollmentId: string | null;
  stageId: string | null;
  customerId: string;
  customerDisplayName: string;
  templateId: string | null;
  channelType: 'manual';
  status: CareFollowUpMessageDraftStatus;
  draftContent: string;
  editedContent: string | null;
  safePreview: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  markedSentBy: string | null;
  markedSentAt: string | null;
  safeReasonCode: CareFollowUpMessageSafeReasonCode;
  metadataJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}>;

export type CreateCareFollowUpMessageDraftCommand = Readonly<{
  attribution: CareFollowUpMessageAttribution;
  actorRole: string;
  draft: Readonly<{
    id: string;
    followUpTaskId: string;
    enrollmentId: string | null;
    stageId: string | null;
    customerId: string;
    templateId: string | null;
    channelType: 'manual';
    status: 'draft';
    draftContent: string;
    editedContent: string | null;
    safePreview: string;
    approvedBy: null;
    approvedAt: null;
    rejectedBy: null;
    rejectedAt: null;
    markedSentBy: null;
    markedSentAt: null;
    safeReasonCode: Extract<CareFollowUpMessageSafeReasonCode, 'template_generated' | 'fallback_generated'>;
    metadataJson: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }>;
}>;

export type UpdateCareFollowUpMessageDraftContentCommand = Readonly<{
  attribution: CareFollowUpMessageAttribution;
  actorRole: string;
  draftId: string;
  expectedUpdatedAt: string;
  editedContent: string;
  safePreview: string;
  safeReasonCode: 'draft_content_updated';
  occurredAt: string;
}>;

export type TransitionCareFollowUpMessageDraftCommand = Readonly<{
  attribution: CareFollowUpMessageAttribution;
  actorId: string;
  actorRole: string;
  draftId: string;
  expectedUpdatedAt: string;
  occurredAt: string;
}>;

export type UpdateControlledReachOutMetadataCommand = Readonly<{
  attribution: CareFollowUpMessageAttribution;
  draftId: string;
  expectedUpdatedAt: string;
  expectedMetadataJson: Record<string, unknown>;
  metadataJson: Record<string, unknown>;
  occurredAt: string;
}>;

export type CreateCareFollowUpMessageDraftResult =
  | { kind: 'created'; draft: CareFollowUpMessageDraftRecord }
  | { kind: 'not_found_or_not_owned' }
  | { kind: 'conflict'; resourceId: string; reason: 'follow_up_message_draft_exists' };

export type UpdateCareFollowUpMessageDraftContentResult =
  | { kind: 'updated'; draft: CareFollowUpMessageDraftRecord }
  | { kind: 'not_found_or_not_owned' }
  | { kind: 'conflict'; resourceId: string; reason: 'follow_up_message_draft_not_draft' };

export type TransitionCareFollowUpMessageDraftResult =
  | { kind: 'updated'; draft: CareFollowUpMessageDraftRecord }
  | { kind: 'not_found_or_not_owned' }
  | {
      kind: 'conflict';
      resourceId: string;
      reason: 'follow_up_message_draft_not_draft' | 'follow_up_message_draft_not_approved';
    };

export type UpdateControlledReachOutMetadataResult =
  | { kind: 'updated'; draft: CareFollowUpMessageDraftRecord }
  | { kind: 'not_found_or_not_owned' }
  | { kind: 'conflict'; resourceId: string; reason: 'conflict' };

export interface FollowUpMessageDraftCommandRepository {
  createDraftWithTimeline(
    input: CareFollowUpMessageAttribution & Omit<CreateCareFollowUpMessageDraftCommand, 'attribution'>,
  ): Promise<CreateCareFollowUpMessageDraftResult>;
  updateDraftContentWithTimeline(
    input: CareFollowUpMessageAttribution & Omit<UpdateCareFollowUpMessageDraftContentCommand, 'attribution'>,
  ): Promise<UpdateCareFollowUpMessageDraftContentResult>;
  approveDraftWithTimeline(
    input: CareFollowUpMessageAttribution & Omit<TransitionCareFollowUpMessageDraftCommand, 'attribution'>,
  ): Promise<TransitionCareFollowUpMessageDraftResult>;
  rejectDraftWithTimeline(
    input: CareFollowUpMessageAttribution & Omit<TransitionCareFollowUpMessageDraftCommand, 'attribution'>,
  ): Promise<TransitionCareFollowUpMessageDraftResult>;
  markDraftSentWithTimeline(
    input: CareFollowUpMessageAttribution & Omit<TransitionCareFollowUpMessageDraftCommand, 'attribution'>,
  ): Promise<TransitionCareFollowUpMessageDraftResult>;
  updateControlledReachOutMetadata(
    input: CareFollowUpMessageAttribution & Omit<UpdateControlledReachOutMetadataCommand, 'attribution'>,
  ): Promise<UpdateControlledReachOutMetadataResult>;
}

export class CareFollowUpMessageDraftCommandInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CareFollowUpMessageDraftCommandInputError';
  }
}

export class CareFollowUpMessageDraftAtomicWriteError extends Error {
  readonly code: 'required_timeline_evidence_failed';
  readonly resourceId: string;
  constructor(resourceId: string) {
    super('required_timeline_evidence_failed');
    this.name = 'CareFollowUpMessageDraftAtomicWriteError';
    this.code = 'required_timeline_evidence_failed';
    this.resourceId = resourceId;
  }
}

function requireIdentifier(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new CareFollowUpMessageDraftCommandInputError(`invalid_${field}`);
  }
  return value;
}

function optionalIdentifier(value: unknown, field: string): string | null {
  if (value === null) return null;
  return requireIdentifier(value, field);
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new CareFollowUpMessageDraftCommandInputError(`invalid_${field}`);
  return value;
}

function requireIsoTimestamp(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new CareFollowUpMessageDraftCommandInputError(`invalid_${field}`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new CareFollowUpMessageDraftCommandInputError(`invalid_${field}`);
  }
  return value;
}

function copyMetadata(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CareFollowUpMessageDraftCommandInputError(`invalid_${field}`);
  }
  return { ...(value as Record<string, unknown>) };
}

function normalizeAttribution(input: CareFollowUpMessageAttribution): CareFollowUpMessageAttribution {
  return {
    tenantId: requireIdentifier(input?.tenantId, 'tenant_id'),
    institutionId: requireIdentifier(input?.institutionId, 'institution_id'),
  };
}

export function createFollowUpMessageDraftCommandService(repository: FollowUpMessageDraftCommandRepository) {
  return Object.freeze({
    async createDraftWithTimeline(input: CreateCareFollowUpMessageDraftCommand) {
      const attribution = normalizeAttribution(input.attribution);
      if (input.draft.channelType !== 'manual' || input.draft.status !== 'draft') {
        throw new CareFollowUpMessageDraftCommandInputError('invalid_message_draft_initial_state');
      }
      return repository.createDraftWithTimeline({
        ...attribution,
        actorRole: requireIdentifier(input.actorRole, 'actor_role'),
        draft: {
          id: requireIdentifier(input.draft.id, 'draft_id'),
          followUpTaskId: requireIdentifier(input.draft.followUpTaskId, 'follow_up_task_id'),
          enrollmentId: optionalIdentifier(input.draft.enrollmentId, 'enrollment_id'),
          stageId: optionalIdentifier(input.draft.stageId, 'stage_id'),
          customerId: requireIdentifier(input.draft.customerId, 'customer_id'),
          templateId: optionalIdentifier(input.draft.templateId, 'template_id'),
          channelType: 'manual',
          status: 'draft',
          draftContent: requireText(input.draft.draftContent, 'draft_content'),
          editedContent: input.draft.editedContent === null ? null : requireText(input.draft.editedContent, 'edited_content'),
          safePreview: requireText(input.draft.safePreview, 'safe_preview'),
          approvedBy: null,
          approvedAt: null,
          rejectedBy: null,
          rejectedAt: null,
          markedSentBy: null,
          markedSentAt: null,
          safeReasonCode: input.draft.safeReasonCode,
          metadataJson: copyMetadata(input.draft.metadataJson, 'metadata_json'),
          createdAt: requireIsoTimestamp(input.draft.createdAt, 'created_at'),
          updatedAt: requireIsoTimestamp(input.draft.updatedAt, 'updated_at'),
        },
      });
    },
    async updateDraftContentWithTimeline(input: UpdateCareFollowUpMessageDraftContentCommand) {
      return repository.updateDraftContentWithTimeline({
        ...normalizeAttribution(input.attribution),
        actorRole: requireIdentifier(input.actorRole, 'actor_role'),
        draftId: requireIdentifier(input.draftId, 'draft_id'),
        expectedUpdatedAt: requireIsoTimestamp(input.expectedUpdatedAt, 'expected_updated_at'),
        editedContent: requireText(input.editedContent, 'edited_content'),
        safePreview: requireText(input.safePreview, 'safe_preview'),
        safeReasonCode: 'draft_content_updated',
        occurredAt: requireIsoTimestamp(input.occurredAt, 'occurred_at'),
      });
    },
    async approveDraftWithTimeline(input: TransitionCareFollowUpMessageDraftCommand) {
      return repository.approveDraftWithTimeline({
        ...normalizeAttribution(input.attribution),
        actorId: requireIdentifier(input.actorId, 'actor_id'),
        actorRole: requireIdentifier(input.actorRole, 'actor_role'),
        draftId: requireIdentifier(input.draftId, 'draft_id'),
        expectedUpdatedAt: requireIsoTimestamp(input.expectedUpdatedAt, 'expected_updated_at'),
        occurredAt: requireIsoTimestamp(input.occurredAt, 'occurred_at'),
      });
    },
    async rejectDraftWithTimeline(input: TransitionCareFollowUpMessageDraftCommand) {
      return repository.rejectDraftWithTimeline({
        ...normalizeAttribution(input.attribution),
        actorId: requireIdentifier(input.actorId, 'actor_id'),
        actorRole: requireIdentifier(input.actorRole, 'actor_role'),
        draftId: requireIdentifier(input.draftId, 'draft_id'),
        expectedUpdatedAt: requireIsoTimestamp(input.expectedUpdatedAt, 'expected_updated_at'),
        occurredAt: requireIsoTimestamp(input.occurredAt, 'occurred_at'),
      });
    },
    async markDraftSentWithTimeline(input: TransitionCareFollowUpMessageDraftCommand) {
      return repository.markDraftSentWithTimeline({
        ...normalizeAttribution(input.attribution),
        actorId: requireIdentifier(input.actorId, 'actor_id'),
        actorRole: requireIdentifier(input.actorRole, 'actor_role'),
        draftId: requireIdentifier(input.draftId, 'draft_id'),
        expectedUpdatedAt: requireIsoTimestamp(input.expectedUpdatedAt, 'expected_updated_at'),
        occurredAt: requireIsoTimestamp(input.occurredAt, 'occurred_at'),
      });
    },
    async updateControlledReachOutMetadata(input: UpdateControlledReachOutMetadataCommand) {
      return repository.updateControlledReachOutMetadata({
        ...normalizeAttribution(input.attribution),
        draftId: requireIdentifier(input.draftId, 'draft_id'),
        expectedUpdatedAt: requireIsoTimestamp(input.expectedUpdatedAt, 'expected_updated_at'),
        expectedMetadataJson: copyMetadata(input.expectedMetadataJson, 'expected_metadata_json'),
        metadataJson: copyMetadata(input.metadataJson, 'metadata_json'),
        occurredAt: requireIsoTimestamp(input.occurredAt, 'occurred_at'),
      });
    },
  });
}
