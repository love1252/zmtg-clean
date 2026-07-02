import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  calculatePackageAiQuotaRemaining,
  calculatePackageAiQuotaUsageRate,
  INSTITUTION_AI_QUOTA_READONLY_FIELD_WHITELIST,
  PACKAGE_AI_QUOTA_FIXTURES,
  mapPlatformAiQuotaContractToInstitutionView,
  mapRealPackageAiQuotaSourceToInstitutionReadonlyDto,
  resolvePackageAiQuotaWarningLevel,
} from '@/modules/institution/domain/package-ai-quota-contract';

const sensitiveInstitutionPatterns = [
  /provider/i,
  /\bmodel\b/i,
  /Token/,
  /totalTokens/i,
  /internal.*conversion/i,
  /RMB/i,
  /¥/,
  /real.*cost/i,
  /真实成本/,
  /prompt/i,
  /answer/i,
  /rawResponse/i,
  /metadata/i,
  /meteringDetails/i,
  /apiKey/i,
  /baseUrl/i,
  /credential/i,
  /客户手机号/,
  /客户身份证/,
  /病历详情/,
];

const sensitivePlatformCredentialPatterns = [
  /apiKey/i,
  /encryptedApiKey/i,
  /Authorization/i,
  /Cookie/i,
  /realCostAmount/i,
  /prompt/i,
  /answer/i,
  /rawResponse/i,
];

