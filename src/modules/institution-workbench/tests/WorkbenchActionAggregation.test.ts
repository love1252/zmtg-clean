import { describe, expect, it } from 'vitest';

import type {
  CareActionCardV1,
  CareActionItemV1,
  CareActionSourceV1,
  CareAppointmentActionItemV1,
  CareFollowUpActionItemV1,
} from '@/modules/institution-contracts/v1/care-action';
import type {
  ConversationActionItemV1,
  ConversationActionSourceV1,
} from '@/modules/institution-contracts/v1/conversation-action';
import { buildWorkbenchActionProjection } from '@/modules/institution-workbench/domain/workbench-action-aggregation';
import {
  WORKBENCH_ACTION_FILTERS,
  WORKBENCH_DESKTOP_ACTION_LIMIT,
  WORKBENCH_MOBILE_ACTION_LIMIT,
} from '@/modules/institution-workbench/domain/workbench-action-view-models';

const scope = {
  tenantId: 'tenant-safe-reference',
  institutionId: 'institution-safe-reference',
};

const currentFreshness = {
  observedAt: '2026-07-17T01:00:00.000Z',
  freshUntil: '2026-07-17T01:05:00.000Z',
};

const currentCards: CareActionCardV1[] = [
  {
    key: 'pending_confirmation_appointments',
    count: 2,
    canonicalHref: '/hospital/care/appointments?status=pending_confirmation',
  },
  {
    key: 'reschedule_requested_appointments',
    count: 1,
    canonicalHref: '/hospital/care/appointments?status=reschedule_requested',
  },
  {
    key: 'overdue_followups',
    count: 2,
    canonicalHref: '/hospital/care/followups?bucket=overdue',
  },
  {
    key: 'today_due_followups',
    count: 1,
    canonicalHref: '/hospital/care/followups?bucket=today',
  },
];

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
    sortSignals: [],
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
    sortSignals: [],
    appointmentAt: null,
    dueAt: '2026-07-17T09:00:00.000Z',
    slaAt: null,
    riskLevel: 'watch',
    priority: 'normal',
    owner: {
      kind: 'role_pool',
      role: 'customer_service',
    },
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
    sortSignals: [],
    lastCustomerMessageAt: '2026-07-17T09:00:00.000Z',
    slaAt: null,
    priority: 'normal',
    assignee: {
      userId: `user-${id}`,
      displayName: `成员 ${id}`,
    },
    safeSummary: null,
    detailHref: `/hospital/conversations/${id}`,
  };

  return { ...base, ...overrides };
}

function careSource(actions: CareActionItemV1[]): CareActionSourceV1 {
  return {
    contractVersion: 'v1',
    scope,
    readiness: 'ready',
    freshness: currentFreshness,
    partitions: [
      'pending_confirmation_appointments',
      'reschedule_requested_appointments',
      'overdue_followups',
      'today_due_followups',
    ].map((key) => ({
      key,
      readiness: 'ready',
      freshness: currentFreshness,
      failureCode: null,
    })) as CareActionSourceV1['partitions'],
    data: {
      cards: currentCards,
      actions,
    },
    failureCode: null,
  };
}

function conversationSource(actions: ConversationActionItemV1[]): ConversationActionSourceV1 {
  return {
    contractVersion: 'v1',
    scope,
    readiness: 'ready',
    freshness: currentFreshness,
    partitions: [
      {
        key: 'waiting_human',
        readiness: 'ready',
        freshness: currentFreshness,
        failureCode: null,
      },
      {
        key: 'unresolved_risk',
        readiness: 'ready',
        freshness: currentFreshness,
        failureCode: null,
      },
    ],
    data: { actions },
    failureCode: null,
  };
}

function project(
  careActions: CareActionItemV1[],
  conversationActions: ConversationActionItemV1[],
  filter: 'all' | 'appointment' | 'followup' | 'conversation' = 'all',
) {
  return buildWorkbenchActionProjection({
    care: careSource(careActions),
    conversation: conversationSource(conversationActions),
    filter,
  });
}

