import { types as nodeTypes } from 'node:util';

import {
  customerImportBoundary,
  lowSensitiveCustomerImportAllowedFields,
  type CustomerImportCreateCustomerDraft,
  type CustomerImportFailureReason,
  type CustomerImportPreviewInput,
  type CustomerImportPreviewResult,
  type CustomerImportRow,
  type CustomerImportRowIssue,
} from '@/modules/institution/domain/customer-import';
import type { CustomerLifecycleStage, CustomerPriority, CustomerRecordSummary } from '@/modules/institution/domain/customer-records';

const allowed = new Set<string>(lowSensitiveCustomerImportAllowedFields);
const inputKeys = ['tenantId', 'institutionId', 'operatorRef', 'rows', 'existingCustomers', 'occurredAt', 'importBatchId'] as const;
const customerKeys = ['id', 'tenantId', 'institutionId', 'displayName', 'lifecycle', 'priority', 'ownerUserId', 'projectInterest', 'maskedPhone', 'maskedMedicalRecordNo', 'lastTouchSummary', 'nextAction', 'tags', 'gender', 'birthDate', 'referralSource', 'notes'] as const;
const MAX_ROWS = 256;
const MAX_EXISTING = 10_000;
const MAX_TAGS = 64;
const MAX_METADATA = 256;
const MAX_TEXT = 4096;
type SafeRecord = Readonly<Record<string, string | null | undefined>>;
type Rejected = Readonly<{ kind: 'rejected'; reasons: readonly Extract<CustomerImportFailureReason, 'unsafe_payload' | 'unsupported_field' | 'sensitive_field_detected'>[]; institutionIdField: boolean }>;
type Accepted = Readonly<{ kind: 'accepted'; row: SafeRecord }>;
type RowSnapshot = Accepted | Rejected;
type SafeInput = Readonly<{ tenantId: string; institutionId: string | null | undefined; operatorRef: string; rows: readonly RowSnapshot[]; existing: readonly CustomerRecordSummary[]; occurredAt: string; importBatchId: string | undefined }>;

function proxy(value: object) { try { return nodeTypes.isProxy(value); } catch { return true; } }
function text(value: unknown, max = MAX_TEXT): string | null { return typeof value === 'string' && value.length <= max ? value : null; }
function frozen<T>(value: T): T { return Object.freeze(value); }
function isSensitiveField(key: string) { return /phone|mobile|手机号|电话|idcard|id_card|id.?number|身份证|证件|medicalrecord|medical_record|病历|birthday|birthdate|生日|address|地址|wechat|微信号|external_userid|userid|user_id|corp.?id|secret|token|api.?key|chat|conversation|聊天|his|payload|raw|原始/i.test(key); }
function sensitiveValue(value: string) { return (value.match(/\p{Decimal_Number}/gu)?.length ?? 0) >= 11 || /\b\d{17}[0-9xX]\b|(?:access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|zmtg_sk_|sk_live|sk_test|external_userid|corpId|corp_id|聊天记录|his\s*payload|raw\s*payload)/iu.test(value); }
function rawRef(key: string, value: string) { return ['externalCustomerRef', 'importedCustomerRef', 'ownerEmployeeRef'].includes(key) && /external_userid|corpId|corp_id|userid|user_id|真实|raw|wm[A-Za-z0-9_-]{12,}/iu.test(value); }

/** Snapshot one ordinary record; Proxy rejection always precedes prototype or reflective reads. */
function record(value: unknown, maxKeys: number, permitted: readonly string[] | null): Readonly<Record<string, unknown>> | null {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value) || proxy(value) || Object.getPrototypeOf(value) !== Object.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length > maxKeys || keys.some((key) => typeof key !== 'string' || (permitted !== null && !permitted.includes(key)))) return null;
    const copy: Record<string, unknown> = Object.create(null);
    for (const key of keys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return null;
      copy[key] = descriptor.value;
    }
    return frozen(copy);
  } catch { return null; }
}

/** Array preflight bounds own keys before reading its length descriptor or any element descriptor. */
function array(value: unknown, maximum: number): readonly unknown[] | null {
  try {
    if (typeof value !== 'object' || value === null || proxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length > maximum + 1 || keys.some((key) => typeof key !== 'string')) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (!lengthDescriptor || !('value' in lengthDescriptor) || typeof lengthDescriptor.value !== 'number' || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0 || lengthDescriptor.value > maximum) return null;
    const length = lengthDescriptor.value;
    if (keys.length !== length + 1 || !keys.includes('length')) return null;
    const copy: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const key = String(index);
      if (!keys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return null;
      copy.push(descriptor.value);
    }
    return frozen(copy);
  } catch { return null; }
}

