import type { AuditReason, AuditResult } from '@/modules/audit/domain/audit-events';
import type { AppointmentRecordSummary, AppointmentStatus } from '@/modules/institution/domain/appointment-records';
import type {
  CustomerLifecycleStage,
  CustomerPriority,
  CustomerRecordSummary,
} from '@/modules/institution/domain/customer-records';
import type {
  FollowUpRiskLevel,
  FollowUpStatus,
  TenantFollowUpTask,
} from '@/modules/institution/domain/followup-workflow';
import {
  mapTreatmentSummaryRecordToTimelineDto,
  type CustomerTimelineTreatmentSummary,
  type TreatmentSummaryRecord,
} from '@/modules/institution/domain/treatment-summaries';
import type {
  AccessContext,
  ProtectedAction,
  ProtectedResource,
} from '@/modules/security/domain/access-control';

export type CustomerTimelineCustomerSummary = {
  id: string;
  displayName: string;
  lifecycle: CustomerLifecycleStage;
  priority: CustomerPriority;
  projectInterest: string;
  maskedPhone: string;
  maskedMedicalRecordNo: string;
  ownerUserId: string;
  tags: string[];
  lastTouchSummary: string;
  nextAction: string;
};

export type CustomerTimelineAppointmentSummary = {
  id: string;
  project: string;
  scheduledAt: string;
  consultantUserId: string;
  status: AppointmentStatus;
  note: string;
};