describe('WorkbenchActionAggregation', () => {
  it('freezes the four filters and desktop/mobile limits', () => {
    expect(WORKBENCH_ACTION_FILTERS).toEqual([
      'all',
      'appointment',
      'followup',
      'conversation',
    ]);
    expect(WORKBENCH_DESKTOP_ACTION_LIMIT).toBe(6);
    expect(WORKBENCH_MOBILE_ACTION_LIMIT).toBe(4);
  });

  it('builds canonical stable keys without deduplicating equal IDs across entity kinds', () => {
    const result = project(
      [
        appointment('shared-id'),
        followUp('shared-id'),
        appointment('wrong-href', {
          detailHref: '/hospital/care/appointments/different-id',
        }),
        followUp('wrong-followup-href', {
          detailHref: '/hospital/care/followups/different-id',
        }),
      ],
      [
        conversation('shared-id'),
        conversation('wrong-conversation-href', {
          detailHref: '/hospital/conversations/different-id',
        }),
      ],
    );

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    expect(result.desktopActions.map((row) => row.key)).toEqual([
      'appointment:shared-id',
      'conversation:shared-id',
      'followup:shared-id',
    ]);
    expect(result.desktopActions.map((row) => row.detailHref)).toEqual([
      '/hospital/care/appointments/shared-id',
      '/hospital/conversations/shared-id',
      '/hospital/care/followups/shared-id',
    ]);
    expect(result.desktopActions.some((row) => row.key === 'appointment:wrong-href')).toBe(false);
    expect(result.desktopActions.some((row) => row.key === 'followup:wrong-followup-href')).toBe(
      false,
    );
    expect(
      result.desktopActions.some((row) => row.key === 'conversation:wrong-conversation-href'),
    ).toBe(false);
  });

  it('rejects URL dot-segment IDs for every entity without rejecting safe dot-containing IDs', () => {
    const result = project(
      [
        appointment('.'),
        appointment('..'),
        followUp('.'),
        followUp('..'),
        appointment('.safe'),
        followUp('safe..id'),
      ],
      [conversation('.'), conversation('..'), conversation('...')],
    );

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    expect(result.desktopActions.map((row) => [row.key, row.detailHref])).toEqual([
      ['appointment:.safe', '/hospital/care/appointments/.safe'],
      ['conversation:...', '/hospital/conversations/...'],
      ['followup:safe..id', '/hospital/care/followups/safe..id'],
    ]);
  });

  it('merges only controlled memberships/signals and rejects conflicting duplicate rows', () => {
    const mergeAppointment = appointment('merge-appointment', {
      cardKeys: ['pending_confirmation_appointments'],
      sortSignals: ['today'],
    });
    const mergeConversation = conversation('merge-conversation', {
      partitions: ['waiting_human'],
      sortSignals: ['sla_due'],
      slaAt: '2026-07-17T09:10:00.000Z',
    });
    const timeConflict = appointment('time-conflict');
    const subjectConflict = conversation('subject-conflict');

    const result = project(
      [
        mergeAppointment,
        {
          ...mergeAppointment,
          cardKeys: ['reschedule_requested_appointments'],
          sortSignals: ['urgent'],
        },
        followUp('conflict', { sourceVersion: 'version-a' }),
        followUp('conflict', { sourceVersion: 'version-b' }),
        timeConflict,
        {
          ...timeConflict,
          appointmentAt: '2026-07-17T09:30:00.000Z',
        },
      ],
      [
        mergeConversation,
        {
          ...mergeConversation,
          partitions: ['unresolved_risk'],
          sortSignals: ['urgent'],
        },
        subjectConflict,
        {
          ...subjectConflict,
          subject: { kind: 'unmatched_contact', label: '待匹配联系人' },
        },
      ],
    );

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    const appointmentRow = result.desktopActions.find(
      (row) => row.key === 'appointment:merge-appointment',
    );
    const conversationRow = result.desktopActions.find(
      (row) => row.key === 'conversation:merge-conversation',
    );

    expect(appointmentRow?.kind).toBe('appointment');
    if (appointmentRow?.kind === 'appointment') {
      expect(appointmentRow.cardKeys).toEqual([
        'pending_confirmation_appointments',
        'reschedule_requested_appointments',
      ]);
      expect(appointmentRow.sortSignals).toEqual(['urgent', 'today']);
    }
    expect(conversationRow?.kind).toBe('conversation');
    if (conversationRow?.kind === 'conversation') {
      expect(conversationRow.partitions).toEqual(['waiting_human', 'unresolved_risk']);
      expect(conversationRow.sortSignals).toEqual(['urgent', 'sla_due']);
    }
    expect(result.desktopActions.some((row) => row.key === 'followup:conflict')).toBe(false);
    expect(result.desktopActions.some((row) => row.key === 'appointment:time-conflict')).toBe(
      false,
    );
    expect(
      result.desktopActions.some((row) => row.key === 'conversation:subject-conflict'),
    ).toBe(false);
  });

  it('merges semantic duplicates regardless of nested object property insertion order', () => {
    const careFirst = appointment('property-order', {
      customer: {
        contractVersion: 'v1',
        customerId: 'customer-property-order',
        displayName: '同一客户',
        maskedReference: '客户-01',
      },
      owner: {
        kind: 'user',
        userId: 'user-property-order',
        displayName: '同一成员',
      },
      cardKeys: ['pending_confirmation_appointments'],
      sortSignals: ['today'],
    });
    const careSecond = appointment('property-order', {
      customer: {
        maskedReference: '客户-01',
        displayName: '同一客户',
        customerId: 'customer-property-order',
        contractVersion: 'v1',
      },
      owner: {
        displayName: '同一成员',
        userId: 'user-property-order',
        kind: 'user',
      },
      cardKeys: ['reschedule_requested_appointments'],
      sortSignals: ['urgent'],
    });
    const conversationFirst = conversation('property-order', {
      subject: {
        kind: 'customer',
        customer: {
          contractVersion: 'v1',
          customerId: 'conversation-customer-property-order',
          displayName: '同一会话客户',
          maskedReference: null,
        },
      },
      assignee: {
        userId: 'conversation-user-property-order',
        displayName: '同一会话成员',
      },
      partitions: ['waiting_human'],
      sortSignals: ['today'],
    });
    const conversationSecond = conversation('property-order', {
      subject: {
        customer: {
          maskedReference: null,
          displayName: '同一会话客户',
          customerId: 'conversation-customer-property-order',
          contractVersion: 'v1',
        },
        kind: 'customer',
      },
      assignee: {
        displayName: '同一会话成员',
        userId: 'conversation-user-property-order',
      },
      partitions: ['unresolved_risk'],
      sortSignals: ['urgent'],
    });

    const result = project(
      [careFirst, careSecond],
      [conversationFirst, conversationSecond],
    );

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    expect(result.desktopActions.map((row) => row.key)).toEqual([
      'appointment:property-order',
      'conversation:property-order',
    ]);
    expect(result.desktopActions[0]).toMatchObject({
      cardKeys: [
        'pending_confirmation_appointments',
        'reschedule_requested_appointments',
      ],
      sortSignals: ['urgent', 'today'],
    });
    expect(result.desktopActions[1]).toMatchObject({
      partitions: ['waiting_human', 'unresolved_risk'],
      sortSignals: ['urgent', 'today'],
    });
  });

  it('sorts by the frozen signal order before business time', () => {
    const result = project(
      [
        appointment('urgent', { sortSignals: ['urgent'] }),
        followUp('overdue', { sortSignals: ['overdue'] }),
        appointment('today', { sortSignals: ['today'] }),
        followUp('high', { sortSignals: ['high_priority'] }),
      ],
      [
        conversation('sla', {
          sortSignals: ['sla_due'],
          slaAt: '2026-07-17T09:05:00.000Z',
        }),
        conversation('normal'),
      ],
    );

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    expect(result.desktopActions.map((row) => row.key)).toEqual([
      'appointment:urgent',
      'followup:overdue',
      'conversation:sla',
      'appointment:today',
      'followup:high',
      'conversation:normal',
    ]);
  });

  it('uses business time then stable key and ignores summary, customer and assignment text', () => {
    const result = project(
      [
        appointment('b', {
          sortSignals: ['urgent'],
          appointmentAt: '2026-07-17T09:00:00.000Z',
          slaAt: '2026-07-17T08:00:00.000Z',
          safeSummary: 'AAA',
          customer: {
            contractVersion: 'v1',
            customerId: 'customer-b',
            displayName: '甲',
            maskedReference: null,
          },
          owner: { kind: 'user', userId: 'user-b', displayName: '甲' },
        }),
        appointment('a', {
          sortSignals: ['urgent'],
          appointmentAt: '2026-07-17T09:00:00.000Z',
          slaAt: '2026-07-17T10:00:00.000Z',
          safeSummary: 'ZZZ',
          customer: {
            contractVersion: 'v1',
            customerId: 'customer-a',
            displayName: '乙',
            maskedReference: null,
          },
          owner: { kind: 'user', userId: 'user-a', displayName: '乙' },
        }),
        appointment('c', {
          sortSignals: ['urgent'],
          appointmentAt: '2026-07-17T08:59:00.000Z',
        }),
      ],
      [
        conversation('b-sla', {
          sortSignals: ['sla_due'],
          lastCustomerMessageAt: '2026-07-17T10:00:00.000Z',
          slaAt: '2026-07-17T09:01:00.000Z',
        }),
        conversation('a-sla', {
          sortSignals: ['sla_due'],
          lastCustomerMessageAt: '2026-07-17T10:00:00.000Z',
          slaAt: '2026-07-17T09:59:00.000Z',
        }),
      ],
    );

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    expect(result.desktopActions.map((row) => row.key)).toEqual([
      'appointment:c',
      'appointment:a',
      'appointment:b',
      'conversation:a-sla',
      'conversation:b-sla',
    ]);
  });

  it('uses dueAt and lastCustomerMessageAt as business times without inferring rank from priority', () => {
    const followUps = project(
      [
        followUp('later', {
          dueAt: '2026-07-17T10:00:00.000Z',
          priority: 'high',
        }),
        followUp('earlier', { dueAt: '2026-07-17T09:00:00.000Z' }),
      ],
      [],
      'followup',
    );
    const conversations = project(
      [],
      [
        conversation('later', {
          lastCustomerMessageAt: '2026-07-17T10:00:00.000Z',
          priority: 'high',
        }),
        conversation('earlier', { lastCustomerMessageAt: '2026-07-17T09:00:00.000Z' }),
      ],
      'conversation',
    );

    expect(followUps.status).toBe('projected');
    if (followUps.status === 'projected') {
      expect(followUps.desktopActions.map((row) => row.key)).toEqual([
        'followup:earlier',
        'followup:later',
      ]);
    }
    expect(conversations.status).toBe('projected');
    if (conversations.status === 'projected') {
      expect(conversations.desktopActions.map((row) => row.key)).toEqual([
        'conversation:earlier',
        'conversation:later',
      ]);
    }
  });

  it('rejects missing business times, invalid times, overlong summaries and missing SLA times', () => {
    const result = project(
      [
        appointment('missing-appointment-time', { appointmentAt: null }),
        followUp('missing-followup-time', { dueAt: null }),
        appointment('missing-sla', { sortSignals: ['sla_due'], slaAt: null }),
        appointment('overlong-summary', { safeSummary: '字'.repeat(121) }),
        appointment('valid-nullable', { owner: null, safeSummary: null, slaAt: null }),
      ],
      [
        conversation('invalid-time', { lastCustomerMessageAt: 'not-an-iso-time' }),
        conversation('missing-conversation-sla', {
          sortSignals: ['sla_due'],
          slaAt: null,
        }),
        conversation('invalid-conversation-sla', {
          sortSignals: ['sla_due'],
          slaAt: 'not-an-iso-time',
        }),
        conversation('overlong-conversation-summary', { safeSummary: '字'.repeat(121) }),
      ],
    );

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    expect(result.desktopActions.map((row) => row.key)).toEqual([
      'appointment:valid-nullable',
    ]);
  });

  it('filters before truncation and keeps mobile as the desktop prefix', () => {
    const appointments = Array.from({ length: 7 }, (_, index) =>
      appointment(`appointment-${index}`, {
        appointmentAt: `2026-07-17T10:0${index}:00.000Z`,
      }),
    );
    const conversations = Array.from({ length: 7 }, (_, index) =>
      conversation(`conversation-${index}`, {
        sortSignals: ['urgent'],
        lastCustomerMessageAt: `2026-07-17T09:0${index}:00.000Z`,
      }),
    );
    const followUps = Array.from({ length: 7 }, (_, index) =>
      followUp(`followup-${index}`, {
        dueAt: `2026-07-17T11:0${index}:00.000Z`,
      }),
    );

    const careActions = [...appointments, ...followUps];
    const all = project(careActions, conversations, 'all');
    const appointmentOnly = project(careActions, conversations, 'appointment');
    const followUpOnly = project(careActions, conversations, 'followup');
    const conversationOnly = project(careActions, conversations, 'conversation');

    for (const result of [all, appointmentOnly, followUpOnly, conversationOnly]) {
      expect(result.status).toBe('projected');
      if (result.status !== 'projected') {
        continue;
      }
      expect(result.desktopActions).toHaveLength(6);
      expect(result.mobileActions).toEqual(result.desktopActions.slice(0, 4));
    }

    if (all.status === 'projected') {
      expect(all.desktopActions.every((row) => row.kind === 'conversation')).toBe(true);
    }
    if (appointmentOnly.status === 'projected') {
      expect(appointmentOnly.desktopActions.every((row) => row.kind === 'appointment')).toBe(true);
    }
    if (followUpOnly.status === 'projected') {
      expect(followUpOnly.desktopActions.every((row) => row.kind === 'followup')).toBe(true);
    }
    if (conversationOnly.status === 'projected') {
      expect(conversationOnly.desktopActions.every((row) => row.kind === 'conversation')).toBe(true);
    }
  });

  it('preserves approved nullable fields and the fixed unmatched-contact subject', () => {
    const result = project(
      [followUp('nullable-care', { owner: null, safeSummary: null, slaAt: null })],
      [
        conversation('nullable-conversation', {
          subject: { kind: 'unmatched_contact', label: '待匹配联系人' },
          assignee: null,
          safeSummary: null,
          slaAt: null,
        }),
      ],
    );

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    const careRow = result.desktopActions.find((row) => row.key === 'followup:nullable-care');
    const conversationRow = result.desktopActions.find(
      (row) => row.key === 'conversation:nullable-conversation',
    );
    expect(careRow).toMatchObject({ owner: null, safeSummary: null, slaAt: null });
    expect(conversationRow).toMatchObject({
      subject: { kind: 'unmatched_contact', label: '待匹配联系人' },
      assignee: null,
      safeSummary: null,
      slaAt: null,
    });
  });
});
