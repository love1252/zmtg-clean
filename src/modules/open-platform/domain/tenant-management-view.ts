import type { TenantManagementListItem } from '@/modules/open-platform/domain/tenant-management';

export type TenantExpiryStatus = 'none' | 'valid' | 'expiring_soon' | 'expired';
export type TenantAuthorizationStatus = 'normal' | 'issue';
export type TenantQuotaRiskStatus = 'none' | 'normal' | 'near_limit' | 'blocked';

export type TenantManagementFilterState = {
  keyword: string;
  tenantStatus: 'all' | string;
  planCode: 'all' | string;
  expiry: 'all' | TenantExpiryStatus;
  authorization: 'all' | TenantAuthorizationStatus;
  quotaRisk: 'all' | TenantQuotaRiskStatus;
  now: Date | string;
};

export type TenantManagementOverview = {
  total: number;
  active: number;
  trialing: number;
  expiringSoon: number;
  authorizationIssues: number;
};

type TenantViewState<TStatus extends string> = {
  status: TStatus;
  label: string;
  tone: 'slate' | 'emerald' | 'blue' | 'amber' | 'rose';
};

const dayMs = 86_400_000;

function toTime(value: string | null) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function nowTime(now: Date | string) {
  const time = typeof now === 'string' ? Date.parse(now) : now.getTime();
  return Number.isFinite(time) ? time : null;
}

function daysUntil(value: string | null, now: Date | string) {
  const target = toTime(value);
  const current = nowTime(now);
  if (target === null || current === null) return null;
  return Math.ceil((target - current) / dayMs);
}

function usageRatio(current: number | null, max: number | null) {
  if (typeof current !== 'number' || typeof max !== 'number' || max <= 0) return null;
  return current / max;
}

function allQuotaRatios(record: TenantManagementListItem) {
  return [
    usageRatio(record.currentCustomers, record.maxCustomers),
    usageRatio(record.currentAppointments, record.maxAppointments),
    usageRatio(record.currentFollowUps, record.maxFollowUps),
    usageRatio(record.currentAiCalls, record.maxAiCalls),
  ].filter((value): value is number => typeof value === 'number');
}

export function getTenantExpiryState(
  record: TenantManagementListItem,
  options: { now: Date | string },
): TenantViewState<TenantExpiryStatus> & { days: number | null } {
  const days = daysUntil(record.expiresAt, options.now);
  if (days === null) {
    return { status: 'none', label: '未设置有效期', tone: 'slate', days };
  }

  if (days < 0) {
    return { status: 'expired', label: `已过期 ${Math.abs(days)} 天`, tone: 'rose', days };
  }

  if (days <= 30) {
    return { status: 'expiring_soon', label: `${days} 天后到期`, tone: 'amber', days };
  }

  return { status: 'valid', label: '有效期正常', tone: 'emerald', days };
}

export function getTenantAuthorizationState(
  record: TenantManagementListItem,
): TenantViewState<TenantAuthorizationStatus> & { reasons: string[] } {
  const reasons = [
    !record.planCode ? '套餐缺失' : null,
    record.planStatus !== 'active' ? '套餐未启用' : null,
    record.assignmentStatus !== 'active' ? '分配异常' : null,
    !record.snapshotAt ? '快照缺失' : null,
    [record.maxCustomers, record.maxAppointments, record.maxFollowUps, record.maxAiCalls].some(
      (value) => typeof value !== 'number',
    )
      ? '配额缺失'
      : null,
  ].filter((value): value is string => Boolean(value));

  if (reasons.length > 0) {
    return { status: 'issue', label: '授权异常', tone: 'rose', reasons };
  }

  return { status: 'normal', label: '授权正常', tone: 'emerald', reasons: [] };
}

export function getTenantQuotaRiskState(
  record: TenantManagementListItem,
): TenantViewState<TenantQuotaRiskStatus> & { highestRatio: number | null } {
  const ratios = allQuotaRatios(record);
  if (ratios.length === 0) {
    return { status: 'none', label: '暂无配额', tone: 'slate', highestRatio: null };
  }

  const highestRatio = Math.max(...ratios);
  if (highestRatio >= 1) {
    return { status: 'blocked', label: '已触发阻断', tone: 'rose', highestRatio };
  }

  if (highestRatio >= 0.8) {
    return { status: 'near_limit', label: '配额风险', tone: 'amber', highestRatio };
  }

  return { status: 'normal', label: '低风险', tone: 'emerald', highestRatio };
}

export function buildTenantManagementOverview(
  records: TenantManagementListItem[],
  options: { now: Date | string },
): TenantManagementOverview {
  return records.reduce<TenantManagementOverview>(
    (overview, record) => {
      const expiry = getTenantExpiryState(record, options);
      const authorization = getTenantAuthorizationState(record);

      overview.total += 1;
      if (record.tenantStatus === 'active') overview.active += 1;
      if (record.tenantStatus === 'trialing') overview.trialing += 1;
      if (expiry.status === 'expiring_soon' || expiry.status === 'expired') overview.expiringSoon += 1;
      if (authorization.status === 'issue') overview.authorizationIssues += 1;

      return overview;
    },
    { total: 0, active: 0, trialing: 0, expiringSoon: 0, authorizationIssues: 0 },
  );
}

export function getTenantStatusLabel(status: string) {
  if (status === 'active') return '运行中';
  if (status === 'trialing') return '试用中';
  if (status === 'suspended') return '已停用';
  if (status === 'cancelled') return '已注销';
  return status;
}

export function filterTenantManagementRecords(
  records: TenantManagementListItem[],
  filters: TenantManagementFilterState,
) {
  const keyword = filters.keyword.trim().toLowerCase();

  return records.filter((record) => {
    const expiry = getTenantExpiryState(record, { now: filters.now });
    const authorization = getTenantAuthorizationState(record);
    const quotaRisk = getTenantQuotaRiskState(record);
    const searchable = [record.tenantName, record.tenantId, record.planName, record.planCode]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (keyword && !searchable.includes(keyword)) return false;
    if (filters.tenantStatus !== 'all' && record.tenantStatus !== filters.tenantStatus) return false;
    if (filters.planCode !== 'all' && record.planCode !== filters.planCode) return false;
    if (filters.expiry !== 'all' && expiry.status !== filters.expiry) return false;
    if (filters.authorization !== 'all' && authorization.status !== filters.authorization) return false;
    if (filters.quotaRisk !== 'all' && quotaRisk.status !== filters.quotaRisk) return false;

    return true;
  });
}
