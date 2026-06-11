import {
  buildV1KnowledgeBaseGovernanceReadonlySummary,
  type V1KnowledgeBaseGovernanceReadonlyInput,
  type V1KnowledgeBaseGovernanceReadonlyPolicy,
} from './v1-knowledge-base-governance-readonly-view-models';
import type {
  V1KnowledgeBaseAuditKnowledgeType,
  V1KnowledgeBaseAuditPublishStatus,
  V1KnowledgeBaseAuditReadonlyCandidateInput,
  V1KnowledgeBaseAuditReviewStatus,
  V1KnowledgeBaseAuditSourceType,
} from './v1-knowledge-base-audit-readonly-view-models';

export type V1KnowledgeBaseDemoSourceReadonlyPolicy = {
  featureEnabled: boolean;
  canReadKnowledgeBaseDemoSource: boolean;
  tenantScopeMatched: boolean;
  workspaceScopeMatched: boolean;
  institutionScopeMatched: boolean;
  tenantId?: string;
  institutionId?: string;
  workspaceId?: string;
  viewerScope: 'platform' | 'institution';
  viewerInstitutionScopeCode?: string;
};

export type V1KnowledgeBaseDemoSourceType = 'platform' | 'institution';

export type V1KnowledgeBaseDemoSourceVersionStatus =
  | 'current'
  | 'reviewing'
  | 'deprecated';

export type V1KnowledgeBaseDemoSourcePermissionStatus = 'visible' | 'restricted';

export type V1KnowledgeBaseDemoSourceRecord = {
  tenantId?: string;
  institutionId?: string;
  workspaceId?: string;
  knowledgeBaseId?: string;
  knowledgeItemId?: string;
  knowledgeBaseType?: V1KnowledgeBaseDemoSourceType;
  knowledgeType?: V1KnowledgeBaseAuditKnowledgeType;
  sourceType?: V1KnowledgeBaseAuditSourceType;
  sourceLabel?: string;
  catalogPath?: readonly string[];
  publishStatus?: V1KnowledgeBaseAuditPublishStatus;
  reviewStatus?: V1KnowledgeBaseAuditReviewStatus;
  version?: string;
  visibilityScope?: string;
  lastReviewedAt?: string;
  lastPublishedAt?: string;
  lastRetiredAt?: string;
  citationSourceSummary?: string;
  riskFlags?: readonly string[];
  mockSeedDemoFlag?: 'mock' | 'seed' | 'demo';
  [key: string]: unknown;
};

type V1KnowledgeBaseDemoSourceValidRecord = V1KnowledgeBaseDemoSourceRecord & {
  tenantId: string;
  institutionId: string;
  workspaceId: string;
  knowledgeBaseId: string;
  knowledgeItemId: string;
  knowledgeBaseType: V1KnowledgeBaseDemoSourceType;
  knowledgeType: V1KnowledgeBaseAuditKnowledgeType;
  sourceType: V1KnowledgeBaseAuditSourceType;
  sourceLabel: string;
  catalogPath: readonly string[];
  publishStatus: V1KnowledgeBaseAuditPublishStatus;
  reviewStatus: V1KnowledgeBaseAuditReviewStatus;
  version: string;
  visibilityScope: string;
  lastReviewedAt: string;
  lastPublishedAt: string;
  lastRetiredAt: string;
  citationSourceSummary: string;
  riskFlags: readonly string[];
  mockSeedDemoFlag: 'mock' | 'seed' | 'demo';
};

export type V1KnowledgeBaseDemoSourceInput = {
  sources?: readonly V1KnowledgeBaseDemoSourceRecord[];
};

export type V1KnowledgeBaseDemoSourceReadonlyStatus =
  | 'disabled'
  | 'denied'
  | 'empty'
  | 'exception'
  | 'partial'
  | 'stale'
  | 'ready';

export type V1KnowledgeBaseDemoSourceStatus =
  | 'disabled'
  | 'denied'
  | 'empty'
  | 'source_missing'
  | 'partial'
  | 'stale'
  | 'ready';

export type V1KnowledgeBaseDemoSourceReadonlyResultCode =
  | 'skipped'
  | 'denied'
  | 'empty'
  | 'unavailable'
  | 'partial'
  | 'stale'
  | 'readonly';