export type CustomerTimelineFollowUpSummary = {
  id: string;
  journeyId: string;
  stage: string;
  status: FollowUpStatus;
  dueAt: string;
  suggestedAction: string;
  riskLevel: FollowUpRiskLevel;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type CustomerTimelineAuditSummary = {
  id: string;
  action: ProtectedAction;
  result: AuditResult;
  reason: AuditReason;
  actor: {
    id: string;
    role: AccessContext['role'];
  };
  occurredAt: string;
  resource: ProtectedResource;
  resourceId: string | null;
};

export type CustomerTimelineEvent = {
  id: string;
  type: 'customer_summary' | 'appointment' | 'follow_up' | 'treatment_summary' | 'audit';
  occurredAt: string | null;
  title: string;
  summary: string;
  status: string;
  source: ProtectedResource | 'treatment_summary';
  relatedRecordId: string;
  riskLevel?: FollowUpRiskLevel;
  tags?: string[];
};

export type CustomerTimelineResponse = {
  customer: CustomerTimelineCustomerSummary;
  appointments: CustomerTimelineAppointmentSummary[];
  followups: CustomerTimelineFollowUpSummary[];
  treatmentSummaries: CustomerTimelineTreatmentSummary[];
  auditEvents: CustomerTimelineAuditSummary[];
  timeline: CustomerTimelineEvent[];
};

type CustomerTimelineInput = {
  customer: CustomerRecordSummary;
  appointments: AppointmentRecordSummary[];
  followups: TenantFollowUpTask[];
  treatmentSummaries: TreatmentSummaryRecord[];
  auditEvents: CustomerTimelineAuditSummary[];
};

function toCustomerSummary(customer: CustomerRecordSummary): CustomerTimelineCustomerSummary {
  return {
    id: customer.id,
    displayName: customer.displayName,
    lifecycle: customer.lifecycle,
    priority: customer.priority,
    projectInterest: customer.projectInterest,
    maskedPhone: customer.maskedPhone,
    maskedMedicalRecordNo: customer.maskedMedicalRecordNo,
    ownerUserId: customer.ownerUserId,
    tags: [...customer.tags],
    lastTouchSummary: customer.lastTouchSummary,
    nextAction: customer.nextAction,
  };
}

function toAppointmentSummary(
  appointment: AppointmentRecordSummary,
): CustomerTimelineAppointmentSummary {
  return {
    id: appointment.id,
    project: appointment.project,
    scheduledAt: appointment.scheduledAt,
    consultantUserId: appointment.consultantUserId,
    status: appointment.status,
    note: appointment.note,
  };
}

function toFollowUpSummary(followUp: TenantFollowUpTask): CustomerTimelineFollowUpSummary {
  return {
    id: followUp.id,
    journeyId: followUp.journeyId,
    stage: followUp.stage,
    status: followUp.status,
    dueAt: followUp.dueAt,
    suggestedAction: followUp.suggestedAction,
    riskLevel: followUp.riskLevel,
    updatedBy: followUp.updatedBy,
    updatedAt: followUp.updatedAt,
  };
}

function toAuditSummary(auditEvent: CustomerTimelineAuditSummary): CustomerTimelineAuditSummary {
  return {
    id: auditEvent.id,
    action: auditEvent.action,
    result: auditEvent.result,
    reason: auditEvent.reason,
    actor: {
      id: auditEvent.actor.id,
      role: auditEvent.actor.role,
    },
    occurredAt: auditEvent.occurredAt,
    resource: auditEvent.resource,
    resourceId: auditEvent.resourceId,
  };
}

function eventTimestamp(event: CustomerTimelineEvent) {
  if (!event.occurredAt) return Number.NEGATIVE_INFINITY;

  const timestamp = Date.parse(event.occurredAt);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function sortTimelineEvents(events: CustomerTimelineEvent[]) {
  return [...events].sort((left, right) => {
    const timeDiff = eventTimestamp(right) - eventTimestamp(left);
    if (timeDiff !== 0) return timeDiff;

    return left.id.localeCompare(right.id);
  });
}

export function buildCustomerTimelineResponse(input: CustomerTimelineInput): CustomerTimelineResponse {
  const customer = toCustomerSummary(input.customer);
  const appointments = input.appointments.map(toAppointmentSummary);
  const followups = input.followups.map(toFollowUpSummary);
  const treatmentSummaries = input.treatmentSummaries.map(
    mapTreatmentSummaryRecordToTimelineDto,
  );
  const auditEvents = input.auditEvents.map(toAuditSummary).sort((left, right) => {
    const timeDiff = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
    if (timeDiff !== 0) return timeDiff;

    return left.id.localeCompare(right.id);
  });

  const timeline = sortTimelineEvents([
    ...auditEvents.map((event): CustomerTimelineEvent => ({
      id: `audit:${event.id}`,
      type: 'audit',
      occurredAt: event.occurredAt,
      title: `审计：${event.action}`,
      summary: `${event.result} / ${event.reason}`,
      status: event.result,
      source: event.resource,
      relatedRecordId: event.resourceId ?? event.id,
    })),
    ...appointments.map((appointment): CustomerTimelineEvent => ({
      id: `appointment:${appointment.id}`,
      type: 'appointment',
      occurredAt: appointment.scheduledAt,
      title: `${appointment.project}预约`,
      summary: appointment.note,
      status: appointment.status,
      source: 'appointment',
      relatedRecordId: appointment.id,
    })),
    ...followups.map((followUp): CustomerTimelineEvent => ({
      id: `follow_up:${followUp.id}`,
      type: 'follow_up',
      occurredAt: followUp.updatedAt ?? followUp.dueAt,
      title: followUp.stage,
      summary: followUp.suggestedAction,
      status: followUp.status,
      source: 'follow_up',
      relatedRecordId: followUp.id,
    })),
    ...treatmentSummaries.map((treatment): CustomerTimelineEvent => ({
      id: `treatment_summary:${treatment.id}`,
      type: 'treatment_summary',
      occurredAt: treatment.treatmentDate,
      title: `${treatment.treatmentProject} · ${treatment.treatmentStage}`,
      summary: treatment.summary,
      status: treatment.status === 'voided' ? 'voided' : treatment.riskLevel,
      source: 'treatment_summary',
      relatedRecordId: treatment.id,
      riskLevel: treatment.riskLevel,
      tags: treatment.status === 'voided' ? ['已作废', ...treatment.tags] : [...treatment.tags],
    })),
    {
      id: `customer:${customer.id}`,
      type: 'customer_summary',
      occurredAt: null,
      title: '客户摘要',
      summary: `${customer.lastTouchSummary}；下一步：${customer.nextAction}`,
      status: customer.lifecycle,
      source: 'customer',
      relatedRecordId: customer.id,
    },
  ]);

  return {
    customer,
    appointments,
    followups,
    treatmentSummaries,
    auditEvents,
    timeline,
  };
}
