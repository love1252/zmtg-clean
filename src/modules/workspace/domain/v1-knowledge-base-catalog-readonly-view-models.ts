import {
  buildV1KnowledgeBaseReadonlySummary,
  type V1KnowledgeBasePublishStatus,
  type V1KnowledgeBaseReadonlyCandidateInput,
  type V1KnowledgeBaseReadonlyPolicy,
  type V1KnowledgeBaseScope,
  type V1KnowledgeBaseType,
} from './v1-knowledge-base-readonly-view-models';
import { evaluateV1ReadonlyFeaturePolicy } from './v1-readonly-feature-policy';

export type V1KnowledgeBaseCatalogReadonlyPolicy = {
  featureEnabled: boolean;
  canReadKnowledgeBaseCatalog: boolean;
  tenantScopeMatched: boolean;
};

export type V1KnowledgeBaseCatalogReadonlyInput = {
  candidates?: readonly V1KnowledgeBaseReadonlyCandidateInput[];
};

export type V1KnowledgeBaseCatalogReadonlyStatus =
  | 'disabled'
  | 'denied'
  | 'empty'
  | 'exception'
  | 'ready';

export type V1KnowledgeBaseCatalogReadonlyResultCode =
  | 'skipped'
  | 'denied'
  | 'empty'
  | 'unavailable'
  | 'readonly';

export type V1KnowledgeBaseCatalogReadiness =
  | 'ready'
  | 'draft'
  | 'archived'
  | 'disabled';

export const defaultV1KnowledgeBaseCatalogReadonlyPolicy = {
  featureEnabled: false,
  canReadKnowledgeBaseCatalog: false,
  tenantScopeMatched: false,
} as const satisfies V1KnowledgeBaseCatalogReadonlyPolicy;

export const v1KnowledgeBaseCatalogReadonlyItemFields = [
  'scope',
  'knowledgeType',
  'categorySummary',
  'publishStatus',
  'publishStatusSummary',
  'versionSummary',
  'visibilityScopeSummary',
  'readiness',
  'mockSeedDemoFlag',
  'readonly',
  'reasonCode',
  'resultCode',
] as const;

export type V1KnowledgeBaseCatalogReadonlyItem = {
  scope: V1KnowledgeBaseScope;
  knowledgeType: V1KnowledgeBaseType;
  categorySummary: string;
  publishStatus: V1KnowledgeBasePublishStatus;
  publishStatusSummary: string;
  versionSummary: string;
  visibilityScopeSummary: string;
  readiness: V1KnowledgeBaseCatalogReadiness;
  mockSeedDemoFlag: 'mock' | 'seed' | 'demo';
  readonly: true;
  reasonCode:
    | 'knowledge_base_catalog_ready'
    | 'knowledge_base_catalog_draft'
    | 'knowledge_base_catalog_archived'
    | 'knowledge_base_catalog_disabled';
  resultCode: 'readonly';
};

export type V1KnowledgeBaseCatalogReadonlySummary = {
  status: V1KnowledgeBaseCatalogReadonlyStatus;
  reasonCode:
    | 'feature_flag_disabled'
    | 'tenant_scope_mismatch'
    | 'permission_denied'
    | 'no_knowledge_base_catalog_candidates'
    | 'knowledge_base_catalog_source_missing'
    | 'knowledge_base_catalog_ready';
  resultCode: V1KnowledgeBaseCatalogReadonlyResultCode;
  readonly: true;
  emptyCopy?: string;
  exceptionCopy?: string;
  items: V1KnowledgeBaseCatalogReadonlyItem[];
};

const disabledCopy = '该知识库目录只读能力暂未开启';
const emptyCopy = '暂无可展示知识库目录聚合';
const deniedCopy = '当前账号没有访问权限';
const sourceMissingCopy = '知识库目录来源不完整，仅作内部参考';
const catalogPolicyReasonCodes = {
  empty: 'no_knowledge_base_catalog_candidates',
  exception: 'knowledge_base_catalog_source_missing',
  ready: 'knowledge_base_catalog_ready',
} as const;
const catalogPolicyCopies = {
  disabled: disabledCopy,
  denied: deniedCopy,
  empty: emptyCopy,
  exception: sourceMissingCopy,
} as const;

