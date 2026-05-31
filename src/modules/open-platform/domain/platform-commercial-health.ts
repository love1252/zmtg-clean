import type { AuditEventListItem } from '@/modules/audit/domain/audit-event-query';
import type { TenantManagementListItem } from '@/modules/open-platform/domain/tenant-management';

export const COMMERCIAL_HEALTH_QUOTA_RISK_THRESHOLD = 0.8;
export const COMMERCIAL_HEALTH_QUOTA_LIMIT_REACHED_THRESHOLD = 1;
export const COMMERCIAL_HEALTH_STALE_SNAPSHOT_DAYS = 7;

const quotaDefinitions = [
  {
    key: 'customers',
    label: '客户',
    limitField: 'maxCustomers',
    currentField: 'currentCustomers',
  },
  {
    key: 'appointments',
    label: '预约',
    limitField: 'maxAppointments',
    currentField: 'currentAppointments',
  },
  {
    key: 'followUps',
    label: '随访',
    limitField: 'maxFollowUps',
    currentField: 'currentFollowUps',
  },
  {
    key: 'aiCalls',
    label: 'AI 调用',
    limitField: 'maxAiCalls',
    currentField: 'currentAiCalls',
  },
] as const;

const quotaDeniedReasons = [
  'missing_active_plan',
  'missing_quota_limit',
  'quota_exceeded_appointments',
  'quota_exceeded_customers',
] as const;

export type CommercialQuotaKey = (typeof quotaDefinitions)[number]['key'];
export type CommercialQuotaRiskStatus = 'near_limit' | 'limit_reached';
export type CommercialMissingConfigurationKey =
  | 'missing_active_plan'
  | 'missing_quota_limit'
  | 'missing_quota_snapshot'
  | 'stale_quota_snapshot';
export type CommercialQuotaDeniedReason = (typeof quotaDeniedReasons)[number];
type CommercialQuotaDeniedAuditEvent = AuditEventListItem & {
  result: 'denied';
  reason: CommercialQuotaDeniedReason;
};

export type PlatformCommercialSummaryCard = {
  key:
    | 'tenant_total'
    | 'active_plan_coverage_rate'
    | 'quota_risk_items'
    | 'missing_configuration_tenants'
    | 'quota_denied_events';
  label: string;
  value: number;
};

export type PlatformCommercialPlanCoverage = {
  tenantTotal: number;
  activePlanTenantCount: number;
  missingActivePlanTenantCount: number;
  coverageRate: number;
};

export type PlatformCommercialQuotaRiskTenant = {
  tenantId: string;
  tenantName: string;
  quotaKey: CommercialQuotaKey;
  quotaLabel: string;
  currentSnapshotUsage: number;
  quotaLimit: number;
  usageRatio: number;
  status: CommercialQuotaRiskStatus;
  snapshotAt: string;
  source: 'tenant_quota_snapshot_operational_reference';
  operationalReferenceOnly: true;
};

export type PlatformCommercialMissingConfigurationReason = {
  key: CommercialMissingConfigurationKey;
  label: string;
  quotaKeys?: CommercialQuotaKey[];
};

export type PlatformCommercialMissingConfigurationTenant = {
  tenantId: string;
  tenantName: string;
  snapshotAt: string | null;
  reasons: PlatformCommercialMissingConfigurationReason[];
};

export type PlatformCommercialQuotaDeniedSignals = {
  totalCount: number;
  latestOccurredAt: string | null;
  byReason: Array<{ reason: CommercialQuotaDeniedReason; count: number }>;
  byResource: Array<{ resource: AuditEventListItem['resource']; count: number }>;
};

export type PlatformCommercialSnapshotHealth = {
  totalTenants: number;
  withSnapshotTenantCount: number;
  missingSnapshotTenantCount: number;
  staleSnapshotTenantCount: number;
  staleSnapshotDays: number;
  operationalReferenceOnly: true;
};

export type PlatformCommercialHealthViewModel = {
  summaryCards: PlatformCommercialSummaryCard[];
  planCoverage: PlatformCommercialPlanCoverage;
  riskTenants: PlatformCommercialQuotaRiskTenant[];
  missingConfigurationTenants: PlatformCommercialMissingConfigurationTenant[];
  quotaDeniedSignals: PlatformCommercialQuotaDeniedSignals;
  snapshotHealth: PlatformCommercialSnapshotHealth;
  lastUpdatedAt: string;
};

export type BuildPlatformCommercialHealthViewModelInput = {
  tenants: TenantManagementListItem[];
  auditEvents: AuditEventListItem[];
  now?: Date | string;
};

