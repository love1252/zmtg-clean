import {
  buildV1KnowledgeBaseDemoSourceGovernanceReadonlyInput,
  buildV1KnowledgeBaseDemoSourceReadonlySummary,
  type V1KnowledgeBaseDemoSourceInput,
  type V1KnowledgeBaseDemoSourceReadonlyPolicy,
  type V1KnowledgeBaseDemoSourceReadonlySummary,
} from './v1-knowledge-base-demo-source-contract';
import {
  buildV1KnowledgeBaseGovernanceReadonlySummary,
  type V1KnowledgeBaseGovernanceReadonlyPolicy,
  type V1KnowledgeBaseGovernanceReadonlySummary,
} from './v1-knowledge-base-governance-readonly-view-models';

export type V1KnowledgeBaseDemoReadonlyFacadePolicy = {
  featureEnabled: boolean;
  canReadKnowledgeBaseDemoReadonlyFacade: boolean;
  tenantScopeMatched: boolean;
  workspaceScopeMatched: boolean;
  institutionScopeMatched: boolean;
  tenantId?: string;
  institutionId?: string;
  workspaceId?: string;
  viewerScope: 'platform' | 'institution';
  viewerInstitutionScopeCode?: string;
};

export type V1KnowledgeBaseDemoReadonlyFacadeInput = V1KnowledgeBaseDemoSourceInput;

export type V1KnowledgeBaseDemoReadonlyFacadeStatus =
  | 'disabled'
  | 'denied'
  | 'empty'
  | 'source_missing'
  | 'partial'
  | 'stale'
  | 'ready';

export type V1KnowledgeBaseDemoReadonlyFacadeResultStatus =
  | 'disabled'
  | 'denied'
  | 'empty'
  | 'exception'
  | 'partial'
  | 'stale'
  | 'ready';

export type V1KnowledgeBaseDemoReadonlyFacadeResultCode =
  | 'skipped'
  | 'denied'
  | 'empty'
  | 'unavailable'
  | 'partial'
  | 'stale'
  | 'readonly';

export type V1KnowledgeBaseDemoReadonlyFacade = {
  status: V1KnowledgeBaseDemoReadonlyFacadeResultStatus;
  reasonCode:
    | 'feature_flag_disabled'
    | 'tenant_scope_mismatch'
    | 'permission_denied'
    | 'no_knowledge_base_demo_sources'
    | 'knowledge_base_demo_readonly_facade_source_missing'
    | 'knowledge_base_demo_readonly_facade_partial'
    | 'knowledge_base_demo_readonly_facade_stale'
    | 'knowledge_base_demo_readonly_facade_ready';
  resultCode: V1KnowledgeBaseDemoReadonlyFacadeResultCode;
  readonly: true;
  emptyCopy?: string;
  exceptionCopy?: string;
  staleCopy?: string;
  tenantId: string;
  institutionId: string;
  workspaceId: string;
  facadeStatus: V1KnowledgeBaseDemoReadonlyFacadeStatus;
  platformKnowledgeBase: string;
  institutionKnowledgeBase: string;
  catalogSummary: string;
  publishStatusSummary: string;
  versionSummary: string;
  visibilitySummary: string;
  auditSummary: string;
  governanceSummary: string;
  demoSourceSummary: string;
  riskFlags: readonly string[];
  recommendedReadonlyActions: readonly string[];
};

export const defaultV1KnowledgeBaseDemoReadonlyFacadePolicy = {
  featureEnabled: false,
  canReadKnowledgeBaseDemoReadonlyFacade: false,
  tenantScopeMatched: false,
  workspaceScopeMatched: false,
  institutionScopeMatched: false,
  viewerScope: 'institution',
} as const satisfies V1KnowledgeBaseDemoReadonlyFacadePolicy;

export const v1KnowledgeBaseDemoReadonlyFacadeFields = [
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
  'facadeStatus',
  'platformKnowledgeBase',
  'institutionKnowledgeBase',
  'catalogSummary',
  'publishStatusSummary',
  'versionSummary',
  'visibilitySummary',
  'auditSummary',
  'governanceSummary',
  'demoSourceSummary',
  'riskFlags',
  'recommendedReadonlyActions',
] as const;

