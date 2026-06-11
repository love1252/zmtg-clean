import {
  buildV1KnowledgeBaseGovernanceReadonlySummary,
  type V1KnowledgeBaseGovernanceReadonlyInput,
  type V1KnowledgeBaseGovernanceReadonlySummary,
} from '../../knowledge-base/domain/v1-knowledge-base-governance-readonly-view-models';
import {
  buildV1BusinessClosedLoopReadonlyAggregationSummary,
  type V1BusinessClosedLoopReadonlyAggregationCandidateInput,
  type V1BusinessClosedLoopReadonlyAggregationSummary,
} from './v1-business-closed-loop-readonly-aggregation-view-models';
import { validateV1LowSensitivityFieldWhitelist } from './v1-low-sensitivity-field-whitelist';
import {
  buildV1ManagementReadonlyConfigSummary,
  type V1ManagementReadonlyConfigCandidateInput,
  type V1ManagementReadonlyConfigSummary,
} from './v1-management-readonly-config-view-models';
import { evaluateV1ReadonlyFeaturePolicy } from './v1-readonly-feature-policy';

export type V1WorkspaceDashboardReadonlyAggregationPolicy = {
  featureEnabled: boolean;
  canReadWorkspaceDashboardAggregation: boolean;
  tenantScopeMatched: boolean;
  workspaceScopeMatched: boolean;
  institutionScopeMatched: boolean;
  tenantId?: string;
  institutionId?: string;
  workspaceId?: string;
};

export type V1WorkspaceDashboardReadonlyAggregationInput = {
  businessLoopCandidates?: readonly V1BusinessClosedLoopReadonlyAggregationCandidateInput[];
  managementConfigCandidates?: readonly V1ManagementReadonlyConfigCandidateInput[];
  knowledgeGovernanceInput?: V1KnowledgeBaseGovernanceReadonlyInput;
};

export type V1WorkspaceDashboardReadonlyAggregationStatus =
  | 'disabled'
  | 'denied'
  | 'empty'
  | 'exception'
  | 'partial'
  | 'stale'
  | 'ready';

export type V1WorkspaceDashboardReadonlyAggregationResultCode =
  | 'skipped'
  | 'denied'
  | 'empty'
  | 'unavailable'
  | 'partial'
  | 'stale'
  | 'readonly';

export type V1WorkspaceDashboardStatus =
  | 'disabled'
  | 'denied'
  | 'empty'
  | 'source_missing'
  | 'partial'
  | 'stale'
  | 'ready';

export const defaultV1WorkspaceDashboardReadonlyAggregationPolicy = {
  featureEnabled: false,
  canReadWorkspaceDashboardAggregation: false,
  tenantScopeMatched: false,
  workspaceScopeMatched: false,
  institutionScopeMatched: false,
} as const satisfies V1WorkspaceDashboardReadonlyAggregationPolicy;

export const v1WorkspaceDashboardReadonlyAggregationSummaryFields = [
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
  'businessLoopSummary',
  'managementConfigSummary',
  'knowledgeGovernanceSummary',
  'fieldWhitelistSummary',
  'readonlyFeaturePolicySummary',
  'dashboardStatus',
  'riskFlags',
  'recommendedReadonlyActions',
] as const;

export type V1WorkspaceDashboardReadonlyAggregationSummary = {
  status: V1WorkspaceDashboardReadonlyAggregationStatus;
  reasonCode:
    | 'feature_flag_disabled'
    | 'tenant_scope_mismatch'
    | 'permission_denied'
    | 'no_workspace_dashboard_readonly_candidates'
    | 'workspace_dashboard_readonly_aggregation_source_missing'
    | 'workspace_dashboard_readonly_aggregation_partial'
    | 'workspace_dashboard_readonly_aggregation_stale'
    | 'workspace_dashboard_readonly_aggregation_ready';
  resultCode: V1WorkspaceDashboardReadonlyAggregationResultCode;
  readonly: true;
  emptyCopy?: string;
  exceptionCopy?: string;
  staleCopy?: string;
  tenantId: string;
  institutionId: string;
  workspaceId: string;
  businessLoopSummary: string;
  managementConfigSummary: string;
  knowledgeGovernanceSummary: string;
  fieldWhitelistSummary: string;
  readonlyFeaturePolicySummary: string;
  dashboardStatus: V1WorkspaceDashboardStatus;
  riskFlags: readonly string[];
  recommendedReadonlyActions: readonly string[];
};

