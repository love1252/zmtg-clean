import { describe, expect, it, vi } from 'vitest';

import {
  INSTITUTION_AI_QUOTA_READONLY_FIELD_WHITELIST,
  mapRealPackageAiQuotaSourceToInstitutionReadonlyDto,
  type PackageAiQuotaStatus,
  type RealPackageAiQuotaLinkageSource,
  type TenantPackageBindingContract,
} from '@/modules/institution/domain/package-ai-quota-contract';
import {
  createControlledFallbackPackageAiQuotaReadonlySource,
  createPackageAiQuotaControlledFallbackReadonlySourceRepository,
  createPackageAiQuotaDependencyInjectedReadonlySourceRepository,
  createPackageAiQuotaFixtureBackedReadonlySource,
  createPackageAiQuotaFixtureBackedReadonlySourceRepository,
  createPackageAiQuotaReadonlySourceFacade,
} from '@/modules/institution/entitlement/package-ai-quota-readonly-source';

const baseLookup = {
  tenantId: 'tenant-readonly-source-test',
  institutionId: 'institution-readonly-source-test',
  now: new Date('2026-07-15T00:00:00.000Z'),
};

const linkedTenantPackage: TenantPackageBindingContract = {
  tenantId: baseLookup.tenantId,
  institutionId: baseLookup.institutionId,
  packageCode: 'basic',
  tenantPackageStatus: 'active',
  packageVersion: 'v06',
  effectiveFrom: '2026-07-01',
  effectiveTo: '2026-07-31',
};

