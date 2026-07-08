import { describe, expect, it } from 'vitest';
import {
  createWeComCustomerContactMockRecord,
  createWeComCustomerContactMockRecords,
  createWeComCustomerContactSyncDashboardView,
  getDefaultWeComCustomerContactSyncDashboardView,
  mapWeComCustomerContactsToDashboardView,
} from '@/modules/institution/domain/wecom-customer-contact';
import {
  createDefaultWeComAuthorizationRecord,
  createWeComAuthorizationRecord,
} from '@/modules/institution/domain/wecom-authorization';

const occurredAt = '2026-07-08T00:00:00.000Z';

function authorization(status: Parameters<typeof createWeComAuthorizationRecord>[0]['status']) {
  return createWeComAuthorizationRecord({
    tenantId: 'tenant-a',
    institutionId: 'inst-a',
    status,
    occurredAt,
  });
}

describe('wecom customer contact mock sync domain', () => {
  it('默认未同步 / 授权不可用时返回安全空态', () => {
    const auth = createDefaultWeComAuthorizationRecord({ tenantId: 'tenant-a', institutionId: 'inst-a', occurredAt });
    const records = createWeComCustomerContactMockRecords({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      authorization: auth,
      occurredAt,
    });
    const dashboard = createWeComCustomerContactSyncDashboardView({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      authorization: auth,
      occurredAt,
    });

    expect(records).toEqual([]);
    expect(dashboard).toEqual(expect.objectContaining({
      title: '企业微信客户联系 mock 同步',
      status: 'authorization_unavailable',
      statusLabel: '授权不可用',
      externalContactCount: 0,
      linkedSystemCustomerCount: 0,
      unlinkedCustomerCount: 0,
      availableForFollowUpCount: 0,
      currentOnlyMock: true,
      notWeComLogin: true,
      notPersonalWechatFriendSync: true,
      notChatHistorySync: true,
      notConnectedToRealWeCom: true,
      noRealOutbound: true,
      noRealCustomerSync: true,
      sessionArchivePostponed: true,
    }));
    expect(dashboard.safeSummary).toContain('当前仅 mock');
    expect(dashboard.safeSummary).toContain('不同步个人微信好友');
    expect(dashboard.safeSummary).toContain('不同步聊天记录');
    expect(dashboard.deliveryPrerequisites.description).toContain('授权状态、客户联系关系、人工确认和 MessageDelivery');
  });

  it.each([
    ['mock_authorized', 'mock_synced', '模拟已同步'],
    ['external_channel_disabled', 'external_channel_disabled', '外部通道未启用'],
    ['revoked', 'authorization_unavailable', '授权不可用'],
    ['expired', 'authorization_unavailable', '授权不可用'],
    ['disabled', 'authorization_unavailable', '授权不可用'],
  ] as const)('按授权状态 %s 推导同步状态 %s', (authStatus, syncStatus, label) => {
    const dashboard = createWeComCustomerContactSyncDashboardView({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      authorization: authorization(authStatus),
      occurredAt,
    });

    expect(dashboard.status).toBe(syncStatus);
    expect(dashboard.statusLabel).toBe(label);
    expect(dashboard.noRealOutbound).toBe(true);
    expect(dashboard.notConnectedToRealWeCom).toBe(true);
  });

  it('mock 外部联系人列表包含客户归属员工、标签、备注、来源和系统客户关联统计', () => {
    const dashboard = createWeComCustomerContactSyncDashboardView({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      authorization: authorization('mock_authorized'),
      customerSeeds: [
        {
          customerId: 'customer-a',
          customerDisplayName: '低敏客户A',
          ownerEmployeeRef: 'mock-employee:consultant-a',
          ownerEmployeeDisplayName: '企微员工A（低敏）',
          mappedSystemEmployeeRef: 'system-employee:consultant-a',
          source: '术后随访低敏线索',
          tags: ['术后关怀', '低敏标签'],
          remarkSummary: '术后随访候选，仅保留低敏摘要。',
        },
        {
          customerId: null,
          customerDisplayName: '低敏客户B',
          mappedSystemEmployeeRef: null,
          source: '到院咨询低敏线索',
          tags: ['到院咨询', '未关联'],
          remarkSummary: '外部联系人尚未关联系统客户。',
          linkedToSystemCustomer: false,
          availableForFollowUp: false,
        },
      ],
      occurredAt,
    });

    expect(dashboard).toEqual(expect.objectContaining({
      status: 'mock_synced',
      externalContactCount: 2,
      linkedSystemCustomerCount: 1,
      unlinkedCustomerCount: 1,
      availableForFollowUpCount: 1,
      unavailableForFollowUpCount: 1,
      mappedOwnerEmployeeCount: 1,
      unmappedOwnerEmployeeCount: 1,
    }));
    expect(dashboard.tagsSummary).toContain('术后关怀');
    expect(dashboard.sourceSummary).toContain('术后随访低敏线索');
    expect(dashboard.ownerEmployeeSummary).toContain('企微员工A(低敏)');
    expect(dashboard.remarkSummary).toContain('术后随访候选');
    expect(dashboard.contacts[0]).toEqual(expect.objectContaining({
      mockExternalContactId: 'mock-external-contact:01',
      customerDisplayName: '低敏客户A',
      ownerEmployeeRef: 'mock-employee:consultant-a',
      ownerEmployeeDisplayName: '企微员工A(低敏)',
      mappedSystemEmployeeRef: 'system-employee:consultant-a',
      ownerEmployeeMapped: true,
      linkedToSystemCustomer: true,
      customerId: 'customer-a',
      availableForFollowUp: true,
      notPersonalWechatFriend: true,
      noChatHistorySynced: true,
    }));
    expect(dashboard.contacts[1]).toEqual(expect.objectContaining({
      linkedToSystemCustomer: false,
      customerId: null,
      availableForFollowUp: false,
      ownerEmployeeMapped: false,
    }));
  });

  it('覆盖部分同步、同步失败、未同步的状态聚合', () => {
    const auth = authorization('mock_authorized');
    const partial = createWeComCustomerContactMockRecord({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      authorizationRecordId: auth.id,
      seed: { customerDisplayName: '低敏客户A', syncStatus: 'partial_synced' },
      index: 0,
      occurredAt,
    });
    const failed = createWeComCustomerContactMockRecord({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      authorizationRecordId: auth.id,
      seed: { customerDisplayName: '低敏客户B', syncStatus: 'sync_failed', lastErrorReason: '低敏同步异常码：mock_failed' },
      index: 1,
      occurredAt,
    });
    const notSynced = mapWeComCustomerContactsToDashboardView({ authorization: auth, contacts: [] });

    expect(mapWeComCustomerContactsToDashboardView({ authorization: auth, contacts: [partial] }).status).toBe('partial_synced');
    expect(mapWeComCustomerContactsToDashboardView({ authorization: auth, contacts: [partial, failed] })).toEqual(expect.objectContaining({
      status: 'sync_failed',
      statusLabel: '同步失败',
      lastErrorReason: '低敏同步异常码:mock_failed',
    }));
    expect(notSynced.status).toBe('not_synced');
    expect(getDefaultWeComCustomerContactSyncDashboardView().status).toBe('authorization_unavailable');
  });

  it('清洗外部联系人、员工、标签、备注中的敏感内容，不泄露真实企微或客户信息', () => {
    const auth = authorization('mock_authorized');
    const dashboard = createWeComCustomerContactSyncDashboardView({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      authorization: auth,
      customerSeeds: [
        {
          customerId: 'customer-a',
          customerDisplayName: '13800000000',
          ownerEmployeeRef: 'real_userid_abc',
          ownerEmployeeDisplayName: 'secret access_token',
          mappedSystemEmployeeRef: 'encodingAESKey callback token',
          source: '企业微信客户联系 mock',
          tags: ['ww1234567890abcdef', '110101199001011234', 'HIS payload'],
          remarkSummary: '完整聊天记录 external_userid raw response provider model token cost vendor MR-RAW-001',
          lastErrorReason: 'access_token secret refresh_token',
        },
      ],
      occurredAt,
    });
    const serialized = JSON.stringify(dashboard);

    expect(dashboard.contacts[0]).toEqual(expect.objectContaining({
      customerDisplayName: '低敏客户',
      ownerEmployeeRef: 'mock-employee:low-sensitive',
      ownerEmployeeDisplayName: '企微员工低敏名称',
      mappedSystemEmployeeRef: 'system-employee:low-sensitive',
      remarkSummary: '备注仅保留低敏摘要，未包含联系方式、证件号或会话内容。',
      lastErrorReason: '低敏同步异常。',
    }));
    expect(serialized).not.toMatch(
      /ww1234567890abcdef|external_userid|real_userid|secret|access_token|refresh_token|encodingAESKey|callback|13800000000|110101199001011234|MR-RAW|完整聊天|HIS payload|raw response|provider|model|token|cost|vendor/i,
    );
  });
});
