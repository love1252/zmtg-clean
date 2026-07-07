import type { AccessContext } from '@/modules/security/domain/access-control';
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
  messageDeliveryStatusAuditReason,
  type CreateMessageDeliveryOptions,
  type MessageDeliveryDto,
} from '@/modules/institution/domain/followup-message-deliveries';
import {
  recordMessageDeliveryTimelineEvents,
  recordMessageDraftTimelineEvent,
} from '@/modules/institution/server/followup-customer-timeline-service';
import type { TenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import type { AuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { createAuditEvent } from '@/modules/audit/domain/audit-events';

export type FollowUpMessageForbiddenReason =
  | 'missing_tenant'
  | 'cross_tenant_denied'
  | 'role_denied'
  | 'sensitive_detail_denied';

type ServiceRepository = Pick<
  TenantBusinessRepository,
  | 'listFollowUpMessageTemplatesByTenant'
  | 'getCustomerByTenant'
  | 'getFollowUpTaskPathContextByTenant'
  | 'createFollowUpMessageDraft'
  | 'listFollowUpMessageDraftsByTask'
  | 'getFollowUpMessageDraftByTenant'
  | 'updateFollowUpMessageDraftContent'
  | 'approveFollowUpMessageDraft'
  | 'rejectFollowUpMessageDraft'
  | 'markFollowUpMessageDraftAsSent'
  | 'recordFollowUpCustomerTimelineEvent'
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

function isMessageDeliveryConflictReason(reason: string) {
  return reason === 'message_delivery_exists';
}

function hasMessageDeliveryMetadata(draft: { metadataJson: Record<string, unknown> }) {
  return Object.prototype.hasOwnProperty.call(draft.metadataJson, 'messageDeliveryId');
}

async function recordDeliveryAudit(input: {
  context: AccessContext;
  auditRepository?: Pick<AuditEventRepository, 'record'>;
  deliveryId: string;
  reason: ReturnType<typeof messageDeliveryStatusAuditReason> | 'message_delivery_created';
  occurredAt: string;
}) {
  if (!input.auditRepository) return;

  await input.auditRepository.record(createAuditEvent({
    eventId: globalThis.crypto.randomUUID(),
    context: input.context,
    resource: 'follow_up',
    action: 'create',
    result: 'allowed',
    reason: input.reason,
    occurredAt: input.occurredAt,
    resourceId: input.deliveryId,
  }));
}

async function createDeliveryAfterDraftApproval(input: {
  context: AccessContext;
  draft: FollowUpMessageDraft;
  tenantBusinessRepository: Pick<ServiceRepository, 'getCustomerByTenant' | 'recordFollowUpCustomerTimelineEvent'>;
  auditRepository?: Pick<AuditEventRepository, 'record'>;
  occurredAt: string;
  deliveryOptions?: CreateMessageDeliveryOptions;
}) {
  if (hasMessageDeliveryMetadata(input.draft)) {
    return { kind: 'conflict' as const, reason: 'message_delivery_exists' as const };
  }

  const deliveryResult = createMessageDeliveryFromApprovedDraft({
    draft: input.draft,
    actorId: input.context.userId,
    occurredAt: input.occurredAt,
    options: input.deliveryOptions,
  });
  if (deliveryResult.kind === 'invalid_status') {
    return { kind: 'invalid_status' as const };
  }

  await recordMessageDeliveryTimelineEvents({
    context: input.context,
    tenantBusinessRepository: input.tenantBusinessRepository,
    delivery: deliveryResult.delivery,
    occurredAt: input.occurredAt,
  });
  await recordDeliveryAudit({
    context: input.context,
    auditRepository: input.auditRepository,
    deliveryId: deliveryResult.delivery.id,
    reason: 'message_delivery_created',
    occurredAt: input.occurredAt,
  });
  if (deliveryResult.delivery.status !== 'pending') {
    await recordDeliveryAudit({
      context: input.context,
      auditRepository: input.auditRepository,
      deliveryId: deliveryResult.delivery.id,
      reason: messageDeliveryStatusAuditReason(deliveryResult.delivery.status),
      occurredAt: input.occurredAt,
    });
  }

  return {
    kind: 'created' as const,
    delivery: mapMessageDeliveryToDto(deliveryResult.delivery),
  };
}

function canUseFollowUpMessage(context: AccessContext, action: 'read_own_tenant' | 'create' | 'update') {
  return canAccessResource({
    context,
    resource: 'follow_up',
    action,
    targetTenantId: context.tenantId,
  });
}

function hasTenant(context: AccessContext): context is AccessContext & { tenantId: string } {
  return Boolean(context.tenantId);
}

export async function listFollowUpMessageTemplates(input: {
  context: AccessContext;
  tenantBusinessRepository: Pick<ServiceRepository, 'listFollowUpMessageTemplatesByTenant'>;
}): Promise<ListFollowUpMessageTemplatesResult> {
  const decision = canUseFollowUpMessage(input.context, 'read_own_tenant');
  if (!decision.allowed) return { kind: 'forbidden', reason: decision.reason };
  if (!hasTenant(input.context)) return { kind: 'forbidden', reason: 'missing_tenant' };

  const templates = await input.tenantBusinessRepository.listFollowUpMessageTemplatesByTenant({
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId ?? null,
  });

  return {
    kind: 'success',
    templates: [...templates, ...builtInFollowUpMessageTemplates].map(mapFollowUpMessageTemplateToDto),
  };
}

export async function createMessageDraftForFollowUpTask(input: {
  context: AccessContext;
  followUpTaskId: string;
  templateId?: string | null;
  tenantBusinessRepository: Pick<
    ServiceRepository,
    | 'listFollowUpMessageTemplatesByTenant'
    | 'getCustomerByTenant'
    | 'getFollowUpTaskPathContextByTenant'
    | 'createFollowUpMessageDraft'
    | 'recordFollowUpCustomerTimelineEvent'
  >;
  occurredAt: string;
}): Promise<CreateFollowUpMessageDraftResult> {
  const decision = canUseFollowUpMessage(input.context, 'create');
  if (!decision.allowed) return { kind: 'forbidden', reason: decision.reason };
  if (!hasTenant(input.context)) return { kind: 'forbidden', reason: 'missing_tenant' };

  const pathContext = await input.tenantBusinessRepository.getFollowUpTaskPathContextByTenant({
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId ?? null,
    followUpTaskId: input.followUpTaskId,
  });

  if (!pathContext) return { kind: 'not_found' };

  const storedTemplates = await input.tenantBusinessRepository.listFollowUpMessageTemplatesByTenant({
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId ?? null,
  });
  const templates = [...storedTemplates, ...builtInFollowUpMessageTemplates];
  const selectedTemplate = selectFollowUpMessageTemplate({
    templates,
    templateId: input.templateId,
    templateKey: pathContext.templateKey,
    nodeKey: pathContext.nodeKey,
  });
  const draft = createMessageDraftDomain({
    pathContext,
    template: selectedTemplate,
    occurredAt: input.occurredAt,
  });
  const result = await input.tenantBusinessRepository.createFollowUpMessageDraft({
    id: globalThis.crypto.randomUUID(),
    ...draft,
  });

  if (result.kind === 'created') {
    const draftDto = mapFollowUpMessageDraftToDto(result.draft);
    await recordMessageDraftTimelineEvent({
      context: input.context,
      tenantBusinessRepository: input.tenantBusinessRepository,
      draft: draftDto,
      eventType: 'message_draft_created',
      occurredAt: input.occurredAt,
    });
    return { kind: 'created', draft: draftDto };
  }

  return result;
}

export async function listMessageDraftsForFollowUpTask(input: {
  context: AccessContext;
  followUpTaskId: string;
  tenantBusinessRepository: Pick<
    ServiceRepository,
    'getFollowUpTaskPathContextByTenant' | 'listFollowUpMessageDraftsByTask'
  >;
}): Promise<ListFollowUpMessageDraftsResult> {
  const decision = canUseFollowUpMessage(input.context, 'read_own_tenant');
  if (!decision.allowed) return { kind: 'forbidden', reason: decision.reason };
  if (!hasTenant(input.context)) return { kind: 'forbidden', reason: 'missing_tenant' };

  const pathContext = await input.tenantBusinessRepository.getFollowUpTaskPathContextByTenant({
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId ?? null,
    followUpTaskId: input.followUpTaskId,
  });
  if (!pathContext) return { kind: 'not_found' };

  const drafts = await input.tenantBusinessRepository.listFollowUpMessageDraftsByTask({
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId ?? null,
    followUpTaskId: input.followUpTaskId,
  });

  return { kind: 'success', drafts: drafts.map(mapFollowUpMessageDraftToDto) };
}

export async function updateMessageDraftContent(input: {
  context: AccessContext;
  draftId: string;
  content: string;
  tenantBusinessRepository: Pick<
    ServiceRepository,
    'getFollowUpMessageDraftByTenant' | 'updateFollowUpMessageDraftContent' | 'getCustomerByTenant' | 'recordFollowUpCustomerTimelineEvent'
  >;
  occurredAt: string;
}): Promise<UpdateFollowUpMessageDraftResult> {
  const decision = canUseFollowUpMessage(input.context, 'update');
  if (!decision.allowed) return { kind: 'forbidden', reason: decision.reason };
  if (!hasTenant(input.context)) return { kind: 'forbidden', reason: 'missing_tenant' };

  const draft = await input.tenantBusinessRepository.getFollowUpMessageDraftByTenant({
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId ?? null,
    draftId: input.draftId,
  });
  if (!draft) return { kind: 'not_found' };

  const updated = updateMessageDraftContentDomain({
    draft,
    content: input.content,
    occurredAt: input.occurredAt,
  });
  if (updated.kind === 'unsafe_content') {
    return {
      kind: 'conflict',
      resourceId: draft.id,
      reason: 'unsafe_follow_up_message_content',
    };
  }
  if (updated.kind === 'invalid_status') {
    return {
      kind: 'conflict',
      resourceId: draft.id,
      reason: 'follow_up_message_draft_not_draft',
    };
  }

  const result = await input.tenantBusinessRepository.updateFollowUpMessageDraftContent({
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId ?? null,
    draftId: input.draftId,
    editedContent: updated.draft.editedContent ?? updated.draft.draftContent,
    safePreview: updated.draft.safePreview,
    safeReasonCode: updated.draft.safeReasonCode,
    occurredAt: input.occurredAt,
  });

  if (result.kind === 'updated') {
    const draftDto = mapFollowUpMessageDraftToDto(result.draft);
    await recordMessageDraftTimelineEvent({
      context: input.context,
      tenantBusinessRepository: input.tenantBusinessRepository,
      draft: draftDto,
      eventType: 'message_draft_updated',
      occurredAt: input.occurredAt,
    });
    return { kind: 'updated', draft: draftDto };
  }

  return result;
}

export async function approveMessageDraft(input: {
  context: AccessContext;
  draftId: string;
  tenantBusinessRepository: Pick<ServiceRepository, 'approveFollowUpMessageDraft' | 'getCustomerByTenant' | 'recordFollowUpCustomerTimelineEvent'>;
  auditRepository?: Pick<AuditEventRepository, 'record'>;
  occurredAt: string;
  deliveryOptions?: CreateMessageDeliveryOptions;
}): Promise<UpdateFollowUpMessageDraftResult> {
  return transitionMessageDraft({
    context: input.context,
    draftId: input.draftId,
    tenantBusinessRepository: input.tenantBusinessRepository,
    occurredAt: input.occurredAt,
    operation: 'approve',
    auditRepository: input.auditRepository,
    deliveryOptions: input.deliveryOptions,
  });
}

export async function rejectMessageDraft(input: {
  context: AccessContext;
  draftId: string;
  tenantBusinessRepository: Pick<ServiceRepository, 'rejectFollowUpMessageDraft' | 'getCustomerByTenant' | 'recordFollowUpCustomerTimelineEvent'>;
  occurredAt: string;
}): Promise<UpdateFollowUpMessageDraftResult> {
  return transitionMessageDraft({
    context: input.context,
    draftId: input.draftId,
    tenantBusinessRepository: input.tenantBusinessRepository,
    occurredAt: input.occurredAt,
    operation: 'reject',
  });
}

export async function markMessageDraftAsSent(input: {
  context: AccessContext;
  draftId: string;
  tenantBusinessRepository: Pick<ServiceRepository, 'markFollowUpMessageDraftAsSent' | 'getCustomerByTenant' | 'recordFollowUpCustomerTimelineEvent'>;
  occurredAt: string;
}): Promise<UpdateFollowUpMessageDraftResult> {
  return transitionMessageDraft({
    context: input.context,
    draftId: input.draftId,
    tenantBusinessRepository: input.tenantBusinessRepository,
    occurredAt: input.occurredAt,
    operation: 'mark_sent',
  });
}

async function transitionMessageDraft(input: {
  context: AccessContext;
  draftId: string;
  tenantBusinessRepository: Pick<
    ServiceRepository,
    'getCustomerByTenant' | 'recordFollowUpCustomerTimelineEvent'
  > &
    Partial<
      Pick<
        ServiceRepository,
        | 'approveFollowUpMessageDraft'
        | 'rejectFollowUpMessageDraft'
        | 'markFollowUpMessageDraftAsSent'
      >
    >;
  occurredAt: string;
  operation: 'approve' | 'reject' | 'mark_sent';
  auditRepository?: Pick<AuditEventRepository, 'record'>;
  deliveryOptions?: CreateMessageDeliveryOptions;
}): Promise<UpdateFollowUpMessageDraftResult> {
  const decision = canUseFollowUpMessage(input.context, 'update');
  if (!decision.allowed) return { kind: 'forbidden', reason: decision.reason };
  if (!hasTenant(input.context)) return { kind: 'forbidden', reason: 'missing_tenant' };

  const commonInput = {
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId ?? null,
    draftId: input.draftId,
    actorId: input.context.userId,
    occurredAt: input.occurredAt,
  };
  const result = input.operation === 'approve'
    ? await input.tenantBusinessRepository.approveFollowUpMessageDraft?.(commonInput)
    : input.operation === 'reject'
      ? await input.tenantBusinessRepository.rejectFollowUpMessageDraft?.(commonInput)
      : await input.tenantBusinessRepository.markFollowUpMessageDraftAsSent?.(commonInput);

  if (!result) return { kind: 'not_found' };
  if (result.kind === 'updated') {
    const draftDto = mapFollowUpMessageDraftToDto(result.draft);
    const eventType = input.operation === 'approve'
      ? 'message_draft_approved'
      : input.operation === 'reject'
        ? 'message_draft_rejected'
        : 'message_draft_marked_sent';
    await recordMessageDraftTimelineEvent({
      context: input.context,
      tenantBusinessRepository: input.tenantBusinessRepository,
      draft: draftDto,
      eventType,
      occurredAt: input.occurredAt,
    });

    if (input.operation === 'approve') {
      const deliveryResult = await createDeliveryAfterDraftApproval({
        context: input.context,
        draft: result.draft,
        tenantBusinessRepository: input.tenantBusinessRepository,
        auditRepository: input.auditRepository,
        occurredAt: input.occurredAt,
        deliveryOptions: input.deliveryOptions,
      });

      if (deliveryResult.kind === 'created') {
        return {
          kind: 'updated_with_delivery',
          draft: draftDto,
          delivery: deliveryResult.delivery,
          deduped: false,
        };
      }

      if (deliveryResult.kind === 'conflict' && isMessageDeliveryConflictReason(deliveryResult.reason)) {
        return { kind: 'conflict', resourceId: draftDto.draftId, reason: deliveryResult.reason };
      }
    }

    return { kind: 'updated', draft: draftDto };
  }

  return result;
}
