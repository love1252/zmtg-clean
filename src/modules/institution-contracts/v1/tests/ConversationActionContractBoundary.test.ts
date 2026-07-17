import { describe, expect, it } from 'vitest';

import type {
  ConversationActionItemV1,
  ConversationActionSourceV1,
} from '@/modules/institution-contracts/v1/conversation-action';

const scope = {
  tenantId: 'tenant-safe-reference',
  institutionId: 'institution-safe-reference',
};

const dualPartitionAction = {
  conversationId: 'conversation-safe-reference',
  segmentId: 'segment-safe-reference',
  sourceVersion: 'source-version-safe-reference',
  production: true,
  subject: { kind: 'unmatched_contact', label: '待匹配联系人' },
  conversationState: 'awaiting_human',
  riskState: 'confirmed',
  partitions: ['waiting_human', 'unresolved_risk'],
  sortSignals: ['urgent', 'sla_due'],
  lastCustomerMessageAt: '2026-07-17T02:00:00.000Z',
  slaAt: '2026-07-17T02:05:00.000Z',
  priority: 'high',
  assignee: null,
  safeSummary: null,
  detailHref: '/hospital/conversations/conversation-safe-reference',
} satisfies ConversationActionItemV1;

describe('ConversationActionContractBoundaryV1 declaration examples', () => {
  it('documents ready and dual-partition single-action declarations', () => {
    const ready = {
      contractVersion: 'v1',
      scope,
      readiness: 'ready',
      freshness: {
        observedAt: '2026-07-17T02:00:00.000Z',
        freshUntil: '2026-07-17T02:05:00.000Z',
      },
      partitions: [
        {
          key: 'waiting_human',
          readiness: 'ready',
          freshness: {
            observedAt: '2026-07-17T02:00:00.000Z',
            freshUntil: '2026-07-17T02:05:00.000Z',
          },
          failureCode: null,
        },
        {
          key: 'unresolved_risk',
          readiness: 'ready',
          freshness: {
            observedAt: '2026-07-17T02:00:00.000Z',
            freshUntil: '2026-07-17T02:05:00.000Z',
          },
          failureCode: null,
        },
      ],
      data: { actions: [dualPartitionAction] },
      failureCode: null,
    } satisfies ConversationActionSourceV1;

    expect(ready.data.actions).toHaveLength(1);
    expect(ready.data.actions[0]?.partitions).toEqual([
      'waiting_human',
      'unresolved_risk',
    ]);
  });

  it('documents authoritative empty and partial declarations', () => {
    const empty = {
      contractVersion: 'v1',
      scope,
      readiness: 'empty',
      freshness: {
        observedAt: '2026-07-17T02:00:00.000Z',
        freshUntil: '2026-07-17T02:05:00.000Z',
      },
      partitions: [
        {
          key: 'waiting_human',
          readiness: 'empty',
          freshness: {
            observedAt: '2026-07-17T02:00:00.000Z',
            freshUntil: '2026-07-17T02:05:00.000Z',
          },
          failureCode: null,
        },
        {
          key: 'unresolved_risk',
          readiness: 'empty',
          freshness: {
            observedAt: '2026-07-17T02:00:00.000Z',
            freshUntil: '2026-07-17T02:05:00.000Z',
          },
          failureCode: null,
        },
      ],
      data: { actions: [] },
      failureCode: null,
    } satisfies ConversationActionSourceV1;

    const partial = {
      contractVersion: 'v1',
      scope,
      readiness: 'partial',
      freshness: null,
      partitions: [
        {
          key: 'waiting_human',
          readiness: 'ready',
          freshness: {
            observedAt: '2026-07-17T02:00:00.000Z',
            freshUntil: '2026-07-17T02:05:00.000Z',
          },
          failureCode: null,
        },
        {
          key: 'unresolved_risk',
          readiness: 'unavailable',
          freshness: null,
          failureCode: 'upstream_unavailable',
        },
      ],
      data: {
        actions: [
          {
            ...dualPartitionAction,
            riskState: 'none',
            partitions: ['waiting_human'],
            sortSignals: ['sla_due'],
          },
        ],
      },
      failureCode: 'upstream_unavailable',
    } satisfies ConversationActionSourceV1;

    expect(empty.data.actions).toEqual([]);
    expect(partial.data.actions[0]?.partitions).toEqual(['waiting_human']);
  });

  it('documents stale, disabled and scope-mismatch declarations without current actions', () => {
    const stale = {
      contractVersion: 'v1',
      scope,
      readiness: 'stale',
      freshness: {
        observedAt: '2026-07-17T01:00:00.000Z',
        freshUntil: '2026-07-17T01:05:00.000Z',
      },
      partitions: [
        {
          key: 'waiting_human',
          readiness: 'stale',
          freshness: {
            observedAt: '2026-07-17T01:00:00.000Z',
            freshUntil: '2026-07-17T01:05:00.000Z',
          },
          failureCode: 'data_incomplete',
        },
        {
          key: 'unresolved_risk',
          readiness: 'stale',
          freshness: {
            observedAt: '2026-07-17T01:00:00.000Z',
            freshUntil: '2026-07-17T01:05:00.000Z',
          },
          failureCode: 'data_incomplete',
        },
      ],
      data: { actions: [] },
      failureCode: 'data_incomplete',
    } satisfies ConversationActionSourceV1;

    const disabled = {
      contractVersion: 'v1',
      scope,
      readiness: 'disabled',
      freshness: null,
      partitions: [
        {
          key: 'waiting_human',
          readiness: 'disabled',
          freshness: null,
          failureCode: 'not_released',
        },
        {
          key: 'unresolved_risk',
          readiness: 'disabled',
          freshness: null,
          failureCode: 'not_released',
        },
      ],
      data: null,
      failureCode: 'not_released',
    } satisfies ConversationActionSourceV1;

    const scopeMismatch = {
      contractVersion: 'v1',
      scope,
      readiness: 'denied',
      freshness: null,
      partitions: [
        {
          key: 'waiting_human',
          readiness: 'denied',
          freshness: null,
          failureCode: 'scope_mismatch',
        },
        {
          key: 'unresolved_risk',
          readiness: 'denied',
          freshness: null,
          failureCode: 'scope_mismatch',
        },
      ],
      data: null,
      failureCode: 'scope_mismatch',
    } satisfies ConversationActionSourceV1;

    const denied = {
      contractVersion: 'v1',
      scope,
      readiness: 'denied',
      freshness: null,
      partitions: [
        {
          key: 'waiting_human',
          readiness: 'denied',
          freshness: null,
          failureCode: 'permission_denied',
        },
        {
          key: 'unresolved_risk',
          readiness: 'denied',
          freshness: null,
          failureCode: 'permission_denied',
        },
      ],
      data: null,
      failureCode: 'permission_denied',
    } satisfies ConversationActionSourceV1;

    expect(stale.data.actions).toEqual([]);
    expect(disabled.data).toBeNull();
    expect(denied.data).toBeNull();
    expect(scopeMismatch.data).toBeNull();
  });
});
