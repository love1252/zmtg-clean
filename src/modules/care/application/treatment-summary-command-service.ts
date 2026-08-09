export type TreatmentSummaryRiskLevel = 'normal' | 'watch' | 'urgent';

export const treatmentSummaryCommandVoidReasonCodes = [
  'duplicate_summary',
  'created_by_mistake',
  'wrong_customer_or_appointment',
  'entered_wrong_treatment',
  'manual_governance_review',
  'other',
] as const;

export type TreatmentSummaryCommandVoidReasonCode =
  (typeof treatmentSummaryCommandVoidReasonCodes)[number];

export type TreatmentSummaryCommandAttribution = Readonly<{
  tenantId: string;
  institutionId: string;
}>;

export type TreatmentSummaryCommandFields = {
  appointmentId: string | null;
  treatmentDate: Date;
  treatmentProject: string;
  treatmentCategory: string;
  treatmentStage: string;
  recoveryStage: string;
  riskLevel: TreatmentSummaryRiskLevel;
  ownerUserId: string;
  summary: string;
  nextCareAction: string;
  tags: string[];
};

export type TreatmentSummaryCommandRecord = TreatmentSummaryCommandAttribution &
  Readonly<{
    id: string;
    customerId: string;
    appointmentId: string | null;
    treatmentDate: string;
    treatmentProject: string;
    treatmentCategory: string;
    treatmentStage: string;
    recoveryStage: string;
    riskLevel: TreatmentSummaryRiskLevel;
    ownerUserId: string;
    summary: string;
    nextCareAction: string;
    tags: string[];
    status: 'active' | 'voided';
    voidedAt: string | null;
    voidedBy: string | null;
    voidReasonCode: TreatmentSummaryCommandVoidReasonCode | null;
    voidReason: string | null;
    createdAt: string;
    updatedAt: string;
  }>;

export type TreatmentSummaryInvalidReferenceReason =
  | 'customer_not_found_or_not_owned'
  | 'appointment_not_found_or_not_owned';

export type CreateTreatmentSummaryCommandResult =
  | { kind: 'created'; record: TreatmentSummaryCommandRecord }
  | { kind: 'not_found_or_not_owned' }
  | { kind: 'invalid_reference'; reason: TreatmentSummaryInvalidReferenceReason };

export type UpdateTreatmentSummaryCommandResult =
  | { kind: 'updated'; record: TreatmentSummaryCommandRecord }
  | { kind: 'not_found_or_not_owned' }
  | { kind: 'invalid_reference'; reason: TreatmentSummaryInvalidReferenceReason };

export type VoidTreatmentSummaryCommandResult =
  | { kind: 'voided'; record: TreatmentSummaryCommandRecord }
  | { kind: 'already_voided'; record: TreatmentSummaryCommandRecord }
  | { kind: 'not_found_or_not_owned' };

export type CreateTreatmentSummaryCommand = Readonly<{
  attribution: TreatmentSummaryCommandAttribution;
  treatmentSummary: TreatmentSummaryCommandFields & Readonly<{
    id: string;
    customerId: string;
  }>;
}>;

export type UpdateTreatmentSummaryCommand = Readonly<{
  attribution: TreatmentSummaryCommandAttribution;
  summaryId: string;
  changes: Partial<TreatmentSummaryCommandFields>;
}>;

export type VoidTreatmentSummaryCommand = Readonly<{
  attribution: TreatmentSummaryCommandAttribution;
  summaryId: string;
  voidedBy: string;
  reasonCode: TreatmentSummaryCommandVoidReasonCode;
  reasonText: string;
}>;

export interface TreatmentSummaryCommandRepository {
  create(
    input: TreatmentSummaryCommandAttribution &
      TreatmentSummaryCommandFields &
      Readonly<{ id: string; customerId: string }>,
  ): Promise<CreateTreatmentSummaryCommandResult>;

  update(
    input: TreatmentSummaryCommandAttribution &
      Readonly<{
        summaryId: string;
        changes: Partial<TreatmentSummaryCommandFields>;
      }>,
  ): Promise<UpdateTreatmentSummaryCommandResult>;

  void(
    input: TreatmentSummaryCommandAttribution &
      Readonly<{
        summaryId: string;
        voidedBy: string;
        reasonCode: TreatmentSummaryCommandVoidReasonCode;
        reasonText: string;
      }>,
  ): Promise<VoidTreatmentSummaryCommandResult>;
}

export class TreatmentSummaryCommandInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TreatmentSummaryCommandInputError';
  }
}

function requireExactIdentifier(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new TreatmentSummaryCommandInputError(`invalid_${field}`);
  }
  return value;
}

function normalizeAttribution(
  attribution: TreatmentSummaryCommandAttribution,
): TreatmentSummaryCommandAttribution {
  return {
    tenantId: requireExactIdentifier(attribution?.tenantId, 'tenant_id'),
    institutionId: requireExactIdentifier(attribution?.institutionId, 'institution_id'),
  };
}

function copyDate(value: Date): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TreatmentSummaryCommandInputError('invalid_treatment_date');
  }
  return new Date(value.getTime());
}

function copyTags(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new TreatmentSummaryCommandInputError('invalid_tags');
  }
  return [...value];
}

function copyOptionalIdentifier(value: string | null, field: string) {
  return value === null ? null : requireExactIdentifier(value, field);
}

function copyCreate(
  input: CreateTreatmentSummaryCommand['treatmentSummary'],
): CreateTreatmentSummaryCommand['treatmentSummary'] {
  return {
    id: requireExactIdentifier(input.id, 'summary_id'),
    customerId: requireExactIdentifier(input.customerId, 'customer_id'),
    appointmentId: copyOptionalIdentifier(input.appointmentId, 'appointment_id'),
    treatmentDate: copyDate(input.treatmentDate),
    treatmentProject: input.treatmentProject,
    treatmentCategory: input.treatmentCategory,
    treatmentStage: input.treatmentStage,
    recoveryStage: input.recoveryStage,
    riskLevel: input.riskLevel,
    ownerUserId: requireExactIdentifier(input.ownerUserId, 'owner_user_id'),
    summary: input.summary,
    nextCareAction: input.nextCareAction,
    tags: copyTags(input.tags),
  };
}

function copyChanges(
  changes: Partial<TreatmentSummaryCommandFields>,
): Partial<TreatmentSummaryCommandFields> {
  const result: Partial<TreatmentSummaryCommandFields> = {};
  if (changes.appointmentId !== undefined) {
    result.appointmentId = copyOptionalIdentifier(changes.appointmentId, 'appointment_id');
  }
  if (changes.treatmentDate !== undefined) result.treatmentDate = copyDate(changes.treatmentDate);
  if (changes.treatmentProject !== undefined) result.treatmentProject = changes.treatmentProject;
  if (changes.treatmentCategory !== undefined) result.treatmentCategory = changes.treatmentCategory;
  if (changes.treatmentStage !== undefined) result.treatmentStage = changes.treatmentStage;
  if (changes.recoveryStage !== undefined) result.recoveryStage = changes.recoveryStage;
  if (changes.riskLevel !== undefined) result.riskLevel = changes.riskLevel;
  if (changes.ownerUserId !== undefined) {
    result.ownerUserId = requireExactIdentifier(changes.ownerUserId, 'owner_user_id');
  }
  if (changes.summary !== undefined) result.summary = changes.summary;
  if (changes.nextCareAction !== undefined) result.nextCareAction = changes.nextCareAction;
  if (changes.tags !== undefined) result.tags = copyTags(changes.tags);
  return result;
}

export function createTreatmentSummaryCommandService(
  repository: TreatmentSummaryCommandRepository,
) {
  return Object.freeze({
    async createTreatmentSummary(input: CreateTreatmentSummaryCommand) {
      return repository.create({
        ...normalizeAttribution(input.attribution),
        ...copyCreate(input.treatmentSummary),
      });
    },

    async updateTreatmentSummary(input: UpdateTreatmentSummaryCommand) {
      return repository.update({
        ...normalizeAttribution(input.attribution),
        summaryId: requireExactIdentifier(input.summaryId, 'summary_id'),
        changes: copyChanges(input.changes),
      });
    },

    async voidTreatmentSummary(input: VoidTreatmentSummaryCommand) {
      return repository.void({
        ...normalizeAttribution(input.attribution),
        summaryId: requireExactIdentifier(input.summaryId, 'summary_id'),
        voidedBy: requireExactIdentifier(input.voidedBy, 'voided_by'),
        reasonCode: input.reasonCode,
        reasonText: input.reasonText,
      });
    },
  });
}
