import { describe, expect, it } from 'vitest';

import {
  listPlatformPackageAiQuotaReadonly,
  type PlatformPackageAiQuotaReadonlyResponse,
} from '@/modules/open-platform/server/package-ai-quota-readonly';

const forbiddenPatterns = [
  /apiKey/i,
  /encryptedApiKey/i,
  /Authorization/i,
  /Cookie/i,
  /prompt/i,
  /answer/i,
  /rawResponse/i,
  /metadata/i,
  /meteringDetails/i,
  /realCostAmount/i,
  /客户姓名/,
  /手机号/,
  /身份证/,
  /病历详情/,
  /shouldDeduct/i,
  /deducted/i,
  /shouldAlert/i,
  /exportUrl/i,
];

function expectNoForbiddenFields(payload: PlatformPackageAiQuotaReadonlyResponse) {
  const serialized = JSON.stringify(payload);
  for (const pattern of forbiddenPatterns) {
    expect(serialized).not.toMatch(pattern);
  }
}

describe('平台端套餐权益 / AI 服务额度只读 facade', () => {
  it('返回稳定 mock-based readonly DTO，不接真实扣减语义', () => {
    const payload = listPlatformPackageAiQuotaReadonly();

    expect(payload).toMatchObject({
      requestId: 'platform-package-ai-quota-readonly',
      readonly: true,
    });
    expect(payload.packages.map((item) => item.packageCode)).toEqual([
      'trial',
      'basic',
      'professional',
    ]);
    expect(payload.entitlements.map((item) => item.entitlementName)).toEqual(
      expect.arrayContaining(['AI 服务额度']),
    );
    expect(payload.tenantBindings.length).toBeGreaterThan(0);
    expect(payload.tenantQuotaSummaries.map((item) => item.quota.status)).toEqual([
      'unlinked',
      'active',
      'warning',
      'overLimit',
      'expired',
    ]);
    expect(payload.serviceProjectQuotaAttributions.map((item) => item.serviceProjectName)).toEqual(
      expect.arrayContaining(['AI 问答', '知识库问答', '智能随访', '未归因服务']),
    );
    expect(payload.quotaStatuses.map((item) => item.status)).toEqual([
      'unlinked',
      'active',
      'warning',
      'overLimit',
      'expired',
    ]);
    expect(payload.notes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('mock/fixture-based readonly contract'),
        expect.stringContaining('不代表真实套餐扣减'),
        expect.stringContaining('不代表真实剩余额度'),
        expect.stringContaining('不代表真实财务账单'),
        expect.stringContaining('不代表 provider 成本验收'),
      ]),
    );
    expectNoForbiddenFields(payload);
  });

  it('支持 tenantId / packageCode / quotaStatus 仅筛选 fixture 数据', () => {
    const byPackage = listPlatformPackageAiQuotaReadonly({
      filters: { packageCode: 'basic' },
    });
    expect(byPackage.packages.map((item) => item.packageCode)).toEqual(['basic']);
    expect(byPackage.tenantQuotaSummaries.every((item) => item.packageCode === 'basic')).toBe(true);

    const byStatus = listPlatformPackageAiQuotaReadonly({
      filters: { quotaStatus: 'overLimit' },
    });
    expect(byStatus.tenantQuotaSummaries).toHaveLength(1);
    expect(byStatus.tenantQuotaSummaries[0]?.quota.status).toBe('overLimit');
    expect(JSON.stringify(byStatus.tenantQuotaSummaries[0])).not.toMatch(/shouldBlock|isBlocked|hardBlock|deny/i);

    const byTenant = listPlatformPackageAiQuotaReadonly({
      filters: { tenantId: 'tenant-demo-low-sensitive' },
    });
    expect(byTenant.tenantBindings.length).toBeGreaterThan(0);
    expect(byTenant.tenantBindings.every((item) => item.tenantId === 'tenant-demo-low-sensitive')).toBe(true);
  });
});
