export type V1KnowledgeBaseAuditReadonlyPolicy = {
  featureEnabled: boolean;
  canReadKnowledgeBaseAudit: boolean;
  tenantScopeMatched: boolean;
  workspaceScopeMatched: boolean;
  institutionScopeMatched: boolean;
  tenantId?: string;
  workspaceId?: string;
  institutionId?: string;
};

export type V1KnowledgeBaseAuditScope =
  | 'platform_knowledge_base'
  | 'institution_knowledge_base';

export type V1KnowledgeBaseAuditKnowledgeType =
  | 'project_knowledge'
  | 'treatment_instruction'
  | 'recovery_cycle'
  | 'faq'
  | 'risk_notice'
  | 'disabled_words'
  | 'followup_sop'
  | 'revisit_rule'
  | 'repurchase_rule'
  | 'dormant_customer_wakeup_rule'
  | 'ai_template'
  | 'standard_talk_script'
  | 'material_library'
  | 'project_material'
  | 'price_package'
  | 'doctor_profile'
  | 'postoperative_care'
  | 'service_sop'
  | 'communication_script'
  | 'repurchase_campaign'
  | 'institution_material'
  | 'institution_faq';

export type V1KnowledgeBaseAuditSourceType =
  | 'mock_document'
  | 'seed_catalog'
  | 'demo_reference';

export type V1KnowledgeBaseAuditReviewStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'stale';

export type V1KnowledgeBaseAuditPublishStatus =
  | 'draft'
  | 'published'
  | 'archived'
  | 'disabled';

export type V1KnowledgeBaseAuditReadonlyCandidateInput = {
  knowledgeBaseId?: string;
  tenantId?: string;
  institutionId?: string;
  workspaceId?: string;
  scope?: V1KnowledgeBaseAuditScope;
  knowledgeType?: V1KnowledgeBaseAuditKnowledgeType;
  sourceType?: V1KnowledgeBaseAuditSourceType;
  sourceLabel?: string;
  reviewStatus?: V1KnowledgeBaseAuditReviewStatus;
  publishStatus?: V1KnowledgeBaseAuditPublishStatus;
  visibilityScope?: string;
  lastReviewedAt?: string;
  lastPublishedAt?: string;
  lastRetiredAt?: string;
  citationSourceSummary?: string;
  riskFlags?: readonly string[];
  mockSeedDemoFlag?: 'mock' | 'seed' | 'demo';
  [key: string]: unknown;
};

type V1KnowledgeBaseAuditReadonlyValidCandidate =
  V1KnowledgeBaseAuditReadonlyCandidateInput & {
    knowledgeBaseId: string;
    tenantId: string;
    institutionId: string;
    workspaceId: string;
    scope: V1KnowledgeBaseAuditScope;
    knowledgeType: V1KnowledgeBaseAuditKnowledgeType;
    sourceType: V1KnowledgeBaseAuditSourceType;
    sourceLabel: string;
    reviewStatus: V1KnowledgeBaseAuditReviewStatus;
    publishStatus: V1KnowledgeBaseAuditPublishStatus;
    visibilityScope: string;
    lastReviewedAt: string;
    lastPublishedAt: string;
    lastRetiredAt: string;
    citationSourceSummary: string;
    riskFlags: readonly string[];
    mockSeedDemoFlag: 'mock' | 'seed' | 'demo';
  };

export type V1KnowledgeBaseAuditReadonlyInput = {
  candidates?: readonly V1KnowledgeBaseAuditReadonlyCandidateInput[];
};

export type V1KnowledgeBaseAuditReadonlyStatus =
  | 'disabled'
  | 'denied'
  | 'empty'
  | 'exception'
  | 'stale'
  | 'ready';

export type V1KnowledgeBaseAuditReadonlyResultCode =
  | 'skipped'
  | 'denied'
  | 'empty'
  | 'unavailable'
  | 'stale'
  | 'readonly';

export type V1KnowledgeBaseAuditFreshness = 'ready' | 'stale';

