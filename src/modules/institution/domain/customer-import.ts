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
const previewInputKeys = [
  'tenantId',
  'institutionId',
  'operatorRef',
  'rows',
  'existingCustomers',
  'occurredAt',
  'importBatchId',
] as const;
const existingCustomerKeys = [
  'id',
  'tenantId',
  'institutionId',
  'displayName',
  'lifecycle',
  'priority',
  'ownerUserId',
  'projectInterest',
  'maskedPhone',
  'maskedMedicalRecordNo',
  'lastTouchSummary',
  'nextAction',
  'tags',
  'gender',
  'birthDate',
  'referralSource',
  'notes',
] as const;
const MAX_IMPORT_ROW_COUNT = 256;
const MAX_EXISTING_CUSTOMER_COUNT = 10_000;
const MAX_TAG_COUNT = 64;
const MAX_IMPORT_TEXT_LENGTH = 4096;
const MAX_IMPORT_METADATA_LENGTH = 256;

type StrictDataRecord = Readonly<Record<string, unknown>>;
type RejectedImportRow = Readonly<{
  reasons: readonly Extract<CustomerImportFailureReason, 'unsupported_field' | 'sensitive_field_detected' | 'unsafe_payload'>[];
  publicFields?: readonly 'institutionId'[];
}>;
type PreparedImportRow = StrictDataRecord | RejectedImportRow;
type PreparedCustomerImportInput = Readonly<{
  tenantId: string;
  institutionId: string | null | undefined;
  operatorRef: string;
  rows: readonly PreparedImportRow[];
  existingCustomers: readonly CustomerRecordSummary[];
  occurredAt: string;
  importBatchId: string | undefined;
}>;

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

function isCloneableData(value: object): boolean {
  try {
    const clone = globalThis.structuredClone;
    if (typeof clone !== 'function') return false;
    clone(value);
    return true;
  } catch {
    return false;
  }
}

function snapshotDataRecord(
  value: unknown,
  allowedKeys: readonly string[],
): StrictDataRecord | null {
  try {
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return null;
    }

    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length > allowedKeys.length ||
      ownKeys.some((key) => typeof key !== 'string' || !allowedKeys.includes(key))
    ) {
      return null;
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const descriptorKeys = Reflect.ownKeys(descriptors);
    if (
      descriptorKeys.length !== ownKeys.length ||
      descriptorKeys.some((key) => typeof key !== 'string') ||
      ownKeys.some(
        (key) => typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(descriptors, key),
      )
    ) {
      return null;
    }

    const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of descriptorKeys as string[]) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return null;
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function snapshotDenseArray(value: unknown, maximumLength: number): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) {
      return null;
    }

    const ownKeys = Reflect.ownKeys(value);
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    const descriptorKeys = Reflect.ownKeys(descriptors);
    const lengthDescriptor = descriptors.length;
    if (
      !lengthDescriptor ||
      !('value' in lengthDescriptor) ||
      typeof lengthDescriptor.value !== 'number' ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > maximumLength
    ) {
      return null;
    }

    const length = lengthDescriptor.value;
    const expectedKeys = [
      ...Array.from({ length }, (_, index) => String(index)),
      'length',
    ];
    if (
      ownKeys.length !== expectedKeys.length ||
      descriptorKeys.length !== expectedKeys.length ||
      ownKeys.some((key) => typeof key !== 'string') ||
      descriptorKeys.some((key) => typeof key !== 'string') ||
      expectedKeys.some(
        (key) =>
          !Object.prototype.hasOwnProperty.call(descriptors, key) ||
          !ownKeys.includes(key),
      )
    ) {
      return null;
    }

    const snapshot: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return null;
      snapshot.push(descriptor.value);
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function snapshotBoundedText(value: unknown, maximumLength = MAX_IMPORT_TEXT_LENGTH): string | null {
  return typeof value === 'string' && value.length <= maximumLength ? value : null;
}

function hasRequiredSnapshotKeys(snapshot: StrictDataRecord, requiredKeys: readonly string[]): boolean {
  return requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(snapshot, key));
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