function toIsoString(value: Date | string | undefined) {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function roundRatio(value: number) {
  return Math.round(value * 10000) / 10000;
}

function isActivePlan(tenant: TenantManagementListItem) {
  return (
    tenant.planStatus === 'active' &&
    tenant.assignmentStatus === 'active' &&
    typeof tenant.planCode === 'string' &&
    tenant.planCode.trim().length > 0
  );
}

function isQuotaDeniedReason(reason: AuditEventListItem['reason']): reason is CommercialQuotaDeniedReason {
  return (quotaDeniedReasons as readonly string[]).includes(reason);
}

function isQuotaDeniedAuditEvent(
  event: AuditEventListItem,
): event is CommercialQuotaDeniedAuditEvent {
  return event.result === 'denied' && isQuotaDeniedReason(event.reason);
}

function isStaleSnapshot(snapshotAt: string | null, nowIso: string) {
  if (!snapshotAt) return false;

  const snapshotTime = Date.parse(snapshotAt);
  const nowTime = Date.parse(nowIso);
  if (!Number.isFinite(snapshotTime) || !Number.isFinite(nowTime)) {
    return true;
  }

  const staleAfterMs = COMMERCIAL_HEALTH_STALE_SNAPSHOT_DAYS * 24 * 60 * 60 * 1000;
  return nowTime - snapshotTime > staleAfterMs;
}

function compareCountRows<T extends { count: number }>(
  getKey: (item: T) => string,
  left: T,
  right: T,
) {
  return right.count - left.count || getKey(left).localeCompare(getKey(right));
}

function createSummaryCards(input: {
  tenantTotal: number;
  coverageRate: number;
  quotaRiskItems: number;
  missingConfigurationTenants: number;
  quotaDeniedEvents: number;
}): PlatformCommercialSummaryCard[] {
  return [
    { key: 'tenant_total', label: '租户总数', value: input.tenantTotal },
    {
      key: 'active_plan_coverage_rate',
      label: '套餐覆盖率',
      value: input.coverageRate,
    },
    { key: 'quota_risk_items', label: '配额风险项', value: input.quotaRiskItems },
    {
      key: 'missing_configuration_tenants',
      label: '配置缺失租户',
      value: input.missingConfigurationTenants,
    },
    { key: 'quota_denied_events', label: '近期 quota denied', value: input.quotaDeniedEvents },
  ];
}

function deriveQuotaRisks(tenants: TenantManagementListItem[]) {
  const riskTenants: PlatformCommercialQuotaRiskTenant[] = [];

  for (const tenant of tenants) {
    if (!tenant.snapshotAt) continue;

    for (const quota of quotaDefinitions) {
      const quotaLimit = tenant[quota.limitField];
      const currentSnapshotUsage = tenant[quota.currentField];
      if (
        typeof quotaLimit !== 'number' ||
        typeof currentSnapshotUsage !== 'number' ||
        quotaLimit < 0 ||
        currentSnapshotUsage < 0
      ) {
        continue;
      }

      if (quotaLimit === 0 && currentSnapshotUsage === 0) {
        continue;
      }

      const usageRatio = quotaLimit === 0 ? 1 : roundRatio(currentSnapshotUsage / quotaLimit);
      if (usageRatio < COMMERCIAL_HEALTH_QUOTA_RISK_THRESHOLD) {
        continue;
      }

      riskTenants.push({
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName,
        quotaKey: quota.key,
        quotaLabel: quota.label,
        currentSnapshotUsage,
        quotaLimit,
        usageRatio,
        status:
          usageRatio >= COMMERCIAL_HEALTH_QUOTA_LIMIT_REACHED_THRESHOLD
            ? 'limit_reached'
            : 'near_limit',
        snapshotAt: tenant.snapshotAt,
        source: 'tenant_quota_snapshot_operational_reference',
        operationalReferenceOnly: true,
      });
    }
  }

  return riskTenants.sort((left, right) => {
    const statusRank: Record<CommercialQuotaRiskStatus, number> = {
      limit_reached: 0,
      near_limit: 1,
    };
    return (
      statusRank[left.status] - statusRank[right.status] ||
      right.usageRatio - left.usageRatio ||
      left.tenantName.localeCompare(right.tenantName) ||
      left.quotaKey.localeCompare(right.quotaKey)
    );
  });
}

function deriveMissingConfigurations(tenants: TenantManagementListItem[], nowIso: string) {
  const missingConfigurationTenants: PlatformCommercialMissingConfigurationTenant[] = [];

  for (const tenant of tenants) {
    const reasons: PlatformCommercialMissingConfigurationReason[] = [];
    if (!isActivePlan(tenant)) {
      reasons.push({ key: 'missing_active_plan', label: '缺少 active plan' });
    }

    const missingQuotaKeys = quotaDefinitions
      .filter((quota) => tenant[quota.limitField] == null)
      .map((quota) => quota.key);
    if (missingQuotaKeys.length > 0) {
      reasons.push({
        key: 'missing_quota_limit',
        label: '缺少 quota limit',
        quotaKeys: missingQuotaKeys,
      });
    }

    if (!tenant.snapshotAt) {
      reasons.push({ key: 'missing_quota_snapshot', label: '缺少 quota snapshot' });
    } else if (isStaleSnapshot(tenant.snapshotAt, nowIso)) {
      reasons.push({ key: 'stale_quota_snapshot', label: 'quota snapshot 过旧' });
    }

    if (reasons.length === 0) continue;

    missingConfigurationTenants.push({
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName,
      snapshotAt: tenant.snapshotAt,
      reasons,
    });
  }

  return missingConfigurationTenants.sort(
    (left, right) =>
      left.tenantName.localeCompare(right.tenantName) || left.tenantId.localeCompare(right.tenantId),
  );
}

function deriveQuotaDeniedSignals(auditEvents: AuditEventListItem[]) {
  const quotaDeniedEvents = auditEvents.filter(isQuotaDeniedAuditEvent);
  const reasonCounts = new Map<CommercialQuotaDeniedReason, number>();
  const resourceCounts = new Map<AuditEventListItem['resource'], number>();
  let latestOccurredAt: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const event of quotaDeniedEvents) {
    reasonCounts.set(event.reason, (reasonCounts.get(event.reason) ?? 0) + 1);
    resourceCounts.set(event.resource, (resourceCounts.get(event.resource) ?? 0) + 1);

    const occurredAtTime = Date.parse(event.occurredAt);
    if (Number.isFinite(occurredAtTime) && occurredAtTime > latestTime) {
      latestTime = occurredAtTime;
      latestOccurredAt = event.occurredAt;
    }
  }

  return {
    totalCount: quotaDeniedEvents.length,
    latestOccurredAt,
    byReason: [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => compareCountRows((item) => item.reason, left, right)),
    byResource: [...resourceCounts.entries()]
      .map(([resource, count]) => ({ resource, count }))
      .sort((left, right) => compareCountRows((item) => item.resource, left, right)),
  } satisfies PlatformCommercialQuotaDeniedSignals;
}

