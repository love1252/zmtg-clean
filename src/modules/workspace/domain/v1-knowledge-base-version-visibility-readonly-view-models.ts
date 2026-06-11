import {
  buildV1KnowledgeBaseCatalogReadonlySummary,
  type V1KnowledgeBaseCatalogReadonlyPolicy,
} from './v1-knowledge-base-catalog-readonly-view-models';
import {
  buildV1KnowledgeBaseReadonlySummary,
  type V1KnowledgeBasePublishStatus,
  type V1KnowledgeBaseReadonlyCandidateInput,
  type V1KnowledgeBaseReadonlyItem,
  type V1KnowledgeBaseReadonlyPolicy,
  type V1KnowledgeBaseScope,
  type V1KnowledgeBaseType,
  type V1KnowledgeBaseVersionStatus,
} from './v1-knowledge-base-readonly-view-models';
import { evaluateV1ReadonlyFeaturePolicy } from './v1-readonly-feature-policy';

export type V1KnowledgeBaseVersionVisibilityViewerScope = 'platform' | 'institution';

export type V1KnowledgeBaseVersionVisibilityReadonlyPolicy = {
  featureEnabled: boolean;
  canReadKnowledgeBaseVersionVisibility: boolean;
  tenantScopeMatched: boolean;
  viewerScope: V1KnowledgeBaseVersionVisibilityViewerScope;
  viewerInstitutionScopeCode?: string;
};

export type V1KnowledgeBaseVersionVisibilityReadonlyInput = {
  candidates?: readonly V1KnowledgeBaseReadonlyCandidateInput[];
};

export type V1KnowledgeBaseVersionVisibilityReadonlyStatus =
  | 'disabled'
  | 'denied'
  | 'empty'
  | 'exception'
  | 'ready';

export type V1KnowledgeBaseVersionVisibilityReadonlyResultCode =
  | 'skipped'
  | 'denied'
  | 'empty'
  | 'unavailable'
  | 'readonly';

export type V1KnowledgeBaseVersionVisibilityGovernance =
  | 'platform_global'
  | 'specified_institution'
  | 'institution_private';

export type V1KnowledgeBaseVersionVisibilityReadiness =
  | 'ready'
  | 'draft'
  | 'archived'
  | 'disabled';

export const defaultV1KnowledgeBaseVersionVisibilityReadonlyPolicy = {
  featureEnabled: false,
  canReadKnowledgeBaseVersionVisibility: false,
  tenantScopeMatched: false,
  viewerScope: 'institution',
} as const satisfies V1KnowledgeBaseVersionVisibilityReadonlyPolicy;

export const v1KnowledgeBaseVersionVisibilityReadonlyItemFields = [
  'scope',
  'knowledgeType',
  'versionSummary',
  'versionStatus',
  'publishStatus',
  'publishStatusSummary',
  'visibilityGovernance',
  'visibilityScopeSummary',
  'versionGovernance',
  'readiness',
  'mockSeedDemoFlag',
  'readonly',
  'reasonCode',
  'resultCode',
] as const;

export type V1KnowledgeBaseVersionVisibilityReadonlyItem = {
  scope: V1KnowledgeBaseScope;
  knowledgeType: V1KnowledgeBaseType;
  versionSummary: string;
  versionStatus: V1KnowledgeBaseVersionStatus;
  publishStatus: V1KnowledgeBasePublishStatus;
  publishStatusSummary: string;
  visibilityGovernance: V1KnowledgeBaseVersionVisibilityGovernance;
  visibilityScopeSummary: string;
  versionGovernance: V1KnowledgeBaseVersionStatus;
  readiness: V1KnowledgeBaseVersionVisibilityReadiness;
  mockSeedDemoFlag: 'mock' | 'seed' | 'demo';
  readonly: true;
  reasonCode:
    | 'knowledge_base_version_visibility_ready'
    | 'knowledge_base_version_visibility_draft'
    | 'knowledge_base_version_visibility_archived'
    | 'knowledge_base_version_visibility_disabled';
  resultCode: 'readonly';
};

