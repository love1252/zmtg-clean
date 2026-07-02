export const PACKAGE_AI_QUOTA_PACKAGE_CODES = ['trial', 'basic', 'professional'] as const;
export const PACKAGE_AI_QUOTA_PACKAGE_STATUSES = ['draft', 'active', 'retired'] as const;
export const PACKAGE_AI_QUOTA_ENTITLEMENT_CATEGORIES = [
  'staff',
  'knowledge',
  'ai_service',
  'connector',
  'support',
] as const;
export const PACKAGE_AI_QUOTA_TYPES = ['ai_service_units'] as const;
export const PACKAGE_AI_QUOTA_UNITS = ['ai_service_unit'] as const;
export const PACKAGE_AI_QUOTA_CYCLES = ['monthly', 'trial_period', 'manual_period'] as const;
export const PACKAGE_AI_QUOTA_STATUSES = [
  'unlinked',
  'active',
  'warning',
  'overLimit',
  'expired',
] as const;
export const PACKAGE_AI_QUOTA_WARNING_LEVELS = [
  'none',
  'low',
  'medium',
  'high',
  'exceeded',
] as const;
export const INSTITUTION_AI_QUOTA_READONLY_FIELD_WHITELIST = [
  'isLinked',
  'status',
  'periodStart',
  'periodEnd',
  'totalAllowance',
  'used',
  'remaining',
  'usageRate',
  'warningLevel',
  'displayUnit',
  'notes',
] as const;

export type InstitutionAiQuotaReadonlyField =
  (typeof INSTITUTION_AI_QUOTA_READONLY_FIELD_WHITELIST)[number];

export const TENANT_PACKAGE_STATUSES = ['unlinked', 'active', 'expired', 'suspended'] as const;
export const PACKAGE_AI_SERVICE_PROJECT_CATEGORIES = [
  'ai_qa',
  'knowledge_base_qa',
  'auto_followup',
  'unknown',
] as const;
export const PACKAGE_AI_QUOTA_ADJUSTMENT_REASONS = [
  'manual_grant',
  'sales_contract',
  'support_correction',
  'system_reconciliation',
] as const;

export type PackageAiQuotaPackageCode = (typeof PACKAGE_AI_QUOTA_PACKAGE_CODES)[number];
export type PackageAiQuotaPackageStatus = (typeof PACKAGE_AI_QUOTA_PACKAGE_STATUSES)[number];
export type PackageAiQuotaEntitlementCategory =
  (typeof PACKAGE_AI_QUOTA_ENTITLEMENT_CATEGORIES)[number];
export type PackageAiQuotaType = (typeof PACKAGE_AI_QUOTA_TYPES)[number];
export type PackageAiQuotaUnit = (typeof PACKAGE_AI_QUOTA_UNITS)[number];
export type PackageAiQuotaCycle = (typeof PACKAGE_AI_QUOTA_CYCLES)[number];
export type PackageAiQuotaStatus = (typeof PACKAGE_AI_QUOTA_STATUSES)[number];
export type PackageAiQuotaWarningLevel = (typeof PACKAGE_AI_QUOTA_WARNING_LEVELS)[number];
export type TenantPackageStatus = (typeof TENANT_PACKAGE_STATUSES)[number];
export type PackageAiServiceProjectCategory =
  (typeof PACKAGE_AI_SERVICE_PROJECT_CATEGORIES)[number];
export type PackageAiQuotaAdjustmentReason =
  (typeof PACKAGE_AI_QUOTA_ADJUSTMENT_REASONS)[number];

export type PackageAiQuotaEntitlementDefinition = {
  entitlementKey: string;
  entitlementName: string;
  entitlementCategory: PackageAiQuotaEntitlementCategory;
  quotaType: PackageAiQuotaType | null;
  quotaUnit: PackageAiQuotaUnit | null;
  quotaCycle: PackageAiQuotaCycle | null;
  quotaLimit: number | null;
  notes: string[];
};

export type PackageAiQuotaPackageDefinition = {
  packageCode: PackageAiQuotaPackageCode;
  packageName: string;
  packageVersion: string;
  packageStatus: PackageAiQuotaPackageStatus;
  entitlements: PackageAiQuotaEntitlementDefinition[];
};

