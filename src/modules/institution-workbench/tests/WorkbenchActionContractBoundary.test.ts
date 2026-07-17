import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  CARE_ACTION_PARTITION_KEYS_V1,
  type CareActionCardV1,
  type CareActionItemV1,
  type CareActionSourceV1,
  type CareAppointmentActionItemV1,
  type CareFollowUpActionItemV1,
} from '@/modules/institution-contracts/v1/care-action';
import {
  CONVERSATION_ACTION_PARTITION_KEYS_V1,
  type ConversationActionItemV1,
  type ConversationActionSourceV1,
} from '@/modules/institution-contracts/v1/conversation-action';
import {
  buildWorkbenchActionProjection,
  type BuildWorkbenchActionProjectionInput,
} from '@/modules/institution-workbench/domain/workbench-action-aggregation';
import type {
  WorkbenchActionFilter,
  WorkbenchActionProjection,
} from '@/modules/institution-workbench/domain/workbench-action-view-models';

const scope = {
  tenantId: 'tenant-safe-reference',
  institutionId: 'institution-safe-reference',
};

const currentFreshness = {
  observedAt: '2026-07-17T01:00:00.000Z',
  freshUntil: '2026-07-17T01:05:00.000Z',
};

function appointment(
  id: string,
  overrides: Partial<CareAppointmentActionItemV1> = {},
): CareAppointmentActionItemV1 {
  const base: CareAppointmentActionItemV1 = {
    entityType: 'appointment',
    objectId: id,
    sourceVersion: `version-${id}`,
    customer: {
      contractVersion: 'v1',
      customerId: `customer-${id}`,
      displayName: `客户 ${id}`,
      maskedReference: `客户-${id}`,
    },
    businessState: 'pending_confirmation',
    cardKeys: ['pending_confirmation_appointments'],
    sortSignals: ['today'],
    appointmentAt: '2026-07-17T09:00:00.000Z',
    dueAt: null,
    slaAt: null,
    riskLevel: 'normal',
    priority: 'normal',
    owner: {
      kind: 'user',
      userId: `user-${id}`,
      displayName: `成员 ${id}`,
    },
    safeSummary: null,
    detailHref: `/hospital/care/appointments/${id}`,
  };

  return { ...base, ...overrides };
}

function followUp(
  id: string,
  overrides: Partial<CareFollowUpActionItemV1> = {},
): CareFollowUpActionItemV1 {
  const base: CareFollowUpActionItemV1 = {
    entityType: 'followup',
    objectId: id,
    sourceVersion: `version-${id}`,
    customer: {
      contractVersion: 'v1',
      customerId: `customer-${id}`,
      displayName: `客户 ${id}`,
      maskedReference: null,
    },
    businessState: 'pending',
    cardKeys: ['overdue_followups'],
    sortSignals: ['overdue'],
    appointmentAt: null,
    dueAt: '2026-07-17T09:00:00.000Z',
    slaAt: null,
    riskLevel: 'watch',
    priority: 'high',
    owner: null,
    safeSummary: null,
    detailHref: `/hospital/care/followups/${id}`,
  };

  return { ...base, ...overrides };
}

function conversation(
  id: string,
  overrides: Partial<ConversationActionItemV1> = {},
): ConversationActionItemV1 {
  const base: ConversationActionItemV1 = {
    conversationId: id,
    segmentId: `segment-${id}`,
    sourceVersion: `version-${id}`,
    production: true,
    subject: {
      kind: 'customer',
      customer: {
        contractVersion: 'v1',
        customerId: `customer-${id}`,
        displayName: `客户 ${id}`,
        maskedReference: `客户-${id}`,
      },
    },
    conversationState: 'awaiting_human',
    riskState: 'none',
    partitions: ['waiting_human'],
    sortSignals: ['sla_due'],
    lastCustomerMessageAt: '2026-07-17T09:00:00.000Z',
    slaAt: '2026-07-17T09:05:00.000Z',
    priority: 'high',
    assignee: {
      userId: `user-${id}`,
      displayName: `成员 ${id}`,
    },
    safeSummary: null,
    detailHref: `/hospital/conversations/${id}`,
  };

  return { ...base, ...overrides };
}