function snapshotRow(value: unknown): RowSnapshot {
  const source = record(value, lowSensitiveCustomerImportAllowedFields.length + 16, null);
  if (!source) return frozen({ kind: 'rejected', reasons: frozen(['unsafe_payload']), institutionIdField: false });
  const reasons = new Set<Rejected['reasons'][number]>();
  let institutionIdField = false;
  const copy: Record<string, string | null | undefined> = Object.create(null);
  for (const key of Reflect.ownKeys(source) as string[]) {
    const valueAtKey = source[key];
    if (isSensitiveField(key)) reasons.add('sensitive_field_detected');
    else if (!allowed.has(key)) { reasons.add('unsupported_field'); institutionIdField ||= key === 'institutionId'; }
    if (valueAtKey !== null && valueAtKey !== undefined) {
      const scalar = text(valueAtKey);
      if (scalar === null) reasons.add('unsafe_payload'); else copy[key] = scalar;
    } else copy[key] = valueAtKey as null | undefined;
  }
  if (reasons.size > 0) return frozen({ kind: 'rejected', reasons: frozen([...reasons]), institutionIdField });
  return frozen({ kind: 'accepted', row: frozen(copy) });
}

function snapshotCustomer(value: unknown): CustomerRecordSummary | null {
  const source = record(value, customerKeys.length, customerKeys);
  if (!source || customerKeys.some((key) => !(key in source))) return null;
  const tags = array(source.tags, MAX_TAGS);
  if (!tags || !tags.every((tag) => text(tag) !== null)) return null;
  for (const key of customerKeys) if (key !== 'tags' && key !== 'institutionId' && text(source[key]) === null) return null;
  if (source.institutionId !== null && text(source.institutionId) === null) return null;
  return frozen({ id: source.id as string, tenantId: source.tenantId as string, institutionId: source.institutionId as string | null, displayName: source.displayName as string, lifecycle: source.lifecycle as CustomerLifecycleStage, priority: source.priority as CustomerPriority, ownerUserId: source.ownerUserId as string, projectInterest: source.projectInterest as string, maskedPhone: source.maskedPhone as string, maskedMedicalRecordNo: source.maskedMedicalRecordNo as string, lastTouchSummary: source.lastTouchSummary as string, nextAction: source.nextAction as string, tags: frozen(tags as string[]), gender: source.gender as string, birthDate: source.birthDate as string, referralSource: source.referralSource as string, notes: source.notes as string });
}

function inputSnapshot(input: unknown): SafeInput | null {
  const source = record(input, inputKeys.length, inputKeys);
  if (!source || !['tenantId', 'operatorRef', 'rows', 'occurredAt'].every((key) => key in source)) return null;
  const tenantId = text(source.tenantId, MAX_METADATA); const operatorRef = text(source.operatorRef, MAX_METADATA); const occurredAt = text(source.occurredAt, MAX_METADATA);
  if (!tenantId || !operatorRef || !occurredAt) return null;
  if (source.institutionId !== undefined && source.institutionId !== null && text(source.institutionId, MAX_METADATA) === null) return null;
  if (source.importBatchId !== undefined && text(source.importBatchId, MAX_METADATA) === null) return null;
  const rawRows = array(source.rows, MAX_ROWS); if (!rawRows) return null;
  const rows = frozen(rawRows.map(snapshotRow));
  const rawExisting = source.existingCustomers === undefined ? frozen([]) : array(source.existingCustomers, MAX_EXISTING); if (!rawExisting) return null;
  const existing: CustomerRecordSummary[] = [];
  for (const candidate of rawExisting) { const customer = snapshotCustomer(candidate); if (!customer) return null; existing.push(customer); }
  return frozen({ tenantId, institutionId: source.institutionId as string | null | undefined, operatorRef, rows, existing: frozen(existing), occurredAt, importBatchId: source.importBatchId as string | undefined });
}

