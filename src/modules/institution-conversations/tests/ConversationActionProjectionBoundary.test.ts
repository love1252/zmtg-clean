import { describe, expect, it } from 'vitest';

import {
  projectConversationActionSource,
  type ConversationActionProjectionInput,
} from '@/modules/institution-conversations/domain/conversation-action-projection';

const scope = { tenantId: 'ten_cccccccccccccccc', institutionId: 'ins_cccccccccccccccc' } as const;
const conversationId = 'con_cccccccccccccccc';
const segmentId = 'seg_cccccccccccccccc';
const at = '2026-07-18T02:00:00.000Z';
const freshUntil = '2026-07-18T02:10:00.000Z';

const sourceOf = (result: ReturnType<typeof projectConversationActionSource>) => {
  expect(result.kind).toBe('projected');
  if (result.kind !== 'projected') {
    throw new Error('expected projected conversation action source');
  }
  return result.source;
};

const sourceInput = (): ConversationActionProjectionInput => ({
  scope,
  viewer: { authority: 'server_authorized', role: 'tenant_admin', userId: 'usr_cccccccccccccccc' },
  freshness: { observedAt: at, freshUntil },
  partitions: [
    { key: 'waiting_human', readiness: 'ready', freshness: { observedAt: at, freshUntil }, failureCode: null },
    { key: 'unresolved_risk', readiness: 'ready', freshness: { observedAt: at, freshUntil }, failureCode: null },
  ],
  candidates: [{
    productionEvidence: {
      kind: 'server_persisted_current', ...scope, conversationId, segmentId,
      sourceVersion: 'srcv_cccccccccccccccc',
    },
    conversation: {
      conversationId, ...scope, channelType: 'channel-safe', serviceProviderType: 'provider-safe',
      connectionInstanceId: 'connection-safe', channelConversationRef: 'reference-safe',
      customerReference: null, identityState: 'unmatched', activeSegmentId: segmentId,
      latestCustomerInboundMessageId: 'message-safe', latestCustomerInboundAt: at,
      latestCustomerInboundRevision: 1, lastClosedSegmentId: null, lastSegmentClosedAt: null,
      lastClosedSegmentInboundMessageId: null, lastClosedSegmentInboundAt: null,
      lastClosedSegmentInboundRevision: null, identityUpdatedAt: at, segmentUpdatedAt: at,
      createdAt: at, updatedAt: at,
    },
    segment: {
      ...scope, segmentId, conversationId, sequenceNo: 1, state: 'awaiting_human',
      currentHandlerId: null, everHumanHandled: false, openedByCustomerMessageId: 'message-safe',
      openedAt: at, lastCustomerMessageId: 'message-safe', lastCustomerMessageAt: at,
      latestInboundRevision: 1, waitingAfterCustomerMessageId: null,
      waitingAfterCustomerMessageAt: null, waitingAfterInboundRevision: null,
      stateChangedAt: at, closedAt: null, segmentCloseKind: 'open', resolutionState: 'open',
      resolvedAt: null, blockingReasonCodes: [],
    },
    assignment: {
      ...scope, conversationId, segmentId, revision: 0, assignmentId: null,
      assigneeRole: null, assignmentStatus: null, activeAssignmentCount: 0, assigneeId: null,
    },
    risk: { state: 'none' },
    lastCustomerMessage: {
      ...scope, messageId: 'message-safe', conversationId, segmentId, direction: 'inbound',
      senderKind: 'customer', occurredAt: at, receivedAt: at,
      authorizedContentReference: 'content:authorized:ref_cccccccccccccccc',
      safeSummary: { code: 'customer_message_received', text: '已收到客户消息。' },
      sourceMessageRef: 'source:message:ref_cccccccccccccccc', idempotencyKey: 'idempotency-safe-key-0002',
    },
    approved: {
      sourceVersion: 'srcv_cccccccccccccccc', sortSignals: [], slaAt: null,
      priority: 'normal', assignee: null,
    },
  }],
});