export type V1KnowledgeBaseVersionVisibilityReadonlySummary = {
  status: V1KnowledgeBaseVersionVisibilityReadonlyStatus;
  reasonCode:
    | 'feature_flag_disabled'
    | 'tenant_scope_mismatch'
    | 'permission_denied'
    | 'no_knowledge_base_version_visibility_candidates'
    | 'knowledge_base_version_visibility_source_missing'
    | 'knowledge_base_version_visibility_ready';
  resultCode: V1KnowledgeBaseVersionVisibilityReadonlyResultCode;
  readonly: true;
  emptyCopy?: string;
  exceptionCopy?: string;
  items: V1KnowledgeBaseVersionVisibilityReadonlyItem[];
};

const disabledCopy = '该知识库版本与可见范围只读能力暂未开启';
const emptyCopy = '暂无可展示知识库版本与可见范围治理';
const deniedCopy = '当前账号没有访问权限';
const sourceMissingCopy = '知识库版本与可见范围来源不完整，仅作内部参考';
const versionVisibilityReasonCodes = {
  empty: 'no_knowledge_base_version_visibility_candidates',
  exception: 'knowledge_base_version_visibility_source_missing',
  ready: 'knowledge_base_version_visibility_ready',
} as const;
const versionVisibilityCopies = {
  disabled: disabledCopy,
  denied: deniedCopy,
  empty: emptyCopy,
  exception: sourceMissingCopy,
} as const;

function toBoundaryPolicy(
  policy: V1KnowledgeBaseVersionVisibilityReadonlyPolicy,
): V1KnowledgeBaseReadonlyPolicy {
  return {
    featureEnabled: policy.featureEnabled,
    canReadKnowledgeBase: policy.canReadKnowledgeBaseVersionVisibility,
    tenantScopeMatched: policy.tenantScopeMatched,
  };
}

function toCatalogPolicy(
  policy: V1KnowledgeBaseVersionVisibilityReadonlyPolicy,
): V1KnowledgeBaseCatalogReadonlyPolicy {
  return {
    featureEnabled: policy.featureEnabled,
    canReadKnowledgeBaseCatalog: policy.canReadKnowledgeBaseVersionVisibility,
    tenantScopeMatched: policy.tenantScopeMatched,
  };
}

function evaluateVersionVisibilityPolicy(
  policy: V1KnowledgeBaseVersionVisibilityReadonlyPolicy,
  candidateCount: number,
  readonlyItemCount?: number,
) {
  return evaluateV1ReadonlyFeaturePolicy({
    featureEnabled: policy.featureEnabled,
    tenantScopeMatched: policy.tenantScopeMatched,
    canRead: policy.canReadKnowledgeBaseVersionVisibility,
    candidateCount,
    ...(readonlyItemCount === undefined ? {} : { readonlyItemCount }),
    reasonCodes: versionVisibilityReasonCodes,
    copies: versionVisibilityCopies,
  });
}

