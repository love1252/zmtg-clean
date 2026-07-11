export const weComReachOutChannelType = 'wechat_work' as const;

export const weComReachOutConsentStatuses = [
  'unknown',
  'consented',
  'opted_out',
  'consent_revoked',
] as const;
export type WeComReachOutConsentStatus = (typeof weComReachOutConsentStatuses)[number];

export const weComReachOutConsentSourceTypes = [
  'customer_explicit_verbal',
  'customer_explicit_written',
  'customer_opt_out_request',
  'customer_consent_revocation',
] as const;
export type WeComReachOutConsentSourceType = (typeof weComReachOutConsentSourceTypes)[number];

export const weComReachOutConsentActions = [
  'record_consent',
  'record_opt_out',
  'revoke_consent',
] as const;
export type WeComReachOutConsentAction = (typeof weComReachOutConsentActions)[number];

export const weComReachOutConsentConfirmations = {
  record_consent: '我确认客户已明确同意通过企业微信联系',
  record_opt_out: '我确认客户已明确要求停止企业微信联系',
  revoke_consent: '我确认客户已撤回企业微信联系同意',
} as const satisfies Record<WeComReachOutConsentAction, string>;

export type WeComReachOutConsentTransition = {
  status: Exclude<WeComReachOutConsentStatus, 'unknown'>;
  sourceType: WeComReachOutConsentSourceType;
};

export function decideWeComReachOutConsentTransition(input: {
  action: WeComReachOutConsentAction;
  sourceType: WeComReachOutConsentSourceType;
  confirmation: string;
}): { kind: 'transition'; transition: WeComReachOutConsentTransition } | { kind: 'invalid' } {
  if (input.confirmation !== weComReachOutConsentConfirmations[input.action]) {
    return { kind: 'invalid' };
  }

  if (
    input.action === 'record_consent' &&
    (input.sourceType === 'customer_explicit_verbal' ||
      input.sourceType === 'customer_explicit_written')
  ) {
    return {
      kind: 'transition',
      transition: { status: 'consented', sourceType: input.sourceType },
    };
  }
  if (input.action === 'record_opt_out' && input.sourceType === 'customer_opt_out_request') {
    return {
      kind: 'transition',
      transition: { status: 'opted_out', sourceType: input.sourceType },
    };
  }
  if (input.action === 'revoke_consent' && input.sourceType === 'customer_consent_revocation') {
    return {
      kind: 'transition',
      transition: { status: 'consent_revoked', sourceType: input.sourceType },
    };
  }

  return { kind: 'invalid' };
}

export function consentBlocksPreparedAttempt(status: WeComReachOutConsentStatus) {
  if (status === 'opted_out') return 'opted_out' as const;
  if (status !== 'consented') return 'consent_required' as const;
  return null;
}

export const weComReachOutFrequencyPolicy = {
  windowHours: 24,
  maxPreparedCount: 1,
  maxCompletedCount: 1,
} as const;

export function createWeComReachOutOperationRef(systemOperationId: string) {
  const normalized = systemOperationId.normalize('NFKC').trim();
  if (!/^[a-zA-Z0-9_-]{1,80}$/u.test(normalized)) return null;
  return `wrop_${normalized}` as const;
}

export function createWeComReachOutFrequencyWindow(now: Date) {
  const windowStartedAt = new Date(now);
  const windowEndsAt = new Date(now.getTime() + weComReachOutFrequencyPolicy.windowHours * 60 * 60 * 1000);
  return { windowStartedAt, windowEndsAt };
}
