export type V1BusinessClosedLoopReadonlyAggregationPolicy = {
  featureEnabled: boolean;
  canReadClosedLoopAggregation: boolean;
  tenantScopeMatched: boolean;
};

export type V1BusinessClosedLoopReadonlyAggregationSourceKey =
  | 'business_closed_loop_readonly'
  | 'management_readonly_config'
  | 'opportunity_readonly'
  | 'workspace_dashboard_readonly';

export type V1BusinessClosedLoopReadonlyAggregationReadiness =
  | 'ready'
  | 'blocked'
  | 'empty'
  | 'exception'
  | 'disabled';

export type V1BusinessClosedLoopReadonlyAggregationCandidateInput = {
  sourceKey?: V1BusinessClosedLoopReadonlyAggregationSourceKey;
  label?: string;
  lowSensitiveSummary?: string;
  readiness?: V1BusinessClosedLoopReadonlyAggregationReadiness;
  metricValue?: string;
  mockSeedDemoFlag?: 'mock' | 'seed' | 'demo';
  [key: string]: unknown;
};

type V1BusinessClosedLoopReadonlyAggregationValidCandidate =
  V1BusinessClosedLoopReadonlyAggregationCandidateInput & {
    sourceKey: V1BusinessClosedLoopReadonlyAggregationSourceKey;
    label: string;
    lowSensitiveSummary: string;
    readiness: V1BusinessClosedLoopReadonlyAggregationReadiness;
    metricValue: string;
    mockSeedDemoFlag: 'mock' | 'seed' | 'demo';
  };

export type V1BusinessClosedLoopReadonlyAggregationInput = {
  candidates?: readonly V1BusinessClosedLoopReadonlyAggregationCandidateInput[];
};

export type V1BusinessClosedLoopReadonlyAggregationStatus =
  | 'disabled'
  | 'denied'
  | 'empty'
  | 'exception'
  | 'ready';

export type V1BusinessClosedLoopReadonlyAggregationResultCode =
  | 'skipped'
  | 'denied'
  | 'empty'
  | 'unavailable'
  | 'readonly';

export const defaultV1BusinessClosedLoopReadonlyAggregationPolicy = {
  featureEnabled: false,
  canReadClosedLoopAggregation: false,
  tenantScopeMatched: false,
} as const satisfies V1BusinessClosedLoopReadonlyAggregationPolicy;

export const v1BusinessClosedLoopReadonlyAggregationItemFields = [
  'sourceKey',
  'label',
  'lowSensitiveSummary',
  'readiness',
  'metricValue',
  'mockSeedDemoFlag',
  'readonly',
  'reasonCode',
  'resultCode',
] as const;

export type V1BusinessClosedLoopReadonlyAggregationItem = {
  sourceKey: V1BusinessClosedLoopReadonlyAggregationSourceKey;
  label: string;
  lowSensitiveSummary: string;
  readiness: V1BusinessClosedLoopReadonlyAggregationReadiness;
  metricValue: string;
  mockSeedDemoFlag: 'mock' | 'seed' | 'demo';
  readonly: true;
  reasonCode:
    | 'closed_loop_aggregation_ready'
    | 'closed_loop_aggregation_blocked'
    | 'closed_loop_aggregation_empty'
    | 'closed_loop_aggregation_exception'
    | 'closed_loop_aggregation_disabled';
  resultCode: 'readonly';
};

export type V1BusinessClosedLoopReadonlyAggregationSummary = {
  status: V1BusinessClosedLoopReadonlyAggregationStatus;
  reasonCode:
    | 'feature_flag_disabled'
    | 'tenant_scope_mismatch'
    | 'permission_denied'
    | 'no_closed_loop_aggregation_candidates'
    | 'closed_loop_aggregation_source_missing'
    | 'closed_loop_aggregation_ready';
  resultCode: V1BusinessClosedLoopReadonlyAggregationResultCode;
  emptyCopy?: string;
  exceptionCopy?: string;
  items: V1BusinessClosedLoopReadonlyAggregationItem[];
};

const disabledCopy = '该主业务闭环只读聚合能力暂未开启';
const emptyCopy = '暂无可展示主业务闭环聚合';
const deniedCopy = '当前账号没有访问权限';
const sourceMissingCopy = '主业务闭环聚合来源不完整，仅作内部参考';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isAggregationSourceKey(
  value: unknown,
): value is V1BusinessClosedLoopReadonlyAggregationSourceKey {
  return (
    value === 'business_closed_loop_readonly' ||
    value === 'management_readonly_config' ||
    value === 'opportunity_readonly' ||
    value === 'workspace_dashboard_readonly'
  );
}