export function buildPlatformCommercialHealthViewModel(
  input: BuildPlatformCommercialHealthViewModelInput,
): PlatformCommercialHealthViewModel {
  const nowIso = toIsoString(input.now);
  const tenantTotal = input.tenants.length;
  const activePlanTenantCount = input.tenants.filter(isActivePlan).length;
  const missingActivePlanTenantCount = tenantTotal - activePlanTenantCount;
  const coverageRate = tenantTotal === 0 ? 0 : roundRatio(activePlanTenantCount / tenantTotal);
  const riskTenants = deriveQuotaRisks(input.tenants);
  const missingConfigurationTenants = deriveMissingConfigurations(input.tenants, nowIso);
  const quotaDeniedSignals = deriveQuotaDeniedSignals(input.auditEvents);
  const missingSnapshotTenantCount = input.tenants.filter((tenant) => !tenant.snapshotAt).length;
  const staleSnapshotTenantCount = input.tenants.filter(
    (tenant) => tenant.snapshotAt && isStaleSnapshot(tenant.snapshotAt, nowIso),
  ).length;

  return {
    summaryCards: createSummaryCards({
      tenantTotal,
      coverageRate,
      quotaRiskItems: riskTenants.length,
      missingConfigurationTenants: missingConfigurationTenants.length,
      quotaDeniedEvents: quotaDeniedSignals.totalCount,
    }),
    planCoverage: {
      tenantTotal,
      activePlanTenantCount,
      missingActivePlanTenantCount,
      coverageRate,
    },
    riskTenants,
    missingConfigurationTenants,
    quotaDeniedSignals,
    snapshotHealth: {
      totalTenants: tenantTotal,
      withSnapshotTenantCount: tenantTotal - missingSnapshotTenantCount,
      missingSnapshotTenantCount,
      staleSnapshotTenantCount,
      staleSnapshotDays: COMMERCIAL_HEALTH_STALE_SNAPSHOT_DAYS,
      operationalReferenceOnly: true,
    },
    lastUpdatedAt: nowIso,
  };
}
