export type TenantPlanPublishedVersionRecord = {
  planId: string;
  planCode: string;
  planName: string;
  planStatus: string;
  versionId: string;
  versionCode: string;
  status: string;
  displayName: string;
  displayPrice: string;
  priceNote: string;
  agentLimit: number | null;
  seatLimit: number | null;
  monthlyAiCallLimit: number | null;
  knowledgeStorageGb: number | null;
  connectorEntitlementsJson: unknown;
  serviceEntitlementsJson: unknown;
  featureEntitlementsJson: unknown;
  quotaEntitlementsJson: unknown;
};

export type TenantPlanOptionDto = {
  planId: string;
  planCode: string;
  planName: string;
  planVersionId: string;
  versionCode: string;
  displayName: string;
  displayPrice: string;
  priceNote: string;
  agentLimit: number | null;
  seatLimit: number | null;
  monthlyAiCallLimit: number | null;
  knowledgeStorageGb: number | null;
  connectorEntitlements: string[];
  serviceEntitlements: string[];
};

export type CreateTenantWithPlanPayload = {
  tenantName: string;
  planVersionId: string;
  reason: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  adminName?: string;
  adminAccount?: string;
  adminContact?: string;
};

export type CreateTenantWithPlanParseResult =
  | { ok: true; value: CreateTenantWithPlanPayload }
  | { ok: false; errors: string[] };

export type AuthorizationSnapshotPayload = {
  snapshotJson: {
    planId: string;
    planCode: string;
    planName: string;
    planVersionId: string;
    versionCode: string;
    displayName: string;
    displayPrice: string;
  };
  quotaJson: {
    agentLimit: number | null;
    seatLimit: number | null;
    monthlyAiCallLimit: number | null;
    knowledgeStorageGb: number | null;
  };
  connectorJson: { connectors: string[] };
  serviceJson: { services: string[] };
};

function isJsonObject(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

function readText(input: Record<string, unknown>, key: string) {
  const value = input[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readOptionalText(input: Record<string, unknown>, key: string) {
  const value = readText(input, key);
  return value.length > 0 ? value : undefined;
}

function readStringList(json: unknown, key: string) {
  if (!isJsonObject(json)) return [];
  const value = json[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

export function parseCreateTenantWithPlanPayload(input: unknown): CreateTenantWithPlanParseResult {
  const payload = isJsonObject(input) ? input : {};
  const tenantName = readText(payload, 'organizationName') || readText(payload, 'tenantName');
  const planVersionId = readText(payload, 'planVersionId');
  const reason = readText(payload, 'reason');
  const errors: string[] = [];

  if (!tenantName) errors.push('TENANT_NAME_REQUIRED');
  if (!planVersionId) errors.push('PLAN_VERSION_REQUIRED');
  if (!reason) errors.push('REASON_REQUIRED');

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      tenantName,
      planVersionId,
      reason,
      contactName: readOptionalText(payload, 'contactName'),
      contactPhone: readOptionalText(payload, 'contactPhone'),
      contactEmail: readOptionalText(payload, 'contactEmail'),
      adminName: readOptionalText(payload, 'adminName'),
      adminAccount: readOptionalText(payload, 'adminAccount'),
      adminContact: readOptionalText(payload, 'adminContact'),
    },
  };
}

export function mapPublishedPlanVersionToOption(
  record: TenantPlanPublishedVersionRecord,
): TenantPlanOptionDto {
  return {
    planId: record.planId,
    planCode: record.planCode,
    planName: record.planName,
    planVersionId: record.versionId,
    versionCode: record.versionCode,
    displayName: record.displayName,
    displayPrice: record.displayPrice,
    priceNote: record.priceNote,
    agentLimit: record.agentLimit,
    seatLimit: record.seatLimit,
    monthlyAiCallLimit: record.monthlyAiCallLimit,
    knowledgeStorageGb: record.knowledgeStorageGb,
    connectorEntitlements: readStringList(record.connectorEntitlementsJson, 'connectors'),
    serviceEntitlements: readStringList(record.serviceEntitlementsJson, 'services'),
  };
}

export function buildAuthorizationSnapshotPayload(
  record: TenantPlanPublishedVersionRecord,
): AuthorizationSnapshotPayload {
  return {
    snapshotJson: {
      planId: record.planId,
      planCode: record.planCode,
      planName: record.planName,
      planVersionId: record.versionId,
      versionCode: record.versionCode,
      displayName: record.displayName,
      displayPrice: record.displayPrice,
    },
    quotaJson: {
      agentLimit: record.agentLimit,
      seatLimit: record.seatLimit,
      monthlyAiCallLimit: record.monthlyAiCallLimit,
      knowledgeStorageGb: record.knowledgeStorageGb,
    },
    connectorJson: {
      connectors: readStringList(record.connectorEntitlementsJson, 'connectors'),
    },
    serviceJson: {
      services: readStringList(record.serviceEntitlementsJson, 'services'),
    },
  };
}

export function isTrialPlanVersion(record: TenantPlanPublishedVersionRecord) {
  return (
    record.planCode.toLowerCase().includes('trial') ||
    record.planName.includes('试用') ||
    record.displayName.includes('试用')
  );
}

export function calculateTrialExpiresAt(startedAt: Date, durationDays = 10) {
  return new Date(startedAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
}

export function buildOpeningContactSnapshot(payload: CreateTenantWithPlanPayload) {
  const contact = {
    contactName: payload.contactName,
    contactPhone: payload.contactPhone,
    contactEmail: payload.contactEmail,
    adminName: payload.adminName,
    adminAccount: payload.adminAccount,
    adminContact: payload.adminContact,
  };
  const entries = Object.entries(contact).filter(([, value]) => Boolean(value));
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export function buildSecurityBoundarySnapshot() {
  return {
    contactFields: 'business_contact_fields_only',
    passwordStorage: 'no_plaintext_password',
    diagnosticMode: 'controlled_short_lived_redacted',
  };
}
