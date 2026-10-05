import { describe, expect, it } from 'vitest';

import { buildFormalCareActionSourceV1 } from '@/modules/care/application/formal-care-action-source';
import type { FormalFollowUpTaskRecordV1 } from '@/modules/care/ports/formal-follow-up-store';
import type { ConversationActionSourceV1 } from '@/modules/institution-contracts/v1/conversation-action';
import { buildWorkbenchActionProjection } from '@/modules/institution-workbench/domain/workbench-action-aggregation';

function task(
  overrides: Partial<FormalFollowUpTaskRecordV1> = {},
): FormalFollowUpTaskRecordV1 {
  return {
    tenantId: 'tenant-1',
    institutionId: 'institution-1',
    taskId: 'task-1',
    customerId: 'customer-1',
    customerDisplayName: '客户A',
    customerMaskedReference: null,
    stageCode: 'manual_followup',
    actionCode: 'manual_contact',
    dueAt: '2026-08-17T04:00:00.000Z',
    state: 'pending',
    revision: 1,
    riskLevel: 'none',
    riskKind: null,
    riskEventId: null,
    completionCode: null,
    completionFeedback: null,
    cancellationReason: null,
    assignment: {
      kind: 'role_pool',
      role: 'customer_service',
    },
    idempotencyKey: 'manual-idempotency-001',
    requestDigest: 'a'.repeat(64),
    createdBy: 'admin-1',
    updatedBy: 'admin-1',
    createdAt: '2026-08-17T01:00:00.000Z',
    updatedAt: '2026-08-17T01:00:00.000Z',
    ...overrides,
  };
}

describe('Formal CareActionSourceV1', () => {
  it('keeps appointment partitions disabled and publishes only formal follow-up actions', () => {
    const source = buildFormalCareActionSourceV1({
      tenantId: 'tenant-1',
      institutionId: 'institution-1',
      tasks: [task()],
      counts: { overdue: 0, dueToday: 1 },
      referenceTime: '2026-08-17T06:00:00.000Z',
      timeZone: 'Asia/Shanghai',
      operatingContextVersion: '1',
    });

    expect(source.readiness).toBe('partial');
    expect(source.failureCode).toBe('data_incomplete');
    expect(source.partitions.slice(0, 2)).toEqual([
      expect.objectContaining({
        readiness: 'disabled',
        failureCode: 'not_released',
      }),
      expect.objectContaining({
        readiness: 'disabled',
        failureCode: 'not_released',
      }),
    ]);
    expect(source.data?.actions).toHaveLength(1);
    expect(source.data?.actions[0]).toMatchObject({
      entityType: 'followup',
      objectId: 'task-1',
      businessState: 'pending',
      owner: {
        kind: 'role_pool',
        role: 'customer_service',
      },
    });
    expect(JSON.stringify(source)).not.toMatch(
      /message_body|his_payload|provider_payload|raw_payload/iu,
    );
  });

  it('其他机构任务使数据源不可用，不伪造零计数', () => {
    const source = buildFormalCareActionSourceV1({
      tenantId: 'tenant-1',
      institutionId: 'institution-1',
      tasks: [
        task({
          taskId: 'foreign-task',
          institutionId: 'institution-other',
        }),
      ],
      counts: { overdue: 0, dueToday: 1 },
      referenceTime: '2026-08-17T06:00:00.000Z',
      timeZone: 'Asia/Shanghai',
      operatingContextVersion: '1',
    });

    expect(source.readiness).toBe('unavailable');
    expect(source.data).toBeNull();
  });
});

function sourceInput() {
  return {
    tenantId: 'tenant-1', institutionId: 'institution-1',
    tasks: Array.from({ length: 6 }, (_, i) => task({ taskId: `task-${i}` })),
    counts: { overdue: 120, dueToday: 35 },
    referenceTime: '2026-08-17T06:00:00.000Z',
    timeZone: 'Asia/Shanghai', operatingContextVersion: '1',
  };
}

