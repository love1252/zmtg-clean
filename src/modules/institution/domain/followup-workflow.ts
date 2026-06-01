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

export const demoTenantFollowUpTasks: TenantFollowUpTask[] = [
  {
    id: 'fu_wang_d28',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_wang_repurchase',
    customerDisplayName: '王女士',
    journeyId: 'journey_repurchase',
    stage: 'D28 复购建议',
    status: 'due',
    dueAt: '2026-05-30T18:00:00+08:00',
    suggestedAction: '人工回访并推荐修复组合',
    riskLevel: 'urgent',
    updatedBy: null,
    updatedAt: null,
  },
  {
    id: 'fu_zhao_d3',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_zhao_care',
    customerDisplayName: '赵女士',
    journeyId: 'journey_post_care',
    stage: 'D3 异常反馈',
    status: 'due',
    dueAt: '2026-05-30T09:30:00+08:00',
    suggestedAction: '客服回访并记录恢复情况',
    riskLevel: 'urgent',
    updatedBy: null,
    updatedAt: null,
  },
  {
    id: 'fu_li_silent',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_li_silent',
    customerDisplayName: '李女士',
    journeyId: 'journey_silent',
    stage: '48h 沉默唤醒',
    status: 'scheduled',
    dueAt: '2026-05-31T10:00:00+08:00',
    suggestedAction: '发送轻量唤醒话术',
    riskLevel: 'normal',
    updatedBy: null,
    updatedAt: null,
  },
  {
    id: 'fu_other_tenant',
    tenantId: 'demo-tenant-002',
    customerId: 'cust_other_tenant',
    customerDisplayName: '周女士',
    journeyId: 'journey_other',
    stage: '跨租户演示任务',
    status: 'due',
    dueAt: '2026-05-30T12:00:00+08:00',
    suggestedAction: '不应被本租户读取',
    riskLevel: 'watch',
    updatedBy: null,
    updatedAt: null,
  },
];

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
  const { context, targetTenantId, tasks = demoTenantFollowUpTasks } = input;
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