const disabledCopy = '该知识库 demo readonly facade 暂未开启';
const emptyCopy = '暂无可展示知识库 demo readonly facade';
const deniedCopy = '当前账号没有访问权限';
const sourceMissingCopy = '知识库 demo readonly facade 来源不完整，仅作内部参考';
const partialCopy = '知识库 demo readonly facade 部分来源不完整，仅展示可用只读总览';
const staleCopy = '知识库 demo readonly facade 可能已过期';
const notAvailable = 'not_available';

function summaryBase(
  policy: V1KnowledgeBaseDemoReadonlyFacadePolicy,
): Pick<
  V1KnowledgeBaseDemoReadonlyFacade,
  | 'tenantId'
  | 'institutionId'
  | 'workspaceId'
  | 'platformKnowledgeBase'
  | 'institutionKnowledgeBase'
  | 'catalogSummary'
  | 'publishStatusSummary'
  | 'versionSummary'
  | 'visibilitySummary'
  | 'auditSummary'
  | 'governanceSummary'
  | 'demoSourceSummary'
  | 'riskFlags'
  | 'recommendedReadonlyActions'
> {
  return {
    tenantId: policy.tenantId ?? notAvailable,
    institutionId: policy.institutionId ?? notAvailable,
    workspaceId: policy.workspaceId ?? notAvailable,
    platformKnowledgeBase: notAvailable,
    institutionKnowledgeBase: notAvailable,
    catalogSummary: notAvailable,
    publishStatusSummary: notAvailable,
    versionSummary: notAvailable,
    visibilitySummary: notAvailable,
    auditSummary: notAvailable,
    governanceSummary: notAvailable,
    demoSourceSummary: notAvailable,
    riskFlags: [],
    recommendedReadonlyActions: [],
  };
}

function blockedFacade(
  policy: V1KnowledgeBaseDemoReadonlyFacadePolicy,
  status: 'disabled' | 'denied' | 'empty',
  reasonCode:
    | 'feature_flag_disabled'
    | 'tenant_scope_mismatch'
    | 'permission_denied'
    | 'no_knowledge_base_demo_sources',
): V1KnowledgeBaseDemoReadonlyFacade {
  if (status === 'disabled') {
    return {
      status,
      reasonCode,
      resultCode: 'skipped',
      readonly: true,
      emptyCopy: disabledCopy,
      ...summaryBase(policy),
      facadeStatus: 'disabled',
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
      facadeStatus: 'empty',
    };
  }

  return {
    status,
    reasonCode,
    resultCode: 'denied',
    readonly: true,
    exceptionCopy: deniedCopy,
    ...summaryBase(policy),
    facadeStatus: 'denied',
  };
}

