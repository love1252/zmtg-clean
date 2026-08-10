import {
  KNOWLEDGE_QUOTA_SAFE_REASON_CODES,
  KNOWLEDGE_QUOTA_USAGE_RESOURCES,
  createKnowledgeQuotaUsageCommandService,
  type KnowledgeQuotaSafeReasonCode,
  type KnowledgeQuotaUsageAction,
  type KnowledgeQuotaUsageResource,
  type KnowledgeQuotaUsageScope,
} from '@/modules/knowledge/application/quota/knowledge-quota-usage-command-service';
import { createKnowledgeQuotaUsageCommandRepository } from '@/modules/knowledge/server/knowledge-quota-usage-command-repository';
import type {
  TenantQuotaDecision,
  TenantQuotaResource,
} from '@/modules/institution/domain/quota-enforcement';
import type { TenantDatabase } from '@/server/db/client';

export type {
  KnowledgeQuotaUsageAction,
  KnowledgeQuotaUsageScope,
} from '@/modules/knowledge/application/quota/knowledge-quota-usage-command-service';

function knowledgeResource(
  resource: TenantQuotaResource,
): KnowledgeQuotaUsageResource {
  if (
    !KNOWLEDGE_QUOTA_USAGE_RESOURCES.includes(
      resource as KnowledgeQuotaUsageResource,
    )
  ) {
    throw new Error('non_knowledge_quota_resource');
  }
  return resource as KnowledgeQuotaUsageResource;
}

function knowledgeSafeReason(
  value: string,
): KnowledgeQuotaSafeReasonCode {
  if (
    !KNOWLEDGE_QUOTA_SAFE_REASON_CODES.includes(
      value as KnowledgeQuotaSafeReasonCode,
    )
  ) {
    throw new Error('invalid_knowledge_quota_safe_reason');
  }
  return value as KnowledgeQuotaSafeReasonCode;
}

export function createKnowledgeQuotaWriter(database: TenantDatabase) {
  const commandService = createKnowledgeQuotaUsageCommandService(
    createKnowledgeQuotaUsageCommandRepository(database),
  );

  return Object.freeze({
    async recordDecision(input: Readonly<{
      scope: KnowledgeQuotaUsageScope;
      actorUserId?: string | null;
      resourceKey: TenantQuotaResource;
      action: KnowledgeQuotaUsageAction;
      decision: TenantQuotaDecision;
      quantity?: number | null;
    }>) {
      const status = input.decision.allowed ? 'allowed' : 'rejected';
      const safeReasonCode = input.decision.allowed
        ? 'allowed'
        : knowledgeSafeReason(input.decision.reason);

      return commandService.appendUsage({
        scope: input.scope,
        actorUserId: input.actorUserId,
        resourceKey: knowledgeResource(input.resourceKey),
        action: input.action,
        status,
        quantity: input.quantity,
        safeReasonCode,
      });
    },

    async recordOutcome(input: Readonly<{
      scope: KnowledgeQuotaUsageScope;
      actorUserId?: string | null;
      resourceKey: TenantQuotaResource;
      action: KnowledgeQuotaUsageAction;
      status: 'succeeded' | 'failed';
      quantity?: number | null;
      safeReasonCode?: 'succeeded' | 'failed' | null;
    }>) {
      return commandService.appendUsage({
        scope: input.scope,
        actorUserId: input.actorUserId,
        resourceKey: knowledgeResource(input.resourceKey),
        action: input.action,
        status: input.status,
        quantity: input.quantity,
        safeReasonCode: input.safeReasonCode ?? input.status,
      });
    },
  });
}
