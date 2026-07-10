import type {
  WeComCustomerContactPrecheckStatus,
  WeComCustomerContactPrecheckSummary,
} from '@/modules/institution/domain/wecom-customer-contact-precheck';

export const weComCustomerContactReadonlyProofMockStatuses = [
  'blocked_config_precheck_not_ready',
  'blocked_real_network_must_remain_disabled',
  'blocked_customer_read_must_remain_disabled',
  'blocked_real_send_must_remain_disabled',
  'mock_list_ready',
  'mock_detail_ready',
  'mock_contact_not_found',
] as const;

export type WeComCustomerContactReadonlyProofMockStatus =
  (typeof weComCustomerContactReadonlyProofMockStatuses)[number];

export type WeComCustomerContactReadonlyProofMockEmployee = {
  proofEmployeeId: 'mock-employee-proof-01';
  mode: 'mock_only';
  proofAuthorized: false;
};

export type WeComCustomerContactReadonlyProofMockContact = {
  proofContactId: 'mock-contact-proof-01';
  proofEmployeeId: 'mock-employee-proof-01';
  customerType: 'external_contact';
  addedAt: '2026-07-10T00:00:00.000Z';
  relationshipStatus: 'visible';
  deletionStatus: 'active';
  tagNames: ['mock_low_sensitive', 'readonly_proof'];
  detailAvailable: true;
  mode: 'mock_only';
  fieldWhitelistApplied: true;
  proofAuthorized: false;
};

type PrecheckResult = Pick<
  WeComCustomerContactPrecheckSummary,
  'precheckStatus' | 'networkEnabled' | 'customerReadEnabled' | 'realSendEnabled'
>;

type ResponseState = {
  precheckStatus: WeComCustomerContactPrecheckStatus;
  mockProofStatus: WeComCustomerContactReadonlyProofMockStatus;
  reason: WeComCustomerContactReadonlyProofMockStatus;
  proofAuthorized: false;
};

export type WeComCustomerContactReadonlyProofMockList = ResponseState & {
  employee: WeComCustomerContactReadonlyProofMockEmployee | null;
  contacts: WeComCustomerContactReadonlyProofMockContact[];
};

export type WeComCustomerContactReadonlyProofMockDetail = ResponseState & {
  contact?: WeComCustomerContactReadonlyProofMockContact;
};

const mockEmployee: WeComCustomerContactReadonlyProofMockEmployee = {
  proofEmployeeId: 'mock-employee-proof-01',
  mode: 'mock_only',
  proofAuthorized: false,
};

const mockContact: WeComCustomerContactReadonlyProofMockContact = {
  proofContactId: 'mock-contact-proof-01',
  proofEmployeeId: mockEmployee.proofEmployeeId,
  customerType: 'external_contact',
  addedAt: '2026-07-10T00:00:00.000Z',
  relationshipStatus: 'visible',
  deletionStatus: 'active',
  tagNames: ['mock_low_sensitive', 'readonly_proof'],
  detailAvailable: true,
  mode: 'mock_only',
  fieldWhitelistApplied: true,
  proofAuthorized: false,
};

function resolveBlockedStatus(
  precheck: PrecheckResult,
): WeComCustomerContactReadonlyProofMockStatus | null {
  if (
    precheck.networkEnabled ||
    precheck.precheckStatus === 'blocked_real_network_must_remain_disabled'
  ) {
    return 'blocked_real_network_must_remain_disabled';
  }
  if (
    precheck.customerReadEnabled ||
    precheck.precheckStatus === 'blocked_customer_read_must_remain_disabled'
  ) {
    return 'blocked_customer_read_must_remain_disabled';
  }
  if (
    precheck.realSendEnabled ||
    precheck.precheckStatus === 'blocked_real_send_must_remain_disabled'
  ) {
    return 'blocked_real_send_must_remain_disabled';
  }
  if (precheck.precheckStatus !== 'config_precheck_ready') {
    return 'blocked_config_precheck_not_ready';
  }
  return null;
}

function responseState(
  precheckStatus: WeComCustomerContactPrecheckStatus,
  mockProofStatus: WeComCustomerContactReadonlyProofMockStatus,
): ResponseState {
  return {
    precheckStatus,
    mockProofStatus,
    reason: mockProofStatus,
    proofAuthorized: false,
  };
}

function contactView(): WeComCustomerContactReadonlyProofMockContact {
  return { ...mockContact, tagNames: [...mockContact.tagNames] };
}

export function createWeComCustomerContactReadonlyProofMockList(
  precheck: PrecheckResult,
): WeComCustomerContactReadonlyProofMockList {
  const blockedStatus = resolveBlockedStatus(precheck);
  if (blockedStatus) {
    return {
      ...responseState(precheck.precheckStatus, blockedStatus),
      employee: null,
      contacts: [],
    };
  }

  return {
    ...responseState(precheck.precheckStatus, 'mock_list_ready'),
    employee: { ...mockEmployee },
    contacts: [contactView()],
  };
}

export function createWeComCustomerContactReadonlyProofMockDetail(input: {
  precheck: PrecheckResult;
  proofContactId: string;
}): WeComCustomerContactReadonlyProofMockDetail {
  const blockedStatus = resolveBlockedStatus(input.precheck);
  if (blockedStatus) {
    return responseState(input.precheck.precheckStatus, blockedStatus);
  }

  if (input.proofContactId !== mockContact.proofContactId) {
    return responseState(input.precheck.precheckStatus, 'mock_contact_not_found');
  }

  return {
    ...responseState(input.precheck.precheckStatus, 'mock_detail_ready'),
    contact: contactView(),
  };
}