const readonlySourceSensitivePatterns = [
  /provider/i,
  /\bmodel\b/i,
  /Token/,
  /totalTokens/i,
  /internal.*conversion/i,
  /RMB/i,
  /¥/,
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

function createDependencies(overrides: {
  totalAllowance?: number | null;
  used?: number | null;
  tenantPackage?: TenantPackageBindingContract | null;
  periodEnd?: string | null;
  resolveStatus?: () => PackageAiQuotaStatus | null | undefined;
} = {}) {
  return {
    findTenantPackageBinding: vi.fn(async () => (
      Object.hasOwn(overrides, 'tenantPackage') ? overrides.tenantPackage : linkedTenantPackage
    )),
    findQuotaPeriod: vi.fn(async () => ({
      periodStart: '2026-07-01',
      periodEnd: overrides.periodEnd === undefined ? '2026-07-31' : overrides.periodEnd,
      quotaCycle: 'monthly' as const,
    })),
    findAllowance: vi.fn(async () => ({
      totalAllowance: overrides.totalAllowance === undefined ? 1000 : overrides.totalAllowance,
      displayUnit: 'AI 服务额度' as const,
    })),
    findUsage: vi.fn(async () => ({
      used: overrides.used === undefined ? 420 : overrides.used,
      remaining: 999,
      usageRate: 9,
    })),
    resolveStatus: overrides.resolveStatus
      ? vi.fn(overrides.resolveStatus)
      : undefined,
    writeDatabase: vi.fn(),
    callProvider: vi.fn(),
    deductQuota: vi.fn(),
    sendAlert: vi.fn(),
    exportQuota: vi.fn(),
  };
}

async function resolveSource(overrides: Parameters<typeof createDependencies>[0] = {}) {
  const dependencies = createDependencies(overrides);
  const repository = createPackageAiQuotaDependencyInjectedReadonlySourceRepository(dependencies);
  const source = await repository.findReadonlySource(baseLookup);
  return { dependencies, source };
}

describe('套餐权益 / AI 服务额度 readonly source foundation', () => {
  it('controlled fallback repository 输出稳定 RealPackageAiQuotaLinkageSource，且不伪装真实额度', async () => {
    const repository = createPackageAiQuotaControlledFallbackReadonlySourceRepository();
    const source = await repository.findReadonlySource(baseLookup);

    expect(source).toEqual({
      tenantPackage: {
        tenantId: baseLookup.tenantId,
        institutionId: baseLookup.institutionId,
        packageCode: null,
        tenantPackageStatus: 'unlinked',
        packageVersion: null,
        effectiveFrom: null,
        effectiveTo: null,
      },
      period: null,
      allowance: null,
      usage: null,
      status: 'unlinked',
      warningLevel: 'none',
      notes: ['真实套餐额度来源暂不可用，已使用受控 fallback source。'],
    } satisfies RealPackageAiQuotaLinkageSource);
  });

  it('readonly source facade 默认只走 controlled fallback，并兼容 institution DTO mapper', async () => {
    const facade = createPackageAiQuotaReadonlySourceFacade();
    const source = await facade.getRealPackageAiQuotaLinkageSource(baseLookup);
    const dto = await facade.getInstitutionReadonlyDto(baseLookup);

    expect(source.status).toBe('unlinked');
    expect(source.allowance).toBeNull();
    expect(dto).toMatchObject({
      isLinked: false,
      status: 'unlinked',
      totalAllowance: null,
      used: 0,
      remaining: null,
      usageRate: null,
      warningLevel: 'none',
      displayUnit: 'AI 服务额度',
    });
    expect(dto).toEqual(mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(source));
  });

  it('fixture-backed readonly source repository 维持默认 linked 演示口径，但仍输出 source contract', async () => {
    const active = createPackageAiQuotaFixtureBackedReadonlySource();
    const repository = createPackageAiQuotaFixtureBackedReadonlySourceRepository();
    const source = await repository.findReadonlySource(baseLookup);
    const dto = mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(source);

    expect(source).toEqual(active);
    expect(dto).toMatchObject({
      isLinked: true,
      status: 'active',
      totalAllowance: 1000,
      used: 420,
      remaining: 580,
      usageRate: 42,
      warningLevel: 'low',
    });
    expect(mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(
      createPackageAiQuotaFixtureBackedReadonlySource({ status: 'overLimit' }),
    )).toMatchObject({
      isLinked: true,
      status: 'overLimit',
      remaining: 0,
      warningLevel: 'exceeded',
    });
  });

  it('dependency-injected adapter 使用 mock dependency 输出 active source，不连接真实 DB', async () => {
    const { dependencies, source } = await resolveSource();

    expect(source).toMatchObject({
      tenantPackage: linkedTenantPackage,
      period: {
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
        quotaCycle: 'monthly',
      },
      allowance: {
        totalAllowance: 1000,
        displayUnit: 'AI 服务额度',
      },
      usage: {
        used: 420,
        remaining: 999,
        usageRate: 9,
      },
      status: 'active',
      warningLevel: 'low',
      notes: [],
    });
    expect(dependencies.findTenantPackageBinding).toHaveBeenCalledTimes(1);
    expect(dependencies.findQuotaPeriod).toHaveBeenCalledTimes(1);
    expect(dependencies.findAllowance).toHaveBeenCalledTimes(1);
    expect(dependencies.findUsage).toHaveBeenCalledTimes(1);
    expect(dependencies.writeDatabase).not.toHaveBeenCalled();
    expect(dependencies.callProvider).not.toHaveBeenCalled();
  });

  it('source 输出统一经 RealPackageAiQuotaLinkageSource -> mapper 得到机构端 DTO，且重新计算派生额度', async () => {
    const { source } = await resolveSource();
    const dto = mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(source);

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

  it('dependency-injected adapter 覆盖 warning / overLimit / expired readonly 状态', async () => {
    const warning = await resolveSource({ used: 880 });
    const overLimit = await resolveSource({ totalAllowance: 100, used: 126 });
    const expired = await resolveSource({
      tenantPackage: {
        ...linkedTenantPackage,
        tenantPackageStatus: 'expired',
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-06-30',
      },
      totalAllowance: 5000,
      used: 900,
      periodEnd: '2026-06-30',
    });

    expect(mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(warning.source)).toMatchObject({
      isLinked: true,
      status: 'warning',
      used: 880,
      remaining: 120,
      usageRate: 88,
      warningLevel: 'medium',
    });
    expect(mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(overLimit.source)).toMatchObject({
      isLinked: true,
      status: 'overLimit',
      used: 126,
      remaining: 0,
      usageRate: 126,
      warningLevel: 'exceeded',
    });
    expect(JSON.stringify(overLimit.source)).not.toMatch(/shouldBlock|isBlocked|hardBlock|deduct|charge|alert/i);
    expect(mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(expired.source)).toMatchObject({
      isLinked: true,
      status: 'expired',
      totalAllowance: 5000,
      used: 900,
      remaining: 4100,
      usageRate: 18,
      warningLevel: 'high',
    });
  });

  it('missing / invalid / unlinked / null source 都走安全 fallback', async () => {
    const missing = await resolveSource({ tenantPackage: null });
    const invalidAllowance = await resolveSource({ totalAllowance: null });
    const invalidUsage = await resolveSource({ used: null });
    const explicitUnlinked = createControlledFallbackPackageAiQuotaReadonlySource({
      tenantId: baseLookup.tenantId,
      institutionId: baseLookup.institutionId,
      reason: 'missing_binding',
    });

    for (const source of [missing.source, invalidAllowance.source, invalidUsage.source, explicitUnlinked, null]) {
      expect(mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(source)).toMatchObject({
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
    }
  });

  it('不写数据库、不调用 provider、不触发扣减、告警或导出', async () => {
    const { dependencies } = await resolveSource({ totalAllowance: 100, used: 126 });

    expect(dependencies.writeDatabase).not.toHaveBeenCalled();
    expect(dependencies.callProvider).not.toHaveBeenCalled();
    expect(dependencies.deductQuota).not.toHaveBeenCalled();
    expect(dependencies.sendAlert).not.toHaveBeenCalled();
    expect(dependencies.exportQuota).not.toHaveBeenCalled();
  });

  it('readonly source 与 institution DTO 不泄露敏感字段，DTO 仍只包含白名单字段', async () => {
    const { source } = await resolveSource({ totalAllowance: 100, used: 126 });
    const dto = mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(source);
    const serialized = JSON.stringify({ source, dto });

    expect(Object.keys(dto).sort()).toEqual([...INSTITUTION_AI_QUOTA_READONLY_FIELD_WHITELIST].sort());
    for (const pattern of readonlySourceSensitivePatterns) {
      expect(serialized).not.toMatch(pattern);
    }
  });
});
