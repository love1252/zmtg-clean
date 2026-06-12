import type {
  V1WorkspaceDashboardReadonlyAggregationResultCode,
  V1WorkspaceDashboardReadonlyAggregationStatus,
  V1WorkspaceDashboardReadonlyAggregationSummary,
  V1WorkspaceDashboardStatus,
} from './v1-workspace-dashboard-readonly-aggregation-view-models';

export type V1WorkspaceDashboardReadonlyAggregationApiContractMapperInput = {
  requestId?: string;
  aggregation: V1WorkspaceDashboardReadonlyAggregationSummary;
};

export type V1WorkspaceDashboardReadonlyAggregationApiContractSection = {
  sectionId:
    | 'business-loop'
    | 'management-config'
    | 'knowledge-governance'
    | 'readonly-policy';
  label: string;
  summary: string;
  readonly: true;
};

export type V1WorkspaceDashboardReadonlyAggregationApiContractTaskRecord = {
  recordId:
    | 'workspace-dashboard-readonly-aggregation-disabled'
    | 'workspace-dashboard-readonly-aggregation-denied'
    | 'workspace-dashboard-readonly-aggregation-empty'
    | 'workspace-dashboard-readonly-aggregation-source-missing'
    | 'workspace-dashboard-readonly-aggregation-partial'
    | 'workspace-dashboard-readonly-aggregation-stale'
    | 'workspace-dashboard-readonly-aggregation-ready';
  status: 'skipped' | 'blocked' | 'empty' | 'partial' | 'stale' | 'ready';
  title: 'workspace dashboard readonly aggregation';
  failureReason: string;
  readonly: true;
};

export type V1WorkspaceDashboardReadonlyAggregationApiContractSnapshot = {
  status: V1WorkspaceDashboardReadonlyAggregationStatus;
  reasonCode: V1WorkspaceDashboardReadonlyAggregationSummary['reasonCode'];
  resultCode: V1WorkspaceDashboardReadonlyAggregationResultCode;
  dashboardStatus: V1WorkspaceDashboardStatus;
  businessLoopSummary: string;
  managementConfigSummary: string;
  knowledgeGovernanceSummary: string;
  fieldWhitelistSummary: string;
  readonlyFeaturePolicySummary: string;
  readonly: true;
};

export type V1WorkspaceDashboardReadonlyAggregationApiContractResponse = {
  requestId: string;
  tenantId: string;
  institutionId: string;
  workspaceId: string;
  status: V1WorkspaceDashboardReadonlyAggregationStatus;
  dashboardStatus: V1WorkspaceDashboardStatus;
  summary: {
    title: 'workspace dashboard readonly aggregation API 契约';
    statusText: string;
    description: string;
  };
  businessLoop: V1WorkspaceDashboardReadonlyAggregationApiContractSection;
  managementConfig: V1WorkspaceDashboardReadonlyAggregationApiContractSection;
  knowledgeGovernance: V1WorkspaceDashboardReadonlyAggregationApiContractSection;
  readonlyPolicy: V1WorkspaceDashboardReadonlyAggregationApiContractSection;
  taskRecords: V1WorkspaceDashboardReadonlyAggregationApiContractTaskRecord[];
  aggregation: V1WorkspaceDashboardReadonlyAggregationApiContractSnapshot;
  riskFlags: readonly string[];
  recommendedReadonlyActions: readonly string[];
  readonly: true;
};

export const v1WorkspaceDashboardReadonlyAggregationApiContractFields = [
  'requestId',
  'tenantId',
  'institutionId',
  'workspaceId',
  'status',
  'dashboardStatus',
  'summary',
  'title',
  'statusText',
  'description',
  'businessLoop',
  'managementConfig',
  'knowledgeGovernance',
  'readonlyPolicy',
  'sectionId',
  'label',
  'readonly',
  'taskRecords',
  'recordId',
  'failureReason',
  'aggregation',
  'reasonCode',
  'resultCode',
  'businessLoopSummary',
  'managementConfigSummary',
  'knowledgeGovernanceSummary',
  'fieldWhitelistSummary',
  'readonlyFeaturePolicySummary',
  'riskFlags',
  'recommendedReadonlyActions',
] as const;

const defaultRequestId = 'workspace-dashboard-readonly-aggregation-api-contract-request';
const notAvailable = 'not_available';

function descriptionForAggregation(
  aggregation: V1WorkspaceDashboardReadonlyAggregationSummary,
): string {
  if (aggregation.emptyCopy !== undefined) {
    return aggregation.emptyCopy;
  }

  if (aggregation.exceptionCopy !== undefined) {
    return aggregation.exceptionCopy;
  }

  if (aggregation.staleCopy !== undefined) {
    return aggregation.staleCopy;
  }

  return 'workspace dashboard 只读聚合可用于 demo 摘要展示';
}

function section(
  sectionId: V1WorkspaceDashboardReadonlyAggregationApiContractSection['sectionId'],
  label: string,
  summary: string,
): V1WorkspaceDashboardReadonlyAggregationApiContractSection {
  return {
    sectionId,
    label,
    summary,
    readonly: true,
  };
}