export type V1KnowledgeBaseDemoSourceReadonlySummary = {
  status: V1KnowledgeBaseDemoSourceReadonlyStatus;
  reasonCode:
    | 'feature_flag_disabled'
    | 'tenant_scope_mismatch'
    | 'permission_denied'
    | 'no_knowledge_base_demo_sources'
    | 'knowledge_base_demo_source_missing'
    | 'knowledge_base_demo_source_partial'
    | 'knowledge_base_demo_source_stale'
    | 'knowledge_base_demo_source_ready';
  resultCode: V1KnowledgeBaseDemoSourceReadonlyResultCode;
  readonly: true;
  emptyCopy?: string;
  exceptionCopy?: string;
  staleCopy?: string;
  tenantId: string;
  institutionId: string;
  workspaceId: string;
  platformKnowledgeBaseSummary: string;
  institutionKnowledgeBaseSummary: string;
  governanceInputSummary: string;
  governanceSummary: string;
  sourceStatus: V1KnowledgeBaseDemoSourceStatus;
  riskFlags: readonly string[];
  recommendedReadonlyActions: readonly string[];
};

export const defaultV1KnowledgeBaseDemoSourceReadonlyPolicy = {
  featureEnabled: false,
  canReadKnowledgeBaseDemoSource: false,
  tenantScopeMatched: false,
  workspaceScopeMatched: false,
  institutionScopeMatched: false,
  viewerScope: 'institution',
} as const satisfies V1KnowledgeBaseDemoSourceReadonlyPolicy;

export const v1KnowledgeBaseDemoSourceReadonlySummaryFields = [
  'status',
  'reasonCode',
  'resultCode',
  'readonly',
  'emptyCopy',
  'exceptionCopy',
  'staleCopy',
  'tenantId',
  'institutionId',
  'workspaceId',
  'platformKnowledgeBaseSummary',
  'institutionKnowledgeBaseSummary',
  'governanceInputSummary',
  'governanceSummary',
  'sourceStatus',
  'riskFlags',
  'recommendedReadonlyActions',
] as const;

const disabledCopy = '该知识库 demo 来源只读装配能力暂未开启';
const emptyCopy = '暂无可展示知识库 demo 来源';
const deniedCopy = '当前账号没有访问权限';
const sourceMissingCopy = '知识库 demo 来源不完整，仅作内部参考';
const partialCopy = '知识库 demo 来源部分不完整，仅展示可用只读摘要';
const staleCopy = '知识库 demo 来源可能已过期';
const notAvailable = 'not_available';

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

function isKnowledgeBaseType(value: unknown): value is V1KnowledgeBaseDemoSourceType {
  return value === 'platform' || value === 'institution';
}

function isSourceType(value: unknown): value is V1KnowledgeBaseAuditSourceType {
  return value === 'mock_document' || value === 'seed_catalog' || value === 'demo_reference';
}

function isPublishStatus(value: unknown): value is V1KnowledgeBaseAuditPublishStatus {
  return (
    value === 'draft' ||
    value === 'published' ||
    value === 'archived' ||
    value === 'disabled'
  );
}

function isReviewStatus(value: unknown): value is V1KnowledgeBaseAuditReviewStatus {
  return value === 'pending' || value === 'approved' || value === 'rejected' || value === 'stale';
}

function isMockSeedDemoFlag(value: unknown): value is 'mock' | 'seed' | 'demo' {
  return value === 'mock' || value === 'seed' || value === 'demo';
}

function isKnowledgeTypeAllowedForBaseType(
  baseType: V1KnowledgeBaseDemoSourceType,
  knowledgeType: unknown,
): knowledgeType is V1KnowledgeBaseAuditKnowledgeType {
  if (baseType === 'platform') {
    return platformKnowledgeTypes.includes(
      knowledgeType as (typeof platformKnowledgeTypes)[number],
    );
  }

  return institutionKnowledgeTypes.includes(
    knowledgeType as (typeof institutionKnowledgeTypes)[number],
  );
}

