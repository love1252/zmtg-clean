import { describe, expect, it, vi } from 'vitest';
import {
  createWeComAuditEvent,
  createWeComExternalContactMockFixture,
  createWeComExternalContactReadonlyView,
  weComAuditEventTypes,
  weComAuthorizationStatuses,
  weComManualReviewStatuses,
  weComMappingStatuses,
  weComSyncStatuses,
} from '@/modules/institution/domain/wecom-external-contact-readonly';
import type {
  WeComExternalContactReadonly,
  WeComTenantAuthorization,
} from '@/modules/institution/domain/wecom-external-contact-readonly';

const occurredAt = '2026-07-12T00:00:00.000Z';
const tenantId = 'tenant-mock-001';
const contactFields = [
  'tenantId',
  'externalContactReference',
  'displayName',
  'externalUserIdDigest',
  'followUsers',
  'tags',
  'sourceType',
  'addedAtDate',
  'remarkSummary',
  'mappingStatus',
  'lastSyncedAt',
  'syncStatus',
  'manualReviewState',
  'dataMode',
  'containsRealCustomerData',
  'fieldWhitelistApplied',
];

function createFixtureView() {
  const fixture = createWeComExternalContactMockFixture({ tenantId });
  return {
    fixture,
    view: createWeComExternalContactReadonlyView({
      tenantId,
      authorization: fixture.authorization,
      contacts: fixture.externalContacts,
      dataMode: fixture.dataMode,
      occurredAt,
    }),
  };
}

function authorizationWith(
  authorization: WeComTenantAuthorization,
  changes: Partial<WeComTenantAuthorization>,
): WeComTenantAuthorization {
  return { ...authorization, ...changes };
}