function failureReasonForAggregation(
  aggregation: V1WorkspaceDashboardReadonlyAggregationSummary,
): string {
  if (aggregation.dashboardStatus === 'disabled') {
    return '只读聚合能力暂未开启';
  }

  if (aggregation.dashboardStatus === 'denied') {
    return '当前账号没有访问权限';
  }

  if (aggregation.dashboardStatus === 'empty') {
    return '暂无可展示 workspace dashboard 只读聚合';
  }

  if (aggregation.dashboardStatus === 'source_missing') {
    return 'workspace dashboard 来源不完整，请复核 demo seed 配置';
  }

  if (aggregation.dashboardStatus === 'partial') {
    return 'workspace dashboard 部分来源不完整，仅展示可用只读摘要';
  }

  if (aggregation.dashboardStatus === 'stale') {
    return 'workspace dashboard 只读聚合可能已过期';
  }

  return notAvailable;
}

function taskRecordForAggregation(
  aggregation: V1WorkspaceDashboardReadonlyAggregationSummary,
): V1WorkspaceDashboardReadonlyAggregationApiContractTaskRecord {
  if (aggregation.dashboardStatus === 'disabled') {
    return {
      recordId: 'workspace-dashboard-readonly-aggregation-disabled',
      status: 'skipped',
      title: 'workspace dashboard readonly aggregation',
      failureReason: failureReasonForAggregation(aggregation),
      readonly: true,
    };
  }

  if (aggregation.dashboardStatus === 'denied') {
    return {
      recordId: 'workspace-dashboard-readonly-aggregation-denied',
      status: 'blocked',
      title: 'workspace dashboard readonly aggregation',
      failureReason: failureReasonForAggregation(aggregation),
      readonly: true,
    };
  }

  if (aggregation.dashboardStatus === 'empty') {
    return {
      recordId: 'workspace-dashboard-readonly-aggregation-empty',
      status: 'empty',
      title: 'workspace dashboard readonly aggregation',
      failureReason: failureReasonForAggregation(aggregation),
      readonly: true,
    };
  }

  if (aggregation.dashboardStatus === 'source_missing') {
    return {
      recordId: 'workspace-dashboard-readonly-aggregation-source-missing',
      status: 'blocked',
      title: 'workspace dashboard readonly aggregation',
      failureReason: failureReasonForAggregation(aggregation),
      readonly: true,
    };
  }

  if (aggregation.dashboardStatus === 'partial') {
    return {
      recordId: 'workspace-dashboard-readonly-aggregation-partial',
      status: 'partial',
      title: 'workspace dashboard readonly aggregation',
      failureReason: failureReasonForAggregation(aggregation),
      readonly: true,
    };
  }

  if (aggregation.dashboardStatus === 'stale') {
    return {
      recordId: 'workspace-dashboard-readonly-aggregation-stale',
      status: 'stale',
      title: 'workspace dashboard readonly aggregation',
      failureReason: failureReasonForAggregation(aggregation),
      readonly: true,
    };
  }

  return {
    recordId: 'workspace-dashboard-readonly-aggregation-ready',
    status: 'ready',
    title: 'workspace dashboard readonly aggregation',
    failureReason: notAvailable,
    readonly: true,
  };
}

function aggregationSnapshot(
  aggregation: V1WorkspaceDashboardReadonlyAggregationSummary,
): V1WorkspaceDashboardReadonlyAggregationApiContractSnapshot {
  return {
    status: aggregation.status,
    reasonCode: aggregation.reasonCode,
    resultCode: aggregation.resultCode,
    dashboardStatus: aggregation.dashboardStatus,
    businessLoopSummary: aggregation.businessLoopSummary,
    managementConfigSummary: aggregation.managementConfigSummary,
    knowledgeGovernanceSummary: aggregation.knowledgeGovernanceSummary,
    fieldWhitelistSummary: aggregation.fieldWhitelistSummary,
    readonlyFeaturePolicySummary: aggregation.readonlyFeaturePolicySummary,
    readonly: true,
  };
}

export function buildV1WorkspaceDashboardReadonlyAggregationApiContractResponse(
  input: V1WorkspaceDashboardReadonlyAggregationApiContractMapperInput,
): V1WorkspaceDashboardReadonlyAggregationApiContractResponse {
  const { aggregation } = input;

  return {
    requestId: input.requestId ?? defaultRequestId,
    tenantId: aggregation.tenantId,
    institutionId: aggregation.institutionId,
    workspaceId: aggregation.workspaceId,
    status: aggregation.status,
    dashboardStatus: aggregation.dashboardStatus,
    summary: {
      title: 'workspace dashboard readonly aggregation API 契约',
      statusText: `${aggregation.status} / ${aggregation.resultCode}`,
      description: descriptionForAggregation(aggregation),
    },
    businessLoop: section('business-loop', '业务闭环只读聚合', aggregation.businessLoopSummary),
    managementConfig: section(
      'management-config',
      '管理配置只读聚合',
      aggregation.managementConfigSummary,
    ),
    knowledgeGovernance: section(
      'knowledge-governance',
      '知识库治理只读聚合',
      aggregation.knowledgeGovernanceSummary,
    ),
    readonlyPolicy: section(
      'readonly-policy',
      '只读策略与低敏白名单',
      aggregation.readonlyFeaturePolicySummary,
    ),
    taskRecords: [taskRecordForAggregation(aggregation)],
    aggregation: aggregationSnapshot(aggregation),
    riskFlags: [...aggregation.riskFlags],
    recommendedReadonlyActions: [...aggregation.recommendedReadonlyActions],
    readonly: true,
  };
}
