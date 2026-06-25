import { describe, expect, it } from 'vitest';
import {
  buildAuthorizationSnapshotPayload,
  mapPublishedPlanVersionToOption,
  parseCreateTenantWithPlanPayload,
} from '@/modules/open-platform/domain/tenant-plan-binding';

const publishedPlanVersion = {
  planId: 'plan-professional',
  planCode: 'professional',
  planName: 'Professional 专业版',
  planStatus: 'active',
  versionId: 'plan-version-professional-published',
  versionCode: '2026-06-v1',
  status: 'published',
  displayName: 'Professional 专业版 2026-06',
  displayPrice: '¥2999/月',
  priceNote: '展示价格，人工确认口径',
  agentLimit: 3,
  seatLimit: 40,
  monthlyAiCallLimit: 300000,
  knowledgeStorageGb: 100,
  connectorEntitlementsJson: { connectors: ['企微', 'HIS', 'CRM'] },
  serviceEntitlementsJson: { services: ['上线培训', '季度复盘'] },
  featureEntitlementsJson: { modules: ['客户管理', '知识库'] },
  quotaEntitlementsJson: { aiCallsPerMonth: 300000, knowledgeStorageGb: 100 },
};

describe('租户套餐绑定 domain', () => {
  it('接受真实商业试用联系人字段，但拒绝把密码、请求体和诊断细节纳入普通开通值', () => {
    const parsed = parseCreateTenantWithPlanPayload({
      organizationName: ' 星澜医美中心 ',
      planVersionId: ' plan-version-professional-published ',
      reason: ' 测试服开通租户 ',
      contactName: ' 陈磊 ',
      contactPhone: '13800000000',
      contactEmail: 'contact@example.com',
      adminName: ' 李静 ',
      adminAccount: 'xinglan_admin',
      adminContact: 'admin@example.com',
      initialPassword: 'PlaintextPasswordShouldNotPass',
      requestBody: { password: 'PlaintextPasswordShouldNotPass' },
      sql: 'select * from tenants',
      stack: 'Error: stack trace',
      payment_token: 'payment_token_should_not_pass',
      webhook_secret: 'webhook_secret_should_not_pass',
    });

    expect(parsed).toEqual({
      ok: true,
      value: {
        tenantName: '星澜医美中心',
        planVersionId: 'plan-version-professional-published',
        reason: '测试服开通租户',
        contactName: '陈磊',
        contactPhone: '13800000000',
        contactEmail: 'contact@example.com',
        adminName: '李静',
        adminAccount: 'xinglan_admin',
        adminContact: 'admin@example.com',
      },
    });
    expect(JSON.stringify(parsed)).not.toMatch(
      /PlaintextPasswordShouldNotPass|requestBody|select \* from tenants|stack trace|payment_token|webhook_secret/i,
    );
  });

  it('拒绝空名称、空版本和空原因', () => {
    expect(parseCreateTenantWithPlanPayload({})).toEqual({
      ok: false,
      errors: ['TENANT_NAME_REQUIRED', 'PLAN_VERSION_REQUIRED', 'REASON_REQUIRED'],
    });
  });

  it('把 published 套餐版本映射为低敏可选项', () => {
    expect(mapPublishedPlanVersionToOption(publishedPlanVersion)).toEqual({
      planId: 'plan-professional',
      planCode: 'professional',
      planName: 'Professional 专业版',
      planVersionId: 'plan-version-professional-published',
      versionCode: '2026-06-v1',
      displayName: 'Professional 专业版 2026-06',
      displayPrice: '¥2999/月',
      priceNote: '展示价格，人工确认口径',
      agentLimit: 3,
      seatLimit: 40,
      monthlyAiCallLimit: 300000,
      knowledgeStorageGb: 100,
      connectorEntitlements: ['企微', 'HIS', 'CRM'],
      serviceEntitlements: ['上线培训', '季度复盘'],
    });
  });

  it('生成授权快照 payload 时只固化套餐权益，不包含支付、合同或密钥字段', () => {
    const snapshot = buildAuthorizationSnapshotPayload(publishedPlanVersion);

    expect(snapshot).toEqual({
      snapshotJson: {
        planId: 'plan-professional',
        planCode: 'professional',
        planName: 'Professional 专业版',
        planVersionId: 'plan-version-professional-published',
        versionCode: '2026-06-v1',
        displayName: 'Professional 专业版 2026-06',
        displayPrice: '¥2999/月',
      },
      quotaJson: {
        agentLimit: 3,
        seatLimit: 40,
        monthlyAiCallLimit: 300000,
        knowledgeStorageGb: 100,
      },
      connectorJson: { connectors: ['企微', 'HIS', 'CRM'] },
      serviceJson: { services: ['上线培训', '季度复盘'] },
    });
    expect(JSON.stringify(snapshot)).not.toMatch(
      /payment_token|webhook_secret|contract_body|invoice_tax_no|client_secret|api_key/i,
    );
  });
});
