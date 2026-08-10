export const KNOWLEDGE_QUOTA_USAGE_RESOURCES = [
  'knowledge_items',
  'knowledge_files',
  'knowledge_total_storage_mb',
  'knowledge_single_file_size_mb',
  'knowledge_parse_jobs_monthly',
  'knowledge_embedding_jobs_monthly',
  'knowledge_ocr_jobs_monthly',
  'knowledge_rag_answers_monthly',
  'knowledge_index_rebuild_jobs_monthly',
] as const;

export type KnowledgeQuotaUsageResource =
  (typeof KNOWLEDGE_QUOTA_USAGE_RESOURCES)[number];

export const KNOWLEDGE_QUOTA_USAGE_ACTIONS = [
  'upload_file',
  'parse_file',
  'ocr_file',
  'generate_embeddings',
  'rebuild_embeddings',
  'rag_answer',
  'rebuild_knowledge_index',
] as const;

export type KnowledgeQuotaUsageAction =
  (typeof KNOWLEDGE_QUOTA_USAGE_ACTIONS)[number];

export const KNOWLEDGE_QUOTA_USAGE_STATUSES = [
  'allowed',
  'rejected',
  'succeeded',
  'failed',
] as const;

export type KnowledgeQuotaUsageStatus =
  (typeof KNOWLEDGE_QUOTA_USAGE_STATUSES)[number];

export const KNOWLEDGE_QUOTA_SAFE_REASON_CODES = [
  'allowed',
  'succeeded',
  'failed',
  'missing_active_plan',
  'missing_quota_limit',
  'feature_disabled',
  'quota_exceeded_knowledge_items',
  'quota_exceeded_knowledge_files',
  'quota_exceeded_knowledge_total_storage_mb',
  'quota_exceeded_knowledge_single_file_size_mb',
  'quota_exceeded_knowledge_parse_jobs_monthly',
  'quota_exceeded_knowledge_embedding_jobs_monthly',
  'quota_exceeded_knowledge_ocr_jobs_monthly',
  'quota_exceeded_knowledge_rag_answers_monthly',
  'quota_exceeded_knowledge_index_rebuild_jobs_monthly',
] as const;

export type KnowledgeQuotaSafeReasonCode =
  (typeof KNOWLEDGE_QUOTA_SAFE_REASON_CODES)[number];

export type TenantKnowledgeQuotaScope = Readonly<{
  kind: 'tenant';
  tenantId: string;
}>;

export type InstitutionKnowledgeQuotaScope = Readonly<{
  kind: 'institution';
  tenantId: string;
  institutionId: string;
}>;

export type KnowledgeQuotaUsageScope =
  | TenantKnowledgeQuotaScope
  | InstitutionKnowledgeQuotaScope;

export type AppendKnowledgeQuotaUsageCommand = Readonly<{
  scope: KnowledgeQuotaUsageScope;
  actorUserId?: string | null;
  resourceKey: KnowledgeQuotaUsageResource;
  action: KnowledgeQuotaUsageAction;
  status: KnowledgeQuotaUsageStatus;
  quantity?: number | null;
  safeReasonCode?: KnowledgeQuotaSafeReasonCode | null;
}>;

export type NormalizedKnowledgeQuotaUsageAppend = Readonly<{
  scope: KnowledgeQuotaUsageScope;
  actorUserId: string | null;
  resourceKey: KnowledgeQuotaUsageResource;
  action: KnowledgeQuotaUsageAction;
  status: KnowledgeQuotaUsageStatus;
  quantity: number;
  safeReasonCode: KnowledgeQuotaSafeReasonCode;
}>;

export interface KnowledgeQuotaUsageCommandRepository {
  append(input: NormalizedKnowledgeQuotaUsageAppend): Promise<void>;
}

export class KnowledgeQuotaUsageCommandInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeQuotaUsageCommandInputError';
  }
}

function requireExactIdentifier(value: unknown, field: string) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.trim() !== value
  ) {
    throw new KnowledgeQuotaUsageCommandInputError(`invalid_${field}`);
  }
  return value;
}

function normalizeScope(scope: KnowledgeQuotaUsageScope): KnowledgeQuotaUsageScope {
  if (!scope || typeof scope !== 'object') {
    throw new KnowledgeQuotaUsageCommandInputError('invalid_scope');
  }

  if (scope.kind === 'tenant') {
    return {
      kind: 'tenant',
      tenantId: requireExactIdentifier(scope.tenantId, 'tenant_id'),
    };
  }

  if (scope.kind === 'institution') {
    return {
      kind: 'institution',
      tenantId: requireExactIdentifier(scope.tenantId, 'tenant_id'),
      institutionId: requireExactIdentifier(
        scope.institutionId,
        'institution_id',
      ),
    };
  }

  throw new KnowledgeQuotaUsageCommandInputError('invalid_scope');
}

function normalizeActorUserId(value: unknown) {
  if (value === null || value === undefined) return null;
  return requireExactIdentifier(value, 'actor_user_id');
}

function requireListValue<T extends string>(
  value: unknown,
  values: readonly T[],
  field: string,
): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new KnowledgeQuotaUsageCommandInputError(`invalid_${field}`);
  }
  return value as T;
}

function normalizeQuantity(value: unknown) {
  if (value === null || value === undefined) return 1;
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    throw new KnowledgeQuotaUsageCommandInputError('invalid_quantity');
  }
  return value;
}

function normalizeSafeReasonCode(
  status: KnowledgeQuotaUsageStatus,
  value: unknown,
): KnowledgeQuotaSafeReasonCode {
  if (value === null || value === undefined) {
    if (
      status === 'allowed' ||
      status === 'succeeded' ||
      status === 'failed'
    ) {
      return status;
    }
    throw new KnowledgeQuotaUsageCommandInputError(
      'invalid_safe_reason_code',
    );
  }

  return requireListValue(
    value,
    KNOWLEDGE_QUOTA_SAFE_REASON_CODES,
    'safe_reason_code',
  );
}

export function createKnowledgeQuotaUsageCommandService(
  repository: KnowledgeQuotaUsageCommandRepository,
) {
  return Object.freeze({
    async appendUsage(input: AppendKnowledgeQuotaUsageCommand) {
      const status = requireListValue(
        input.status,
        KNOWLEDGE_QUOTA_USAGE_STATUSES,
        'status',
      );

      return repository.append({
        scope: normalizeScope(input.scope),
        actorUserId: normalizeActorUserId(input.actorUserId),
        resourceKey: requireListValue(
          input.resourceKey,
          KNOWLEDGE_QUOTA_USAGE_RESOURCES,
          'resource_key',
        ),
        action: requireListValue(
          input.action,
          KNOWLEDGE_QUOTA_USAGE_ACTIONS,
          'action',
        ),
        status,
        quantity: normalizeQuantity(input.quantity),
        safeReasonCode: normalizeSafeReasonCode(
          status,
          input.safeReasonCode,
        ),
      });
    },
  });
}
