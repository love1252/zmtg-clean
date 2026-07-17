import { describe, expect, it } from 'vitest';

import {
  applyConversationIdentityReview,
  closeConversationActiveSegment,
  createConversation,
  isValidConversationRoot,
  projectConversationRootIdentityState,
  recordConversationCustomerInbound,
  type ConversationRootPolicy,
  type ConversationV1,
  type CreateConversationInput,
} from '@/modules/institution-conversations/domain/conversations';
import type {
  ConversationSegment,
  SegmentCustomerInboundFact,
} from '@/modules/institution-conversations/domain/conversation-segments';

const policy: ConversationRootPolicy = {
  isTrustedConnectionBinding: (binding) =>
    binding.tenantId === 'tenant-1' &&
    binding.institutionId === 'institution-1' &&
    binding.channelType === 'wecom_customer_contact' &&
    binding.serviceProviderType === 'official_api' &&
    ((binding.connectionInstanceId === 'connection-1' &&
      binding.channelConversationRef === 'channel-ref-1') ||
      (binding.connectionInstanceId === 'connection-2' &&
        binding.channelConversationRef === 'channel-ref-2')),
  isTrustedCustomerReferenceForScope: (scope, customer) =>
    scope.tenantId === 'tenant-1' &&
    scope.institutionId === 'institution-1' &&
    customer.customerId === 'customer-1',
  isTrustedCustomerInboundFactForConnection: (binding, fact) =>
    (binding.connectionInstanceId === 'connection-1' &&
      fact.messageId.startsWith('message-a-trusted-')) ||
    (binding.connectionInstanceId === 'connection-2' &&
      fact.messageId.startsWith('message-b-trusted-')),
  isTrustedClosedSegmentFact: (segment) =>
    segment.state === 'closed' && segment.segmentId.startsWith('segment-'),
};

const customer = {
  contractVersion: 'v1' as const,
  customerId: 'customer-1',
  displayName: '低敏客户',
  maskedReference: null,
};

function inbound(
  overrides: Partial<SegmentCustomerInboundFact> = {},
): SegmentCustomerInboundFact {
  return {
    tenantId: 'tenant-1',
    institutionId: 'institution-1',
    messageId: 'message-a-trusted-1',
    conversationId: 'conversation-1',
    segmentId: 'segment-1',
    direction: 'inbound',
    senderKind: 'customer',
    inboundRevision: 1,
    occurredAt: '2026-07-18T00:00:00.000Z',
    receivedAt: '2026-07-18T00:00:01.000Z',
    ...overrides,
  };
}

function input(
  overrides: Partial<CreateConversationInput> = {},
): CreateConversationInput {
  return {
    conversationId: 'conversation-1',
    tenantId: 'tenant-1',
    institutionId: 'institution-1',
    channelType: 'wecom_customer_contact',
    serviceProviderType: 'official_api',
    connectionInstanceId: 'connection-1',
    channelConversationRef: 'channel-ref-1',
    identityReviewState: 'pending_review',
    customerReference: null,
    customerInboundFact: inbound(),
    ...overrides,
  };
}

function root(
  overrides: Partial<CreateConversationInput> = {},
): ConversationV1 {
  const result = createConversation(input(overrides), policy);
  if (result.kind !== 'applied') {
    throw new Error(result.kind === 'blocked' ? result.code : result.kind);
  }
  return result.conversation;
}

function closedSegment(
  overrides: Partial<ConversationSegment> = {},
): ConversationSegment {
  return {
    tenantId: 'tenant-1',
    institutionId: 'institution-1',
    segmentId: 'segment-1',
    conversationId: 'conversation-1',
    sequenceNo: 1,
    state: 'closed',
    currentHandlerId: null,
    everHumanHandled: false,
    openedByCustomerMessageId: 'message-a-trusted-1',
    openedAt: '2026-07-18T00:00:00.000Z',
    lastCustomerMessageId: 'message-a-trusted-1',
    lastCustomerMessageAt: '2026-07-18T00:00:00.000Z',
    latestInboundRevision: 1,
    waitingAfterCustomerMessageId: null,
    waitingAfterCustomerMessageAt: null,
    waitingAfterInboundRevision: null,
    stateChangedAt: '2026-07-18T00:03:00.000Z',
    closedAt: '2026-07-18T00:03:00.000Z',
    segmentCloseKind: 'normal',
    resolutionState: 'resolved',
    resolvedAt: '2026-07-18T00:03:00.000Z',
    blockingReasonCodes: [],
    ...overrides,
  };
}

