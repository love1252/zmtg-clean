import type { FollowUpManualFeedback } from '@/modules/care/domain/follow-up-completion-result';
import type { FollowUpRolePoolRole } from '@/modules/care/domain/follow-up-assignment';
import type {
  FollowUpCancellationReason,
  FollowUpCompletionCode,
  FollowUpRiskEscalationKind,
  FollowUpTaskState,
} from '@/modules/care/domain/follow-up-task';
import type {
  FollowUpControlledActionCode,
  FollowUpControlledStageCode,
} from '@/modules/care/domain/follow-up-controlled-create';

export type FormalFollowUpDtoV1 = Readonly<{
  taskId: string;
  customer: Readonly<{
    customerId: string;
    displayName: string;
    maskedReference: string | null;
  }>;
  stageCode: FollowUpControlledStageCode;
  actionCode: FollowUpControlledActionCode;
  dueAt: string;
  state: FollowUpTaskState;
  revision: number;
  riskLevel: 'none' | 'high';
  riskKind: FollowUpRiskEscalationKind | null;
  completionCode: FollowUpCompletionCode | null;
  /** 仅任务详情和客户关联记录回显已经过低敏校验的完成摘要。 */
  completionFeedback?: FollowUpManualFeedback | null;
  cancellationReason: FollowUpCancellationReason | null;
  assignment:
    | Readonly<{
        kind: 'user';
        displayName: string;
        claimedFromRolePool: FollowUpRolePoolRole | null;
      }>
    | Readonly<{
        kind: 'role_pool';
        role: FollowUpRolePoolRole;
      }>;
  permissions: Readonly<{
    canClaim: boolean;
    canOperate: boolean;
    canReassign: boolean;
    canUnclaim: boolean;
    canCancel: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}>;