function buildImportBatchId(input: Pick<PreparedCustomerImportInput, 'tenantId' | 'institutionId' | 'operatorRef' | 'occurredAt' | 'rows' | 'importBatchId'>) {
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

function snapshotImportRow(value: unknown): PreparedImportRow {
  let rowKeys: string[];
  try {
    const ownKeys = Reflect.ownKeys(value as object);
    if (
      ownKeys.length > lowSensitiveCustomerImportAllowedFields.length + 16 ||
      ownKeys.some((key) => typeof key !== 'string')
    ) {
      return Object.freeze({ reasons: Object.freeze(['unsafe_payload'] as const) });
    }
    rowKeys = ownKeys as string[];
  } catch {
    return Object.freeze({ reasons: Object.freeze(['unsafe_payload'] as const) });
  }

  const snapshot = snapshotDataRecord(value, rowKeys);
  if (!snapshot) {
    return Object.freeze({ reasons: Object.freeze(['unsafe_payload'] as const) });
  }

  const extraReasons = new Set<RejectedImportRow['reasons'][number]>();
  const publicFields: 'institutionId'[] = [];
  for (const key of rowKeys) {
    if (looksLikeSensitiveField(key)) {
      extraReasons.add('sensitive_field_detected');
    } else if (!allowedFieldSet.has(key)) {
      extraReasons.add('unsupported_field');
      if (key === 'institutionId') publicFields.push('institutionId');
    }
  }

  for (const key of Reflect.ownKeys(snapshot)) {
    if (typeof key !== 'string') return Object.freeze({ reasons: Object.freeze(['unsafe_payload'] as const) });
    const valueAtKey = snapshot[key];
    if (
      valueAtKey !== null &&
      valueAtKey !== undefined &&
      snapshotBoundedText(valueAtKey) === null
    ) {
      return Object.freeze({ reasons: Object.freeze(['unsafe_payload'] as const) });
    }
  }

  if (!isCloneableData(value as object)) {
    return Object.freeze({ reasons: Object.freeze(['unsafe_payload'] as const) });
  }

  if (extraReasons.size > 0) {
    return Object.freeze({
      reasons: Object.freeze([...extraReasons]),
      ...(publicFields.length > 0 ? { publicFields: Object.freeze(publicFields) } : {}),
    });
  }

  return snapshot;
}

function snapshotExistingCustomer(value: unknown): CustomerRecordSummary | null {
  const snapshot = snapshotDataRecord(value, existingCustomerKeys);
  if (!snapshot || !hasRequiredSnapshotKeys(snapshot, existingCustomerKeys)) return null;

  const tags = snapshotDenseArray(snapshot.tags, MAX_TAG_COUNT);
  if (!tags || !tags.every((tag) => snapshotBoundedText(tag) !== null)) return null;

  for (const key of existingCustomerKeys) {
    if (key === 'tags' || key === 'institutionId') continue;
    if (snapshotBoundedText(snapshot[key]) === null) return null;
  }
  if (snapshot.institutionId !== null && snapshotBoundedText(snapshot.institutionId) === null) {
    return null;
  }
  if (!isCloneableData(value as object) || !isCloneableData(snapshot.tags as object)) return null;

  return Object.freeze({
    id: snapshot.id as string,
    tenantId: snapshot.tenantId as string,
    institutionId: snapshot.institutionId as string | null,
    displayName: snapshot.displayName as string,
    lifecycle: snapshot.lifecycle as CustomerLifecycleStage,
    priority: snapshot.priority as CustomerPriority,
    ownerUserId: snapshot.ownerUserId as string,
    projectInterest: snapshot.projectInterest as string,
    maskedPhone: snapshot.maskedPhone as string,
    maskedMedicalRecordNo: snapshot.maskedMedicalRecordNo as string,
    lastTouchSummary: snapshot.lastTouchSummary as string,
    nextAction: snapshot.nextAction as string,
    tags: tags as string[],
    gender: snapshot.gender as string,
    birthDate: snapshot.birthDate as string,
    referralSource: snapshot.referralSource as string,
    notes: snapshot.notes as string,
  });
}

function snapshotCustomerImportInput(input: unknown): PreparedCustomerImportInput | null {
  const snapshot = snapshotDataRecord(input, previewInputKeys);
  if (
    !snapshot ||
    !hasRequiredSnapshotKeys(snapshot, ['tenantId', 'operatorRef', 'rows', 'occurredAt'])
  ) {
    return null;
  }

  const tenantId = snapshotBoundedText(snapshot.tenantId, MAX_IMPORT_METADATA_LENGTH);
  const operatorRef = snapshotBoundedText(snapshot.operatorRef, MAX_IMPORT_METADATA_LENGTH);
  const occurredAt = snapshotBoundedText(snapshot.occurredAt, MAX_IMPORT_METADATA_LENGTH);
  if (!tenantId || !operatorRef || !occurredAt) return null;

  const institutionId = snapshot.institutionId;
  if (
    institutionId !== undefined &&
    institutionId !== null &&
    snapshotBoundedText(institutionId, MAX_IMPORT_METADATA_LENGTH) === null
  ) {
    return null;
  }
  const importBatchId = snapshot.importBatchId;
  if (
    importBatchId !== undefined &&
    snapshotBoundedText(importBatchId, MAX_IMPORT_METADATA_LENGTH) === null
  ) {
    return null;
  }

  const rawRows = snapshotDenseArray(snapshot.rows, MAX_IMPORT_ROW_COUNT);
  if (!rawRows) return null;
  const rows = rawRows.map(snapshotImportRow);
  if (!isCloneableData(snapshot.rows as object)) return null;

  const rawExistingCustomers = snapshot.existingCustomers === undefined
    ? Object.freeze([])
    : snapshotDenseArray(snapshot.existingCustomers, MAX_EXISTING_CUSTOMER_COUNT);
  if (!rawExistingCustomers) return null;
  const existingCustomers: CustomerRecordSummary[] = [];
  for (const customer of rawExistingCustomers) {
    const safeCustomer = snapshotExistingCustomer(customer);
    if (!safeCustomer) return null;
    existingCustomers.push(safeCustomer);
  }
  if (
    snapshot.existingCustomers !== undefined &&
    !isCloneableData(snapshot.existingCustomers as object)
  ) {
    return null;
  }

  if (!isCloneableData(input as object)) return null;

  return Object.freeze({
    tenantId,
    institutionId: institutionId as string | null | undefined,
    operatorRef,
    rows: Object.freeze(rows),
    existingCustomers: Object.freeze(existingCustomers),
    occurredAt,
    importBatchId: importBatchId as string | undefined,
  });
}

function isRejectedImportRow(row: PreparedImportRow): row is RejectedImportRow {
  return Object.prototype.hasOwnProperty.call(row, 'reasons');
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
  row: PreparedImportRow;
  rowNumber: number;
  seenKeys: Set<string>;
  existingKeys: Set<string>;
}) : CustomerImportRow {
  const issues: CustomerImportRowIssue[] = [];

  if (isRejectedImportRow(input.row)) {
    return {
      rowNumber: input.rowNumber,
      status: 'skipped',
      customerDisplayName: null,
      importedCustomerRef: null,
      duplicateKey: null,
      issues: input.row.reasons.map((reason) => ({
        reason,
        ...(reason === 'unsupported_field' && input.row.publicFields?.includes('institutionId')
          ? { field: 'institutionId' }
          : {}),
        message: reason === 'sensitive_field_detected'
          ? '导入行包含高敏字段，已阻断'
          : reason === 'unsupported_field'
            ? '导入行包含未批准字段，已阻断'
            : '导入行格式不安全，已阻断',
      })),
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
        message: '导入行包含未批准字段，已阻断',
      });
    }

    if (looksLikeUnsafePayload(value)) {
      addIssue(issues, {
        reason: 'unsafe_payload',
        message: '导入行包含不安全 payload，已阻断',
      });
    }

    if (valueText && (looksLikeSensitiveValue(valueText) || looksLikeRawExternalRef(key, valueText))) {
      addIssue(issues, {
        reason: 'sensitive_field_detected',
        message: '导入行包含疑似高敏内容，已阻断',
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
    customerDisplayName: issues.length === 0 ? compactText(row.customerDisplayName) || null : null,
    importedCustomerRef: issues.length === 0 ? compactText(row.importedCustomerRef) || null : null,
    duplicateKey: issues.length === 0 ? duplicateKey : null,
    issues,
  };
}

export function previewLowSensitiveCustomerImport(
  input: CustomerImportPreviewInput,
): CustomerImportPreviewResult {
  const prepared = snapshotCustomerImportInput(input);
  if (!prepared) return createUnsafeImportPreview();
  return previewPreparedCustomerImport(prepared);
}

function createUnsafeImportPreview(): CustomerImportPreviewResult {
  const unsafeRow: CustomerImportRow = {
    rowNumber: 1,
    status: 'skipped',
    customerDisplayName: null,
    importedCustomerRef: null,
    duplicateKey: null,
    issues: [{ reason: 'unsafe_payload', message: '导入内容格式不安全，已阻断' }],
  };
  return {
    importBatch: {
      importBatchId: 'customer-import:unsafe-payload',
      tenantId: '',
      institutionId: null,
      operatorRef: '',
      fieldWhitelist: [...lowSensitiveCustomerImportAllowedFields],
      rows: [unsafeRow],
      createdAt: '',
      updatedAt: '',
    },
    totalCount: 1,
    successCount: 0,
    failureCount: 1,
    skippedCount: 1,
    canExecute: false,
    boundary: customerImportBoundary,
  };
}

function previewPreparedCustomerImport(
  input: PreparedCustomerImportInput,
): CustomerImportPreviewResult {
  const seenKeys = new Set<string>();
  const existingKeys = existingDuplicateKeys({
    existingCustomers: input.existingCustomers,
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
  const prepared = snapshotCustomerImportInput(input);
  if (!prepared || typeof prepared.institutionId !== 'string') {
    return { preview: createUnsafeImportPreview(), drafts: [] };
  }

  const preview = previewPreparedCustomerImport(prepared);
  const readyRowNumbers = new Set(
    preview.importBatch.rows
      .filter((row) => row.status === 'ready')
      .map((row) => row.rowNumber),
  );

  return {
    preview,
    drafts: prepared.rows
      .map((row, index) => ({ row, rowNumber: index + 1 }))
      .filter((item): item is { row: StrictDataRecord; rowNumber: number } =>
        readyRowNumbers.has(item.rowNumber) && !isRejectedImportRow(item.row),
      )
      .map((item) => mapCustomerImportRowToCreateCustomerDraft({
        tenantId: prepared.tenantId,
        institutionId: prepared.institutionId,
        row: item.row,
        rowNumber: item.rowNumber,
        importBatchId: preview.importBatch.importBatchId,
      })),
  };
}
