import type { CustomerLifecycleStage, CustomerPriority, CustomerRecordSummary } from '@/modules/institution/domain/customer-records';

export const lowSensitiveCustomerImportAllowedFields = [
  'customerDisplayName',
  'customerAlias',
  'gender',
  'ageRange',
  'birthYear',
  'customerStage',
  'treatmentProject',
  'lastVisitDate',
  'nextFollowUpDate',
  'ownerEmployeeName',
  'ownerEmployeeRef',
  'sourceChannel',
  'tagSummary',
  'noteSummary',
  'externalCustomerRef',
  'importedCustomerRef',
] as const;

export type LowSensitiveCustomerImportAllowedField =
  (typeof lowSensitiveCustomerImportAllowedFields)[number];

export type CustomerImportFailureReason =
  | 'missing_required_field'
  | 'unsupported_field'
  | 'sensitive_field_detected'
  | 'invalid_date'
  | 'duplicated_customer'
  | 'empty_row'
  | 'unsafe_payload';

export type CustomerImportRowInput = Partial<Record<LowSensitiveCustomerImportAllowedField, unknown>> &
  Record<string, unknown>;

export type CustomerImportRowStatus = 'ready' | 'skipped';

export type CustomerImportRowIssue = {
  reason: CustomerImportFailureReason;
  field?: string;
  message: string;
};

export type CustomerImportRow = {
  rowNumber: number;
  status: CustomerImportRowStatus;
  customerDisplayName: string | null;
  importedCustomerRef: string | null;
  duplicateKey: string | null;
  issues: CustomerImportRowIssue[];
};

export type CustomerImportBatch = {
  importBatchId: string;
  tenantId: string;
  institutionId: string | null;
  operatorRef: string;
  fieldWhitelist: LowSensitiveCustomerImportAllowedField[];
  rows: CustomerImportRow[];
  createdAt: string;
  updatedAt: string;
};

export type CustomerImportPreviewResult = {
  importBatch: CustomerImportBatch;
  totalCount: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  canExecute: boolean;
  boundary: CustomerImportBoundary;
};

export type CustomerImportResult = CustomerImportPreviewResult & {
  importedCustomerIds: string[];
};

export type CustomerImportBoundary = {
  mode: 'low_sensitive_customer_import';
  supportsPreview: true;
  writesCustomerRecordsOnExecute: true;
  noHis: true;
  noRealWeCom: true;
  noSms: true;
  noWebhook: true;
  noRealSend: true;
  forbiddenData: string[];
};

export type CustomerImportPreviewInput = {
  tenantId: string;
  institutionId?: string | null;
  operatorRef: string;
  rows: unknown[];
  existingCustomers?: CustomerRecordSummary[];
  occurredAt: string;
  importBatchId?: string;
};

export type CustomerImportExecuteInput = CustomerImportPreviewInput;

export type CustomerImportCreateCustomerDraft = {
  id: string;
  tenantId: string;
  institutionId: string;
  displayName: string;
  lifecycle: CustomerLifecycleStage;
  priority: CustomerPriority;
  ownerUserId: string;
  projectInterest: string;
  maskedPhone: string;
  maskedMedicalRecordNo: string;
  lastTouchSummary: string;
  nextAction: string;
  tags: string[];
  gender: string;
  birthDate: string;
  referralSource: string;
  notes: string;
};

const allowedFieldSet = new Set<string>(lowSensitiveCustomerImportAllowedFields);
const requiredFields = ['customerDisplayName'] as const;
const dateFields = ['lastVisitDate', 'nextFollowUpDate'] as const;
const refFields = ['externalCustomerRef', 'importedCustomerRef', 'ownerEmployeeRef'] as const;

const customerStageMap: Record<string, CustomerLifecycleStage> = {
  consulting: 'consulting',
  scheduled: 'scheduled',
  post_care: 'post_care',
  repurchase_window: 'repurchase_window',
  silent_reactivation: 'silent_reactivation',
  咨询中: 'consulting',
  已预约: 'scheduled',
  术后护理: 'post_care',
  复购窗口: 'repurchase_window',
  沉默激活: 'silent_reactivation',
};

export const customerImportBoundary: CustomerImportBoundary = {
  mode: 'low_sensitive_customer_import',
  supportsPreview: true,
  writesCustomerRecordsOnExecute: true,
  noHis: true,
  noRealWeCom: true,
  noSms: true,
  noWebhook: true,
  noRealSend: true,
  forbiddenData: [
    '真实手机号',
    '身份证',
    '病历号',
    '完整生日',
    '完整地址',
    '微信号',
    '真实 external_userid',
    '真实 userid',
    'corpId',
    'secret / token / API key',
    '聊天记录',
    'HIS payload',
    '原始第三方接口返回',
  ],
};