describe('套餐权益 / AI 服务额度 server-domain contract', () => {
  it('提供稳定套餐、状态和服务项目 mock fixtures', () => {
    expect(PACKAGE_AI_QUOTA_FIXTURES.packages.map((item) => item.packageCode)).toEqual([
      'trial',
      'basic',
      'professional',
    ]);
    expect(PACKAGE_AI_QUOTA_FIXTURES.platformContracts.map((item) => item.quota.status)).toEqual([
      'unlinked',
      'active',
      'warning',
      'overLimit',
      'expired',
    ]);
    expect(
      PACKAGE_AI_QUOTA_FIXTURES.platformContracts
        .flatMap((item) => item.serviceProjects)
        .map((item) => item.serviceProjectName),
    ).toEqual(expect.arrayContaining(['AI 问答', '知识库问答', '智能随访', '未归因服务']));
  });

  it('计算 remaining、usageRate 和 warningLevel 时不做真实扣减或阻断', () => {
    expect(calculatePackageAiQuotaRemaining({ quotaLimit: 1000, used: 860 })).toBe(140);
    expect(calculatePackageAiQuotaRemaining({ quotaLimit: 1000, used: 1200 })).toBe(0);
    expect(calculatePackageAiQuotaRemaining({ quotaLimit: null, used: 1200 })).toBeNull();

    expect(calculatePackageAiQuotaUsageRate({ quotaLimit: 1000, used: 860 })).toBe(86);
    expect(calculatePackageAiQuotaUsageRate({ quotaLimit: 0, used: 20 })).toBeNull();
    expect(resolvePackageAiQuotaWarningLevel({ status: 'active', usageRate: 72 })).toBe('low');
    expect(resolvePackageAiQuotaWarningLevel({ status: 'warning', usageRate: 88 })).toBe('medium');
    expect(resolvePackageAiQuotaWarningLevel({ status: 'overLimit', usageRate: 126 })).toBe('exceeded');
  });

  it('映射 unlinked 为机构端低敏未接入视图', () => {
    const view = mapPlatformAiQuotaContractToInstitutionView(
      PACKAGE_AI_QUOTA_FIXTURES.platformContractsByStatus.unlinked,
    );

    expect(view.quota).toMatchObject({
      isLinked: false,
      status: 'unlinked',
      totalAllowance: null,
      used: 0,
      remaining: null,
      usageRate: null,
      warningLevel: 'none',
      displayUnit: 'AI 服务额度',
    });
    expect(view.quota.notes).toContain('套餐额度暂未接入');
  });

  it('映射 linked 状态、unknown 服务项目和剩余额度低敏字段', () => {
    const active = mapPlatformAiQuotaContractToInstitutionView(
      PACKAGE_AI_QUOTA_FIXTURES.platformContractsByStatus.active,
    );
    const warning = mapPlatformAiQuotaContractToInstitutionView(
      PACKAGE_AI_QUOTA_FIXTURES.platformContractsByStatus.warning,
    );
    const overLimit = mapPlatformAiQuotaContractToInstitutionView(
      PACKAGE_AI_QUOTA_FIXTURES.platformContractsByStatus.overLimit,
    );
    const expired = mapPlatformAiQuotaContractToInstitutionView(
      PACKAGE_AI_QUOTA_FIXTURES.platformContractsByStatus.expired,
    );

    expect(active.quota).toMatchObject({
      isLinked: true,
      status: 'active',
      totalAllowance: 1000,
      used: 420,
      remaining: 580,
      usageRate: 42,
      warningLevel: 'low',
    });
    expect(warning.quota.warningLevel).toBe('medium');
    expect(overLimit.quota).toMatchObject({
      status: 'overLimit',
      remaining: 0,
      warningLevel: 'exceeded',
    });
    expect(JSON.stringify(overLimit)).not.toMatch(/shouldBlock|isBlocked|hardBlock|deny/i);
    expect(expired.quota).toMatchObject({
      status: 'expired',
      warningLevel: 'high',
    });
    expect(active.serviceProjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceProjectCategory: 'unknown',
          serviceProjectName: '未归因服务',
          used: 20,
          remaining: 30,
          usageRate: 40,
        }),
      ]),
    );
  });

  it('真实 quota linkage fixtures 覆盖 active / warning / overLimit / expired / fallback 场景', () => {
    expect(Object.keys(PACKAGE_AI_QUOTA_FIXTURES.realLinkageSources)).toEqual([
      'active',
      'warning',
      'overLimit',
      'expired',
      'missingBinding',
      'invalidFallback',
      'unlinkedCompatibility',
    ]);
    expect(PACKAGE_AI_QUOTA_FIXTURES.realLinkageInstitutionReadonlyDtos.active).toMatchObject({
      isLinked: true,
      status: 'active',
      totalAllowance: 1000,
      used: 420,
      remaining: 580,
      usageRate: 42,
      warningLevel: 'low',
      displayUnit: 'AI 服务额度',
    });
  });

  it('真实 quota linkage mapper 重新计算 remaining / usageRate，不信任 source 派生值', () => {
    const dto = mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(
      PACKAGE_AI_QUOTA_FIXTURES.realLinkageSources.active,
    );

    expect(dto).toEqual({
      isLinked: true,
      status: 'active',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      totalAllowance: 1000,
      used: 420,
      remaining: 580,
      usageRate: 42,
      warningLevel: 'low',
      displayUnit: 'AI 服务额度',
      notes: [],
    });
  });

  it('真实 quota linkage mapper 正确映射 warning / overLimit / expired', () => {
    expect(mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(
      PACKAGE_AI_QUOTA_FIXTURES.realLinkageSources.warning,
    )).toMatchObject({
      isLinked: true,
      status: 'warning',
      totalAllowance: 1000,
      used: 880,
      remaining: 120,
      usageRate: 88,
      warningLevel: 'medium',
    });
    expect(mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(
      PACKAGE_AI_QUOTA_FIXTURES.realLinkageSources.overLimit,
    )).toMatchObject({
      isLinked: true,
      status: 'overLimit',
      totalAllowance: 100,
      used: 126,
      remaining: 0,
      usageRate: 126,
      warningLevel: 'exceeded',
    });
    expect(mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(
      PACKAGE_AI_QUOTA_FIXTURES.realLinkageSources.expired,
    )).toMatchObject({
      isLinked: true,
      status: 'expired',
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      totalAllowance: 5000,
      used: 900,
      remaining: 4100,
      usageRate: 18,
      warningLevel: 'high',
    });
  });

  it('missing binding 与 invalid source 回退为安全未接入状态，不伪装真实额度', () => {
    const missingBinding = mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(
      PACKAGE_AI_QUOTA_FIXTURES.realLinkageSources.missingBinding,
    );
    const invalidFallback = mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(
      PACKAGE_AI_QUOTA_FIXTURES.realLinkageSources.invalidFallback,
    );
    const nullFallback = mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(null);

    for (const dto of [missingBinding, invalidFallback, nullFallback]) {
      expect(dto).toMatchObject({
        isLinked: false,
        status: 'unlinked',
        periodStart: null,
        periodEnd: null,
        totalAllowance: null,
        used: 0,
        remaining: null,
        usageRate: null,
        warningLevel: 'none',
        displayUnit: 'AI 服务额度',
      });
      expect(dto.notes.length).toBeGreaterThan(0);
    }
  });

  it('保留真实 linkage 的 unlinked compatibility 路径', () => {
    const dto = mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(
      PACKAGE_AI_QUOTA_FIXTURES.realLinkageSources.unlinkedCompatibility,
    );

    expect(dto).toMatchObject({
      isLinked: false,
      status: 'unlinked',
      totalAllowance: null,
      used: 0,
      remaining: null,
      usageRate: null,
      warningLevel: 'none',
    });
    expect(dto.notes).toEqual(['套餐额度暂未接入']);
  });

  it('机构端真实 quota readonly DTO 只包含白名单字段', () => {
    const allowedFields = [...INSTITUTION_AI_QUOTA_READONLY_FIELD_WHITELIST].sort();

    for (const dto of Object.values(PACKAGE_AI_QUOTA_FIXTURES.realLinkageInstitutionReadonlyDtos)) {
      expect(Object.keys(dto).sort()).toEqual(allowedFields);
    }
  });

  it('机构端真实 quota readonly DTO 不泄露敏感字段或客户隐私内容', () => {
    const serialized = JSON.stringify(PACKAGE_AI_QUOTA_FIXTURES.realLinkageInstitutionReadonlyDtos);

    for (const pattern of sensitiveInstitutionPatterns) {
      expect(serialized).not.toMatch(pattern);
    }
  });

  it('平台 contract 不包含凭据、真实成本或原始问答内容', () => {
    const serialized = JSON.stringify(PACKAGE_AI_QUOTA_FIXTURES.platformContracts);

    for (const pattern of sensitivePlatformCredentialPatterns) {
      expect(serialized).not.toMatch(pattern);
    }
  });

  it('机构端低敏 view 不泄露内部模型、Token、成本或原始内容', () => {
    const views = PACKAGE_AI_QUOTA_FIXTURES.platformContracts.map(
      mapPlatformAiQuotaContractToInstitutionView,
    );
    const serialized = JSON.stringify(views);

    for (const pattern of sensitiveInstitutionPatterns) {
      expect(serialized).not.toMatch(pattern);
    }
  });

  it('本轮 contract-only 不新增真实 API route', () => {
    expect(existsSync('src/app/api/institution/package-ai-quota')).toBe(false);
    expect(existsSync('src/app/api/open-platform/package-ai-quota')).toBe(false);
  });
});
