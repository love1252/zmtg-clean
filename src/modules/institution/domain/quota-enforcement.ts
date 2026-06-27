export const TENANT_QUOTA_RESOURCES = [
  'customers',
  'appointments',
  'knowledge_files',
  'staff_seats',
  'ai_calls',
] as const;

export type TenantQuotaResource = (typeof TENANT_QUOTA_RESOURCES)[number];

export type TenantQuotaDenialReason =
  | 'quota_exceeded_customers'
  | 'quota_exceeded_appointments'
  | 'quota_exceeded_knowledge_files'
  | 'quota_exceeded_staff_seats'
  | 'quota_exceeded_ai_calls'
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
  maxKnowledgeFiles: number | null;
  maxStaffSeats: number | null;
  maxAiCalls: number | null;
};

const SERVER_TRUSTED_PLAN_QUOTA_LIMITS_BY_CODE = {
  'trial-care': {
    maxAppointments: 120,
    maxCustomers: 80,
    maxKnowledgeFiles: 20,
    maxStaffSeats: 5,
    maxAiCalls: 100,
  },
  'starter-care': {
    maxAppointments: 400,
    maxCustomers: 1000,
    maxKnowledgeFiles: 100,
    maxStaffSeats: 20,
    maxAiCalls: 500,
  },
  'growth-care': {
    maxAppointments: 2000,
    maxCustomers: 5000,
    maxKnowledgeFiles: 500,
    maxStaffSeats: 100,
    maxAiCalls: 2500,
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
  let limit: number | null;

  switch (input.resource) {
    case 'customers':
      limit = input.limits.maxCustomers;
      break;
    case 'appointments':
      limit = input.limits.maxAppointments;
      break;
    case 'knowledge_files':
      limit = input.limits.maxKnowledgeFiles;
      break;
    case 'staff_seats':
      limit = input.limits.maxStaffSeats;
      break;
    case 'ai_calls':
      limit = input.limits.maxAiCalls;
      break;
    default:
      limit = null;
  }

  return isUsableQuotaLimit(limit) ? limit : null;
}

export function getTenantQuotaExceededReason(
  resource: TenantQuotaResource,
): Extract<
  TenantQuotaDenialReason,
  | 'quota_exceeded_customers'
  | 'quota_exceeded_appointments'
  | 'quota_exceeded_knowledge_files'
  | 'quota_exceeded_staff_seats'
  | 'quota_exceeded_ai_calls'
> {
  switch (resource) {
    case 'customers':
      return 'quota_exceeded_customers';
    case 'appointments':
      return 'quota_exceeded_appointments';
    case 'knowledge_files':
      return 'quota_exceeded_knowledge_files';
    case 'staff_seats':
      return 'quota_exceeded_staff_seats';
    case 'ai_calls':
      return 'quota_exceeded_ai_calls';
  }
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
