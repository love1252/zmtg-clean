import {
  calculatePackageAiQuotaUsageRate,
  mapRealPackageAiQuotaSourceToInstitutionReadonlyDto,
  resolvePackageAiQuotaWarningLevel,
  type InstitutionAiQuotaReadonlyDto,
  type PackageAiQuotaPeriod,
  type PackageAiQuotaStatus,
  type RealPackageAiQuotaAllowanceSource,
  type RealPackageAiQuotaLinkageSource,
  type RealPackageAiQuotaUsageSource,
  type TenantPackageBindingContract,
} from '@/modules/institution/domain/package-ai-quota-contract';

export type PackageAiQuotaReadonlySourceFallbackReason =
  | 'missing_binding'
  | 'invalid_source'
  | 'unavailable_source';

export type PackageAiQuotaReadonlySourceLookupInput = {
  tenantId: string;
  institutionId?: string | null;
  now?: Date;
};

export type PackageAiQuotaReadonlySourceRepository = {
  findReadonlySource(
    input: PackageAiQuotaReadonlySourceLookupInput,
  ): Promise<RealPackageAiQuotaLinkageSource | null | undefined>;
};

export type PackageAiQuotaReadonlySourceDependencies = {
  findTenantPackageBinding(
    input: PackageAiQuotaReadonlySourceLookupInput,
  ): Promise<TenantPackageBindingContract | null | undefined>;
  findQuotaPeriod(
    input: PackageAiQuotaReadonlySourceLookupInput & {
      tenantPackage: TenantPackageBindingContract;
    },
  ): Promise<PackageAiQuotaPeriod | null | undefined>;
  findAllowance(
    input: PackageAiQuotaReadonlySourceLookupInput & {
      tenantPackage: TenantPackageBindingContract;
      period: PackageAiQuotaPeriod;
    },
  ): Promise<RealPackageAiQuotaAllowanceSource | null | undefined>;
  findUsage(
    input: PackageAiQuotaReadonlySourceLookupInput & {
      tenantPackage: TenantPackageBindingContract;
      period: PackageAiQuotaPeriod;
      allowance: RealPackageAiQuotaAllowanceSource;
    },
  ): Promise<RealPackageAiQuotaUsageSource | null | undefined>;
  resolveStatus?(input: {
    tenantPackage: TenantPackageBindingContract;
    period: PackageAiQuotaPeriod;
    allowance: RealPackageAiQuotaAllowanceSource;
    usage: RealPackageAiQuotaUsageSource;
    now: Date;
  }): PackageAiQuotaStatus | null | undefined;
};

const fallbackNotes: Record<PackageAiQuotaReadonlySourceFallbackReason, string> = {
  missing_binding: '套餐绑定缺失，已使用受控 fallback source。',
  invalid_source: '套餐额度来源不完整，已使用受控 fallback source。',
  unavailable_source: '真实套餐额度来源暂不可用，已使用受控 fallback source。',
};

function hasLinkedTenantPackage(
  tenantPackage: TenantPackageBindingContract | null | undefined,
): tenantPackage is TenantPackageBindingContract {
  return Boolean(
    tenantPackage
      && (tenantPackage.tenantPackageStatus === 'active' || tenantPackage.tenantPackageStatus === 'expired')
      && tenantPackage.packageCode,
  );
}

function isFiniteNonNegativeNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function parseDateOnlyTime(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day, 23, 59, 59, 999);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed.getTime();
}

function resolveReadonlyStatus(input: {
  tenantPackage: TenantPackageBindingContract;
  period: PackageAiQuotaPeriod;
  allowance: RealPackageAiQuotaAllowanceSource;
  usage: RealPackageAiQuotaUsageSource;
  now: Date;
}): PackageAiQuotaStatus {
  if (input.tenantPackage.tenantPackageStatus === 'expired') return 'expired';

  const periodEndTime = parseDateOnlyTime(input.period.periodEnd);
  if (periodEndTime !== null && input.now.getTime() > periodEndTime) return 'expired';

  const totalAllowance = input.allowance.totalAllowance;
  const used = input.usage.used;
  if (!isFiniteNonNegativeNumber(totalAllowance) || !isFiniteNonNegativeNumber(used)) return 'unlinked';
  if (used > totalAllowance) return 'overLimit';

  const usageRate = calculatePackageAiQuotaUsageRate({ quotaLimit: totalAllowance, used });
  if (usageRate !== null && usageRate >= 80) return 'warning';

  return 'active';
}