function hasLowSensitiveDemoSource(
  source: V1KnowledgeBaseDemoSourceRecord,
): source is V1KnowledgeBaseDemoSourceValidRecord {
  return (
    isNonEmptyString(source.tenantId) &&
    isNonEmptyString(source.institutionId) &&
    isNonEmptyString(source.workspaceId) &&
    isNonEmptyString(source.knowledgeBaseId) &&
    isNonEmptyString(source.knowledgeItemId) &&
    isKnowledgeBaseType(source.knowledgeBaseType) &&
    isKnowledgeTypeAllowedForBaseType(source.knowledgeBaseType, source.knowledgeType) &&
    isSourceType(source.sourceType) &&
    isNonEmptyString(source.sourceLabel) &&
    Array.isArray(source.catalogPath) &&
    source.catalogPath.length > 0 &&
    source.catalogPath.every(isNonEmptyString) &&
    isPublishStatus(source.publishStatus) &&
    isReviewStatus(source.reviewStatus) &&
    isNonEmptyString(source.version) &&
    isNonEmptyString(source.visibilityScope) &&
    isNonEmptyString(source.lastReviewedAt) &&
    isNonEmptyString(source.lastPublishedAt) &&
    isNonEmptyString(source.lastRetiredAt) &&
    isNonEmptyString(source.citationSourceSummary) &&
    Array.isArray(source.riskFlags) &&
    source.riskFlags.every(isNonEmptyString) &&
    isMockSeedDemoFlag(source.mockSeedDemoFlag)
  );
}

function matchesPolicyBoundary(
  source: V1KnowledgeBaseDemoSourceRecord,
  policy: V1KnowledgeBaseDemoSourceReadonlyPolicy,
): boolean {
  if (policy.tenantId !== undefined && source.tenantId !== policy.tenantId) {
    return false;
  }

  if (policy.workspaceId !== undefined && source.workspaceId !== policy.workspaceId) {
    return false;
  }

  if (
    source.knowledgeBaseType === 'institution' &&
    policy.institutionId !== undefined &&
    source.institutionId !== policy.institutionId
  ) {
    return false;
  }

  return true;
}

function viewerInstitutionCode(policy: V1KnowledgeBaseDemoSourceReadonlyPolicy): string | undefined {
  return policy.viewerInstitutionScopeCode ?? policy.institutionId;
}

function visibilityScopeCode(visibilityScope: string): string | undefined {
  const [, code] = visibilityScope.split(':');
  return code;
}

function isVisibleToPolicy(
  source: V1KnowledgeBaseDemoSourceValidRecord,
  policy: V1KnowledgeBaseDemoSourceReadonlyPolicy,
): boolean {
  if (policy.viewerScope === 'platform') {
    return true;
  }

  if (source.visibilityScope === 'platform_global') {
    return true;
  }

  const viewerCode = viewerInstitutionCode(policy);

  if (source.visibilityScope.startsWith('specified_institution:')) {
    return viewerCode !== undefined && visibilityScopeCode(source.visibilityScope) === viewerCode;
  }

  if (source.visibilityScope.startsWith('institution_private:')) {
    return viewerCode !== undefined && visibilityScopeCode(source.visibilityScope) === viewerCode;
  }

  return source.visibilityScope === 'institution_private' && source.institutionId === viewerCode;
}

function usableSources(
  input: V1KnowledgeBaseDemoSourceInput,
  policy: V1KnowledgeBaseDemoSourceReadonlyPolicy,
): V1KnowledgeBaseDemoSourceValidRecord[] {
  return (input.sources ?? [])
    .filter(hasLowSensitiveDemoSource)
    .filter((source) => matchesPolicyBoundary(source, policy))
    .filter((source) => isVisibleToPolicy(source, policy));
}

function hasInvalidSourceWithinBoundary(
  input: V1KnowledgeBaseDemoSourceInput,
  policy: V1KnowledgeBaseDemoSourceReadonlyPolicy,
): boolean {
  return (input.sources ?? []).some(
    (source) => matchesPolicyBoundary(source, policy) && !hasLowSensitiveDemoSource(source),
  );
}

function scopeForSource(
  source: V1KnowledgeBaseDemoSourceValidRecord,
): 'platform_knowledge_base' | 'institution_knowledge_base' {
  return source.knowledgeBaseType === 'platform'
    ? 'platform_knowledge_base'
    : 'institution_knowledge_base';
}

function titleForSource(source: V1KnowledgeBaseDemoSourceValidRecord): string {
  return `${source.catalogPath.join(' / ')} / ${source.knowledgeItemId}`;
}

function lowSensitiveSummaryForSource(source: V1KnowledgeBaseDemoSourceValidRecord): string {
  return `${source.sourceType} / ${source.sourceLabel} / ${source.version}`;
}

function versionStatusForSource(
  source: V1KnowledgeBaseDemoSourceValidRecord,
): V1KnowledgeBaseDemoSourceVersionStatus {
  if (source.publishStatus === 'archived' || source.publishStatus === 'disabled') {
    return 'deprecated';
  }

  if (source.publishStatus === 'draft' || source.reviewStatus === 'pending') {
    return 'reviewing';
  }

  return 'current';
}

