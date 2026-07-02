import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  calculatePackageAiQuotaRemaining,
  calculatePackageAiQuotaUsageRate,
  PACKAGE_AI_QUOTA_FIXTURES,
  mapPlatformAiQuotaContractToInstitutionView,
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
  /prompt/i,
  /answer/i,
  /rawResponse/i,
  /metadata/i,
  /meteringDetails/i,
  /apiKey/i,
  /baseUrl/i,
  /credential/i,
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
