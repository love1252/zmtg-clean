import { createAccessControlAuthoritativeMembershipFactReaderV1 } from '@/modules/access-control/application/authoritative-membership-reader';
import type { ConversationActionSourceV1 } from '@/modules/institution-contracts/v1/conversation-action';
import {
  conversationActionProjectionRoles,
  projectConversationActionSource,
  type ConversationActionProjectionRole,
} from '@/modules/institution-conversations/domain/conversation-action-projection';
import { createConversationQueueReaderV1 } from '@/modules/institution-conversations/application/conversation-queue-reader';
import { createConversationActionSourceRepositoryV1 } from '@/modules/institution-conversations/server/conversation-action-source-repository';
import { createConversationQueueRepository } from '@/modules/institution-conversations/server/conversation-queue-repository';
import { getDatabase } from '@/server/db/client';
import { resolveInstitutionCapabilityAuthorityStatusV1 } from '@/server/orchestration/institution-capability-authority';
import {
  consumeInstitutionConversationReadAuthorizationV1,
  resolveInstitutionConversationReadAuthorizationV1,
} from '@/server/orchestration/institution-conversation-read-authorization';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const FRESHNESS_WINDOW_MS = 5 * 60 * 1000;

type Scope = Readonly<{
  tenantId: string;
  institutionId: string;
}>;

type FailureCode =
  | 'data_incomplete'
  | 'not_released'
  | 'permission_denied'
  | 'scope_mismatch';

function validScope(scope: Scope): boolean {
  return ID_PATTERN.test(scope.tenantId)
    && ID_PATTERN.test(scope.institutionId);
}

function failedSource(
  scope: Scope,
  readiness: 'unavailable' | 'disabled' | 'denied',
  failureCode: FailureCode,
): ConversationActionSourceV1 {
  return Object.freeze({
    contractVersion: 'v1' as const,
    scope: Object.freeze({
      tenantId: scope.tenantId,
      institutionId: scope.institutionId,
    }),
    readiness,
    freshness: null,
    partitions: [
      Object.freeze({
        key: 'waiting_human' as const,
        readiness,
        freshness: null,
        failureCode,
      }),
      Object.freeze({
        key: 'unresolved_risk' as const,
        readiness,
        freshness: null,
        failureCode,
      }),
    ],
    data: null,
    failureCode,
  });
}

function isProjectionRole(
  role: string,
): role is ConversationActionProjectionRole {
  return conversationActionProjectionRoles.some(
    (candidate) => candidate === role,
  );
}

