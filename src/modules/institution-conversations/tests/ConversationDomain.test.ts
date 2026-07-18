import { describe, expect, it } from 'vitest';

import {
  applyConversationIdentityReview,
  closeConversationActiveSegment,
  conversationIdentityProjectionOwnerRequirements,
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

const policy: ConversationRootPolicy = Object.freeze({
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
    customer.customerId.startsWith('customer-'),
  isTrustedCustomerInboundFactForConnection: (binding, fact) =>
    (binding.connectionInstanceId === 'connection-1' &&
      fact.messageId.startsWith('message-a-trusted-')) ||
    (binding.connectionInstanceId === 'connection-2' &&
      fact.messageId.startsWith('message-b-trusted-')),
  isTrustedClosedSegmentFact: (segment) =>
    segment.state === 'closed' && segment.segmentId.startsWith('segment-'),
});

const customerReference = Object.freeze({
  contractVersion: 'v1' as const,
  customerId: 'customer-1',
  displayName: '林女士',
  maskedReference: '客户尾号 1208',
});

function inboundFact(
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

function createInput(
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
    customerInboundFact: inboundFact(),
    ...overrides,
  };
}

function createRoot(
  overrides: Partial<CreateConversationInput> = {},
): ConversationV1 {
  const result = createConversation(createInput(overrides), policy);
  if (result.kind !== 'applied') {
    throw new Error(
      `fixture rejected: ${result.kind === 'blocked' ? result.code : result.kind}`,
    );
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

describe('ConversationV1 root domain', () => {
  it('derives the exact low-sensitivity root from trusted binding and inbound fact', () => {
    const result = createConversation(createInput(), policy);

    expect(result.kind).toBe('applied');
    if (result.kind !== 'applied') return;
    expect(Object.keys(result.conversation)).toEqual([
      'conversationId',
      'tenantId',
      'institutionId',
      'channelType',
      'serviceProviderType',
      'connectionInstanceId',
      'channelConversationRef',
      'customerReference',
      'identityState',
      'activeSegmentId',
      'latestCustomerInboundMessageId',
      'latestCustomerInboundAt',
      'latestCustomerInboundRevision',
      'lastClosedSegmentId',
      'lastSegmentClosedAt',
      'lastClosedSegmentInboundMessageId',
      'lastClosedSegmentInboundAt',
      'lastClosedSegmentInboundRevision',
      'identityUpdatedAt',
      'segmentUpdatedAt',
      'createdAt',
      'updatedAt',
    ]);
    expect(result.conversation).toMatchObject({
      channelType: 'wecom_customer_contact',
      serviceProviderType: 'official_api',
      connectionInstanceId: 'connection-1',
      channelConversationRef: 'channel-ref-1',
      activeSegmentId: 'segment-1',
      latestCustomerInboundMessageId: 'message-a-trusted-1',
      latestCustomerInboundAt: '2026-07-18T00:00:00.000Z',
      latestCustomerInboundRevision: 1,
      lastClosedSegmentId: null,
      lastSegmentClosedAt: null,
      lastClosedSegmentInboundMessageId: null,
      lastClosedSegmentInboundAt: null,
      lastClosedSegmentInboundRevision: null,
      identityUpdatedAt: '2026-07-18T00:00:01.000Z',
      segmentUpdatedAt: '2026-07-18T00:00:01.000Z',
      createdAt: '2026-07-18T00:00:01.000Z',
      updatedAt: '2026-07-18T00:00:01.000Z',
    });
  });

  it.each([
    ['pending_review', 'pending_review'],
    ['awaiting_customer_creation', 'pending_review'],
    ['conflict', 'conflict'],
    ['matched', 'matched'],
    ['rejected', 'unmatched'],
    ['withdrawn', 'unmatched'],
    ['expired', 'unmatched'],
    ['revoked', 'unmatched'],
  ] as const)('projects review state %s to root state %s', (review, root) => {
    expect(projectConversationRootIdentityState(review)).toBe(root);
  });

  it('blocks raw matched creation even when the callback claims a customer is trusted', () => {
    const result = createConversation(
      createInput({
        identityReviewState: 'matched',
        customerReference,
      }),
      policy,
    );

    expect(result).toEqual({
      kind: 'blocked',
      code: 'identity_owner_transition_required',
    });
  });

  it('turns a raw review into a frozen non-authorizing projection without a customer reference', () => {
    const pending = createRoot();
    const proposal = applyConversationIdentityReview(
      pending,
      {
        reviewState: 'matched',
        customerReference: null,
        occurredAt: '2026-07-18T00:01:00.000Z',
      },
      policy,
    );
    expect(proposal.kind).toBe('non_authorizing_projection_proposal');
    if (proposal.kind !== 'non_authorizing_projection_proposal') return;
    expect(proposal).toMatchObject({
      conversationId: pending.conversationId,
      scope: { tenantId: pending.tenantId, institutionId: pending.institutionId },
      expectedIdentityUpdatedAt: pending.identityUpdatedAt,
      requestedReviewState: 'matched',
      projectedIdentityState: 'matched',
      ownerRequirements: conversationIdentityProjectionOwnerRequirements,
    });
    expect(proposal).not.toHaveProperty('conversation');
    expect(proposal).not.toHaveProperty('customerReference');
    expect(Object.isFrozen(proposal)).toBe(true);
    expect(Object.isFrozen(proposal.scope)).toBe(true);
    expect(Object.isFrozen(proposal.ownerRequirements)).toBe(true);
  });

  it('records a newer trusted inbound fact in the same active segment', () => {
    const result = recordConversationCustomerInbound(
      createRoot(),
      inboundFact({
        messageId: 'message-a-trusted-2',
        inboundRevision: 2,
        occurredAt: '2026-07-18T00:02:00.000Z',
        receivedAt: '2026-07-18T00:02:01.000Z',
      }),
      policy,
    );

    expect(result.kind).toBe('applied');
    if (result.kind !== 'applied') return;
    expect(result.conversation.activeSegmentId).toBe('segment-1');
    expect(result.conversation.latestCustomerInboundMessageId).toBe(
      'message-a-trusted-2',
    );
    expect(result.conversation.latestCustomerInboundAt).toBe(
      '2026-07-18T00:02:00.000Z',
    );
    expect(result.conversation.latestCustomerInboundRevision).toBe(2);
  });

  it('closes from a trusted closed-segment snapshot then opens a later segment', () => {
    const closed = closeConversationActiveSegment(
      createRoot(),
      closedSegment(),
      policy,
    );
    expect(closed.kind).toBe('applied');
    if (closed.kind !== 'applied') return;
    expect(closed.conversation.activeSegmentId).toBeNull();
    expect(closed.conversation.lastClosedSegmentId).toBe('segment-1');
    expect(closed.conversation.lastSegmentClosedAt).toBe(
      '2026-07-18T00:03:00.000Z',
    );
    expect(closed.conversation.lastClosedSegmentInboundMessageId).toBe(
      'message-a-trusted-1',
    );
    expect(closed.conversation.lastClosedSegmentInboundAt).toBe(
      '2026-07-18T00:00:00.000Z',
    );
    expect(closed.conversation.lastClosedSegmentInboundRevision).toBe(1);

    const next = recordConversationCustomerInbound(
      closed.conversation,
      inboundFact({
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
    expect(next.conversation.activeSegmentId).toBe('segment-2');
    expect(next.conversation.lastClosedSegmentId).toBe('segment-1');
    expect(next.conversation.lastSegmentClosedAt).toBe(
      '2026-07-18T00:03:00.000Z',
    );
  });

  it('keeps identity requests non-authorizing while retaining inbound replay', () => {
    const root = createRoot();
    const identityReplay = applyConversationIdentityReview(
      root,
      {
        reviewState: 'pending_review',
        customerReference: null,
        occurredAt: root.updatedAt,
      },
      policy,
    );
    const inboundReplay = recordConversationCustomerInbound(
      root,
      inboundFact(),
      policy,
    );

    expect(identityReplay.kind).toBe('non_authorizing_projection_proposal');
    expect(inboundReplay.kind).toBe('replayed');
  });

  it('freezes callback inputs and successful roots without mutating input', () => {
    const callbackFrozen: boolean[] = [];
    const inspectingPolicy: ConversationRootPolicy = {
      ...policy,
      isTrustedConnectionBinding: (binding) => {
        callbackFrozen.push(Object.isFrozen(binding));
        return policy.isTrustedConnectionBinding(binding);
      },
      isTrustedCustomerInboundFactForConnection: (binding, fact) => {
        callbackFrozen.push(Object.isFrozen(binding), Object.isFrozen(fact));
        return policy.isTrustedCustomerInboundFactForConnection(binding, fact);
      },
    };
    const input = createInput();
    const before = structuredClone(input);
    const result = createConversation(input, inspectingPolicy);

    expect(input).toEqual(before);
    expect(callbackFrozen).toEqual([true, true, true]);
    expect(result.kind).toBe('applied');
    if (result.kind !== 'applied') return;
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.conversation)).toBe(true);
    expect(isValidConversationRoot(result.conversation, policy)).toBe(true);
  });
});
