import { evaluateV1ReadonlyFeaturePolicy } from './v1-readonly-feature-policy';

export type V1ManagementReadonlyConfigPolicy = {
  featureEnabled: boolean;
  canReadManagementConfig: boolean;
  tenantScopeMatched: boolean;
};

export type V1ManagementReadonlyConfigScope = 'institution' | 'platform';

export type V1ManagementReadonlyConfigReadiness =
  | 'disabled'
  | 'ready'
  | 'blocked'
  | 'missing_configuration';

export type V1ManagementReadonlyConfigCandidateInput = {
  scope?: V1ManagementReadonlyConfigScope;
  configKey?: string;
  label?: string;
  lowSensitiveSummary?: string;
  readiness?: V1ManagementReadonlyConfigReadiness;
  mockSeedDemoFlag?: 'mock' | 'seed' | 'demo';
  [key: string]: unknown;
};

type V1ManagementReadonlyConfigValidCandidate =
  V1ManagementReadonlyConfigCandidateInput & {
    scope: V1ManagementReadonlyConfigScope;
    configKey: string;
    label: string;
    lowSensitiveSummary: string;
    readiness: V1ManagementReadonlyConfigReadiness;
    mockSeedDemoFlag: 'mock' | 'seed' | 'demo';
  };

export type V1ManagementReadonlyConfigInput = {
  candidates?: readonly V1ManagementReadonlyConfigCandidateInput[];
};

export type V1ManagementReadonlyConfigSummaryStatus =
  | 'disabled'
  | 'denied'
  | 'empty'
  | 'exception'
  | 'ready';

export type V1ManagementReadonlyConfigResultCode =
  | 'skipped'
  | 'denied'
  | 'empty'
  | 'unavailable'
  | 'readonly';

export const defaultV1ManagementReadonlyConfigPolicy = {
  featureEnabled: false,
  canReadManagementConfig: false,
  tenantScopeMatched: false,
} as const satisfies V1ManagementReadonlyConfigPolicy;

export const v1ManagementReadonlyConfigItemFields = [
  'scope',
  'configKey',
  'label',
  'lowSensitiveSummary',
  'readiness',
  'mockSeedDemoFlag',
  'readonly',
  'reasonCode',
  'resultCode',
] as const;

export type V1ManagementReadonlyConfigItem = {
  scope: V1ManagementReadonlyConfigScope;
  configKey: string;
  label: string;
  lowSensitiveSummary: string;
  readiness: V1ManagementReadonlyConfigReadiness;
  mockSeedDemoFlag: 'mock' | 'seed' | 'demo';
  readonly: true;
  reasonCode:
    | 'management_config_ready'
    | 'management_config_disabled'
    | 'management_config_blocked'
    | 'management_config_missing_configuration';
  resultCode: 'readonly';
};

export type V1ManagementReadonlyConfigSummary = {
  status: V1ManagementReadonlyConfigSummaryStatus;
  reasonCode:
    | 'feature_flag_disabled'
    | 'tenant_scope_mismatch'
    | 'permission_denied'
    | 'no_management_config_candidates'
    | 'management_config_source_missing'
    | 'management_config_ready';
  resultCode: V1ManagementReadonlyConfigResultCode;
  emptyCopy?: string;
  exceptionCopy?: string;
  items: V1ManagementReadonlyConfigItem[];
};

const disabledCopy = '该管理配置能力暂未开启';
const emptyCopy = '暂无可展示管理配置';
const deniedCopy = '当前账号没有访问权限';
const sourceMissingCopy = '管理配置来源不完整，仅作内部参考';
const managementReadonlyPolicyReasonCodes = {
  empty: 'no_management_config_candidates',
  exception: 'management_config_source_missing',
  ready: 'management_config_ready',
} as const;
const managementReadonlyPolicyCopies = {
  disabled: disabledCopy,
  denied: deniedCopy,
  empty: emptyCopy,
  exception: sourceMissingCopy,
} as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isConfigScope(value: unknown): value is V1ManagementReadonlyConfigScope {
  return value === 'institution' || value === 'platform';
}

function isConfigReadiness(value: unknown): value is V1ManagementReadonlyConfigReadiness {
  return (
    value === 'disabled' ||
    value === 'ready' ||
    value === 'blocked' ||
    value === 'missing_configuration'
  );
}

