import type { InstitutionRoleV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import type { ConversationAssignmentStatus } from '@/modules/institution-conversations/domain/conversation-assignments';
import type {
  ConversationSegmentCloseKind,
  ConversationSegmentState,
  SegmentResolutionState,
} from '@/modules/institution-conversations/domain/conversation-segments';

export type ConversationControlledAssignmentV1 = Readonly<{
  assignmentId: string;
  assigneeUserId: string;
  assigneeRole: InstitutionRoleV1;
  status: Extract<ConversationAssignmentStatus, 'assigned' | 'accepted'>;
}>;

export type ConversationControlledPermissionsV1 = Readonly<{
  canRequestHuman: boolean;
  canAssign: boolean;
  canReassign: boolean;
  canTakeover: boolean;
  canReleaseTakeover: boolean;
  canMarkWaitingCustomer: boolean;
  canClose: boolean;
}>;

export type ConversationControlledDtoV1 = Readonly<{
  contractVersion: 'v1';
  conversationId: string;
  conversationRevision: number;
  updatedAt: string;
  activeSegment: null | Readonly<{
    segmentId: string;
    state: ConversationSegmentState;
    revision: number;
    currentHandlerId: string | null;
    everHumanHandled: boolean;
    resolutionState: SegmentResolutionState;
    segmentCloseKind: ConversationSegmentCloseKind;
    blockingReasonCodes: readonly string[];
    assignmentRevision: number;
    assignment: ConversationControlledAssignmentV1 | null;
  }>;
  permissions: ConversationControlledPermissionsV1;
}>;
