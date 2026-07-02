import {
  PACKAGE_AI_QUOTA_FIXTURES,
  PACKAGE_AI_QUOTA_STATUSES,
  type PackageAiQuotaPackageCode,
  type PackageAiQuotaStatus,
  type PlatformPackageAiQuotaContract,
} from '@/modules/institution/domain/package-ai-quota-contract';

export type PlatformPackageAiQuotaReadonlyFilters = {
  tenantId?: string | null;
  packageCode?: string | null;
  quotaStatus?: string | null;
};

export type PlatformPackageAiQuotaReadonlyPackageDto = {
  packageCode: PackageAiQuotaPackageCode;
  packageName: string;
  packageVersion: string;
  packageStatus: string;
};

export type PlatformPackageAiQuotaReadonlyEntitlementDto = {
  packageCode: PackageAiQuotaPackageCode;
  packageName: string;
  packageVersion: string;
  entitlementKey: string;
  entitlementName: string;
  entitlementCategory: string;
  quotaType: string | null;
  quotaUnit: string | null;
  quotaCycle: string | null;
  quotaLimit: number | null;
  notes: string[];
};

export type PlatformPackageAiQuotaReadonlyTenantBindingDto = {
  tenantId: string;
  institutionId: string | null;
  packageCode: PackageAiQuotaPackageCode | null;
  packageName: string | null;
  packageVersion: string | null;
  tenantPackageStatus: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

export type PlatformPackageAiQuotaReadonlyTenantQuotaSummaryDto = {
  tenantId: string;
  institutionId: string | null;
  packageCode: PackageAiQuotaPackageCode | null;
  packageName: string | null;
  packageVersion: string | null;
  quota: {
    status: PackageAiQuotaStatus;
    quotaType: string;
    quotaUnit: string;
    quotaCycle: string;
    quotaLimit: number | null;
    used: number;
    remaining: number | null;
    usageRate: number | null;
    warningLevel: string;
    displayUnit: 'AI 服务额度';
    notes: string[];
  };
};

export type PlatformPackageAiQuotaReadonlyServiceProjectDto = {
  tenantId: string;
  packageCode: PackageAiQuotaPackageCode | null;
  packageName: string | null;
  packageVersion: string | null;
  serviceProjectCategory: string;
  serviceProjectName: string;
  serviceAction: string | null;
  quotaLimit: number | null;
  used: number;
  remaining: number | null;
  usageRate: number | null;
};

export type PlatformPackageAiQuotaReadonlyQuotaStatusDto = {
  status: PackageAiQuotaStatus;
  count: number;
};

export type PlatformPackageAiQuotaReadonlyResponse = {
  requestId: 'platform-package-ai-quota-readonly';
  readonly: true;
  filters: {
    tenantId: string | null;
    packageCode: string | null;
    quotaStatus: string | null;
  };
  packages: PlatformPackageAiQuotaReadonlyPackageDto[];
  entitlements: PlatformPackageAiQuotaReadonlyEntitlementDto[];
  tenantBindings: PlatformPackageAiQuotaReadonlyTenantBindingDto[];
  tenantQuotaSummaries: PlatformPackageAiQuotaReadonlyTenantQuotaSummaryDto[];
  serviceProjectQuotaAttributions: PlatformPackageAiQuotaReadonlyServiceProjectDto[];
  quotaStatuses: PlatformPackageAiQuotaReadonlyQuotaStatusDto[];
  notes: string[];
};

const READONLY_NOTES = [
  '当前为 mock/fixture-based readonly contract，用于平台端套餐权益 / AI 服务额度联动前置验收。',
  '不代表真实套餐扣减。',
  '不代表真实剩余额度。',
  '不代表真实财务账单。',
  '不代表 provider 成本验收。',
] as const;

function optionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function normalizeFilters(input?: { filters?: PlatformPackageAiQuotaReadonlyFilters }) {
  return {
    tenantId: optionalText(input?.filters?.tenantId),
    packageCode: optionalText(input?.filters?.packageCode),
    quotaStatus: optionalText(input?.filters?.quotaStatus),
  };
}

function contractMatchesFilters(
  contract: PlatformPackageAiQuotaContract,
  filters: ReturnType<typeof normalizeFilters>,
) {
  if (filters.tenantId && contract.tenantPackage.tenantId !== filters.tenantId) return false;
  if (filters.packageCode && contract.tenantPackage.packageCode !== filters.packageCode) return false;
  if (filters.quotaStatus && contract.quota.status !== filters.quotaStatus) return false;
  return true;
}

function packageMatchesFilters(
  packageCode: PackageAiQuotaPackageCode,
  filters: ReturnType<typeof normalizeFilters>,
) {
  if (filters.packageCode && packageCode !== filters.packageCode) return false;
  return true;
}

function mapPackageDefinition(
  packageDefinition: (typeof PACKAGE_AI_QUOTA_FIXTURES.packages)[number],
): PlatformPackageAiQuotaReadonlyPackageDto {
  return {
    packageCode: packageDefinition.packageCode,
    packageName: packageDefinition.packageName,
    packageVersion: packageDefinition.packageVersion,
    packageStatus: packageDefinition.packageStatus,
  };
}

function mapEntitlements(
  packageDefinition: (typeof PACKAGE_AI_QUOTA_FIXTURES.packages)[number],
): PlatformPackageAiQuotaReadonlyEntitlementDto[] {
  return packageDefinition.entitlements.map((entitlement) => ({
    packageCode: packageDefinition.packageCode,
    packageName: packageDefinition.packageName,
    packageVersion: packageDefinition.packageVersion,
    entitlementKey: entitlement.entitlementKey,
    entitlementName: entitlement.entitlementName,
    entitlementCategory: entitlement.entitlementCategory,
    quotaType: entitlement.quotaType,
    quotaUnit: entitlement.quotaUnit,
    quotaCycle: entitlement.quotaCycle,
    quotaLimit: entitlement.quotaLimit,
    notes: entitlement.notes,
  }));
}

function mapTenantBinding(
  contract: PlatformPackageAiQuotaContract,
): PlatformPackageAiQuotaReadonlyTenantBindingDto {
  return {
    tenantId: contract.tenantPackage.tenantId,
    institutionId: contract.tenantPackage.institutionId,
    packageCode: contract.tenantPackage.packageCode,
    packageName: contract.packageDefinition?.packageName ?? null,
    packageVersion: contract.tenantPackage.packageVersion,
    tenantPackageStatus: contract.tenantPackage.tenantPackageStatus,
    effectiveFrom: contract.tenantPackage.effectiveFrom,
    effectiveTo: contract.tenantPackage.effectiveTo,
  };
}

function mapTenantQuotaSummary(
  contract: PlatformPackageAiQuotaContract,
): PlatformPackageAiQuotaReadonlyTenantQuotaSummaryDto {
  return {
    tenantId: contract.tenantPackage.tenantId,
    institutionId: contract.tenantPackage.institutionId,
    packageCode: contract.tenantPackage.packageCode,
    packageName: contract.packageDefinition?.packageName ?? null,
    packageVersion: contract.tenantPackage.packageVersion,
    quota: {
      status: contract.quota.status,
      quotaType: contract.quota.quotaType,
      quotaUnit: contract.quota.quotaUnit,
      quotaCycle: contract.quota.quotaCycle,
      quotaLimit: contract.quota.quotaLimit,
      used: contract.quota.used,
      remaining: contract.quota.remaining,
      usageRate: contract.quota.usageRate,
      warningLevel: contract.quota.warningLevel,
      displayUnit: contract.quota.displayUnit,
      notes: contract.quota.notes,
    },
  };
}

function mapServiceProjectAttributions(
  contract: PlatformPackageAiQuotaContract,
): PlatformPackageAiQuotaReadonlyServiceProjectDto[] {
  return contract.serviceProjects.map((item) => ({
    tenantId: contract.tenantPackage.tenantId,
    packageCode: contract.tenantPackage.packageCode,
    packageName: contract.packageDefinition?.packageName ?? null,
    packageVersion: contract.tenantPackage.packageVersion,
    serviceProjectCategory: item.serviceProjectCategory,
    serviceProjectName: item.serviceProjectName,
    serviceAction: item.serviceAction,
    quotaLimit: item.quotaLimit,
    used: item.used,
    remaining: item.remaining,
    usageRate: item.usageRate,
  }));
}

function buildQuotaStatusCounts(contracts: PlatformPackageAiQuotaContract[]) {
  return PACKAGE_AI_QUOTA_STATUSES.map((status) => ({
    status,
    count: contracts.filter((contract) => contract.quota.status === status).length,
  }));
}

export function listPlatformPackageAiQuotaReadonly(input?: {
  filters?: PlatformPackageAiQuotaReadonlyFilters;
}): PlatformPackageAiQuotaReadonlyResponse {
  const filters = normalizeFilters(input);
  const contracts = PACKAGE_AI_QUOTA_FIXTURES.platformContracts.filter((contract) =>
    contractMatchesFilters(contract, filters),
  );
  const packages = PACKAGE_AI_QUOTA_FIXTURES.packages.filter((item) =>
    packageMatchesFilters(item.packageCode, filters),
  );

  return {
    requestId: 'platform-package-ai-quota-readonly',
    readonly: true,
    filters,
    packages: packages.map(mapPackageDefinition),
    entitlements: packages.flatMap(mapEntitlements),
    tenantBindings: contracts.map(mapTenantBinding),
    tenantQuotaSummaries: contracts.map(mapTenantQuotaSummary),
    serviceProjectQuotaAttributions: contracts.flatMap(mapServiceProjectAttributions),
    quotaStatuses: buildQuotaStatusCounts(contracts),
    notes: [...READONLY_NOTES],
  };
}
