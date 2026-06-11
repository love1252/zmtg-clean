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

export function buildV1ManagementReadonlyConfigSummary(
  input: V1ManagementReadonlyConfigInput,
  policy: V1ManagementReadonlyConfigPolicy,
): V1ManagementReadonlyConfigSummary {
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

  if (!policy.canReadManagementConfig) {
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
      reasonCode: 'no_management_config_candidates',
      resultCode: 'empty',
      emptyCopy,
      items: [],
    };
  }

  const items = candidates
    .map((candidate) => toReadonlyConfigItem(candidate))
    .filter((item): item is V1ManagementReadonlyConfigItem => item !== null);

  if (items.length === 0) {
    return {
      status: 'exception',
      reasonCode: 'management_config_source_missing',
      resultCode: 'unavailable',
      exceptionCopy: sourceMissingCopy,
      items: [],
    };
  }

  return {
    status: 'ready',
    reasonCode: 'management_config_ready',
    resultCode: 'readonly',
    items,
  };
}