const disabledCopy = '该 workspace dashboard 只读聚合能力暂未开启';
const emptyCopy = '暂无可展示 workspace dashboard 只读聚合';
const deniedCopy = '当前账号没有访问权限';
const sourceMissingCopy = 'workspace dashboard 只读聚合来源不完整，仅作内部参考';
const partialCopy = 'workspace dashboard 只读聚合部分来源不完整，仅展示可用摘要';
const staleCopy = 'workspace dashboard 只读聚合可能已过期';
const notAvailable = 'not_available';

function summaryBase(
  policy: V1WorkspaceDashboardReadonlyAggregationPolicy,
): Pick<
  V1WorkspaceDashboardReadonlyAggregationSummary,
  | 'tenantId'
  | 'institutionId'
  | 'workspaceId'
  | 'businessLoopSummary'
  | 'managementConfigSummary'
  | 'knowledgeGovernanceSummary'
  | 'fieldWhitelistSummary'
  | 'readonlyFeaturePolicySummary'
  | 'riskFlags'
  | 'recommendedReadonlyActions'
> {
  return {
    tenantId: policy.tenantId ?? notAvailable,
    institutionId: policy.institutionId ?? notAvailable,
    workspaceId: policy.workspaceId ?? notAvailable,
    businessLoopSummary: notAvailable,
    managementConfigSummary: notAvailable,
    knowledgeGovernanceSummary: notAvailable,
    fieldWhitelistSummary: notAvailable,
    readonlyFeaturePolicySummary: notAvailable,
    riskFlags: [],
    recommendedReadonlyActions: [],
  };
}

function blockedSummary(
  policy: V1WorkspaceDashboardReadonlyAggregationPolicy,
  status: 'disabled' | 'denied' | 'empty',
  reasonCode:
    | 'feature_flag_disabled'
    | 'tenant_scope_mismatch'
    | 'permission_denied'
    | 'no_workspace_dashboard_readonly_candidates',
): V1WorkspaceDashboardReadonlyAggregationSummary {
  if (status === 'disabled') {
    return {
      status,
      reasonCode,
      resultCode: 'skipped',
      readonly: true,
      emptyCopy: disabledCopy,
      ...summaryBase(policy),
      dashboardStatus: 'disabled',
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
      dashboardStatus: 'empty',
    };
  }

  return {
    status,
    reasonCode,
    resultCode: 'denied',
    readonly: true,
    exceptionCopy: deniedCopy,
    ...summaryBase(policy),
    dashboardStatus: 'denied',
  };
}

function toKnowledgeGovernancePolicy(
  policy: V1WorkspaceDashboardReadonlyAggregationPolicy,
) {
  return {
    featureEnabled: policy.featureEnabled,
    canReadKnowledgeBaseGovernance: policy.canReadWorkspaceDashboardAggregation,
    tenantScopeMatched: policy.tenantScopeMatched,
    workspaceScopeMatched: policy.workspaceScopeMatched,
    institutionScopeMatched: policy.institutionScopeMatched,
    tenantId: policy.tenantId,
    institutionId: policy.institutionId,
    workspaceId: policy.workspaceId,
    viewerScope: 'institution' as const,
    viewerInstitutionScopeCode: policy.institutionId,
  };
}

