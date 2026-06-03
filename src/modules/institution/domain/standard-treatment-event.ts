import type { FollowUpRiskLevel } from '@/modules/institution/domain/followup-workflow';

export const STANDARD_TREATMENT_EVENT_SOURCE_SYSTEMS = [
  'his',
  'manual',
  'import',
  'other',
] as const;

export type StandardTreatmentEventSourceSystem =
  (typeof STANDARD_TREATMENT_EVENT_SOURCE_SYSTEMS)[number];

export const STANDARD_TREATMENT_EVENT_STATUSES = [
  'planned',
  'performed',
  'completed',
  'cancelled',
  'revised',
] as const;

export type StandardTreatmentEventStatus =
  (typeof STANDARD_TREATMENT_EVENT_STATUSES)[number];

export const STANDARD_TREATMENT_EVENT_RISK_LEVELS = [
  'normal',
  'watch',
  'urgent',
] as const satisfies readonly FollowUpRiskLevel[];

export type StandardTreatmentEventRiskLevel =
  (typeof STANDARD_TREATMENT_EVENT_RISK_LEVELS)[number];

export const STANDARD_TREATMENT_EVENT_RAW_SOURCE_TYPES = [
  'treatment_record',
  'appointment',
  'order',
  'course_progress',
  'manual_review',
  'other',
] as const;

export type StandardTreatmentEventRawSourceType =
  (typeof STANDARD_TREATMENT_EVENT_RAW_SOURCE_TYPES)[number];

export const STANDARD_TREATMENT_EVENT_MAPPING_WARNING_CODES = [
  'unknown_treatment_category',
  'missing_recovery_stage',
  'external_event_id_missing',
  'appointment_external_id_missing',
  'customer_external_id_missing',
  'manual_review_required',
  'category_mapped_by_alias',
  'external_status_mapped_to_default',
] as const;

export type StandardTreatmentEventMappingWarningCode =
  (typeof STANDARD_TREATMENT_EVENT_MAPPING_WARNING_CODES)[number];

export const STANDARD_TREATMENT_EVENT_ALLOWED_INPUT_KEYS = [
  'sourceSystem',
  'sourceEventId',
  'sourceCustomerId',
  'customerMatchKey',
  'customerName',
  'maskedPhone',
  'treatmentDate',
  'treatmentProject',
  'treatmentCategory',
  'treatmentStage',
  'recoveryStage',
  'treatmentStatus',
  'rawSourceType',
  'appointmentRef',
  'doctorRef',
  'operatorRef',
  'departmentRef',
  'amount',
  'currency',
  'riskLevel',
  'summary',
  'nextCareAction',
  'tags',
  'mappingWarnings',
  'occurredAt',
] as const;

export type StandardTreatmentEventAllowedInputKey =
  (typeof STANDARD_TREATMENT_EVENT_ALLOWED_INPUT_KEYS)[number];

export const STANDARD_TREATMENT_EVENT_FORBIDDEN_FIELDS = [
  'rawPayload',
  'hisRawPayload',
  'hisRawResponse',
  'externalRawPayload',
  'externalSystemPayload',
  'requestBody',
  'medicalRecordBody',
  'medicalRecordText',
  'treatmentRecordBody',
  'fullTreatmentRecord',
  'diagnosisText',
  'clinicalNote',
  'consultationTranscript',
  'phoneNumber',
  'phone',
  'rawPhone',
  'idNumber',
  'identityNumber',
  'medicalRecordNo',
  'rawMedicalRecordNo',
  'imageUrl',
  'fileUrl',
  'beforePhotoUrl',
  'afterPhotoUrl',
  'photoUrl',
  'fileContent',
  'aiGeneratedContent',
  'aiPrompt',
  'aiCompletion',
  'embedding',
  'token',
  'secret',
  'apiKey',
  'oauthToken',
  'webhookSecret',
  'databaseUrl',
  'sql',
  'stack',
] as const;

export type StandardTreatmentEventForbiddenField =
  (typeof STANDARD_TREATMENT_EVENT_FORBIDDEN_FIELDS)[number];

export type StandardTreatmentEventMapperInput = Partial<
  Record<StandardTreatmentEventAllowedInputKey, unknown>
>;

// 标准治疗事件是未来 HIS / 导入 / 外部系统进入智美天工后的标准化事件。
// treatment_summaries 仍是机构端可查看和运营使用的结构化摘要，本模型不自动生成摘要。
export type StandardTreatmentEvent = {
  eventId: string;
  tenantId: string;
  sourceSystem: StandardTreatmentEventSourceSystem;
  sourceEventId: string | null;
  sourceCustomerId: string | null;
  customerMatchKey: string | null;
  customerName: string | null;
  maskedPhone: string | null;
  treatmentDate: string;
  treatmentProject: string;
  treatmentCategory: string;
  treatmentStage: string;
  recoveryStage: string | null;
  treatmentStatus: StandardTreatmentEventStatus;
  rawSourceType: StandardTreatmentEventRawSourceType | null;
  appointmentRef: string | null;
  doctorRef: string | null;
  operatorRef: string | null;
  departmentRef: string | null;
  amount: string | null;
  currency: string | null;
  riskLevel: StandardTreatmentEventRiskLevel;
  summary: string;
  nextCareAction: string;
  tags: string[];
  mappingWarnings: StandardTreatmentEventMappingWarningCode[];
  occurredAt: string;
  receivedAt: string;
};
