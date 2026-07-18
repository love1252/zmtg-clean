import type { CustomerLifecycleStage, CustomerPriority, CustomerRecordSummary } from '@/modules/institution/domain/customer-records';

/** Client-safe DTOs and boundary metadata only. Server-side parsing lives in server/customer-import. */
export const lowSensitiveCustomerImportAllowedFields = [
  'customerDisplayName', 'customerAlias', 'gender', 'ageRange', 'birthYear',
  'customerStage', 'treatmentProject', 'lastVisitDate', 'nextFollowUpDate',
  'ownerEmployeeName', 'ownerEmployeeRef', 'sourceChannel', 'tagSummary',
  'noteSummary', 'externalCustomerRef', 'importedCustomerRef',
] as const;

export type LowSensitiveCustomerImportAllowedField = (typeof lowSensitiveCustomerImportAllowedFields)[number];
export type CustomerImportFailureReason =
  | 'missing_required_field' | 'unsupported_field' | 'sensitive_field_detected'
  | 'invalid_date' | 'duplicated_customer' | 'empty_row' | 'unsafe_payload';
export type CustomerImportRowInput = Partial<Record<LowSensitiveCustomerImportAllowedField, unknown>> & Record<string, unknown>;
export type CustomerImportRowStatus = 'ready' | 'skipped';
export type CustomerImportRowIssue = { reason: CustomerImportFailureReason; field?: string; message: string };
export type CustomerImportRow = { rowNumber: number; status: CustomerImportRowStatus; customerDisplayName: string | null; importedCustomerRef: string | null; duplicateKey: string | null; issues: CustomerImportRowIssue[] };
export type CustomerImportBatch = { importBatchId: string; tenantId: string; institutionId: string | null; operatorRef: string; fieldWhitelist: LowSensitiveCustomerImportAllowedField[]; rows: CustomerImportRow[]; createdAt: string; updatedAt: string };
export type CustomerImportBoundary = { mode: 'low_sensitive_customer_import'; supportsPreview: true; writesCustomerRecordsOnExecute: true; noHis: true; noRealWeCom: true; noSms: true; noWebhook: true; noRealSend: true; forbiddenData: string[] };
export type CustomerImportPreviewResult = { importBatch: CustomerImportBatch; totalCount: number; successCount: number; failureCount: number; skippedCount: number; canExecute: boolean; boundary: CustomerImportBoundary };
export type CustomerImportResult = CustomerImportPreviewResult & { importedCustomerIds: string[] };
export type CustomerImportPreviewInput = { tenantId: string; institutionId?: string | null; operatorRef: string; rows: readonly unknown[]; existingCustomers?: readonly CustomerRecordSummary[]; occurredAt: string; importBatchId?: string };
export type CustomerImportExecuteInput = CustomerImportPreviewInput;
export type CustomerImportCreateCustomerDraft = { id: string; tenantId: string; institutionId: string; displayName: string; lifecycle: CustomerLifecycleStage; priority: CustomerPriority; ownerUserId: string; projectInterest: string; maskedPhone: string; maskedMedicalRecordNo: string; lastTouchSummary: string; nextAction: string; tags: string[]; gender: string; birthDate: string; referralSource: string; notes: string };

export const customerImportBoundary: CustomerImportBoundary = Object.freeze({
  mode: 'low_sensitive_customer_import', supportsPreview: true, writesCustomerRecordsOnExecute: true,
  noHis: true, noRealWeCom: true, noSms: true, noWebhook: true, noRealSend: true,
  forbiddenData: ['真实手机号', '身份证', '病历号', '完整生日', '完整地址', '微信号', '真实 external_userid', '真实 userid', 'corpId', 'secret / token / API key', '聊天记录', 'HIS payload', '原始第三方接口返回'],
});
