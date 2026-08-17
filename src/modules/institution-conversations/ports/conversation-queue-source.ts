import type { ConversationRootIdentityState } from '../domain/conversations';
import type { ConversationSegmentState } from '../domain/conversation-segments';

export type ConversationQueueSourceQueryV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  limit: 101;
}>;

export type ConversationQueueSourceRowV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  conversationId: string;
  channelType: string;
  identityState: ConversationRootIdentityState;
  activeSegmentId: string | null;
  activeSegmentState: ConversationSegmentState | null;
  latestCustomerInboundAt: string | null;
  updatedAt: string;
}>;

export type ConversationQueueSourceV1 = Readonly<{
  list: (
    query: ConversationQueueSourceQueryV1,
  ) => Promise<readonly ConversationQueueSourceRowV1[]>;
}>;