export const defaultV1KnowledgeBaseAuditReadonlyPolicy = {
  featureEnabled: false,
  canReadKnowledgeBaseAudit: false,
  tenantScopeMatched: false,
  workspaceScopeMatched: false,
  institutionScopeMatched: false,
} as const satisfies V1KnowledgeBaseAuditReadonlyPolicy;

export const v1KnowledgeBaseAuditReadonlyItemFields = [
  'knowledgeBaseId',
  'tenantId',
  'institutionId',
  'workspaceId',
  'scope',
  'knowledgeType',
  'sourceType',
  'sourceLabel',
  'sourceSummary',
  'reviewStatus',
  'reviewStatusSummary',
  'publishStatus',
  'publishRecordSummary',
  'retireRecordSummary',
  'visibilityScope',
  'citationSourceSummary',
  'riskFlags',
  'auditFreshness',
  'mockSeedDemoFlag',
  'readonly',
  'reasonCode',
  'resultCode',
] as const;

export type V1KnowledgeBaseAuditReadonlyItem = {
  knowledgeBaseId: string;
  tenantId: string;
  institutionId: string;
  workspaceId: string;
  scope: V1KnowledgeBaseAuditScope;
  knowledgeType: V1KnowledgeBaseAuditKnowledgeType;
  sourceType: V1KnowledgeBaseAuditSourceType;
  sourceLabel: string;
  sourceSummary: string;
  reviewStatus: V1KnowledgeBaseAuditReviewStatus;
  reviewStatusSummary: string;
  publishStatus: V1KnowledgeBaseAuditPublishStatus;
  publishRecordSummary: string;
  retireRecordSummary: string;
  visibilityScope: string;
  citationSourceSummary: string;
  riskFlags: readonly string[];
  auditFreshness: V1KnowledgeBaseAuditFreshness;
  mockSeedDemoFlag: 'mock' | 'seed' | 'demo';
  readonly: true;
  reasonCode: 'knowledge_base_audit_item_ready' | 'knowledge_base_audit_item_stale';
  resultCode: 'readonly';
};

export type V1KnowledgeBaseAuditReadonlySummary = {
  status: V1KnowledgeBaseAuditReadonlyStatus;
  reasonCode:
    | 'feature_flag_disabled'
    | 'tenant_scope_mismatch'
    | 'permission_denied'
    | 'no_knowledge_base_audit_candidates'
    | 'knowledge_base_audit_source_missing'
    | 'knowledge_base_audit_stale'
    | 'knowledge_base_audit_ready';
  resultCode: V1KnowledgeBaseAuditReadonlyResultCode;
  readonly: true;
  emptyCopy?: string;
  exceptionCopy?: string;
  staleCopy?: string;
  items: V1KnowledgeBaseAuditReadonlyItem[];
};

const disabledCopy = '该知识库审计与来源追踪只读能力暂未开启';
const emptyCopy = '暂无可展示知识库审计与来源追踪摘要';
const deniedCopy = '当前账号没有访问权限';
const sourceMissingCopy = '知识库审计与来源追踪来源不完整，仅作内部参考';
const staleCopy = '知识库审计与来源追踪摘要可能已过期';

const platformKnowledgeTypes = [
  'project_knowledge',
  'treatment_instruction',
  'recovery_cycle',
  'faq',
  'risk_notice',
  'disabled_words',
  'followup_sop',
  'revisit_rule',
  'repurchase_rule',
  'dormant_customer_wakeup_rule',
  'ai_template',
  'standard_talk_script',
  'material_library',
] as const;

const institutionKnowledgeTypes = [
  'project_material',
  'price_package',
  'doctor_profile',
  'postoperative_care',
  'service_sop',
  'communication_script',
  'repurchase_campaign',
  'institution_material',
  'institution_faq',
] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isAuditScope(value: unknown): value is V1KnowledgeBaseAuditScope {
  return value === 'platform_knowledge_base' || value === 'institution_knowledge_base';
}

function isKnowledgeTypeAllowedForScope(
  scope: V1KnowledgeBaseAuditScope,
  knowledgeType: unknown,
): knowledgeType is V1KnowledgeBaseAuditKnowledgeType {
  if (scope === 'platform_knowledge_base') {
    return platformKnowledgeTypes.includes(
      knowledgeType as (typeof platformKnowledgeTypes)[number],
    );
  }

  return institutionKnowledgeTypes.includes(
    knowledgeType as (typeof institutionKnowledgeTypes)[number],
  );
}