export type PackageAiQuotaPeriod = {
  periodStart: string | null;
  periodEnd: string | null;
  quotaCycle: PackageAiQuotaCycle;
};

export type PackageAiQuotaSnapshot = {
  quotaType: PackageAiQuotaType;
  quotaUnit: PackageAiQuotaUnit;
  quotaCycle: PackageAiQuotaCycle;
  quotaLimit: number | null;
  used: number;
  remaining: number | null;
  usageRate: number | null;
  status: PackageAiQuotaStatus;
  warningLevel: PackageAiQuotaWarningLevel;
  displayUnit: 'AI 服务额度';
  notes: string[];
};

export type TenantPackageBindingContract = {
  tenantId: string;
  institutionId: string | null;
  packageCode: PackageAiQuotaPackageCode | null;
  tenantPackageStatus: TenantPackageStatus;
  packageVersion: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

export type PlatformServiceProjectQuotaAttribution = {
  serviceProjectCategory: PackageAiServiceProjectCategory;
  serviceProjectName: string;
  serviceAction: string | null;
  quotaLimit: number | null;
  used: number;
  remaining: number | null;
  usageRate: number | null;
};

export type PackageAiQuotaAdjustmentSummary = {
  adjustmentReason: PackageAiQuotaAdjustmentReason;
  adjustmentUnits: number;
  operatorRole: 'platform_admin' | 'system';
  auditSummary: string;
};

export type PackageAiQuotaAuditSummary = {
  lastCalculatedAt: string;
  source: 'mock_contract' | 'readonly_aggregation' | 'manual_adjustment';
  auditSummary: string;
};

export type PlatformPackageAiQuotaContract = {
  packageDefinition: PackageAiQuotaPackageDefinition | null;
  tenantPackage: TenantPackageBindingContract;
  period: PackageAiQuotaPeriod;
  quota: PackageAiQuotaSnapshot;
  serviceProjects: PlatformServiceProjectQuotaAttribution[];
  adjustments: PackageAiQuotaAdjustmentSummary[];
  audit: PackageAiQuotaAuditSummary;
  internalMeteringPolicyIdentifier: string | null;
  internalMeteringPolicy: {
    providerCodes: string[];
    modelCodes: string[];
    tokenMeteringStrategy: 'internal_only';
    internalConversionPolicy: 'platform_ai_credits_to_service_units';
  } | null;
};

export type RealPackageAiQuotaAllowanceSource = {
  totalAllowance: number | null;
  displayUnit: 'AI 服务额度' | null;
};

export type RealPackageAiQuotaUsageSource = {
  used: number | null;
  remaining: number | null;
  usageRate: number | null;
};

export type RealPackageAiQuotaLinkageSource = {
  tenantPackage: TenantPackageBindingContract | null;
  period: PackageAiQuotaPeriod | null;
  allowance: RealPackageAiQuotaAllowanceSource | null;
  usage: RealPackageAiQuotaUsageSource | null;
  status: PackageAiQuotaStatus | null;
  warningLevel: PackageAiQuotaWarningLevel | null;
  notes: string[];
};

export type InstitutionAiQuotaReadonlyDto = {
  isLinked: boolean;
  status: PackageAiQuotaStatus;
  periodStart: string | null;
  periodEnd: string | null;
  totalAllowance: number | null;
  used: number;
  remaining: number | null;
  usageRate: number | null;
  warningLevel: PackageAiQuotaWarningLevel;
  displayUnit: 'AI 服务额度';
  notes: string[];
};

export type InstitutionAiQuotaServiceProjectView = {
  serviceProjectCategory: PackageAiServiceProjectCategory;
  serviceProjectName: string;
  serviceAction: string | null;
  used: number;
  remaining: number | null;
  usageRate: number | null;
};

export type InstitutionAiQuotaView = {
  packageName: string | null;
  packageVersion: string | null;
  quota: InstitutionAiQuotaReadonlyDto;
  serviceProjects: InstitutionAiQuotaServiceProjectView[];
};

export function calculatePackageAiQuotaRemaining(input: {
  quotaLimit: number | null;
  used: number;
}): number | null {
  if (input.quotaLimit === null || input.quotaLimit === undefined) return null;
  return Math.max(0, input.quotaLimit - Math.max(0, input.used));
}

export function calculatePackageAiQuotaUsageRate(input: {
  quotaLimit: number | null;
  used: number;
}): number | null {
  if (!input.quotaLimit || input.quotaLimit <= 0) return null;
  const rate = (Math.max(0, input.used) / input.quotaLimit) * 100;
  return Math.round(rate * 10) / 10;
}

export function resolvePackageAiQuotaWarningLevel(input: {
  status: PackageAiQuotaStatus;
  usageRate: number | null;
}): PackageAiQuotaWarningLevel {
  if (input.status === 'unlinked') return 'none';
  if (input.status === 'expired') return 'high';
  if (input.status === 'overLimit') return 'exceeded';
  if (input.usageRate === null) return 'none';
  if (input.usageRate >= 100) return 'exceeded';
  if (input.usageRate >= 90) return 'high';
  if (input.usageRate >= 80) return 'medium';
  if (input.usageRate > 0) return 'low';
  return 'none';
}

function isFiniteNonNegativeNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function createInstitutionAiQuotaFallback(reason: 'missing_binding' | 'invalid_source' | 'unlinked'): InstitutionAiQuotaReadonlyDto {
  const notesByReason: Record<typeof reason, string> = {
    missing_binding: '套餐绑定缺失，额度视图已回退为未接入。',
    invalid_source: '套餐额度数据暂不可用，额度视图已回退为未接入。',
    unlinked: '套餐额度暂未接入',
  };

  return {
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
    notes: [notesByReason[reason]],
  };
}

export function mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(
  source: RealPackageAiQuotaLinkageSource | null | undefined,
): InstitutionAiQuotaReadonlyDto {
  if (!source) return createInstitutionAiQuotaFallback('invalid_source');
  if (source.status === 'unlinked') return createInstitutionAiQuotaFallback('unlinked');

  if (
    !source.tenantPackage
    || source.tenantPackage.tenantPackageStatus === 'unlinked'
    || !source.tenantPackage.packageCode
  ) {
    return createInstitutionAiQuotaFallback('missing_binding');
  }

  const totalAllowance = source.allowance?.totalAllowance;
  const used = source.usage?.used;
  if (!source.period || !isFiniteNonNegativeNumber(totalAllowance) || !isFiniteNonNegativeNumber(used)) {
    return createInstitutionAiQuotaFallback('invalid_source');
  }

  const calculatedRemaining = calculatePackageAiQuotaRemaining({ quotaLimit: totalAllowance, used });
  const calculatedUsageRate = calculatePackageAiQuotaUsageRate({ quotaLimit: totalAllowance, used });
  const status = source.status ?? 'unlinked';
  if (status === 'unlinked') return createInstitutionAiQuotaFallback('unlinked');

  return {
    isLinked: true,
    status,
    periodStart: source.period.periodStart,
    periodEnd: source.period.periodEnd,
    totalAllowance,
    used: Math.max(0, used),
    remaining: calculatedRemaining,
    usageRate: calculatedUsageRate,
    warningLevel: source.warningLevel ?? resolvePackageAiQuotaWarningLevel({
      status,
      usageRate: calculatedUsageRate,
    }),
    displayUnit: 'AI 服务额度',
    notes: source.notes,
  };
}

function createQuotaSnapshot(input: {
  quotaLimit: number | null;
  used: number;
  status: PackageAiQuotaStatus;
  notes?: string[];
}): PackageAiQuotaSnapshot {
  const remaining = calculatePackageAiQuotaRemaining(input);
  const usageRate = calculatePackageAiQuotaUsageRate(input);
  return {
    quotaType: 'ai_service_units',
    quotaUnit: 'ai_service_unit',
    quotaCycle: 'monthly',
    quotaLimit: input.quotaLimit,
    used: Math.max(0, input.used),
    remaining,
    usageRate,
    status: input.status,
    warningLevel: resolvePackageAiQuotaWarningLevel({
      status: input.status,
      usageRate,
    }),
    displayUnit: 'AI 服务额度',
    notes: input.notes ?? [],
  };
}

function createServiceProjectAttribution(input: {
  serviceProjectCategory: PackageAiServiceProjectCategory;
  serviceProjectName: string;
  serviceAction: string | null;
  quotaLimit: number | null;
  used: number;
}): PlatformServiceProjectQuotaAttribution {
  return {
    ...input,
    remaining: calculatePackageAiQuotaRemaining(input),
    usageRate: calculatePackageAiQuotaUsageRate(input),
  };
}

const packageDefinitions = [
  {
    packageCode: 'trial',
    packageName: '试用版',
    packageVersion: 'v06',
    packageStatus: 'active',
    entitlements: [
      {
        entitlementKey: 'ai_service_units_monthly',
        entitlementName: 'AI 服务额度',
        entitlementCategory: 'ai_service',
        quotaType: 'ai_service_units',
        quotaUnit: 'ai_service_unit',
        quotaCycle: 'monthly',
        quotaLimit: 100,
        notes: ['试用期低频体验额度。'],
      },
    ],
  },
  {
    packageCode: 'basic',
    packageName: '基础版',
    packageVersion: 'v06',
    packageStatus: 'active',
    entitlements: [
      {
        entitlementKey: 'ai_service_units_monthly',
        entitlementName: 'AI 服务额度',
        entitlementCategory: 'ai_service',
        quotaType: 'ai_service_units',
        quotaUnit: 'ai_service_unit',
        quotaCycle: 'monthly',
        quotaLimit: 1000,
        notes: ['适合基础客户运营场景。'],
      },
    ],
  },
  {
    packageCode: 'professional',
    packageName: '专业版',
    packageVersion: 'v06',
    packageStatus: 'active',
    entitlements: [
      {
        entitlementKey: 'ai_service_units_monthly',
        entitlementName: 'AI 服务额度',
        entitlementCategory: 'ai_service',
        quotaType: 'ai_service_units',
        quotaUnit: 'ai_service_unit',
        quotaCycle: 'monthly',
        quotaLimit: 5000,
        notes: ['适合高频知识库与随访运营。'],
      },
    ],
  },
] as const satisfies PackageAiQuotaPackageDefinition[];

const serviceProjectAttributions = [
  createServiceProjectAttribution({
    serviceProjectCategory: 'ai_qa',
    serviceProjectName: 'AI 问答',
    serviceAction: 'institution_ai_qa',
    quotaLimit: 450,
    used: 180,
  }),
  createServiceProjectAttribution({
    serviceProjectCategory: 'knowledge_base_qa',
    serviceProjectName: '知识库问答',
    serviceAction: 'knowledge_base_rag_qa',
    quotaLimit: 350,
    used: 160,
  }),
  createServiceProjectAttribution({
    serviceProjectCategory: 'auto_followup',
    serviceProjectName: '智能随访',
    serviceAction: 'followup_draft_generation',
    quotaLimit: 150,
    used: 60,
  }),
  createServiceProjectAttribution({
    serviceProjectCategory: 'unknown',
    serviceProjectName: '未归因服务',
    serviceAction: null,
    quotaLimit: 50,
    used: 20,
  }),
] as const satisfies PlatformServiceProjectQuotaAttribution[];

function createPlatformContract(input: {
  packageDefinition: PackageAiQuotaPackageDefinition | null;
  tenantPackageStatus: TenantPackageStatus;
  quotaLimit: number | null;
  used: number;
  status: PackageAiQuotaStatus;
  periodStart: string | null;
  periodEnd: string | null;
  serviceProjects?: PlatformServiceProjectQuotaAttribution[];
}): PlatformPackageAiQuotaContract {
  return {
    packageDefinition: input.packageDefinition,
    tenantPackage: {
      tenantId: 'tenant-demo-low-sensitive',
      institutionId: 'institution-demo-low-sensitive',
      packageCode: input.packageDefinition?.packageCode ?? null,
      tenantPackageStatus: input.tenantPackageStatus,
      packageVersion: input.packageDefinition?.packageVersion ?? null,
      effectiveFrom: input.periodStart,
      effectiveTo: input.periodEnd,
    },
    period: {
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      quotaCycle: 'monthly',
    },
    quota: createQuotaSnapshot({
      quotaLimit: input.quotaLimit,
      used: input.used,
      status: input.status,
      notes: input.status === 'unlinked' ? ['套餐额度暂未接入'] : [],
    }),
    serviceProjects: input.serviceProjects ?? serviceProjectAttributions,
    adjustments: [
      {
        adjustmentReason: 'manual_grant',
        adjustmentUnits: 0,
        operatorRole: 'platform_admin',
        auditSummary: '合同口径示例，不代表真实调整。',
      },
    ],
    audit: {
      lastCalculatedAt: '2026-07-02T00:00:00.000Z',
      source: 'mock_contract',
      auditSummary: '仅用于 server-domain contract 测试。',
    },
    internalMeteringPolicyIdentifier: 'v06-package-ai-quota-contract-02',
    internalMeteringPolicy: {
      providerCodes: ['qwen', 'deepseek'],
      modelCodes: ['qwen-plus-latest', 'deepseek-v3'],
      tokenMeteringStrategy: 'internal_only',
      internalConversionPolicy: 'platform_ai_credits_to_service_units',
    },
  };
}

const platformContractsByStatus = {
  unlinked: createPlatformContract({
    packageDefinition: null,
    tenantPackageStatus: 'unlinked',
    quotaLimit: null,
    used: 0,
    status: 'unlinked',
    periodStart: null,
    periodEnd: null,
    serviceProjects: [],
  }),
  active: createPlatformContract({
    packageDefinition: packageDefinitions[1],
    tenantPackageStatus: 'active',
    quotaLimit: 1000,
    used: 420,
    status: 'active',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
  }),
  warning: createPlatformContract({
    packageDefinition: packageDefinitions[1],
    tenantPackageStatus: 'active',
    quotaLimit: 1000,
    used: 880,
    status: 'warning',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
  }),
  overLimit: createPlatformContract({
    packageDefinition: packageDefinitions[0],
    tenantPackageStatus: 'active',
    quotaLimit: 100,
    used: 126,
    status: 'overLimit',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
  }),
  expired: createPlatformContract({
    packageDefinition: packageDefinitions[2],
    tenantPackageStatus: 'expired',
    quotaLimit: 5000,
    used: 900,
    status: 'expired',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
  }),
} as const satisfies Record<PackageAiQuotaStatus, PlatformPackageAiQuotaContract>;

const realTenantPackageBinding: TenantPackageBindingContract = {
  tenantId: 'tenant-demo-low-sensitive',
  institutionId: 'institution-demo-low-sensitive',
  packageCode: 'basic',
  tenantPackageStatus: 'active',
  packageVersion: 'v06',
  effectiveFrom: '2026-07-01',
  effectiveTo: '2026-07-31',
};

function createRealLinkageSource(input: {
  tenantPackage?: TenantPackageBindingContract | null;
  totalAllowance: number | null;
  used: number | null;
  remaining?: number | null;
  usageRate?: number | null;
  status: PackageAiQuotaStatus | null;
  warningLevel?: PackageAiQuotaWarningLevel | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  notes?: string[];
}): RealPackageAiQuotaLinkageSource {
  return {
    tenantPackage: input.tenantPackage === undefined ? realTenantPackageBinding : input.tenantPackage,
    period: input.periodStart === undefined && input.periodEnd === undefined
      ? {
          periodStart: '2026-07-01',
          periodEnd: '2026-07-31',
          quotaCycle: 'monthly',
        }
      : {
          periodStart: input.periodStart ?? null,
          periodEnd: input.periodEnd ?? null,
          quotaCycle: 'monthly',
        },
    allowance: {
      totalAllowance: input.totalAllowance,
      displayUnit: 'AI 服务额度',
    },
    usage: {
      used: input.used,
      remaining: input.remaining ?? null,
      usageRate: input.usageRate ?? null,
    },
    status: input.status,
    warningLevel: input.warningLevel ?? null,
    notes: input.notes ?? [],
  };
}

const realLinkageSources = {
  active: createRealLinkageSource({
    totalAllowance: 1000,
    used: 420,
    remaining: 999,
    usageRate: 9,
    status: 'active',
  }),
  warning: createRealLinkageSource({
    totalAllowance: 1000,
    used: 880,
    status: 'warning',
  }),
  overLimit: createRealLinkageSource({
    totalAllowance: 100,
    used: 126,
    status: 'overLimit',
  }),
  expired: createRealLinkageSource({
    tenantPackage: {
      ...realTenantPackageBinding,
      tenantPackageStatus: 'expired',
      effectiveFrom: '2026-06-01',
      effectiveTo: '2026-06-30',
    },
    totalAllowance: 5000,
    used: 900,
    status: 'expired',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
  }),
  missingBinding: createRealLinkageSource({
    tenantPackage: null,
    totalAllowance: 1000,
    used: 420,
    status: 'active',
  }),
  invalidFallback: createRealLinkageSource({
    totalAllowance: null,
    used: 420,
    status: 'active',
  }),
  unlinkedCompatibility: createRealLinkageSource({
    tenantPackage: {
      ...realTenantPackageBinding,
      packageCode: null,
      tenantPackageStatus: 'unlinked',
      packageVersion: null,
      effectiveFrom: null,
      effectiveTo: null,
    },
    totalAllowance: null,
    used: 0,
    status: 'unlinked',
    periodStart: null,
    periodEnd: null,
    notes: ['套餐额度暂未接入'],
  }),
} as const satisfies Record<string, RealPackageAiQuotaLinkageSource>;

export const PACKAGE_AI_QUOTA_FIXTURES = {
  packages: packageDefinitions,
  serviceProjects: serviceProjectAttributions,
  platformContractsByStatus,
  platformContracts: [
    platformContractsByStatus.unlinked,
    platformContractsByStatus.active,
    platformContractsByStatus.warning,
    platformContractsByStatus.overLimit,
    platformContractsByStatus.expired,
  ],
  realLinkageSources,
  realLinkageInstitutionReadonlyDtos: {
    active: mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(realLinkageSources.active),
    warning: mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(realLinkageSources.warning),
    overLimit: mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(realLinkageSources.overLimit),
    expired: mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(realLinkageSources.expired),
    missingBinding: mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(realLinkageSources.missingBinding),
    invalidFallback: mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(realLinkageSources.invalidFallback),
    unlinkedCompatibility: mapRealPackageAiQuotaSourceToInstitutionReadonlyDto(
      realLinkageSources.unlinkedCompatibility,
    ),
  },
} as const;

export function mapPlatformAiQuotaContractToInstitutionView(
  contract: PlatformPackageAiQuotaContract,
): InstitutionAiQuotaView {
  const isLinked = contract.quota.status !== 'unlinked';

  return {
    packageName: contract.packageDefinition?.packageName ?? null,
    packageVersion: contract.packageDefinition?.packageVersion ?? null,
    quota: {
      isLinked,
      status: contract.quota.status,
      periodStart: isLinked ? contract.period.periodStart : null,
      periodEnd: isLinked ? contract.period.periodEnd : null,
      totalAllowance: isLinked ? contract.quota.quotaLimit : null,
      used: contract.quota.used,
      remaining: isLinked ? contract.quota.remaining : null,
      usageRate: isLinked ? contract.quota.usageRate : null,
      warningLevel: contract.quota.warningLevel,
      displayUnit: contract.quota.displayUnit,
      notes: isLinked ? contract.quota.notes : ['套餐额度暂未接入'],
    },
    serviceProjects: isLinked
      ? contract.serviceProjects.map((item) => ({
          serviceProjectCategory: item.serviceProjectCategory,
          serviceProjectName: item.serviceProjectName,
          serviceAction: item.serviceAction,
          used: item.used,
          remaining: item.remaining,
          usageRate: item.usageRate,
        }))
      : [],
  };
}
