import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  consumeAuthorization: vi.fn(),
  resolveCapability: vi.fn(),
  getDatabase: vi.fn(),
  createQueueRepository: vi.fn(),
  createQueueReader: vi.fn(),
  queueRead: vi.fn(),
  createActionRepository: vi.fn(),
  actionRead: vi.fn(),
  createMembershipReader: vi.fn(),
  membershipResolve: vi.fn(),
  project: vi.fn(),
}));

vi.mock(
  '@/server/orchestration/institution-conversation-read-authorization',
  () => ({
    resolveInstitutionConversationReadAuthorizationV1:
      mocks.resolveAuthorization,
    consumeInstitutionConversationReadAuthorizationV1:
      mocks.consumeAuthorization,
  }),
);

vi.mock(
  '@/server/orchestration/institution-capability-authority',
  () => ({
    resolveInstitutionCapabilityAuthorityStatusV1:
      mocks.resolveCapability,
  }),
);

vi.mock('@/server/db/client', () => ({
  getDatabase: mocks.getDatabase,
}));

vi.mock(
  '@/modules/institution-conversations/server/conversation-queue-repository',
  () => ({
    createConversationQueueRepository:
      mocks.createQueueRepository,
  }),
);

vi.mock(
  '@/modules/institution-conversations/application/conversation-queue-reader',
  () => ({
    createConversationQueueReaderV1:
      mocks.createQueueReader,
  }),
);

vi.mock(
  '@/modules/institution-conversations/server/conversation-action-source-repository',
  () => ({
    createConversationActionSourceRepositoryV1:
      mocks.createActionRepository,
  }),
);

vi.mock(
  '@/modules/access-control/application/authoritative-membership-reader',
  () => ({
    createAccessControlAuthoritativeMembershipFactReaderV1:
      mocks.createMembershipReader,
  }),
);

vi.mock(
  '@/modules/institution-conversations/domain/conversation-action-projection',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('@/modules/institution-conversations/domain/conversation-action-projection')
    >();

    return {
      ...actual,
      projectConversationActionSource: mocks.project,
    };
  },
);

import { readCurrentInstitutionConversationActionSourceV1 } from '@/server/orchestration/institution-conversation-action-source';

const scope = Object.freeze({
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
});

const actor = Object.freeze({
  accountId: 'account-001',
  role: 'tenant_admin' as const,
  tenantId: scope.tenantId,
  institutionId: scope.institutionId,
  observedAt: '2026-08-21T00:00:00.000Z',
});

function capability() {
  return {
    contractVersion: 'v1',
    scope,
    readiness: 'ready',
    freshness: {
      observedAt: actor.observedAt,
      freshUntil: '2026-08-21T00:05:00.000Z',
    },
    partitions: [
      {
        key: 'page_conversation_queue',
        readiness: 'ready',
        freshness: {
          observedAt: actor.observedAt,
          freshUntil: '2026-08-21T00:05:00.000Z',
        },
        failureCode: null,
      },
    ],
    data: {
      capabilities: [
        {
          key: 'page_conversation_queue',
          kind: 'page',
          decision: 'operational',
          dimensions: {
            productionRelease: 'pilot_released',
          },
          safeSummary: '会话队列可用',
        },
      ],
    },
    failureCode: null,
  };
}