function compact(value: string | null | undefined, fallback = '') { const normalized = typeof value === 'string' ? value.normalize('NFKC').trim() : ''; return normalized || fallback; }
function hash(value: string) { let result = 0; for (let index = 0; index < value.length; index += 1) result = (result * 31 + value.charCodeAt(index)) >>> 0; return result.toString(36); }
function candidate(row: SafeRecord) { const imported = compact(row.importedCustomerRef); if (imported) return `imported_ref:${imported}`; const name = compact(row.customerDisplayName).toLowerCase(), date = compact(row.lastVisitDate), project = compact(row.treatmentProject).toLowerCase(); return name && date && project ? `candidate:${name}|${date}|${project}` : null; }
function candidateTag(key: string) { return `import_candidate:${hash(key)}`; }
function validDate(value: string) { const found = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value); if (!found) return false; const [, y, m, d] = found; const month = Number(m), day = Number(d); return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(Number(y), month, 0)).getUTCDate(); }
function duplicateKeys(existing: readonly CustomerRecordSummary[], institutionId: string | null | undefined) { const keys = new Set<string>(); for (const item of existing) { if (!institutionId || item.institutionId !== institutionId) continue; for (const tag of item.tags) if (tag.startsWith('imported_ref:') || tag.startsWith('import_candidate:')) keys.add(tag); const date = /最近到访:(\d{4}-\d{2}-\d{2})/u.exec(item.lastTouchSummary)?.[1]; if (item.displayName && item.projectInterest && date) { const key = `candidate:${item.displayName.toLowerCase()}|${date}|${item.projectInterest.toLowerCase()}`; keys.add(key); keys.add(candidateTag(key)); } } return keys; }
function issue(reason: CustomerImportFailureReason, message: string, field?: string): CustomerImportRowIssue { return field ? { reason, field, message } : { reason, message }; }
function blocked(rowNumber: number, reasons: readonly Rejected['reasons'][number][], institutionIdField: boolean): CustomerImportRow { return { rowNumber, status: 'skipped', customerDisplayName: null, importedCustomerRef: null, duplicateKey: null, issues: reasons.map((reason) => issue(reason, reason === 'sensitive_field_detected' ? '导入行包含高敏字段，已阻断' : reason === 'unsupported_field' ? '导入行包含未批准字段，已阻断' : '导入行格式不安全，已阻断', reason === 'unsupported_field' && institutionIdField ? 'institutionId' : undefined)) }; }
function validate(snapshot: RowSnapshot, rowNumber: number, seen: Set<string>, existing: Set<string>): CustomerImportRow {
  if (snapshot.kind === 'rejected') return blocked(rowNumber, snapshot.reasons, snapshot.institutionIdField);
  const row = snapshot.row, issues: CustomerImportRowIssue[] = [];
  const add = (next: CustomerImportRowIssue) => { if (!issues.some((item) => item.reason === next.reason && item.field === next.field)) issues.push(next); };
  if (Object.keys(row).every((key) => !compact(row[key]))) add(issue('empty_row', '导入行为空'));
  if (!compact(row.customerDisplayName)) add(issue('missing_required_field', '字段 customerDisplayName 必填', 'customerDisplayName'));
  for (const field of ['lastVisitDate', 'nextFollowUpDate'] as const) { const value = compact(row[field]); if (value && !validDate(value)) add(issue('invalid_date', `字段 ${field} 必须使用 YYYY-MM-DD`, field)); }
  for (const key of Object.keys(row)) { const value = compact(row[key]); if (value && (sensitiveValue(value) || rawRef(key, value))) add(issue('sensitive_field_detected', '导入行包含疑似高敏内容，已阻断')); }
  const key = candidate(row), stored = key?.startsWith('candidate:') ? candidateTag(key) : key;
  if (key && stored) { if (seen.has(key) || seen.has(stored) || existing.has(key) || existing.has(stored)) add(issue('duplicated_customer', '当前租户 / 机构内发现重复客户候选')); seen.add(key); seen.add(stored); }
  const ready = issues.length === 0;
  return { rowNumber, status: ready ? 'ready' : 'skipped', customerDisplayName: ready ? compact(row.customerDisplayName) || null : null, importedCustomerRef: ready ? compact(row.importedCustomerRef) || null : null, duplicateKey: ready ? key : null, issues };
}
function unsafe(): CustomerImportPreviewResult { const rows = [blocked(1, ['unsafe_payload'], false)]; return { importBatch: { importBatchId: 'customer-import:unsafe-payload', tenantId: '', institutionId: null, operatorRef: '', fieldWhitelist: [...lowSensitiveCustomerImportAllowedFields], rows, createdAt: '', updatedAt: '' }, totalCount: 1, successCount: 0, failureCount: 1, skippedCount: 1, canExecute: false, boundary: customerImportBoundary }; }
function previewPrepared(input: SafeInput): CustomerImportPreviewResult { const seen = new Set<string>(), existing = duplicateKeys(input.existing, input.institutionId); const rows = input.rows.map((row, index) => validate(row, index + 1, seen, existing)); const successCount = rows.filter((row) => row.status === 'ready').length; const importBatchId = input.importBatchId || `customer-import:${hash([input.tenantId, input.institutionId || 'default-institution', input.operatorRef, input.occurredAt, String(input.rows.length)].join('|'))}`; return { importBatch: { importBatchId, tenantId: input.tenantId, institutionId: input.institutionId ?? null, operatorRef: input.operatorRef, fieldWhitelist: [...lowSensitiveCustomerImportAllowedFields], rows, createdAt: input.occurredAt, updatedAt: input.occurredAt }, totalCount: rows.length, successCount, failureCount: rows.length - successCount, skippedCount: rows.length - successCount, canExecute: successCount > 0, boundary: customerImportBoundary }; }