function createFallbackTenantPackage(input: {
  tenantId: string;
  institutionId?: string | null;
}): TenantPackageBindingContract {
  return {
    tenantId: input.tenantId,
    institutionId: input.institutionId ?? null,
    packageCode: null,
    tenantPackageStatus: 'unlinked',
    packageVersion: null,
    effectiveFrom: null,
    effectiveTo: null,
  };
}

export function createControlledFallbackPackageAiQuotaReadonlySource(input: {
  tenantId: string;
  institutionId?: string | null;
  reason?: PackageAiQuotaReadonlySourceFallbackReason;
}): RealPackageAiQuotaLinkageSource {
  const reason = input.reason ?? 'unavailable_source';

  return {
    tenantPackage: createFallbackTenantPackage(input),
    period: null,
    allowance: null,
    usage: null,
    status: 'unlinked',
    warningLevel: 'none',
    notes: [fallbackNotes[reason]],
  };
}

export function createPackageAiQuotaControlledFallbackReadonlySourceRepository(): PackageAiQuotaReadonlySourceRepository {
  return {
    async findReadonlySource(input) {
      return createControlledFallbackPackageAiQuotaReadonlySource({
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        reason: 'unavailable_source',
      });
    },
  };
}

export function createPackageAiQuotaDependencyInjectedReadonlySourceRepository(
  dependencies: PackageAiQuotaReadonlySourceDependencies,
): PackageAiQuotaReadonlySourceRepository {
  return {
    async findReadonlySource(input) {
      const now = input.now ?? new Date();
      const tenantPackage = await dependencies.findTenantPackageBinding(input);
      if (!hasLinkedTenantPackage(tenantPackage)) {
        return createControlledFallbackPackageAiQuotaReadonlySource({
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          reason: 'missing_binding',
        });
      }

      const period = await dependencies.findQuotaPeriod({ ...input, tenantPackage });
      if (!period) {
        return createControlledFallbackPackageAiQuotaReadonlySource({
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          reason: 'invalid_source',
        });
      }

      const allowance = await dependencies.findAllowance({ ...input, tenantPackage, period });
      if (!allowance || !isFiniteNonNegativeNumber(allowance.totalAllowance)) {
        return createControlledFallbackPackageAiQuotaReadonlySource({
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          reason: 'invalid_source',
        });
      }

      const usage = await dependencies.findUsage({ ...input, tenantPackage, period, allowance });
      if (!usage || !isFiniteNonNegativeNumber(usage.used)) {
        return createControlledFallbackPackageAiQuotaReadonlySource({
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          reason: 'invalid_source',
        });
      }

      const status = dependencies.resolveStatus?.({
        tenantPackage,
        period,
        allowance,
        usage,
        now,
      }) ?? resolveReadonlyStatus({ tenantPackage, period, allowance, usage, now });
      const usageRate = calculatePackageAiQuotaUsageRate({
        quotaLimit: allowance.totalAllowance,
        used: usage.used,
      });

      if (status === 'unlinked') {
        return createControlledFallbackPackageAiQuotaReadonlySource({
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          reason: 'invalid_source',
        });
      }

      return {
        tenantPackage,
        period,
        allowance: {
          totalAllowance: allowance.totalAllowance,
          displayUnit: 'AI 服务额度',
        },
        usage: {
          used: usage.used,
          remaining: usage.remaining ?? null,
          usageRate: usage.usageRate ?? null,
        },
        status,
        warningLevel: resolvePackageAiQuotaWarningLevel({ status, usageRate }),
        notes: [],
      };
    },
  };
}

export function createPackageAiQuotaReadonlySourceFacade(
  repository: PackageAiQuotaReadonlySourceRepository = createPackageAiQuotaControlledFallbackReadonlySourceRepository(),
) {
  return {
    async getRealPackageAiQuotaLinkageSource(
      input: PackageAiQuotaReadonlySourceLookupInput,
    ): Promise<RealPackageAiQuotaLinkageSource> {
      const source = await repository.findReadonlySource(input);
      return source ?? createControlledFallbackPackageAiQuotaReadonlySource({
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        reason: 'unavailable_source',
      });
    },

    async getInstitutionReadonlyDto(
      input: PackageAiQuotaReadonlySourceLookupInput,
    ): Promise<InstitutionAiQuotaReadonlyDto> {
      const source = await this.getRealPackageAiQuotaLinkageSource(input);
      return mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(source);
    },
  };
}
