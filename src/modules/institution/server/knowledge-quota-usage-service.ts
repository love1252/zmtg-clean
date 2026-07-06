import { randomUUID } from 'node:crypto';
import type {
  TenantQuotaDecision,
  TenantQuotaDenialReason,
  TenantQuotaResource,
} from '@/modules/institution/domain/quota-enforcement';
import type { TenantDatabase } from '@/server/db/client';
import { knowledgeQuotaUsageRecords } from '@/server/db/schema';

export type KnowledgeQuotaUsageStatus = 'allowed' | 'rejected' | 'succeeded' | 'failed';

export type KnowledgeQuotaUsageAction =
  | 'upload_file'
  | 'parse_file'
  | 'ocr_file'
  | 'generate_embeddings'
  | 'rebuild_embeddings'
  | 'rag_answer'
  | 'rebuild_knowledge_index';

export type KnowledgeQuotaUsageRecordInput = {
  tenantId: string;
  institutionId?: string | null;
  actorUserId?: string | null;
  resourceKey: TenantQuotaResource;
  action: KnowledgeQuotaUsageAction;
  status: KnowledgeQuotaUsageStatus;
  quantity?: number | null;
  safeReasonCode?: TenantQuotaDenialReason | 'allowed' | 'succeeded' | 'failed' | null;
};

function quotaUsageRecordId() {
  return `kb-quota-usage-${randomUUID()}`;
}

function normalizeQuantity(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.trunc(value));
}

function safeReasonFromDecision(decision: TenantQuotaDecision) {
  return decision.allowed ? 'allowed' : decision.reason;
}

export function createKnowledgeQuotaUsageRepository(database: TenantDatabase) {
  return {
    async createKnowledgeQuotaUsageRecord(input: KnowledgeQuotaUsageRecordInput) {
      await database.insert(knowledgeQuotaUsageRecords).values({
        id: quotaUsageRecordId(),
        tenantId: input.tenantId,
        institutionId: input.institutionId ?? null,
        actorUserId: input.actorUserId ?? null,
        resourceKey: input.resourceKey,
        action: input.action,
        status: input.status,
        quantity: normalizeQuantity(input.quantity),
        safeReasonCode: input.safeReasonCode ?? input.status,
        createdAt: new Date(),
      });
    },
  };
}

export type KnowledgeQuotaUsageRepository = ReturnType<typeof createKnowledgeQuotaUsageRepository>;

export async function recordKnowledgeQuotaDecision(input: {
  repository: KnowledgeQuotaUsageRepository;
  tenantId: string;
  institutionId?: string | null;
  actorUserId?: string | null;
  resourceKey: TenantQuotaResource;
  action: KnowledgeQuotaUsageAction;
  decision: TenantQuotaDecision;
  quantity?: number | null;
}) {
  await input.repository.createKnowledgeQuotaUsageRecord({
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    actorUserId: input.actorUserId,
    resourceKey: input.resourceKey,
    action: input.action,
    status: input.decision.allowed ? 'allowed' : 'rejected',
    quantity: input.quantity,
    safeReasonCode: safeReasonFromDecision(input.decision),
  });
}

export async function recordKnowledgeQuotaOutcome(input: {
  repository: KnowledgeQuotaUsageRepository;
  tenantId: string;
  institutionId?: string | null;
  actorUserId?: string | null;
  resourceKey: TenantQuotaResource;
  action: KnowledgeQuotaUsageAction;
  status: Extract<KnowledgeQuotaUsageStatus, 'succeeded' | 'failed'>;
  quantity?: number | null;
  safeReasonCode?: 'succeeded' | 'failed' | null;
}) {
  await input.repository.createKnowledgeQuotaUsageRecord({
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    actorUserId: input.actorUserId,
    resourceKey: input.resourceKey,
    action: input.action,
    status: input.status,
    quantity: input.quantity,
    safeReasonCode: input.safeReasonCode ?? input.status,
  });
}