describe('工作台全量计数与候选投影', () => {
  it('155 条统计独立于 6 个今日候选，逾期没有候选仍保持真实计数与 ready', () => {
    const source = buildFormalCareActionSourceV1(sourceInput());
    expect(source.data?.cards.map(({ count }) => count)).toEqual([120, 35]);
    expect(source.data?.actions).toHaveLength(6);
    expect(source.partitions.slice(2).map(({ readiness }) => readiness)).toEqual(['ready', 'ready']);
    expect(source.partitions[2]?.freshness).toEqual({
      observedAt: '2026-08-17T06:00:00.000Z', freshUntil: '2026-08-17T06:00:05.000Z',
    });
  });

  it('可信空集保留 empty、零计数和原下钻链接', () => {
    const source = buildFormalCareActionSourceV1({ ...sourceInput(), tasks: [], counts: { overdue: 0, dueToday: 0 } });
    expect(source.partitions.slice(2).map(({ readiness }) => readiness)).toEqual(['empty', 'empty']);
    expect(source.data).toEqual({ cards: [
      { key: 'overdue_followups', count: 0, canonicalHref: '/hospital/care/followups?bucket=overdue' },
      { key: 'today_due_followups', count: 0, canonicalHref: '/hospital/care/followups?bucket=today' },
    ], actions: [] });
  });

  it.each([
    { counts: { overdue: -1, dueToday: 35 } },
    { counts: { overdue: 0.5, dueToday: 35 } },
    { counts: { overdue: Number.MAX_SAFE_INTEGER, dueToday: 35 } },
    { counts: { overdue: 155, dueToday: 0 } },
    { tasks: sourceInput().tasks.slice(0, 5) },
    { tasks: [...sourceInput().tasks, task({ taskId: 'extra' })] },
    { tasks: [task(), task()] , counts: { overdue: 0, dueToday: 2 } },
    { tasks: [task({ state: 'completed' })], counts: { overdue: 0, dueToday: 1 } },
    { tasks: [task({ state: 'cancelled' })], counts: { overdue: 0, dueToday: 1 } },
    { tasks: [task({ dueAt: '2026-08-18T00:00:00Z' })], counts: { overdue: 0, dueToday: 1 } },
    { tasks: [task({ dueAt: 'invalid' })], counts: { overdue: 0, dueToday: 1 } },
    { tasks: [task({ tenantId: 'foreign' })], counts: { overdue: 0, dueToday: 1 } },
    { timeZone: 'invalid/zone' },
    { operatingContextVersion: '' },
    { referenceTime: 'invalid' },
  ])('异常统计、候选或上下文 %o 不显示为业务零值', (change) => {
    const source = buildFormalCareActionSourceV1({ ...sourceInput(), ...change });
    expect(source.readiness).toBe('unavailable');
    expect(source.data).toBeNull();
    expect(source.failureCode).toBe('invalid_payload');
  });

  it('接入真实全局聚合时保留6/4上限、稳定排序和会话混排', () => {
    const input = sourceInput();
    input.tasks = ['b', 'A', 'a', 'normal-2', 'normal-3', 'normal-4'].map((id, i) => task({
      taskId: id, riskLevel: i < 3 ? 'high' : 'none',
    }));
    const care = buildFormalCareActionSourceV1(input);
    const conversation: ConversationActionSourceV1 = {
      contractVersion: 'v1', scope: { tenantId: 'tenant-1', institutionId: 'institution-1' },
      readiness: 'partial', failureCode: 'data_incomplete', freshness: null,
      partitions: [
        { key: 'waiting_human', readiness: 'ready', freshness: care.partitions[2]!.freshness, failureCode: null },
        { key: 'unresolved_risk', readiness: 'disabled', freshness: null, failureCode: 'not_released' },
      ],
      data: { actions: [{
        conversationId: 'conversation-1', segmentId: 'segment-1', sourceVersion: 'v1', production: true,
        subject: { kind: 'unmatched_contact', label: '待匹配联系人' },
        conversationState: 'awaiting_human', riskState: 'none', partitions: ['waiting_human'],
        sortSignals: ['urgent'], lastCustomerMessageAt: '2026-08-17T03:00:00Z',
        slaAt: null, priority: 'high', assignee: null, safeSummary: null,
        detailHref: '/hospital/conversations/conversation-1',
      }] },
    };
    const result = buildWorkbenchActionProjection({ care, conversation, filter: 'all' });
    expect(result.desktopActions).toHaveLength(6);
    expect(result.mobileActions).toHaveLength(4);
    expect(result.desktopActions.slice(0, 4).map(({ key }) => key)).toEqual([
      'conversation:conversation-1', 'followup:A', 'followup:a', 'followup:b',
    ]);
    expect(result.cards.map(({ count }) => count)).toEqual([120, 35]);
    expect(buildWorkbenchActionProjection({ care, conversation, filter: 'followup' }).desktopActions).toHaveLength(6);
  });
});