function toDemoSourcePolicy(
  policy: V1KnowledgeBaseDemoReadonlyFacadePolicy,
): V1KnowledgeBaseDemoSourceReadonlyPolicy {
  return {
    featureEnabled: policy.featureEnabled,
    canReadKnowledgeBaseDemoSource: policy.canReadKnowledgeBaseDemoReadonlyFacade,
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

function toGovernancePolicy(
  policy: V1KnowledgeBaseDemoReadonlyFacadePolicy,
): V1KnowledgeBaseGovernanceReadonlyPolicy {
  return {
    featureEnabled: policy.featureEnabled,
    canReadKnowledgeBaseGovernance: policy.canReadKnowledgeBaseDemoReadonlyFacade,
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

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function mergedRiskFlags(
  demoSource: V1KnowledgeBaseDemoSourceReadonlySummary,
  governance: V1KnowledgeBaseGovernanceReadonlySummary,
): string[] {
  return sortedUnique([...demoSource.riskFlags, ...governance.riskFlags]);
}

function mergedReadonlyActions(
  demoSource: V1KnowledgeBaseDemoSourceReadonlySummary,
  governance: V1KnowledgeBaseGovernanceReadonlySummary,
): string[] {
  return sortedUnique([
    ...governance.recommendedReadonlyActions,
    ...demoSource.recommendedReadonlyActions,
  ]);
}

function demoSourceLine(summary: V1KnowledgeBaseDemoSourceReadonlySummary): string {
  return `${summary.status} / ${summary.sourceStatus}`;
}

function governanceLine(summary: V1KnowledgeBaseGovernanceReadonlySummary): string {
  return `${summary.status} / ${summary.governanceStatus}`;
}

function publishStatusSummary(
  demoSource: V1KnowledgeBaseDemoSourceReadonlySummary,
): string {
  return `${demoSource.platformKnowledgeBaseSummary} | ${demoSource.institutionKnowledgeBaseSummary}`;
}

function readyFacade(
  policy: V1KnowledgeBaseDemoReadonlyFacadePolicy,
  demoSource: V1KnowledgeBaseDemoSourceReadonlySummary,
  governance: V1KnowledgeBaseGovernanceReadonlySummary,
): V1KnowledgeBaseDemoReadonlyFacade {
  return {
    status: 'ready',
    reasonCode: 'knowledge_base_demo_readonly_facade_ready',
    resultCode: 'readonly',
    readonly: true,
    tenantId: policy.tenantId ?? notAvailable,
    institutionId: policy.institutionId ?? notAvailable,
    workspaceId: policy.workspaceId ?? notAvailable,
    facadeStatus: 'ready',
    platformKnowledgeBase: demoSource.platformKnowledgeBaseSummary,
    institutionKnowledgeBase: demoSource.institutionKnowledgeBaseSummary,
    catalogSummary: governance.catalogSummary,
    publishStatusSummary: publishStatusSummary(demoSource),
    versionSummary: governance.versionSummary,
    visibilitySummary: governance.visibilitySummary,
    auditSummary: governance.auditSummary,
    governanceSummary: governanceLine(governance),
    demoSourceSummary: demoSourceLine(demoSource),
    riskFlags: mergedRiskFlags(demoSource, governance),
    recommendedReadonlyActions: mergedReadonlyActions(demoSource, governance),
  };
}

function partialFacade(
  policy: V1KnowledgeBaseDemoReadonlyFacadePolicy,
  demoSource: V1KnowledgeBaseDemoSourceReadonlySummary,
  governance: V1KnowledgeBaseGovernanceReadonlySummary,
): V1KnowledgeBaseDemoReadonlyFacade {
  return {
    status: 'partial',
    reasonCode: 'knowledge_base_demo_readonly_facade_partial',
    resultCode: 'partial',
    readonly: true,
    exceptionCopy: partialCopy,
    tenantId: policy.tenantId ?? notAvailable,
    institutionId: policy.institutionId ?? notAvailable,
    workspaceId: policy.workspaceId ?? notAvailable,
    facadeStatus: 'partial',
    platformKnowledgeBase: demoSource.platformKnowledgeBaseSummary,
    institutionKnowledgeBase: demoSource.institutionKnowledgeBaseSummary,
    catalogSummary: governance.catalogSummary,
    publishStatusSummary: publishStatusSummary(demoSource),
    versionSummary: governance.versionSummary,
    visibilitySummary: governance.visibilitySummary,
    auditSummary: governance.auditSummary,
    governanceSummary: governanceLine(governance),
    demoSourceSummary: demoSourceLine(demoSource),
    riskFlags: mergedRiskFlags(demoSource, governance),
    recommendedReadonlyActions: mergedReadonlyActions(demoSource, governance),
  };
}

function staleFacade(
  policy: V1KnowledgeBaseDemoReadonlyFacadePolicy,
  demoSource: V1KnowledgeBaseDemoSourceReadonlySummary,
  governance: V1KnowledgeBaseGovernanceReadonlySummary,
): V1KnowledgeBaseDemoReadonlyFacade {
  return {
    status: 'stale',
    reasonCode: 'knowledge_base_demo_readonly_facade_stale',
    resultCode: 'stale',
    readonly: true,
    staleCopy,
    tenantId: policy.tenantId ?? notAvailable,
    institutionId: policy.institutionId ?? notAvailable,
    workspaceId: policy.workspaceId ?? notAvailable,
    facadeStatus: 'stale',
    platformKnowledgeBase: demoSource.platformKnowledgeBaseSummary,
    institutionKnowledgeBase: demoSource.institutionKnowledgeBaseSummary,
    catalogSummary: governance.catalogSummary,
    publishStatusSummary: publishStatusSummary(demoSource),
    versionSummary: governance.versionSummary,
    visibilitySummary: governance.visibilitySummary,
    auditSummary: governance.auditSummary,
    governanceSummary: governanceLine(governance),
    demoSourceSummary: demoSourceLine(demoSource),
    riskFlags: mergedRiskFlags(demoSource, governance),
    recommendedReadonlyActions: mergedReadonlyActions(demoSource, governance),
  };
}

function sourceMissingFacade(
  policy: V1KnowledgeBaseDemoReadonlyFacadePolicy,
  demoSource: V1KnowledgeBaseDemoSourceReadonlySummary,
): V1KnowledgeBaseDemoReadonlyFacade {
  return {
    status: 'exception',
    reasonCode: 'knowledge_base_demo_readonly_facade_source_missing',
    resultCode: 'unavailable',
    readonly: true,
    exceptionCopy: sourceMissingCopy,
    tenantId: policy.tenantId ?? notAvailable,
    institutionId: policy.institutionId ?? notAvailable,
    workspaceId: policy.workspaceId ?? notAvailable,
    facadeStatus: 'source_missing',
    platformKnowledgeBase: demoSource.platformKnowledgeBaseSummary,
    institutionKnowledgeBase: demoSource.institutionKnowledgeBaseSummary,
    catalogSummary: notAvailable,
    publishStatusSummary: notAvailable,
    versionSummary: notAvailable,
    visibilitySummary: notAvailable,
    auditSummary: notAvailable,
    governanceSummary: notAvailable,
    demoSourceSummary: demoSourceLine(demoSource),
    riskFlags: [...demoSource.riskFlags],
    recommendedReadonlyActions: [...demoSource.recommendedReadonlyActions],
  };
}

export function buildV1KnowledgeBaseDemoReadonlyFacade(
  input: V1KnowledgeBaseDemoReadonlyFacadeInput,
  policy: V1KnowledgeBaseDemoReadonlyFacadePolicy,
): V1KnowledgeBaseDemoReadonlyFacade {
  const sources = input.sources ?? [];

  if (!policy.featureEnabled) {
    return blockedFacade(policy, 'disabled', 'feature_flag_disabled');
  }

  if (!policy.tenantScopeMatched || !policy.workspaceScopeMatched || !policy.institutionScopeMatched) {
    return blockedFacade(policy, 'denied', 'tenant_scope_mismatch');
  }

  if (!policy.canReadKnowledgeBaseDemoReadonlyFacade) {
    return blockedFacade(policy, 'denied', 'permission_denied');
  }

  if (sources.length === 0) {
    return blockedFacade(policy, 'empty', 'no_knowledge_base_demo_sources');
  }

  const demoSourcePolicy = toDemoSourcePolicy(policy);
  const demoSource = buildV1KnowledgeBaseDemoSourceReadonlySummary(input, demoSourcePolicy);

  if (demoSource.sourceStatus === 'source_missing') {
    return sourceMissingFacade(policy, demoSource);
  }

  const governanceInput = buildV1KnowledgeBaseDemoSourceGovernanceReadonlyInput(
    input,
    demoSourcePolicy,
  );
  const governance = buildV1KnowledgeBaseGovernanceReadonlySummary(
    governanceInput,
    toGovernancePolicy(policy),
  );

  if (demoSource.sourceStatus === 'partial' || governance.governanceStatus === 'partial') {
    return partialFacade(policy, demoSource, governance);
  }

  if (demoSource.sourceStatus === 'stale' || governance.governanceStatus === 'stale') {
    return staleFacade(policy, demoSource, governance);
  }

  return readyFacade(policy, demoSource, governance);
}
