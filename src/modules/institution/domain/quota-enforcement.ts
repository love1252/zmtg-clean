export const TENANT_QUOTA_RESOURCES = ['customers', 'appointments'] as const;

export type TenantQuotaResource = (typeof TENANT_QUOTA_RESOURCES)[number];

export type TenantQuotaDenialReason =
  | 'quota_exceeded_customers'
  | 'quota_exceeded_appointments'
  | 'missing_active_plan'
  | 'missing_quota_limit';

export type TenantQuotaDecision =
  | {
      allowed: true;
      current: number;
      limit: number;
      resource: TenantQuotaResource;
    }
  | {
      allowed: false;
      current: number | null;
      limit: number | null;
      reason: TenantQuotaDenialReason;
      resource: TenantQuotaResource;
    };

export type TenantQuotaLimits = {
  maxAppointments: number | null;
  maxCustomers: number | null;
};

const SERVER_TRUSTED_PLAN_QUOTA_LIMITS_BY_CODE = {
  'starter-care': {
    maxAppointments: 400,
    maxCustomers: 1000,
  },
  'growth-care': {
    maxAppointments: 2000,
    maxCustomers: 5000,
  },
} as const satisfies Record<string, TenantQuotaLimits>;

type ServerTrustedPlanCode = keyof typeof SERVER_TRUSTED_PLAN_QUOTA_LIMITS_BY_CODE;

function isUsableQuotaLimit(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function getTenantPlanQuotaLimitsByCode(planCode: string): TenantQuotaLimits | null {
  if (!Object.prototype.hasOwnProperty.call(SERVER_TRUSTED_PLAN_QUOTA_LIMITS_BY_CODE, planCode)) {
    return null;
  }

  return SERVER_TRUSTED_PLAN_QUOTA_LIMITS_BY_CODE[planCode as ServerTrustedPlanCode];
}

export function getTenantQuotaLimitForResource(input: {
  limits: TenantQuotaLimits;
  resource: TenantQuotaResource;
}): number | null {
  const limit =
    input.resource === 'customers' ? input.limits.maxCustomers : input.limits.maxAppointments;

  return isUsableQuotaLimit(limit) ? limit : null;
}

export function getTenantQuotaExceededReason(
  resource: TenantQuotaResource,
): Extract<
  TenantQuotaDenialReason,
  'quota_exceeded_customers' | 'quota_exceeded_appointments'
> {
  return resource === 'customers'
    ? 'quota_exceeded_customers'
    : 'quota_exceeded_appointments';
}

export function evaluateTenantQuotaForCreate(input: {
  current: number | null;
  hasActivePlan: boolean;
  limit: number | null;
  resource: TenantQuotaResource;
}): TenantQuotaDecision {
  if (!input.hasActivePlan) {
    return {
      allowed: false,
      current: null,
      limit: null,
      reason: 'missing_active_plan',
      resource: input.resource,
    };
  }

  if (!isUsableQuotaLimit(input.limit)) {
    return {
      allowed: false,
      current: null,
      limit: null,
      reason: 'missing_quota_limit',
      resource: input.resource,
    };
  }

  const current = Math.max(0, Math.trunc(input.current ?? 0));

  if (current >= input.limit) {
    return {
      allowed: false,
      current,
      limit: input.limit,
      reason: getTenantQuotaExceededReason(input.resource),
      resource: input.resource,
    };
  }

  return {
    allowed: true,
    current,
    limit: input.limit,
    resource: input.resource,
  };
}