function toBoundaryPolicy(
  policy: V1KnowledgeBaseCatalogReadonlyPolicy,
): V1KnowledgeBaseReadonlyPolicy {
  return {
    featureEnabled: policy.featureEnabled,
    canReadKnowledgeBase: policy.canReadKnowledgeBaseCatalog,
    tenantScopeMatched: policy.tenantScopeMatched,
  };
}

function evaluateCatalogPolicy(
  policy: V1KnowledgeBaseCatalogReadonlyPolicy,
  candidateCount: number,
  readonlyItemCount?: number,
) {
  return evaluateV1ReadonlyFeaturePolicy({
    featureEnabled: policy.featureEnabled,
    tenantScopeMatched: policy.tenantScopeMatched,
    canRead: policy.canReadKnowledgeBaseCatalog,
    candidateCount,
    ...(readonlyItemCount === undefined ? {} : { readonlyItemCount }),
    reasonCodes: catalogPolicyReasonCodes,
    copies: catalogPolicyCopies,
  });
}

function toCatalogEmptySummary(
  result: ReturnType<typeof evaluateCatalogPolicy>,
): V1KnowledgeBaseCatalogReadonlySummary {
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
): V1KnowledgeBaseCatalogReadiness {
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
  readiness: V1KnowledgeBaseCatalogReadiness,
): V1KnowledgeBaseCatalogReadonlyItem['reasonCode'] {
  if (readiness === 'draft') {
    return 'knowledge_base_catalog_draft';
  }

  if (readiness === 'archived') {
    return 'knowledge_base_catalog_archived';
  }

  if (readiness === 'disabled') {
    return 'knowledge_base_catalog_disabled';
  }

  return 'knowledge_base_catalog_ready';
}

export function buildV1KnowledgeBaseCatalogReadonlySummary(
  input: V1KnowledgeBaseCatalogReadonlyInput,
  policy: V1KnowledgeBaseCatalogReadonlyPolicy,
): V1KnowledgeBaseCatalogReadonlySummary {
  const candidates = input.candidates ?? [];
  const guardResult = evaluateCatalogPolicy(policy, candidates.length);

  if (guardResult.status !== 'ready') {
    return toCatalogEmptySummary(guardResult);
  }

  const boundarySummary = buildV1KnowledgeBaseReadonlySummary(input, toBoundaryPolicy(policy));

  if (boundarySummary.status !== 'ready') {
    const fallbackResult = evaluateCatalogPolicy(policy, candidates.length, 0);

    return toCatalogEmptySummary(fallbackResult);
  }

  const items = boundarySummary.items.map((item): V1KnowledgeBaseCatalogReadonlyItem => {
    const readiness = readinessForPublishStatus(item.publishStatus);

    return {
      scope: item.scope,
      knowledgeType: item.knowledgeType,
      categorySummary: `${item.scope} / ${item.knowledgeType}`,
      publishStatus: item.publishStatus,
      publishStatusSummary: `${item.publishStatus} / ${item.permissionStatus}`,
      versionSummary: item.versionSummary,
      visibilityScopeSummary: item.visibilityScope,
      readiness,
      mockSeedDemoFlag: item.mockSeedDemoFlag,
      readonly: true,
      reasonCode: reasonCodeForReadiness(readiness),
      resultCode: 'readonly',
    };
  });
  const finalPolicyResult = evaluateCatalogPolicy(policy, candidates.length, items.length);

  if (finalPolicyResult.status !== 'ready') {
    return toCatalogEmptySummary(finalPolicyResult);
  }

  return {
    status: finalPolicyResult.status,
    reasonCode: finalPolicyResult.reasonCode,
    resultCode: finalPolicyResult.resultCode,
    readonly: true,
    items,
  };
}