function permissionStatusForSource(
  source: V1KnowledgeBaseDemoSourceValidRecord,
): V1KnowledgeBaseDemoSourcePermissionStatus {
  return source.visibilityScope === 'platform_global' ? 'visible' : 'restricted';
}

function toKnowledgeBaseCandidate(source: V1KnowledgeBaseDemoSourceValidRecord) {
  return {
    scope: scopeForSource(source),
    knowledgeType: source.knowledgeType,
    title: titleForSource(source),
    lowSensitiveSummary: lowSensitiveSummaryForSource(source),
    sourceLabel: source.sourceLabel,
    visibilityScope: source.visibilityScope,
    publishStatus: source.publishStatus,
    versionSummary: source.version,
    versionStatus: versionStatusForSource(source),
    permissionStatus: permissionStatusForSource(source),
    mockSeedDemoFlag: source.mockSeedDemoFlag,
  };
}

function toAuditCandidate(
  source: V1KnowledgeBaseDemoSourceValidRecord,
): V1KnowledgeBaseAuditReadonlyCandidateInput {
  return {
    knowledgeBaseId: source.knowledgeBaseId,
    tenantId: source.tenantId,
    institutionId: source.institutionId,
    workspaceId: source.workspaceId,
    scope: scopeForSource(source),
    knowledgeType: source.knowledgeType,
    sourceType: source.sourceType,
    sourceLabel: source.sourceLabel,
    reviewStatus: source.reviewStatus,
    publishStatus: source.publishStatus,
    visibilityScope: source.visibilityScope,
    lastReviewedAt: source.lastReviewedAt,
    lastPublishedAt: source.lastPublishedAt,
    lastRetiredAt: source.lastRetiredAt,
    citationSourceSummary: source.citationSourceSummary,
    riskFlags: [...source.riskFlags],
    mockSeedDemoFlag: source.mockSeedDemoFlag,
  };
}

export function buildV1KnowledgeBaseDemoSourceGovernanceReadonlyInput(
  input: V1KnowledgeBaseDemoSourceInput,
  policy: V1KnowledgeBaseDemoSourceReadonlyPolicy,
): V1KnowledgeBaseGovernanceReadonlyInput {
  if (
    !policy.featureEnabled ||
    !policy.canReadKnowledgeBaseDemoSource ||
    !policy.tenantScopeMatched ||
    !policy.workspaceScopeMatched ||
    !policy.institutionScopeMatched
  ) {
    return { knowledgeBaseCandidates: [], auditCandidates: [] };
  }

  const sources = usableSources(input, policy);

  return {
    knowledgeBaseCandidates: sources.map((source) => toKnowledgeBaseCandidate(source)),
    auditCandidates: sources.map((source) => toAuditCandidate(source)),
  };
}

function countByPublishStatus(
  sources: readonly V1KnowledgeBaseDemoSourceValidRecord[],
  baseType: V1KnowledgeBaseDemoSourceType,
): string {
  const items = sources.filter((source) => source.knowledgeBaseType === baseType);
  const published = items.filter((source) => source.publishStatus === 'published').length;
  const draft = items.filter((source) => source.publishStatus === 'draft').length;
  const archived = items.filter((source) => source.publishStatus === 'archived').length;
  const disabled = items.filter((source) => source.publishStatus === 'disabled').length;
  const prefix = baseType === 'platform' ? 'platform_items' : 'institution_items';

  return `${prefix}:${items.length} / published:${published} / draft:${draft} / archived:${archived} / disabled:${disabled}`;
}

export function buildV1PlatformKnowledgeBaseDemoSourceReadonlySummary(
  input: V1KnowledgeBaseDemoSourceInput,
  policy: V1KnowledgeBaseDemoSourceReadonlyPolicy,
): string {
  return countByPublishStatus(usableSources(input, policy), 'platform');
}

export function buildV1InstitutionKnowledgeBaseDemoSourceReadonlySummary(
  input: V1KnowledgeBaseDemoSourceInput,
  policy: V1KnowledgeBaseDemoSourceReadonlyPolicy,
): string {
  return countByPublishStatus(usableSources(input, policy), 'institution');
}

