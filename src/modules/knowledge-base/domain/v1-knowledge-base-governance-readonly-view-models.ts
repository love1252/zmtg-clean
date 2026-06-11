import {
  buildV1KnowledgeBaseAuditReadonlySummary,
  type V1KnowledgeBaseAuditReadonlyCandidateInput,
  type V1KnowledgeBaseAuditReadonlyPolicy,
  type V1KnowledgeBaseAuditReadonlySummary,
} from './v1-knowledge-base-audit-readonly-view-models';
import {
  buildV1KnowledgeBaseCatalogReadonlySummary,
  type V1KnowledgeBaseCatalogReadonlySummary,
} from '../../workspace/domain/v1-knowledge-base-catalog-readonly-view-models';
import {
  buildV1KnowledgeBaseReadonlySummary,
  type V1KnowledgeBaseReadonlyCandidateInput,
  type V1KnowledgeBaseReadonlySummary,
  type V1KnowledgeBaseScope,
} from '../../workspace/domain/v1-knowledge-base-readonly-view-models';
import {
  buildV1KnowledgeBaseVersionVisibilityReadonlySummary,
  type V1KnowledgeBaseVersionVisibilityReadonlyItem,
  type V1KnowledgeBaseVersionVisibilityReadonlySummary,
} from '../../workspace/domain/v1-knowledge-base-version-visibility-readonly-view-models';

export type V1KnowledgeBaseGovernanceReadonlyPolicy = {
  featureEnabled: boolean;
  canReadKnowledgeBaseGovernance: boolean;
  tenantScopeMatched: boolean;
  workspaceScopeMatched: boolean;
  institutionScopeMatched: boolean;
  tenantId?: string;
  institutionId?: string;
  workspaceId?: string;
  viewerScope: 'platform' | 'institution';
  viewerInstitutionScopeCode?: string;
};

export type V1KnowledgeBaseGovernanceReadonlyInput = {
  knowledgeBaseCandidates?: readonly V1KnowledgeBaseReadonlyCandidateInput[];
  auditCandidates?: readonly V1KnowledgeBaseAuditReadonlyCandidateInput[];
};

export type V1KnowledgeBaseGovernanceReadonlyStatus =
  | 'disabled'
  | 'denied'
  | 'empty'
  | 'exception'
  | 'partial'
  | 'stale'
  | 'ready';

export type V1KnowledgeBaseGovernanceReadonlyResultCode =
  | 'skipped'
  | 'denied'
  | 'empty'
  | 'unavailable'
  | 'partial'
  | 'stale'
  | 'readonly';

export type V1KnowledgeBaseGovernanceStatus =
  | 'disabled'
  | 'denied'
  | 'empty'
  | 'source_missing'
  | 'partial'
  | 'stale'
  | 'ready';

export const defaultV1KnowledgeBaseGovernanceReadonlyPolicy = {
  featureEnabled: false,
  canReadKnowledgeBaseGovernance: false,
  tenantScopeMatched: false,
  workspaceScopeMatched: false,
  institutionScopeMatched: false,
  viewerScope: 'institution',
} as const satisfies V1KnowledgeBaseGovernanceReadonlyPolicy;

export const v1KnowledgeBaseGovernanceReadonlySummaryFields = [
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
  'boundarySummary',
  'catalogSummary',
  'versionSummary',
  'visibilitySummary',
  'auditSummary',
  'governanceStatus',
  'riskFlags',
  'recommendedReadonlyActions',
] as const;

export type V1KnowledgeBaseGovernanceReadonlySummary = {
  status: V1KnowledgeBaseGovernanceReadonlyStatus;
  reasonCode:
    | 'feature_flag_disabled'
    | 'tenant_scope_mismatch'
    | 'permission_denied'
    | 'no_knowledge_base_governance_candidates'
    | 'knowledge_base_governance_source_missing'
    | 'knowledge_base_governance_partial'
    | 'knowledge_base_governance_stale'
    | 'knowledge_base_governance_ready';
  resultCode: V1KnowledgeBaseGovernanceReadonlyResultCode;
  readonly: true;
  emptyCopy?: string;
  exceptionCopy?: string;
  staleCopy?: string;
  tenantId: string;
  institutionId: string;
  workspaceId: string;
  platformKnowledgeBaseSummary: string;
  institutionKnowledgeBaseSummary: string;
  boundarySummary: string;
  catalogSummary: string;
  versionSummary: string;
  visibilitySummary: string;
  auditSummary: string;
  governanceStatus: V1KnowledgeBaseGovernanceStatus;
  riskFlags: readonly string[];
  recommendedReadonlyActions: readonly string[];
};

