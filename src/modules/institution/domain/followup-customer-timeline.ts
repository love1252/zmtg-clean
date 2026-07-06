import type { FollowUpRiskLevel } from '@/modules/institution/domain/followup-workflow';

export const followUpCustomerTimelineSourceTypes = [
  'path_enrollment',
  'followup_task',
  'message_draft',
  'manual_note',
] as const;

export const followUpCustomerTimelineEventTypes = [
  'followup_path_enrolled',
  'followup_path_cancelled',
  'followup_tasks_generated',
  'followup_task_status_changed',
  'followup_task_escalated',
  'message_draft_created',
  'message_draft_updated',
  'message_draft_approved',
  'message_draft_rejected',
  'message_draft_marked_sent',
  'manual_feedback_recorded',
] as const;

export type FollowUpCustomerTimelineSourceType = (typeof followUpCustomerTimelineSourceTypes)[number];
export type FollowUpCustomerTimelineEventType = (typeof followUpCustomerTimelineEventTypes)[number];

export type FollowUpCustomerTimelineEvent = {
  id: string;
  tenantId: string;
  institutionId: string | null;
  customerId: string;
  sourceType: FollowUpCustomerTimelineSourceType;
  sourceId: string;
  eventType: FollowUpCustomerTimelineEventType;
  eventTitle: string;
  safeSummary: string;
  riskLevel: FollowUpRiskLevel | null;
  occurredAt: string;
  safeActorRole: string | null;
  safeReasonCode: string;
  metadataJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type FollowUpCustomerTimelineEventDto = Pick<
  FollowUpCustomerTimelineEvent,
  | 'customerId'
  | 'sourceType'
  | 'sourceId'
  | 'eventType'
  | 'eventTitle'
  | 'safeSummary'
  | 'riskLevel'
  | 'occurredAt'
  | 'safeReasonCode'
> & {
  eventId: string;
};

export type FollowUpCustomerOverview = {
  activeEnrollmentCount: number;
  pendingTaskCount: number;
  overdueTaskCount: number;
  draftCount: number;
  approvedDraftCount: number;
  markedSentCount: number;
  escalatedCount: number;
};

export type FollowUpManualFeedbackPayload = {
  safeSummary: string;
  riskLevel: FollowUpRiskLevel;
  relatedTaskId?: string | null;
};

export type FollowUpCustomerTimelineResponse = {
  records: FollowUpCustomerTimelineEventDto[];
};

export type FollowUpCustomerOverviewResponse = {
  overview: FollowUpCustomerOverview;
};

const forbiddenTimelinePatterns = [
  /1[3-9]\d{9}/u,
  /\d{6}(?:19|20)\d{2}\d{2}\d{2}\d{3}[\dXx]/u,
  /\bMR[-_A-Z0-9]{3,}\b/iu,
  /完整治疗|完整病历|咨询全文|病历号|身份证|手机号原文/u,
  /\bHIS\b|his payload|externalSystemPayload/iu,
  /\b(?:provider|model|token|vendor|cost|prompt|raw ai response|secret|api key|baseUrl)\b/iu,
  /\b(?:postgres|mysql|mongodb|redis):\/\//iu,
  /\bselect\s+.+\s+from\b/iu,
];

function normalizeText(input: string | null | undefined, limit: number) {
  return (input ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim().slice(0, limit);
}

export function containsUnsafeFollowUpTimelineText(input: string) {
  return forbiddenTimelinePatterns.some((pattern) => pattern.test(input));
}

export function sanitizeFollowUpTimelineText(
  input: string | null | undefined,
  fallback: string,
  limit = 240,
) {
  const normalized = normalizeText(input, limit);
  if (!normalized || containsUnsafeFollowUpTimelineText(normalized)) {
    return fallback;
  }

  return normalized;
}

export function mapFollowUpCustomerTimelineEventToDto(
  event: FollowUpCustomerTimelineEvent,
): FollowUpCustomerTimelineEventDto {
  return {
    eventId: event.id,
    customerId: event.customerId,
    eventType: event.eventType,
    eventTitle: event.eventTitle,
    safeSummary: event.safeSummary,
    riskLevel: event.riskLevel,
    occurredAt: event.occurredAt,
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    safeReasonCode: event.safeReasonCode,
  };
}