function card(key: CareActionCardV1['key'], count: number): CareActionCardV1 {
  switch (key) {
    case 'pending_confirmation_appointments':
      return {
        key,
        count,
        canonicalHref: '/hospital/care/appointments?status=pending_confirmation',
      };
    case 'reschedule_requested_appointments':
      return {
        key,
        count,
        canonicalHref: '/hospital/care/appointments?status=reschedule_requested',
      };
    case 'overdue_followups':
      return {
        key,
        count,
        canonicalHref: '/hospital/care/followups?bucket=overdue',
      };
    case 'today_due_followups':
      return {
        key,
        count,
        canonicalHref: '/hospital/care/followups?bucket=today',
      };
  }
}

function emptyCareSource(): CareActionSourceV1 {
  return {
    contractVersion: 'v1',
    scope,
    readiness: 'empty',
    freshness: currentFreshness,
    partitions: CARE_ACTION_PARTITION_KEYS_V1.map((key) => ({
      key,
      readiness: 'empty' as const,
      freshness: currentFreshness,
      failureCode: null,
    })),
    data: {
      cards: CARE_ACTION_PARTITION_KEYS_V1.map((key) => card(key, 0)),
      actions: [],
    },
    failureCode: null,
  };
}

function emptyConversationSource(): ConversationActionSourceV1 {
  return {
    contractVersion: 'v1',
    scope,
    readiness: 'empty',
    freshness: currentFreshness,
    partitions: CONVERSATION_ACTION_PARTITION_KEYS_V1.map((key) => ({
      key,
      readiness: 'empty' as const,
      freshness: currentFreshness,
      failureCode: null,
    })),
    data: { actions: [] },
    failureCode: null,
  };
}

function readyConversationSource(actions: ConversationActionItemV1[]): ConversationActionSourceV1 {
  return {
    contractVersion: 'v1',
    scope,
    readiness: 'ready',
    freshness: currentFreshness,
    partitions: CONVERSATION_ACTION_PARTITION_KEYS_V1.map((key) => ({
      key,
      readiness: 'ready' as const,
      freshness: currentFreshness,
      failureCode: null,
    })),
    data: { actions },
    failureCode: null,
  };
}

function collectObjectKeys(value: unknown, result = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectObjectKeys(item, result);
    }
    return result;
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      result.add(key);
      collectObjectKeys(nested, result);
    }
  }

  return result;
}