describe('企业微信 mock 外部联系人只读领域逻辑', () => {
  it('定义 05C-A 契约要求的有限状态和审计事件', () => {
    expect(weComAuthorizationStatuses).toEqual([
      'not_configured',
      'authorized',
      'revoked',
      'expired',
      'disabled',
      'external_disabled',
      'manual_review_required',
    ]);
    expect(weComSyncStatuses).toEqual([
      'not_started',
      'mock_ready',
      'preflight_ready',
      'syncing_disabled',
      'sync_failed',
      'manual_review_required',
    ]);
    expect(weComMappingStatuses).toEqual([
      'unmatched',
      'candidate',
      'matched',
      'conflict',
      'rejected',
      'manual_review_required',
    ]);
    expect(weComManualReviewStatuses).toEqual([
      'not_required',
      'pending',
      'approved',
      'rejected',
      'needs_more_info',
    ]);
    expect(weComAuditEventTypes).toEqual([
      'authorization_status_changed',
      'sync_preflight_checked',
      'mock_snapshot_generated',
      'mapping_candidate_generated',
      'mapping_manual_review_updated',
      'forbidden_field_blocked',
      'external_provider_disabled',
    ]);
  });

  it('生成显式 mock 标记的低敏外部联系人只读 view 且不调用网络', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { fixture, view } = createFixtureView();

    expect(fixture).toMatchObject({
      tenantId,
      dataMode: 'mock',
      sourceKind: 'controlled_mock_fixture',
      containsRealCustomerData: false,
    });
    expect(view).toMatchObject({
      tenantId,
      dataMode: 'mock',
      authorizationStatus: 'authorized',
      syncStatus: 'mock_ready',
      failClosed: false,
      reason: 'mock_readonly_ready',
      auditEvents: [],
    });
    expect(view.contacts).toHaveLength(4);
    for (const contact of view.contacts) {
      expect(Object.keys(contact).sort()).toEqual([...contactFields].sort());
      expect(contact.dataMode).toBe('mock');
      expect(contact.containsRealCustomerData).toBe(false);
      expect(contact.fieldWhitelistApplied).toBe(true);
      expect(contact.displayName).toMatch(/^\[MOCK\]/);
      expect(contact.externalUserIdDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(contact.followUsers[0].displayName).toMatch(/^\[MOCK\]/);
      expect(contact.followUsers[0].followUserIdDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(contact.tags[0].tagName).toMatch(/^\[MOCK\]/);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('fixture 覆盖候选、已匹配、冲突和待人工复核映射状态', () => {
    const fixture = createWeComExternalContactMockFixture({ tenantId });

    expect(fixture.externalContacts.map(({ mappingStatus }) => mappingStatus)).toEqual([
      'candidate',
      'matched',
      'conflict',
      'manual_review_required',
    ]);
  });

  it('fixture 覆盖 pending、approved、rejected 和 needs_more_info 人工复核状态', () => {
    const fixture = createWeComExternalContactMockFixture({ tenantId });

    expect(fixture.manualReviews.map(({ reviewStatus }) => reviewStatus)).toEqual([
      'pending',
      'approved',
      'rejected',
      'needs_more_info',
    ]);
  });

  it.each([
    ['not_configured'],
    ['revoked'],
    ['expired'],
    ['disabled'],
    ['external_disabled'],
    ['manual_review_required'],
  ] as const)('%s 授权状态保持 fail-closed', (authorizationStatus) => {
    const fixture = createWeComExternalContactMockFixture({ tenantId });
    const view = createWeComExternalContactReadonlyView({
      tenantId,
      authorization: authorizationWith(fixture.authorization, { authorizationStatus }),
      contacts: fixture.externalContacts,
      dataMode: 'mock',
      occurredAt,
    });

    expect(view.failClosed).toBe(true);
    expect(view.reason).toBe('authorization_not_available');
    expect(view.contacts).toEqual([]);
  });

  it('无授权时保持 fail-closed', () => {
    const fixture = createWeComExternalContactMockFixture({ tenantId });

    expect(createWeComExternalContactReadonlyView({
      tenantId,
      authorization: null,
      contacts: fixture.externalContacts,
      dataMode: 'mock',
      occurredAt,
    })).toEqual({
      tenantId,
      dataMode: 'mock',
      authorizationStatus: 'not_configured',
      syncStatus: 'syncing_disabled',
      manualReviewState: 'not_required',
      failClosed: true,
      reason: 'authorization_not_available',
      contacts: [],
      auditEvents: [],
    });
  });

  it.each([
    ['disabled', 'provider_disabled'],
    ['external_disabled', 'external_provider_disabled'],
  ] as const)('providerState=%s 时保持 fail-closed', (providerState, reason) => {
    const fixture = createWeComExternalContactMockFixture({ tenantId });
    const view = createWeComExternalContactReadonlyView({
      tenantId,
      authorization: authorizationWith(fixture.authorization, { providerState }),
      contacts: fixture.externalContacts,
      dataMode: 'mock',
      occurredAt,
    });

    expect(view).toMatchObject({
      failClosed: true,
      reason,
      syncStatus: 'syncing_disabled',
      contacts: [],
    });
    if (providerState === 'external_disabled') {
      expect(view.auditEvents).toEqual([expect.objectContaining({
        eventType: 'external_provider_disabled',
        resultStatus: 'blocked',
        reasonCode: 'provider_fail_closed',
        containsSensitivePayload: false,
      })]);
    }
  });

  it('只返回当前 tenant 数据并过滤跨 tenant 联系人', () => {
    const fixture = createWeComExternalContactMockFixture({ tenantId });
    const otherFixture = createWeComExternalContactMockFixture({ tenantId: 'tenant-mock-002' });
    const view = createWeComExternalContactReadonlyView({
      tenantId,
      authorization: fixture.authorization,
      contacts: [...fixture.externalContacts, ...otherFixture.externalContacts],
      dataMode: 'mock',
      occurredAt,
    });

    expect(view.failClosed).toBe(false);
    expect(view.contacts).toHaveLength(fixture.externalContacts.length);
    expect(view.contacts.every((contact) => contact.tenantId === tenantId)).toBe(true);
    expect(JSON.stringify(view)).not.toContain('tenant-mock-002');
  });

  it('跨 tenant 授权不能用于当前 tenant 并保持 fail-closed', () => {
    const fixture = createWeComExternalContactMockFixture({ tenantId });
    const otherFixture = createWeComExternalContactMockFixture({ tenantId: 'tenant-mock-002' });
    const view = createWeComExternalContactReadonlyView({
      tenantId,
      authorization: otherFixture.authorization,
      contacts: fixture.externalContacts,
      dataMode: 'mock',
      occurredAt,
    });

    expect(view).toMatchObject({
      authorizationStatus: 'not_configured',
      failClosed: true,
      reason: 'authorization_not_available',
      contacts: [],
    });
  });

  it.each([
    ['access_token', 'mock-access-token'],
    ['secret', 'mock-secret'],
    ['external_userid', 'wm_mock_raw_external_id'],
    ['userid', 'mock-raw-user-id'],
    ['phone', '13800138000'],
    ['idCard', '11010519491231002X'],
    ['chatContent', 'mock raw chat content'],
    ['chatArchiveKey', 'mock-archive-key'],
    ['webhookPayload', { raw: true }],
    ['apiResponse', { external_userid: 'raw' }],
  ] as const)('禁止字段 %s 被阻断并生成低敏 audit event', (field, value) => {
    const fixture = createWeComExternalContactMockFixture({ tenantId });
    const unsafeContact = {
      ...fixture.externalContacts[0],
      [field]: value,
    };
    const view = createWeComExternalContactReadonlyView({
      tenantId,
      authorization: fixture.authorization,
      contacts: [unsafeContact],
      dataMode: 'mock',
      occurredAt,
    });

    expect(view).toMatchObject({
      failClosed: true,
      reason: 'forbidden_field_blocked',
      syncStatus: 'manual_review_required',
      manualReviewState: 'pending',
      contacts: [],
    });
    expect(view.auditEvents).toEqual([{
      tenantId,
      tenantReference: 'mock-tenant-ref',
      operationReference: 'mock-field-guard',
      eventType: 'forbidden_field_blocked',
      occurredAt,
      actorRole: 'domain_system',
      resultStatus: 'blocked',
      reasonCode: 'readonly_field_not_whitelisted',
      dataMode: 'mock',
      containsSensitivePayload: false,
    }]);
    const serializedAudit = JSON.stringify(view.auditEvents);
    expect(serializedAudit).not.toContain(String(value));
    expect(serializedAudit).not.toMatch(/access_token|secret|external_userid|chatContent|webhookPayload|apiResponse/i);
  });

  it('嵌套 follow user 的原始 userid 和手机号也会被阻断', () => {
    const fixture = createWeComExternalContactMockFixture({ tenantId });
    const unsafeContact = {
      ...fixture.externalContacts[0],
      followUsers: [{
        ...fixture.externalContacts[0].followUsers[0],
        userid: 'mock-raw-user-id',
        phone: '13800138000',
      }],
    };

    const view = createWeComExternalContactReadonlyView({
      tenantId,
      authorization: fixture.authorization,
      contacts: [unsafeContact],
      dataMode: 'mock',
      occurredAt,
    });

    expect(view.reason).toBe('forbidden_field_blocked');
    expect(view.contacts).toEqual([]);
  });

  it('不允许构建或读取 real 数据模式', () => {
    expect(() => createWeComExternalContactMockFixture({
      tenantId,
      dataMode: 'real' as never,
    })).toThrow('dataMode must be mock or demo');

    const fixture = createWeComExternalContactMockFixture({ tenantId });
    expect(() => createWeComExternalContactReadonlyView({
      tenantId,
      authorization: fixture.authorization,
      contacts: fixture.externalContacts,
      dataMode: 'real' as never,
      occurredAt,
    })).toThrow('dataMode must be mock or demo');
  });

  it('不允许伪装成 real 或混入真实客户标记', () => {
    const fixture = createWeComExternalContactMockFixture({ tenantId });
    const realMarkedContact = {
      ...fixture.externalContacts[0],
      dataMode: 'real',
      containsRealCustomerData: true,
    };

    const view = createWeComExternalContactReadonlyView({
      tenantId,
      authorization: fixture.authorization,
      contacts: [realMarkedContact],
      dataMode: 'mock',
      occurredAt,
    });

    expect(view).toMatchObject({
      failClosed: true,
      reason: 'forbidden_field_blocked',
      contacts: [],
    });
  });

  it('手机号和身份证号即使放入白名单文本字段也会被阻断', () => {
    const fixture = createWeComExternalContactMockFixture({ tenantId });
    for (const remarkSummary of ['联系 13800138000', '证件 11010519491231002X']) {
      const contact: WeComExternalContactReadonly = {
        ...fixture.externalContacts[0],
        remarkSummary,
      };
      const view = createWeComExternalContactReadonlyView({
        tenantId,
        authorization: fixture.authorization,
        contacts: [contact],
        dataMode: 'mock',
        occurredAt,
      });
      expect(view.reason).toBe('forbidden_field_blocked');
      expect(view.contacts).toEqual([]);
    }
  });

  it('生成的 audit event 仅包含固定低敏字段', () => {
    const event = createWeComAuditEvent({
      tenantId,
      tenantReference: 'mock-tenant-ref',
      operationReference: 'mock-snapshot-operation',
      objectDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      eventType: 'mock_snapshot_generated',
      occurredAt,
      actorRole: 'domain_system',
      resultStatus: 'recorded',
      reasonCode: 'controlled_mock_snapshot_created',
      dataMode: 'mock',
    });

    expect(Object.keys(event).sort()).toEqual([
      'tenantId',
      'tenantReference',
      'operationReference',
      'objectDigest',
      'eventType',
      'occurredAt',
      'actorRole',
      'resultStatus',
      'reasonCode',
      'dataMode',
      'containsSensitivePayload',
    ].sort());
    expect(event.containsSensitivePayload).toBe(false);
  });

  it('返回数据是副本，不允许一次调用污染后续 readonly view', () => {
    const { fixture, view } = createFixtureView();
    view.contacts[0].tags[0].tagName = '[MOCK] changed';
    view.contacts[0].followUsers[0].displayName = '[MOCK] changed';

    const nextView = createWeComExternalContactReadonlyView({
      tenantId,
      authorization: fixture.authorization,
      contacts: fixture.externalContacts,
      dataMode: 'mock',
      occurredAt,
    });

    expect(nextView.contacts[0].tags[0].tagName).toBe('[MOCK] 低敏标签');
    expect(nextView.contacts[0].followUsers[0].displayName).toBe('[MOCK] 归属员工 01');
  });
});
