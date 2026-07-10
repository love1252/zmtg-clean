export const weComCustomerMappingProof = {
  proofContactId: 'live-contact-proof-01',
  proofEmployeeId: 'live-employee-proof-01',
  sourceMode: 'real_readonly_proof',
} as const;

export const weComCustomerMappingStatuses = [
  'unreviewed',
  'confirmed',
  'rejected',
  'revoked',
] as const;

export const weComCustomerMappingActions = ['confirm', 'reject', 'revoke'] as const;

export const weComCustomerMappingAuditReasons = [
  'wecom_customer_mapping_confirmed',
  'wecom_customer_mapping_rejected',
  'wecom_customer_mapping_revoked',
  'wecom_customer_mapping_conflict_blocked',
  'wecom_customer_mapping_invalid_transition',
  'wecom_customer_mapping_customer_not_found',
] as const;

export type WeComCustomerMappingStatus = (typeof weComCustomerMappingStatuses)[number];
export type PersistedWeComCustomerMappingStatus = Exclude<
  WeComCustomerMappingStatus,
  'unreviewed'
>;
export type WeComCustomerMappingAction = (typeof weComCustomerMappingActions)[number];

export type CurrentWeComCustomerMappingState = {
  status: PersistedWeComCustomerMappingStatus;
  customerId: string;
} | null;

export type WeComCustomerMappingDecision =
  | {
      kind: 'transition';
      fromStatus: WeComCustomerMappingStatus;
      toStatus: PersistedWeComCustomerMappingStatus;
      customerId: string;
    }
  | {
      kind: 'idempotent';
      status: PersistedWeComCustomerMappingStatus;
      customerId: string;
    }
  | { kind: 'conflict' }
  | { kind: 'invalid_transition' };

export function decideWeComCustomerMappingTransition(input: {
  current: CurrentWeComCustomerMappingState;
  action: WeComCustomerMappingAction;
  customerId: string;
}): WeComCustomerMappingDecision {
  const { current, action, customerId } = input;

  if (!current) {
    if (action === 'revoke') return { kind: 'invalid_transition' };
    return {
      kind: 'transition',
      fromStatus: 'unreviewed',
      toStatus: action === 'confirm' ? 'confirmed' : 'rejected',
      customerId,
    };
  }

  if (current.status === 'confirmed') {
    if (action === 'confirm') {
      return current.customerId === customerId
        ? { kind: 'idempotent', status: current.status, customerId }
        : { kind: 'conflict' };
    }
    if (action === 'revoke' && current.customerId === customerId) {
      return {
        kind: 'transition',
        fromStatus: current.status,
        toStatus: 'revoked',
        customerId,
      };
    }
    return { kind: 'invalid_transition' };
  }

  if (current.status === 'rejected') {
    if (action === 'confirm') {
      return {
        kind: 'transition',
        fromStatus: current.status,
        toStatus: 'confirmed',
        customerId,
      };
    }
    if (action === 'reject' && current.customerId === customerId) {
      return { kind: 'idempotent', status: current.status, customerId };
    }
    return { kind: 'invalid_transition' };
  }

  if (action === 'confirm' || action === 'reject') {
    return {
      kind: 'transition',
      fromStatus: current.status,
      toStatus: action === 'confirm' ? 'confirmed' : 'rejected',
      customerId,
    };
  }
  return current.customerId === customerId
    ? { kind: 'idempotent', status: current.status, customerId }
    : { kind: 'invalid_transition' };
}