function projectedSource() {
  return {
    contractVersion: 'v1' as const,
    scope,
    readiness: 'empty' as const,
    freshness: {
      observedAt: actor.observedAt,
      freshUntil: '2026-08-21T00:05:00.000Z',
    },
    partitions: [
      {
        key: 'waiting_human' as const,
        readiness: 'empty' as const,
        freshness: {
          observedAt: actor.observedAt,
          freshUntil: '2026-08-21T00:05:00.000Z',
        },
        failureCode: null,
      },
      {
        key: 'unresolved_risk' as const,
        readiness: 'empty' as const,
        freshness: {
          observedAt: actor.observedAt,
          freshUntil: '2026-08-21T00:05:00.000Z',
        },
        failureCode: null,
      },
    ],
    data: {
      actions: [],
    },
    failureCode: null,
  };
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());

  mocks.resolveAuthorization.mockResolvedValue({
    kind: 'allowed',
    authorization: Object.freeze({}),
  });
  mocks.consumeAuthorization.mockReturnValue(actor);
  mocks.resolveCapability.mockResolvedValue(capability());
  mocks.getDatabase.mockReturnValue(Object.freeze({}));
  mocks.createQueueRepository.mockReturnValue(Object.freeze({}));
  mocks.createQueueReader.mockReturnValue(
    Object.freeze({
      read: mocks.queueRead,
    }),
  );
  mocks.queueRead.mockResolvedValue({
    kind: 'ready',
    queue: {
      contractVersion: 'v1',
      dataState: 'empty',
      records: [],
      pageInfo: {
        pageSize: 100,
        hasMore: false,
      },
    },
  });
  mocks.createMembershipReader.mockReturnValue(
    Object.freeze({
      resolve: mocks.membershipResolve,
    }),
  );
  mocks.createActionRepository.mockReturnValue(
    Object.freeze({
      read: mocks.actionRead,
    }),
  );
  mocks.project.mockReturnValue({
    kind: 'projected',
    source: projectedSource(),
  });
});

describe('Institution Conversation Action Source', () => {
  it('以 Formal Conversation read authorization 和 operational capability 发布 source', async () => {
    const result =
      await readCurrentInstitutionConversationActionSourceV1(scope);

    expect(result?.readiness).toBe('empty');

    expect(mocks.resolveAuthorization).toHaveBeenCalledOnce();
    expect(mocks.resolveCapability).toHaveBeenCalledOnce();

    expect(mocks.queueRead).toHaveBeenCalledWith({
      tenantId: scope.tenantId,
      institutionId: scope.institutionId,
    });

    expect(mocks.project).toHaveBeenCalledOnce();

    const projectionInput = mocks.project.mock.calls[0]?.[0];

    expect(projectionInput.viewer).toEqual({
      authority: 'server_authorized',
      role: 'tenant_admin',
      userId: 'account-001',
    });

    expect(projectionInput.partitions.map(
      (item: { key: string }) => item.key,
    )).toEqual([
      'waiting_human',
      'unresolved_risk',
    ]);
  });

  it('scope mismatch fail-closed', async () => {
    mocks.consumeAuthorization.mockReturnValue({
      ...actor,
      institutionId: 'institution-other',
    });

    const result =
      await readCurrentInstitutionConversationActionSourceV1(scope);

    expect(result?.readiness).toBe('denied');
    expect(result?.failureCode).toBe('scope_mismatch');
    expect(mocks.getDatabase).not.toHaveBeenCalled();
  });

  it('Conversation capability 未 operational 时保持 disabled/not_released', async () => {
    const value = capability();
    value.data.capabilities[0]!.decision = 'read_only';

    mocks.resolveCapability.mockResolvedValue(value);

    const result =
      await readCurrentInstitutionConversationActionSourceV1(scope);

    expect(result?.readiness).toBe('disabled');
    expect(result?.failureCode).toBe('not_released');
    expect(mocks.getDatabase).not.toHaveBeenCalled();
  });

  it('超过 formal queue bounded read 时不静默截断 action source', async () => {
    mocks.queueRead.mockResolvedValue({
      kind: 'ready',
      queue: {
        contractVersion: 'v1',
        dataState: 'ready',
        records: [],
        pageInfo: {
          pageSize: 100,
          hasMore: true,
        },
      },
    });

    const result =
      await readCurrentInstitutionConversationActionSourceV1(scope);

    expect(result?.readiness).toBe('unavailable');
    expect(result?.failureCode).toBe('data_incomplete');
    expect(mocks.project).not.toHaveBeenCalled();
  });
});