const disabledCopy = '该知识库治理总览只读能力暂未开启';
const emptyCopy = '暂无可展示知识库治理总览';
const deniedCopy = '当前账号没有访问权限';
const sourceMissingCopy = '知识库治理总览来源不完整，仅作内部参考';
const partialCopy = '知识库治理总览部分来源不完整，仅展示可用只读摘要';
const staleCopy = '知识库治理总览可能已过期';
const notAvailable = 'not_available';

function summaryBase(
  policy: V1KnowledgeBaseGovernanceReadonlyPolicy,
): Pick<
  V1KnowledgeBaseGovernanceReadonlySummary,
  | 'tenantId'
  | 'institutionId'
  | 'workspaceId'
  | 'platformKnowledgeBaseSummary'
  | 'institutionKnowledgeBaseSummary'
  | 'boundarySummary'
  | 'catalogSummary'
  | 'versionSummary'
  | 'visibilitySummary'
  | 'auditSummary'
  | 'riskFlags'
  | 'recommendedReadonlyActions'
> {
  return {
    tenantId: policy.tenantId ?? notAvailable,
    institutionId: policy.institutionId ?? notAvailable,
    workspaceId: policy.workspaceId ?? notAvailable,
    platformKnowledgeBaseSummary: notAvailable,
    institutionKnowledgeBaseSummary: notAvailable,
    boundarySummary: notAvailable,
    catalogSummary: notAvailable,
    versionSummary: notAvailable,
    visibilitySummary: notAvailable,
    auditSummary: notAvailable,
    riskFlags: [],
    recommendedReadonlyActions: [],
  };
}

function blockedSummary(
  policy: V1KnowledgeBaseGovernanceReadonlyPolicy,
  status: 'disabled' | 'denied' | 'empty',
  reasonCode:
    | 'feature_flag_disabled'
    | 'tenant_scope_mismatch'
    | 'permission_denied'
    | 'no_knowledge_base_governance_candidates',
): V1KnowledgeBaseGovernanceReadonlySummary {
  if (status === 'disabled') {
    return {
      status,
      reasonCode,
      resultCode: 'skipped',
      readonly: true,
      emptyCopy: disabledCopy,
      ...summaryBase(policy),
      governanceStatus: 'disabled',
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
      governanceStatus: 'empty',
    };
  }

  return {
    status,
    reasonCode,
    resultCode: 'denied',
    readonly: true,
    exceptionCopy: deniedCopy,
    ...summaryBase(policy),
    governanceStatus: 'denied',
  };
}

function toBoundaryPolicy(policy: V1KnowledgeBaseGovernanceReadonlyPolicy) {
  return {
    featureEnabled: policy.featureEnabled,
    canReadKnowledgeBase: policy.canReadKnowledgeBaseGovernance,
    tenantScopeMatched: policy.tenantScopeMatched,
  };
}

function toCatalogPolicy(policy: V1KnowledgeBaseGovernanceReadonlyPolicy) {
  return {
    featureEnabled: policy.featureEnabled,
    canReadKnowledgeBaseCatalog: policy.canReadKnowledgeBaseGovernance,
    tenantScopeMatched: policy.tenantScopeMatched,
  };
}

function toVersionPolicy(
  policy: V1KnowledgeBaseGovernanceReadonlyPolicy,
  viewerScope: 'platform' | 'institution',
) {
  return {
    featureEnabled: policy.featureEnabled,
    canReadKnowledgeBaseVersionVisibility: policy.canReadKnowledgeBaseGovernance,
    tenantScopeMatched: policy.tenantScopeMatched,
    viewerScope,
    ...(viewerScope === 'institution'
      ? { viewerInstitutionScopeCode: policy.viewerInstitutionScopeCode ?? policy.institutionId }
      : {}),
  };
}

function toAuditPolicy(
  policy: V1KnowledgeBaseGovernanceReadonlyPolicy,
): V1KnowledgeBaseAuditReadonlyPolicy {
  return {
    featureEnabled: policy.featureEnabled,
    canReadKnowledgeBaseAudit: policy.canReadKnowledgeBaseGovernance,
    tenantScopeMatched: policy.tenantScopeMatched,
    workspaceScopeMatched: policy.workspaceScopeMatched,
    institutionScopeMatched: policy.institutionScopeMatched,
    tenantId: policy.tenantId,
    workspaceId: policy.workspaceId,
    institutionId: policy.institutionId,
  };
}

function statusLine(summary: { status: string; items: readonly unknown[] }): string {
  return `${summary.status} / items:${summary.items.length}`;
}

