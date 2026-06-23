export type PlanCatalogVersionStatus = 'draft' | 'published' | 'retired';

export type PlanCatalogVersionRecord = {
  versionId: string;
  planId: string;
  versionCode: string;
  status: PlanCatalogVersionStatus;
  displayName: string;
  displayPrice: string;
  priceNote: string;
  agentLimit: number | null;
  seatLimit: number | null;
  monthlyAiCallLimit: number | null;
  knowledgeStorageGb: number | null;
  connectorEntitlementsJson: Record<string, unknown>;
  serviceEntitlementsJson: Record<string, unknown>;
  featureEntitlementsJson: Record<string, unknown>;
  quotaEntitlementsJson: Record<string, unknown>;
  changeSummary: string;
  createdBy: string;
  updatedBy: string;
  publishedBy: string | null;
  publishedAt: Date | string | null;
  retiredAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type PlanCatalogRecord = {
  planId: string;
  planName: string;
  planCode: string;
  planDescription: string;
  planStatus: string;
  versions: PlanCatalogVersionRecord[];
};

export type PlanVersionDraftPayload = {
  versionCode: string;
  displayName: string;
  displayPrice: string;
  priceNote: string;
  agentLimit: number | null;
  seatLimit: number | null;
  monthlyAiCallLimit: number | null;
  knowledgeStorageGb: number | null;
  connectorEntitlementsJson: Record<string, unknown>;
  serviceEntitlementsJson: Record<string, unknown>;
  featureEntitlementsJson: Record<string, unknown>;
  quotaEntitlementsJson: Record<string, unknown>;
  changeSummary: string;
};

export type PlanVersionDraftParseResult =
  | { ok: true; value: PlanVersionDraftPayload }
  | { ok: false; errors: string[] };

type SanitizedJson = string | number | boolean | null | SanitizedJson[] | { [key: string]: SanitizedJson };

const sensitiveKeyOrValuePattern =
  /(payment_token|webhook_secret|card_number|contract_body|invoice_tax_no|client_secret|api_key|apikey|encrypted_api_key|ciphertext|auth_tag|token|secret|database_url|postgres:\/\/|mysql:\/\/|sql\b|stack|sk_test|sk_live)/i;

const realPaymentTextPattern =
  /(真实支付|真实扣费|立即支付|自动扣费|自动续费|银行卡|第三方支付|stripe|支付宝|微信支付|支付\s*token)/i;

function toIsoString(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function sanitizeJsonValue(value: unknown): SanitizedJson | undefined {
  if (value === null) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (sensitiveKeyOrValuePattern.test(value)) return undefined;
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeJsonValue(item))
      .filter((item): item is SanitizedJson => item !== undefined);
  }
  if (typeof value === 'object' && value) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !sensitiveKeyOrValuePattern.test(key))
        .map(([key, nestedValue]) => [key, sanitizeJsonValue(nestedValue)] as const)
        .filter((entry): entry is readonly [string, SanitizedJson] => entry[1] !== undefined),
    );
  }

  return undefined;
}

function sanitizeJsonRecord(value: unknown): Record<string, SanitizedJson> {
  const sanitized = sanitizeJsonValue(value);
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) return {};
  return sanitized;
}

function hasSensitiveJson(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return sensitiveKeyOrValuePattern.test(value);
  if (typeof value === 'number' || typeof value === 'boolean') return false;
  if (Array.isArray(value)) return value.some(hasSensitiveJson);
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, nestedValue]) => sensitiveKeyOrValuePattern.test(key) || hasSensitiveJson(nestedValue),
    );
  }
  return true;
}

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateRequiredText(
  value: string,
  fieldName: string,
  maxLength: number,
  errors: string[],
) {
  if (!value) {
    errors.push(`${fieldName} 不能为空`);
  } else if (value.length > maxLength) {
    errors.push(`${fieldName} 不能超过 ${maxLength} 个字符`);
  }
}

function parseNullableNonNegativeInteger(value: unknown, fieldName: string, errors: string[]) {
  if (value === undefined || value === null || value === '') return null;
  if (!Number.isInteger(value) || (value as number) < 0) {
    errors.push(`${fieldName} 必须是非负整数或 null`);
    return null;
  }
  return value as number;
}

