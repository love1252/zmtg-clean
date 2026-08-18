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