function countByPublishStatus(
  boundary: V1KnowledgeBaseReadonlySummary,
  scope: V1KnowledgeBaseScope,
): string {
  const items = boundary.items.filter((item) => item.scope === scope);
  const published = items.filter((item) => item.publishStatus === 'published').length;
  const draft = items.filter((item) => item.publishStatus === 'draft').length;
  const archived = items.filter((item) => item.publishStatus === 'archived').length;
  const disabled = items.filter((item) => item.publishStatus === 'disabled').length;
  const prefix = scope === 'platform_knowledge_base' ? 'platform_items' : 'institution_items';

  return `${prefix}:${items.length} / published:${published} / draft:${draft} / archived:${archived} / disabled:${disabled}`;
}

function versionItems(
  platformVersion: V1KnowledgeBaseVersionVisibilityReadonlySummary,
  institutionVersion: V1KnowledgeBaseVersionVisibilityReadonlySummary,
): V1KnowledgeBaseVersionVisibilityReadonlyItem[] {
  return [...platformVersion.items, ...institutionVersion.items];
}

function versionStatusSummary(items: readonly V1KnowledgeBaseVersionVisibilityReadonlyItem[]): string {
  const current = items.filter((item) => item.versionStatus === 'current').length;
  const reviewing = items.filter((item) => item.versionStatus === 'reviewing').length;
  const deprecated = items.filter((item) => item.versionStatus === 'deprecated').length;

  return `ready / current:${current} / reviewing:${reviewing} / deprecated:${deprecated}`;
}

function visibilityStatusSummary(
  items: readonly V1KnowledgeBaseVersionVisibilityReadonlyItem[],
): string {
  const platformGlobal = items.filter(
    (item) => item.visibilityGovernance === 'platform_global',
  ).length;
  const specifiedInstitution = items.filter(
    (item) => item.visibilityGovernance === 'specified_institution',
  ).length;
  const institutionPrivate = items.filter(
    (item) => item.visibilityGovernance === 'institution_private',
  ).length;

  return `ready / platform_global:${platformGlobal} / specified_institution:${specifiedInstitution} / institution_private:${institutionPrivate}`;
}