function isSourceType(value: unknown): value is V1KnowledgeBaseAuditSourceType {
  return value === 'mock_document' || value === 'seed_catalog' || value === 'demo_reference';
}

function isReviewStatus(value: unknown): value is V1KnowledgeBaseAuditReviewStatus {
  return value === 'pending' || value === 'approved' || value === 'rejected' || value === 'stale';
}

function isPublishStatus(value: unknown): value is V1KnowledgeBaseAuditPublishStatus {
  return (
    value === 'draft' ||
    value === 'published' ||
    value === 'archived' ||
    value === 'disabled'
  );
}

function isMockSeedDemoFlag(value: unknown): value is 'mock' | 'seed' | 'demo' {
  return value === 'mock' || value === 'seed' || value === 'demo';
}

function hasLowSensitiveRequiredSource(
  candidate: V1KnowledgeBaseAuditReadonlyCandidateInput,
): candidate is V1KnowledgeBaseAuditReadonlyValidCandidate {
  return (
    isNonEmptyString(candidate.knowledgeBaseId) &&
    isNonEmptyString(candidate.tenantId) &&
    isNonEmptyString(candidate.institutionId) &&
    isNonEmptyString(candidate.workspaceId) &&
    isAuditScope(candidate.scope) &&
    isKnowledgeTypeAllowedForScope(candidate.scope, candidate.knowledgeType) &&
    isSourceType(candidate.sourceType) &&
    isNonEmptyString(candidate.sourceLabel) &&
    isReviewStatus(candidate.reviewStatus) &&
    isPublishStatus(candidate.publishStatus) &&
    isNonEmptyString(candidate.visibilityScope) &&
    isNonEmptyString(candidate.lastReviewedAt) &&
    isNonEmptyString(candidate.lastPublishedAt) &&
    isNonEmptyString(candidate.lastRetiredAt) &&
    isNonEmptyString(candidate.citationSourceSummary) &&
    Array.isArray(candidate.riskFlags) &&
    candidate.riskFlags.every(isNonEmptyString) &&
    isMockSeedDemoFlag(candidate.mockSeedDemoFlag)
  );
}

function candidateMatchesPolicyBoundary(
  candidate: V1KnowledgeBaseAuditReadonlyValidCandidate,
  policy: V1KnowledgeBaseAuditReadonlyPolicy,
): boolean {
  if (policy.tenantId !== undefined && candidate.tenantId !== policy.tenantId) {
    return false;
  }

  if (policy.workspaceId !== undefined && candidate.workspaceId !== policy.workspaceId) {
    return false;
  }

  if (
    candidate.scope === 'institution_knowledge_base' &&
    policy.institutionId !== undefined &&
    candidate.institutionId !== policy.institutionId
  ) {
    return false;
  }

  return true;
}

function toPolicyBlockedSummary(
  status: 'disabled' | 'denied' | 'empty',
  reasonCode:
    | 'feature_flag_disabled'
    | 'tenant_scope_mismatch'
    | 'permission_denied'
    | 'no_knowledge_base_audit_candidates',
): V1KnowledgeBaseAuditReadonlySummary {
  if (status === 'disabled') {
    return {
      status,
      reasonCode,
      resultCode: 'skipped',
      readonly: true,
      emptyCopy: disabledCopy,
      items: [],
    };
  }

  if (status === 'empty') {
    return {
      status,
      reasonCode,
      resultCode: 'empty',
      readonly: true,
      emptyCopy,
      items: [],
    };
  }

  return {
    status,
    reasonCode,
    resultCode: 'denied',
    readonly: true,
    exceptionCopy: deniedCopy,
    items: [],
  };
}

function toSourceMissingSummary(): V1KnowledgeBaseAuditReadonlySummary {
  return {
    status: 'exception',
    reasonCode: 'knowledge_base_audit_source_missing',
    resultCode: 'unavailable',
    readonly: true,
    exceptionCopy: sourceMissingCopy,
    items: [],
  };
}

