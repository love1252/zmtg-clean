import {
  createConversationQueueReaderV1,
  type ConversationQueueReaderResultV1,
  type ConversationQueueV1,
} from '@/modules/institution-conversations/application/conversation-queue-reader';
import { readScopedConversationActionableIdsV1 } from '@/modules/institution-conversations/server/conversation-command-repository';
import { createConversationQueueRepository } from '@/modules/institution-conversations/server/conversation-queue-repository';
import { getDatabase } from '@/server/db/client';
import {
  consumeInstitutionConversationReadAuthorizationV1,
  resolveInstitutionConversationReadAuthorizationV1,
} from '@/server/orchestration/institution-conversation-read-authorization';
import {
  consumeInstitutionConversationWriteAuthorizationV1,
  resolveInstitutionConversationWriteAuthorizationV1,
  type InstitutionConversationWriteAuthorizationConsumptionV1,
} from '@/server/orchestration/institution-conversation-write-authorization';

export type InstitutionConversationQueueResultV1 =
  | ConversationQueueReaderResultV1
  | Readonly<{ kind: 'forbidden' }>;

const FORBIDDEN = Object.freeze({ kind: 'forbidden' } as const);
const UNAVAILABLE = Object.freeze({ kind: 'unavailable' } as const);

const EMPTY_ACTIONABLE_CONVERSATION_IDS = Object.freeze([]) as readonly string[];

function isConversationManagementRole(
  role: InstitutionConversationWriteAuthorizationConsumptionV1['role'],
): boolean {
  return role === 'tenant_admin' || role === 'tenant_operator';
}

export async function readCurrentInstitutionConversationQueueActionableIdsV1(
  queue: ConversationQueueV1,
): Promise<readonly string[]> {
  if (queue.records.length === 0) return EMPTY_ACTIONABLE_CONVERSATION_IDS;

  try {
    const resolution = await resolveInstitutionConversationWriteAuthorizationV1();
    if (resolution.kind !== 'allowed') return EMPTY_ACTIONABLE_CONVERSATION_IDS;

    const actor = consumeInstitutionConversationWriteAuthorizationV1(
      resolution.authorization,
    );
    if (!actor) return EMPTY_ACTIONABLE_CONVERSATION_IDS;

    if (isConversationManagementRole(actor.role)) {
      return Object.freeze(queue.records.map((item) => item.conversationId));
    }

    return await readScopedConversationActionableIdsV1(getDatabase(), {
      tenantId: actor.tenantId,
      institutionId: actor.institutionId,
      conversationIds: queue.records.map((item) => item.conversationId),
      actorUserId: actor.accountId,
    });
  } catch {
    return EMPTY_ACTIONABLE_CONVERSATION_IDS;
  }
}

export async function readCurrentInstitutionConversationQueueV1(): Promise<InstitutionConversationQueueResultV1> {
  try {
    const resolution = await resolveInstitutionConversationReadAuthorizationV1();
    if (resolution.kind === 'forbidden') return FORBIDDEN;
    if (resolution.kind !== 'allowed') return UNAVAILABLE;

    const pair = consumeInstitutionConversationReadAuthorizationV1(
      resolution.authorization,
    );
    if (!pair) return UNAVAILABLE;

    const source = createConversationQueueRepository(getDatabase());
    const reader = createConversationQueueReaderV1({ source });
    return await reader.read({
      tenantId: pair.tenantId,
      institutionId: pair.institutionId,
    });
  } catch {
    return UNAVAILABLE;
  }
}
