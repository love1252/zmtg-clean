export const tenantManagementDtoFields = [
  'tenantId',
  'tenantName',
  'tenantStatus',
  'planName',
  'planCode',
  'planStatus',
  'assignmentStatus',
  'startedAt',
  'expiresAt',
  'maxCustomers',
  'maxAppointments',
  'maxFollowUps',
  'maxAiCalls',
  'currentCustomers',
  'currentAppointments',
  'currentFollowUps',
  'currentAiCalls',
  'snapshotAt',
] as const;

export type TenantManagementDtoField = (typeof tenantManagementDtoFields)[number];

export type TenantManagementRecord = {
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
  planName: string | null;
  planCode: string | null;
  planStatus: string | null;
  assignmentStatus: string | null;
  startedAt: Date | string | null;
  expiresAt: Date | string | null;
  maxCustomers: number | null;
  maxAppointments: number | null;
  maxFollowUps: number | null;
  maxAiCalls: number | null;
  currentCustomers: number | null;
  currentAppointments: number | null;
  currentFollowUps: number | null;
  currentAiCalls: number | null;
  snapshotAt: Date | string | null;
};

export type TenantManagementListItem = {
  [field in TenantManagementDtoField]: field extends
    | 'maxCustomers'
    | 'maxAppointments'
    | 'maxFollowUps'
    | 'maxAiCalls'
    | 'currentCustomers'
    | 'currentAppointments'
    | 'currentFollowUps'
    | 'currentAiCalls'
    ? number | null
    : string | null;
} & {
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
};

function toIsoString(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function mapTenantManagementRecordToDto(
  record: TenantManagementRecord,
): TenantManagementListItem {
  return {
    tenantId: record.tenantId,
    tenantName: record.tenantName,
    tenantStatus: record.tenantStatus,
    planName: record.planName,
    planCode: record.planCode,
    planStatus: record.planStatus,
    assignmentStatus: record.assignmentStatus,
    startedAt: toIsoString(record.startedAt),
    expiresAt: toIsoString(record.expiresAt),
    maxCustomers: record.maxCustomers,
    maxAppointments: record.maxAppointments,
    maxFollowUps: record.maxFollowUps,
    maxAiCalls: record.maxAiCalls,
    currentCustomers: record.currentCustomers,
    currentAppointments: record.currentAppointments,
    currentFollowUps: record.currentFollowUps,
    currentAiCalls: record.currentAiCalls,
    snapshotAt: toIsoString(record.snapshotAt),
  };
}
