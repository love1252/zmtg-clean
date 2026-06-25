export const tenantManagementDtoFields = [
  'tenantId',
  'tenantName',
  'tenantStatus',
  'createdAt',
  'updatedAt',
  'planName',
  'planCode',
  'planStatus',
  'planVersionId',
  'planVersionCode',
  'planDisplayName',
  'planDisplayPrice',
  'assignmentStatus',
  'startedAt',
  'expiresAt',
  'agentLimit',
  'seatLimit',
  'monthlyAiCallLimit',
  'knowledgeStorageGb',
  'connectorEntitlements',
  'serviceEntitlements',
  'authorizationSnapshotId',
  'authorizationSnapshotStatus',
  'authorizationGeneratedAt',
  'openingContact',
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

export type TenantOpeningContact = {
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  adminName: string | null;
  adminAccount: string | null;
  adminContact: string | null;
};

export type TenantManagementRecord = {
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  planName: string | null;
  planCode: string | null;
  planStatus: string | null;
  planVersionId: string | null;
  planVersionCode: string | null;
  planDisplayName: string | null;
  planDisplayPrice: string | null;
  assignmentStatus: string | null;
  startedAt: Date | string | null;
  expiresAt: Date | string | null;
  agentLimit: number | null;
  seatLimit: number | null;
  monthlyAiCallLimit: number | null;
  knowledgeStorageGb: number | null;
  connectorEntitlements: string[];
  serviceEntitlements: string[];
  authorizationSnapshotId: string | null;
  authorizationSnapshotStatus: string | null;
  authorizationGeneratedAt: Date | string | null;
  openingContact?: TenantOpeningContact | null;
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

type TenantManagementScalarDtoField = Exclude<TenantManagementDtoField, 'openingContact'>;

export type TenantManagementListItem = {
  [field in TenantManagementScalarDtoField]: field extends
    | 'maxCustomers'
    | 'maxAppointments'
    | 'maxFollowUps'
    | 'maxAiCalls'
    | 'currentCustomers'
    | 'currentAppointments'
    | 'currentFollowUps'
    | 'currentAiCalls'
    | 'agentLimit'
    | 'seatLimit'
    | 'monthlyAiCallLimit'
    | 'knowledgeStorageGb'
    ? number | null
    : field extends 'connectorEntitlements' | 'serviceEntitlements'
      ? string[]
    : string | null;
} & {
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
  createdAt: string;
  updatedAt: string;
  openingContact: TenantOpeningContact | null;
};

function toIsoString(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizeStringList(value: string[]) {
  return value.filter((item) => item.trim().length > 0);
}

function readOpeningContactText(input: Record<string, unknown>, key: keyof TenantOpeningContact) {
  const value = input[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function normalizeTenantOpeningContact(input: unknown): TenantOpeningContact | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const payload = input as Record<string, unknown>;
  const openingContact: TenantOpeningContact = {
    contactName: readOpeningContactText(payload, 'contactName'),
    contactPhone: readOpeningContactText(payload, 'contactPhone'),
    contactEmail: readOpeningContactText(payload, 'contactEmail'),
    adminName: readOpeningContactText(payload, 'adminName'),
    adminAccount: readOpeningContactText(payload, 'adminAccount'),
    adminContact: readOpeningContactText(payload, 'adminContact'),
  };
  return Object.values(openingContact).some(Boolean) ? openingContact : null;
}

export function mapTenantManagementRecordToDto(
  record: TenantManagementRecord,
): TenantManagementListItem {
  return {
    tenantId: record.tenantId,
    tenantName: record.tenantName,
    tenantStatus: record.tenantStatus,
    createdAt: toIsoString(record.createdAt) ?? '',
    updatedAt: toIsoString(record.updatedAt) ?? '',
    planName: record.planName,
    planCode: record.planCode,
    planStatus: record.planStatus,
    planVersionId: record.planVersionId,
    planVersionCode: record.planVersionCode,
    planDisplayName: record.planDisplayName,
    planDisplayPrice: record.planDisplayPrice,
    assignmentStatus: record.assignmentStatus,
    startedAt: toIsoString(record.startedAt),
    expiresAt: toIsoString(record.expiresAt),
    agentLimit: record.agentLimit,
    seatLimit: record.seatLimit,
    monthlyAiCallLimit: record.monthlyAiCallLimit,
    knowledgeStorageGb: record.knowledgeStorageGb,
    connectorEntitlements: normalizeStringList(record.connectorEntitlements),
    serviceEntitlements: normalizeStringList(record.serviceEntitlements),
    authorizationSnapshotId: record.authorizationSnapshotId,
    authorizationSnapshotStatus: record.authorizationSnapshotStatus,
    authorizationGeneratedAt: toIsoString(record.authorizationGeneratedAt),
    openingContact: normalizeTenantOpeningContact(record.openingContact),
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
