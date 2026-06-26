export const tenantCommercialRecordTypes = [
  'order',
  'contract',
  'invoice',
  'payment',
  'tenant_opening',
  'account_opening',
  'plan_binding',
  'plan_change',
  'account_status_change',
] as const;
export const tenantCommercialRecordStatuses = [
  'draft',
  'pending',
  'manual_review',
  'completed',
  'cancelled',
] as const;

export type TenantCommercialRecordType = (typeof tenantCommercialRecordTypes)[number];
export type TenantCommercialRecordStatus = (typeof tenantCommercialRecordStatuses)[number];

export type TenantCommercialRecord = {
  id: string;
  tenantId: string;
  recordType: string;
  status: string;
  displayCode: string;
  displayAmount: string | null;
  periodLabel: string | null;
  relatedPlanChangeId: string | null;
  occurredAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type TenantCommercialRecordDto = {
  recordId: string;
  tenantId: string;
  recordType: TenantCommercialRecordType;
  recordTypeLabel: string;
  status: TenantCommercialRecordStatus;
  statusLabel: string;
  displayCode: string;
  displayAmount: string | null;
  periodLabel: string | null;
  relatedPlanChangeId: string | null;
  occurredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TenantCommercialRecordOverview = {
  total: number;
  byType: Record<TenantCommercialRecordType, number>;
  byStatus: Record<TenantCommercialRecordStatus, number>;
};

const recordTypeLabels: Record<TenantCommercialRecordType, string> = {
  order: '订单',
  contract: '合同',
  invoice: '发票',
  payment: '支付',
  tenant_opening: '机构开通',
  account_opening: '账号开通',
  plan_binding: '套餐绑定',
  plan_change: '套餐变更',
  account_status_change: '账号状态变更',
};

const statusLabels: Record<TenantCommercialRecordStatus, string> = {
  draft: '预留草稿',
  pending: '待人工确认',
  manual_review: '人工复核',
  completed: '已人工确认',
  cancelled: '已取消',
};

function normalizeRecordType(value: string): TenantCommercialRecordType {
  return tenantCommercialRecordTypes.includes(value as TenantCommercialRecordType)
    ? (value as TenantCommercialRecordType)
    : 'order';
}

function normalizeStatus(value: string): TenantCommercialRecordStatus {
  return tenantCommercialRecordStatuses.includes(value as TenantCommercialRecordStatus)
    ? (value as TenantCommercialRecordStatus)
    : 'draft';
}

function toIsoString(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function createTypeCounts(): Record<TenantCommercialRecordType, number> {
  return {
    order: 0,
    contract: 0,
    invoice: 0,
    payment: 0,
    tenant_opening: 0,
    account_opening: 0,
    plan_binding: 0,
    plan_change: 0,
    account_status_change: 0,
  };
}

function createStatusCounts(): Record<TenantCommercialRecordStatus, number> {
  return {
    draft: 0,
    pending: 0,
    manual_review: 0,
    completed: 0,
    cancelled: 0,
  };
}

export function mapTenantCommercialRecordToDto(
  record: TenantCommercialRecord,
): TenantCommercialRecordDto {
  const recordType = normalizeRecordType(record.recordType);
  const status = normalizeStatus(record.status);

  return {
    recordId: record.id,
    tenantId: record.tenantId,
    recordType,
    recordTypeLabel: recordTypeLabels[recordType],
    status,
    statusLabel: statusLabels[status],
    displayCode: record.displayCode,
    displayAmount: record.displayAmount,
    periodLabel: record.periodLabel,
    relatedPlanChangeId: record.relatedPlanChangeId,
    occurredAt: toIsoString(record.occurredAt),
    createdAt: toIsoString(record.createdAt) ?? '',
    updatedAt: toIsoString(record.updatedAt) ?? '',
  };
}

export function buildTenantCommercialRecordOverview(
  records: TenantCommercialRecordDto[],
): TenantCommercialRecordOverview {
  const byType = createTypeCounts();
  const byStatus = createStatusCounts();

  records.forEach((record) => {
    byType[record.recordType] += 1;
    byStatus[record.status] += 1;
  });

  return {
    total: records.length,
    byType,
    byStatus,
  };
}