describe('conversation action projection boundaries', () => {
  it.each([
    ['stale', 'data_incomplete'],
    ['denied', 'permission_denied'],
    ['disabled', 'not_released'],
  ] as const)('%s 不返回 action、subject 或 href', (readiness, failureCode) => {
    const raw = sourceInput();
    const source = sourceOf(projectConversationActionSource({
      ...raw,
      partitions: raw.partitions.map((partition) => ({
        ...partition,
        readiness,
        freshness: readiness === 'stale' ? partition.freshness : null,
        failureCode,
      })),
    } as ConversationActionProjectionInput));

    expect(source.data === null ? null : source.data.actions).toEqual(
      source.data === null ? null : [],
    );
  });

  it('scope mismatch 一律 null data，即使另一个分区准备就绪', () => {
    const raw = sourceInput();
    const source = sourceOf(projectConversationActionSource({
      ...raw,
      partitions: [
        raw.partitions[0]!,
        { ...raw.partitions[1]!, readiness: 'denied', freshness: null, failureCode: 'scope_mismatch' },
      ],
    }));

    expect(source).toMatchObject({ readiness: 'denied', data: null, failureCode: 'scope_mismatch' });
  });

  it('partial 只保留 fresh ready 分区，stale 分区绝不贡献 action 状态', () => {
    const raw = sourceInput();
    const source = sourceOf(projectConversationActionSource({
      ...raw,
      partitions: [
        { ...raw.partitions[0]!, readiness: 'stale', failureCode: 'data_incomplete' },
        raw.partitions[1]!,
      ],
      candidates: [{
        ...raw.candidates[0]!,
        risk: {
          state: 'confirmed',
          riskId: 'risk_cccccccccccccccc',
          ...scope,
          conversationId,
          segmentId,
          sourceMessageId: 'message-safe',
          riskDomain: 'non_clinical',
          riskCode: 'risk_safe',
          detectedAt: at,
          confirmedAt: at,
          resolvedAt: null,
          clinicalClosureReferenceId: null,
        },
      }],
    }));

    expect(source).toMatchObject({ readiness: 'partial', failureCode: 'data_incomplete' });
    expect(source.data?.actions).toEqual([
      expect.objectContaining({ partitions: ['unresolved_risk'] }),
    ]);
  });

  it('分区必须恰好覆盖两个键，且 current/不可用状态不得伪造 freshness 或 failure', () => {
    const raw = sourceInput();
    expect(projectConversationActionSource({
      ...raw,
      partitions: [raw.partitions[0]!, raw.partitions[0]!],
    } as ConversationActionProjectionInput)).toEqual({ kind: 'blocked', code: 'invalid_input' });
    expect(projectConversationActionSource({
      ...raw,
      partitions: raw.partitions.map((partition) => ({
        ...partition,
        failureCode: 'data_incomplete',
      })),
    } as ConversationActionProjectionInput)).toEqual({ kind: 'blocked', code: 'invalid_input' });
    expect(projectConversationActionSource({
      ...raw,
      partitions: raw.partitions.map((partition) => ({
        ...partition,
        readiness: 'unavailable',
        freshness: null,
        failureCode: null,
      })),
    } as ConversationActionProjectionInput)).toEqual({ kind: 'blocked', code: 'invalid_input' });
  });

  it('结束分段、失配事实、正文或 AI summary 均不得形成 action', () => {
    const raw = sourceInput();
    const candidate = raw.candidates[0]!;
    const ended = sourceOf(projectConversationActionSource({
      ...raw,
      candidates: [{ ...candidate, segment: { ...candidate.segment, state: 'closed', closedAt: at } }],
    }));
    expect(ended.data?.actions).toEqual([]);

    const bodyCarrying = sourceOf(projectConversationActionSource({
      ...raw,
      candidates: [{
        ...candidate,
        lastCustomerMessage: { ...candidate.lastCustomerMessage, messageBody: '不应进入 action' } as never,
      }],
    }));
    expect(bodyCarrying).toMatchObject({ readiness: 'unavailable', data: null });

    const aiSummary = sourceOf(projectConversationActionSource({
      ...raw,
      candidates: [{
        ...candidate,
        lastCustomerMessage: {
          ...candidate.lastCustomerMessage,
          senderKind: 'ai',
          direction: 'outbound',
          safeSummary: { code: 'ai_message_recorded', text: 'AI 消息已记录。' },
          sourceMessageRef: null,
          idempotencyKey: null,
        } as never,
      }],
    }));
    expect(aiSummary).toMatchObject({ readiness: 'unavailable', data: null });
  });

  it('Proxy/accessor、跨 scope、未批准 sort signal 和非 canonical target 均 fail-closed', () => {
    const raw = sourceInput();
    const candidate = raw.candidates[0]!;
    const accessorMessage = { ...candidate.lastCustomerMessage };
    Object.defineProperty(accessorMessage, 'safeSummary', {
      enumerable: true,
      get: () => candidate.lastCustomerMessage.safeSummary,
    });
    expect(sourceOf(projectConversationActionSource({
      ...raw,
      candidates: [{ ...candidate, lastCustomerMessage: accessorMessage as never }],
    }))).toMatchObject({ readiness: 'unavailable', data: null });

    const proxiedCandidate = new Proxy(candidate, {
      getOwnPropertyDescriptor: (target, property) => (
        property === 'approved'
          ? {
              configurable: true,
              enumerable: true,
              writable: true,
              value: { ...target.approved, sortSignals: ['unapproved'] },
            }
          : Reflect.getOwnPropertyDescriptor(target, property)
      ),
    });
    expect(sourceOf(projectConversationActionSource({ ...raw, candidates: [proxiedCandidate] }))).toMatchObject({
      readiness: 'unavailable', data: null,
    });
    expect(sourceOf(projectConversationActionSource({
      ...raw,
      candidates: [{ ...candidate, segment: { ...candidate.segment, institutionId: 'ins_other' } }],
    }))).toMatchObject({ readiness: 'denied', data: null, failureCode: 'scope_mismatch' });
    expect(sourceOf(projectConversationActionSource({
      ...raw,
      candidates: [{ ...candidate, approved: { ...candidate.approved, sortSignals: ['unapproved'] as never } }],
    }))).toMatchObject({ readiness: 'unavailable', data: null });
  });

  it('未知角色来源、自由摘要和未知渠道或服务商均 fail-closed', () => {
    const raw = sourceInput();
    const candidate = raw.candidates[0]!;
    expect(projectConversationActionSource({
      ...raw,
      viewer: { ...raw.viewer, authority: 'browser_inferred' } as never,
    })).toEqual({ kind: 'blocked', code: 'invalid_input' });
    expect(sourceOf(projectConversationActionSource({
      ...raw,
      candidates: [{
        ...candidate,
        lastCustomerMessage: {
          ...candidate.lastCustomerMessage,
          safeSummary: {
            code: 'customer_message_received',
            text: '任意自由文本',
          } as never,
        },
      }],
    }))).toMatchObject({ readiness: 'unavailable', data: null });
    expect(sourceOf(projectConversationActionSource({
      ...raw,
      candidates: [{
        ...candidate,
        conversation: { ...candidate.conversation, channelType: '' },
      }],
    }))).toMatchObject({ readiness: 'unavailable', data: null });
    expect(sourceOf(projectConversationActionSource({
      ...raw,
      candidates: [{
        ...candidate,
        conversation: { ...candidate.conversation, serviceProviderType: '' },
      }],
    }))).toMatchObject({ readiness: 'unavailable', data: null });
  });

  it('活动 action 不得复用 segment 或 sourceVersion', () => {
    const raw = sourceInput();
    const candidate = raw.candidates[0]!;
    const duplicateSegment = {
      ...candidate,
      productionEvidence: { ...candidate.productionEvidence },
    };
    expect(sourceOf(projectConversationActionSource({
      ...raw,
      candidates: [candidate, duplicateSegment],
    }))).toMatchObject({ readiness: 'unavailable', data: null, failureCode: 'invalid_payload' });

    const duplicateSourceVersion = {
      ...candidate,
      productionEvidence: {
        ...candidate.productionEvidence,
        conversationId: 'con_other',
        segmentId: 'seg_other',
      },
      conversation: {
        ...candidate.conversation,
        conversationId: 'con_other',
        activeSegmentId: 'seg_other',
      },
      segment: {
        ...candidate.segment,
        conversationId: 'con_other',
        segmentId: 'seg_other',
      },
      assignment: {
        ...candidate.assignment,
        conversationId: 'con_other',
        segmentId: 'seg_other',
      },
      risk: {
        ...candidate.risk,
        conversationId: 'con_other',
        segmentId: 'seg_other',
      },
      lastCustomerMessage: {
        ...candidate.lastCustomerMessage,
        conversationId: 'con_other',
        segmentId: 'seg_other',
      },
    };
    expect(sourceOf(projectConversationActionSource({
      ...raw,
      candidates: [candidate, duplicateSourceVersion],
    }))).toMatchObject({ readiness: 'unavailable', data: null, failureCode: 'invalid_payload' });
    expect(sourceOf(projectConversationActionSource({
      ...raw,
      candidates: [{
        ...candidate,
        approved: { ...candidate.approved, sourceVersion: 'srcv_other' },
      }],
    }))).toMatchObject({ readiness: 'unavailable', data: null, failureCode: 'invalid_payload' });
  });
});