describe('ConversationV1 root boundary', () => {
  it('fails closed on unknown review states and matched/reference mismatch', () => {
    expect(projectConversationRootIdentityState('unknown')).toBeNull();
    expect(
      createConversation(
        input({ identityReviewState: 'matched', customerReference: null }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'identity_customer_mismatch' });
    expect(
      createConversation(
        input({ identityReviewState: 'revoked', customerReference: customer }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'identity_customer_mismatch' });
  });

  it('rejects untrusted scoped customer references and extra fields', () => {
    expect(
      createConversation(
        input({
          identityReviewState: 'matched',
          customerReference: { ...customer, customerId: 'customer-2' },
        }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'identity_customer_mismatch' });
    expect(
      createConversation(
        input({
          identityReviewState: 'matched',
          customerReference: { ...customer, phone: '13800000000' },
        }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'identity_customer_mismatch' });
  });

  it('rejects a forged connection combination and raw external channel reference', () => {
    expect(
      createConversation(input({ serviceProviderType: 'aibotk' }), policy),
    ).toEqual({ kind: 'blocked', code: 'connection_binding_untrusted' });
    expect(
      createConversation(
        input({ channelConversationRef: 'raw_external_account_123' }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'connection_binding_untrusted' });
    expect(
      createConversation(input({ institutionId: 'institution-2' }), policy),
    ).toEqual({ kind: 'blocked', code: 'connection_binding_untrusted' });
  });

  it('requires a trusted initial inbound fact for the exact root scope', () => {
    expect(
      createConversation(
        input({
          customerInboundFact: inbound({ institutionId: 'institution-2' }),
        }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'target_mismatch' });
    expect(
      createConversation(
        input({
          customerInboundFact: inbound({ messageId: 'message-untrusted-1' }),
        }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'customer_inbound_untrusted' });
  });

  it('binds trusted inbound facts to the exact connection instead of fact shape alone', () => {
    const connectionBFact = inbound({ messageId: 'message-b-trusted-1' });

    expect(
      createConversation(
        input({ customerInboundFact: connectionBFact }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'customer_inbound_untrusted' });
    expect(
      recordConversationCustomerInbound(root(), connectionBFact, policy),
    ).toEqual({ kind: 'blocked', code: 'customer_inbound_untrusted' });

    const connectionB = createConversation(
      input({
        connectionInstanceId: 'connection-2',
        channelConversationRef: 'channel-ref-2',
        customerInboundFact: connectionBFact,
      }),
      policy,
    );
    expect(connectionB.kind).toBe('applied');
  });

  it.each([
    ['conversationId', 'bad id', 'input_invalid'],
    ['tenantId', '', 'connection_binding_untrusted'],
    ['institutionId', '../institution', 'connection_binding_untrusted'],
    ['channelType', 'unknown', 'connection_binding_untrusted'],
    ['connectionInstanceId', 'connection/1', 'connection_binding_untrusted'],
  ] as const)('rejects invalid creation field %s', (key, value, code) => {
    expect(createConversation(input({ [key]: value }), policy)).toEqual({
      kind: 'blocked',
      code,
    });
  });

  it('rejects extra keys, accessors, arrays, null-prototype objects and revoked proxies', () => {
    const extra = { ...input(), providerPayload: { token: 'secret' } };
    const accessor = { ...input() } as Record<string, unknown>;
    Object.defineProperty(accessor, 'conversationId', {
      enumerable: true,
      get: () => 'conversation-1',
    });
    const nullPrototype = Object.assign(Object.create(null), input());
    const revocable = Proxy.revocable(input(), {});
    revocable.revoke();

    for (const candidate of [extra, accessor, [], nullPrototype, revocable.proxy]) {
      expect(createConversation(candidate as CreateConversationInput, policy)).toEqual({
        kind: 'blocked',
        code: 'input_invalid',
      });
    }
  });

  it('fails closed when policy functions throw or the policy shape is malformed', () => {
    const throwingPolicy: ConversationRootPolicy = {
      ...policy,
      isTrustedConnectionBinding: () => {
        throw new Error('provider detail');
      },
    };
    expect(createConversation(input(), throwingPolicy)).toEqual({
      kind: 'blocked',
      code: 'connection_binding_untrusted',
    });
    expect(
      createConversation(input(), { ...policy, unexpected: true } as never),
    ).toEqual({ kind: 'blocked', code: 'input_invalid' });
  });

  it('rejects inbound facts for another scope, conversation or active segment', () => {
    const conversation = root();
    expect(
      recordConversationCustomerInbound(
        conversation,
        inbound({ institutionId: 'institution-2' }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'target_mismatch' });
    expect(
      recordConversationCustomerInbound(
        conversation,
        inbound({ conversationId: 'conversation-2' }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'target_mismatch' });
    expect(
      recordConversationCustomerInbound(
        conversation,
        inbound({
          messageId: 'message-a-trusted-2',
          segmentId: 'segment-2',
          inboundRevision: 2,
          occurredAt: '2026-07-18T00:01:00.000Z',
          receivedAt: '2026-07-18T00:01:01.000Z',
        }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'active_segment_exists' });
  });

  it('rejects untrusted and impossible inbound facts', () => {
    expect(
      recordConversationCustomerInbound(
        root(),
        inbound({ messageId: 'untrusted-message' }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'customer_inbound_untrusted' });
    expect(
      recordConversationCustomerInbound(
        root(),
        inbound({
          messageId: 'message-a-trusted-2',
          occurredAt: '2026-07-18T00:02:00.000Z',
          receivedAt: '2026-07-18T00:01:59.000Z',
        }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'customer_inbound_untrusted' });
  });

  it('does not replay a same-time inbound with a different message or revision', () => {
    const conversation = root();

    expect(
      recordConversationCustomerInbound(
        conversation,
        inbound({ messageId: 'message-a-trusted-2' }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'customer_inbound_not_new' });
    expect(
      recordConversationCustomerInbound(
        conversation,
        inbound({ inboundRevision: 2 }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'customer_inbound_not_new' });
  });

  it('does not reopen a closed root from a delayed inbound that predates close', () => {
    const closed = closeConversationActiveSegment(
      root(),
      closedSegment(),
      policy,
    );
    expect(closed.kind).toBe('applied');
    if (closed.kind !== 'applied') return;

    expect(
      recordConversationCustomerInbound(
        closed.conversation,
        inbound({
          messageId: 'message-a-trusted-2',
          segmentId: 'segment-2',
          inboundRevision: 2,
          occurredAt: '2026-07-18T00:02:00.000Z',
          receivedAt: '2026-07-18T00:04:00.000Z',
        }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'customer_inbound_not_new' });
  });

  it('uses the last close boundary when identity changed after close', () => {
    const closed = closeConversationActiveSegment(
      root(),
      closedSegment(),
      policy,
    );
    expect(closed.kind).toBe('applied');
    if (closed.kind !== 'applied') return;
    const identityChanged = applyConversationIdentityReview(
      closed.conversation,
      {
        reviewState: 'conflict',
        customerReference: null,
        occurredAt: '2026-07-18T00:10:00.000Z',
      },
      policy,
    );
    expect(identityChanged.kind).toBe('applied');
    if (identityChanged.kind !== 'applied') return;

    const next = recordConversationCustomerInbound(
      identityChanged.conversation,
      inbound({
        messageId: 'message-a-trusted-2',
        segmentId: 'segment-2',
        inboundRevision: 2,
        occurredAt: '2026-07-18T00:04:00.000Z',
        receivedAt: '2026-07-18T00:11:00.000Z',
      }),
      policy,
    );
    expect(next.kind).toBe('applied');
    if (next.kind !== 'applied') return;
    expect(next.conversation.activeSegmentId).toBe('segment-2');
    expect(next.conversation.lastClosedSegmentId).toBe('segment-1');
    expect(next.conversation.lastSegmentClosedAt).toBe(
      '2026-07-18T00:03:00.000Z',
    );
  });

  it('orders identity and segment streams independently while preserving overall updatedAt', () => {
    const identityChanged = applyConversationIdentityReview(
      root(),
      {
        reviewState: 'conflict',
        customerReference: null,
        occurredAt: '2026-07-18T00:04:00.000Z',
      },
      policy,
    );
    expect(identityChanged.kind).toBe('applied');
    if (identityChanged.kind !== 'applied') return;

    const delayedInboundFact = inbound({
      messageId: 'message-a-trusted-2',
      inboundRevision: 2,
      occurredAt: '2026-07-18T00:02:00.000Z',
      receivedAt: '2026-07-18T00:02:01.000Z',
    });
    const delayedInbound = recordConversationCustomerInbound(
      identityChanged.conversation,
      delayedInboundFact,
      policy,
    );
    expect(delayedInbound.kind).toBe('applied');
    if (delayedInbound.kind !== 'applied') return;
    expect(delayedInbound.conversation.identityUpdatedAt).toBe(
      '2026-07-18T00:04:00.000Z',
    );
    expect(delayedInbound.conversation.segmentUpdatedAt).toBe(
      '2026-07-18T00:02:01.000Z',
    );
    expect(delayedInbound.conversation.updatedAt).toBe(
      '2026-07-18T00:04:00.000Z',
    );
    expect(
      recordConversationCustomerInbound(
        delayedInbound.conversation,
        delayedInboundFact,
        policy,
      ),
    ).toMatchObject({ kind: 'replayed' });

    const closed = closeConversationActiveSegment(
      delayedInbound.conversation,
      closedSegment({
        lastCustomerMessageId: 'message-a-trusted-2',
        lastCustomerMessageAt: '2026-07-18T00:02:00.000Z',
        latestInboundRevision: 2,
      }),
      policy,
    );
    expect(closed.kind).toBe('applied');
    if (closed.kind !== 'applied') return;
    expect(closed.conversation.segmentUpdatedAt).toBe(
      '2026-07-18T00:03:00.000Z',
    );
    expect(closed.conversation.updatedAt).toBe(
      '2026-07-18T00:04:00.000Z',
    );
  });

  it('allows a different new segment at the exact close millisecond', () => {
    const closed = closeConversationActiveSegment(
      root(),
      closedSegment(),
      policy,
    );
    expect(closed.kind).toBe('applied');
    if (closed.kind !== 'applied') return;

    const next = recordConversationCustomerInbound(
      closed.conversation,
      inbound({
        messageId: 'message-a-trusted-2',
        segmentId: 'segment-2',
        inboundRevision: 2,
        occurredAt: '2026-07-18T00:03:00.000Z',
        receivedAt: '2026-07-18T00:04:00.000Z',
      }),
      policy,
    );
    expect(next.kind).toBe('applied');
    if (next.kind !== 'applied') return;
    expect(next.conversation.activeSegmentId).toBe('segment-2');
    expect(isValidConversationRoot(next.conversation, policy)).toBe(true);
  });

  it('rejects identity timestamp regression and same-time conflicting facts', () => {
    const conversation = root();
    expect(
      applyConversationIdentityReview(
        conversation,
        {
          reviewState: 'matched',
          customerReference: customer,
          occurredAt: '2026-07-18T00:00:00.000Z',
        },
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'timestamp_regression' });
    expect(
      applyConversationIdentityReview(
        conversation,
        {
          reviewState: 'conflict',
          customerReference: null,
          occurredAt: conversation.updatedAt,
        },
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'timestamp_conflict' });
  });

  it('closes only from a trusted closed snapshot for the exact target', () => {
    const conversation = root();
    expect(
      closeConversationActiveSegment(
        conversation,
        closedSegment({ state: 'human_handling', closedAt: null }) as ConversationSegment,
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'closed_segment_untrusted' });
    expect(
      closeConversationActiveSegment(
        conversation,
        closedSegment({ institutionId: 'institution-2' }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'target_mismatch' });
    expect(
      closeConversationActiveSegment(
        conversation,
        closedSegment({ conversationId: 'conversation-2' }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'target_mismatch' });
    expect(
      closeConversationActiveSegment(
        conversation,
        closedSegment({ segmentId: 'segment-2' }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'active_segment_mismatch' });
  });

  it.each([
    [
      'non-human snapshot with a handler',
      { everHumanHandled: false, currentHandlerId: 'handler-1' },
    ],
    [
      'resolution before opening',
      { resolvedAt: '2026-07-17T23:59:59.000Z' },
    ],
    [
      'resolution after state change',
      { resolvedAt: '2026-07-18T00:03:01.000Z' },
    ],
    [
      'state change differs from close',
      { stateChangedAt: '2026-07-18T00:02:59.000Z' },
    ],
    [
      'handled normal close without current handler',
      { everHumanHandled: true, currentHandlerId: null },
    ],
    [
      'resolution before last customer message',
      {
        lastCustomerMessageAt: '2026-07-18T00:01:00.000Z',
        resolvedAt: '2026-07-18T00:00:30.000Z',
      },
    ],
  ] as const)('rejects non-canonical closed snapshot: %s', (_label, overrides) => {
    expect(
      closeConversationActiveSegment(
        root(),
        closedSegment(overrides),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'closed_segment_untrusted' });
  });

  it.each([
    ['message', { lastCustomerMessageId: 'message-a-trusted-2' }],
    ['time', { lastCustomerMessageAt: '2026-07-18T00:00:01.000Z' }],
    ['revision', { latestInboundRevision: 2 }],
  ] as const)(
    'rejects a closed snapshot whose latest inbound %s differs from the root',
    (_label, overrides) => {
      expect(
        closeConversationActiveSegment(
          root(),
          closedSegment(overrides),
          policy,
        ),
      ).toEqual({ kind: 'blocked', code: 'segment_inbound_mismatch' });
    },
  );

  it('replays the exact close after a later identity update and rejects altered closure', () => {
    const closed = closeConversationActiveSegment(
      root(),
      closedSegment(),
      policy,
    );
    expect(closed.kind).toBe('applied');
    if (closed.kind !== 'applied') return;
    const identityChanged = applyConversationIdentityReview(
      closed.conversation,
      {
        reviewState: 'conflict',
        customerReference: null,
        occurredAt: '2026-07-18T00:10:00.000Z',
      },
      policy,
    );
    expect(identityChanged.kind).toBe('applied');
    if (identityChanged.kind !== 'applied') return;

    expect(
      closeConversationActiveSegment(
        identityChanged.conversation,
        closedSegment(),
        policy,
      ),
    ).toMatchObject({ kind: 'replayed' });
    expect(
      closeConversationActiveSegment(
        identityChanged.conversation,
        closedSegment({
          stateChangedAt: '2026-07-18T00:04:00.000Z',
          closedAt: '2026-07-18T00:04:00.000Z',
          resolvedAt: '2026-07-18T00:04:00.000Z',
        }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'closed_segment_conflict' });
  });

  it('replays an exact prior close after a different segment has opened', () => {
    const closed = closeConversationActiveSegment(
      root(),
      closedSegment(),
      policy,
    );
    expect(closed.kind).toBe('applied');
    if (closed.kind !== 'applied') return;
    const next = recordConversationCustomerInbound(
      closed.conversation,
      inbound({
        messageId: 'message-a-trusted-2',
        segmentId: 'segment-2',
        inboundRevision: 2,
        occurredAt: '2026-07-18T00:04:00.000Z',
        receivedAt: '2026-07-18T00:04:01.000Z',
      }),
      policy,
    );
    expect(next.kind).toBe('applied');
    if (next.kind !== 'applied') return;

    const replay = closeConversationActiveSegment(
      next.conversation,
      closedSegment(),
      policy,
    );
    expect(replay).toMatchObject({ kind: 'replayed' });
    if (replay.kind !== 'replayed') return;
    expect(replay.conversation.activeSegmentId).toBe('segment-2');
    expect(
      closeConversationActiveSegment(
        next.conversation,
        closedSegment({
          lastCustomerMessageId: 'message-a-trusted-altered',
        }),
        policy,
      ),
    ).toEqual({ kind: 'blocked', code: 'closed_segment_conflict' });
  });

  it('applies and replays a canonical forced close at the segment watermark', () => {
    const conversation = root();
    const forcedAtWatermark = closedSegment({
      stateChangedAt: conversation.segmentUpdatedAt,
      closedAt: conversation.segmentUpdatedAt,
      segmentCloseKind: 'forced',
      resolutionState: 'open',
      resolvedAt: null,
      blockingReasonCodes: ['forced_close_unresolved'],
    });

    const closed = closeConversationActiveSegment(
      conversation,
      forcedAtWatermark,
      policy,
    );
    expect(closed.kind).toBe('applied');
    if (closed.kind !== 'applied') return;
    expect(closed.conversation.activeSegmentId).toBeNull();
    expect(closed.conversation.segmentUpdatedAt).toBe(
      conversation.segmentUpdatedAt,
    );
    expect(
      closeConversationActiveSegment(
        closed.conversation,
        forcedAtWatermark,
        policy,
      ),
    ).toMatchObject({ kind: 'replayed' });
  });

  it('fails closed when the closed-segment trust callback rejects or throws', () => {
    const rejectingPolicy: ConversationRootPolicy = {
      ...policy,
      isTrustedClosedSegmentFact: () => false,
    };
    const throwingPolicy: ConversationRootPolicy = {
      ...policy,
      isTrustedClosedSegmentFact: () => {
        throw new Error('secret provider failure');
      },
    };
    expect(
      closeConversationActiveSegment(root(), closedSegment(), rejectingPolicy),
    ).toEqual({ kind: 'blocked', code: 'closed_segment_untrusted' });
    expect(
      closeConversationActiveSegment(root(), closedSegment(), throwingPolicy),
    ).toEqual({ kind: 'blocked', code: 'closed_segment_untrusted' });
  });

  it('passes frozen scope, customer, inbound and closed snapshots to policy callbacks', () => {
    const observed: boolean[] = [];
    const inspectingPolicy: ConversationRootPolicy = {
      ...policy,
      isTrustedCustomerReferenceForScope: (scope, reference) => {
        observed.push(Object.isFrozen(scope), Object.isFrozen(reference));
        return policy.isTrustedCustomerReferenceForScope(scope, reference);
      },
      isTrustedCustomerInboundFactForConnection: (binding, fact) => {
        observed.push(Object.isFrozen(binding), Object.isFrozen(fact));
        return policy.isTrustedCustomerInboundFactForConnection(binding, fact);
      },
      isTrustedClosedSegmentFact: (segment) => {
        observed.push(
          Object.isFrozen(segment),
          Object.isFrozen(segment.blockingReasonCodes),
        );
        return policy.isTrustedClosedSegmentFact(segment);
      },
    };
    const created = createConversation(
      input({ identityReviewState: 'matched', customerReference: customer }),
      inspectingPolicy,
    );
    expect(created.kind).toBe('applied');
    if (created.kind !== 'applied') return;
    const closed = closeConversationActiveSegment(
      created.conversation,
      closedSegment(),
      inspectingPolicy,
    );
    expect(closed.kind).toBe('applied');
    expect(observed).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  it('rejects forged roots with untrusted connection or identity inconsistency', () => {
    const valid = root({
      identityReviewState: 'matched',
      customerReference: customer,
    });
    expect(
      isValidConversationRoot(
        { ...valid, connectionInstanceId: 'connection-foreign' },
        policy,
      ),
    ).toBe(false);
    expect(
      isValidConversationRoot(
        { ...valid, identityState: 'unmatched' },
        policy,
      ),
    ).toBe(false);
  });

  it('rejects forged roots with partial pointers or inconsistent segment history', () => {
    const active = root();
    for (const forged of [
      { ...active, latestCustomerInboundMessageId: null },
      { ...active, latestCustomerInboundAt: null },
      { ...active, latestCustomerInboundRevision: null },
      { ...active, activeSegmentId: null },
      { ...active, lastClosedSegmentId: 'segment-0' },
      {
        ...active,
        lastClosedSegmentId: 'segment-0',
        lastSegmentClosedAt: '2026-07-18T00:00:02.000Z',
      },
      {
        ...active,
        latestCustomerInboundAt: '2026-07-18T00:00:02.000Z',
      },
      {
        ...active,
        identityUpdatedAt: '2026-07-18T00:00:02.000Z',
      },
      {
        ...active,
        segmentUpdatedAt: '2026-07-18T00:00:02.000Z',
      },
    ]) {
      expect(isValidConversationRoot(forged, policy)).toBe(false);
    }

    const closed = closeConversationActiveSegment(
      active,
      closedSegment(),
      policy,
    );
    expect(closed.kind).toBe('applied');
    if (closed.kind !== 'applied') return;
    expect(
      isValidConversationRoot(
        { ...closed.conversation, activeSegmentId: 'segment-1' },
        policy,
      ),
    ).toBe(false);
    expect(
      isValidConversationRoot(
        {
          ...closed.conversation,
          lastSegmentClosedAt: '2026-07-18T00:03:01.000Z',
        },
        policy,
      ),
    ).toBe(false);
    expect(
      isValidConversationRoot(
        {
          ...closed.conversation,
          lastClosedSegmentInboundRevision: 2,
        },
        policy,
      ),
    ).toBe(false);
    expect(
      isValidConversationRoot(
        {
          ...closed.conversation,
          lastClosedSegmentInboundMessageId: null,
        },
        policy,
      ),
    ).toBe(false);
  });

  it('does not leak rejected raw values or thrown policy errors', () => {
    const secret = 'secret_token_123';
    const result = createConversation(
      input({ channelConversationRef: secret }),
      policy,
    );
    expect(result).toEqual({
      kind: 'blocked',
      code: 'connection_binding_untrusted',
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});
