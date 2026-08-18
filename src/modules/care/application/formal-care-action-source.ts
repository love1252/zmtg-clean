import type {
  CareActionSourceV1,
  CareFollowUpActionItemV1,
} from '@/modules/institution-contracts/v1/care-action';
import { projectFollowUpBusinessDate } from '@/modules/care/domain/follow-up-business-time';
import type { FormalFollowUpTaskRecordV1 } from '@/modules/care/ports/formal-follow-up-store';

const ACTIVE_STATES = new Set([
  'pending',
  'in_progress',
  'waiting_customer',
  'escalated',
]);

export function buildFormalCareActionSourceV1(input: Readonly<{
  tenantId: string;
  institutionId: string;
  tasks: readonly FormalFollowUpTaskRecordV1[];
  referenceTime: string;
  timeZone: string;
  operatingContextVersion: string;
}>): CareActionSourceV1 {
  const nowDate = projectFollowUpBusinessDate({
    instant: input.referenceTime,
    timeZone: input.timeZone,
    operatingContextVersion: input.operatingContextVersion,
  });

  if (!nowDate) {
    return {
      contractVersion: 'v1',
      scope: {
        tenantId: input.tenantId,
        institutionId: input.institutionId,
      },
      readiness: 'unavailable',
      freshness: null,
      partitions: [
        'pending_confirmation_appointments',
        'reschedule_requested_appointments',
        'overdue_followups',
        'today_due_followups',
      ].map((key) => ({
        key,
        readiness: 'unavailable',
        freshness: null,
        failureCode: 'invalid_payload',
      })) as CareActionSourceV1['partitions'],
      data: null,
      failureCode: 'invalid_payload',
    };
  }

  const freshness = {
    observedAt: input.referenceTime,
    freshUntil: new Date(
      Date.parse(input.referenceTime) + 5_000,
    ).toISOString(),
  };

  const active = input.tasks.flatMap((task) => {
    if (
      task.tenantId !== input.tenantId
      || task.institutionId !== input.institutionId
      || !ACTIVE_STATES.has(task.state)
    ) {
      return [];
    }

    const due = projectFollowUpBusinessDate({
      instant: task.dueAt,
      timeZone: input.timeZone,
      operatingContextVersion: input.operatingContextVersion,
    });

    return due ? [{ task, dueDate: due.date }] : [];
  });

  const overdue = active.filter(({ dueDate }) => dueDate < nowDate.date);
  const today = active.filter(({ dueDate }) => dueDate === nowDate.date);

  const actions: CareFollowUpActionItemV1[] = active
    .filter(({ dueDate }) => dueDate <= nowDate.date)
    .map(({ task, dueDate }) => {
      const isOverdue = dueDate < nowDate.date;

      return {
        entityType: 'followup',
        objectId: task.taskId,
        sourceVersion: `v${task.revision}`,
        customer: {
          contractVersion: 'v1',
          customerId: task.customerId,
          displayName: task.customerDisplayName,
          maskedReference: task.customerMaskedReference,
        },
        cardKeys: [
          isOverdue
            ? 'overdue_followups'
            : 'today_due_followups',
        ],
        sortSignals: [
          ...(task.riskLevel === 'high'
            ? (['urgent', 'high_priority'] as const)
            : []),
          isOverdue ? 'overdue' : 'today',
        ],
        appointmentAt: null,
        dueAt: task.dueAt,
        slaAt: task.dueAt,
        riskLevel:
          task.riskLevel === 'high' ? 'urgent' : 'normal',
        priority:
          task.riskLevel === 'high' ? 'high' : 'normal',
        owner:
          task.assignment.kind === 'role_pool'
            ? {
                kind: 'role_pool',
                role: task.assignment.role,
              }
            : {
                kind: 'user',
                userId: task.assignment.userId,
                displayName: task.assignment.displayName,
              },
        safeSummary: null,
        businessState: task.state,
        detailHref: (
          `/hospital/care/followups/${encodeURIComponent(task.taskId)}`
        ) as `/hospital/care/followups/${string}`,
      } satisfies CareFollowUpActionItemV1;
    });

  return {
    contractVersion: 'v1',
    scope: {
      tenantId: input.tenantId,
      institutionId: input.institutionId,
    },
    readiness: 'partial',
    freshness: null,
    partitions: [
      {
        key: 'pending_confirmation_appointments',
        readiness: 'disabled',
        freshness: null,
        failureCode: 'not_released',
      },
      {
        key: 'reschedule_requested_appointments',
        readiness: 'disabled',
        freshness: null,
        failureCode: 'not_released',
      },
      {
        key: 'overdue_followups',
        readiness: overdue.length === 0 ? 'empty' : 'ready',
        freshness,
        failureCode: null,
      },
      {
        key: 'today_due_followups',
        readiness: today.length === 0 ? 'empty' : 'ready',
        freshness,
        failureCode: null,
      },
    ],
    data: {
      cards: [
        {
          key: 'overdue_followups',
          count: overdue.length,
          canonicalHref:
            '/hospital/care/followups?bucket=overdue',
        },
        {
          key: 'today_due_followups',
          count: today.length,
          canonicalHref:
            '/hospital/care/followups?bucket=today',
        },
      ],
      actions,
    },
    failureCode: 'data_incomplete',
  };
}
