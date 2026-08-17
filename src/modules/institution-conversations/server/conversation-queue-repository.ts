import { and, asc, desc, eq } from 'drizzle-orm';

import type {
  ConversationQueueSourceQueryV1,
  ConversationQueueSourceV1,
} from '../ports/conversation-queue-source';
import type { TenantDatabase } from '@/server/db/client';
import {
  conversationFormalSources,
  conversationSegments,
  conversations,
} from '@/server/db/schema';

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

function isQuery(value: ConversationQueueSourceQueryV1): boolean {
  return (
    value !== null
    && typeof value === 'object'
    && typeof value.tenantId === 'string'
    && idPattern.test(value.tenantId)
    && typeof value.institutionId === 'string'
    && idPattern.test(value.institutionId)
    && value.limit === 101
  );
}

export function createConversationQueueRepository(
  database: TenantDatabase,
): ConversationQueueSourceV1 {
  return Object.freeze({
    async list(query: ConversationQueueSourceQueryV1) {
      if (!isQuery(query)) {
        throw new Error('invalid_conversation_queue_source_query');
      }

      const rows = await database
        .select({
          tenantId: conversations.tenantId,
          institutionId: conversations.institutionId,
          conversationId: conversations.id,
          channelType: conversationFormalSources.channelType,
          identityState: conversations.identityState,
          activeSegmentId: conversations.activeSegmentId,
          activeSegmentState: conversationSegments.state,
          latestCustomerInboundAt: conversations.latestCustomerInboundAt,
          updatedAt: conversations.updatedAt,
        })
        .from(conversations)
        .innerJoin(
          conversationFormalSources,
          and(
            eq(conversationFormalSources.tenantId, conversations.tenantId),
            eq(conversationFormalSources.institutionId, conversations.institutionId),
            eq(conversationFormalSources.id, conversations.sourceId),
          ),
        )
        .leftJoin(
          conversationSegments,
          and(
            eq(conversationSegments.tenantId, conversations.tenantId),
            eq(conversationSegments.institutionId, conversations.institutionId),
            eq(conversationSegments.conversationId, conversations.id),
            eq(conversationSegments.id, conversations.activeSegmentId),
          ),
        )
        .where(
          and(
            eq(conversations.tenantId, query.tenantId),
            eq(conversations.institutionId, query.institutionId),
          ),
        )
        .orderBy(desc(conversations.updatedAt), asc(conversations.id))
        .limit(query.limit);

      if (rows.length > 101) {
        throw new Error('conversation_queue_source_overflow');
      }

      return Object.freeze(
        rows.map((row) =>
          Object.freeze({
            tenantId: row.tenantId,
            institutionId: row.institutionId,
            conversationId: row.conversationId,
            channelType: row.channelType,
            identityState: row.identityState,
            activeSegmentId: row.activeSegmentId,
            activeSegmentState: row.activeSegmentState,
            latestCustomerInboundAt:
              row.latestCustomerInboundAt?.toISOString() ?? null,
            updatedAt: row.updatedAt.toISOString(),
          }),
        ),
      );
    },
  });
}