function toVersionVisibilityEmptySummary(
  result: ReturnType<typeof evaluateVersionVisibilityPolicy>,
): V1KnowledgeBaseVersionVisibilityReadonlySummary {
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

function readinessForPublishStatus(
  publishStatus: V1KnowledgeBasePublishStatus,
): V1KnowledgeBaseVersionVisibilityReadiness {
  if (publishStatus === 'draft') {
    return 'draft';
  }

  if (publishStatus === 'archived') {
    return 'archived';
  }

  if (publishStatus === 'disabled') {
    return 'disabled';
  }

  return 'ready';
}

function reasonCodeForReadiness(
  readiness: V1KnowledgeBaseVersionVisibilityReadiness,
): V1KnowledgeBaseVersionVisibilityReadonlyItem['reasonCode'] {
  if (readiness === 'draft') {
    return 'knowledge_base_version_visibility_draft';
  }

  if (readiness === 'archived') {
    return 'knowledge_base_version_visibility_archived';
  }

  if (readiness === 'disabled') {
    return 'knowledge_base_version_visibility_disabled';
  }

  return 'knowledge_base_version_visibility_ready';
}

function visibilityGovernanceForScope(
  visibilityScope: string,
): V1KnowledgeBaseVersionVisibilityGovernance | null {
  if (visibilityScope === 'platform_global' || visibilityScope === 'platform_default') {
    return 'platform_global';
  }

  if (
    visibilityScope === 'specified_institution' ||
    visibilityScope.startsWith('specified_institution:') ||
    visibilityScope.startsWith('institution_selected:')
  ) {
    return 'specified_institution';
  }

  if (
    visibilityScope === 'institution_private' ||
    visibilityScope === 'institution_internal' ||
    visibilityScope.startsWith('institution_private:')
  ) {
    return 'institution_private';
  }

  return null;
}

function visibilityScopeCode(visibilityScope: string): string | undefined {
  const [, code] = visibilityScope.split(':', 2);
  const trimmedCode = code?.trim();

  return trimmedCode === undefined || trimmedCode.length === 0 ? undefined : trimmedCode;
}

function visibilityScopeSummary(
  governance: V1KnowledgeBaseVersionVisibilityGovernance,
): string {
  if (governance === 'specified_institution') {
    return '指定机构';
  }

  if (governance === 'institution_private') {
    return '机构私有';
  }

  return '平台全局';
}

function isVisibleToViewer(
  item: V1KnowledgeBaseReadonlyItem,
  policy: V1KnowledgeBaseVersionVisibilityReadonlyPolicy,
  governance: V1KnowledgeBaseVersionVisibilityGovernance,
): boolean {
  if (policy.viewerScope === 'platform') {
    return item.scope === 'platform_knowledge_base' && governance !== 'institution_private';
  }

  if (item.scope !== 'institution_knowledge_base') {
    return false;
  }

  if (governance !== 'institution_private' && governance !== 'specified_institution') {
    return false;
  }

  const code = visibilityScopeCode(item.visibilityScope);

  return code === undefined || code === policy.viewerInstitutionScopeCode;
}

function toVersionVisibilityItem(
  item: V1KnowledgeBaseReadonlyItem,
  policy: V1KnowledgeBaseVersionVisibilityReadonlyPolicy,
): V1KnowledgeBaseVersionVisibilityReadonlyItem | null {
  const visibilityGovernance = visibilityGovernanceForScope(item.visibilityScope);

  if (visibilityGovernance === null || !isVisibleToViewer(item, policy, visibilityGovernance)) {
    return null;
  }

  const readiness = readinessForPublishStatus(item.publishStatus);

  return {
    scope: item.scope,
    knowledgeType: item.knowledgeType,
    versionSummary: item.versionSummary,
    versionStatus: item.versionStatus,
    publishStatus: item.publishStatus,
    publishStatusSummary: `${item.publishStatus} / ${item.permissionStatus}`,
    visibilityGovernance,
    visibilityScopeSummary: visibilityScopeSummary(visibilityGovernance),
    versionGovernance: item.versionStatus,
    readiness,
    mockSeedDemoFlag: item.mockSeedDemoFlag,
    readonly: true,
    reasonCode: reasonCodeForReadiness(readiness),
    resultCode: 'readonly',
  };
}

export function buildV1KnowledgeBaseVersionVisibilityReadonlySummary(
  input: V1KnowledgeBaseVersionVisibilityReadonlyInput,
  policy: V1KnowledgeBaseVersionVisibilityReadonlyPolicy,
): V1KnowledgeBaseVersionVisibilityReadonlySummary {
  const candidates = input.candidates ?? [];
  const guardResult = evaluateVersionVisibilityPolicy(policy, candidates.length);

  if (guardResult.status !== 'ready') {
    return toVersionVisibilityEmptySummary(guardResult);
  }

  const boundarySummary = buildV1KnowledgeBaseReadonlySummary(input, toBoundaryPolicy(policy));
  const catalogSummary = buildV1KnowledgeBaseCatalogReadonlySummary(input, toCatalogPolicy(policy));

  if (boundarySummary.status !== 'ready' || catalogSummary.status !== 'ready') {
    const fallbackResult = evaluateVersionVisibilityPolicy(policy, candidates.length, 0);

    return toVersionVisibilityEmptySummary(fallbackResult);
  }

  const items = boundarySummary.items
    .map((item) => toVersionVisibilityItem(item, policy))
    .filter(
      (item): item is V1KnowledgeBaseVersionVisibilityReadonlyItem => item !== null,
    );
  const finalPolicyResult = evaluateVersionVisibilityPolicy(
    policy,
    candidates.length,
    items.length,
  );

  if (finalPolicyResult.status !== 'ready') {
    return toVersionVisibilityEmptySummary(finalPolicyResult);
  }

  return {
    status: finalPolicyResult.status,
    reasonCode: finalPolicyResult.reasonCode,
    resultCode: finalPolicyResult.resultCode,
    readonly: true,
    items,
  };
}