function isPlainObject(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.normalize('NFKC').trim() : '';
}

function compactText(value: unknown, fallback = '') {
  const text = normalizeText(value);
  return text.length > 0 ? text : fallback;
}

function countDigits(value: string) {
  return value.match(/\p{Decimal_Number}/gu)?.length ?? 0;
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function normalizeInstitutionId(institutionId: string | null | undefined) {
  const normalized = normalizeText(institutionId ?? 'default-institution');
  return normalized.length > 0 ? normalized : 'default-institution';
}

function buildImportBatchId(input: CustomerImportPreviewInput) {
  if (input.importBatchId) return input.importBatchId;
  return `customer-import:${stableHash([
    input.tenantId,
    normalizeInstitutionId(input.institutionId),
    input.operatorRef,
    input.occurredAt,
    String(input.rows.length),
  ].join('|'))}`;
}

function buildImportedRefTag(importedCustomerRef: string) {
  return `imported_ref:${importedCustomerRef}`;
}

function buildCandidateTag(candidateKey: string) {
  return `import_candidate:${stableHash(candidateKey)}`;
}

function isValidIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

function looksLikeSensitiveField(key: string) {
  return /phone|mobile|手机号|电话|idcard|id_card|id.?number|身份证|证件|medicalrecord|medical_record|病历|birthday|birthdate|生日|address|地址|wechat|微信号|external_userid|userid|user_id|corp.?id|secret|token|api.?key|chat|conversation|聊天|his|payload|raw|原始/i.test(
    key,
  );
}

function looksLikeSensitiveValue(value: string) {
  if (countDigits(value) >= 11) return true;

  return (
    /\b\d{17}[0-9xX]\b/u.test(value) ||
    /(?:身份证|身分證|id\s*(?:card|number))[\s:：-]*[0-9xX]{8,}/iu.test(value) ||
    /(?:病历号|病歷號|medical\s*record|\bmr\b)[\s:：-]*[A-Za-z0-9-]{4,}/iu.test(value) ||
    /(?:access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|zmtg_sk_|sk_live|sk_test)/iu.test(value) ||
    /(?:external_userid|corpId|corp_id|聊天记录|聊天紀錄|chat\s*record|his\s*payload|raw\s*payload|原始接口|原始返回)/iu.test(value)
  );
}

function looksLikeUnsafePayload(value: unknown) {
  return Array.isArray(value) || (typeof value === 'object' && value !== null);
}

function looksLikeRawExternalRef(field: string, value: string) {
  if (!refFields.includes(field as (typeof refFields)[number])) return false;
  return /external_userid|corpId|corp_id|userid|user_id|真实|raw|wm[A-Za-z0-9_-]{12,}/iu.test(value);
}

function addIssue(
  issues: CustomerImportRowIssue[],
  issue: CustomerImportRowIssue,
) {
  if (
    issues.some(
      (current) => current.reason === issue.reason && current.field === issue.field,
    )
  ) {
    return;
  }
  issues.push(issue);
}

function createDuplicateKey(row: Record<string, unknown>) {
  const importedCustomerRef = compactText(row.importedCustomerRef);
  if (importedCustomerRef) return `imported_ref:${importedCustomerRef}`;

  const displayName = compactText(row.customerDisplayName).toLowerCase();
  const lastVisitDate = compactText(row.lastVisitDate);
  const treatmentProject = compactText(row.treatmentProject).toLowerCase();
  if (displayName && lastVisitDate && treatmentProject) {
    return `candidate:${displayName}|${lastVisitDate}|${treatmentProject}`;
  }

  return null;
}

function existingDuplicateKeys(input: {
  existingCustomers: CustomerRecordSummary[];
  institutionId?: string | null;
}) {
  const keys = new Set<string>();

  for (const customer of input.existingCustomers) {
    if (!input.institutionId || customer.institutionId !== input.institutionId) continue;

    for (const tag of customer.tags) {
      if (tag.startsWith('imported_ref:')) keys.add(tag);
      if (tag.startsWith('import_candidate:')) keys.add(tag);
    }

    const lastVisitDate = /最近到访:(\d{4}-\d{2}-\d{2})/u.exec(customer.lastTouchSummary)?.[1];
    if (customer.displayName && customer.projectInterest && lastVisitDate) {
      keys.add(`candidate:${customer.displayName.toLowerCase()}|${lastVisitDate}|${customer.projectInterest.toLowerCase()}`);
      keys.add(buildCandidateTag(`candidate:${customer.displayName.toLowerCase()}|${lastVisitDate}|${customer.projectInterest.toLowerCase()}`));
    }
  }

  return keys;
}

function validateImportRow(input: {
  row: unknown;
  rowNumber: number;
  seenKeys: Set<string>;
  existingKeys: Set<string>;
}) : CustomerImportRow {
  const issues: CustomerImportRowIssue[] = [];

  if (!isPlainObject(input.row)) {
    return {
      rowNumber: input.rowNumber,
      status: 'skipped',
      customerDisplayName: null,
      importedCustomerRef: null,
      duplicateKey: null,
      issues: [{ reason: 'unsafe_payload', message: '导入行必须是低敏 JSON object' }],
    };
  }

  const row = input.row;
  const keys = Object.keys(row);
  const nonEmptyKeys = keys.filter((key) => {
    const value = row[key];
    return value !== null && value !== undefined && String(value).trim().length > 0;
  });

  if (nonEmptyKeys.length === 0) {
    addIssue(issues, { reason: 'empty_row', message: '导入行为空' });
  }

  for (const key of keys) {
    const value = row[key];
    const valueText = typeof value === 'string' ? value : '';
    const sensitiveFieldName = looksLikeSensitiveField(key);

    if (sensitiveFieldName) {
      addIssue(issues, {
        reason: 'sensitive_field_detected',
        message: '导入行包含高敏字段，已阻断',
      });
      continue;
    }

    if (!allowedFieldSet.has(key)) {
      addIssue(issues, {
        reason: 'unsupported_field',
        field: key,
        message: `字段 ${key} 不在低敏字段白名单内`,
      });
    }

    if (looksLikeUnsafePayload(value)) {
      addIssue(issues, {
        reason: 'unsafe_payload',
        field: key,
        message: `字段 ${key} 不允许携带嵌套 payload`,
      });
    }

    if (valueText && (looksLikeSensitiveValue(valueText) || looksLikeRawExternalRef(key, valueText))) {
      addIssue(issues, {
        reason: 'sensitive_field_detected',
        field: key,
        message: `字段 ${key} 含疑似高敏内容，已阻断`,
      });
    }
  }

  for (const field of requiredFields) {
    if (!compactText(row[field])) {
      addIssue(issues, {
        reason: 'missing_required_field',
        field,
        message: `字段 ${field} 必填`,
      });
    }
  }

  for (const field of dateFields) {
    const value = compactText(row[field]);
    if (value && !isValidIsoDate(value)) {
      addIssue(issues, {
        reason: 'invalid_date',
        field,
        message: `字段 ${field} 必须使用 YYYY-MM-DD`,
      });
    }
  }

  const duplicateKey = createDuplicateKey(row);
  const duplicateStoredKey = duplicateKey?.startsWith('candidate:')
    ? buildCandidateTag(duplicateKey)
    : duplicateKey;
  if (duplicateKey && duplicateStoredKey) {
    if (input.seenKeys.has(duplicateKey) || input.seenKeys.has(duplicateStoredKey) || input.existingKeys.has(duplicateKey) || input.existingKeys.has(duplicateStoredKey)) {
      addIssue(issues, {
        reason: 'duplicated_customer',
        message: '当前租户 / 机构内发现重复客户候选',
      });
    }
    input.seenKeys.add(duplicateKey);
    input.seenKeys.add(duplicateStoredKey);
  }

  return {
    rowNumber: input.rowNumber,
    status: issues.length === 0 ? 'ready' : 'skipped',
    customerDisplayName: compactText(row.customerDisplayName) || null,
    importedCustomerRef: compactText(row.importedCustomerRef) || null,
    duplicateKey,
    issues,
  };
}

export function previewLowSensitiveCustomerImport(
  input: CustomerImportPreviewInput,
): CustomerImportPreviewResult {
  const seenKeys = new Set<string>();
  const existingKeys = existingDuplicateKeys({
    existingCustomers: input.existingCustomers ?? [],
    institutionId: input.institutionId,
  });
  const rows = input.rows.map((row, index) =>
    validateImportRow({
      row,
      rowNumber: index + 1,
      seenKeys,
      existingKeys,
    }),
  );
  const successCount = rows.filter((row) => row.status === 'ready').length;
  const skippedCount = rows.filter((row) => row.status === 'skipped').length;

  return {
    importBatch: {
      importBatchId: buildImportBatchId(input),
      tenantId: input.tenantId,
      institutionId: input.institutionId ?? null,
      operatorRef: input.operatorRef,
      fieldWhitelist: [...lowSensitiveCustomerImportAllowedFields],
      rows,
      createdAt: input.occurredAt,
      updatedAt: input.occurredAt,
    },
    totalCount: rows.length,
    successCount,
    failureCount: skippedCount,
    skippedCount,
    canExecute: successCount > 0,
    boundary: customerImportBoundary,
  };
}

export function mapCustomerImportRowToCreateCustomerDraft(input: {
  tenantId: string;
  institutionId: string;
  row: CustomerImportRowInput;
  rowNumber: number;
  importBatchId: string;
}): CustomerImportCreateCustomerDraft {
  const importedCustomerRef = compactText(input.row.importedCustomerRef) || `row-${input.rowNumber}`;
  const externalCustomerRef = compactText(input.row.externalCustomerRef);
  const lastVisitDate = compactText(input.row.lastVisitDate);
  const nextFollowUpDate = compactText(input.row.nextFollowUpDate);
  const treatmentProject = compactText(input.row.treatmentProject, '未指定项目');
  const ownerRef = compactText(input.row.ownerEmployeeRef) || compactText(input.row.ownerEmployeeName, 'import-operator');
  const duplicateKey = createDuplicateKey(input.row) ?? `candidate:${compactText(input.row.customerDisplayName).toLowerCase()}||${treatmentProject.toLowerCase()}`;
  const tags = [
    '低敏导入',
    buildImportedRefTag(importedCustomerRef),
    buildCandidateTag(duplicateKey),
    compactText(input.row.sourceChannel),
    compactText(input.row.tagSummary),
  ].filter((tag) => tag.length > 0);
  const stageText = compactText(input.row.customerStage);
  const lifecycle = customerStageMap[stageText] ?? 'consulting';
  const ageOrBirthYear = compactText(input.row.ageRange) || compactText(input.row.birthYear);

  return {
    id: `cust_import_${stableHash(`${input.tenantId}|${normalizeInstitutionId(input.institutionId)}|${importedCustomerRef}|${input.rowNumber}`)}`,
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    displayName: compactText(input.row.customerDisplayName),
    lifecycle,
    priority: lifecycle === 'post_care' ? 'high' : 'observe',
    ownerUserId: ownerRef,
    projectInterest: treatmentProject,
    maskedPhone: 'masked-import-only',
    maskedMedicalRecordNo: 'masked-import-record',
    lastTouchSummary: lastVisitDate ? `最近到访:${lastVisitDate}` : '低敏导入客户，暂无最近到访日期',
    nextAction: nextFollowUpDate ? `下次随访:${nextFollowUpDate}` : '导入后进入人工运营队列',
    tags: [...new Set(tags)],
    gender: compactText(input.row.gender, '未指定'),
    birthDate: ageOrBirthYear ? `低敏年龄:${ageOrBirthYear}` : '未提供完整生日',
    referralSource: compactText(input.row.sourceChannel, '低敏客户导入'),
    notes: [
      `importBatch:${input.importBatchId}`,
      `importedCustomerRef:${importedCustomerRef}`,
      externalCustomerRef ? `externalCustomerRef:${externalCustomerRef}` : '',
      compactText(input.row.customerAlias) ? `alias:${compactText(input.row.customerAlias)}` : '',
      compactText(input.row.noteSummary) ? `noteSummary:${compactText(input.row.noteSummary)}` : '',
    ].filter(Boolean).join('；'),
  };
}

export function getCustomerImportRowsForExecution(
  input: CustomerImportExecuteInput & { institutionId: string },
) {
  const preview = previewLowSensitiveCustomerImport(input);
  const readyRowNumbers = new Set(
    preview.importBatch.rows
      .filter((row) => row.status === 'ready')
      .map((row) => row.rowNumber),
  );

  return {
    preview,
    drafts: input.rows
      .map((row, index) => ({ row, rowNumber: index + 1 }))
      .filter((item): item is { row: CustomerImportRowInput; rowNumber: number } =>
        readyRowNumbers.has(item.rowNumber) && isPlainObject(item.row),
      )
      .map((item) => mapCustomerImportRowToCreateCustomerDraft({
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        row: item.row,
        rowNumber: item.rowNumber,
        importBatchId: preview.importBatch.importBatchId,
      })),
  };
}
