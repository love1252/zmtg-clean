import { describe, expect, it } from 'vitest';
import {
  buildTenantPlanChangePreview,
  parseTenantPlanChangePayload,
} from '@/modules/open-platform/domain/commercial_entitlement/tenant-plan-change';
import type { TenantPlanPublishedVersionRecord } from '@/modules/open-platform/domain/tenant-plan-binding';

const currentPlanVersion: TenantPlanPublishedVersionRecord = {
  planId: 'plan-growth',
  planCode: 'growth-care',
  planName: 'Growth 成长版',
  planStatus: 'active',
  versionId: 'plan-version-growth-202606',
  versionCode: '2026-06-v1',
  status: 'published',
  displayName: 'Growth 成长版 2026-06',
  displayPrice: '¥1999/月',
  priceNote: '展示价格，人工确认口径',
  agentLimit: 2,
  seatLimit: 20,
  monthlyAiCallLimit: 100000,
  knowledgeStorageGb: 50,
  connectorEntitlementsJson: { connectors: ['企微'] },
  serviceEntitlementsJson: { services: ['基础培训'] },
  featureEntitlementsJson: { modules: ['客户管理'] },
  quotaEntitlementsJson: { aiCallsPerMonth: 100000 },
};

const targetPlanVersion: TenantPlanPublishedVersionRecord = {
  ...currentPlanVersion,
  planId: 'plan-professional',
  planCode: 'professional',
  planName: 'Professional 专业版',
  versionId: 'plan-version-professional-202606',
  displayName: 'Professional 专业版 2026-06',
  displayPrice: '¥2999/月',
  agentLimit: 3,
  seatLimit: 40,
  monthlyAiCallLimit: 300000,
  knowledgeStorageGb: 100,
  connectorEntitlementsJson: { connectors: ['企微', 'HIS'] },
  serviceEntitlementsJson: { services: ['上线培训', '季度复盘'] },
};

describe('租户套餐变更 domain', () => {
  it('解析套餐变更 payload，只保留低敏字段且要求变更原因', () => {
    const parsed = parseTenantPlanChangePayload({
      toPlanVersionId: 'plan-version-professional-202606',
      reason: '机构升级到专业版',
      payment_token: 'payment_token_should_not_pass',
      webhook_secret: 'webhook_secret_should_not_pass',
      contactPhone: '13800000000',
    });

    expect(parsed).toEqual({
      ok: true,
      value: {
        toPlanVersionId: 'plan-version-professional-202606',
        reason: '机构升级到专业版',
      },
    });
    expect(JSON.stringify(parsed)).not.toMatch(
      /13800000000|payment_token|webhook_secret|client_secret|api_key/i,
    );
  });

  it('拒绝缺少目标套餐版本或原因的变更请求', () => {
    expect(parseTenantPlanChangePayload({ reason: '升级' })).toEqual({
      ok: false,
      errors: ['TO_PLAN_VERSION_REQUIRED'],
    });
    expect(parseTenantPlanChangePayload({ toPlanVersionId: 'plan-version-professional-202606' })).toEqual({
      ok: false,
      errors: ['REASON_REQUIRED'],
    });
  });

  it('生成套餐变更差异对照，覆盖价格、容量、连接器和服务权益', () => {
    const preview = buildTenantPlanChangePreview({
      tenantId: 'tenant-001',
      fromPlanVersion: currentPlanVersion,
      toPlanVersion: targetPlanVersion,
    });

    expect(preview).toEqual({
      tenantId: 'tenant-001',
      fromPlanVersionId: 'plan-version-growth-202606',
      toPlanVersionId: 'plan-version-professional-202606',
      changedItemCount: 8,
      unchangedItemCount: 1,
      items: [
        {
          key: 'displayName',
          label: '套餐版本',
          before: 'Growth 成长版 2026-06',
          after: 'Professional 专业版 2026-06',
          changed: true,
        },
        {
          key: 'displayPrice',
          label: '展示价格',
          before: '¥1999/月',
          after: '¥2999/月',
          changed: true,
        },
        {
          key: 'agentLimit',
          label: 'Agent 数量',
          before: '2',
          after: '3',
          changed: true,
        },
        {
          key: 'seatLimit',
          label: '员工席位',
          before: '20',
          after: '40',
          changed: true,
        },
        {
          key: 'monthlyAiCallLimit',
          label: 'AI 调用 / 月',
          before: '100,000',
          after: '300,000',
          changed: true,
        },
        {
          key: 'knowledgeStorageGb',
          label: '知识库存储',
          before: '50 GB',
          after: '100 GB',
          changed: true,
        },
        {
          key: 'connectorEntitlements',
          label: '连接器权益',
          before: '企微',
          after: '企微 / HIS',
          changed: true,
        },
        {
          key: 'serviceEntitlements',
          label: '服务权益',
          before: '基础培训',
          after: '上线培训 / 季度复盘',
          changed: true,
        },
        {
          key: 'versionCode',
          label: '版本号',
          before: '2026-06-v1',
          after: '2026-06-v1',
          changed: false,
        },
      ],
    });
  });
});
