import { describe, expect, it, vi } from 'vitest';
import {
  createWeComCustomerContactReadonlyProofMockDetail,
  createWeComCustomerContactReadonlyProofMockList,
  weComCustomerContactReadonlyProofMockStatuses,
} from '@/modules/institution/domain/wecom-customer-contact-readonly-proof-mock';
import type { WeComCustomerContactPrecheckSummary } from '@/modules/institution/domain/wecom-customer-contact-precheck';

const readyPrecheck: WeComCustomerContactPrecheckSummary = {
  configured: true,
  capabilityEnabled: true,
  permissionConfirmed: true,
  credentialPlaceholderReady: true,
  singleEmployeeSelected: true,
  customerReadEnabled: false,
  networkEnabled: false,
  realSendEnabled: false,
  precheckStatus: 'config_precheck_ready',
  reason: 'config_precheck_ready',
  proofAuthorized: false,
  guards: {
    noSecretRead: true,
    noRealNetwork: true,
    noCustomerRead: true,
    noRealSend: true,
  },
};

const contactFields = [
  'proofContactId',
  'proofEmployeeId',
  'customerType',
  'addedAt',
  'relationshipStatus',
  'deletionStatus',
  'tagNames',
  'detailAvailable',
  'mode',
  'fieldWhitelistApplied',
  'proofAuthorized',
];

function expectContactWhitelist(contact: object) {
  expect(Object.keys(contact).sort()).toEqual([...contactFields].sort());
}

describe('企业微信客户联系只读 proof mock 领域逻辑', () => {
  it('定义 mock proof 的有限状态', () => {
    expect(weComCustomerContactReadonlyProofMockStatuses).toEqual([
      'blocked_config_precheck_not_ready',
      'blocked_real_network_must_remain_disabled',
      'blocked_customer_read_must_remain_disabled',
      'blocked_real_send_must_remain_disabled',
      'mock_list_ready',
      'mock_detail_ready',
      'mock_contact_not_found',
    ]);
  });

  it('仅在 D1 config_precheck_ready 时返回单员工和单联系人低敏列表', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = createWeComCustomerContactReadonlyProofMockList(readyPrecheck);

    expect(result).toMatchObject({
      precheckStatus: 'config_precheck_ready',
      mockProofStatus: 'mock_list_ready',
      reason: 'mock_list_ready',
      proofAuthorized: false,
    });
    expect(result.employee).toEqual({
      proofEmployeeId: 'mock-employee-proof-01',
      mode: 'mock_only',
      proofAuthorized: false,
    });
    expect(result.contacts).toHaveLength(1);
    expect(result.contacts[0]).toEqual({
      proofContactId: 'mock-contact-proof-01',
      proofEmployeeId: 'mock-employee-proof-01',
      customerType: 'external_contact',
      addedAt: '2026-07-10T00:00:00.000Z',
      relationshipStatus: 'visible',
      deletionStatus: 'active',
      tagNames: ['mock_low_sensitive', 'readonly_proof'],
      detailAvailable: true,
      mode: 'mock_only',
      fieldWhitelistApplied: true,
      proofAuthorized: false,
    });
    expectContactWhitelist(result.contacts[0]);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('合法 ID 只返回单对象白名单详情', () => {
    const result = createWeComCustomerContactReadonlyProofMockDetail({
      precheck: readyPrecheck,
      proofContactId: 'mock-contact-proof-01',
    });

    expect(result).toMatchObject({
      precheckStatus: 'config_precheck_ready',
      mockProofStatus: 'mock_detail_ready',
      reason: 'mock_detail_ready',
      proofAuthorized: false,
    });
    expect(result.contact).toBeDefined();
    expectContactWhitelist(result.contact!);
    expect(result.contact?.proofAuthorized).toBe(false);
  });

  it('D1 未 ready 时列表为空且详情不返回 contact', () => {
    const precheck = {
      ...readyPrecheck,
      configured: false,
      capabilityEnabled: false,
      precheckStatus: 'blocked_customer_contact_capability_disabled' as const,
      reason: 'blocked_customer_contact_capability_disabled' as const,
    };

    expect(createWeComCustomerContactReadonlyProofMockList(precheck)).toEqual({
      precheckStatus: 'blocked_customer_contact_capability_disabled',
      mockProofStatus: 'blocked_config_precheck_not_ready',
      reason: 'blocked_config_precheck_not_ready',
      proofAuthorized: false,
      employee: null,
      contacts: [],
    });
    expect(createWeComCustomerContactReadonlyProofMockDetail({
      precheck,
      proofContactId: 'mock-contact-proof-01',
    })).toEqual({
      precheckStatus: 'blocked_customer_contact_capability_disabled',
      mockProofStatus: 'blocked_config_precheck_not_ready',
      reason: 'blocked_config_precheck_not_ready',
      proofAuthorized: false,
    });
  });

  it.each([
    ['networkEnabled', 'blocked_real_network_must_remain_disabled'],
    ['customerReadEnabled', 'blocked_customer_read_must_remain_disabled'],
    ['realSendEnabled', 'blocked_real_send_must_remain_disabled'],
  ] as const)('%s 开启时保持对应阻断且不调用 fetch', (key, status) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const precheck = { ...readyPrecheck, [key]: true };

    expect(createWeComCustomerContactReadonlyProofMockList(precheck)).toEqual({
      precheckStatus: 'config_precheck_ready',
      mockProofStatus: status,
      reason: status,
      proofAuthorized: false,
      employee: null,
      contacts: [],
    });
    expect(createWeComCustomerContactReadonlyProofMockDetail({
      precheck,
      proofContactId: 'mock-contact-proof-01',
    })).not.toHaveProperty('contact');
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('未知 proofContactId 返回低敏 not found 且不回显输入', () => {
    const unknownId = 'unknown-sensitive-proof-contact-id';
    const result = createWeComCustomerContactReadonlyProofMockDetail({
      precheck: readyPrecheck,
      proofContactId: unknownId,
    });

    expect(result).toEqual({
      precheckStatus: 'config_precheck_ready',
      mockProofStatus: 'mock_contact_not_found',
      reason: 'mock_contact_not_found',
      proofAuthorized: false,
    });
    expect(JSON.stringify(result)).not.toContain(unknownId);
  });
});