function isMockSeedDemoFlag(value: unknown): value is 'mock' | 'seed' | 'demo' {
  return value === 'mock' || value === 'seed' || value === 'demo';
}

function hasRequiredLowSensitiveConfigSource(
  candidate: V1ManagementReadonlyConfigCandidateInput,
): candidate is V1ManagementReadonlyConfigValidCandidate {
  return (
    isConfigScope(candidate.scope) &&
    isNonEmptyString(candidate.configKey) &&
    isNonEmptyString(candidate.label) &&
    isNonEmptyString(candidate.lowSensitiveSummary) &&
    isConfigReadiness(candidate.readiness) &&
    isMockSeedDemoFlag(candidate.mockSeedDemoFlag)
  );
}

function reasonCodeForReadiness(
  readiness: V1ManagementReadonlyConfigReadiness,
): V1ManagementReadonlyConfigItem['reasonCode'] {
  if (readiness === 'blocked') {
    return 'management_config_blocked';
  }

  if (readiness === 'disabled') {
    return 'management_config_disabled';
  }

  if (readiness === 'missing_configuration') {
    return 'management_config_missing_configuration';
  }

  return 'management_config_ready';
}

function toReadonlyConfigItem(
  candidate: V1ManagementReadonlyConfigCandidateInput,
): V1ManagementReadonlyConfigItem | null {
  if (!hasRequiredLowSensitiveConfigSource(candidate)) {
    return null;
  }

  return {
    scope: candidate.scope,
    configKey: candidate.configKey,
    label: candidate.label,
    lowSensitiveSummary: candidate.lowSensitiveSummary,
    readiness: candidate.readiness,
    mockSeedDemoFlag: candidate.mockSeedDemoFlag,
    readonly: true,
    reasonCode: reasonCodeForReadiness(candidate.readiness),
    resultCode: 'readonly',
  };
}

function evaluateManagementReadonlyConfigPolicy(
  policy: V1ManagementReadonlyConfigPolicy,
  candidateCount: number,
  readonlyItemCount?: number,
) {
  return evaluateV1ReadonlyFeaturePolicy({
    featureEnabled: policy.featureEnabled,
    tenantScopeMatched: policy.tenantScopeMatched,
    canRead: policy.canReadManagementConfig,
    candidateCount,
    ...(readonlyItemCount === undefined ? {} : { readonlyItemCount }),
    reasonCodes: managementReadonlyPolicyReasonCodes,
    copies: managementReadonlyPolicyCopies,
  });
}

function toManagementReadonlyConfigEmptySummary(
  result: ReturnType<typeof evaluateManagementReadonlyConfigPolicy>,
): V1ManagementReadonlyConfigSummary {
  return {
    status: result.status,
    reasonCode: result.reasonCode,
    resultCode: result.resultCode,
    ...(result.emptyCopy === undefined ? {} : { emptyCopy: result.emptyCopy }),
    ...(result.exceptionCopy === undefined ? {} : { exceptionCopy: result.exceptionCopy }),
    items: [],
  };
}

export function buildV1ManagementReadonlyConfigSummary(
  input: V1ManagementReadonlyConfigInput,
  policy: V1ManagementReadonlyConfigPolicy,
): V1ManagementReadonlyConfigSummary {
  const candidates = input.candidates ?? [];
  const guardResult = evaluateManagementReadonlyConfigPolicy(policy, candidates.length);

  if (guardResult.status !== 'ready') {
    return toManagementReadonlyConfigEmptySummary(guardResult);
  }

  const items = candidates
    .map((candidate) => toReadonlyConfigItem(candidate))
    .filter((item): item is V1ManagementReadonlyConfigItem => item !== null);
  const finalPolicyResult = evaluateManagementReadonlyConfigPolicy(
    policy,
    candidates.length,
    items.length,
  );

  if (finalPolicyResult.status !== 'ready') {
    return toManagementReadonlyConfigEmptySummary(finalPolicyResult);
  }

  return {
    status: finalPolicyResult.status,
    reasonCode: finalPolicyResult.reasonCode,
    resultCode: finalPolicyResult.resultCode,
    items,
  };
}