function auditFreshnessForCandidate(
  candidate: V1KnowledgeBaseAuditReadonlyValidCandidate,
): V1KnowledgeBaseAuditFreshness {
  if (candidate.reviewStatus === 'stale' || candidate.riskFlags.includes('stale_reference')) {
    return 'stale';
  }

  return 'ready';
}

function publishRecordSummary(
  candidate: V1KnowledgeBaseAuditReadonlyValidCandidate,
): string {
  return `${candidate.publishStatus} / ${candidate.lastPublishedAt}`;
}

function retireRecordSummary(
  candidate: V1KnowledgeBaseAuditReadonlyValidCandidate,
): string {
  if (candidate.publishStatus === 'archived' || candidate.publishStatus === 'disabled') {
    return `${candidate.publishStatus} / ${candidate.lastRetiredAt}`;
  }

  return candidate.lastRetiredAt;
}

function toAuditReadonlyItem(
  candidate: V1KnowledgeBaseAuditReadonlyValidCandidate,
): V1KnowledgeBaseAuditReadonlyItem {
  const auditFreshness = auditFreshnessForCandidate(candidate);

  return {
    knowledgeBaseId: candidate.knowledgeBaseId,
    tenantId: candidate.tenantId,
    institutionId: candidate.institutionId,
    workspaceId: candidate.workspaceId,
    scope: candidate.scope,
    knowledgeType: candidate.knowledgeType,
    sourceType: candidate.sourceType,
    sourceLabel: candidate.sourceLabel,
    sourceSummary: `${candidate.sourceType} / ${candidate.sourceLabel}`,
    reviewStatus: candidate.reviewStatus,
    reviewStatusSummary: `${candidate.reviewStatus} / ${candidate.lastReviewedAt}`,
    publishStatus: candidate.publishStatus,
    publishRecordSummary: publishRecordSummary(candidate),
    retireRecordSummary: retireRecordSummary(candidate),
    visibilityScope: candidate.visibilityScope,
    citationSourceSummary: candidate.citationSourceSummary,
    riskFlags: [...candidate.riskFlags],
    auditFreshness,
    mockSeedDemoFlag: candidate.mockSeedDemoFlag,
    readonly: true,
    reasonCode:
      auditFreshness === 'stale'
        ? 'knowledge_base_audit_item_stale'
        : 'knowledge_base_audit_item_ready',
    resultCode: 'readonly',
  };
}

export function buildV1KnowledgeBaseAuditReadonlySummary(
  input: V1KnowledgeBaseAuditReadonlyInput,
  policy: V1KnowledgeBaseAuditReadonlyPolicy,
): V1KnowledgeBaseAuditReadonlySummary {
  const candidates = input.candidates ?? [];

  if (!policy.featureEnabled) {
    return toPolicyBlockedSummary('disabled', 'feature_flag_disabled');
  }

  if (!policy.tenantScopeMatched || !policy.workspaceScopeMatched || !policy.institutionScopeMatched) {
    return toPolicyBlockedSummary('denied', 'tenant_scope_mismatch');
  }

  if (!policy.canReadKnowledgeBaseAudit) {
    return toPolicyBlockedSummary('denied', 'permission_denied');
  }

  if (candidates.length === 0) {
    return toPolicyBlockedSummary('empty', 'no_knowledge_base_audit_candidates');
  }

  const items = candidates
    .filter(hasLowSensitiveRequiredSource)
    .filter((candidate) => candidateMatchesPolicyBoundary(candidate, policy))
    .map((candidate) => toAuditReadonlyItem(candidate));

  if (items.length === 0) {
    return toSourceMissingSummary();
  }

  if (items.every((item) => item.auditFreshness === 'stale')) {
    return {
      status: 'stale',
      reasonCode: 'knowledge_base_audit_stale',
      resultCode: 'stale',
      readonly: true,
      staleCopy,
      items,
    };
  }

  return {
    status: 'ready',
    reasonCode: 'knowledge_base_audit_ready',
    resultCode: 'readonly',
    readonly: true,
    items,
  };
}