function summaryBase(
  policy: V1KnowledgeBaseDemoSourceReadonlyPolicy,
): Pick<
  V1KnowledgeBaseDemoSourceReadonlySummary,
  | 'tenantId'
  | 'institutionId'
  | 'workspaceId'
  | 'platformKnowledgeBaseSummary'
  | 'institutionKnowledgeBaseSummary'
  | 'governanceInputSummary'
  | 'governanceSummary'
  | 'riskFlags'
  | 'recommendedReadonlyActions'
> {
  return {
    tenantId: policy.tenantId ?? notAvailable,
    institutionId: policy.institutionId ?? notAvailable,
    workspaceId: policy.workspaceId ?? notAvailable,
    platformKnowledgeBaseSummary: notAvailable,
    institutionKnowledgeBaseSummary: notAvailable,
    governanceInputSummary: notAvailable,
    governanceSummary: notAvailable,
    riskFlags: [],
    recommendedReadonlyActions: [],
  };
}

function blockedSummary(
  policy: V1KnowledgeBaseDemoSourceReadonlyPolicy,
  status: 'disabled' | 'denied' | 'empty',
  reasonCode: 'feature_flag_disabled' | 'tenant_scope_mismatch' | 'permission_denied' | 'no_knowledge_base_demo_sources',
): V1KnowledgeBaseDemoSourceReadonlySummary {
  if (status === 'disabled') {
    return {
      status,
      reasonCode,
      resultCode: 'skipped',
      readonly: true,
      emptyCopy: disabledCopy,
      ...summaryBase(policy),
      sourceStatus: 'disabled',
    };
  }

  if (status === 'empty') {
    return {
      status,
      reasonCode,
      resultCode: 'empty',
      readonly: true,
      emptyCopy,
      ...summaryBase(policy),
      sourceStatus: 'empty',
    };
  }

  return {
    status,
    reasonCode,
    resultCode: 'denied',
    readonly: true,
    exceptionCopy: deniedCopy,
    ...summaryBase(policy),
    sourceStatus: 'denied',
  };
}

function readonlyActions(riskFlags: readonly string[]): string[] {
  const actions: string[] = [];

  if (riskFlags.includes('demo_source_missing')) {
    actions.push('review_demo_source_readonly');
  }

  if (riskFlags.includes('stale_demo_source_present')) {
    actions.push('review_stale_demo_source_readonly');
  }

  return actions;
}

function isStaleSource(source: V1KnowledgeBaseDemoSourceValidRecord): boolean {
  return source.reviewStatus === 'stale' || source.riskFlags.includes('stale_reference');
}

function toGovernancePolicy(
  policy: V1KnowledgeBaseDemoSourceReadonlyPolicy,
): V1KnowledgeBaseGovernanceReadonlyPolicy {
  return {
    featureEnabled: policy.featureEnabled,
    canReadKnowledgeBaseGovernance: policy.canReadKnowledgeBaseDemoSource,
    tenantScopeMatched: policy.tenantScopeMatched,
    workspaceScopeMatched: policy.workspaceScopeMatched,
    institutionScopeMatched: policy.institutionScopeMatched,
    tenantId: policy.tenantId,
    institutionId: policy.institutionId,
    workspaceId: policy.workspaceId,
    viewerScope: policy.viewerScope,
    viewerInstitutionScopeCode: policy.viewerInstitutionScopeCode,
  };
}

function governanceInputSummary(input: V1KnowledgeBaseGovernanceReadonlyInput): string {
  const knowledgeBaseCount = input.knowledgeBaseCandidates?.length ?? 0;
  const auditCount = input.auditCandidates?.length ?? 0;

  return `knowledge_base_candidates:${knowledgeBaseCount} / audit_candidates:${auditCount}`;
}

function governanceSummary(input: V1KnowledgeBaseGovernanceReadonlyInput, policy: V1KnowledgeBaseDemoSourceReadonlyPolicy): string {
  const summary = buildV1KnowledgeBaseGovernanceReadonlySummary(input, toGovernancePolicy(policy));

  return `${summary.status} / ${summary.governanceStatus}`;
}