function validateEntitlementJson(value: unknown, fieldName: string, errors: string[]) {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${fieldName} 必须是对象`);
    return {};
  }
  if (hasSensitiveJson(value)) {
    errors.push(`${fieldName} 不能包含敏感键或敏感值`);
    return {};
  }
  return value as Record<string, unknown>;
}

export function parsePlanVersionDraftPayload(payload: unknown): PlanVersionDraftParseResult {
  const input = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const errors: string[] = [];

  const versionCode = trimString(input.versionCode);
  const displayName = trimString(input.displayName);
  const displayPrice = trimString(input.displayPrice);
  const priceNote = trimString(input.priceNote);
  const changeSummary = trimString(input.changeSummary);
  const agentLimit = parseNullableNonNegativeInteger(input.agentLimit, 'agentLimit', errors);
  const seatLimit = parseNullableNonNegativeInteger(input.seatLimit, 'seatLimit', errors);
  const monthlyAiCallLimit = parseNullableNonNegativeInteger(
    input.monthlyAiCallLimit,
    'monthlyAiCallLimit',
    errors,
  );
  const knowledgeStorageGb = parseNullableNonNegativeInteger(
    input.knowledgeStorageGb,
    'knowledgeStorageGb',
    errors,
  );
  const connectorEntitlementsJson = validateEntitlementJson(
    input.connectorEntitlementsJson,
    'connectorEntitlementsJson',
    errors,
  );
  const serviceEntitlementsJson = validateEntitlementJson(
    input.serviceEntitlementsJson,
    'serviceEntitlementsJson',
    errors,
  );
  const featureEntitlementsJson = validateEntitlementJson(
    input.featureEntitlementsJson,
    'featureEntitlementsJson',
    errors,
  );
  const quotaEntitlementsJson = validateEntitlementJson(
    input.quotaEntitlementsJson,
    'quotaEntitlementsJson',
    errors,
  );

  validateRequiredText(versionCode, 'versionCode', 64, errors);
  validateRequiredText(displayName, 'displayName', 120, errors);
  validateRequiredText(displayPrice, 'displayPrice', 80, errors);
  if (priceNote.length > 500) errors.push('priceNote 不能超过 500 个字符');
  if (changeSummary.length > 600) errors.push('changeSummary 不能超过 600 个字符');
  if (realPaymentTextPattern.test(displayPrice)) {
    errors.push('displayPrice 不能包含真实支付或扣费语义');
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      versionCode,
      displayName,
      displayPrice,
      priceNote,
      agentLimit,
      seatLimit,
      monthlyAiCallLimit,
      knowledgeStorageGb,
      connectorEntitlementsJson,
      serviceEntitlementsJson,
      featureEntitlementsJson,
      quotaEntitlementsJson,
      changeSummary,
    },
  };
}

function mapVersionRecordToDto(version: PlanCatalogVersionRecord) {
  return {
    versionId: version.versionId,
    planId: version.planId,
    versionCode: version.versionCode,
    status: version.status,
    displayName: version.displayName,
    displayPrice: version.displayPrice,
    priceNote: version.priceNote,
    agentLimit: version.agentLimit,
    seatLimit: version.seatLimit,
    monthlyAiCallLimit: version.monthlyAiCallLimit,
    knowledgeStorageGb: version.knowledgeStorageGb,
    connectorEntitlementsJson: sanitizeJsonRecord(version.connectorEntitlementsJson),
    serviceEntitlementsJson: sanitizeJsonRecord(version.serviceEntitlementsJson),
    featureEntitlementsJson: sanitizeJsonRecord(version.featureEntitlementsJson),
    quotaEntitlementsJson: sanitizeJsonRecord(version.quotaEntitlementsJson),
    changeSummary: version.changeSummary,
    createdBy: version.createdBy,
    updatedBy: version.updatedBy,
    publishedBy: version.publishedBy,
    publishedAt: toIsoString(version.publishedAt),
    retiredAt: toIsoString(version.retiredAt),
    createdAt: toIsoString(version.createdAt) ?? '',
    updatedAt: toIsoString(version.updatedAt) ?? '',
  };
}

function latestVersionId(
  versions: PlanCatalogVersionRecord[],
  status: PlanCatalogVersionStatus,
) {
  const [latest] = versions
    .filter((version) => version.status === status)
    .sort((left, right) => {
      const leftDate = new Date(left.publishedAt ?? left.updatedAt).getTime();
      const rightDate = new Date(right.publishedAt ?? right.updatedAt).getTime();
      return rightDate - leftDate;
    });

  return latest?.versionId ?? null;
}

export function mapPlanCatalogRecordsToDto(records: PlanCatalogRecord[]) {
  const versions = records.flatMap((record) => record.versions);

  return {
    summary: {
      planCount: records.length,
      draftVersionCount: versions.filter((version) => version.status === 'draft').length,
      publishedVersionCount: versions.filter((version) => version.status === 'published').length,
      retiredVersionCount: versions.filter((version) => version.status === 'retired').length,
    },
    plans: records.map((record) => ({
      planId: record.planId,
      planName: record.planName,
      planCode: record.planCode,
      planDescription: record.planDescription,
      planStatus: record.planStatus,
      publishedVersionId: latestVersionId(record.versions, 'published'),
      draftVersionId: latestVersionId(record.versions, 'draft'),
      versions: record.versions.map(mapVersionRecordToDto),
    })),
  };
}

export type PlanCatalogDto = ReturnType<typeof mapPlanCatalogRecordsToDto>;
export type PlanCatalogVersionDto = PlanCatalogDto['plans'][number]['versions'][number];