function businessLoopSummaryLine(
  summary: V1BusinessClosedLoopReadonlyAggregationSummary,
): string {
  const blocked = summary.items.filter((item) => item.readiness === 'blocked').length;
  const exception = summary.items.filter((item) => item.readiness === 'exception').length;

  return `${summary.status} / items:${summary.items.length} / blocked:${blocked} / exception:${exception}`;
}

function managementSummaryLine(summary: V1ManagementReadonlyConfigSummary): string {
  const blocked = summary.items.filter((item) => item.readiness === 'blocked').length;
  const missing = summary.items.filter((item) => item.readiness === 'missing_configuration').length;

  return `${summary.status} / items:${summary.items.length} / blocked:${blocked} / missing:${missing}`;
}

function knowledgeGovernanceSummaryLine(
  summary: V1KnowledgeBaseGovernanceReadonlySummary,
): string {
  if (summary.riskFlags.length === 0) {
    return `${summary.status} / none`;
  }

  return `${summary.status} / ${summary.riskFlags.join(',')}`;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function policyEvaluationSummary(
  policy: V1WorkspaceDashboardReadonlyAggregationPolicy,
  candidateCount: number,
) {
  return evaluateV1ReadonlyFeaturePolicy({
    featureEnabled: policy.featureEnabled,
    tenantScopeMatched:
      policy.tenantScopeMatched &&
      policy.workspaceScopeMatched &&
      policy.institutionScopeMatched,
    canRead: policy.canReadWorkspaceDashboardAggregation,
    candidateCount,
    readonlyItemCount: candidateCount,
    reasonCodes: {
      empty: 'no_workspace_dashboard_readonly_candidates',
      exception: 'workspace_dashboard_readonly_aggregation_source_missing',
      ready: 'workspace_dashboard_readonly_aggregation_ready',
    },
    copies: {
      disabled: disabledCopy,
      denied: deniedCopy,
      empty: emptyCopy,
      exception: sourceMissingCopy,
    },
  });
}

function fieldWhitelistSummary(
  summary: Pick<
    V1WorkspaceDashboardReadonlyAggregationSummary,
    | 'status'
    | 'reasonCode'
    | 'resultCode'
    | 'readonly'
    | 'tenantId'
    | 'institutionId'
    | 'workspaceId'
    | 'businessLoopSummary'
    | 'managementConfigSummary'
    | 'knowledgeGovernanceSummary'
    | 'readonlyFeaturePolicySummary'
    | 'dashboardStatus'
    | 'riskFlags'
    | 'recommendedReadonlyActions'
  >,
): string {
  const validation = validateV1LowSensitivityFieldWhitelist(summary, {
    allowedFields: v1WorkspaceDashboardReadonlyAggregationSummaryFields,
    forbiddenFragments: [],
  });

  return `ready / unknown:${validation.unknownFields.length} / forbidden:${validation.forbiddenFields.length}`;
}

function workspaceRiskFlags(
  businessLoop: V1BusinessClosedLoopReadonlyAggregationSummary,
  managementConfig: V1ManagementReadonlyConfigSummary,
  knowledgeGovernance: V1KnowledgeBaseGovernanceReadonlySummary,
): string[] {
  const flags: string[] = [];

  if (businessLoop.status === 'exception') {
    flags.push('business_loop_source_missing');
  }

  if (businessLoop.items.some((item) => item.readiness === 'blocked')) {
    flags.push('business_loop_blocked');
  }

  if (managementConfig.status === 'exception') {
    flags.push('management_config_source_missing');
  }

  if (managementConfig.items.some((item) => item.readiness === 'blocked')) {
    flags.push('management_config_blocked');
  }

  if (knowledgeGovernance.status === 'partial') {
    flags.push('knowledge_governance_partial');
  }

  if (knowledgeGovernance.status === 'stale') {
    flags.push('knowledge_governance_stale');
  }

  knowledgeGovernance.riskFlags.forEach((flag) => {
    flags.push(flag);
  });

  return sortedUnique(flags);
}

function recommendedReadonlyActions(riskFlags: readonly string[]): string[] {
  const actions: string[] = [];

  if (riskFlags.includes('business_loop_blocked')) {
    actions.push('review_business_loop_blockers_readonly');
  }

  if (riskFlags.includes('business_loop_source_missing')) {
    actions.push('review_business_loop_sources_readonly');
  }

  if (riskFlags.includes('management_config_blocked')) {
    actions.push('review_management_config_blockers_readonly');
  }

  if (riskFlags.includes('management_config_source_missing')) {
    actions.push('review_management_config_sources_readonly');
  }

  if (
    riskFlags.includes('knowledge_governance_partial') ||
    riskFlags.includes('reviewing_version_present') ||
    riskFlags.includes('audit_source_missing')
  ) {
    actions.push('review_knowledge_governance_risks_readonly');
  }

  if (
    riskFlags.includes('knowledge_governance_stale') ||
    riskFlags.includes('stale_audit_present')
  ) {
    actions.push('review_stale_dashboard_sources_readonly');
  }

  return actions;
}

function aggregateStatus(
  businessLoop: V1BusinessClosedLoopReadonlyAggregationSummary,
  managementConfig: V1ManagementReadonlyConfigSummary,
  knowledgeGovernance: V1KnowledgeBaseGovernanceReadonlySummary,
): Pick<
  V1WorkspaceDashboardReadonlyAggregationSummary,
  'status' | 'reasonCode' | 'resultCode' | 'dashboardStatus' | 'exceptionCopy' | 'staleCopy'
> {
  const hasException =
    businessLoop.status === 'exception' ||
    managementConfig.status === 'exception' ||
    knowledgeGovernance.status === 'exception';
  const hasPartial = knowledgeGovernance.status === 'partial';
  const hasReadyOrStale =
    businessLoop.status === 'ready' ||
    managementConfig.status === 'ready' ||
    knowledgeGovernance.status === 'ready' ||
    knowledgeGovernance.status === 'stale';

  if ((hasException || hasPartial) && hasReadyOrStale) {
    return {
      status: 'partial',
      reasonCode: 'workspace_dashboard_readonly_aggregation_partial',
      resultCode: 'partial',
      dashboardStatus: 'partial',
      exceptionCopy: partialCopy,
    };
  }

  if (hasException || hasPartial) {
    return {
      status: 'exception',
      reasonCode: 'workspace_dashboard_readonly_aggregation_source_missing',
      resultCode: 'unavailable',
      dashboardStatus: 'source_missing',
      exceptionCopy: sourceMissingCopy,
    };
  }

  if (knowledgeGovernance.status === 'stale') {
    return {
      status: 'stale',
      reasonCode: 'workspace_dashboard_readonly_aggregation_stale',
      resultCode: 'stale',
      dashboardStatus: 'stale',
      staleCopy,
    };
  }

  return {
    status: 'ready',
    reasonCode: 'workspace_dashboard_readonly_aggregation_ready',
    resultCode: 'readonly',
    dashboardStatus: 'ready',
  };
}

export function buildV1WorkspaceDashboardReadonlyAggregationSummary(
  input: V1WorkspaceDashboardReadonlyAggregationInput,
  policy: V1WorkspaceDashboardReadonlyAggregationPolicy,
): V1WorkspaceDashboardReadonlyAggregationSummary {
  const businessLoopCandidates = input.businessLoopCandidates ?? [];
  const managementConfigCandidates = input.managementConfigCandidates ?? [];
  const knowledgeGovernanceInput = input.knowledgeGovernanceInput ?? {};
  const knowledgeBaseCandidates = knowledgeGovernanceInput.knowledgeBaseCandidates ?? [];
  const auditCandidates = knowledgeGovernanceInput.auditCandidates ?? [];
  const candidateCount =
    businessLoopCandidates.length +
    managementConfigCandidates.length +
    knowledgeBaseCandidates.length +
    auditCandidates.length;

  if (!policy.featureEnabled) {
    return blockedSummary(policy, 'disabled', 'feature_flag_disabled');
  }

  if (!policy.tenantScopeMatched || !policy.workspaceScopeMatched || !policy.institutionScopeMatched) {
    return blockedSummary(policy, 'denied', 'tenant_scope_mismatch');
  }

  if (!policy.canReadWorkspaceDashboardAggregation) {
    return blockedSummary(policy, 'denied', 'permission_denied');
  }

  if (candidateCount === 0) {
    return blockedSummary(policy, 'empty', 'no_workspace_dashboard_readonly_candidates');
  }

  const businessLoop = buildV1BusinessClosedLoopReadonlyAggregationSummary(
    { candidates: businessLoopCandidates },
    {
      featureEnabled: policy.featureEnabled,
      canReadClosedLoopAggregation: policy.canReadWorkspaceDashboardAggregation,
      tenantScopeMatched: policy.tenantScopeMatched,
    },
  );
  const managementConfig = buildV1ManagementReadonlyConfigSummary(
    { candidates: managementConfigCandidates },
    {
      featureEnabled: policy.featureEnabled,
      canReadManagementConfig: policy.canReadWorkspaceDashboardAggregation,
      tenantScopeMatched: policy.tenantScopeMatched,
    },
  );
  const knowledgeGovernance = buildV1KnowledgeBaseGovernanceReadonlySummary(
    knowledgeGovernanceInput,
    toKnowledgeGovernancePolicy(policy),
  );
  const policyEvaluation = policyEvaluationSummary(policy, candidateCount);
  const readonlyFeaturePolicySummary = `${policyEvaluation.status} / ${policyEvaluation.resultCode}`;
  const risks = workspaceRiskFlags(businessLoop, managementConfig, knowledgeGovernance);
  const actions = recommendedReadonlyActions(risks);
  const status = aggregateStatus(businessLoop, managementConfig, knowledgeGovernance);
  const summaryForWhitelist = {
    status: status.status,
    reasonCode: status.reasonCode,
    resultCode: status.resultCode,
    readonly: true as const,
    tenantId: policy.tenantId ?? notAvailable,
    institutionId: policy.institutionId ?? notAvailable,
    workspaceId: policy.workspaceId ?? notAvailable,
    businessLoopSummary: businessLoopSummaryLine(businessLoop),
    managementConfigSummary: managementSummaryLine(managementConfig),
    knowledgeGovernanceSummary: knowledgeGovernanceSummaryLine(knowledgeGovernance),
    readonlyFeaturePolicySummary,
    dashboardStatus: status.dashboardStatus,
    riskFlags: risks,
    recommendedReadonlyActions: actions,
  };

  return {
    status: status.status,
    reasonCode: status.reasonCode,
    resultCode: status.resultCode,
    readonly: true,
    ...(status.exceptionCopy === undefined ? {} : { exceptionCopy: status.exceptionCopy }),
    ...(status.staleCopy === undefined ? {} : { staleCopy: status.staleCopy }),
    tenantId: summaryForWhitelist.tenantId,
    institutionId: summaryForWhitelist.institutionId,
    workspaceId: summaryForWhitelist.workspaceId,
    businessLoopSummary: summaryForWhitelist.businessLoopSummary,
    managementConfigSummary: summaryForWhitelist.managementConfigSummary,
    knowledgeGovernanceSummary: summaryForWhitelist.knowledgeGovernanceSummary,
    fieldWhitelistSummary: fieldWhitelistSummary(summaryForWhitelist),
    readonlyFeaturePolicySummary,
    dashboardStatus: status.dashboardStatus,
    riskFlags: risks,
    recommendedReadonlyActions: actions,
  };
}
