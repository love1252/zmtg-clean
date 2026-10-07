import type { FollowUpRolePoolRole } from '@/modules/care/domain/follow-up-assignment';
import type {
  FormalFollowUpListQueryV1,
  FormalFollowUpListSummaryV1,
} from '@/modules/care/application/formal-follow-up-list-query';
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
import type { InstitutionRoleV1 } from '@/modules/institution-contracts/v1/institution-navigation';

export type FormalFollowUpAssignmentV1 =
  | Readonly<{
      kind: 'user';
      userId: string;
      displayName: string;
      claimedFromRolePool: FollowUpRolePoolRole | null;
    }>
  | Readonly<{
      kind: 'role_pool';
      role: FollowUpRolePoolRole;
    }>;

export type FormalFollowUpTaskRecordV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  taskId: string;
  customerId: string;
  customerDisplayName: string;
  customerMaskedReference: string | null;
  stageCode: FollowUpControlledStageCode;
  actionCode: FollowUpControlledActionCode;
  dueAt: string;
  state: FollowUpTaskState;
  revision: number;
  riskLevel: 'none' | 'high';
  riskKind: FollowUpRiskEscalationKind | null;
  riskEventId: string | null;
  completionCode: FollowUpCompletionCode | null;
  completionFeedback: string | null;
  cancellationReason: FollowUpCancellationReason | null;
  assignment: FormalFollowUpAssignmentV1;
  idempotencyKey: string;
  requestDigest: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}>;

export type FormalFollowUpEventTypeV1 =
  | 'created'
  | 'claimed'
  | 'reassigned'
  | 'unclaimed'
  | 'state_changed'
  | 'risk_escalated'
  | 'completed'
  | 'cancelled';

export type FormalFollowUpEventV1 = Readonly<{
  eventId: string;
  eventType: FormalFollowUpEventTypeV1;
  actorId: string;
  actorRole: InstitutionRoleV1;
  fromState: FollowUpTaskState | null;
  toState: FollowUpTaskState | null;
  reasonCode: string;
  occurredAt: string;
}>;

export type FormalFollowUpVisibilityV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  actorId: string;
  actorRole: InstitutionRoleV1;
}>;

export type FormalFollowUpPageQueryV1 = FormalFollowUpVisibilityV1 & Readonly<{
  query: FormalFollowUpListQueryV1;
  customerId?: string;
  businessDate: string | null;
  timeZone: string | null;
}>;

export type FormalFollowUpPageV1 = Readonly<{
  records: readonly FormalFollowUpTaskRecordV1[];
  summary: FormalFollowUpListSummaryV1;
}>;

export const FORMAL_FOLLOW_UP_WORKBENCH_LIMIT_V1 = 6 as const;

export type FormalFollowUpWorkbenchQueryV1 = FormalFollowUpVisibilityV1 & Readonly<{
  businessDate: string;
  timeZone: string;
}>;

export type FormalFollowUpWorkbenchSnapshotV1 = Readonly<{
  records: readonly FormalFollowUpTaskRecordV1[];
  counts: Readonly<{ overdue: number; dueToday: number }>;
}>;

export type FormalFollowUpCreateV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  taskId: string;
  customerId: string;
  customerDisplayName: string;
  customerMaskedReference: string | null;
  stageCode: FollowUpControlledStageCode;
  actionCode: FollowUpControlledActionCode;
  dueAt: string;
  assignment: FormalFollowUpAssignmentV1;
  idempotencyKey: string;
  requestDigest: string;
  actorId: string;
  occurredAt: string;
}>;

export type FormalFollowUpUpdateV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  taskId: string;
  expectedRevision: number;
  next: Omit<
    FormalFollowUpTaskRecordV1,
    | 'tenantId'
    | 'institutionId'
    | 'taskId'
    | 'customerId'
    | 'customerDisplayName'
    | 'customerMaskedReference'
    | 'idempotencyKey'
    | 'requestDigest'
    | 'createdBy'
    | 'createdAt'
  >;
  event: FormalFollowUpEventV1;
}>;

export interface FormalFollowUpStoreV1 {
  queryVisible(input: FormalFollowUpPageQueryV1): Promise<FormalFollowUpPageV1>;
  listVisible(
    input: FormalFollowUpVisibilityV1 & Readonly<{ limit: 101 }>,
  ): Promise<readonly FormalFollowUpTaskRecordV1[]>;
  getVisible(
    input: FormalFollowUpVisibilityV1 & Readonly<{ taskId: string }>,
  ): Promise<FormalFollowUpTaskRecordV1 | null>;
  getScopedCurrent(
    input: Readonly<{
      tenantId: string;
      institutionId: string;
      taskId: string;
    }>,
  ): Promise<FormalFollowUpTaskRecordV1 | null>;
  getByIdempotency(
    input: Readonly<{
      tenantId: string;
      institutionId: string;
      idempotencyKey: string;
    }>,
  ): Promise<FormalFollowUpTaskRecordV1 | null>;
  createWithEvent(
    input: FormalFollowUpCreateV1,
    event: FormalFollowUpEventV1,
  ): Promise<FormalFollowUpTaskRecordV1 | null>;
  updateWithEvent(
    input: FormalFollowUpUpdateV1,
  ): Promise<FormalFollowUpTaskRecordV1 | null>;
}

// 工作台扩展不改变既有列表与受控写入消费者的存储契约。
export interface FormalFollowUpWorkbenchStoreV1 extends FormalFollowUpStoreV1 {
  queryWorkbenchVisible(input: FormalFollowUpWorkbenchQueryV1): Promise<FormalFollowUpWorkbenchSnapshotV1>;
}