function auditStatusSummary(audit: V1KnowledgeBaseAuditReadonlySummary): string {
  const stale = audit.items.filter((item) => item.auditFreshness === 'stale').length;

  return `${audit.status} / items:${audit.items.length} / stale:${stale}`;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function hasReviewingVersion(items: readonly V1KnowledgeBaseVersionVisibilityReadonlyItem[]): boolean {
  return items.some(
    (item) => item.versionStatus === 'reviewing' || item.readiness === 'draft',
  );
}

function governanceRiskFlags(
  boundary: V1KnowledgeBaseReadonlySummary,
  catalog: V1KnowledgeBaseCatalogReadonlySummary,
  versionItemsValue: readonly V1KnowledgeBaseVersionVisibilityReadonlyItem[],
  audit: V1KnowledgeBaseAuditReadonlySummary,
): string[] {
  const flags: string[] = [];

  if (
    boundary.status === 'exception' ||
    catalog.status === 'exception' ||
    audit.status === 'exception' ||
    versionItemsValue.length === 0
  ) {
    flags.push('audit_source_missing');
  }

  if (hasReviewingVersion(versionItemsValue)) {
    flags.push('reviewing_version_present');
  }

  if (audit.status === 'stale' || audit.items.some((item) => item.auditFreshness === 'stale')) {
    flags.push('stale_audit_present');
  }

  return sortedUnique(flags);
}

function recommendedReadonlyActions(riskFlags: readonly string[]): string[] {
  const actions: string[] = [];

  if (riskFlags.includes('reviewing_version_present')) {
    actions.push('review_draft_or_restricted_knowledge_readonly');
  }

  if (riskFlags.includes('audit_source_missing')) {
    actions.push('review_missing_source_readonly');
  }

  if (riskFlags.includes('stale_audit_present')) {
    actions.push('review_stale_audit_source_readonly');
  }

  return actions;
}

function aggregateStatus(
  boundary: V1KnowledgeBaseReadonlySummary,
  catalog: V1KnowledgeBaseCatalogReadonlySummary,
  versionItemsValue: readonly V1KnowledgeBaseVersionVisibilityReadonlyItem[],
  audit: V1KnowledgeBaseAuditReadonlySummary,
): Pick<
  V1KnowledgeBaseGovernanceReadonlySummary,
  'status' | 'reasonCode' | 'resultCode' | 'governanceStatus' | 'exceptionCopy' | 'staleCopy'
> {
  const hasException =
    boundary.status === 'exception' ||
    catalog.status === 'exception' ||
    audit.status === 'exception' ||
    versionItemsValue.length === 0;
  const hasReadyOrStale =
    boundary.status === 'ready' ||
    catalog.status === 'ready' ||
    audit.status === 'ready' ||
    audit.status === 'stale' ||
    versionItemsValue.length > 0;

  if (hasException && hasReadyOrStale) {
    return {
      status: 'partial',
      reasonCode: 'knowledge_base_governance_partial',
      resultCode: 'partial',
      governanceStatus: 'partial',
      exceptionCopy: partialCopy,
    };
  }

  if (hasException) {
    return {
      status: 'exception',
      reasonCode: 'knowledge_base_governance_source_missing',
      resultCode: 'unavailable',
      governanceStatus: 'source_missing',
      exceptionCopy: sourceMissingCopy,
    };
  }

  if (audit.status === 'stale' || audit.items.some((item) => item.auditFreshness === 'stale')) {
    return {
      status: 'stale',
      reasonCode: 'knowledge_base_governance_stale',
      resultCode: 'stale',
      governanceStatus: 'stale',
      staleCopy,
    };
  }

  return {
    status: 'ready',
    reasonCode: 'knowledge_base_governance_ready',
    resultCode: 'readonly',
    governanceStatus: 'ready',
  };
}

export function buildV1KnowledgeBaseGovernanceReadonlySummary(
  input: V1KnowledgeBaseGovernanceReadonlyInput,
  policy: V1KnowledgeBaseGovernanceReadonlyPolicy,
): V1KnowledgeBaseGovernanceReadonlySummary {
  const knowledgeBaseCandidates = input.knowledgeBaseCandidates ?? [];
  const auditCandidates = input.auditCandidates ?? [];

  if (!policy.featureEnabled) {
    return blockedSummary(policy, 'disabled', 'feature_flag_disabled');
  }

  if (!policy.tenantScopeMatched || !policy.workspaceScopeMatched || !policy.institutionScopeMatched) {
    return blockedSummary(policy, 'denied', 'tenant_scope_mismatch');
  }

  if (!policy.canReadKnowledgeBaseGovernance) {
    return blockedSummary(policy, 'denied', 'permission_denied');
  }

  if (knowledgeBaseCandidates.length === 0 && auditCandidates.length === 0) {
    return blockedSummary(policy, 'empty', 'no_knowledge_base_governance_candidates');
  }

  const boundary = buildV1KnowledgeBaseReadonlySummary(
    { candidates: knowledgeBaseCandidates },
    toBoundaryPolicy(policy),
  );
  const catalog = buildV1KnowledgeBaseCatalogReadonlySummary(
    { candidates: knowledgeBaseCandidates },
    toCatalogPolicy(policy),
  );
  const platformVersion = buildV1KnowledgeBaseVersionVisibilityReadonlySummary(
    { candidates: knowledgeBaseCandidates },
    toVersionPolicy(policy, 'platform'),
  );
  const institutionVersion = buildV1KnowledgeBaseVersionVisibilityReadonlySummary(
    { candidates: knowledgeBaseCandidates },
    toVersionPolicy(policy, 'institution'),
  );
  const versionItemsValue = versionItems(platformVersion, institutionVersion);
  const audit = buildV1KnowledgeBaseAuditReadonlySummary(
    { candidates: auditCandidates },
    toAuditPolicy(policy),
  );
  const riskFlags = governanceRiskFlags(boundary, catalog, versionItemsValue, audit);
  const status = aggregateStatus(boundary, catalog, versionItemsValue, audit);

  return {
    status: status.status,
    reasonCode: status.reasonCode,
    resultCode: status.resultCode,
    readonly: true,
    ...(status.exceptionCopy === undefined ? {} : { exceptionCopy: status.exceptionCopy }),
    ...(status.staleCopy === undefined ? {} : { staleCopy: status.staleCopy }),
    tenantId: policy.tenantId ?? notAvailable,
    institutionId: policy.institutionId ?? notAvailable,
    workspaceId: policy.workspaceId ?? notAvailable,
    platformKnowledgeBaseSummary: countByPublishStatus(boundary, 'platform_knowledge_base'),
    institutionKnowledgeBaseSummary: countByPublishStatus(
      boundary,
      'institution_knowledge_base',
    ),
    boundarySummary: statusLine(boundary),
    catalogSummary: statusLine(catalog),
    versionSummary: versionStatusSummary(versionItemsValue),
    visibilitySummary: visibilityStatusSummary(versionItemsValue),
    auditSummary: auditStatusSummary(audit),
    governanceStatus: status.governanceStatus,
    riskFlags,
    recommendedReadonlyActions: recommendedReadonlyActions(riskFlags),
  };
}
