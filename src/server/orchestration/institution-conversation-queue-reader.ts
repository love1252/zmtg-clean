import {
  createConversationQueueReaderV1,
  type ConversationQueueReaderResultV1,
} from '@/modules/institution-conversations/application/conversation-queue-reader';
import { createConversationQueueRepository } from '@/modules/institution-conversations/server/conversation-queue-repository';
import { getDatabase } from '@/server/db/client';
import {
  consumeInstitutionConversationReadAuthorizationV1,
  resolveInstitutionConversationReadAuthorizationV1,
} from '@/server/orchestration/institution-conversation-read-authorization';

export type InstitutionConversationQueueResultV1 =
  | ConversationQueueReaderResultV1
  | Readonly<{ kind: 'forbidden' }>;

const FORBIDDEN = Object.freeze({ kind: 'forbidden' } as const);
const UNAVAILABLE = Object.freeze({ kind: 'unavailable' } as const);

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