function isAggregationReadiness(
  value: unknown,
): value is V1BusinessClosedLoopReadonlyAggregationReadiness {
  return (
    value === 'ready' ||
    value === 'blocked' ||
    value === 'empty' ||
    value === 'exception' ||
    value === 'disabled'
  );
}

function isMockSeedDemoFlag(value: unknown): value is 'mock' | 'seed' | 'demo' {
  return value === 'mock' || value === 'seed' || value === 'demo';
}

function hasRequiredLowSensitiveAggregationSource(
  candidate: V1BusinessClosedLoopReadonlyAggregationCandidateInput,
): candidate is V1BusinessClosedLoopReadonlyAggregationValidCandidate {
  return (
    isAggregationSourceKey(candidate.sourceKey) &&
    isNonEmptyString(candidate.label) &&
    isNonEmptyString(candidate.lowSensitiveSummary) &&
    isAggregationReadiness(candidate.readiness) &&
    isNonEmptyString(candidate.metricValue) &&
    isMockSeedDemoFlag(candidate.mockSeedDemoFlag)
  );
}

function reasonCodeForReadiness(
  readiness: V1BusinessClosedLoopReadonlyAggregationReadiness,
): V1BusinessClosedLoopReadonlyAggregationItem['reasonCode'] {
  if (readiness === 'blocked') {
    return 'closed_loop_aggregation_blocked';
  }

  if (readiness === 'empty') {
    return 'closed_loop_aggregation_empty';
  }

  if (readiness === 'exception') {
    return 'closed_loop_aggregation_exception';
  }

  if (readiness === 'disabled') {
    return 'closed_loop_aggregation_disabled';
  }

  return 'closed_loop_aggregation_ready';
}

function toReadonlyAggregationItem(
  candidate: V1BusinessClosedLoopReadonlyAggregationCandidateInput,
): V1BusinessClosedLoopReadonlyAggregationItem | null {
  if (!hasRequiredLowSensitiveAggregationSource(candidate)) {
    return null;
  }

  return {
    sourceKey: candidate.sourceKey,
    label: candidate.label,
    lowSensitiveSummary: candidate.lowSensitiveSummary,
    readiness: candidate.readiness,
    metricValue: candidate.metricValue,
    mockSeedDemoFlag: candidate.mockSeedDemoFlag,
    readonly: true,
    reasonCode: reasonCodeForReadiness(candidate.readiness),
    resultCode: 'readonly',
  };
}

export function buildV1BusinessClosedLoopReadonlyAggregationSummary(
  input: V1BusinessClosedLoopReadonlyAggregationInput,
  policy: V1BusinessClosedLoopReadonlyAggregationPolicy,
): V1BusinessClosedLoopReadonlyAggregationSummary {
  if (!policy.featureEnabled) {
    return {
      status: 'disabled',
      reasonCode: 'feature_flag_disabled',
      resultCode: 'skipped',
      emptyCopy: disabledCopy,
      items: [],
    };
  }

  if (!policy.tenantScopeMatched) {
    return {
      status: 'denied',
      reasonCode: 'tenant_scope_mismatch',
      resultCode: 'denied',
      exceptionCopy: deniedCopy,
      items: [],
    };
  }

  if (!policy.canReadClosedLoopAggregation) {
    return {
      status: 'denied',
      reasonCode: 'permission_denied',
      resultCode: 'denied',
      exceptionCopy: deniedCopy,
      items: [],
    };
  }

  const candidates = input.candidates ?? [];

  if (candidates.length === 0) {
    return {
      status: 'empty',
      reasonCode: 'no_closed_loop_aggregation_candidates',
      resultCode: 'empty',
      emptyCopy,
      items: [],
    };
  }

  const items = candidates
    .map((candidate) => toReadonlyAggregationItem(candidate))
    .filter((item): item is V1BusinessClosedLoopReadonlyAggregationItem => item !== null);

  if (items.length === 0) {
    return {
      status: 'exception',
      reasonCode: 'closed_loop_aggregation_source_missing',
      resultCode: 'unavailable',
      exceptionCopy: sourceMissingCopy,
      items: [],
    };
  }

  return {
    status: 'ready',
    reasonCode: 'closed_loop_aggregation_ready',
    resultCode: 'readonly',
    items,
  };
}