export function buildV1KnowledgeBaseDemoSourceReadonlySummary(
  input: V1KnowledgeBaseDemoSourceInput,
  policy: V1KnowledgeBaseDemoSourceReadonlyPolicy,
): V1KnowledgeBaseDemoSourceReadonlySummary {
  const sources = input.sources ?? [];

  if (!policy.featureEnabled) {
    return blockedSummary(policy, 'disabled', 'feature_flag_disabled');
  }

  if (!policy.tenantScopeMatched || !policy.workspaceScopeMatched || !policy.institutionScopeMatched) {
    return blockedSummary(policy, 'denied', 'tenant_scope_mismatch');
  }

  if (!policy.canReadKnowledgeBaseDemoSource) {
    return blockedSummary(policy, 'denied', 'permission_denied');
  }

  if (sources.length === 0) {
    return blockedSummary(policy, 'empty', 'no_knowledge_base_demo_sources');
  }

  const retainedSources = usableSources(input, policy);
  const sourceMissing = hasInvalidSourceWithinBoundary(input, policy);
  const riskFlags: string[] = [];

  if (sourceMissing) {
    riskFlags.push('demo_source_missing');
  }

  if (retainedSources.length === 0) {
    return {
      status: 'exception',
      reasonCode: 'knowledge_base_demo_source_missing',
      resultCode: 'unavailable',
      readonly: true,
      exceptionCopy: sourceMissingCopy,
      tenantId: policy.tenantId ?? notAvailable,
      institutionId: policy.institutionId ?? notAvailable,
      workspaceId: policy.workspaceId ?? notAvailable,
      platformKnowledgeBaseSummary: notAvailable,
      institutionKnowledgeBaseSummary: notAvailable,
      governanceInputSummary: notAvailable,
      governanceSummary: notAvailable,
      sourceStatus: 'source_missing',
      riskFlags: riskFlags.length > 0 ? riskFlags : ['demo_source_missing'],
      recommendedReadonlyActions: readonlyActions(
        riskFlags.length > 0 ? riskFlags : ['demo_source_missing'],
      ),
    };
  }

  const governanceInput = buildV1KnowledgeBaseDemoSourceGovernanceReadonlyInput(input, policy);
  const hasStale = retainedSources.some(isStaleSource);

  if (sourceMissing) {
    return {
      status: 'partial',
      reasonCode: 'knowledge_base_demo_source_partial',
      resultCode: 'partial',
      readonly: true,
      exceptionCopy: partialCopy,
      tenantId: policy.tenantId ?? notAvailable,
      institutionId: policy.institutionId ?? notAvailable,
      workspaceId: policy.workspaceId ?? notAvailable,
      platformKnowledgeBaseSummary: countByPublishStatus(retainedSources, 'platform'),
      institutionKnowledgeBaseSummary: countByPublishStatus(retainedSources, 'institution'),
      governanceInputSummary: governanceInputSummary(governanceInput),
      governanceSummary: governanceSummary(governanceInput, policy),
      sourceStatus: 'partial',
      riskFlags,
      recommendedReadonlyActions: readonlyActions(riskFlags),
    };
  }

  if (hasStale) {
    const staleRiskFlags = ['stale_demo_source_present'];

    return {
      status: 'stale',
      reasonCode: 'knowledge_base_demo_source_stale',
      resultCode: 'stale',
      readonly: true,
      staleCopy,
      tenantId: policy.tenantId ?? notAvailable,
      institutionId: policy.institutionId ?? notAvailable,
      workspaceId: policy.workspaceId ?? notAvailable,
      platformKnowledgeBaseSummary: countByPublishStatus(retainedSources, 'platform'),
      institutionKnowledgeBaseSummary: countByPublishStatus(retainedSources, 'institution'),
      governanceInputSummary: governanceInputSummary(governanceInput),
      governanceSummary: governanceSummary(governanceInput, policy),
      sourceStatus: 'stale',
      riskFlags: staleRiskFlags,
      recommendedReadonlyActions: readonlyActions(staleRiskFlags),
    };
  }

  return {
    status: 'ready',
    reasonCode: 'knowledge_base_demo_source_ready',
    resultCode: 'readonly',
    readonly: true,
    tenantId: policy.tenantId ?? notAvailable,
    institutionId: policy.institutionId ?? notAvailable,
    workspaceId: policy.workspaceId ?? notAvailable,
    platformKnowledgeBaseSummary: countByPublishStatus(retainedSources, 'platform'),
    institutionKnowledgeBaseSummary: countByPublishStatus(retainedSources, 'institution'),
    governanceInputSummary: governanceInputSummary(governanceInput),
    governanceSummary: governanceSummary(governanceInput, policy),
    sourceStatus: 'ready',
    riskFlags: [],
    recommendedReadonlyActions: [],
  };
}