describe('WorkbenchActionContractBoundary typed consumer projection', () => {
  it('keeps the public input exact and avoids forbidden runtime-layer imports', () => {
    expectTypeOf<Parameters<typeof buildWorkbenchActionProjection>[0]>().toEqualTypeOf<
      BuildWorkbenchActionProjectionInput
    >();
    expectTypeOf<keyof BuildWorkbenchActionProjectionInput>().toEqualTypeOf<
      'care' | 'conversation' | 'filter'
    >();
    expectTypeOf<BuildWorkbenchActionProjectionInput['care']>().toEqualTypeOf<CareActionSourceV1>();
    expectTypeOf<
      BuildWorkbenchActionProjectionInput['conversation']
    >().toEqualTypeOf<ConversationActionSourceV1>();
    expectTypeOf<BuildWorkbenchActionProjectionInput['filter']>().toEqualTypeOf<WorkbenchActionFilter>();
    expectTypeOf<ReturnType<typeof buildWorkbenchActionProjection>>().toEqualTypeOf<
      WorkbenchActionProjection
    >();

    const implementation = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/institution-workbench/domain/workbench-action-aggregation.ts',
      ),
      'utf8',
    );
    const importSpecifiers = Array.from(
      implementation.matchAll(/from ['"]([^'"]+)['"]/g),
      (match) => match[1],
    );
    expect(importSpecifiers).toEqual([
      '@/modules/institution-contracts/v1/care-action',
      '@/modules/institution-contracts/v1/conversation-action',
      '@/modules/institution-contracts/v1/institution-action',
      './workbench-action-view-models',
    ]);
    expect(implementation).not.toContain('CustomerLifecycleSummaryV1');
    expect(implementation).not.toContain('CapabilityStatusV1');
  });

  it('keeps all emitted detail paths canonical across dot-segment and safe opaque IDs', () => {
    const care: CareActionSourceV1 = {
      ...emptyCareSource(),
      readiness: 'ready',
      partitions: CARE_ACTION_PARTITION_KEYS_V1.map((key) => ({
        key,
        readiness: 'ready' as const,
        freshness: currentFreshness,
        failureCode: null,
      })),
      data: {
        cards: CARE_ACTION_PARTITION_KEYS_V1.map((key) => card(key, 1)),
        actions: [
          appointment('.'),
          appointment('..'),
          followUp('.'),
          followUp('..'),
          appointment('.safe'),
          followUp('safe..id'),
        ],
      },
    };
    const result = buildWorkbenchActionProjection({
      care,
      conversation: readyConversationSource([
        conversation('.'),
        conversation('..'),
        conversation('...'),
      ]),
      filter: 'all',
    });

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    expect(result.desktopActions.map((row) => row.key).sort()).toEqual([
      'appointment:.safe',
      'conversation:...',
      'followup:safe..id',
    ]);
    for (const row of result.desktopActions) {
      expect(new URL(row.detailHref, 'https://example.invalid').pathname).toBe(row.detailHref);
    }
  });

  it('projects four cards in fixed order and permits zero only for authoritative empty', () => {
    const care: CareActionSourceV1 = {
      contractVersion: 'v1',
      scope,
      readiness: 'ready',
      freshness: currentFreshness,
      partitions: [
        {
          key: 'pending_confirmation_appointments',
          readiness: 'ready',
          freshness: currentFreshness,
          failureCode: null,
        },
        {
          key: 'reschedule_requested_appointments',
          readiness: 'empty',
          freshness: currentFreshness,
          failureCode: null,
        },
        {
          key: 'overdue_followups',
          readiness: 'ready',
          freshness: currentFreshness,
          failureCode: null,
        },
        {
          key: 'today_due_followups',
          readiness: 'empty',
          freshness: currentFreshness,
          failureCode: null,
        },
      ],
      data: {
        cards: [
          card('pending_confirmation_appointments', 2),
          card('reschedule_requested_appointments', 0),
          card('overdue_followups', 3),
          card('today_due_followups', 0),
        ],
        actions: [],
      },
      failureCode: null,
    };

    const result = buildWorkbenchActionProjection({
      care,
      conversation: emptyConversationSource(),
      filter: 'all',
    });

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    expect(result.cards.map((item) => [item.key, item.status, item.count])).toEqual([
      ['pending_confirmation_appointments', 'ready', 2],
      ['reschedule_requested_appointments', 'empty', 0],
      ['overdue_followups', 'ready', 3],
      ['today_due_followups', 'empty', 0],
    ]);
    expect(result.cards.map((item) => ('canonicalHref' in item ? item.canonicalHref : null))).toEqual([
      '/hospital/care/appointments?status=pending_confirmation',
      '/hospital/care/appointments?status=reschedule_requested',
      '/hospital/care/followups?bucket=overdue',
      '/hospital/care/followups?bucket=today',
    ]);

    const invalidReadyZero = buildWorkbenchActionProjection({
      care: {
        ...care,
        data: {
          ...care.data!,
          cards: care.data!.cards.map((item) =>
            item.key === 'pending_confirmation_appointments'
              ? card('pending_confirmation_appointments', 0)
              : item,
          ),
        },
      },
      conversation: emptyConversationSource(),
      filter: 'all',
    });
    expect(invalidReadyZero.status).toBe('projected');
    if (invalidReadyZero.status === 'projected') {
      expect(invalidReadyZero.cards[0]).toEqual({
        key: 'pending_confirmation_appointments',
        title: '待确认预约',
        status: 'unavailable',
        count: null,
      });
    }

    const invalidEmptyNonzero = buildWorkbenchActionProjection({
      care: {
        ...care,
        data: {
          ...care.data!,
          cards: care.data!.cards.map((item) =>
            item.key === 'reschedule_requested_appointments'
              ? card('reschedule_requested_appointments', 1)
              : item,
          ),
        },
      },
      conversation: emptyConversationSource(),
      filter: 'all',
    });
    expect(invalidEmptyNonzero.status).toBe('projected');
    if (invalidEmptyNonzero.status === 'projected') {
      expect(
        invalidEmptyNonzero.cards.find(
          (item) => item.key === 'reschedule_requested_appointments',
        ),
      ).toEqual({
        key: 'reschedule_requested_appointments',
        title: '改约申请',
        status: 'unavailable',
        count: null,
      });
    }
  });

  it('maps partial Care partitions independently without stale, unavailable or denied actions', () => {
    const staleFreshness = {
      observedAt: '2026-07-17T00:30:00.000Z',
      freshUntil: '2026-07-17T00:35:00.000Z',
    };
    const care: CareActionSourceV1 = {
      contractVersion: 'v1',
      scope,
      readiness: 'partial',
      freshness: null,
      partitions: [
        {
          key: 'pending_confirmation_appointments',
          readiness: 'ready',
          freshness: currentFreshness,
          failureCode: null,
        },
        {
          key: 'reschedule_requested_appointments',
          readiness: 'stale',
          freshness: staleFreshness,
          failureCode: 'data_incomplete',
        },
        {
          key: 'overdue_followups',
          readiness: 'unavailable',
          freshness: null,
          failureCode: 'upstream_unavailable',
        },
        {
          key: 'today_due_followups',
          readiness: 'denied',
          freshness: null,
          failureCode: 'permission_denied',
        },
      ],
      data: {
        cards: [
          card('pending_confirmation_appointments', 2),
          card('reschedule_requested_appointments', 3),
          card('today_due_followups', 99),
        ],
        actions: [
          appointment('ready-action'),
          appointment('stale-action', {
            businessState: 'confirmed',
            cardKeys: ['reschedule_requested_appointments'],
          }),
          followUp('unavailable-action', { cardKeys: ['overdue_followups'] }),
          followUp('denied-action', { cardKeys: ['today_due_followups'] }),
        ],
      },
      failureCode: 'upstream_unavailable',
    };

    const result = buildWorkbenchActionProjection({
      care,
      conversation: emptyConversationSource(),
      filter: 'all',
    });

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    expect(result.cards).toEqual([
      {
        key: 'pending_confirmation_appointments',
        title: '待确认预约',
        status: 'ready',
        count: 2,
        observedAt: currentFreshness.observedAt,
        canonicalHref: '/hospital/care/appointments?status=pending_confirmation',
      },
      {
        key: 'reschedule_requested_appointments',
        title: '改约申请',
        status: 'stale',
        count: 3,
        observedAt: staleFreshness.observedAt,
      },
      {
        key: 'overdue_followups',
        title: '逾期随访',
        status: 'unavailable',
        count: null,
      },
    ]);
    expect(result.desktopActions.map((row) => row.key)).toEqual(['appointment:ready-action']);
    expect('canonicalHref' in result.cards[1]!).toBe(false);

    const noSnapshot = buildWorkbenchActionProjection({
      care: {
        ...care,
        data: {
          ...care.data!,
          cards: care.data!.cards.filter(
            (item) => item.key !== 'reschedule_requested_appointments',
          ),
        },
      },
      conversation: emptyConversationSource(),
      filter: 'all',
    });
    expect(noSnapshot.status).toBe('projected');
    if (noSnapshot.status === 'projected') {
      expect(
        noSnapshot.cards.find((item) => item.key === 'reschedule_requested_appointments'),
      ).toEqual({
        key: 'reschedule_requested_appointments',
        title: '改约申请',
        status: 'stale',
        count: null,
        observedAt: null,
      });
    }
  });

  it('does not synthesize appointment cards, zeroes, links or actions when HIS partitions are disabled', () => {
    const care: CareActionSourceV1 = {
      contractVersion: 'v1',
      scope,
      readiness: 'partial',
      freshness: null,
      partitions: [
        {
          key: 'pending_confirmation_appointments',
          readiness: 'disabled',
          freshness: null,
          failureCode: 'not_released',
        },
        {
          key: 'reschedule_requested_appointments',
          readiness: 'disabled',
          freshness: null,
          failureCode: 'not_released',
        },
        {
          key: 'overdue_followups',
          readiness: 'empty',
          freshness: currentFreshness,
          failureCode: null,
        },
        {
          key: 'today_due_followups',
          readiness: 'empty',
          freshness: currentFreshness,
          failureCode: null,
        },
      ],
      data: {
        cards: [card('overdue_followups', 0), card('today_due_followups', 0)],
        actions: [appointment('must-not-appear'), followUp('empty-must-not-appear')],
      },
      failureCode: null,
    };

    const result = buildWorkbenchActionProjection({
      care,
      conversation: emptyConversationSource(),
      filter: 'all',
    });

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    expect(result.cards.map((item) => item.key)).toEqual([
      'overdue_followups',
      'today_due_followups',
    ]);
    expect(result.cards.every((item) => item.status === 'empty' && item.count === 0)).toBe(true);
    expect(result.desktopActions).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('/hospital/care/appointments');
  });

  it('maps top-level Care stale/unavailable safely and omits denied/disabled business data', () => {
    const staleSource: CareActionSourceV1 = {
      ...emptyCareSource(),
      readiness: 'stale',
      partitions: CARE_ACTION_PARTITION_KEYS_V1.map((key) => ({
        key,
        readiness: 'stale' as const,
        freshness: currentFreshness,
        failureCode: 'data_incomplete' as const,
      })),
      data: {
        cards: CARE_ACTION_PARTITION_KEYS_V1.map((key) => card(key, 1)),
        actions: [appointment('stale-must-not-appear')],
      },
      failureCode: 'data_incomplete',
    };
    const stale = buildWorkbenchActionProjection({
      care: staleSource,
      conversation: emptyConversationSource(),
      filter: 'all',
    });
    expect(stale.status).toBe('projected');
    if (stale.status === 'projected') {
      expect(stale.cards).toHaveLength(4);
      expect(
        stale.cards.every(
          (item) =>
            item.status === 'stale' &&
            item.count === 1 &&
            item.observedAt === currentFreshness.observedAt &&
            !('canonicalHref' in item),
        ),
      ).toBe(true);
      expect(stale.desktopActions).toEqual([]);
    }

    const unavailableSource: CareActionSourceV1 = {
      ...emptyCareSource(),
      readiness: 'unavailable',
      freshness: null,
      partitions: CARE_ACTION_PARTITION_KEYS_V1.map((key) => ({
        key,
        readiness: 'unavailable' as const,
        freshness: null,
        failureCode: 'upstream_unavailable' as const,
      })),
      data: null,
      failureCode: 'upstream_unavailable',
    };
    const unavailable = buildWorkbenchActionProjection({
      care: unavailableSource,
      conversation: emptyConversationSource(),
      filter: 'all',
    });
    expect(unavailable.status).toBe('projected');
    if (unavailable.status === 'projected') {
      expect(unavailable.cards).toHaveLength(4);
      expect(
        unavailable.cards.every(
          (item) => item.status === 'unavailable' && item.count === null,
        ),
      ).toBe(true);
      expect(unavailable.desktopActions).toEqual([]);
    }

    for (const [readiness, failureCode] of [
      ['denied', 'permission_denied'],
      ['disabled', 'not_released'],
    ] as const) {
      const source: CareActionSourceV1 = {
        ...emptyCareSource(),
        readiness,
        freshness: null,
        partitions: CARE_ACTION_PARTITION_KEYS_V1.map((key) => ({
          key,
          readiness,
          freshness: null,
          failureCode,
        })),
        data: null,
        failureCode,
      };
      const result = buildWorkbenchActionProjection({
        care: source,
        conversation: emptyConversationSource(),
        filter: 'all',
      });
      expect(result.status).toBe('projected');
      if (result.status === 'projected') {
        expect(result.cards).toEqual([]);
        expect(result.desktopActions).toEqual([]);
      }
    }
  });

  it('keeps a dual-partition conversation as one row and accepts only ready partial partitions', () => {
    const dual = conversation('dual', {
      conversationState: 'awaiting_human',
      riskState: 'confirmed',
      partitions: ['waiting_human', 'unresolved_risk'],
      sortSignals: ['urgent', 'sla_due'],
      subject: { kind: 'unmatched_contact', label: '待匹配联系人' },
      assignee: null,
    });
    const ready = buildWorkbenchActionProjection({
      care: emptyCareSource(),
      conversation: readyConversationSource([dual]),
      filter: 'conversation',
    });

    expect(ready.status).toBe('projected');
    if (ready.status === 'projected') {
      expect(ready.desktopActions).toHaveLength(1);
      expect(ready.desktopActions[0]).toMatchObject({
        key: 'conversation:dual',
        subject: { kind: 'unmatched_contact', label: '待匹配联系人' },
        partitions: ['waiting_human', 'unresolved_risk'],
      });
    }

    const partialConversation: ConversationActionSourceV1 = {
      contractVersion: 'v1',
      scope,
      readiness: 'partial',
      freshness: null,
      partitions: [
        {
          key: 'waiting_human',
          readiness: 'ready',
          freshness: currentFreshness,
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
          conversation('ready-conversation'),
          conversation('unavailable-conversation', {
            conversationState: 'human_handling',
            riskState: 'confirmed',
            partitions: ['unresolved_risk'],
          }),
          conversation('mixed-conversation', {
            riskState: 'confirmed',
            partitions: ['waiting_human', 'unresolved_risk'],
          }),
        ],
      },
      failureCode: 'upstream_unavailable',
    };
    const partial = buildWorkbenchActionProjection({
      care: emptyCareSource(),
      conversation: partialConversation,
      filter: 'conversation',
    });

    expect(partial.status).toBe('projected');
    if (partial.status === 'projected') {
      expect(partial.desktopActions.map((row) => row.key)).toEqual([
        'conversation:ready-conversation',
      ]);
    }
  });

  it('removes all conversation rows for stale, unavailable, denied and disabled sources', () => {
    const action = conversation('must-not-appear');
    const sources: ConversationActionSourceV1[] = [
      {
        ...readyConversationSource([action]),
        readiness: 'stale',
        partitions: CONVERSATION_ACTION_PARTITION_KEYS_V1.map((key) => ({
          key,
          readiness: 'stale' as const,
          freshness: currentFreshness,
          failureCode: 'data_incomplete' as const,
        })),
        failureCode: 'data_incomplete',
      },
      {
        ...readyConversationSource([]),
        readiness: 'unavailable',
        freshness: null,
        partitions: CONVERSATION_ACTION_PARTITION_KEYS_V1.map((key) => ({
          key,
          readiness: 'unavailable' as const,
          freshness: null,
          failureCode: 'upstream_unavailable' as const,
        })),
        data: null,
        failureCode: 'upstream_unavailable',
      },
      {
        ...readyConversationSource([]),
        readiness: 'denied',
        freshness: null,
        partitions: CONVERSATION_ACTION_PARTITION_KEYS_V1.map((key) => ({
          key,
          readiness: 'denied' as const,
          freshness: null,
          failureCode: 'permission_denied' as const,
        })),
        data: null,
        failureCode: 'permission_denied',
      },
      {
        ...readyConversationSource([]),
        readiness: 'disabled',
        freshness: null,
        partitions: CONVERSATION_ACTION_PARTITION_KEYS_V1.map((key) => ({
          key,
          readiness: 'disabled' as const,
          freshness: null,
          failureCode: 'not_released' as const,
        })),
        data: null,
        failureCode: 'not_released',
      },
    ];

    for (const source of sources) {
      const result = buildWorkbenchActionProjection({
        care: emptyCareSource(),
        conversation: source,
        filter: 'conversation',
      });
      expect(result.status).toBe('projected');
      if (result.status === 'projected') {
        expect(result.desktopActions).toEqual([]);
        expect(result.mobileActions).toEqual([]);
      }
    }
  });

  it('fails closed on cross-source or declared scope mismatch without exposing a failure code', () => {
    const crossScope = buildWorkbenchActionProjection({
      care: emptyCareSource(),
      conversation: {
        ...emptyConversationSource(),
        scope: { ...scope, institutionId: 'different-institution' },
      },
      filter: 'all',
    });
    expect(crossScope).toEqual({
      status: 'blocked',
      filter: 'all',
      cards: [],
      desktopActions: [],
      mobileActions: [],
    });

    const scopeMismatchCare: CareActionSourceV1 = {
      ...emptyCareSource(),
      readiness: 'denied',
      freshness: null,
      partitions: CARE_ACTION_PARTITION_KEYS_V1.map((key) => ({
        key,
        readiness: 'denied' as const,
        freshness: null,
        failureCode: 'scope_mismatch' as const,
      })),
      data: null,
      failureCode: 'scope_mismatch',
    };
    const declaredMismatch = buildWorkbenchActionProjection({
      care: scopeMismatchCare,
      conversation: emptyConversationSource(),
      filter: 'all',
    });
    expect(declaredMismatch).toEqual({
      status: 'blocked',
      filter: 'all',
      cards: [],
      desktopActions: [],
      mobileActions: [],
    });
    expect(JSON.stringify(declaredMismatch)).not.toContain('scope_mismatch');

    const scopeMismatchConversation: ConversationActionSourceV1 = {
      ...emptyConversationSource(),
      readiness: 'denied',
      freshness: null,
      partitions: CONVERSATION_ACTION_PARTITION_KEYS_V1.map((key) => ({
        key,
        readiness: 'denied' as const,
        freshness: null,
        failureCode: 'scope_mismatch' as const,
      })),
      data: null,
      failureCode: 'scope_mismatch',
    };
    expect(
      buildWorkbenchActionProjection({
        care: emptyCareSource(),
        conversation: scopeMismatchConversation,
        filter: 'all',
      }),
    ).toEqual({
      status: 'blocked',
      filter: 'all',
      cards: [],
      desktopActions: [],
      mobileActions: [],
    });
  });

  it('projects an exact low-sensitivity whitelist and strips producer-only or extra fields', () => {
    const careAction = {
      ...appointment('whitelist'),
      sourceVersion: 'hidden-source-version',
      customer: {
        ...appointment('whitelist').customer,
        phone: 'hidden-phone',
      },
      owner: {
        kind: 'user',
        userId: 'hidden-user-id',
        displayName: '低敏成员',
        internalRole: 'hidden-role',
      },
      providerPayload: 'hidden-provider-payload',
    } as CareActionItemV1;
    const followUpAction = {
      ...followUp('whitelist-followup'),
      customer: {
        ...followUp('whitelist-followup').customer,
        phone: 'hidden-followup-phone',
      },
      owner: {
        kind: 'role_pool',
        role: 'customer_service',
        internalPoolId: 'hidden-pool-id',
      },
      providerPayload: 'hidden-followup-provider-payload',
    } as CareActionItemV1;
    const conversationAction = {
      ...conversation('whitelist'),
      segmentId: 'hidden-segment-id',
      sourceVersion: 'hidden-source-version',
      channelNickname: 'hidden-channel',
      externalAccount: 'hidden-account',
      messageBody: 'hidden-message-body',
      assignee: {
        userId: 'hidden-user-id',
        displayName: '低敏成员',
      },
    } as ConversationActionItemV1;
    const result = buildWorkbenchActionProjection({
      care: {
        ...emptyCareSource(),
        readiness: 'ready',
        partitions: CARE_ACTION_PARTITION_KEYS_V1.map((key) => ({
          key,
          readiness: 'ready' as const,
          freshness: currentFreshness,
          failureCode: null,
        })),
        data: {
          cards: CARE_ACTION_PARTITION_KEYS_V1.map((key) => card(key, 1)),
          actions: [careAction, followUpAction],
        },
      },
      conversation: readyConversationSource([conversationAction]),
      filter: 'all',
    });

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    const forbiddenKeys = [
      'scope',
      'tenantId',
      'institutionId',
      'sourceVersion',
      'segmentId',
      'customerId',
      'userId',
      'failureCode',
      'phone',
      'providerPayload',
      'channelNickname',
      'externalAccount',
      'messageBody',
    ];
    const outputKeys = collectObjectKeys(result);
    for (const key of forbiddenKeys) {
      expect(outputKeys.has(key), key).toBe(false);
    }

    const appointmentRow = result.desktopActions.find((row) => row.kind === 'appointment');
    const followUpRow = result.desktopActions.find((row) => row.kind === 'followup');
    const conversationRow = result.desktopActions.find((row) => row.kind === 'conversation');
    expect(Object.keys(result).sort()).toEqual([
      'cards',
      'desktopActions',
      'filter',
      'mobileActions',
      'sourceReadiness',
      'status',
    ]);
    expect(Object.keys(result.sourceReadiness).sort()).toEqual(['care', 'conversation']);
    expect(Object.keys(result.cards[0]!).sort()).toEqual([
      'canonicalHref',
      'count',
      'key',
      'observedAt',
      'status',
      'title',
    ]);
    expect(Object.keys(appointmentRow!).sort()).toEqual([
      'appointmentAt',
      'businessState',
      'cardKeys',
      'detailHref',
      'key',
      'kind',
      'owner',
      'priority',
      'riskLevel',
      'safeSummary',
      'slaAt',
      'sortSignals',
      'subject',
    ]);
    expect(Object.keys(appointmentRow!.subject).sort()).toEqual([
      'displayName',
      'kind',
      'maskedReference',
    ]);
    expect(appointmentRow?.kind).toBe('appointment');
    if (appointmentRow?.kind === 'appointment') {
      expect(appointmentRow.owner).toEqual({ kind: 'user', displayName: '低敏成员' });
    }
    expect(Object.keys(followUpRow!).sort()).toEqual([
      'businessState',
      'cardKeys',
      'detailHref',
      'dueAt',
      'key',
      'kind',
      'owner',
      'priority',
      'riskLevel',
      'safeSummary',
      'slaAt',
      'sortSignals',
      'subject',
    ]);
    expect(followUpRow?.kind).toBe('followup');
    if (followUpRow?.kind === 'followup') {
      expect(followUpRow.owner).toEqual({ kind: 'role_pool', role: 'customer_service' });
      expect(Object.keys(followUpRow.subject).sort()).toEqual([
        'displayName',
        'kind',
        'maskedReference',
      ]);
    }
    expect(Object.keys(conversationRow!).sort()).toEqual([
      'assignee',
      'conversationState',
      'detailHref',
      'key',
      'kind',
      'lastCustomerMessageAt',
      'partitions',
      'priority',
      'riskState',
      'safeSummary',
      'slaAt',
      'sortSignals',
      'subject',
    ]);
    expect(conversationRow?.kind).toBe('conversation');
    if (conversationRow?.kind === 'conversation') {
      expect(conversationRow.assignee).toEqual({ displayName: '低敏成员' });
    }
  });
});