export function previewLowSensitiveCustomerImport(input: CustomerImportPreviewInput): CustomerImportPreviewResult { const safe = inputSnapshot(input); return safe ? previewPrepared(safe) : unsafe(); }
function draft(input: { tenantId: string; institutionId: string; row: SafeRecord; rowNumber: number; importBatchId: string }): CustomerImportCreateCustomerDraft { const imported = compact(input.row.importedCustomerRef) || `row-${input.rowNumber}`, project = compact(input.row.treatmentProject, '未指定项目'), stage = compact(input.row.customerStage), lifecycle: CustomerLifecycleStage = ({ consulting: 'consulting', scheduled: 'scheduled', post_care: 'post_care', repurchase_window: 'repurchase_window', silent_reactivation: 'silent_reactivation', 咨询中: 'consulting', 已预约: 'scheduled', 术后护理: 'post_care', 复购窗口: 'repurchase_window', 沉默激活: 'silent_reactivation' } as Record<string, CustomerLifecycleStage>)[stage] || 'consulting', priority: CustomerPriority = lifecycle === 'post_care' ? 'high' : 'observe', key = candidate(input.row) || `candidate:${compact(input.row.customerDisplayName).toLowerCase()}||${project.toLowerCase()}`; return { id: `cust_import_${hash(`${input.tenantId}|${input.institutionId}|${imported}|${input.rowNumber}`)}`, tenantId: input.tenantId, institutionId: input.institutionId, displayName: compact(input.row.customerDisplayName), lifecycle, priority, ownerUserId: compact(input.row.ownerEmployeeRef) || compact(input.row.ownerEmployeeName, 'import-operator'), projectInterest: project, maskedPhone: 'masked-import-only', maskedMedicalRecordNo: 'masked-import-record', lastTouchSummary: compact(input.row.lastVisitDate) ? `最近到访:${compact(input.row.lastVisitDate)}` : '低敏导入客户，暂无最近到访日期', nextAction: compact(input.row.nextFollowUpDate) ? `下次随访:${compact(input.row.nextFollowUpDate)}` : '导入后进入人工运营队列', tags: [...new Set(['低敏导入', `imported_ref:${imported}`, candidateTag(key), compact(input.row.sourceChannel), compact(input.row.tagSummary)].filter(Boolean))], gender: compact(input.row.gender, '未指定'), birthDate: compact(input.row.ageRange) || compact(input.row.birthYear) ? `低敏年龄:${compact(input.row.ageRange) || compact(input.row.birthYear)}` : '未提供完整生日', referralSource: compact(input.row.sourceChannel, '低敏客户导入'), notes: [`importBatch:${input.importBatchId}`, `importedCustomerRef:${imported}`, compact(input.row.externalCustomerRef) ? `externalCustomerRef:${compact(input.row.externalCustomerRef)}` : '', compact(input.row.customerAlias) ? `alias:${compact(input.row.customerAlias)}` : '', compact(input.row.noteSummary) ? `noteSummary:${compact(input.row.noteSummary)}` : ''].filter(Boolean).join('；') }; }
export function getCustomerImportRowsForExecution(input: CustomerImportPreviewInput & { institutionId: string }) { const safe = inputSnapshot(input); if (!safe || typeof safe.institutionId !== 'string') return { preview: unsafe(), drafts: [] as CustomerImportCreateCustomerDraft[] }; const institutionId = safe.institutionId, preview = previewPrepared(safe), ready = new Set(preview.importBatch.rows.filter((row) => row.status === 'ready').map((row) => row.rowNumber)); return { preview, drafts: safe.rows.flatMap((row, index) => row.kind === 'accepted' && ready.has(index + 1) ? [draft({ tenantId: safe.tenantId, institutionId, row: row.row, rowNumber: index + 1, importBatchId: preview.importBatch.importBatchId })] : []) }; }
