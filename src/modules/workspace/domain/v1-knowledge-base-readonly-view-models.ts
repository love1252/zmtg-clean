import { evaluateV1ReadonlyFeaturePolicy } from './v1-readonly-feature-policy';

export type V1KnowledgeBaseReadonlyPolicy = {
  featureEnabled: boolean;
  canReadKnowledgeBase: boolean;
  tenantScopeMatched: boolean;
};

export type V1KnowledgeBaseScope =
  | 'platform_knowledge_base'
  | 'institution_knowledge_base';

export const v1PlatformKnowledgeBaseTypes = [
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

export const v1InstitutionKnowledgeBaseTypes = [
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

export type V1PlatformKnowledgeBaseType = (typeof v1PlatformKnowledgeBaseTypes)[number];
export type V1InstitutionKnowledgeBaseType =
  (typeof v1InstitutionKnowledgeBaseTypes)[number];
export type V1KnowledgeBaseType =
  | V1PlatformKnowledgeBaseType
  | V1InstitutionKnowledgeBaseType;

export type V1KnowledgeBasePublishStatus =
  | 'draft'
  | 'published'
  | 'archived'
  | 'disabled';

export type V1KnowledgeBaseVersionStatus =
  | 'current'
  | 'reviewing'
  | 'deprecated';

export type V1KnowledgeBasePermissionStatus = 'visible' | 'restricted';

export type V1KnowledgeBaseReadonlyCandidateInput = {
  scope?: V1KnowledgeBaseScope;
  knowledgeType?: V1KnowledgeBaseType;
  title?: string;
  lowSensitiveSummary?: string;
  sourceLabel?: string;
  visibilityScope?: string;
  publishStatus?: V1KnowledgeBasePublishStatus;
  versionSummary?: string;
  versionStatus?: V1KnowledgeBaseVersionStatus;
  permissionStatus?: V1KnowledgeBasePermissionStatus;
  mockSeedDemoFlag?: 'mock' | 'seed' | 'demo';
  [key: string]: unknown;
};

type V1KnowledgeBaseReadonlyValidCandidate = V1KnowledgeBaseReadonlyCandidateInput & {
  scope: V1KnowledgeBaseScope;
  knowledgeType: V1KnowledgeBaseType;
  title: string;
  lowSensitiveSummary: string;
  sourceLabel: string;
  visibilityScope: string;
  publishStatus: V1KnowledgeBasePublishStatus;
  versionSummary: string;
  versionStatus: V1KnowledgeBaseVersionStatus;
  permissionStatus: V1KnowledgeBasePermissionStatus;
  mockSeedDemoFlag: 'mock' | 'seed' | 'demo';
};

export type V1KnowledgeBaseReadonlyInput = {
  candidates?: readonly V1KnowledgeBaseReadonlyCandidateInput[];
};

export type V1KnowledgeBaseReadonlyStatus =
  | 'disabled'
  | 'denied'
  | 'empty'
  | 'exception'
  | 'ready';

export type V1KnowledgeBaseReadonlyResultCode =
  | 'skipped'
  | 'denied'
  | 'empty'
  | 'unavailable'
  | 'readonly';

export const defaultV1KnowledgeBaseReadonlyPolicy = {
  featureEnabled: false,
  canReadKnowledgeBase: false,
  tenantScopeMatched: false,
} as const satisfies V1KnowledgeBaseReadonlyPolicy;

export const v1KnowledgeBaseReadonlyItemFields = [
  'scope',
  'knowledgeType',
  'title',
  'lowSensitiveSummary',
  'sourceLabel',
  'visibilityScope',
  'publishStatus',
  'versionSummary',
  'versionStatus',
  'permissionStatus',
  'mockSeedDemoFlag',
  'readonly',
  'reasonCode',
  'resultCode',
] as const;

export type V1KnowledgeBaseReadonlyItem = {
  scope: V1KnowledgeBaseScope;
  knowledgeType: V1KnowledgeBaseType;
  title: string;
  lowSensitiveSummary: string;
  sourceLabel: string;
  visibilityScope: string;
  publishStatus: V1KnowledgeBasePublishStatus;
  versionSummary: string;
  versionStatus: V1KnowledgeBaseVersionStatus;
  permissionStatus: V1KnowledgeBasePermissionStatus;
  mockSeedDemoFlag: 'mock' | 'seed' | 'demo';
  readonly: true;
  reasonCode:
    | 'knowledge_base_item_ready'
    | 'knowledge_base_item_draft'
    | 'knowledge_base_item_archived'
    | 'knowledge_base_item_disabled';
  resultCode: 'readonly';
};

export type V1KnowledgeBaseReadonlySummary = {
  status: V1KnowledgeBaseReadonlyStatus;
  reasonCode:
    | 'feature_flag_disabled'
    | 'tenant_scope_mismatch'
    | 'permission_denied'
    | 'no_knowledge_base_candidates'
    | 'knowledge_base_source_missing'
    | 'knowledge_base_ready';
  resultCode: V1KnowledgeBaseReadonlyResultCode;
  readonly: true;
  emptyCopy?: string;
  exceptionCopy?: string;
  items: V1KnowledgeBaseReadonlyItem[];
};

const disabledCopy = '该知识库只读能力暂未开启';
const emptyCopy = '暂无可展示知识库目录';
const deniedCopy = '当前账号没有访问权限';
const sourceMissingCopy = '知识库来源不完整，仅作内部参考';
const knowledgeBaseReadonlyPolicyReasonCodes = {
  empty: 'no_knowledge_base_candidates',
  exception: 'knowledge_base_source_missing',
  ready: 'knowledge_base_ready',
} as const;
const knowledgeBaseReadonlyPolicyCopies = {
  disabled: disabledCopy,
  denied: deniedCopy,
  empty: emptyCopy,
  exception: sourceMissingCopy,
} as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isKnowledgeBaseScope(value: unknown): value is V1KnowledgeBaseScope {
  return value === 'platform_knowledge_base' || value === 'institution_knowledge_base';
}

function isPlatformKnowledgeBaseType(value: unknown): value is V1PlatformKnowledgeBaseType {
  return v1PlatformKnowledgeBaseTypes.includes(value as V1PlatformKnowledgeBaseType);
}

function isInstitutionKnowledgeBaseType(
  value: unknown,
): value is V1InstitutionKnowledgeBaseType {
  return v1InstitutionKnowledgeBaseTypes.includes(value as V1InstitutionKnowledgeBaseType);
}

function isKnowledgeTypeAllowedForScope(
  scope: V1KnowledgeBaseScope,
  knowledgeType: unknown,
): knowledgeType is V1KnowledgeBaseType {
  if (scope === 'platform_knowledge_base') {
    return isPlatformKnowledgeBaseType(knowledgeType);
  }

  return isInstitutionKnowledgeBaseType(knowledgeType);
}

function isPublishStatus(value: unknown): value is V1KnowledgeBasePublishStatus {
  return (
    value === 'draft' ||
    value === 'published' ||
    value === 'archived' ||
    value === 'disabled'
  );
}

function isVersionStatus(value: unknown): value is V1KnowledgeBaseVersionStatus {
  return value === 'current' || value === 'reviewing' || value === 'deprecated';
}

function isPermissionStatus(value: unknown): value is V1KnowledgeBasePermissionStatus {
  return value === 'visible' || value === 'restricted';
}

function isMockSeedDemoFlag(value: unknown): value is 'mock' | 'seed' | 'demo' {
  return value === 'mock' || value === 'seed' || value === 'demo';
}

function hasRequiredLowSensitiveKnowledgeBaseSource(
  candidate: V1KnowledgeBaseReadonlyCandidateInput,
): candidate is V1KnowledgeBaseReadonlyValidCandidate {
  return (
    isKnowledgeBaseScope(candidate.scope) &&
    isKnowledgeTypeAllowedForScope(candidate.scope, candidate.knowledgeType) &&
    isNonEmptyString(candidate.title) &&
    isNonEmptyString(candidate.lowSensitiveSummary) &&
    isNonEmptyString(candidate.sourceLabel) &&
    isNonEmptyString(candidate.visibilityScope) &&
    isPublishStatus(candidate.publishStatus) &&
    isNonEmptyString(candidate.versionSummary) &&
    isVersionStatus(candidate.versionStatus) &&
    isPermissionStatus(candidate.permissionStatus) &&
    isMockSeedDemoFlag(candidate.mockSeedDemoFlag)
  );
}

function reasonCodeForPublishStatus(
  publishStatus: V1KnowledgeBasePublishStatus,
): V1KnowledgeBaseReadonlyItem['reasonCode'] {
  if (publishStatus === 'draft') {
    return 'knowledge_base_item_draft';
  }

  if (publishStatus === 'archived') {
    return 'knowledge_base_item_archived';
  }

  if (publishStatus === 'disabled') {
    return 'knowledge_base_item_disabled';
  }

  return 'knowledge_base_item_ready';
}

function toReadonlyKnowledgeBaseItem(
  candidate: V1KnowledgeBaseReadonlyCandidateInput,
): V1KnowledgeBaseReadonlyItem | null {
  if (!hasRequiredLowSensitiveKnowledgeBaseSource(candidate)) {
    return null;
  }

  return {
    scope: candidate.scope,
    knowledgeType: candidate.knowledgeType,
    title: candidate.title,
    lowSensitiveSummary: candidate.lowSensitiveSummary,
    sourceLabel: candidate.sourceLabel,
    visibilityScope: candidate.visibilityScope,
    publishStatus: candidate.publishStatus,
    versionSummary: candidate.versionSummary,
    versionStatus: candidate.versionStatus,
    permissionStatus: candidate.permissionStatus,
    mockSeedDemoFlag: candidate.mockSeedDemoFlag,
    readonly: true,
    reasonCode: reasonCodeForPublishStatus(candidate.publishStatus),
    resultCode: 'readonly',
  };
}

function evaluateKnowledgeBaseReadonlyPolicy(
  policy: V1KnowledgeBaseReadonlyPolicy,
  candidateCount: number,
  readonlyItemCount?: number,
) {
  return evaluateV1ReadonlyFeaturePolicy({
    featureEnabled: policy.featureEnabled,
    tenantScopeMatched: policy.tenantScopeMatched,
    canRead: policy.canReadKnowledgeBase,
    candidateCount,
    ...(readonlyItemCount === undefined ? {} : { readonlyItemCount }),
    reasonCodes: knowledgeBaseReadonlyPolicyReasonCodes,
    copies: knowledgeBaseReadonlyPolicyCopies,
  });
}

function toKnowledgeBaseReadonlyEmptySummary(
  result: ReturnType<typeof evaluateKnowledgeBaseReadonlyPolicy>,
): V1KnowledgeBaseReadonlySummary {
  return {
    status: result.status,
    reasonCode: result.reasonCode,
    resultCode: result.resultCode,
    readonly: true,
    ...(result.emptyCopy === undefined ? {} : { emptyCopy: result.emptyCopy }),
    ...(result.exceptionCopy === undefined ? {} : { exceptionCopy: result.exceptionCopy }),
    items: [],
  };
}

export function buildV1KnowledgeBaseReadonlySummary(
  input: V1KnowledgeBaseReadonlyInput,
  policy: V1KnowledgeBaseReadonlyPolicy,
): V1KnowledgeBaseReadonlySummary {
  const candidates = input.candidates ?? [];
  const guardResult = evaluateKnowledgeBaseReadonlyPolicy(policy, candidates.length);

  if (guardResult.status !== 'ready') {
    return toKnowledgeBaseReadonlyEmptySummary(guardResult);
  }

  const items = candidates
    .map((candidate) => toReadonlyKnowledgeBaseItem(candidate))
    .filter((item): item is V1KnowledgeBaseReadonlyItem => item !== null);
  const finalPolicyResult = evaluateKnowledgeBaseReadonlyPolicy(
    policy,
    candidates.length,
    items.length,
  );

  if (finalPolicyResult.status !== 'ready') {
    return toKnowledgeBaseReadonlyEmptySummary(finalPolicyResult);
  }

  return {
    status: finalPolicyResult.status,
    reasonCode: finalPolicyResult.reasonCode,
    resultCode: finalPolicyResult.resultCode,
    readonly: true,
    items,
  };
}
