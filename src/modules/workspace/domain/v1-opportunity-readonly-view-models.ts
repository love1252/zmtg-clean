export type V1OpportunityReadonlyPolicy = {
  featureEnabled: boolean;
  canReadOpportunities: boolean;
  tenantScopeMatched: boolean;
};

export type V1OpportunityType =
  | 'revisit_reminder'
  | 'repurchase'
  | 'dormant_customer';

export type V1OpportunityPriority = 'low' | 'medium' | 'high';

export type V1OpportunityReadonlyCandidateInput = {
  opportunityType?: V1OpportunityType;
  sourceType?: string;
  sourceSummary?: string;
  triggerReason?: string;
  suggestedAction?: string;
  priority?: V1OpportunityPriority;
  dueDateWindow?: string;
  status?: string;
  mockSeedDemoFlag?: 'mock' | 'seed' | 'demo';
  [key: string]: unknown;
};

type V1OpportunityReadonlyValidCandidate = V1OpportunityReadonlyCandidateInput & {
  opportunityType: V1OpportunityType;
  sourceType: string;
  sourceSummary: string;
  triggerReason: string;
  suggestedAction: string;
  priority: V1OpportunityPriority;
  mockSeedDemoFlag: 'mock' | 'seed' | 'demo';
};

export type V1OpportunityReadonlyInput = {
  candidates?: readonly V1OpportunityReadonlyCandidateInput[];
};

export type V1OpportunityReadonlyStatus =
  | 'disabled'
  | 'denied'
  | 'empty'
  | 'exception'
  | 'ready';

export type V1OpportunityReadonlyResultCode =
  | 'skipped'
  | 'denied'
  | 'empty'
  | 'unavailable'
  | 'readonly'
  | 'blocked';

export type V1OpportunityReadonlyItem = {
  opportunityType: V1OpportunityType;
  sourceType: string;
  sourceSummary: string;
  triggerReason: string;
  suggestedAction: string;
  priority: V1OpportunityPriority;
  dueDateWindow?: string;
  status: string;
  mockSeedDemoFlag: 'mock' | 'seed' | 'demo';
  reasonCode: string;
  resultCode: 'readonly' | 'blocked';
};

export type V1OpportunityReadonlySummary = {
  status: V1OpportunityReadonlyStatus;
  reasonCode: string;
  resultCode: V1OpportunityReadonlyResultCode;
  emptyCopy?: string;
  exceptionCopy?: string;
  opportunities: V1OpportunityReadonlyItem[];
};

const emptyOpportunityCopy = '暂无待处理机会';
const sourceMissingCopy = '机会来源不完整，仅作内部参考';
const disabledCopy = '该能力暂未开启';
const deniedCopy = '当前账号没有访问权限';
const blockedSuggestedAction = '当前状态不可执行，请刷新后重新判断';

const blockedStateReasonCodes: Record<string, string> = {
  stale: 'state_stale',
  already_handled: 'already_handled',
  invalid_transition: 'invalid_transition',
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOpportunityType(value: unknown): value is V1OpportunityType {
  return (
    value === 'revisit_reminder' ||
    value === 'repurchase' ||
    value === 'dormant_customer'
  );
}

function isPriority(value: unknown): value is V1OpportunityPriority {
  return value === 'low' || value === 'medium' || value === 'high';
}

function isMockSeedDemoFlag(value: unknown): value is 'mock' | 'seed' | 'demo' {
  return value === 'mock' || value === 'seed' || value === 'demo';
}

function hasRequiredLowSensitiveSource(
  candidate: V1OpportunityReadonlyCandidateInput,
): candidate is V1OpportunityReadonlyValidCandidate {
  return (
    isOpportunityType(candidate.opportunityType) &&
    isNonEmptyString(candidate.sourceType) &&
    isNonEmptyString(candidate.sourceSummary) &&
    isNonEmptyString(candidate.triggerReason) &&
    isNonEmptyString(candidate.suggestedAction) &&
    isPriority(candidate.priority) &&
    isMockSeedDemoFlag(candidate.mockSeedDemoFlag)
  );
}

function blockedReasonCode(status: string | undefined) {
  return status ? blockedStateReasonCodes[status] : undefined;
}

function toReadonlyItem(
  candidate: V1OpportunityReadonlyCandidateInput,
): V1OpportunityReadonlyItem | null {
  if (!hasRequiredLowSensitiveSource(candidate)) {
    return null;
  }

  const blockedReason = blockedReasonCode(candidate.status);
  const isBlocked = Boolean(blockedReason);

  return {
    opportunityType: candidate.opportunityType,
    sourceType: candidate.sourceType,
    sourceSummary: candidate.sourceSummary,
    triggerReason: candidate.triggerReason,
    suggestedAction: isBlocked ? blockedSuggestedAction : candidate.suggestedAction,
    priority: candidate.priority,
    ...(isNonEmptyString(candidate.dueDateWindow)
      ? { dueDateWindow: candidate.dueDateWindow }
      : {}),
    status: isBlocked ? 'blocked' : candidate.status ?? 'pending_confirmation',
    mockSeedDemoFlag: candidate.mockSeedDemoFlag,
    reasonCode: blockedReason ?? 'candidate_ready',
    resultCode: isBlocked ? 'blocked' : 'readonly',
  };
}

export function buildV1OpportunityReadonlySummary(
  input: V1OpportunityReadonlyInput,
  policy: V1OpportunityReadonlyPolicy,
): V1OpportunityReadonlySummary {
  if (!policy.featureEnabled) {
    return {
      status: 'disabled',
      reasonCode: 'feature_flag_disabled',
      resultCode: 'skipped',
      emptyCopy: disabledCopy,
      opportunities: [],
    };
  }

  if (!policy.tenantScopeMatched) {
    return {
      status: 'denied',
      reasonCode: 'tenant_scope_mismatch',
      resultCode: 'denied',
      exceptionCopy: deniedCopy,
      opportunities: [],
    };
  }

  if (!policy.canReadOpportunities) {
    return {
      status: 'denied',
      reasonCode: 'permission_denied',
      resultCode: 'denied',
      exceptionCopy: deniedCopy,
      opportunities: [],
    };
  }

  const candidates = input.candidates ?? [];

  if (candidates.length === 0) {
    return {
      status: 'empty',
      reasonCode: 'no_candidate_opportunities',
      resultCode: 'empty',
      emptyCopy: emptyOpportunityCopy,
      opportunities: [],
    };
  }

  const opportunities = candidates
    .map((candidate) => toReadonlyItem(candidate))
    .filter((candidate): candidate is V1OpportunityReadonlyItem => candidate !== null);

  if (opportunities.length === 0) {
    return {
      status: 'exception',
      reasonCode: 'source_missing',
      resultCode: 'unavailable',
      exceptionCopy: sourceMissingCopy,
      opportunities: [],
    };
  }

  return {
    status: 'ready',
    reasonCode: 'candidate_ready',
    resultCode: 'readonly',
    opportunities,
  };
}
