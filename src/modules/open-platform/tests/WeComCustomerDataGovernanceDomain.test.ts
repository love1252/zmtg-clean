import { describe, expect, it } from 'vitest';
import {
  createWeComPlatformGovernancePayload,
  parseWeComPlatformGovernancePayload,
} from '@/modules/open-platform/domain/wecom-customer-data-governance';

function serializedPayload() {
  return JSON.stringify(createWeComPlatformGovernancePayload());
}

describe('平台端企业微信客户数据治理 domain', () => {
  it('生成受控 mock/demo 租户级治理摘要', () => {
    const payload = createWeComPlatformGovernancePayload();

    expect(payload).toMatchObject({
      sourceKind: 'controlled_mock_governance_summary',
      mockDemo: true,
      dataMode: 'mock',
      readonly: true,
      containsRealCustomerData: false,
      providerStatusSummary: {
        externalCapabilityEnabled: false,
      },
      fieldBlockingSummary: {
        whitelistApplied: true,
        defaultDeny: true,
        forbiddenFieldsReturned: false,
      },
      failClosedStatus: {
        enabled: true,
        externalCallsAllowed: false,
      },
    });
    expect(payload.authorizationStatusSummary.totalTenants).toBe(6);
    expect(payload.latestMockSnapshotAt).toBe('2026-07-12T00:00:00.000Z');
    expect(payload.anomalousTenants.length).toBeGreaterThan(0);
  });

  it('provider disabled 与 external_disabled 均按 fail-closed 聚合', () => {
    const payload = createWeComPlatformGovernancePayload();
    const disabled = payload.anomalousTenants.find(
      (tenant) => tenant.providerState === 'disabled',
    );
    const externalDisabled = payload.anomalousTenants.find(
      (tenant) => tenant.providerState === 'external_disabled',
    );

    expect(disabled).toMatchObject({
      authorizationStatus: 'disabled',
      syncStatus: 'syncing_disabled',
      failClosed: true,
      reason: 'provider_disabled',
      lastMockSnapshotAt: null,
    });
    expect(externalDisabled).toMatchObject({
      authorizationStatus: 'external_disabled',
      syncStatus: 'syncing_disabled',
      failClosed: true,
      reason: 'external_provider_disabled',
      lastMockSnapshotAt: null,
    });
    expect(payload.syncHealthSummary.blockedTenantCount).toBe(
      payload.failClosedStatus.blockedTenantCount,
    );
  });

  it('字段越界只进入阻断和低敏审计摘要', () => {
    const payload = createWeComPlatformGovernancePayload();

    expect(payload.fieldBlockingSummary.blockedTenantCount).toBe(1);
    expect(payload.fieldBlockingSummary.blockedAttemptCount).toBe(1);
    expect(payload.anomalousTenants).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'forbidden_field_blocked',
        failClosed: true,
      }),
    ]));
    expect(payload.auditSummary).toMatchObject({
      eventCount: 6,
      containsSensitivePayload: false,
    });
    expect(payload.auditSummary.eventsByType).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventType: 'forbidden_field_blocked',
        count: 1,
        blockedCount: 1,
      }),
    ]));
  });

  it('不包含客户明细、原始身份标识、联系方式、凭证或沟通内容', () => {
    const serialized = serializedPayload();

    for (const forbidden of [
      'externalContacts',
      'displayName',
      'followUsers',
      'tags',
      'remarkSummary',
      'mappingCandidates',
      'manualReviews',
      'external_userid',
      'externalUserId',
      'user_id',
      'userId',
      'follow_userid',
      'userid',
      'phone_number',
      'phoneNumber',
      'mobile',
      'accessToken',
      'idNumber',
      'access_token',
      'secret',
      'chatContent',
      'conversationContent',
      'archiveKey',
      'webhookPayload',
      'apiResponse',
      'sha256:',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('严格 parser 拒绝任意层级未知字段和敏感字段变体', () => {
    const payload = createWeComPlatformGovernancePayload();
    expect(parseWeComPlatformGovernancePayload(payload)).toEqual(payload);

    for (const extra of [
      { external_userid: 'raw-external-id' },
      { user_id: 'raw-user-id' },
      { phone_number: '13800138000' },
      { externalUserId: 'raw-external-id' },
      { userId: 'raw-user-id' },
      { phoneNumber: '13800138000' },
      { mobile: '13800138000' },
      { tel: '13800138000' },
      { credential: 'raw-credential' },
      { accessToken: 'raw-token' },
      { rawResponse: { externalUserId: 'nested-external-id' } },
      { webhookPayload: { mobile: '13800138000' } },
      { apiResponse: { credential: 'nested-credential' } },
      { tenant: { externalUserId: 'nested-external-id' } },
    ]) {
      expect(parseWeComPlatformGovernancePayload({ ...payload, ...extra })).toBeNull();
    }

    expect(parseWeComPlatformGovernancePayload({
      ...payload,
      syncHealthSummary: {
        ...payload.syncHealthSummary,
        apiResponse: { userId: 'nested-user-id' },
      },
    })).toBeNull();
    expect(parseWeComPlatformGovernancePayload({
      ...payload,
      anomalousTenants: [{
        ...payload.anomalousTenants[0],
        rawResponse: { phoneNumber: '13800138000' },
      }],
    })).toBeNull();
  });

  it('租户展示名仅接受受控白名单格式', () => {
    const payload = createWeComPlatformGovernancePayload();
    const tenant = payload.anomalousTenants[0];

    for (const tenantFields of [
      { ...tenant, tenantDisplayName: '13800138000' },
      { ...tenant, tenantDisplayName: 'externalUserId: raw-id' },
      { ...tenant, tenantDisplayName: 'userId: raw-id' },
      { ...tenant, tenantDisplayName: 'credential: raw-secret' },
      { ...tenant, tenantLabel: '任意普通字符串' },
      { ...tenant, tenantName: '任意普通字符串' },
    ]) {
      expect(parseWeComPlatformGovernancePayload({
        ...payload,
        anomalousTenants: [tenantFields],
      })).toBeNull();
    }
  });
});
