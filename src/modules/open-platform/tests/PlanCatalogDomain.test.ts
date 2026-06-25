import { describe, expect, it } from 'vitest';

import {
  mapPlanCatalogRecordsToDto,
  parsePlanVersionDraftPayload,
  type PlanCatalogRecord,
} from '@/modules/open-platform/domain/plan-catalog';

const baseRecord: PlanCatalogRecord = {
  planId: 'plan-professional',
  planName: 'Professional 专业版',
  planCode: 'professional',
  planDescription: '适合增长期机构',
  planStatus: 'active',
  versions: [
    {
      versionId: 'plan-version-professional-draft',
      planId: 'plan-professional',
      versionCode: '2026-06-draft',
      status: 'draft',
      displayName: 'Professional 专业版',
      displayPrice: '¥2999/月',
      priceNote: '人工确认后生效',
      agentLimit: 3,
      seatLimit: 40,
      monthlyAiCallLimit: 300000,
      knowledgeStorageGb: 100,
      connectorEntitlementsJson: { connectors: ['企微', 'HIS', 'CRM'] },
      serviceEntitlementsJson: { services: ['实施支持', '季度复盘'] },
      featureEntitlementsJson: { modules: ['客户运营', '知识库'] },
      quotaEntitlementsJson: { aiCallsPerMonth: 300000 },
      changeSummary: '草稿调整席位',
      createdBy: 'platform-user',
      updatedBy: 'platform-user',
      publishedBy: null,
      publishedAt: null,
      retiredAt: null,
      createdAt: new Date('2026-06-20T08:00:00.000Z'),
      updatedAt: new Date('2026-06-22T08:00:00.000Z'),
    },
    {
      versionId: 'plan-version-professional-published',
      planId: 'plan-professional',
      versionCode: '2026-06-v1',
      status: 'published',
      displayName: 'Professional 专业版',
      displayPrice: '¥2999/月',
      priceNote: '参考价，线下确认',
      agentLimit: 3,
      seatLimit: 40,
      monthlyAiCallLimit: 300000,
      knowledgeStorageGb: 100,
      connectorEntitlementsJson: { connectors: ['企微', 'HIS', 'CRM'] },
      serviceEntitlementsJson: { services: ['实施支持'] },
      featureEntitlementsJson: { modules: ['客户运营'] },
      quotaEntitlementsJson: { aiCallsPerMonth: 300000 },
      changeSummary: '首次发布',
      createdBy: 'platform-user',
      updatedBy: 'platform-user',
      publishedBy: 'platform-user',
      publishedAt: new Date('2026-06-21T08:00:00.000Z'),
      retiredAt: null,
      createdAt: new Date('2026-06-20T08:00:00.000Z'),
      updatedAt: new Date('2026-06-21T08:00:00.000Z'),
    },
  ],
};

describe('平台套餐目录 domain', () => {
  it('将套餐与版本记录映射为低敏 DTO、概览和当前版本指针', () => {
    const dto = mapPlanCatalogRecordsToDto([
      {
        ...baseRecord,
        versions: [
          {
            ...baseRecord.versions[0],
            connectorEntitlementsJson: {
              connectors: ['企微'],
              webhookSecret: 'secret_should_not_return',
            },
          },
          baseRecord.versions[1],
        ],
      },
    ]);

    expect(dto.summary).toEqual({
      planCount: 1,
      draftVersionCount: 1,
      publishedVersionCount: 1,
      retiredVersionCount: 0,
    });
    expect(dto.plans[0]).toEqual(
      expect.objectContaining({
        planId: 'plan-professional',
        planCode: 'professional',
        publishedVersionId: 'plan-version-professional-published',
        draftVersionId: 'plan-version-professional-draft',
      }),
    );
    expect(dto.plans[0].versions[0]).toEqual(
      expect.objectContaining({
        versionId: 'plan-version-professional-draft',
        updatedAt: '2026-06-22T08:00:00.000Z',
      }),
    );
    expect(JSON.stringify(dto)).not.toMatch(
      /webhookSecret|secret_should_not_return|payment_token|api_key|contract_body/i,
    );
  });

  it('解析草稿保存 payload，只允许展示价和权益配置字段', () => {
    const parsed = parsePlanVersionDraftPayload({
      versionCode: ' 2026-06-v2 ',
      displayName: ' Professional 专业版 ',
      displayPrice: ' ¥3999/月 ',
      priceNote: ' 仅用于展示，线下确认 ',
      agentLimit: 5,
      seatLimit: 60,
      monthlyAiCallLimit: 500000,
      knowledgeStorageGb: 200,
      connectorEntitlementsJson: { connectors: ['企微', 'HIS'] },
      serviceEntitlementsJson: { services: ['实施支持'] },
      featureEntitlementsJson: { modules: ['客户运营'] },
      quotaEntitlementsJson: { aiCallsPerMonth: 500000 },
      changeSummary: ' 增加 AI 调用 ',
      status: 'published',
      paymentToken: 'should_be_ignored',
    });

    expect(parsed).toEqual({
      ok: true,
      value: {
        versionCode: '2026-06-v2',
        displayName: 'Professional 专业版',
        displayPrice: '¥3999/月',
        priceNote: '仅用于展示，线下确认',
        agentLimit: 5,
        seatLimit: 60,
        monthlyAiCallLimit: 500000,
        knowledgeStorageGb: 200,
        connectorEntitlementsJson: { connectors: ['企微', 'HIS'] },
        serviceEntitlementsJson: { services: ['实施支持'] },
        featureEntitlementsJson: { modules: ['客户运营'] },
        quotaEntitlementsJson: { aiCallsPerMonth: 500000 },
        changeSummary: '增加 AI 调用',
      },
    });
  });

  it('拒绝负数、空展示字段和真实支付或密钥语义', () => {
    const parsed = parsePlanVersionDraftPayload({
      versionCode: '',
      displayName: '',
      displayPrice: '真实扣费 ¥2999',
      agentLimit: -1,
      seatLimit: 20,
      monthlyAiCallLimit: 1000,
      knowledgeStorageGb: 20,
      connectorEntitlementsJson: { api_key: 'sk_test_should_not_save' },
      serviceEntitlementsJson: { services: ['合同正文 contract_body'] },
      featureEntitlementsJson: {},
      quotaEntitlementsJson: {},
      changeSummary: 'x'.repeat(601),
    });

    expect(parsed).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        'versionCode 不能为空',
        'displayName 不能为空',
        'displayPrice 不能包含真实支付或扣费语义',
        'agentLimit 必须是非负整数或 null',
        'connectorEntitlementsJson 不能包含敏感键或敏感值',
        'serviceEntitlementsJson 不能包含敏感键或敏感值',
        'changeSummary 不能超过 600 个字符',
      ]),
    });
  });
});
