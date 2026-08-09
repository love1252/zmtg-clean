import type { AccessContext, AccessDecision } from '@/modules/security/domain/access-control';
import { canAccessResource } from '@/modules/security/domain/access-control';
import {
  builtInFollowUpMessageTemplates,
  createMessageDraftForFollowUpTask as createMessageDraftDomain,
  mapFollowUpMessageDraftToDto,
  mapFollowUpMessageTemplateToDto,
  selectFollowUpMessageTemplate,
  updateFollowUpMessageDraftContent as updateMessageDraftContentDomain,
  type FollowUpMessageDraft,
  type FollowUpMessageDraftDto,
  type FollowUpMessageTemplateDto,
} from '@/modules/institution/domain/followup-message-drafts';
import {
  createMessageDeliveryFromApprovedDraft,
  mapMessageDeliveryToDto,
  messageDeliveryContactSafetyAuditReason,
  messageDeliveryStatusAuditReason,
  messageDeliveryWeComMockReachOutAuditReason,
  type CreateMessageDeliveryOptions,
  type MessageDeliveryDto,
} from '@/modules/institution/domain/followup-message-deliveries';
import { recordMessageDeliveryTimelineEvents } from '@/modules/institution/server/followup-customer-timeline-service';
import type { TenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import type { AuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { createAuditEvent } from '@/modules/audit/domain/audit-events';

export type FollowUpMessageForbiddenReason =
  | Extract<AccessDecision, { allowed: false }>['reason']
  | 'missing_institution';

type ServiceRepository = Pick<
  TenantBusinessRepository,
  | 'listFollowUpMessageTemplatesByTenant'
  | 'getCustomerByTenant'
  | 'getFollowUpTaskPathContextByTenant'
  | 'listFollowUpMessageDraftsByTask'
  | 'getFollowUpMessageDraftByTenant'
  | 'recordFollowUpCustomerTimelineEvent'
  | 'runCareFollowUpTransaction'
>;

export type ListFollowUpMessageTemplatesResult =
  | { kind: 'success'; templates: FollowUpMessageTemplateDto[] }
  | { kind: 'forbidden'; reason: FollowUpMessageForbiddenReason };
export type ListFollowUpMessageDraftsResult =
  | { kind: 'success'; drafts: FollowUpMessageDraftDto[] }
  | { kind: 'not_found' }
  | { kind: 'forbidden'; reason: FollowUpMessageForbiddenReason };
export type CreateFollowUpMessageDraftResult =
  | { kind: 'created'; draft: FollowUpMessageDraftDto }
  | { kind: 'not_found' }
  | { kind: 'conflict'; resourceId: string; reason: 'follow_up_message_draft_exists' }
  | { kind: 'forbidden'; reason: FollowUpMessageForbiddenReason };
export type UpdateFollowUpMessageDraftResult =
  | { kind: 'updated'; draft: FollowUpMessageDraftDto }
  | { kind: 'updated_with_delivery'; draft: FollowUpMessageDraftDto; delivery: MessageDeliveryDto; deduped: boolean }
  | { kind: 'not_found' }
  | {
      kind: 'conflict';
      resourceId: string;
      reason:
        | 'follow_up_message_draft_not_draft'
        | 'follow_up_message_draft_not_approved'
        | 'message_delivery_exists'
        | 'unsafe_follow_up_message_content';
    }
  | { kind: 'forbidden'; reason: FollowUpMessageForbiddenReason };

class FollowUpMessageApprovalBundleConflict extends Error {
  constructor(readonly resourceId: string, readonly reason: 'message_delivery_exists') {
    super(reason);
    this.name = 'FollowUpMessageApprovalBundleConflict';
  }
}

function canUseFollowUpMessage(context: AccessContext, action: 'read_own_tenant' | 'create' | 'update') {
  return canAccessResource({ context, resource: 'follow_up', action, targetTenantId: context.tenantId });
}
function hasTenant(context: AccessContext): context is AccessContext & { tenantId: string } {
  return Boolean(context.tenantId);
}
function hasInstitution(context: AccessContext): context is AccessContext & { tenantId: string; institutionId: string } {
  return Boolean(context.tenantId && context.institutionId);
}
function asLegacyDraft(draft: unknown): FollowUpMessageDraft { return draft as FollowUpMessageDraft; }

async function recordDeliveryAudit(input: {
  context: AccessContext;
  auditRepository: Pick<AuditEventRepository, 'record'>;
  deliveryId: string;
  reason:
    | ReturnType<typeof messageDeliveryStatusAuditReason>
    | ReturnType<typeof messageDeliveryContactSafetyAuditReason>
    | Exclude<ReturnType<typeof messageDeliveryWeComMockReachOutAuditReason>, null>
    | 'wecom_mock_reachout_created'
    | 'message_delivery_created';
  occurredAt: string;
}) {
  await input.auditRepository.record(createAuditEvent({
    eventId: globalThis.crypto.randomUUID(), context: input.context, resource: 'follow_up', action: 'create',
    result: 'allowed', reason: input.reason, occurredAt: input.occurredAt, resourceId: input.deliveryId,
  }));
}

async function createDeliveryEvidenceInsideCareTransaction(input: {
  context: AccessContext;
  draft: FollowUpMessageDraft;
  tenantBusinessRepository: ServiceRepository;
  careTimelineEvidencePort: NonNullable<Parameters<typeof recordMessageDeliveryTimelineEvents>[0]['careTimelineEvidencePort']>;
  auditRepository: Pick<AuditEventRepository, 'record'>;
  occurredAt: string;
  deliveryOptions?: CreateMessageDeliveryOptions;
}) {
  if (Object.prototype.hasOwnProperty.call(input.draft.metadataJson, 'messageDeliveryId')) {
    throw new FollowUpMessageApprovalBundleConflict(input.draft.id, 'message_delivery_exists');
  }
  const deliveryResult = createMessageDeliveryFromApprovedDraft({
    draft: input.draft, actorId: input.context.userId, occurredAt: input.occurredAt, options: input.deliveryOptions,
  });
  if (deliveryResult.kind !== 'created') throw new Error('approved_message_delivery_creation_failed');

  await recordMessageDeliveryTimelineEvents({
    context: input.context,
    tenantBusinessRepository: input.tenantBusinessRepository,
    careTimelineEvidencePort: input.careTimelineEvidencePort,
    delivery: deliveryResult.delivery,
    occurredAt: input.occurredAt,
  });
  await recordDeliveryAudit({ context: input.context, auditRepository: input.auditRepository, occurredAt: input.occurredAt, deliveryId: deliveryResult.delivery.id, reason: 'message_delivery_created' });
  await recordDeliveryAudit({ context: input.context, auditRepository: input.auditRepository, occurredAt: input.occurredAt, deliveryId: deliveryResult.delivery.id, reason: messageDeliveryContactSafetyAuditReason(deliveryResult.delivery) });
  const weComReason = messageDeliveryWeComMockReachOutAuditReason(deliveryResult.delivery);
  if (weComReason) {
    await recordDeliveryAudit({ context: input.context, auditRepository: input.auditRepository, occurredAt: input.occurredAt, deliveryId: deliveryResult.delivery.id, reason: 'wecom_mock_reachout_created' });
    await recordDeliveryAudit({ context: input.context, auditRepository: input.auditRepository, occurredAt: input.occurredAt, deliveryId: deliveryResult.delivery.id, reason: weComReason });
  }
  if (deliveryResult.delivery.status !== 'pending') {
    await recordDeliveryAudit({ context: input.context, auditRepository: input.auditRepository, occurredAt: input.occurredAt, deliveryId: deliveryResult.delivery.id, reason: messageDeliveryStatusAuditReason(deliveryResult.delivery.status) });
  }
  return mapMessageDeliveryToDto(deliveryResult.delivery);
}

export async function listFollowUpMessageTemplates(input: {
  context: AccessContext;
  tenantBusinessRepository: Pick<ServiceRepository, 'listFollowUpMessageTemplatesByTenant'>;
}): Promise<ListFollowUpMessageTemplatesResult> {
  const decision = canUseFollowUpMessage(input.context, 'read_own_tenant');
  if (!decision.allowed) return { kind: 'forbidden', reason: decision.reason };
  if (!hasTenant(input.context)) return { kind: 'forbidden', reason: 'missing_tenant' };
  const templates = await input.tenantBusinessRepository.listFollowUpMessageTemplatesByTenant({
    tenantId: input.context.tenantId, institutionId: input.context.institutionId ?? null,
  });
  return { kind: 'success', templates: [...templates, ...builtInFollowUpMessageTemplates].map(mapFollowUpMessageTemplateToDto) };
}

export async function createMessageDraftForFollowUpTask(input: {
  context: AccessContext;
  followUpTaskId: string;
  templateId?: string | null;
  tenantBusinessRepository: ServiceRepository;
  occurredAt: string;
}): Promise<CreateFollowUpMessageDraftResult> {
  const decision = canUseFollowUpMessage(input.context, 'create');
  if (!decision.allowed) return { kind: 'forbidden', reason: decision.reason };
  if (!hasTenant(input.context)) return { kind: 'forbidden', reason: 'missing_tenant' };
  if (!hasInstitution(input.context)) return { kind: 'forbidden', reason: 'missing_institution' };
  const scopedContext = input.context;
  const pathContext = await input.tenantBusinessRepository.getFollowUpTaskPathContextByTenant({
    tenantId: scopedContext.tenantId, institutionId: scopedContext.institutionId, followUpTaskId: input.followUpTaskId,
  });
  if (!pathContext) return { kind: 'not_found' };
  const storedTemplates = await input.tenantBusinessRepository.listFollowUpMessageTemplatesByTenant({
    tenantId: scopedContext.tenantId, institutionId: scopedContext.institutionId,
  });
  const selectedTemplate = selectFollowUpMessageTemplate({
    templates: [...storedTemplates, ...builtInFollowUpMessageTemplates], templateId: input.templateId,
    templateKey: pathContext.templateKey, nodeKey: pathContext.nodeKey,
  });
  const generated = createMessageDraftDomain({ pathContext, template: selectedTemplate, occurredAt: input.occurredAt });
  const result = await input.tenantBusinessRepository.runCareFollowUpTransaction(({ messageDraftCommandService }) =>
    messageDraftCommandService.createDraftWithTimeline({
      attribution: { tenantId: scopedContext.tenantId, institutionId: scopedContext.institutionId },
      actorRole: input.context.role,
      draft: {
        id: globalThis.crypto.randomUUID(), followUpTaskId: generated.followUpTaskId, enrollmentId: generated.enrollmentId,
        stageId: generated.stageId, customerId: generated.customerId, templateId: generated.templateId,
        channelType: 'manual', status: 'draft', draftContent: generated.draftContent, editedContent: generated.editedContent,
        safePreview: generated.safePreview, approvedBy: null, approvedAt: null, rejectedBy: null, rejectedAt: null,
        markedSentBy: null, markedSentAt: null, safeReasonCode: generated.safeReasonCode,
        metadataJson: generated.metadataJson, createdAt: generated.createdAt, updatedAt: generated.updatedAt,
      },
    }));
  if (result.kind === 'not_found_or_not_owned') return { kind: 'not_found' };
  if (result.kind === 'conflict') return result;
  return { kind: 'created', draft: mapFollowUpMessageDraftToDto(asLegacyDraft(result.draft)) };
}

export async function listMessageDraftsForFollowUpTask(input: {
  context: AccessContext;
  followUpTaskId: string;
  tenantBusinessRepository: Pick<ServiceRepository, 'getFollowUpTaskPathContextByTenant' | 'listFollowUpMessageDraftsByTask'>;
}): Promise<ListFollowUpMessageDraftsResult> {
  const decision = canUseFollowUpMessage(input.context, 'read_own_tenant');
  if (!decision.allowed) return { kind: 'forbidden', reason: decision.reason };
  if (!hasTenant(input.context)) return { kind: 'forbidden', reason: 'missing_tenant' };
  const pathContext = await input.tenantBusinessRepository.getFollowUpTaskPathContextByTenant({
    tenantId: input.context.tenantId, institutionId: input.context.institutionId ?? null, followUpTaskId: input.followUpTaskId,
  });
  if (!pathContext) return { kind: 'not_found' };
  const drafts = await input.tenantBusinessRepository.listFollowUpMessageDraftsByTask({
    tenantId: input.context.tenantId, institutionId: input.context.institutionId ?? null, followUpTaskId: input.followUpTaskId,
  });
  return { kind: 'success', drafts: drafts.map(mapFollowUpMessageDraftToDto) };
}

export async function updateMessageDraftContent(input: {
  context: AccessContext;
  draftId: string;
  content: string;
  tenantBusinessRepository: ServiceRepository;
  occurredAt: string;
}): Promise<UpdateFollowUpMessageDraftResult> {
  const decision = canUseFollowUpMessage(input.context, 'update');
  if (!decision.allowed) return { kind: 'forbidden', reason: decision.reason };
  if (!hasTenant(input.context)) return { kind: 'forbidden', reason: 'missing_tenant' };
  if (!hasInstitution(input.context)) return { kind: 'forbidden', reason: 'missing_institution' };
  const scopedContext = input.context;
  const current = await input.tenantBusinessRepository.getFollowUpMessageDraftByTenant({
    tenantId: scopedContext.tenantId, institutionId: scopedContext.institutionId, draftId: input.draftId,
  });
  if (!current) return { kind: 'not_found' };
  const domainResult = updateMessageDraftContentDomain({ draft: current, content: input.content, occurredAt: input.occurredAt });
  if (domainResult.kind === 'unsafe_content') {
    return { kind: 'conflict', resourceId: current.id, reason: 'unsafe_follow_up_message_content' };
  }
  if (domainResult.kind === 'invalid_status') {
    return { kind: 'conflict', resourceId: current.id, reason: 'follow_up_message_draft_not_draft' };
  }
  const result = await input.tenantBusinessRepository.runCareFollowUpTransaction(({ messageDraftCommandService }) =>
    messageDraftCommandService.updateDraftContentWithTimeline({
      attribution: { tenantId: scopedContext.tenantId, institutionId: scopedContext.institutionId },
      actorRole: input.context.role, draftId: input.draftId, expectedUpdatedAt: current.updatedAt,
      editedContent: domainResult.draft.editedContent ?? domainResult.draft.draftContent,
      safePreview: domainResult.draft.safePreview, safeReasonCode: 'draft_content_updated', occurredAt: input.occurredAt,
    }));
  if (result.kind === 'not_found_or_not_owned') return { kind: 'not_found' };
  if (result.kind === 'conflict') return result;
  return { kind: 'updated', draft: mapFollowUpMessageDraftToDto(asLegacyDraft(result.draft)) };
}

export async function approveMessageDraft(input: {
  context: AccessContext;
  draftId: string;
  tenantBusinessRepository: ServiceRepository;
  auditRepository?: Pick<AuditEventRepository, 'record'>;
  occurredAt: string;
  deliveryOptions?: CreateMessageDeliveryOptions;
}): Promise<UpdateFollowUpMessageDraftResult> {
  return transitionMessageDraft({ ...input, operation: 'approve' });
}
export async function rejectMessageDraft(input: {
  context: AccessContext; draftId: string; tenantBusinessRepository: ServiceRepository; occurredAt: string;
}): Promise<UpdateFollowUpMessageDraftResult> {
  return transitionMessageDraft({ ...input, operation: 'reject' });
}
export async function markMessageDraftAsSent(input: {
  context: AccessContext; draftId: string; tenantBusinessRepository: ServiceRepository; occurredAt: string;
}): Promise<UpdateFollowUpMessageDraftResult> {
  return transitionMessageDraft({ ...input, operation: 'mark_sent' });
}

async function transitionMessageDraft(input: {
  context: AccessContext;
  draftId: string;
  tenantBusinessRepository: ServiceRepository;
  occurredAt: string;
  operation: 'approve' | 'reject' | 'mark_sent';
  auditRepository?: Pick<AuditEventRepository, 'record'>;
  deliveryOptions?: CreateMessageDeliveryOptions;
}): Promise<UpdateFollowUpMessageDraftResult> {
  const decision = canUseFollowUpMessage(input.context, 'update');
  if (!decision.allowed) return { kind: 'forbidden', reason: decision.reason };
  if (!hasTenant(input.context)) return { kind: 'forbidden', reason: 'missing_tenant' };
  if (!hasInstitution(input.context)) return { kind: 'forbidden', reason: 'missing_institution' };
  const scopedContext = input.context;
  const current = await input.tenantBusinessRepository.getFollowUpMessageDraftByTenant({
    tenantId: scopedContext.tenantId, institutionId: scopedContext.institutionId, draftId: input.draftId,
  });
  if (!current) return { kind: 'not_found' };
  try {
    return await input.tenantBusinessRepository.runCareFollowUpTransaction(async ({
      messageDraftCommandService, commandService, auditRepository,
    }) => {
      const command = {
        attribution: { tenantId: scopedContext.tenantId, institutionId: scopedContext.institutionId },
        actorId: scopedContext.userId, actorRole: scopedContext.role, draftId: input.draftId,
        expectedUpdatedAt: current.updatedAt, occurredAt: input.occurredAt,
      };
      const result = input.operation === 'approve'
        ? await messageDraftCommandService.approveDraftWithTimeline(command)
        : input.operation === 'reject'
          ? await messageDraftCommandService.rejectDraftWithTimeline(command)
          : await messageDraftCommandService.markDraftSentWithTimeline(command);
      if (result.kind === 'not_found_or_not_owned') return { kind: 'not_found' as const };
      if (result.kind === 'conflict') return result;
      const draft = asLegacyDraft(result.draft);
      const draftDto = mapFollowUpMessageDraftToDto(draft);
      if (input.operation !== 'approve') return { kind: 'updated' as const, draft: draftDto };
      const delivery = await createDeliveryEvidenceInsideCareTransaction({
        context: scopedContext, draft, tenantBusinessRepository: input.tenantBusinessRepository,
        careTimelineEvidencePort: commandService, auditRepository, occurredAt: input.occurredAt,
        deliveryOptions: input.deliveryOptions,
      });
      return { kind: 'updated_with_delivery' as const, draft: draftDto, delivery, deduped: false };
    });
  } catch (error) {
    if (error instanceof FollowUpMessageApprovalBundleConflict) {
      return { kind: 'conflict', resourceId: error.resourceId, reason: error.reason };
    }
    throw error;
  }
}
