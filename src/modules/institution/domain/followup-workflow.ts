import type { AccessContext, AccessDecision } from '@/modules/security/domain/access-control';
import { canAccessResource } from '@/modules/security/domain/access-control';

export type TenantBusinessDeniedReason = Extract<AccessDecision, { allowed: false }>['reason'];

export type TenantBusinessResult<T> =
  | { allowed: true; records: T[] }
  | { allowed: false; reason: TenantBusinessDeniedReason };

export type FollowUpStatus = 'scheduled' | 'due' | 'in_progress' | 'escalated' | 'completed' | 'cancelled';

export type FollowUpRiskLevel = 'normal' | 'watch' | 'urgent';

export type FollowUpTaskSource = 'treatment_summary' | null;

export type TenantFollowUpTask = {
  id: string;
  tenantId: string;
  customerId: string;
  customerDisplayName: string;
  journeyId: string;
  stage: string;
  status: FollowUpStatus;
  dueAt: string;
  suggestedAction: string;
  riskLevel: FollowUpRiskLevel;
  updatedBy: string | null;
  updatedAt: string | null;
  source?: FollowUpTaskSource;
  sourceTreatmentSummaryId?: string | null;
  sourceSuggestionKey?: string | null;
};

export type TenantFollowUpTaskSource = {
  source?: 'treatment_summary';
  sourceTreatmentSummaryId: string;
  sourceSuggestionKey: string;
};

export type TenantFollowUpTaskFromTreatmentSummarySuggestion = TenantFollowUpTask &
  TenantFollowUpTaskSource;

export type FollowUpTransitionResult =
  | { allowed: true; task: TenantFollowUpTask }
  | { allowed: false; reason: 'invalid_transition'; from: FollowUpStatus; to: FollowUpStatus };

const allowedTransitions: Record<FollowUpStatus, FollowUpStatus[]> = {
  scheduled: ['due', 'cancelled'],
  due: ['in_progress', 'escalated', 'cancelled'],
  in_progress: ['completed', 'escalated', 'cancelled'],
  escalated: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function listFollowUpTasksForAccess(input: {
  context: AccessContext;
  targetTenantId: string;
  tasks?: TenantFollowUpTask[];
}): TenantBusinessResult<TenantFollowUpTask> {
  const { context, targetTenantId, tasks = [] } = input;
  const decision = canAccessResource({
    context,
    resource: 'follow_up',
    action: 'read_own_tenant',
    targetTenantId,
  });

  if (!decision.allowed) {
    return { allowed: false, reason: decision.reason };
  }

  return {
    allowed: true,
    records: tasks.filter((task) => task.tenantId === context.tenantId),
  };
}

export function transitionFollowUpTask(input: {
  task: TenantFollowUpTask;
  nextStatus: FollowUpStatus;
  actorId: string;
  occurredAt: string;
}): FollowUpTransitionResult {
  const { task, nextStatus, actorId, occurredAt } = input;

  if (!allowedTransitions[task.status].includes(nextStatus)) {
    return {
      allowed: false,
      reason: 'invalid_transition',
      from: task.status,
      to: nextStatus,
    };
  }

  return {
    allowed: true,
    task: {
      ...task,
      status: nextStatus,
      updatedBy: actorId,
      updatedAt: occurredAt,
    },
  };
}