export async function readCurrentInstitutionConversationActionSourceV1(
  expectedScope: Scope,
): Promise<ConversationActionSourceV1 | null> {
  if (!validScope(expectedScope)) {
    return null;
  }

  try {
    const resolution =
      await resolveInstitutionConversationReadAuthorizationV1();

    if (resolution.kind === 'forbidden') {
      return failedSource(
        expectedScope,
        'denied',
        'permission_denied',
      );
    }

    if (resolution.kind !== 'allowed') {
      return failedSource(
        expectedScope,
        'unavailable',
        'data_incomplete',
      );
    }

    const actor =
      consumeInstitutionConversationReadAuthorizationV1(
        resolution.authorization,
      );

    if (!actor) {
      return failedSource(
        expectedScope,
        'unavailable',
        'data_incomplete',
      );
    }

    if (
      actor.tenantId !== expectedScope.tenantId
      || actor.institutionId !== expectedScope.institutionId
    ) {
      return failedSource(
        expectedScope,
        'denied',
        'scope_mismatch',
      );
    }

    if (!isProjectionRole(actor.role)) {
      return failedSource(
        expectedScope,
        'denied',
        'permission_denied',
      );
    }

    const capabilityStatus =
      await resolveInstitutionCapabilityAuthorityStatusV1();

    if (!capabilityStatus) {
      return failedSource(
        expectedScope,
        'unavailable',
        'data_incomplete',
      );
    }

    if (
      capabilityStatus.scope.tenantId !== actor.tenantId
      || capabilityStatus.scope.institutionId !== actor.institutionId
    ) {
      return failedSource(
        expectedScope,
        'denied',
        'scope_mismatch',
      );
    }

    if (
      capabilityStatus.contractVersion !== 'v1'
      || capabilityStatus.readiness !== 'ready'
      || capabilityStatus.failureCode !== null
    ) {
      return failedSource(
        expectedScope,
        'unavailable',
        'data_incomplete',
      );
    }

    const pageCapabilities =
      capabilityStatus.data?.capabilities.filter(
        (item) => item.key === 'page_conversation_queue',
      ) ?? [];

    const pagePartitions =
      capabilityStatus.partitions.filter(
        (item) => item.key === 'page_conversation_queue',
      );

    if (
      pageCapabilities.length !== 1
      || pagePartitions.length !== 1
      || pageCapabilities[0]?.decision !== 'operational'
      || pageCapabilities[0].dimensions.productionRelease
        !== 'pilot_released'
      || pageCapabilities[0].safeSummary !== '会话队列可用'
      || pagePartitions[0]?.readiness !== 'ready'
      || pagePartitions[0].failureCode !== null
    ) {
      return failedSource(
        expectedScope,
        'disabled',
        'not_released',
      );
    }

    const database = getDatabase();
    const queueReader = createConversationQueueReaderV1({
      source: createConversationQueueRepository(database),
    });

    const queueResult = await queueReader.read({
      tenantId: actor.tenantId,
      institutionId: actor.institutionId,
    });

    if (
      queueResult.kind !== 'ready'
      || queueResult.queue.pageInfo.hasMore
    ) {
      return failedSource(
        expectedScope,
        'unavailable',
        'data_incomplete',
      );
    }

    const membershipReader =
      createAccessControlAuthoritativeMembershipFactReaderV1();

    const repository =
      createConversationActionSourceRepositoryV1(
        database,
        {
          async resolveAssignee(input) {
            const membership = await membershipReader.resolve({
              accountId: input.userId,
              tenantId: input.tenantId,
              institutionId: input.institutionId,
            });

            if (
              membership.kind !== 'current_membership_fact'
              || membership.accountId !== input.userId
              || membership.tenantId !== input.tenantId
              || membership.institutionId !== input.institutionId
              || membership.role !== input.role
            ) {
              return null;
            }

            return Object.freeze({
              userId: membership.accountId,
              displayName: membership.membershipDisplayName,
            });
          },
        },
      );

    const candidates = (
      await Promise.all(
        queueResult.queue.records
          .filter((record) => record.activeSegmentState !== null)
          .map((record) =>
            repository.read({
              tenantId: actor.tenantId,
              institutionId: actor.institutionId,
              conversationId: record.conversationId,
            }),
          ),
      )
    ).filter(
      (
        candidate,
      ): candidate is NonNullable<typeof candidate> =>
        candidate !== null,
    );

    const observedAtMs = Date.parse(actor.observedAt);

    if (!Number.isFinite(observedAtMs)) {
      return failedSource(
        expectedScope,
        'unavailable',
        'data_incomplete',
      );
    }

    const freshness = Object.freeze({
      observedAt: new Date(observedAtMs).toISOString(),
      freshUntil: new Date(
        observedAtMs + FRESHNESS_WINDOW_MS,
      ).toISOString(),
    });

    const projected = projectConversationActionSource({
      scope: Object.freeze({
        tenantId: actor.tenantId,
        institutionId: actor.institutionId,
      }),
      viewer: Object.freeze({
        authority: 'server_authorized' as const,
        role: actor.role,
        userId: actor.accountId,
      }),
      freshness,
      partitions: Object.freeze([
        Object.freeze({
          key: 'waiting_human' as const,
          readiness: 'ready' as const,
          freshness,
          failureCode: null,
        }),
        Object.freeze({
          key: 'unresolved_risk' as const,
          readiness: 'ready' as const,
          freshness,
          failureCode: null,
        }),
      ]),
      candidates,
    });

    if (projected.kind !== 'projected') {
      return failedSource(
        expectedScope,
        'unavailable',
        'data_incomplete',
      );
    }

    return projected.source;
  } catch {
    return failedSource(
      expectedScope,
      'unavailable',
      'data_incomplete',
    );
  }
}
