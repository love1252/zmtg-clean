import type { AccessContext } from '@/modules/security/domain/access-control';
import { canAccessResource } from '@/modules/security/domain/access-control';
import {
  builtInFollowUpMessageTemplates,
  createMessageDraftForFollowUpTask as createMessageDraftDomain,
  mapFollowUpMessageDraftToDto,
  mapFollowUpMessageTemplateToDto,
  selectFollowUpMessageTemplate,
  updateFollowUpMessageDraftContent as updateMessageDraftContentDomain,
  type FollowUpMessageDraftDto,
  type FollowUpMessageTemplateDto,
} from '@/modules/institution/domain/followup-message-drafts';
import type { TenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';

export type FollowUpMessageForbiddenReason =
  | 'missing_tenant'
  | 'cross_tenant_denied'
  | 'role_denied'
  | 'sensitive_detail_denied';

type ServiceRepository = Pick<
  TenantBusinessRepository,
  | 'listFollowUpMessageTemplatesByTenant'
  | 'getFollowUpTaskPathContextByTenant'
  | 'createFollowUpMessageDraft'
  | 'listFollowUpMessageDraftsByTask'
  | 'getFollowUpMessageDraftByTenant'
  | 'updateFollowUpMessageDraftContent'
  | 'approveFollowUpMessageDraft'
  | 'rejectFollowUpMessageDraft'
  | 'markFollowUpMessageDraftAsSent'
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
  | { kind: 'not_found' }
  | {
      kind: 'conflict';
      resourceId: string;
      reason:
        | 'follow_up_message_draft_not_draft'
        | 'follow_up_message_draft_not_approved'
        | 'unsafe_follow_up_message_content';
    }
  | { kind: 'forbidden'; reason: FollowUpMessageForbiddenReason };

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
    | 'getFollowUpTaskPathContextByTenant'
    | 'createFollowUpMessageDraft'
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
    return { kind: 'created', draft: mapFollowUpMessageDraftToDto(result.draft) };
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
    'getFollowUpMessageDraftByTenant' | 'updateFollowUpMessageDraftContent'
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
    return { kind: 'updated', draft: mapFollowUpMessageDraftToDto(result.draft) };
  }

  return result;
}

export async function approveMessageDraft(input: {
  context: AccessContext;
  draftId: string;
  tenantBusinessRepository: Pick<ServiceRepository, 'approveFollowUpMessageDraft'>;
  occurredAt: string;
}): Promise<UpdateFollowUpMessageDraftResult> {
  return transitionMessageDraft({
    context: input.context,
    draftId: input.draftId,
    tenantBusinessRepository: input.tenantBusinessRepository,
    occurredAt: input.occurredAt,
    operation: 'approve',
  });
}

export async function rejectMessageDraft(input: {
  context: AccessContext;
  draftId: string;
  tenantBusinessRepository: Pick<ServiceRepository, 'rejectFollowUpMessageDraft'>;
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
  tenantBusinessRepository: Pick<ServiceRepository, 'markFollowUpMessageDraftAsSent'>;
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
  tenantBusinessRepository: Partial<
    Pick<
      ServiceRepository,
      'approveFollowUpMessageDraft' | 'rejectFollowUpMessageDraft' | 'markFollowUpMessageDraftAsSent'
    >
  >;
  occurredAt: string;
  operation: 'approve' | 'reject' | 'mark_sent';
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
    return { kind: 'updated', draft: mapFollowUpMessageDraftToDto(result.draft) };
  }

  return result;
}
