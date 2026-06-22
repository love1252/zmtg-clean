import type { FollowUpRiskLevel } from '@/modules/institution/domain/followup-workflow';

export const treatmentSummaryVoidReasonCodes = [
  'duplicate_summary',
  'created_by_mistake',
  'wrong_customer_or_appointment',
  'entered_wrong_treatment',
  'manual_governance_review',
  'other',
] as const;

export type TreatmentSummaryVoidReasonCode = (typeof treatmentSummaryVoidReasonCodes)[number];
export type TreatmentSummaryStatus = 'active' | 'voided';

export type TreatmentSummaryVoidFields = {
  status: TreatmentSummaryStatus;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReasonCode: TreatmentSummaryVoidReasonCode | null;
  voidReason: string | null;
};

export type TreatmentSummaryRecord = {
  id: string;
  tenantId: string;
  customerId: string;
  appointmentId: string | null;
  treatmentDate: string;
  treatmentProject: string;
  treatmentCategory: string;
  treatmentStage: string;
  recoveryStage: string;
  riskLevel: FollowUpRiskLevel;
  ownerUserId: string;
  summary: string;
  nextCareAction: string;
  tags: string[];
} & TreatmentSummaryVoidFields & {
  createdAt: string;
  updatedAt: string;
};

export type CustomerTimelineTreatmentSummary = Omit<
  TreatmentSummaryRecord,
  'tenantId' | 'customerId'
>;

export type InstitutionTreatmentSummaryListItem = Omit<TreatmentSummaryRecord, 'tenantId'>;

export type TreatmentSummaryListFilters = {
  customerId?: string;
  treatmentProject?: string;
  riskLevel?: FollowUpRiskLevel;
  from?: string;
  to?: string;
};

export type TreatmentSummaryListCursor = {
  treatmentDate: string;
  id: string;
};

export type TreatmentSummaryListQuery = {
  filters: TreatmentSummaryListFilters;
  limit: number;
  cursor?: TreatmentSummaryListCursor;
};

export type TreatmentSummaryListPageInfo = {
  hasMore: boolean;
  limit: number;
  nextCursor: string | null;
};

export type InstitutionTreatmentSummaryListResponse = {
  records: InstitutionTreatmentSummaryListItem[];
  pageInfo: TreatmentSummaryListPageInfo;
};

export type CreateTreatmentSummaryDraft = Pick<
  TreatmentSummaryRecord,
  | 'appointmentId'
  | 'treatmentDate'
  | 'treatmentProject'
  | 'treatmentCategory'
  | 'treatmentStage'
  | 'recoveryStage'
  | 'riskLevel'
  | 'ownerUserId'
  | 'summary'
  | 'nextCareAction'
  | 'tags'
>;

export type UpdateTreatmentSummaryDraft = Partial<CreateTreatmentSummaryDraft>;

export type VoidTreatmentSummaryDraft = {
  reasonCode: TreatmentSummaryVoidReasonCode;
  reasonText: string;
};

export function deriveTreatmentSummaryStatus(
  voidedAt: string | null | undefined,
): TreatmentSummaryStatus {
  return voidedAt ? 'voided' : 'active';
}

export function mapTreatmentSummaryRecordToTimelineDto(
  record: TreatmentSummaryRecord,
): CustomerTimelineTreatmentSummary {
  return {
    id: record.id,
    appointmentId: record.appointmentId,
    treatmentDate: record.treatmentDate,
    treatmentProject: record.treatmentProject,
    treatmentCategory: record.treatmentCategory,
    treatmentStage: record.treatmentStage,
    recoveryStage: record.recoveryStage,
    riskLevel: record.riskLevel,
    ownerUserId: record.ownerUserId,
    summary: record.summary,
    nextCareAction: record.nextCareAction,
    tags: [...record.tags],
    status: record.status,
    voidedAt: record.voidedAt,
    voidedBy: record.voidedBy,
    voidReasonCode: record.voidReasonCode,
    voidReason: record.voidReason,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function mapTreatmentSummaryRecordToListItem(
  record: TreatmentSummaryRecord,
): InstitutionTreatmentSummaryListItem {
  return {
    id: record.id,
    customerId: record.customerId,
    appointmentId: record.appointmentId,
    treatmentDate: record.treatmentDate,
    treatmentProject: record.treatmentProject,
    treatmentCategory: record.treatmentCategory,
    treatmentStage: record.treatmentStage,
    recoveryStage: record.recoveryStage,
    riskLevel: record.riskLevel,
    ownerUserId: record.ownerUserId,
    summary: record.summary,
    nextCareAction: record.nextCareAction,
    tags: [...record.tags],
    status: record.status,
    voidedAt: record.voidedAt,
    voidedBy: record.voidedBy,
    voidReasonCode: record.voidReasonCode,
    voidReason: record.voidReason,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
